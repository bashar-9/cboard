import { beforeEach, describe, expect, test } from 'vitest';
import { getRoomItems, useBoardStore, type SharedItem } from './useBoardStore';

function makeItem(overrides: Partial<SharedItem> = {}): SharedItem {
    return {
        id: 'item-1',
        roomId: 'public',
        type: 'text',
        content: 'Test content',
        senderId: 'host-1',
        timestamp: 1_000,
        expiresAt: 5_000,
        ...overrides,
    };
}

describe('useBoardStore', () => {
    beforeEach(() => {
        useBoardStore.setState({ items: [], peers: [], incomingFiles: {} });
    });

    test('adds a new item once', () => {
        const item = makeItem();
        useBoardStore.getState().addItem(item);
        useBoardStore.getState().addItem(item);

        expect(useBoardStore.getState().items).toEqual([item]);
    });

    test('keeps identical item IDs isolated between private rooms', () => {
        const roomAItem = makeItem({ roomId: 'private-room-a', content: 'Room A secret' });
        const roomBItem = makeItem({ roomId: 'private-room-b', content: 'Room B secret' });

        useBoardStore.getState().addItems([roomAItem, roomBItem]);

        expect(getRoomItems(useBoardStore.getState().items, 'private-room-a')).toEqual([roomAItem]);
        expect(getRoomItems(useBoardStore.getState().items, 'private-room-b')).toEqual([roomBItem]);
    });

    test('does not render items from a different private room', () => {
        const roomAItem = makeItem({ id: 'room-a-item', roomId: 'private-room-a', content: 'Room A secret' });
        const roomBItem = makeItem({ id: 'room-b-item', roomId: 'private-room-b', content: 'Room B secret' });
        useBoardStore.setState({ items: [roomAItem, roomBItem] });

        expect(getRoomItems(useBoardStore.getState().items, 'private-room-b')).toEqual([roomBItem]);
        expect(getRoomItems(useBoardStore.getState().items, 'private-room-b')).not.toContainEqual(roomAItem);
    });

    test('deleting from private room A leaves the matching item ID in private room B', () => {
        const roomAItem = makeItem({ roomId: 'private-room-a', content: 'Room A secret' });
        const roomBItem = makeItem({ roomId: 'private-room-b', content: 'Room B secret' });
        useBoardStore.setState({ items: [roomAItem, roomBItem] });

        useBoardStore.getState().deleteItem('private-room-a', 'item-1');

        expect(useBoardStore.getState().items).toEqual([roomBItem]);
    });

    test('attaches a matching file only inside its exact room', () => {
        const attachment = { id: 'file-1', fileName: 'secret.txt', fileSize: 1, mimeType: 'text/plain' };
        const roomAItem = makeItem({ roomId: 'private-room-a', attachments: [attachment] });
        const roomBItem = makeItem({ roomId: 'private-room-b', attachments: [attachment] });
        useBoardStore.setState({ items: [roomAItem, roomBItem] });

        useBoardStore.getState().attachFileToItem('private-room-a', 'item-1', 'file-1', 'blob:room-a');

        expect(useBoardStore.getState().items[0].attachments?.[0].fileData).toBe('blob:room-a');
        expect(useBoardStore.getState().items[1].attachments?.[0].fileData).toBeUndefined();
    });

    test('drops old saved items that have no exact room ID', () => {
        const legacy = makeItem({ id: 'legacy', roomId: undefined, expiresAt: Date.now() + 60_000 });
        const safe = makeItem({ id: 'safe', roomId: 'private-room-a', expiresAt: Date.now() + 60_000 });
        useBoardStore.setState({ items: [legacy, safe] });

        useBoardStore.getState().removeExpiredItems();

        expect(useBoardStore.getState().items).toEqual([safe]);
    });

    test('uses the public 15-minute expiry for older items without an expiry', () => {
        const item = makeItem({ expiresAt: 0 });
        useBoardStore.getState().addItem(item);

        expect(useBoardStore.getState().items[0].expiresAt).toBe(item.timestamp + 15 * 60 * 1000);
    });

    test('sorts newest items first', () => {
        useBoardStore.getState().addItem(makeItem({ id: 'old', timestamp: 1_000 }));
        useBoardStore.getState().addItem(makeItem({ id: 'new', timestamp: 2_000 }));

        expect(useBoardStore.getState().items.map((item) => item.id)).toEqual(['new', 'old']);
    });

    test('removes expired public items', () => {
        useBoardStore.setState({
            items: [
                makeItem({ id: 'expired', expiresAt: Date.now() - 1 }),
                makeItem({ id: 'active', expiresAt: Date.now() + 60_000 }),
            ],
        });

        useBoardStore.getState().removeExpiredItems();

        expect(useBoardStore.getState().items.map((item) => item.id)).toEqual(['active']);
    });
});
