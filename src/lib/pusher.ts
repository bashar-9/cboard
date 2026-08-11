import PusherServer from 'pusher';
import PusherClient from 'pusher-js';

let pusherServerInstance: PusherServer | null = null;

export const getPusherServer = () => {
    if (pusherServerInstance) return pusherServerInstance;
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!appId || !key || !secret || !cluster) throw new Error('Pusher is not configured.');

    pusherServerInstance = new PusherServer({ appId, key, secret, cluster, useTLS: true });
    return pusherServerInstance;
};

export const createPusherClient = (accessToken: string): PusherClient => {
    const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) throw new Error('Online sharing is not configured.');
    return new PusherClient(key, {
        cluster,
        forceTLS: true,
        channelAuthorization: {
            endpoint: '/api/pusher/auth',
            transport: 'ajax',
            params: { access_token: accessToken },
        },
    });
};
