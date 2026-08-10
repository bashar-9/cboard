# CBoard

CBoard shares text and files directly between browsers in two ways:

- **Online:** use a public room on the same internet connection, or create a PIN-locked Private room.
- **Local:** one laptop hosts CBoard for a second device on the same router, even without internet.

## How it works

- Online and local rooms can be **Public** or protected by a six-digit **PIN**.
- Local rooms allow one Host and one Receiver.
- Text and files move directly between the two browsers with WebRTC.
- Items expire after 15 minutes. Files are limited to 50 MB each.

The existing Supabase mode is preserved in the code but is hidden and inactive. Active modes make no Supabase calls.

## Vercel

The online public room uses Pusher for connection setup. Keep these variables configured in Vercel:

- `PUSHER_APP_ID`
- `NEXT_PUBLIC_PUSHER_APP_KEY`
- `PUSHER_SECRET`
- `NEXT_PUBLIC_PUSHER_CLUSTER`
- `PUSHER_COOKIE_SECRET` (recommended)

## Start CBoard

Install [Node.js](https://nodejs.org/) 20 or newer, then run:

```bash
npm install
npm run build
npm start
```

The terminal shows two addresses:

- The Host opens `http://127.0.0.1:3000`.
- The Receiver opens the displayed local address, such as `http://192.168.1.5:3000`.

Keep the Host laptop, terminal, and local server running. The Host browser page must remain open for sharing.

## Development

```bash
npm run dev
npm run lint
npm test
npm run build
```

## Security

- One Host and one Receiver only.
- PIN approval with attempt limits.
- Same-origin WebSocket checks.
- Strict signaling and incoming file validation.
- Browser security headers.
- Files and text are not uploaded to Pusher or Supabase.
- Pusher carries connection setup messages only in online mode.
- Dependency audit currently reports zero known vulnerabilities.

## Current limitation

For offline local use, the Host laptop and local server must stay running. The online Vercel version does not have this requirement.
