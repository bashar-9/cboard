import { describe, expect, test } from 'vitest';
import { getNetworkMode, sanitizeIncomingItem } from './useBoardNetwork';

const validItem = {
    id: 'item-1',
    roomId: 'private:untrusted-room',
    type: 'post',
    content: 'Local message',
    senderId: 'host-1',
    timestamp: Date.now(),
    expiresAt: Date.now() + 60_000,
    attachments: [{
        id: 'file-1',
        fileName: 'image.png',
        fileSize: 1024,
        mimeType: 'image/png',
        fileData: 'javascript:alert(1)',
    }],
};

describe('incoming peer data security', () => {
    test('keeps valid metadata but strips peer-provided URLs', () => {
        const result = sanitizeIncomingItem(validItem, 'private', 'private-room-a');

        expect(result?.attachments?.[0]).toEqual({
            id: 'file-1',
            fileName: 'image.png',
            fileSize: 1024,
            mimeType: 'image/png',
        });
    });

    test('assigns incoming content to the active room type', () => {
        expect(sanitizeIncomingItem(validItem, 'private', 'private:room-a')?.scope).toBe('private');
        expect(sanitizeIncomingItem(validItem, 'public', 'public')?.scope).toBe('public');
    });

    test('stamps incoming sync items with the trusted active room ID', () => {
        const result = sanitizeIncomingItem(validItem, 'private', 'private:room-b');

        expect(result?.roomId).toBe('private:room-b');
        expect(result?.roomId).not.toBe(validItem.roomId);
    });

    test('limits peer-provided expiry to fifteen minutes', () => {
        const before = Date.now();
        const result = sanitizeIncomingItem({
            ...validItem,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }, 'private', 'private-room-a');

        expect(result?.expiresAt).toBeLessThanOrEqual(before + 15 * 60 * 1000 + 10);
    });

    test('rejects files larger than 50 MB', () => {
        const result = sanitizeIncomingItem({
            ...validItem,
            attachments: [{ ...validItem.attachments[0], fileSize: 50 * 1024 * 1024 + 1 }],
        }, 'private', 'private-room-a');

        expect(result).toBeNull();
    });

    test('rejects oversized text', () => {
        expect(sanitizeIncomingItem({ ...validItem, content: 'x'.repeat(10_001) }, 'private', 'private-room-a')).toBeNull();
    });
});

describe('network mode selection', () => {
    test.each(['localhost', '127.0.0.1', '192.168.1.5', '10.0.0.8', 'cboard.local'])(
        'uses the offline server for %s',
        (hostname) => expect(getNetworkMode(hostname)).toBe('local'),
    );

    test.each(['cboard.vercel.app', 'board.example.com'])(
        'uses Pusher signaling for %s',
        (hostname) => expect(getNetworkMode(hostname)).toBe('online'),
    );
});
