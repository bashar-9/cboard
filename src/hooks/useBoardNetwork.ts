import { useEffect } from 'react';
import { toast } from 'sonner';
import { useBoardStore, type LocalRoomPrivacy, type RoomSessionState, type SharedAttachment, type SharedItem } from '@/store/useBoardStore';
import { WebRTCManager, type SignalMessage } from '@/lib/webrtc';
import { createPusherClient } from '@/lib/pusher';
import type PusherClient from 'pusher-js';
import type { Channel } from 'pusher-js';

const MAX_TEXT_LENGTH = 10_000;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_ITEMS_PER_SYNC = 100;
const CHUNK_SIZE = 64_000;
const ID_LENGTH = 36;
const ONLINE_PRIVATE_CODE_KEY = 'cboard-online-private-code';
const ONLINE_PRIVATE_ROLE_KEY = 'cboard-online-private-role';
const LOCAL_BROWSER_SESSION_KEY = 'cboard-local-browser-session';
const LOCAL_PRIVATE_CODE_KEY = 'cboard-local-private-code';

interface PresenceMember { id: string }
interface PresenceMembers {
    myID: string;
    count: number;
    each: (callback: (member: PresenceMember) => void) => void;
}
interface PresenceChannel extends Channel { members?: PresenceMembers }
interface RoomRuntime {
    scope: LocalRoomPrivacy;
    roomId: string;
    myId: string;
    rtc: WebRTCManager;
    peers: Set<string>;
    pusher?: PusherClient;
    channel?: PresenceChannel;
    roomName?: string;
    socket?: WebSocket;
}

const runtimes: Partial<Record<LocalRoomPrivacy, RoomRuntime>> = {};
let initActive = false;

export function getNetworkMode(hostname: string): 'local' | 'online' {
    const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const privateIpv4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
        || normalized.endsWith('.local') || privateIpv4.test(normalized) ? 'local' : 'online';
}

function generateId(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(18)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(value);
}

function isSafeRoomId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(value);
}

function isSafeAttachment(value: unknown): value is SharedAttachment {
    if (!isRecord(value)) return false;
    return isSafeId(value.id) && typeof value.fileName === 'string' && value.fileName.length > 0
        && value.fileName.length <= 255 && typeof value.fileSize === 'number' && Number.isFinite(value.fileSize)
        && value.fileSize >= 0 && value.fileSize <= MAX_FILE_SIZE && typeof value.mimeType === 'string'
        && value.mimeType.length <= 100;
}

function isSafeItem(value: unknown): value is SharedItem {
    if (!isRecord(value)) return false;
    return isSafeId(value.id) && ['text', 'file', 'post'].includes(String(value.type))
        && typeof value.content === 'string' && value.content.length <= MAX_TEXT_LENGTH
        && typeof value.senderId === 'string' && value.senderId.length <= 64
        && typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)
        && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt)
        && (value.attachments === undefined || (Array.isArray(value.attachments)
            && value.attachments.length <= MAX_FILES && value.attachments.every(isSafeAttachment)));
}

export function sanitizeIncomingItem(value: unknown, scope: LocalRoomPrivacy, roomId: string): SharedItem | null {
    if (!isSafeItem(value)) return null;
    const now = Date.now();
    return {
        id: value.id,
        type: value.type,
        scope,
        roomId,
        content: value.content,
        attachments: value.attachments?.map(({ id, fileName, fileSize, mimeType }) => ({ id, fileName, fileSize, mimeType })),
        senderId: value.senderId,
        timestamp: Math.min(value.timestamp, now),
        expiresAt: Math.min(value.expiresAt, now + 15 * 60 * 1000),
    };
}

async function blobUrlToDataUri(blobUrl: string): Promise<string | null> {
    try {
        const blob = await (await fetch(blobUrl)).blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch { return null; }
}

function getPrivateCodeFromPath() {
    const match = window.location.pathname.match(/^\/r\/([A-Za-z0-9_-]{12})\/?$/);
    return match?.[1] || null;
}

function privateShareUrl(code: string) {
    return `${window.location.origin}/r/${code}`;
}

function updateRoom(scope: LocalRoomPrivacy, session: Partial<RoomSessionState>) {
    useBoardStore.getState().setRoomSession(scope, session);
}

function stopRuntime(scope: LocalRoomPrivacy) {
    const runtime = runtimes[scope];
    if (!runtime) return;
    runtime.channel?.unbind_all();
    if (runtime.pusher && runtime.roomName) runtime.pusher.unsubscribe(runtime.roomName);
    runtime.pusher?.disconnect();
    runtime.socket?.close();
    runtime.rtc.cleanup();
    delete runtimes[scope];
}

async function sendStoredFilesToPeer(runtime: RoomRuntime, peerId: string, items: SharedItem[]) {
    for (const item of items) {
        for (const attachment of item.attachments || []) {
            if (!attachment.fileData) continue;
            try {
                const response = await fetch(attachment.fileData);
                if (!response.ok) continue;
                const buffer = await response.arrayBuffer();
                if (buffer.byteLength > MAX_FILE_SIZE) continue;
                const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
                await runtime.rtc.sendTo(peerId, JSON.stringify({
                    type: 'file-start', fileId: attachment.id, itemId: item.id,
                    fileName: attachment.fileName, fileSize: attachment.fileSize,
                    mimeType: attachment.mimeType, totalChunks,
                }));
                const idBytes = new TextEncoder().encode(attachment.id.padEnd(ID_LENGTH, ' ').slice(0, ID_LENGTH));
                for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_SIZE) {
                    const chunk = new Uint8Array(buffer.slice(offset, offset + CHUNK_SIZE));
                    const message = new Uint8Array(ID_LENGTH + chunk.length);
                    message.set(idBytes, 0);
                    message.set(chunk, ID_LENGTH);
                    await runtime.rtc.sendTo(peerId, message.buffer);
                }
                await runtime.rtc.sendTo(peerId, JSON.stringify({ type: 'file-complete', fileId: attachment.id }));
            } catch { useBoardStore.getState().addDebugLog(`Could not restore ${attachment.fileName}.`); }
        }
    }
}

function handleIncomingData(scope: LocalRoomPrivacy, roomId: string, data: unknown) {
    const store = useBoardStore.getState();
    try {
        if (typeof data === 'string') {
            if (data.length > 1_000_000) return;
            const payload: unknown = JSON.parse(data);
            if (!isRecord(payload) || typeof payload.type !== 'string') return;
            if (payload.type === 'text' || payload.type === 'post') {
                const item = sanitizeIncomingItem(payload.item, scope, roomId);
                if (item) store.addItem(item);
                return;
            }
            if (payload.type === 'sync' && Array.isArray(payload.items)) {
                const items = payload.items.slice(0, MAX_ITEMS_PER_SYNC)
                    .map((item) => sanitizeIncomingItem(item, scope, roomId))
                    .filter((item): item is SharedItem => item !== null);
                store.addItems(items);
                return;
            }
            if (payload.type === 'delete' && isSafeId(payload.itemId)) {
                const target = store.items.find((item) => item.id === payload.itemId && item.roomId === roomId);
                if (target?.roomId === roomId) store.deleteItem(roomId, payload.itemId);
                return;
            }
            if (payload.type === 'file-start') {
                const { fileId, itemId, fileName, fileSize, mimeType, totalChunks } = payload;
                if (!isSafeId(fileId) || !isSafeId(itemId) || typeof fileName !== 'string' || !fileName.length
                    || fileName.length > 255 || typeof fileSize !== 'number' || fileSize < 0 || fileSize > MAX_FILE_SIZE
                    || typeof mimeType !== 'string' || mimeType.length > 100 || typeof totalChunks !== 'number'
                    || !Number.isInteger(totalChunks) || totalChunks < 0
                    || totalChunks > Math.ceil(MAX_FILE_SIZE / CHUNK_SIZE)) return;
                const targetItem = store.items.find((item) => item.id === itemId && item.roomId === roomId);
                if (!targetItem) return;
                store.startIncomingFile({ id: fileId, itemId, roomId, fileName, fileSize, mimeType, receivedBytes: 0,
                    totalChunks, receivedChunks: 0, chunks: [] });
                return;
            }
            if (payload.type === 'file-complete' && isSafeId(payload.fileId)) {
                const incoming = store.incomingFiles[`${roomId}:${payload.fileId}`];
                if (!incoming || incoming.roomId !== roomId) return;
                if (incoming.receivedBytes !== incoming.fileSize || incoming.receivedChunks !== incoming.totalChunks) {
                    store.completeIncomingFile(payload.fileId, roomId);
                    return;
                }
                const fullBuffer = new Uint8Array(incoming.receivedBytes);
                let offset = 0;
                for (const chunk of incoming.chunks) {
                    fullBuffer.set(new Uint8Array(chunk), offset);
                    offset += chunk.byteLength;
                }
                store.attachFileToItem(roomId, incoming.itemId || incoming.id, incoming.id,
                    URL.createObjectURL(new Blob([fullBuffer], { type: incoming.mimeType })));
                store.completeIncomingFile(payload.fileId, roomId);
            }
            return;
        }
        if (data instanceof ArrayBuffer) {
            if (data.byteLength <= ID_LENGTH || data.byteLength > ID_LENGTH + CHUNK_SIZE) return;
            const fileId = new TextDecoder().decode(new Uint8Array(data.slice(0, ID_LENGTH))).trim();
            const incoming = store.incomingFiles[`${roomId}:${fileId}`];
            const chunk = data.slice(ID_LENGTH);
            if (!incoming || incoming.receivedChunks >= incoming.totalChunks
                || incoming.receivedBytes + chunk.byteLength > incoming.fileSize) return;
            store.updateIncomingFileProgress(fileId, roomId, chunk, incoming.totalChunks);
        }
    } catch { store.addDebugLog('Rejected an invalid incoming message.'); }
}

function createRuntime(scope: LocalRoomPrivacy, roomId: string, myId: string, online: boolean, sendSignal: (signal: SignalMessage) => void) {
    stopRuntime(scope);
    const rtc = new WebRTCManager(myId, online);
    const runtime: RoomRuntime = { scope, roomId, myId, rtc, peers: new Set() };
    runtimes[scope] = runtime;
    rtc.onSignal = sendSignal;
    rtc.onConnect = (peerId) => {
        runtime.peers.add(peerId);
        useBoardStore.getState().addRoomPeer(scope, peerId);
        updateRoom(scope, { connectionState: 'connected', pairingState: 'paired', error: null });
    };
    rtc.onDisconnect = (peerId) => {
        runtime.peers.delete(peerId);
        useBoardStore.getState().removeRoomPeer(scope, peerId);
        if (!runtime.peers.size) updateRoom(scope, { connectionState: 'connecting', pairingState: 'joining' });
    };
    rtc.onChannelOpen = async (peerId) => {
        const items = useBoardStore.getState().items
            .filter((item) => item.roomId === roomId).slice(0, MAX_ITEMS_PER_SYNC);
        if (!items.length) return;
        await rtc.sendTo(peerId, JSON.stringify({ type: 'sync', items: items.map((item) => ({
            ...item, fileData: undefined,
            attachments: item.attachments?.map((attachment) => ({ ...attachment, fileData: undefined })),
        })) }));
        await sendStoredFilesToPeer(runtime, peerId, items);
    };
    rtc.onData = (_peerId, data) => handleIncomingData(scope, roomId, data);
    return runtime;
}

function connectPeer(runtime: RoomRuntime, peerId: string, polite: boolean) {
    if (peerId !== runtime.myId) runtime.rtc.createPeer(peerId, polite);
}

async function fetchPublicSession() {
    let session: unknown = null;
    if (window.location.hostname === 'cboard.basharramadan.com') {
        try {
            const discoveryResponse = await fetch('https://cboard-red.vercel.app/api/room', { cache: 'no-store', credentials: 'omit' });
            const discovery: unknown = await discoveryResponse.json();
            if (!discoveryResponse.ok || !isRecord(discovery) || typeof discovery.networkToken !== 'string') throw new Error();
            const response = await fetch('/api/room', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'join-public-network', networkToken: discovery.networkToken }),
            });
            session = await response.json();
            if (!response.ok) throw new Error();
        } catch { useBoardStore.getState().addDebugLog('Using the direct network address.'); }
    }
    if (!session) {
        const response = await fetch('/api/room', { cache: 'no-store' });
        if (!response.ok) throw new Error('Could not open the Public room.');
        session = await response.json();
    }
    return session;
}

function connectOnlineSession(scope: LocalRoomPrivacy, session: unknown, role: 'host' | 'receiver' | null, shareUrl: string | null) {
    if (!initActive || !isRecord(session) || !isSafeId(session.userId) || !isSafeRoomId(session.roomName)
        || typeof session.accessToken !== 'string') throw new Error('The room response was invalid.');
    const runtime = createRuntime(scope, session.roomName, session.userId, true, (signal) => channel.trigger('client-webrtc-signal', signal));
    runtime.roomName = session.roomName;
    runtime.pusher = createPusherClient(session.accessToken);
    const channel = runtime.pusher.subscribe(session.roomName) as PresenceChannel;
    runtime.channel = channel;
    updateRoom(scope, { roomId: session.roomName, myId: session.userId, role, shareUrl, connectionState: 'connecting', pairingState: 'joining', error: null });

    channel.bind('pusher:subscription_succeeded', (members: PresenceMembers) => {
        if (!initActive || !isSafeId(members.myID)) return;
        runtime.myId = members.myID;
        updateRoom(scope, { myId: members.myID, pairingState: 'joining', error: null });
        members.each((member) => {
            if (isSafeId(member.id) && member.id !== members.myID) connectPeer(runtime, member.id, members.myID > member.id);
        });
    });
    channel.bind('pusher:member_added', (member: PresenceMember) => {
        const myId = channel.members?.myID || runtime.myId;
        if (isSafeId(member.id) && member.id !== myId) connectPeer(runtime, member.id, myId > member.id);
    });
    channel.bind('pusher:member_removed', (member: PresenceMember) => {
        if (!isSafeId(member.id)) return;
        runtime.rtc.removePeer(member.id);
        runtime.peers.delete(member.id);
        useBoardStore.getState().removeRoomPeer(scope, member.id);
        if (!runtime.peers.size) updateRoom(scope, { connectionState: 'connecting', pairingState: 'joining' });
    });
    channel.bind('client-webrtc-signal', (incoming: unknown) => {
        if (!isRecord(incoming) || !isSafeId(incoming.to) || !isSafeId(incoming.from)
            || !['offer', 'answer', 'candidate'].includes(String(incoming.type))) return;
        const myId = channel.members?.myID || runtime.myId;
        if (incoming.to !== myId) return;
        if (incoming.type === 'offer') connectPeer(runtime, incoming.from, myId > incoming.from);
        runtime.rtc.handleSignal({ to: myId, from: incoming.from,
            type: incoming.type as SignalMessage['type'], data: incoming.data });
    });
    channel.bind('pusher:subscription_error', () => {
        updateRoom(scope, { connectionState: 'disconnected', pairingState: 'error', error: `Could not join the ${scope} room.` });
    });
}

async function joinOnlinePrivate(code: string, role: 'host' | 'receiver') {
    const response = await fetch('/api/room', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: role === 'host' ? 'create-private' : 'join-private', code }),
    });
    const session: unknown = await response.json();
    if (!response.ok) throw new Error(isRecord(session) && typeof session.error === 'string' ? session.error : 'Could not open the Private room.');
    if (!isRecord(session) || typeof session.code !== 'string') throw new Error('The private link was invalid.');
    connectOnlineSession('private', session, role, privateShareUrl(session.code));
    return session.code;
}

function startOnlineConnections() {
    updateRoom('public', { connectionState: 'connecting', pairingState: 'joining', error: null });
    void fetchPublicSession().then((session) => connectOnlineSession('public', session, null, null)).catch((error) => {
        updateRoom('public', { connectionState: 'disconnected', pairingState: 'error', error: error instanceof Error ? error.message : 'Public room unavailable.' });
    });
    const pathCode = getPrivateCodeFromPath();
    const savedCode = localStorage.getItem(ONLINE_PRIVATE_CODE_KEY);
    const savedRole = localStorage.getItem(ONLINE_PRIVATE_ROLE_KEY);
    const code = pathCode || savedCode;
    if (code && /^[A-Za-z0-9_-]{12}$/.test(code)) {
        const role = savedCode === code && (savedRole === 'host' || savedRole === 'receiver') ? savedRole : 'receiver';
        localStorage.setItem(ONLINE_PRIVATE_CODE_KEY, code);
        localStorage.setItem(ONLINE_PRIVATE_ROLE_KEY, role);
        if (pathCode) useBoardStore.getState().setActiveRoom('private');
        updateRoom('private', { role, shareUrl: privateShareUrl(code), connectionState: 'connecting', pairingState: 'joining', error: null });
        void joinOnlinePrivate(code, role).catch((error) => {
            updateRoom('private', { connectionState: 'disconnected', pairingState: 'error', error: error instanceof Error ? error.message : 'Private room unavailable.' });
        });
    }
}

function startLocalScope(scope: LocalRoomPrivacy, browserSessionId: string, code: string | null) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const query = new URLSearchParams({ session: browserSessionId, room: scope });
    if (code) query.set('code', code);
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?${query}`);
    let runtime: RoomRuntime | null = null;
    socket.onmessage = (event) => {
        if (!initActive || typeof event.data !== 'string' || event.data.length > 100_000) return;
        let message: unknown;
        try { message = JSON.parse(event.data); } catch { return; }
        if (!isRecord(message) || typeof message.type !== 'string') return;
        if (message.type === 'session' && isSafeId(message.clientId) && isSafeRoomId(message.roomId) && (message.role === 'host' || message.role === 'receiver')) {
            runtime = createRuntime(scope, message.roomId, message.clientId, false, (signal) => {
                if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({
                    type: 'signal', to: signal.to, signal: { type: signal.type, data: signal.data },
                }));
            });
            runtime.socket = socket;
            const shareUrl = typeof message.shareUrl === 'string' ? message.shareUrl : code ? privateShareUrl(code) : null;
            updateRoom(scope, { roomId: message.roomId, myId: message.clientId, role: message.role, shareUrl,
                connectionState: 'connecting', pairingState: 'joining', error: null });
            return;
        }
        if (message.type === 'peer-ready' && runtime && isSafeId(message.peerId) && typeof message.polite === 'boolean') {
            connectPeer(runtime, message.peerId, message.polite);
            return;
        }
        if (message.type === 'signal' && runtime && isSafeId(message.from) && isRecord(message.signal)
            && ['offer', 'answer', 'candidate'].includes(String(message.signal.type))) {
            runtime.rtc.handleSignal({ to: runtime.myId, from: message.from,
                type: message.signal.type as SignalMessage['type'], data: message.signal.data });
            return;
        }
        if (message.type === 'peer-left' && runtime && isSafeId(message.peerId)) {
            runtime.rtc.removePeer(message.peerId);
            runtime.peers.delete(message.peerId);
            useBoardStore.getState().removeRoomPeer(scope, message.peerId);
            updateRoom(scope, { connectionState: 'connecting', pairingState: 'joining' });
            return;
        }
        if (message.type === 'error') {
            updateRoom(scope, { connectionState: 'disconnected', pairingState: 'error',
                error: typeof message.message === 'string' ? message.message : `${scope} room unavailable.` });
        }
    };
    socket.onerror = () => updateRoom(scope, { connectionState: 'disconnected', pairingState: 'error', error: 'Cannot reach the local CBoard host.' });
    socket.onclose = () => {
        if (initActive && runtimes[scope]?.socket === socket) updateRoom(scope, { connectionState: 'disconnected', pairingState: 'error', error: 'Local host disconnected.' });
    };
}

function startLocalConnections() {
    let sessionId = localStorage.getItem(LOCAL_BROWSER_SESSION_KEY);
    if (!sessionId || !/^[a-f0-9-]{32,36}$/.test(sessionId)) {
        sessionId = generateId();
        localStorage.setItem(LOCAL_BROWSER_SESSION_KEY, sessionId);
    }
    const pathCode = getPrivateCodeFromPath();
    if (pathCode) localStorage.setItem(LOCAL_PRIVATE_CODE_KEY, pathCode);
    const code = pathCode || localStorage.getItem(LOCAL_PRIVATE_CODE_KEY);
    if (code) useBoardStore.getState().setActiveRoom('private');
    startLocalScope('public', sessionId, null);
    startLocalScope('private', sessionId, code);
}

export function setLocalRoomPrivacy(scope: LocalRoomPrivacy) {
    const store = useBoardStore.getState();
    store.setActiveRoom(scope);
    const privateUrl = store.roomSessions.private.shareUrl;
    const nextPath = scope === 'private' && privateUrl ? new URL(privateUrl).pathname : '/';
    window.history.replaceState({}, '', nextPath);
}

export async function createPrivateRoom() {
    const store = useBoardStore.getState();
    store.setActiveRoom('private');
    updateRoom('private', { connectionState: 'connecting', pairingState: 'connecting', role: 'host', error: null });
    if (store.networkMode === 'local') {
        const existing = store.roomSessions.private;
        if (existing.shareUrl) window.history.replaceState({}, '', new URL(existing.shareUrl).pathname);
        return;
    }
    try {
        const code = await joinOnlinePrivate('', 'host');
        localStorage.setItem(ONLINE_PRIVATE_CODE_KEY, code);
        localStorage.setItem(ONLINE_PRIVATE_ROLE_KEY, 'host');
        window.history.replaceState({}, '', `/r/${code}`);
    } catch (error) {
        updateRoom('private', { connectionState: 'disconnected', pairingState: 'error', error: error instanceof Error ? error.message : 'Could not create the Private room.' });
    }
}

export function leavePrivateRoom() {
    stopRuntime('private');
    localStorage.removeItem(ONLINE_PRIVATE_CODE_KEY);
    localStorage.removeItem(ONLINE_PRIVATE_ROLE_KEY);
    updateRoom('private', { roomId: null, myId: null, peers: [], role: null, shareUrl: null,
        connectionState: 'disconnected', pairingState: 'connecting', error: null });
    useBoardStore.getState().setActiveRoom('public');
    window.history.replaceState({}, '', '/');
}

export function useBoardNetworkInit() {
    useEffect(() => {
        initActive = true;
        const store = useBoardStore.getState();
        store.removeExpiredItems();
        const mode = getNetworkMode(window.location.hostname);
        store.setLocalSession({ networkMode: mode });
        if (mode === 'local') startLocalConnections(); else startOnlineConnections();
        const cleanupInterval = window.setInterval(() => store.removeExpiredItems(), 60_000);
        return () => {
            initActive = false;
            window.clearInterval(cleanupInterval);
            stopRuntime('public');
            stopRuntime('private');
        };
    }, []);
}

export function useBoardNetwork() {
    const sharePost = async (text: string, files: File[]) => {
        const store = useBoardStore.getState();
        const scope = store.localRoomPrivacy;
        const runtime = runtimes[scope];
        const cleanText = text.trim().slice(0, MAX_TEXT_LENGTH);
        const safeFiles = files.slice(0, MAX_FILES).filter((file) => file.size <= MAX_FILE_SIZE);
        if (!runtime || !runtime.peers.size) {
            toast.error(`Connect another device to the ${scope === 'public' ? 'Public' : 'Private'} room first.`);
            return false;
        }
        if (!cleanText && !safeFiles.length) return false;
        if (files.length > MAX_FILES || safeFiles.length !== files.length) {
            toast.error('Use up to 10 files, with a maximum of 50 MB per file.');
            return false;
        }
        const itemId = generateId();
        const attachments = safeFiles.map((file) => ({ id: generateId(), fileName: file.name.slice(0, 255),
            fileSize: file.size, mimeType: file.type.slice(0, 100), fileData: URL.createObjectURL(file) }));
        const item: SharedItem = { id: itemId, type: attachments.length ? 'post' : 'text', content: cleanText,
            scope, roomId: runtime.roomId, attachments: attachments.length ? attachments : undefined, senderId: runtime.myId,
            timestamp: Date.now(), expiresAt: Date.now() + 15 * 60 * 1000 };
        store.addItem(item);
        await runtime.rtc.broadcast(JSON.stringify({ type: item.type, item: { ...item,
            attachments: item.attachments?.map((attachment) => ({ ...attachment, fileData: undefined })) } }));
        for (let index = 0; index < safeFiles.length; index += 1) {
            const file = safeFiles[index];
            const attachment = attachments[index];
            const buffer = await file.arrayBuffer();
            const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
            await runtime.rtc.broadcast(JSON.stringify({ type: 'file-start', fileId: attachment.id, itemId,
                fileName: attachment.fileName, fileSize: attachment.fileSize, mimeType: attachment.mimeType, totalChunks }));
            const idBytes = new TextEncoder().encode(attachment.id.padEnd(ID_LENGTH, ' ').slice(0, ID_LENGTH));
            for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_SIZE) {
                const chunk = new Uint8Array(buffer.slice(offset, offset + CHUNK_SIZE));
                const message = new Uint8Array(ID_LENGTH + chunk.length);
                message.set(idBytes, 0);
                message.set(chunk, ID_LENGTH);
                await runtime.rtc.broadcast(message.buffer);
            }
            await runtime.rtc.broadcast(JSON.stringify({ type: 'file-complete', fileId: attachment.id }));
        }
        if (safeFiles.reduce((total, file) => total + file.size, 0) <= 3 * 1024 * 1024) {
            for (const attachment of attachments) {
                if (!attachment.fileData) continue;
                const dataUri = await blobUrlToDataUri(attachment.fileData);
                if (dataUri) {
                    URL.revokeObjectURL(attachment.fileData);
                    store.attachFileToItem(runtime.roomId, itemId, attachment.id, dataUri);
                }
            }
        }
        return true;
    };

    const deleteItem = async (itemId: string) => {
        const store = useBoardStore.getState();
        if (!isSafeId(itemId)) return;
        const activeRoomId = store.roomSessions[store.localRoomPrivacy].roomId;
        const target = store.items.find((item) => item.id === itemId && item.roomId === activeRoomId);
        if (!target?.roomId) return;
        store.deleteItem(target.roomId, itemId);
        const runtime = runtimes[target.scope || 'public'];
        if (runtime?.roomId === target.roomId && runtime.peers.size) {
            await runtime.rtc.broadcast(JSON.stringify({ type: 'delete', itemId }));
        }
    };
    return { sharePost, deleteItem };
}
