# CBoard Architecture

## Overview

CBoard shares text and files directly between browsers. It has two transports:

- **Online:** Vercel serves the site, Pusher coordinates the WebRTC connection, and Public rooms group devices on the same internet connection.
- **Local:** one laptop runs `server.mjs`, allowing one Receiver on the same router even without internet.

Both transports support an open Public room and a PIN-locked Private room. Public and Private content stay separated in local browser storage.

## Stack

- Next.js App Router
- React, Tailwind CSS, Shadcn UI, and Framer Motion
- Zustand browser state
- WebRTC data channels for peer-to-peer content
- Pusher presence channels for online signaling
- Same-origin WebSocket signaling for offline local use

## Security

- Shared content is not uploaded to the signaling service.
- Private invites are encrypted, expire after 12 hours, and require a six-digit PIN.
- PIN attempts are limited.
- Room and identity cookies are signed, HTTP-only, and SameSite Strict.
- Incoming messages, files, IDs, sizes, and chunk counts are validated.
- Files are limited to 50 MB each and posts to 10 files.
- Browser security headers restrict scripts, frames, media, and connection targets.

## Persistence

Items expire after 15 minutes. Small attachments may survive refresh in browser storage. Larger files keep metadata and can be transferred again by a connected peer.

## Main Files

```text
server.mjs                              Offline local HTTP/WebSocket host
src/app/api/room/route.ts               Public and Private room sessions
src/app/api/pusher/auth/route.ts        Signed Pusher presence authorization
src/hooks/useBoardNetwork.ts            Signaling, WebRTC, syncing, and transfers
src/lib/webrtc.ts                       Peer connection and data channels
src/components/board/LocalConnectionPanel.tsx
src/components/board/ShareInput.tsx
src/store/useBoardStore.ts              Browser state and item persistence
```

## Limits

- Offline local use requires the Host laptop and server to remain running.
- Online automatic Public matching depends on both devices sharing the same router/public IPv4.
- A closed browser page cannot keep its WebRTC connection alive, but reopening reconnects it.
