import { beforeEach, describe, expect, test } from 'vitest';
import { useBoardStore, type SharedItem } from './useBoardStore';

function makeItem(overrides: Partial<SharedItem> = {}): SharedItem {
    return {
        id: 'item-1',
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
