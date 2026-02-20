import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: Request) {
    // Extract client IP address. Vercel automatically sets these headers.
    const xForwardedFor = req.headers.get('x-forwarded-for');
    const xRealIp = req.headers.get('x-real-ip');

    // Also checking remote address for non-proxied local requests
    // Next 14 handles remote address differently, so we check standard headers

    // Start with a fallback
    let ip = '127.0.0.1';

    // If we're testing locally, just force everyone into the same room
    // regardless of how they connect to the dev server (localhost vs wifi ip).
    if (process.env.NODE_ENV === 'development') {
        ip = 'local-dev-network';
    } else {
        // Production: use real headers
        if (xForwardedFor) {
            ip = xForwardedFor.split(',')[0].trim();
        } else if (xRealIp) {
            ip = xRealIp.trim();
        }
    }

    // Create a deterministic hash of the IP address so all devices 
    // on the same network join the same room automatically.
    const hash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 12);
    const roomName = `presence-room-${hash}`;

    return NextResponse.json({
        ip,
        roomName
    });
}
