# CBoard

CBoard shares text and files directly between two browsers.

- **Public:** both devices open the same CBoard domain on the same network.
- **Private:** the Host creates and shares a short secret link. No PIN is needed.
- Public and Private stay connected as separate tabs, so switching does not close either room.
- Local mode works on a router with no internet. One laptop runs CBoard and one device receives.

Items expire after 15 minutes. Files are limited to 50 MB each.

## Vercel

Online connection setup uses Pusher. Configure:

- `PUSHER_APP_ID`
- `NEXT_PUBLIC_PUSHER_APP_KEY`
- `PUSHER_SECRET`
- `NEXT_PUBLIC_PUSHER_CLUSTER`
- `PUSHER_COOKIE_SECRET` (recommended)

## Start locally

Install Node.js 20 or newer, then run:

```bash
npm install
npm run build
npm start
```

The Host opens `http://127.0.0.1:3000`. The Receiver opens the local address shown in the terminal.

Keep the Host laptop, terminal, and Host browser open.

## Security

- Private links contain a random 72-bit key.
- Room access is signed before Pusher allows a connection.
- One Host and one Receiver in local mode.
- Incoming messages and file sizes are checked.
- Browser security headers are enabled.
- Text and files are sent browser-to-browser, not uploaded to Pusher.

## Checks

```bash
npm test
npm run lint
npm run build
```
