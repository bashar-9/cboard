# Local Public Mode Design

## Understanding

- CBoard works on a local router even when that router has no internet.
- One device runs the CBoard web server and opens the board as the Host.
- One other device opens the Host's local address as the Receiver.
- Both people use normal web browsers; no cloud account is needed.
- Text and files stay on the local network and move peer-to-peer.
- Shared items expire after 15 minutes and files are limited to 50 MB.

## Assumptions

- The Host device stays awake and keeps the local CBoard server running.
- The first browser connected becomes the Host; only one Receiver may join.
- The Host chooses an open Public room or a PIN-locked Private room.
- The server only coordinates the connection. Shared content is not stored by it.
- Modern desktop and mobile browsers with WebRTC support are the initial target.

## Chosen Design

The Next.js app runs through a small local Node.js server bound to the local network. A WebSocket endpoint handles local connection setup without internet. The first browser becomes the Host and receives the local share address. The Host can leave the room Public or protect it with a random PIN. WebRTC carries text and files directly between the two browsers.

The server limits the room to two approved devices, limits failed PIN attempts, validates every signaling message, limits message size, checks request origins, and sends browser security headers. The client also validates incoming messages and files before adding them to the board.

## Decision Log

| Decision | Alternatives | Reason |
|---|---|---|
| Local Node.js web server | Internet signaling, desktop background app, QR-only pairing | Meets the zero-internet and fully-web requirements. |
| Host plus one Receiver | Multi-device mesh | Matches the requested simple workflow and reduces risk. |
| Public or PIN pairing | QR exchange | Supports quick open sharing and a protected option. |
| WebRTC for content | Relay content through the server | Keeps files and text directly between browsers. |

## Known Constraint

If the local server stops, the Host device sleeps, or the Host leaves the network, new connections are impossible and the current session ends.
