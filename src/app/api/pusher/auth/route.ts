import { pusherServer } from '@/lib/pusher';
import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, getRoomName, verifyUserId } from '@/lib/server-utils';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    const data = await req.formData();
    const socketId = data.get('socket_id') as string;
    const channelName = data.get('channel_name') as string;

    // Security: Verify required parameters
    if (!socketId || !channelName) {
        return new NextResponse('Missing socket_id or channel_name', { status: 400 });
    }

    // Security: Verify that the user is joining their assigned room (based on IP)
    const ip = getClientIp(req);
    const expectedRoomName = getRoomName(ip);
    if (channelName !== expectedRoomName) {
        return new NextResponse('Unauthorized: Cannot join this room', { status: 403 });
    }

    // Security: Verify user identity from signed session cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('user_id_token')?.value;
    const userId = token ? verifyUserId(token) : null;

    if (!userId) {
        return new NextResponse('Unauthorized: Invalid or missing session', { status: 401 });
    }

    const presenceData = {
        user_id: userId,
        user_info: {
            joinedAt: Date.now(),
            userAgent: req.headers.get('user-agent') || 'Unknown Device',
        }
    };

    try {
        const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData);
        return NextResponse.json(authResponse);
    } catch (error) {
        console.error('Pusher auth error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
