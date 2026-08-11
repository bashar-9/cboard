import crypto from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Extracts the client's IP address from request headers.
 * In production (Vercel), it uses x-forwarded-for or x-real-ip.
 * In development, it returns a fixed string to keep all local devices in the same room.
 */
export function getClientIp(req: Request | NextRequest) {
    const xVercelForwardedFor = req.headers.get('x-vercel-forwarded-for');
    const xForwardedFor = req.headers.get('x-forwarded-for');
    const xRealIp = req.headers.get('x-real-ip');

    if (process.env.NODE_ENV === 'development') {
        return 'local-dev-network';
    }

    if (xVercelForwardedFor) {
        return xVercelForwardedFor.split(',')[0].trim();
    }
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }
    if (xRealIp) {
        return xRealIp.trim();
    }
    return '127.0.0.1';
}

/**
 * Generates a deterministic room name based on the IP address.
 */
export function getRoomName(ip: string) {
    const hash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 12);
    return `presence-room-${hash}`;
}

function getSigningSecret() {
    return process.env.PUSHER_COOKIE_SECRET || process.env.PUSHER_SECRET || null;
}

const ACCESS_ROOM_PATTERN = /^presence-(?:private-[a-f0-9]{32}|room-[a-f0-9]{12})$/;

function hmac(value: string) {
    const secret = getSigningSecret();
    if (!secret) throw new Error('Pusher cookie signing secret is not configured.');
    return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function safeHexEqual(left: string, right: string) {
    return /^[a-f0-9]{64}$/.test(left)
        && /^[a-f0-9]{64}$/.test(right)
        && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

/**
 * Signs a user ID with a HMAC signature for secure session management.
 * Returns a token in the format "userId.signature"
 */
export function signUserId(userId: string) {
    const signature = hmac(userId);
    return `${userId}.${signature}`;
}

/**
 * Verifies a signed user ID token.
 * Returns the userId if valid, otherwise null.
 */
export function verifyUserId(token: string): string | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [userId, signature] = parts;
    const secret = getSigningSecret();
    if (!secret || !/^[a-f0-9]{64}$/.test(signature)) return null;
    const expectedSignature = crypto.createHmac('sha256', secret).update(userId).digest('hex');

    return safeHexEqual(signature, expectedSignature) ? userId : null;
}

export function signRoomAccess(roomName: string, userId: string) {
    if (!ACCESS_ROOM_PATTERN.test(roomName)) throw new Error('Invalid room.');
    const payload = Buffer.from(JSON.stringify({ roomName, userId, expiresAt: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url');
    return `${payload}.${hmac(payload)}`;
}

export function verifyRoomAccess(token: string) {
    const [payload, signature, ...extra] = token.split('.');
    if (!payload || !signature || extra.length || !safeHexEqual(signature, hmac(payload))) return null;
    try {
        const value: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!value || typeof value !== 'object') return null;
        const data = value as Record<string, unknown>;
        if (typeof data.roomName !== 'string'
            || !ACCESS_ROOM_PATTERN.test(data.roomName)
            || typeof data.userId !== 'string'
            || typeof data.expiresAt !== 'number'
            || data.expiresAt <= Date.now()) return null;
        return { roomName: data.roomName, userId: data.userId };
    } catch {
        return null;
    }
}

export function derivePrivateRoomName(code: string) {
    if (!/^[A-Za-z0-9_-]{12}$/.test(code)) return null;
    const secret = getSigningSecret();
    if (!secret) throw new Error('Pusher signing secret is not configured.');
    const hash = crypto.createHmac('sha256', secret).update(`private-room:${code}`).digest('hex').slice(0, 32);
    return `presence-private-${hash}`;
}

export function createNetworkToken(roomName: string, lifetimeMs = 10 * 60 * 1000) {
    if (!/^presence-room-[a-f0-9]{12}$/.test(roomName)) throw new Error('Invalid network room.');
    const secret = getSigningSecret();
    if (!secret) throw new Error('Pusher cookie signing secret is not configured.');
    const key = crypto.createHash('sha256').update(`${secret}:network-token`).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const payload = JSON.stringify({ roomName, expiresAt: Date.now() + lifetimeMs });
    const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function readNetworkToken(token: string) {
    if (!/^[A-Za-z0-9_-]{40,1000}$/.test(token)) return null;
    try {
        const secret = getSigningSecret();
        if (!secret) return null;
        const packed = Buffer.from(token, 'base64url');
        if (packed.length < 29) return null;
        const key = crypto.createHash('sha256').update(`${secret}:network-token`).digest();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12));
        decipher.setAuthTag(packed.subarray(12, 28));
        const decrypted = Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
        const value: unknown = JSON.parse(decrypted);
        if (!value || typeof value !== 'object') return null;
        const data = value as Record<string, unknown>;
        if (typeof data.roomName !== 'string'
            || !/^presence-room-[a-f0-9]{12}$/.test(data.roomName)
            || typeof data.expiresAt !== 'number'
            || data.expiresAt <= Date.now()) return null;
        return { roomName: data.roomName };
    } catch {
        return null;
    }
}
