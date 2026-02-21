import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type User } from '@supabase/supabase-js';

export type SharedItemType = 'text' | 'file' | 'post';

export interface SharedAttachment {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileData?: string;
}

export interface IncomingFile {
    id: string;
    itemId?: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    senderId?: string;
    receivedBytes: number;
    totalChunks: number;
    receivedChunks: number;
    chunks: ArrayBuffer[];
}

export interface SharedItem {
    id: string;
    type: SharedItemType;
    scope?: 'public' | 'private';
    content: string; // Text content or file desc
    attachments?: SharedAttachment[];
    fileData?: string; // legacy base64 / Object URL
    fileName?: string; // legacy
    fileSize?: number; // legacy
    mimeType?: string; // legacy
    senderId: string;
    timestamp: number;
    expiresAt: number;
}

interface BoardState {
    // Network State
    myId: string | null;
    connectionState: 'disconnected' | 'connecting' | 'connected';
    roomCode: string | null;
    peers: string[]; // List of connected peer IDs

    // Board Data
    items: SharedItem[];
    privateItems: SharedItem[];
    incomingFiles: Record<string, IncomingFile>;
    debugLogs: string[];

    // Auth & Private Mode
    isPrivateMode: boolean;
    user: User | null;

    // Actions
    setMyId: (id: string) => void;
    setConnectionState: (state: 'disconnected' | 'connecting' | 'connected') => void;
    setRoomCode: (code: string) => void;

    addPeer: (peerId: string) => void;
    removePeer: (peerId: string) => void;

    addItem: (item: SharedItem) => void;
    addItems: (items: SharedItem[]) => void;
    deleteItem: (itemId: string) => void;
    clearItems: () => void;

    addPrivateItem: (item: SharedItem) => void;
    setPrivateItems: (items: SharedItem[]) => void;
    deletePrivateItem: (itemId: string) => void;
    clearPrivateItems: () => void;

    removeExpiredItems: () => void;

    startIncomingFile: (file: IncomingFile) => void;
    updateIncomingFileProgress: (id: string, chunk: ArrayBuffer, totalChunks: number) => void;
    completeIncomingFile: (id: string) => void;
    attachFileToItem: (itemId: string, attachmentId: string, fileUrl: string) => void;

    addDebugLog: (log: string) => void;

    setIsPrivateMode: (isPrivate: boolean) => void;
    setUser: (user: User | null) => void;
}

export const useBoardStore = create<BoardState>()(
    persist(
        (set) => ({
            myId: null,
            connectionState: 'disconnected',
            roomCode: null,
            peers: [],
            items: [],
            privateItems: [],
            incomingFiles: {},
            debugLogs: [],
            isPrivateMode: false,
            user: null,

            setMyId: (id) => set({ myId: id }),
            setConnectionState: (state) => set({ connectionState: state }),
            setRoomCode: (code) => set({ roomCode: code }),

            addPeer: (peerId) => set((state) => ({
                peers: state.peers.includes(peerId) ? state.peers : [...state.peers, peerId]
            })),

            removePeer: (peerId) => set((state) => ({
                peers: state.peers.filter((p) => p !== peerId)
            })),

            addItem: (item) => set((state) => {
                // Compatibility for old items missing expiresAt
                if (!item.expiresAt) {
                    item.expiresAt = item.timestamp + 15 * 60 * 1000;
                }
                return {
                    // Add to top of the list, avoid duplicates by ID just in case
                    items: state.items.some(i => i.id === item.id)
                        ? state.items
                        : [item, ...state.items].sort((a, b) => b.timestamp - a.timestamp)
                };
            }),

            addItems: (newItems) => set((state) => {
                const existingIds = new Set(state.items.map(i => i.id));
                const uniqueNewItems = [];
                const seenNewIds = new Set();

                for (const item of newItems) {
                    if (!existingIds.has(item.id) && !seenNewIds.has(item.id)) {
                        // Compatibility for old items missing expiresAt
                        if (!item.expiresAt) {
                            item.expiresAt = item.timestamp + 15 * 60 * 1000;
                        }
                        uniqueNewItems.push(item);
                        seenNewIds.add(item.id);
                    }
                }

                if (uniqueNewItems.length === 0) return state;

                return {
                    items: [...uniqueNewItems, ...state.items].sort((a, b) => b.timestamp - a.timestamp)
                };
            }),

            deleteItem: (itemId) => set((state) => ({
                items: state.items.filter(item => item.id !== itemId)
            })),

            clearItems: () => set({ items: [] }),

            addPrivateItem: (item) => set((state) => ({
                privateItems: state.privateItems.some(i => i.id === item.id)
                    ? state.privateItems
                    : [item, ...state.privateItems].sort((a, b) => b.timestamp - a.timestamp)
            })),

            setPrivateItems: (items) => set({
                privateItems: items.sort((a, b) => b.timestamp - a.timestamp)
            }),

            deletePrivateItem: (itemId) => set((state) => ({
                privateItems: state.privateItems.filter(item => item.id !== itemId)
            })),

            clearPrivateItems: () => set({ privateItems: [] }),

            removeExpiredItems: () => set((state) => {
                const now = Date.now();
                return {
                    items: state.items.filter(item => item.expiresAt > now)
                };
            }),

            startIncomingFile: (file) => set((state) => ({
                incomingFiles: { ...state.incomingFiles, [file.id]: file }
            })),

            updateIncomingFileProgress: (id, chunk, totalChunks) => set((state) => {
                const file = state.incomingFiles[id];
                if (!file) return state;

                const newChunks = [...file.chunks, chunk];
                return {
                    incomingFiles: {
                        ...state.incomingFiles,
                        [id]: {
                            ...file,
                            receivedBytes: file.receivedBytes + chunk.byteLength,
                            receivedChunks: file.receivedChunks + 1,
                            totalChunks, // ensure accurate total
                            chunks: newChunks
                        }
                    }
                };
            }),

            completeIncomingFile: (id) => set((state) => {
                const newIncoming = { ...state.incomingFiles };
                delete newIncoming[id];
                return { incomingFiles: newIncoming };
            }),

            attachFileToItem: (itemId, attachmentId, fileUrl) => set((state) => ({
                items: state.items.map(item => {
                    if (item.id === itemId && item.attachments) {
                        return {
                            ...item,
                            attachments: item.attachments.map(att =>
                                att.id === attachmentId ? { ...att, fileData: fileUrl } : att
                            )
                        };
                    }
                    return item;
                })
            })),

            addDebugLog: (log) => set((state) => ({
                debugLogs: [`[${new Date().toISOString().split('T')[1].slice(0, -1)}] ${log}`, ...state.debugLogs].slice(0, 50)
            })),

            setIsPrivateMode: (isPrivate) => set({ isPrivateMode: isPrivate }),
            setUser: (user) => set({ user }),
        }),
        {
            name: 'share-board-storage',
            // Persist text and post items. Strip large file data to stay within localStorage limits.
            partialize: (state) => {
                const MAX_ATTACHMENT_DATA_SIZE = 4 * 1024 * 1024; // 4MB base64 budget per item
                const persistedItems = state.items
                    .filter(i => i.type === 'text' || i.type === 'post')
                    .map(item => {
                        if (item.type === 'post' && item.attachments) {
                            // Calculate total attachment data size
                            const totalSize = item.attachments.reduce(
                                (sum, att) => sum + (att.fileData?.length || 0), 0
                            );
                            if (totalSize > MAX_ATTACHMENT_DATA_SIZE) {
                                // Too large for localStorage — keep metadata, strip data
                                return {
                                    ...item,
                                    attachments: item.attachments.map(att => ({ ...att, fileData: undefined }))
                                };
                            }
                        }
                        return item;
                    });
                return { items: persistedItems } as Partial<BoardState>;
            },
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.removeExpiredItems();
                }
            },
        }
    )
);
