# CBoard Architecture

## Rooms

CBoard keeps two separate connections alive:

- Public automatically groups devices on the same network.
- Private uses a short secret link such as `/r/K7M4Q2PX8ABC`.

Changing tabs only changes the visible board. It does not close the other room. Refresh reconnects Public and any saved Private room. Public and Private messages stay separate.

## Connection modes

- Online: Vercel serves the site and Pusher coordinates WebRTC.
- Local: one laptop runs `server.mjs`; a same-origin WebSocket coordinates WebRTC without internet.

Text and files move directly between browsers through WebRTC.

## Security

- Private room codes have 72 bits of randomness and act as bearer keys.
- The server converts codes into hidden room names and signs short-lived room access.
- Pusher authorization is scoped to one room and one temporary user.
- Incoming messages, IDs, file sizes, and chunks are validated.
- Files are limited to 50 MB and posts to 10 files.
- Browser security headers restrict scripts, frames, media, and connections.

Anyone with a Private link can join it, so the link should be treated like a password.

## Persistence

Items expire after 15 minutes. Small attachments may survive refresh in browser storage. Larger files keep metadata and can be transferred again by a connected peer.

## Limits

- Local mode needs the Host laptop, server, and Host browser to remain open.
- Online Public matching depends on both devices sharing the same router/public IPv4.
- Closing a browser page ends that device's WebRTC connection; reopening reconnects it.
