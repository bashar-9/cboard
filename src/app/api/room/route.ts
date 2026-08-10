import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createPrivateInvite, getClientIp, getRoomName, openPrivateInvite, readPrivateInvite, signRoomAccess, signUserId, verifyRoomAccess, verifyUserId } from '@/lib/server-utils';

export const dynamic = 'force-dynamic';
const privateJoinAttempts = new Map<string, { count: number; resetAt: number }>();

function setIdentityCookie(response: NextResponse, userId: string, isNewUser: boolean) {
    if (!isNewUser) return;
    response.cookies.set('user_id_token', signUserId(userId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
    });
}

function setPrivateRoomCookie(response: NextResponse, roomName: string, userId: string) {
    response.cookies.set('room_access_token', signRoomAccess(roomName, userId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 12,
        path: '/',
    });
}

export async function GET(request: Request) {
    try {
        const ip = getClientIp(request);
        const roomName = getRoomName(ip);
        const userId = crypto.randomUUID().slice(0, 16);
        const inviteToken = createPrivateInvite(roomName, '000000');

        const response = NextResponse.json({ roomName, userId, inviteToken });
        response.headers.set('Cache-Control', 'no-store');
        setIdentityCookie(response, userId, true);
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
        try {
            originHost = origin ? new URL(origin).host : null;
        } catch {
            originHost = null;
        }
        if (!originHost || !host || originHost !== host) {
            return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
        }
        const contentLength = Number(request.headers.get('content-length') || '0');
        if (contentLength > 2_000) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
        const body: unknown = await request.json();
        if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
        const input = body as Record<string, unknown>;
        const cookieStore = await cookies();
        const identityToken = cookieStore.get('user_id_token')?.value;
        let userId = identityToken ? verifyUserId(identityToken) : null;
        const isNewUser = !userId;
        if (!userId) userId = crypto.randomUUID().slice(0, 16);

        if (input.action === 'create-private') {
            const roomName = `presence-private-${crypto.randomBytes(16).toString('hex')}`;
            const pin = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
            const inviteToken = createPrivateInvite(roomName, pin);
            const response = NextResponse.json({ roomName, userId, pin, inviteToken });
            response.headers.set('Cache-Control', 'no-store');
            setIdentityCookie(response, userId, isNewUser);
            setPrivateRoomCookie(response, roomName, userId);
            return response;
        }

        if (input.action === 'resume-private' && typeof input.inviteToken === 'string' && userId) {
            const invite = readPrivateInvite(input.inviteToken);
            const accessToken = cookieStore.get('room_access_token')?.value;
            const access = accessToken ? verifyRoomAccess(accessToken) : null;
            if (!invite || !access || access.roomName !== invite.roomName || access.userId !== userId) {
                return NextResponse.json({ error: 'Private room access expired.' }, { status: 401 });
            }
            userId = crypto.randomUUID().slice(0, 16);
            const response = NextResponse.json({ roomName: invite.roomName, userId, pin: invite.pin, inviteToken: input.inviteToken });
            response.headers.set('Cache-Control', 'no-store');
            setIdentityCookie(response, userId, true);
            setPrivateRoomCookie(response, invite.roomName, userId);
            return response;
        }

        if (input.action === 'join-public' && typeof input.inviteToken === 'string') {
            const invite = readPrivateInvite(input.inviteToken);
            if (!invite || !/^presence-room-[a-f0-9]{12}$/.test(invite.roomName)) {
                return NextResponse.json({ error: 'Public room link expired.' }, { status: 401 });
            }
            userId = crypto.randomUUID().slice(0, 16);
            const response = NextResponse.json({ roomName: invite.roomName, userId, inviteToken: input.inviteToken });
            response.headers.set('Cache-Control', 'no-store');
            setIdentityCookie(response, userId, true);
            setPrivateRoomCookie(response, invite.roomName, userId);
            return response;
        }

        if (input.action === 'join-private' && typeof input.inviteToken === 'string' && typeof input.pin === 'string') {
            const address = getClientIp(request);
            const now = Date.now();
            const savedAttempt = privateJoinAttempts.get(address);
            const attempts = savedAttempt && savedAttempt.resetAt > now
                ? savedAttempt
                : { count: 0, resetAt: now + 5 * 60 * 1000 };
            if (attempts.count >= 5) {
                return NextResponse.json({ error: 'Too many attempts. Try again in five minutes.' }, { status: 429 });
            }
            const roomName = openPrivateInvite(input.inviteToken, input.pin);
            if (!roomName) {
                attempts.count += 1;
                privateJoinAttempts.set(address, attempts);
                return NextResponse.json({ error: 'Incorrect or expired PIN.' }, { status: 403 });
            }
            privateJoinAttempts.delete(address);
            const response = NextResponse.json({ roomName, userId });
            response.headers.set('Cache-Control', 'no-store');
            setIdentityCookie(response, userId, isNewUser);
            setPrivateRoomCookie(response, roomName, userId);
            return response;
        }

        return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    } catch (error) {
        console.error('Private room setup failed:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ error: 'Private room is unavailable.' }, { status: 503 });
    }
}
