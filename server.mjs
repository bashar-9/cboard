import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import next from 'next';
import { WebSocket, WebSocketServer } from 'ws';

const dev = process.argv.includes('--dev');
const hostname = '0.0.0.0';
const port = Number.parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const MAX_SIGNAL_BYTES = 64 * 1024;
const privateCode = randomBytes(9).toString('base64url');
const clients = new Map();

function getLanAddress() {
  const addresses = Object.values(networkInterfaces()).flat().filter(Boolean);
  const ipv4 = addresses.filter((address) => address.family === 'IPv4' && !address.internal);
  return ipv4.find((address) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address))?.address
    || ipv4[0]?.address || '127.0.0.1';
}

function isHostAddress(address = '') {
  if (address === '127.0.0.1' || address === '::1' || address.endsWith('::ffff:127.0.0.1')) return true;
  const normalized = address.replace(/^::ffff:/, '');
  return Object.values(networkInterfaces()).flat().filter(Boolean)
    .some((networkAddress) => networkAddress.address === normalized);
}

function readRequest(request) {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const session = url.searchParams.get('session') || '';
    const scope = url.searchParams.get('room');
    const code = url.searchParams.get('code');
    if (!/^[a-f0-9-]{32,36}$/.test(session) || (scope !== 'public' && scope !== 'private')) return null;
    return { session, scope, code };
  } catch { return null; }
}

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function roomClients(scope) {
  return [...clients.entries()].filter(([, client]) => client.scope === scope);
}

function getRole(scope, role) {
  return roomClients(scope).find(([, client]) => client.role === role) || null;
}

function connectRoom(scope) {
  const host = getRole(scope, 'host');
  const receiver = getRole(scope, 'receiver');
  if (!host || !receiver) return;
  send(host[0], { type: 'peer-ready', peerId: receiver[1].id, polite: false });
  send(receiver[0], { type: 'peer-ready', peerId: host[1].id, polite: true });
}

function setSecurityHeaders(response) {
  response.setHeader('Content-Security-Policy', [
    "default-src 'self'", `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:",
    "connect-src 'self' ws: wss:", "media-src 'self' blob: data:", "object-src 'none'",
    "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'",
  ].join('; '));
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

await app.prepare();
const server = createServer((request, response) => { setSecurityHeaders(response); handle(request, response); });
const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_SIGNAL_BYTES, perMessageDeflate: false });
const nextUpgradeHandler = app.getUpgradeHandler();

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws') { nextUpgradeHandler(request, socket, head); return; }
  const details = readRequest(request);
  const expectedOrigin = `http://${request.headers.host}`;
  if (!details || request.headers.origin !== expectedOrigin || clients.size >= 8) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => webSocketServer.emit('connection', webSocket, request));
});

webSocketServer.on('connection', (socket, request) => {
  const details = readRequest(request);
  if (!details) { socket.close(1008, 'Invalid room'); return; }
  const { session, scope, code } = details;
  for (const [oldSocket, oldClient] of clients) {
    if (oldClient.session !== session || oldClient.scope !== scope) continue;
    oldClient.replaced = true;
    clients.delete(oldSocket);
    oldSocket.close(4000, 'Page refreshed');
  }

  const localRequest = isHostAddress(request.socket.remoteAddress);
  const role = localRequest && !getRole(scope, 'host') ? 'host' : 'receiver';
  if (scope === 'private' && role === 'receiver' && code !== privateCode) {
    send(socket, { type: 'error', message: 'Open the Private link from the Host.' });
    setTimeout(() => socket.close(1008, 'Private link required'), 100);
    return;
  }
  if (getRole(scope, role)) {
    send(socket, { type: 'error', message: `This ${scope} room already has a ${role}.` });
    setTimeout(() => socket.close(1008, 'Room full'), 100);
    return;
  }

  const client = { id: randomUUID().replaceAll('-', '').slice(0, 16), session, scope, role, alive: true, replaced: false };
  clients.set(socket, client);
  socket.on('pong', () => { client.alive = true; });
  const baseUrl = `http://${getLanAddress()}:${port}`;
  send(socket, {
    type: 'session', clientId: client.id, role,
    shareUrl: role === 'host' ? scope === 'private' ? `${baseUrl}/r/${privateCode}` : baseUrl : undefined,
  });
  connectRoom(scope);

  socket.on('message', (raw, isBinary) => {
    if (isBinary || raw.length > MAX_SIGNAL_BYTES) { socket.close(1009, 'Invalid message'); return; }
    let message;
    try { message = JSON.parse(raw.toString()); } catch { socket.close(1007, 'Invalid JSON'); return; }
    if (!message || message.type !== 'signal') return;
    const signal = message.signal;
    const target = roomClients(scope).find(([, candidate]) => candidate.id === message.to && candidate.id !== client.id);
    if (!target || !signal || !['offer', 'answer', 'candidate'].includes(signal.type)) return;
    send(target[0], { type: 'signal', from: client.id, signal: { type: signal.type, data: signal.data } });
  });

  socket.on('close', () => {
    if (client.replaced) return;
    clients.delete(socket);
    const peer = roomClients(scope).find(([, candidate]) => candidate.role !== role);
    if (peer) send(peer[0], { type: 'peer-left', peerId: client.id });
  });
});

const heartbeat = setInterval(() => {
  for (const [socket, client] of clients) {
    if (!client.alive) { socket.terminate(); continue; }
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
