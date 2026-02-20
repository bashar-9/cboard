import { pusherServer } from '@/lib/pusher';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const data = await req.formData();
    const socketId = data.get('socket_id') as string;
    const channelName = data.get('channel_name') as string;
    let userId = data.get('user_id') as string;

    if (!socketId || !channelName) {
        return new NextResponse('Missing socket_id or channel_name', { status: 400 });
    }

    if (!userId) {
        // Fallback random ID just in case
        userId = Math.random().toString(36).substring(2, 10);
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
