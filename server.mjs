import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import next from 'next';
import { WebSocket, WebSocketServer } from 'ws';

const dev = process.argv.includes('--dev');
const hostname = '0.0.0.0';
const port = Number.parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const MAX_SIGNAL_BYTES = 64 * 1024;
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 5 * 60 * 1000;
const pairingPin = randomInt(100000, 1000000).toString();
let localRoomPrivacy = 'public';
const clients = new Map();
const pinAttemptsByAddress = new Map();

function getLanAddress() {
  const addresses = Object.values(networkInterfaces()).flat().filter(Boolean);
  const ipv4 = addresses.filter((address) => address.family === 'IPv4' && !address.internal);
  return ipv4.find((address) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address))?.address
    || ipv4[0]?.address
    || '127.0.0.1';
}

function isLoopback(address = '') {
  return address === '127.0.0.1' || address === '::1' || address.endsWith('::ffff:127.0.0.1');
}

function isHostAddress(address = '') {
  if (isLoopback(address)) return true;
  const normalizedAddress = address.replace(/^::ffff:/, '');
  return Object.values(networkInterfaces())
    .flat()
    .filter(Boolean)
    .some((networkAddress) => networkAddress.address === normalizedAddress);
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function getClientByRole(role) {
  for (const [socket, client] of clients) {
    if (client.authenticated && client.role === role) return { socket, client };
  }
  return null;
}

function connectPeers() {
  const host = getClientByRole('host');
  const receiver = getClientByRole('receiver');
  if (!host || !receiver) return;

  send(host.socket, { type: 'peer-ready', peerId: receiver.client.id, polite: false });
  send(receiver.socket, { type: 'peer-ready', peerId: host.client.id, polite: true });
}

function setSecurityHeaders(response) {
  response.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '));
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
}

await app.prepare();

const server = createServer((request, response) => {
  setSecurityHeaders(response);
  handle(request, response);
});

const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_SIGNAL_BYTES, perMessageDeflate: false });
const nextUpgradeHandler = app.getUpgradeHandler();

server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (requestUrl.pathname !== '/ws') {
        nextUpgradeHandler(request, socket, head);
        return;
    }
    const origin = request.headers.origin;
  const expectedOrigin = `http://${request.headers.host}`;

    if (!origin || origin !== expectedOrigin || clients.size >= 3) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit('connection', webSocket, request);
  });
});

webSocketServer.on('connection', (socket, request) => {
  const localRequest = isHostAddress(request.socket.remoteAddress);
  const existingHost = getClientByRole('host');
  const role = localRequest && !existingHost ? 'host' : 'receiver';
  const client = {
    id: randomUUID().replaceAll('-', '').slice(0, 16),
    role,
    authenticated: role === 'host',
    attempts: 0,
    alive: true,
  };

    clients.set(socket, client);
  socket.on('pong', () => { client.alive = true; });

  if (role === 'host') {
    send(socket, {
      type: 'session',
      role,
      clientId: client.id,
      pairingPin,
      roomPrivacy: localRoomPrivacy,
      shareUrl: `http://${getLanAddress()}:${port}`,
    });
    connectPeers();
  } else if (!existingHost) {
    send(socket, { type: 'error', code: 'host_required', message: 'The Host must open CBoard first.' });
    setTimeout(() => socket.close(1008, 'Host required'), 100);
  } else if ([...clients.values()].filter((candidate) => candidate.role === 'receiver').length > 1) {
    send(socket, { type: 'error', code: 'room_full', message: 'This board already has a Receiver.' });
    setTimeout(() => socket.close(1008, 'Room full'), 100);
  } else if (localRoomPrivacy === 'public') {
    client.authenticated = true;
    send(socket, { type: 'session', role, clientId: client.id, requiresPin: false, roomPrivacy: 'public' });
    connectPeers();
  } else {
    send(socket, { type: 'session', role, clientId: client.id, requiresPin: true, roomPrivacy: 'private' });
  }

  socket.on('message', (raw, isBinary) => {
    if (isBinary || raw.length > MAX_SIGNAL_BYTES) {
      socket.close(1009, 'Invalid message');
      return;
    }

    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      socket.close(1007, 'Invalid JSON');
      return;
    }

    if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;

    if (message.type === 'set-room-privacy' && client.role === 'host' && client.authenticated) {
      if (message.privacy !== 'public' && message.privacy !== 'private') return;
      if (getClientByRole('receiver')) {
        send(socket, { type: 'error', code: 'mode_locked', message: 'Disconnect the Receiver before changing room privacy.' });
        return;
      }

      localRoomPrivacy = message.privacy;
      send(socket, { type: 'room-privacy', privacy: localRoomPrivacy });
      for (const [candidateSocket, candidate] of clients) {
        if (candidate.role !== 'receiver' || candidate.authenticated) continue;
        send(candidateSocket, { type: 'room-privacy', privacy: localRoomPrivacy });
        if (localRoomPrivacy === 'public') {
          candidate.authenticated = true;
          send(candidateSocket, { type: 'join-accepted' });
        }
      }
      connectPeers();
      return;
    }

    if (message.type === 'join' && client.role === 'receiver' && !client.authenticated) {
      const address = request.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const addressAttempts = pinAttemptsByAddress.get(address);
      const activeAttempts = addressAttempts && addressAttempts.resetAt > now
        ? addressAttempts
        : { count: 0, resetAt: now + PIN_LOCKOUT_MS };

      if (activeAttempts.count >= MAX_PIN_ATTEMPTS) {
        send(socket, { type: 'error', code: 'too_many_attempts', message: 'Too many incorrect attempts. Try again in five minutes.' });
        socket.close(1008, 'Too many attempts');
        return;
      }

      client.attempts += 1;
      if (client.attempts > MAX_PIN_ATTEMPTS) {
        send(socket, { type: 'error', code: 'too_many_attempts', message: 'Too many incorrect attempts.' });
        socket.close(1008, 'Too many attempts');
        return;
      }

      const submittedPin = typeof message.pin === 'string' ? message.pin : '';
      if (!/^\d{6}$/.test(submittedPin) || !safeEqual(submittedPin, pairingPin)) {
        activeAttempts.count += 1;
        pinAttemptsByAddress.set(address, activeAttempts);
        send(socket, { type: 'join-rejected', attemptsLeft: MAX_PIN_ATTEMPTS - client.attempts });
        return;
      }

      if (getClientByRole('receiver')) {
        send(socket, { type: 'error', code: 'room_full', message: 'This board already has a Receiver.' });
        return;
      }

      client.authenticated = true;
      pinAttemptsByAddress.delete(address);
      send(socket, { type: 'join-accepted' });
      connectPeers();
      return;
    }

    if (message.type === 'signal' && client.authenticated) {
      const target = [...clients.entries()].find(([, candidate]) => (
        candidate.authenticated
        && candidate.id === message.to
        && candidate.id !== client.id
      ));
      const signal = message.signal;
      if (!target || !signal || !['offer', 'answer', 'candidate'].includes(signal.type)) return;

      send(target[0], {
        type: 'signal',
        from: client.id,
        signal: { type: signal.type, data: signal.data },
      });
    }
  });

  socket.on('close', () => {
    const wasAuthenticated = client.authenticated;
    clients.delete(socket);
    if (wasAuthenticated) {
      const remainingPeer = client.role === 'host' ? getClientByRole('receiver') : getClientByRole('host');
      if (remainingPeer) send(remainingPeer.socket, { type: 'peer-left', peerId: client.id });
    }
  });
});

const heartbeat = setInterval(() => {
  for (const [socket, client] of clients) {
    if (!client.alive) {
      socket.terminate();
      continue;
    }
    client.alive = false;
    socket.ping();
  }
}, 30000);

server.listen(port, hostname, () => {
  const lanUrl = `http://${getLanAddress()}:${port}`;
  console.log(`\nCBoard Host:     http://127.0.0.1:${port}`);
  console.log(`Receiver opens:  ${lanUrl}`);
  console.log('Keep this window and the Host laptop running.\n');
});

function shutdown() {
  clearInterval(heartbeat);
  webSocketServer.close();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
