import { NextResponse } from 'next/server';
import { getClientIp, getRoomName, signUserId, verifyUserId } from '@/lib/server-utils';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(req: Request) {
    const ip = getClientIp(req);
    const roomName = getRoomName(ip);

    const cookieStore = await cookies();
    const token = cookieStore.get('user_id_token')?.value;
    let userId = token ? verifyUserId(token) : null;
    let isNewUser = false;

    if (!userId) {
        userId = crypto.randomUUID().substring(0, 8);
        isNewUser = true;
    }

    const response = NextResponse.json({
        ip,
        roomName,
        userId
    });

    if (isNewUser) {
        const newToken = signUserId(userId);
        response.cookies.set('user_id_token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', // Use lax to ensure it's sent on cross-site requests if needed, though here it's same-site Pusher auth
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
        });
    }

    return response;
}
