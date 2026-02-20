/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useBoardStore, SharedItem } from '@/store/useBoardStore';
import { getPusherClient } from '@/lib/pusher';
import { WebRTCManager, SignalMessage } from '@/lib/webrtc';
import { Channel } from 'pusher-js';

function generateId(): string {
    let id = '';
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = crypto.randomUUID();
    } else {
        id = Date.now().toString(36) + Math.random().toString(36).substring(2, 12);
    }
    return id.padEnd(36, ' ').substring(0, 36);
}

// Module-level singletons to prevent strict-mode and multi-component re-initialization
let webrtcInstance: WebRTCManager | null = null;
let channelInstance: Channel | null = null;

export function useBoardNetworkInit() {
    const store = useBoardStore();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function initialize() {
            try {
                store.setConnectionState('connecting');
                store.addDebugLog('Initializing network...');

                // 1. Get room details based on IP
                const res = await fetch('/api/room');
                if (!res.ok) throw new Error('Failed to get room config');
                const { roomName, ip, userId } = await res.json();

                if (!isMounted) return;
                store.setRoomCode(roomName);
                store.addDebugLog(`Got IP: ${ip} -> Room: ${roomName.slice(0, 15)}...`);

                // 2. Connect to Pusher Presence Channel
                // Use the userId assigned by the server
                const pusher = getPusherClient(userId);
                const channel = pusher.subscribe(roomName) as any;
                channelInstance = channel;

                channel.bind('pusher:subscription_succeeded', (members: any) => {
                    if (!isMounted) return;
                    const myId = members.myID; // This will now match myDeviceId
                    store.setMyId(myId);
                    store.setConnectionState('connected');
                    store.addDebugLog(`Pusher Connected! My ID: ${myId}. Members count: ${members.count}`);

                    // Initialize WebRTC
                    const rtc = new WebRTCManager(myId);
                    webrtcInstance = rtc;

                    // Wire WebRTC signals back to Pusher to route to peers
                    rtc.onSignal = (msg) => {
                        store.addDebugLog(`Sending ${msg.type} signal to ${msg.to}`);
                        channel.trigger('client-webrtc-signal', msg);
                    };

                    // Wire WebRTC connection states
                    rtc.onConnect = async (peerId) => {
                        store.addDebugLog(`WebRTC Connected to ${peerId}!`);
                        store.addPeer(peerId);

                        // Sync existing board items to the new peer
                        const currentItems = useBoardStore.getState().items;
                        if (currentItems.length > 0) {
                            const textItems = currentItems.filter(i => i.type === 'text' || i.type === 'post');
                            if (textItems.length > 0) {
                                store.addDebugLog(`Syncing ${textItems.length} text items to ${peerId}`);
                                rtc.sendTo(peerId, JSON.stringify({
                                    type: 'sync',
                                    items: textItems.map(item => {
                                        if (item.type === 'post' && item.attachments) {
                                            return { ...item, attachments: item.attachments.map(a => ({ ...a, fileData: undefined })) };
                                        }
                                        return item;
                                    })
                                }));
                            }

                            // Sync legacy single files
                            const fileItems = currentItems.filter(i => i.type === 'file' && i.fileData);
                            for (const item of fileItems) {
                                try {
                                    if (!item.fileData) continue;
                                    const blob = await fetch(item.fileData).then(r => r.blob());
                                    const arrayBuffer = await blob.arrayBuffer();
                                    const totalChunks = Math.ceil(arrayBuffer.byteLength / 64000);

                                    store.addDebugLog(`Syncing file ${item.fileName} to ${peerId}`);
                                    rtc.sendTo(peerId, JSON.stringify({ type: 'file-start', item, totalChunks }));

                                    const idBytes = new TextEncoder().encode(item.id.padEnd(36, ' ').substring(0, 36));
                                    let offset = 0;
                                    while (offset < arrayBuffer.byteLength) {
                                        const chunk = arrayBuffer.slice(offset, offset + 64000);
                                        const chunkData = new Uint8Array(chunk);
                                        const message = new Uint8Array(36 + chunkData.length);
                                        message.set(idBytes, 0);
                                        message.set(chunkData, 36);

                                        rtc.sendTo(peerId, message.buffer);
                                        offset += 64000;
                                        await new Promise(r => setTimeout(r, 5)); // Throttle
                                    }
                                    rtc.sendTo(peerId, JSON.stringify({ type: 'file-complete', fileId: item.id }));
                                } catch (err) {
                                    console.error("Failed to sync file to peer", err);
                                }
                            }

                            // Sync post attachments
                            const postItemsWithAttachments = currentItems.filter(i => i.type === 'post' && i.attachments && i.attachments.length > 0);
                            for (const item of postItemsWithAttachments) {
                                for (const att of item.attachments!) {
                                    try {
                                        if (!att.fileData) continue;
                                        const blob = await fetch(att.fileData).then(r => r.blob());
                                        const arrayBuffer = await blob.arrayBuffer();
                                        const totalChunks = Math.ceil(arrayBuffer.byteLength / 64000);

                                        store.addDebugLog(`Syncing file ${att.fileName} to ${peerId}`);
                                        rtc.sendTo(peerId, JSON.stringify({
                                            type: 'file-start',
                                            fileId: att.id,
                                            itemId: item.id,
                                            fileName: att.fileName,
                                            fileSize: att.fileSize,
                                            mimeType: att.mimeType,
                                            totalChunks
                                        }));

                                        const idBytes = new TextEncoder().encode(att.id.padEnd(36, ' ').substring(0, 36));
                                        let offset = 0;
                                        while (offset < arrayBuffer.byteLength) {
                                            const chunk = arrayBuffer.slice(offset, offset + 64000);
                                            const chunkData = new Uint8Array(chunk);
                                            const message = new Uint8Array(36 + chunkData.length);
                                            message.set(idBytes, 0);
                                            message.set(chunkData, 36);

                                            rtc.sendTo(peerId, message.buffer);
                                            offset += 64000;
                                            await new Promise(r => setTimeout(r, 5)); // Throttle
                                        }
                                        rtc.sendTo(peerId, JSON.stringify({ type: 'file-complete', fileId: att.id, itemId: item.id }));
                                    } catch (err) {
                                        console.error("Failed to sync file to peer", err);
                                    }
                                }
                            }
                        }
                    };
                    rtc.onDisconnect = (peerId) => {
                        store.addDebugLog(`WebRTC Disconnected from ${peerId}`);
                        store.removePeer(peerId);
                    };

                    // Handle incoming WebRTC Data Channel messages
                    rtc.onData = (peerId, data) => handleIncomingData(peerId, data);

                    // Existing members: Initiate connection to them
                    members.each((member: any) => {
                        if (member.id !== myId) {
                            const isPolite = myId > member.id;
                            store.addDebugLog(`Existing member: ${member.id}. Creating peer. Am I polite? ${isPolite}`);
                            rtc.createPeer(member.id, isPolite);
                        }
                    });
                });

                // 3. Handle New Member Joining
                channel.bind('pusher:member_added', (member: any) => {
                    if (!webrtcInstance) return;
                    const currentId = membersWaitIdFallback();
                    if (!currentId) return;

                    const isPolite = currentId > member.id;
                    store.addDebugLog(`Member joined: ${member.id}. Creating peer. Am I polite? ${isPolite}`);
                    webrtcInstance.createPeer(member.id, isPolite);
                });

                // 4. Handle Member Leaving
                channel.bind('pusher:member_removed', (member: any) => {
                    store.addDebugLog(`Member left: ${member.id}`);
                    store.removePeer(member.id);
                    webrtcInstance?.removePeer(member.id);
                });

                // 5. Handle incoming WebRTC Signals via Pusher
                channel.bind('client-webrtc-signal', (msg: SignalMessage) => {
                    if (!webrtcInstance) return;
                    const currentId = membersWaitIdFallback();

                    if (msg.to !== currentId) {
                        return;
                    }

                    store.addDebugLog(`Received ${msg.type} signal from ${msg.from}`);
                    if (msg.type === 'offer') {
                        webrtcInstance.createPeer(msg.from, false);
                    }
                    webrtcInstance.handleSignal(msg);
                });

                // Helper to grab ID safely in bindings
                const membersWaitIdFallback = () => channel.members?.myID || useBoardStore.getState().myId;

            } catch (err: unknown) {
                console.error("Network initialization error", err);
                const msg = err instanceof Error ? err.message : 'Unknown Error';
                setError(msg);
                store.addDebugLog(`ERROR: ${msg}`);
                store.setConnectionState('disconnected');
            }
        }

        initialize();

        // Perform immediate cleanup of expired items on mount
        useBoardStore.getState().removeExpiredItems();

        // Setup expiration cleanup interval (every 1 minute)
        const cleanupInterval = setInterval(() => {
            useBoardStore.getState().removeExpiredItems();
        }, 60000);

        return () => {
            isMounted = false;
            clearInterval(cleanupInterval);
            webrtcInstance?.cleanup();
            if (channelInstance) {
                channelInstance.unbind_all();
                channelInstance.unsubscribe();
            }
            useBoardStore.getState().setConnectionState('disconnected');
            useBoardStore.getState().setMyId('');
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    // Message Handler
    const handleIncomingData = (peerId: string, data: unknown) => {
        try {
            if (typeof data === 'string') {
                const payload = JSON.parse(data);

                if (payload.type === 'text' || payload.type === 'post') {
                    useBoardStore.getState().addItem(payload.item);
                } else if (payload.type === 'sync') {
                    // Merge synced items from the peer
                    const items = payload.items as SharedItem[];
                    useBoardStore.getState().addDebugLog(`Received sync: ${items.length} items from ${peerId}`);
                    useBoardStore.getState().addItems(items);
                } else if (payload.type === 'delete') {
                    useBoardStore.getState().deleteItem(payload.itemId);
                } else if (payload.type === 'file-start') {
                    const { item, fileId, itemId, totalChunks } = payload;
                    useBoardStore.getState().startIncomingFile({
                        id: fileId || item?.id,
                        itemId: itemId || item?.id,
                        fileName: payload.fileName || item?.fileName,
                        fileSize: payload.fileSize || item?.fileSize,
                        mimeType: payload.mimeType || item?.mimeType,
                        senderId: item?.senderId,
                        receivedBytes: 0,
                        totalChunks,
                        receivedChunks: 0,
                        chunks: []
                    });
                } else if (payload.type === 'file-complete') {
                    const { fileId } = payload;
                    const storeState = useBoardStore.getState();
                    const incoming = storeState.incomingFiles[fileId];
                    if (incoming) {
                        try {
                            const fullBuffer = new Uint8Array(incoming.receivedBytes);
                            let offset = 0;
                            for (const chunk of incoming.chunks) {
                                fullBuffer.set(new Uint8Array(chunk), offset);
                                offset += chunk.byteLength;
                            }
                            const blob = new Blob([fullBuffer], { type: incoming.mimeType });
                            const fileUrl = URL.createObjectURL(blob);

                            // If this chunk belongs to a post attachment
                            if (incoming.itemId && incoming.itemId !== incoming.id) {
                                storeState.attachFileToItem(incoming.itemId, incoming.id, fileUrl);
                            } else {
                                // Legacy standalone file
                                storeState.addItem({
                                    id: incoming.id,
                                    type: 'file',
                                    content: `File: ${incoming.fileName}`,
                                    fileName: incoming.fileName,
                                    fileSize: incoming.fileSize,
                                    mimeType: incoming.mimeType,
                                    fileData: fileUrl,
                                    senderId: incoming.senderId || '',
                                    timestamp: Date.now(),
                                    expiresAt: Date.now() + 60 * 60 * 1000
                                });
                            }
                        } catch (err) {
                            console.error("Failed to reassemble file", err);
                        } finally {
                            storeState.completeIncomingFile(fileId);
                        }
                    }
                }
            } else if (data instanceof ArrayBuffer) {
                // Binary chunk
                const buffer = new Uint8Array(data);
                const idBytes = buffer.slice(0, 36);
                const fileId = new TextDecoder().decode(idBytes).trim();
                const chunkData = data.slice(36);

                const storeState = useBoardStore.getState();
                const incoming = storeState.incomingFiles[fileId];
                if (incoming) {
                    storeState.updateIncomingFileProgress(fileId, chunkData, incoming.totalChunks);
                }
            }
        } catch (err) {
            console.error("Failed parsing message", err);
        }
    };

    return { error };
}

export function useBoardNetwork() {
    const store = useBoardStore();

    const sharePost = async (text: string, files: File[]) => {
        if (!webrtcInstance || !store.myId) return;

        const itemId = generateId();
        const attachments = files.map(f => ({
            id: generateId(),
            fileName: f.name,
            fileSize: f.size,
            mimeType: f.type,
            fileData: URL.createObjectURL(f)
        }));

        const item: SharedItem = {
            id: itemId,
            type: attachments.length > 0 ? 'post' : 'text',
            content: text,
            attachments: attachments.length > 0 ? attachments : undefined,
            senderId: store.myId,
            timestamp: Date.now(),
            expiresAt: Date.now() + 60 * 60 * 1000
        };

        store.addItem(item);

        // Broadcast post structure
        webrtcInstance.broadcast(JSON.stringify({
            type: item.type,
            item: attachments.length > 0
                ? { ...item, attachments: attachments.map(a => ({ ...a, fileData: undefined })) }
                : item
        }));

        // Stream chunks
        const CHUNK_SIZE = 64000;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const attId = attachments[i].id;

            try {
                const arrayBuffer = await file.arrayBuffer();
                const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

                webrtcInstance.broadcast(JSON.stringify({
                    type: 'file-start',
                    fileId: attId,
                    itemId: itemId,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    totalChunks
                }));

                const idBytes = new TextEncoder().encode(attId.padEnd(36, ' ').substring(0, 36));
                let offset = 0;
                while (offset < arrayBuffer.byteLength) {
                    const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
                    const chunkData = new Uint8Array(chunk);
                    const message = new Uint8Array(36 + chunkData.length);
                    message.set(idBytes, 0);
                    message.set(chunkData, 36);

                    webrtcInstance.broadcast(message.buffer);
                    offset += CHUNK_SIZE;

                    await new Promise(r => setTimeout(r, 5)); // Throttle
                }

                webrtcInstance.broadcast(JSON.stringify({ type: 'file-complete', fileId: attId, itemId }));
            } catch (err) {
                console.error(`File sharing failed for ${file.name}`, err);
                store.addDebugLog(`File sharing failed: ${err}`);
            }
        }
    };

    const deleteItem = (itemId: string) => {
        if (!webrtcInstance || !store.myId) return;

        store.deleteItem(itemId);

        webrtcInstance.broadcast(JSON.stringify({
            type: 'delete',
            itemId
        }));
    };

    return { sharePost, deleteItem };
}
