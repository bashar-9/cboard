import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createNetworkToken, derivePrivateRoomName, getClientIp, getRoomName, readNetworkToken, signRoomAccess } from '@/lib/server-utils';

export const dynamic = 'force-dynamic';

function roomResponse(roomName: string, extra: Record<string, string> = {}) {
    const userId = crypto.randomUUID().slice(0, 16);
    return NextResponse.json({ roomName, userId, accessToken: signRoomAccess(roomName, userId), ...extra }, {
        headers: { 'Cache-Control': 'no-store' },
    });
}

export async function GET(request: Request) {
    try {
        const roomName = getRoomName(getClientIp(request));
        const userId = crypto.randomUUID().slice(0, 16);
        const response = NextResponse.json({
            roomName,
            userId,
            accessToken: signRoomAccess(roomName, userId),
            networkToken: createNetworkToken(roomName),
        });
        response.headers.set('Cache-Control', 'no-store');
        const origin = request.headers.get('origin');
        if (origin === 'https://cboard.basharramadan.com' || origin === 'https://cboard-red.vercel.app') {
            response.headers.set('Access-Control-Allow-Origin', origin);
            response.headers.set('Vary', 'Origin');
        }
        return response;
    } catch (error) {
        console.error('Room setup failed:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Online sharing is unavailable.' }, { status: 503 });
    }
}

export async function POST(request: Request) {
    try {
        const origin = request.headers.get('origin');
        const host = request.headers.get('host');
        let originHost: string | null = null;
        try { originHost = origin ? new URL(origin).host : null; } catch { originHost = null; }
        if (!originHost || !host || originHost !== host) {
            return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
        }
        if (Number(request.headers.get('content-length') || '0') > 2_000) {
            return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
        }
        const body: unknown = await request.json();
        if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
        const input = body as Record<string, unknown>;

        if (input.action === 'join-public-network' && typeof input.networkToken === 'string') {
            const network = readNetworkToken(input.networkToken);
            if (!network) return NextResponse.json({ error: 'Could not verify this network.' }, { status: 401 });
            return roomResponse(network.roomName);
        }

        if (input.action === 'create-private') {
            const code = typeof input.code === 'string' && /^[A-Za-z0-9_-]{12}$/.test(input.code)
                ? input.code
                : crypto.randomBytes(9).toString('base64url');
            const roomName = derivePrivateRoomName(code);
            if (!roomName) return NextResponse.json({ error: 'Could not create the Private room.' }, { status: 400 });
            return roomResponse(roomName, { code });
        }

        if (input.action === 'join-private' && typeof input.code === 'string') {
            const roomName = derivePrivateRoomName(input.code);
            if (!roomName) return NextResponse.json({ error: 'This private link is invalid.' }, { status: 400 });
            return roomResponse(roomName, { code: input.code });
        }

        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    } catch (error) {
        console.error('Private room setup failed:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Private room is unavailable.' }, { status: 503 });
    }
}
