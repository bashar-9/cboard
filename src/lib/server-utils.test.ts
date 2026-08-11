import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNetworkToken, derivePrivateRoomName, readNetworkToken, signRoomAccess, signUserId, verifyRoomAccess, verifyUserId } from './server-utils';

const previousSecret = process.env.PUSHER_COOKIE_SECRET;

beforeAll(() => {
    process.env.PUSHER_COOKIE_SECRET = 'test-only-cookie-secret-with-enough-entropy';
});

afterAll(() => {
    if (previousSecret === undefined) delete process.env.PUSHER_COOKIE_SECRET;
    else process.env.PUSHER_COOKIE_SECRET = previousSecret;
});

describe('signed online room access', () => {
    it('accepts a valid identity and rejects a changed token', () => {
        const token = signUserId('user-123');
        expect(verifyUserId(token)).toBe('user-123');
        expect(verifyUserId(`${token}changed`)).toBeNull();
    });

    it('turns a short private link code into a stable hidden room', () => {
        const code = 'Ab3dE6gH9jK_';
        const roomName = derivePrivateRoomName(code);
        expect(roomName).toMatch(/^presence-private-[a-f0-9]{32}$/);
        expect(derivePrivateRoomName(code)).toBe(roomName);
        expect(derivePrivateRoomName('too-short')).toBeNull();
    });

    it('binds private-room access to the room and user', () => {
        const roomName = `presence-private-${'b'.repeat(32)}`;
        expect(verifyRoomAccess(signRoomAccess(roomName, 'user-456'))).toEqual({ roomName, userId: 'user-456' });
    });

    it('signs a short-lived automatic Public network room', () => {
        const roomName = 'presence-room-123456789abc';
        const token = createNetworkToken(roomName, 60_000);
        expect(readNetworkToken(token)).toEqual({ roomName });
        expect(verifyRoomAccess(signRoomAccess(roomName, 'user-789'))).toEqual({ roomName, userId: 'user-789' });
    });
});
