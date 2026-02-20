import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SharedItemType = 'text' | 'file';

export interface SharedItem {
    id: string;
    type: SharedItemType;
    content: string; // Text content or file name
    fileData?: Blob | ArrayBuffer; // For files
    fileSize?: number;
    mimeType?: string;
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
    debugLogs: string[];

    // Actions
    setMyId: (id: string) => void;
    setConnectionState: (state: 'disconnected' | 'connecting' | 'connected') => void;
    setRoomCode: (code: string) => void;

    addPeer: (peerId: string) => void;
    removePeer: (peerId: string) => void;

    addItem: (item: SharedItem) => void;
    deleteItem: (itemId: string) => void;
    clearItems: () => void;
    removeExpiredItems: () => void;
    addDebugLog: (log: string) => void;
}

export const useBoardStore = create<BoardState>()(
    persist(
        (set) => ({
            myId: null,
            connectionState: 'disconnected',
            roomCode: null,
            peers: [],
            items: [],
            debugLogs: [],

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
                    item.expiresAt = item.timestamp + 60 * 60 * 1000;
                }
                return {
                    // Add to top of the list, avoid duplicates by ID just in case
                    items: state.items.some(i => i.id === item.id)
                        ? state.items
                        : [item, ...state.items].sort((a, b) => b.timestamp - a.timestamp)
                };
            }),

            deleteItem: (itemId) => set((state) => ({
                items: state.items.filter(item => item.id !== itemId)
            })),

            clearItems: () => set({ items: [] }),

            removeExpiredItems: () => set((state) => {
                const now = Date.now();
                return {
                    items: state.items.filter(item => item.expiresAt > now)
                };
            }),

            addDebugLog: (log) => set((state) => ({
                debugLogs: [`[${new Date().toISOString().split('T')[1].slice(0, -1)}] ${log}`, ...state.debugLogs].slice(0, 50)
            })),
        }),
        {
            name: 'share-board-storage',
            // Only keep the items, we want network state to reset on refresh
            partialize: (state) => ({ items: state.items } as Partial<BoardState>),
        }
    )
);
