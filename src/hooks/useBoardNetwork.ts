import { useEffect } from 'react';
import { toast } from 'sonner';
import { useBoardStore, type SharedAttachment, type SharedItem } from '@/store/useBoardStore';
import { WebRTCManager, type SignalMessage } from '@/lib/webrtc';
import { getPusherClient } from '@/lib/pusher';
import type { Channel } from 'pusher-js';

const MAX_TEXT_LENGTH = 10_000;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_ITEMS_PER_SYNC = 100;
const CHUNK_SIZE = 64_000;
const ID_LENGTH = 36;
const ONLINE_PRIVATE_HOST_KEY = 'cboard-online-private-host';
const LOCAL_BROWSER_SESSION_KEY = 'cboard-local-browser-session';

let webSocketInstance: WebSocket | null = null;
let webrtcInstance: WebRTCManager | null = null;
let webrtcOwnerId: string | null = null;
let signalSender: ((signal: SignalMessage) => void) | null = null;
let onlineChannelInstance: PresenceChannel | null = null;
let onlinePrivateJoin: ((pin: string) => Promise<void>) | null = null;

interface PresenceMember {
    id: string;
}

interface PresenceMembers {
    myID: string;
    count: number;
    each: (callback: (member: PresenceMember) => void) => void;
}

interface PresenceChannel extends Channel {
    members?: PresenceMembers;
}

export function getNetworkMode(hostname: string): 'local' | 'online' {
    const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const privateIpv4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
    return normalized === 'localhost'
        || normalized === '127.0.0.1'
        || normalized === '::1'
        || normalized.endsWith('.local')
        || privateIpv4.test(normalized)
        ? 'local'
        : 'online';
}

export function getOnlineWaitingState(role: 'host' | 'receiver' | null) {
    return role === 'host' ? 'hosting' as const : 'joining' as const;
}

function generateId(): string {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().padEnd(ID_LENGTH, ' ').slice(0, ID_LENGTH);
    }
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(value);
}

function isSafeAttachment(value: unknown): value is SharedAttachment {
    if (!isRecord(value)) return false;
    return isSafeId(value.id)
        && typeof value.fileName === 'string'
        && value.fileName.length > 0
        && value.fileName.length <= 255
        && typeof value.fileSize === 'number'
        && Number.isFinite(value.fileSize)
        && value.fileSize >= 0
        && value.fileSize <= MAX_FILE_SIZE
        && typeof value.mimeType === 'string'
        && value.mimeType.length <= 100;
}

function isSafeItem(value: unknown): value is SharedItem {
    if (!isRecord(value)) return false;
    const attachments = value.attachments;
    return isSafeId(value.id)
        && ['text', 'file', 'post'].includes(String(value.type))
        && typeof value.content === 'string'
        && value.content.length <= MAX_TEXT_LENGTH
        && typeof value.senderId === 'string'
        && value.senderId.length <= 64
        && typeof value.timestamp === 'number'
        && Number.isFinite(value.timestamp)
        && typeof value.expiresAt === 'number'
        && Number.isFinite(value.expiresAt)
        && (attachments === undefined
            || (Array.isArray(attachments) && attachments.length <= MAX_FILES && attachments.every(isSafeAttachment)));
}

export function sanitizeIncomingItem(value: unknown): SharedItem | null {
    if (!isSafeItem(value)) return null;
    return {
        id: value.id,
        type: value.type,
        scope: 'public',
        content: value.content,
        attachments: value.attachments?.map((attachment) => ({
            id: attachment.id,
            fileName: attachment.fileName,
            fileSize: attachment.fileSize,
            mimeType: attachment.mimeType,
        })),
        senderId: value.senderId,
        timestamp: value.timestamp,
        expiresAt: value.expiresAt,
    };
}

async function blobUrlToDataUri(blobUrl: string): Promise<string | null> {
    try {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

function sendSocketMessage(payload: Record<string, unknown>) {
    if (webSocketInstance?.readyState === WebSocket.OPEN) {
        webSocketInstance.send(JSON.stringify(payload));
    }
}

export function submitPairingPin(pin: string) {
    if (!/^\d{6}$/.test(pin)) {
        useBoardStore.getState().setLocalSession({ pairingError: 'Enter the six-digit PIN.' });
        return;
    }
    useBoardStore.getState().setLocalSession({ pairingState: 'joining', pairingError: null });
    if (useBoardStore.getState().networkMode === 'online' && onlinePrivateJoin) {
        void onlinePrivateJoin(pin);
        return;
    }
    sendSocketMessage({ type: 'join', pin });
}

export function setLocalRoomPrivacy(privacy: 'public' | 'private') {
    const store = useBoardStore.getState();
    if (store.networkMode === 'online') {
        if (privacy === 'public') localStorage.removeItem(ONLINE_PRIVATE_HOST_KEY);
        window.location.assign(privacy === 'private' ? '/?create=private' : '/');
        return;
    }
    store.setLocalSession({ localRoomPrivacy: privacy, pairingError: null });
    sendSocketMessage({ type: 'set-room-privacy', privacy });
}

async function sendStoredFilesToPeer(peerId: string, items: SharedItem[]) {
    if (!webrtcInstance) return;

    for (const item of items) {
        for (const attachment of item.attachments || []) {
            if (!attachment.fileData) continue;
            try {
                const response = await fetch(attachment.fileData);
                if (!response.ok) continue;
                const buffer = await response.arrayBuffer();
                if (buffer.byteLength > MAX_FILE_SIZE) continue;
                const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);

                await webrtcInstance.sendTo(peerId, JSON.stringify({
                    type: 'file-start',
                    fileId: attachment.id,
                    itemId: item.id,
                    fileName: attachment.fileName,
                    fileSize: attachment.fileSize,
                    mimeType: attachment.mimeType,
                    totalChunks,
                }));

                const idBytes = new TextEncoder().encode(attachment.id.padEnd(ID_LENGTH, ' ').slice(0, ID_LENGTH));
                for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_SIZE) {
                    const chunk = new Uint8Array(buffer.slice(offset, offset + CHUNK_SIZE));
                    const message = new Uint8Array(ID_LENGTH + chunk.length);
                    message.set(idBytes, 0);
                    message.set(chunk, ID_LENGTH);
                    await webrtcInstance.sendTo(peerId, message.buffer);
                }

                await webrtcInstance.sendTo(peerId, JSON.stringify({ type: 'file-complete', fileId: attachment.id }));
            } catch {
                useBoardStore.getState().addDebugLog(`Could not restore ${attachment.fileName}.`);
            }
        }
    }
}

function setupPeer(myId: string, peerId: string, polite: boolean) {
    const store = useBoardStore.getState();
    if (!webrtcInstance || webrtcOwnerId !== myId) {
        webrtcInstance?.cleanup();
        const rtc = new WebRTCManager(myId, store.networkMode === 'online');
        webrtcInstance = rtc;
        webrtcOwnerId = myId;

        rtc.onSignal = (signal) => signalSender?.(signal);

        rtc.onConnect = (connectedPeerId) => {
            const currentStore = useBoardStore.getState();
            currentStore.addPeer(connectedPeerId);
            currentStore.setConnectionState('connected');
            currentStore.setLocalSession({ pairingState: 'paired', pairingError: null });
            currentStore.addDebugLog(`Secure ${currentStore.networkMode} connection ready.`);
        };

        rtc.onDisconnect = (disconnectedPeerId) => {
            const currentStore = useBoardStore.getState();
            currentStore.removePeer(disconnectedPeerId);
            if (useBoardStore.getState().peers.length > 0) return;
            currentStore.setConnectionState('connecting');
            currentStore.setLocalSession({
                pairingState: currentStore.networkMode === 'online'
                    ? getOnlineWaitingState(currentStore.localRole)
                    : currentStore.localRole === 'host' ? 'hosting' : 'joining',
                pairingError: currentStore.networkMode === 'local' && currentStore.localRole === 'receiver'
                    ? 'Host disconnected. Waiting to reconnect.'
                    : null,
            });
        };

        rtc.onChannelOpen = async (connectedPeerId) => {
            const currentItems = useBoardStore.getState().items.slice(0, MAX_ITEMS_PER_SYNC);
            if (currentItems.length === 0) return;

            const safeMetadata = currentItems.map((item) => ({
                ...item,
                fileData: undefined,
                attachments: item.attachments?.map((attachment) => ({ ...attachment, fileData: undefined })),
            }));
            await rtc.sendTo(connectedPeerId, JSON.stringify({ type: 'sync', items: safeMetadata }));
            await sendStoredFilesToPeer(connectedPeerId, currentItems);
        };

        rtc.onData = (_connectedPeerId, data) => handleIncomingData(data);
    }

    webrtcInstance.createPeer(peerId, polite);
}

function handleIncomingData(data: unknown) {
    const store = useBoardStore.getState();

    try {
        if (typeof data === 'string') {
            if (data.length > 1_000_000) return;
            const payload: unknown = JSON.parse(data);
            if (!isRecord(payload) || typeof payload.type !== 'string') return;

            if (payload.type === 'text' || payload.type === 'post') {
                const safeItem = sanitizeIncomingItem(payload.item);
                if (safeItem) store.addItem(safeItem);
                return;
            }

            if (payload.type === 'sync' && Array.isArray(payload.items)) {
                const safeItems = payload.items
                    .slice(0, MAX_ITEMS_PER_SYNC)
                    .map(sanitizeIncomingItem)
                    .filter((item): item is SharedItem => item !== null);
                store.addItems(safeItems);
                return;
            }

            if (payload.type === 'delete' && isSafeId(payload.itemId)) {
                store.deleteItem(payload.itemId);
                return;
            }

            if (payload.type === 'file-start') {
                const { fileId, itemId, fileName, fileSize, mimeType, totalChunks } = payload;
                if (!isSafeId(fileId)
                    || !isSafeId(itemId)
                    || typeof fileName !== 'string'
                    || fileName.length === 0
                    || fileName.length > 255
                    || typeof fileSize !== 'number'
                    || fileSize < 0
                    || fileSize > MAX_FILE_SIZE
                    || typeof mimeType !== 'string'
                    || mimeType.length > 100
                    || typeof totalChunks !== 'number'
                    || !Number.isInteger(totalChunks)
                    || totalChunks < 0
                    || totalChunks > Math.ceil(MAX_FILE_SIZE / CHUNK_SIZE)) return;

                store.startIncomingFile({
                    id: fileId,
                    itemId,
                    fileName,
                    fileSize,
                    mimeType,
                    receivedBytes: 0,
                    totalChunks,
                    receivedChunks: 0,
                    chunks: [],
                });
                return;
            }

            if (payload.type === 'file-complete' && isSafeId(payload.fileId)) {
                const incoming = store.incomingFiles[payload.fileId];
                if (!incoming) return;

                if (incoming.receivedBytes !== incoming.fileSize || incoming.receivedChunks !== incoming.totalChunks) {
                    store.completeIncomingFile(payload.fileId);
                    store.addDebugLog(`Rejected incomplete file: ${incoming.fileName}`);
                    return;
                }

                const fullBuffer = new Uint8Array(incoming.receivedBytes);
                let offset = 0;
                for (const chunk of incoming.chunks) {
                    fullBuffer.set(new Uint8Array(chunk), offset);
                    offset += chunk.byteLength;
                }
                const fileUrl = URL.createObjectURL(new Blob([fullBuffer], { type: incoming.mimeType }));
                store.attachFileToItem(incoming.itemId || incoming.id, incoming.id, fileUrl);
                store.completeIncomingFile(payload.fileId);
            }
            return;
        }

        if (data instanceof ArrayBuffer) {
            if (data.byteLength <= ID_LENGTH || data.byteLength > ID_LENGTH + CHUNK_SIZE) return;
            const fileId = new TextDecoder().decode(new Uint8Array(data.slice(0, ID_LENGTH))).trim();
            const incoming = store.incomingFiles[fileId];
            const chunk = data.slice(ID_LENGTH);
            if (!incoming
                || incoming.receivedChunks >= incoming.totalChunks
                || incoming.receivedBytes + chunk.byteLength > incoming.fileSize) return;
            store.updateIncomingFileProgress(fileId, chunk, incoming.totalChunks);
        }
    } catch {
        store.addDebugLog('Rejected an invalid incoming message.');
    }
}

function startLocalConnection(isActive: () => boolean) {
    const store = useBoardStore.getState();
    store.setLocalSession({ networkMode: 'local', pairingState: 'connecting', pairingError: null });
    signalSender = (signal) => sendSocketMessage({
        type: 'signal',
        to: signal.to,
        signal: { type: signal.type, data: signal.data },
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let browserSessionId = localStorage.getItem(LOCAL_BROWSER_SESSION_KEY);
    if (!browserSessionId || !/^[a-f0-9-]{32,36}$/.test(browserSessionId)) {
        browserSessionId = generateId();
        localStorage.setItem(LOCAL_BROWSER_SESSION_KEY, browserSessionId);
    }
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?session=${encodeURIComponent(browserSessionId)}`);
    webSocketInstance = socket;

    socket.onmessage = (event) => {
        if (!isActive() || typeof event.data !== 'string' || event.data.length > 100_000) return;
        let message: unknown;
        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }
        if (!isRecord(message) || typeof message.type !== 'string') return;

        if (message.type === 'session' && (message.role === 'host' || message.role === 'receiver') && isSafeId(message.clientId)) {
            store.setMyId(message.clientId);
            const roomPrivacy = message.roomPrivacy === 'private' ? 'private' : 'public';
            if (message.role === 'host') {
                store.setLocalSession({
                    networkMode: 'local',
                    localRole: 'host',
                    localRoomPrivacy: roomPrivacy,
                    pairingCode: typeof message.pairingPin === 'string' ? message.pairingPin : null,
                    shareUrl: typeof message.shareUrl === 'string' ? message.shareUrl : null,
                    pairingState: 'hosting',
                    pairingError: null,
                });
            } else {
                store.setLocalSession({
                    networkMode: 'local',
                    localRole: 'receiver',
                    localRoomPrivacy: roomPrivacy,
                    pairingState: message.requiresPin === true ? 'needs-pin' : 'joining',
                    pairingError: null,
                });
            }
            return;
        }

        if (message.type === 'room-privacy' && (message.privacy === 'public' || message.privacy === 'private')) {
            store.setLocalSession({
                localRoomPrivacy: message.privacy,
                pairingState: store.localRole === 'receiver'
                    ? message.privacy === 'private' ? 'needs-pin' : 'joining'
                    : 'hosting',
                pairingError: null,
            });
            return;
        }

        if (message.type === 'join-rejected') {
            const attemptsLeft = typeof message.attemptsLeft === 'number' ? message.attemptsLeft : 0;
            store.setLocalSession({ pairingState: 'needs-pin', pairingError: `Incorrect PIN. ${attemptsLeft} attempts left.` });
            return;
        }

        if (message.type === 'join-accepted') {
            store.setLocalSession({ pairingState: 'joining', pairingError: null });
            return;
        }

        if (message.type === 'peer-ready' && isSafeId(message.peerId) && typeof message.polite === 'boolean') {
            const myId = useBoardStore.getState().myId;
            if (myId) setupPeer(myId, message.peerId, message.polite);
            return;
        }

        if (message.type === 'signal' && isSafeId(message.from) && isRecord(message.signal)) {
            const signalType = message.signal.type;
            if (!['offer', 'answer', 'candidate'].includes(String(signalType))) return;
            webrtcInstance?.handleSignal({
                to: useBoardStore.getState().myId || '',
                from: message.from,
                type: signalType as SignalMessage['type'],
                data: message.signal.data,
            });
            return;
        }

        if (message.type === 'peer-left' && isSafeId(message.peerId)) {
            webrtcInstance?.removePeer(message.peerId);
            store.removePeer(message.peerId);
            store.setConnectionState('connecting');
            store.setLocalSession({
                pairingState: store.localRole === 'host' ? 'hosting' : 'joining',
                pairingError: store.localRole === 'receiver' ? 'Host disconnected. Waiting to reconnect.' : null,
            });
            return;
        }

        if (message.type === 'error') {
            const code = typeof message.code === 'string' ? message.code : 'error';
            const errorMessage = typeof message.message === 'string' ? message.message : 'Could not connect.';
            store.setConnectionState('disconnected');
            store.setLocalSession({
                pairingState: code === 'room_full' ? 'room-full' : 'error',
                pairingError: errorMessage,
            });
        }
    };

    socket.onerror = () => {
        store.setConnectionState('disconnected');
        store.setLocalSession({ pairingState: 'error', pairingError: 'Cannot reach the local CBoard server.' });
    };

    socket.onclose = () => {
        if (!isActive()) return;
        store.setConnectionState('disconnected');
        store.setLocalSession({ pairingState: 'error', pairingError: 'Local server disconnected. Refresh to retry.' });
    };

    return () => socket.close();
}

function startOnlineConnection(isActive: () => boolean) {
    const store = useBoardStore.getState();
    const searchParams = new URLSearchParams(window.location.search);
    const inviteToken = searchParams.get('invite');
    const publicInviteToken = searchParams.get('public');
    const createPrivate = searchParams.get('create') === 'private';
    store.setLocalSession({
        networkMode: 'online',
        localRoomPrivacy: inviteToken || createPrivate ? 'private' : 'public',
        localRole: inviteToken ? 'receiver' : createPrivate ? 'host' : null,
        pairingState: inviteToken ? 'needs-pin' : createPrivate ? 'hosting' : 'joining',
        pairingError: null,
    });
    let roomName: string | null = null;
    let pusher: ReturnType<typeof getPusherClient> | null = null;

    const connectSession = (session: unknown) => {
        if (!isActive() || !isRecord(session) || !isSafeId(session.userId) || typeof session.roomName !== 'string') {
            throw new Error('The room response was invalid.');
        }

        roomName = session.roomName;
        store.setRoomCode(roomName);
        store.setMyId(session.userId);
        try {
            pusher = getPusherClient();
            const channel = pusher.subscribe(roomName) as PresenceChannel;
            onlineChannelInstance = channel;
            signalSender = (signal) => {
                channel.trigger('client-webrtc-signal', signal);
            };

            channel.bind('pusher:subscription_succeeded', (members: PresenceMembers) => {
                if (!isActive() || !isSafeId(members.myID)) return;
                store.setMyId(members.myID);
                const currentSession = useBoardStore.getState();
                store.setLocalSession({
                    pairingState: getOnlineWaitingState(currentSession.localRole),
                    pairingError: null,
                });
                members.each((member) => {
                    if (member.id !== members.myID && isSafeId(member.id)) {
                        setupPeer(members.myID, member.id, members.myID > member.id);
                    }
                });
            });

            channel.bind('pusher:member_added', (member: PresenceMember) => {
                const myId = channel.members?.myID || useBoardStore.getState().myId;
                if (myId && isSafeId(member.id) && member.id !== myId) {
                    setupPeer(myId, member.id, myId > member.id);
                }
            });

            channel.bind('pusher:member_removed', (member: PresenceMember) => {
                if (!isSafeId(member.id)) return;
                webrtcInstance?.removePeer(member.id);
                store.removePeer(member.id);
                if (useBoardStore.getState().peers.length === 0) {
                    const currentSession = useBoardStore.getState();
                    store.setConnectionState('connecting');
                    store.setLocalSession({ pairingState: getOnlineWaitingState(currentSession.localRole) });
                }
            });

            channel.bind('client-webrtc-signal', (incoming: unknown) => {
                if (!isRecord(incoming)
                    || !isSafeId(incoming.to)
                    || !isSafeId(incoming.from)
                    || !['offer', 'answer', 'candidate'].includes(String(incoming.type))) return;
                const myId = channel.members?.myID || useBoardStore.getState().myId;
                if (!myId || incoming.to !== myId) return;
                if (!webrtcInstance && incoming.type === 'offer') {
                    setupPeer(myId, incoming.from, myId > incoming.from);
                }
                webrtcInstance?.handleSignal({
                    to: myId,
                    from: incoming.from,
                    type: incoming.type as SignalMessage['type'],
                    data: incoming.data,
                });
            });

            channel.bind('pusher:subscription_error', () => {
                store.setConnectionState('disconnected');
                store.setLocalSession({ pairingState: 'error', pairingError: 'Could not join this online room.' });
            });
        } catch (error) {
            throw error;
        }
    };

    const showError = (error: unknown, fallback: string) => {
        store.setConnectionState('disconnected');
        store.setLocalSession({
            pairingState: inviteToken ? 'needs-pin' : 'error',
            pairingError: error instanceof Error ? error.message : fallback,
        });
    };

    const resumePrivateSession = async (token: string) => {
        const response = await fetch('/api/room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'resume-private', inviteToken: token }),
        });
        return response.ok ? await response.json() as unknown : null;
    };

    void (async () => {
        try {
            if (publicInviteToken) {
                const response = await fetch('/api/room', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'join-public', inviteToken: publicInviteToken }),
                });
                const session: unknown = await response.json();
                if (!response.ok) throw new Error('This Public room link expired. Ask for a new link.');
                connectSession(session);
                store.setLocalSession({
                    localRoomPrivacy: 'public',
                    shareUrl: window.location.href,
                    pairingState: 'joining',
                    pairingError: null,
                });
                return;
            }

            if (inviteToken) {
                const resumedSession = await resumePrivateSession(inviteToken);
                if (resumedSession) {
                    connectSession(resumedSession);
                    store.setLocalSession({ pairingState: 'joining', pairingError: null });
                    return;
                }
                onlinePrivateJoin = async (pin: string) => {
                    try {
                        const response = await fetch('/api/room', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'join-private', inviteToken, pin }),
                        });
                        const session: unknown = await response.json();
                        if (!response.ok) {
                            const message = isRecord(session) && typeof session.error === 'string' ? session.error : 'Could not join the private room.';
                            throw new Error(message);
                        }
                        connectSession(session);
                        store.setLocalSession({ pairingState: 'joining', pairingError: null });
                        onlinePrivateJoin = null;
                    } catch (error) {
                        showError(error, 'Could not join the private room.');
                    }
                };
                return;
            }

            if (createPrivate) {
                const savedInvite = localStorage.getItem(ONLINE_PRIVATE_HOST_KEY);
                if (savedInvite) {
                    const resumedSession = await resumePrivateSession(savedInvite);
                    if (isRecord(resumedSession) && typeof resumedSession.pin === 'string') {
                        const shareUrl = `${window.location.origin}/?invite=${encodeURIComponent(savedInvite)}`;
                        store.setLocalSession({
                            localRole: 'host',
                            localRoomPrivacy: 'private',
                            pairingCode: resumedSession.pin,
                            shareUrl,
                            pairingState: 'hosting',
                            pairingError: null,
                        });
                        connectSession(resumedSession);
                        return;
                    }
                    localStorage.removeItem(ONLINE_PRIVATE_HOST_KEY);
                }
                const response = await fetch('/api/room', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'create-private' }),
                });
                const session: unknown = await response.json();
                if (!response.ok || !isRecord(session) || typeof session.pin !== 'string' || typeof session.inviteToken !== 'string') {
                    throw new Error('Could not create the private room.');
                }
                localStorage.setItem(ONLINE_PRIVATE_HOST_KEY, session.inviteToken);
                const shareUrl = `${window.location.origin}/?invite=${encodeURIComponent(session.inviteToken)}`;
                store.setLocalSession({
                    localRole: 'host',
                    localRoomPrivacy: 'private',
                    pairingCode: session.pin,
                    shareUrl,
                    pairingState: 'hosting',
                    pairingError: null,
                });
                connectSession(session);
                return;
            }

            const response = await fetch('/api/room', { cache: 'no-store' });
            if (!response.ok) throw new Error('Could not create the public room.');
            const session: unknown = await response.json();
            if (!isRecord(session) || typeof session.inviteToken !== 'string') throw new Error('Could not create the Public room link.');
            store.setLocalSession({
                shareUrl: `${window.location.origin}/?public=${encodeURIComponent(session.inviteToken)}`,
                pairingError: null,
            });
            connectSession(session);
        } catch (error) {
            showError(error, 'Online room is unavailable.');
        }
    })();

    return () => {
        onlinePrivateJoin = null;
        onlineChannelInstance?.unbind_all();
        if (pusher && roomName) pusher.unsubscribe(roomName);
        onlineChannelInstance = null;
    };
}

export function useBoardNetworkInit() {
    useEffect(() => {
        const store = useBoardStore.getState();
        let active = true;
        store.setConnectionState('connecting');
        store.removeExpiredItems();

        const mode = getNetworkMode(window.location.hostname);
        const cleanupConnection = mode === 'local'
            ? startLocalConnection(() => active)
            : startOnlineConnection(() => active);
        const cleanupInterval = window.setInterval(() => store.removeExpiredItems(), 60_000);

        return () => {
            active = false;
            window.clearInterval(cleanupInterval);
            cleanupConnection();
            webrtcInstance?.cleanup();
            webrtcInstance = null;
            webrtcOwnerId = null;
            webSocketInstance = null;
            signalSender = null;
            store.setConnectionState('disconnected');
        };
    }, []);
}

export function useBoardNetwork() {
    const sharePost = async (text: string, files: File[]) => {
        const store = useBoardStore.getState();
        const cleanText = text.trim().slice(0, MAX_TEXT_LENGTH);
        const safeFiles = files.slice(0, MAX_FILES).filter((file) => file.size <= MAX_FILE_SIZE);

        if (!webrtcInstance || store.peers.length === 0) {
            toast.error('Connect another device before sharing.');
            return false;
        }
        if (!cleanText && safeFiles.length === 0) return false;
        if (files.length > MAX_FILES || safeFiles.length !== files.length) {
            toast.error('Use up to 10 files, with a maximum of 50 MB per file.');
            return false;
        }

        const itemId = generateId();
        const attachments = safeFiles.map((file) => ({
            id: generateId(),
            fileName: file.name.slice(0, 255),
            fileSize: file.size,
            mimeType: file.type.slice(0, 100),
            fileData: URL.createObjectURL(file),
        }));
        const item: SharedItem = {
            id: itemId,
            type: attachments.length > 0 ? 'post' : 'text',
            content: cleanText,
            attachments: attachments.length > 0 ? attachments : undefined,
            senderId: store.myId || '',
            timestamp: Date.now(),
            expiresAt: Date.now() + 15 * 60 * 1000,
        };

        store.addItem(item);
        await webrtcInstance.broadcast(JSON.stringify({
            type: item.type,
            item: {
                ...item,
                attachments: item.attachments?.map((attachment) => ({ ...attachment, fileData: undefined })),
            },
        }));

        for (let index = 0; index < safeFiles.length; index += 1) {
            const file = safeFiles[index];
            const attachment = attachments[index];
            const buffer = await file.arrayBuffer();
            const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);

            await webrtcInstance.broadcast(JSON.stringify({
                type: 'file-start',
                fileId: attachment.id,
                itemId,
                fileName: attachment.fileName,
                fileSize: attachment.fileSize,
                mimeType: attachment.mimeType,
                totalChunks,
            }));

            const idBytes = new TextEncoder().encode(attachment.id.padEnd(ID_LENGTH, ' ').slice(0, ID_LENGTH));
            for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_SIZE) {
                const chunk = new Uint8Array(buffer.slice(offset, offset + CHUNK_SIZE));
                const message = new Uint8Array(ID_LENGTH + chunk.length);
                message.set(idBytes, 0);
                message.set(chunk, ID_LENGTH);
                await webrtcInstance.broadcast(message.buffer);
            }
            await webrtcInstance.broadcast(JSON.stringify({ type: 'file-complete', fileId: attachment.id }));
        }

        const totalFileSize = safeFiles.reduce((total, file) => total + file.size, 0);
        if (totalFileSize <= 3 * 1024 * 1024) {
            for (const attachment of attachments) {
                if (!attachment.fileData) continue;
                const dataUri = await blobUrlToDataUri(attachment.fileData);
                if (dataUri) {
                    URL.revokeObjectURL(attachment.fileData);
                    store.attachFileToItem(itemId, attachment.id, dataUri);
                }
            }
        }
        return true;
    };

    const deleteItem = async (itemId: string) => {
        const store = useBoardStore.getState();
        if (!isSafeId(itemId)) return;
        store.deleteItem(itemId);
        if (webrtcInstance && store.peers.length > 0) {
            await webrtcInstance.broadcast(JSON.stringify({ type: 'delete', itemId }));
        }
    };

    return { sharePost, deleteItem };
}
