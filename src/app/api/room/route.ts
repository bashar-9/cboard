import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getClientIp, getRoomName, signUserId, verifyUserId } from '@/lib/server-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const ip = getClientIp(request);
        const roomName = getRoomName(ip);
        const cookieStore = await cookies();
        const token = cookieStore.get('user_id_token')?.value;
        let userId = token ? verifyUserId(token) : null;
        const isNewUser = !userId;
        if (!userId) userId = crypto.randomUUID().slice(0, 16);

        const response = NextResponse.json({ roomName, userId });
        response.headers.set('Cache-Control', 'no-store');
        if (isNewUser) {
            response.cookies.set('user_id_token', signUserId(userId), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 * 30,
                path: '/',
            });
        }
        return response;
    } catch (error) {
        console.error('Room setup failed:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Online sharing is unavailable.' }, { status: 503 });
    }
}
