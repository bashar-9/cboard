/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { useBoardStore, SharedItem } from '@/store/useBoardStore';
import { getPusherClient } from '@/lib/pusher';
import { WebRTCManager, SignalMessage } from '@/lib/webrtc';
import { Channel } from 'pusher-js';

// Fallback for non-secure contexts (HTTP on phones)
function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 12);
}

// Persistent device ID so "You" labels survive refreshes
function getDeviceId(): string {
    const KEY = 'share-board-device-id';
    let id = localStorage.getItem(KEY);
    if (!id) {
        id = generateId().substring(0, 8);
        localStorage.setItem(KEY, id);
    }
    return id;
}

export function useBoardNetwork() {
    const store = useBoardStore();
    const webrtcRef = useRef<WebRTCManager | null>(null);
    const channelRef = useRef<Channel | null>(null);
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
                const { roomName, ip } = await res.json();

                if (!isMounted) return;
                store.setRoomCode(roomName);
                store.addDebugLog(`Got IP: ${ip} -> Room: ${roomName.slice(0, 15)}...`);

                // 2. Connect to Pusher Presence Channel
                const myDeviceId = getDeviceId();
                const pusher = getPusherClient(myDeviceId);
                const channel = pusher.subscribe(roomName) as any;
                channelRef.current = channel;

                channel.bind('pusher:subscription_succeeded', (members: any) => {
                    if (!isMounted) return;
                    const myId = members.myID; // This will now match myDeviceId
                    store.setMyId(myId);
                    store.setConnectionState('connected');
                    store.addDebugLog(`Pusher Connected! My ID: ${myId}. Members count: ${members.count}`);

                    // Initialize WebRTC
                    const rtc = new WebRTCManager(myId);
                    webrtcRef.current = rtc;

                    // Wire WebRTC signals back to Pusher to route to peers
                    rtc.onSignal = (msg) => {
                        store.addDebugLog(`Sending ${msg.type} signal to ${msg.to}`);
                        channel.trigger('client-webrtc-signal', msg);
                    };

                    // Wire WebRTC connection states
                    rtc.onConnect = (peerId) => {
                        store.addDebugLog(`WebRTC Connected to ${peerId}!`);
                        store.addPeer(peerId);

                        // Sync existing board items to the new peer
                        const currentItems = useBoardStore.getState().items;
                        if (currentItems.length > 0) {
                            store.addDebugLog(`Syncing ${currentItems.length} items to ${peerId}`);
                            rtc.sendTo(peerId, JSON.stringify({
                                type: 'sync',
                                items: currentItems
                            }));
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
                    if (!webrtcRef.current) return;
                    const currentId = membersWaitIdFallback();
                    if (!currentId) return;

                    const isPolite = currentId > member.id;
                    store.addDebugLog(`Member joined: ${member.id}. Creating peer. Am I polite? ${isPolite}`);
                    webrtcRef.current.createPeer(member.id, isPolite);
                });

                // 4. Handle Member Leaving
                channel.bind('pusher:member_removed', (member: any) => {
                    store.addDebugLog(`Member left: ${member.id}`);
                    store.removePeer(member.id);
                    webrtcRef.current?.removePeer(member.id);
                });

                // 5. Handle incoming WebRTC Signals via Pusher
                channel.bind('client-webrtc-signal', (msg: SignalMessage) => {
                    if (!webrtcRef.current) return;
                    const currentId = membersWaitIdFallback();

                    if (msg.to !== currentId) {
                        // store.addDebugLog(`Ignored signal for ${msg.to}, I am ${currentId}`);
                        return;
                    }

                    store.addDebugLog(`Received ${msg.type} signal from ${msg.from}`);
                    if (msg.type === 'offer') {
                        webrtcRef.current.createPeer(msg.from, false);
                    }
                    webrtcRef.current.handleSignal(msg);
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

        return () => {
            isMounted = false;
            webrtcRef.current?.cleanup();
            if (channelRef.current) {
                channelRef.current.unbind_all();
                channelRef.current.unsubscribe();
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

                if (payload.type === 'text') {
                    useBoardStore.getState().addItem(payload.item);
                } else if (payload.type === 'file-meta') {
                    useBoardStore.getState().addItem(payload.item);
                } else if (payload.type === 'sync') {
                    // Merge synced items from the peer
                    const items = payload.items as SharedItem[];
                    useBoardStore.getState().addDebugLog(`Received sync: ${items.length} items from ${peerId}`);
                    items.forEach((item: SharedItem) => {
                        useBoardStore.getState().addItem(item);
                    });
                }
            } else if (data instanceof ArrayBuffer) {
                // Handle binary ArrayBuffer (file chunks)
            }
        } catch (err) {
            console.error("Failed parsing message", err);
        }
    };

    // Exposed Actions
    const shareText = (text: string) => {
        if (!webrtcRef.current || !store.myId) return;

        const item: SharedItem = {
            id: generateId(),
            type: 'text',
            content: text,
            senderId: store.myId,
            timestamp: Date.now(),
        };

        // Add locally securely
        store.addItem(item);

        // Broadcast WebRTC String
        webrtcRef.current.broadcast(JSON.stringify({
            type: 'text',
            item
        }));
    };

    return { error, shareText };
}
