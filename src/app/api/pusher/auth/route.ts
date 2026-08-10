import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getPusherServer } from '@/lib/pusher';
import { getClientIp, getRoomName, verifyRoomAccess, verifyUserId } from '@/lib/server-utils';

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
    if (typeof socketId !== 'string'
        || !/^\d+\.\d+$/.test(socketId)
        || typeof channelName !== 'string'
        || channelName.length > 128) {
        return NextResponse.json({ error: 'Invalid authorization request.' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('user_id_token')?.value;
    const userId = token ? verifyUserId(token) : null;
    if (!userId) {
        return NextResponse.json({ error: 'Start a board session first.' }, { status: 401 });
    }

    if (channelName.startsWith('presence-private-')) {
        const roomToken = cookieStore.get('room_access_token')?.value;
        const access = roomToken ? verifyRoomAccess(roomToken) : null;
        if (!access || access.roomName !== channelName || access.userId !== userId) {
            return NextResponse.json({ error: 'Room access denied.' }, { status: 403 });
        }
    } else if (channelName !== getRoomName(getClientIp(request))) {
        return NextResponse.json({ error: 'Room access denied.' }, { status: 403 });
    }

    try {
        const auth = getPusherServer().authorizeChannel(socketId, channelName, {
            user_id: userId,
            user_info: { joinedAt: Date.now() },
        });
        return NextResponse.json(auth);
    } catch (error) {
        console.error('Pusher authorization failed:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Online sharing is unavailable.' }, { status: 503 });
    }
}
