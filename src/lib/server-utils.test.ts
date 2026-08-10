import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrivateInvite, openPrivateInvite, readPrivateInvite, signRoomAccess, signUserId, verifyRoomAccess, verifyUserId } from './server-utils';

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

    it('requires the correct private-room PIN', () => {
        const roomName = `presence-private-${'a'.repeat(32)}`;
        const invite = createPrivateInvite(roomName, '483920');
        expect(readPrivateInvite(invite)).toEqual({ roomName, pin: '483920' });
        expect(openPrivateInvite(invite, '111111')).toBeNull();
        expect(openPrivateInvite(invite, '483920')).toBe(roomName);
    });

    it('binds private-room access to the room and user', () => {
        const roomName = `presence-private-${'b'.repeat(32)}`;
        expect(verifyRoomAccess(signRoomAccess(roomName, 'user-456'))).toEqual({ roomName, userId: 'user-456' });
    });
});
