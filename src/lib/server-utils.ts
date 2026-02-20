import crypto from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Extracts the client's IP address from request headers.
 * In production (Vercel), it uses x-forwarded-for or x-real-ip.
 * In development, it returns a fixed string to keep all local devices in the same room.
 */
export function getClientIp(req: Request | NextRequest) {
    const xForwardedFor = req.headers.get('x-forwarded-for');
    const xRealIp = req.headers.get('x-real-ip');

    if (process.env.NODE_ENV === 'development') {
        return 'local-dev-network';
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

const SECRET = process.env.PUSHER_SECRET || 'fallback-secret-for-dev';

/**
 * Signs a user ID with a HMAC signature for secure session management.
 * Returns a token in the format "userId.signature"
 */
export function signUserId(userId: string) {
    const signature = crypto.createHmac('sha256', SECRET).update(userId).digest('hex');
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
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(userId).digest('hex');

    return signature === expectedSignature ? userId : null;
}
