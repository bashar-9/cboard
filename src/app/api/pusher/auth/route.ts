import { NextRequest, NextResponse } from 'next/server';
import { getPusherServer } from '@/lib/pusher';
import { verifyRoomAccess } from '@/lib/server-utils';

export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    let originHost: string | null = null;
    try {
        originHost = origin ? new URL(origin).host : null;
    } catch {
        originHost = null;
    }
    if (!originHost || !host || originHost !== host) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }

    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > 10_000) {
        return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
    }

    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return NextResponse.json({ error: 'Invalid authorization request.' }, { status: 400 });
    }
    const socketId = form.get('socket_id');
    const channelName = form.get('channel_name');
    const accessToken = form.get('access_token');
    if (typeof socketId !== 'string'
        || !/^\d+\.\d+$/.test(socketId)
        || typeof channelName !== 'string'
        || typeof accessToken !== 'string'
        || channelName.length > 128) {
        return NextResponse.json({ error: 'Invalid authorization request.' }, { status: 400 });
    }

    const access = verifyRoomAccess(accessToken);
    if (!access || access.roomName !== channelName) {
        return NextResponse.json({ error: 'Room access denied.' }, { status: 403 });
    }

    try {
        const auth = getPusherServer().authorizeChannel(socketId, channelName, {
            user_id: access.userId,
            user_info: { joinedAt: Date.now() },
        });
        return NextResponse.json(auth);
    } catch (error) {
        console.error('Pusher authorization failed:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Online sharing is unavailable.' }, { status: 503 });
    }
}
