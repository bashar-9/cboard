# Project Documentation & Memory

## Overview
A local network text and file sharing service (similar to Apple's Universal Clipboard/AirDrop). It allows devices on the same local network to share text and files in real-time via a web browser.

## Core Architecture & Tech Stack
- **Framework:** Next.js (App Router)
- **Deployment:** Vercel
- **Styling & Physics:** Tailwind CSS + Shadcn/ui + Framer Motion
- **State Management:** Zustand
- **Networking/Data Transfer:** WebRTC (Peer-to-Peer) for direct, serverless file/text transfer on the local network.
- **Signaling:** Pusher Channels (or similar lightweight WebSocket service) for initial device discovery and WebRTC handshake.

## Key Mechanisms
### 1. Peer Discovery & Grouping
- **Primary (Internet Available):** Users are grouped automatically based on their public IP address. Devices with matching public IPs are placed in the same signaling "room."
- **Fallback (No Internet):** A "Local First" approach. Device A displays a QR code containing its local IP address. Device B scans it to connect directly over the local Wi-Fi router.

- All file and text transfers occur over **WebRTC Data Channels**.
- Data channels support chunking and reassembly to transfer **bundled posts** containing text and multiple files up to 50MB.
- Files never touch Vercel's servers, ensuring zero bandwidth cost for transfers and strict privacy.
- The web app operates as a Progressive Web App (PWA) so it can load from the device cache when offline.
- **WebRTC Signaling Pattern:** Uses "Perfect Negotiation" to avoid Glare/State errors when peers connect. A deterministic comparison of string User IDs decides which device is "polite" (waits for offer) vs "impolite" (sends offer). WebRTC signaling is serialized with a Promise chain to avoid `InvalidStateError` race conditions caused by network or signaling duplicates.
- **Network Singletons:** Active `WebRTCManager` and Pusher `Channel` references are stored as module-level singletons (outside React component scopes) to gracefully handle React Strict Mode double hooks avoiding duplicated peer handshakes.
- **Persistent Identity:** A persistent device ID is stored in `localStorage`. This prevents the "Sender" attribution resolving to "Someone" when a user refreshes the page and gets assigned a new Pusher socket ID.
- **State Synchronization:** New peers passively receive the full message history from the existing active peer upon data channel connection over WebRTC.

## Future Scalability Considerations
- **Private Mode:** Add authentication to allow users to have private, synchronized clipboards across their own devices only.
- **Native Apps:** Build mobile (iOS/Android) and desktop (Windows/Mac/Linux) apps using frameworks like React Native or Electron/Tauri, which natively support WebRTC and can access system-level clipboards and file systems.

## UI/UX & Styling Guidelines
*(Reference: `ui-ux-pro-max` skill standards)*

### Principles
1. **Premium & Frictionless:** The UI should feel native, responsive, and alive.
2. **Minimalist & Clean:** Focus strictly on the content being shared. Avoid visual clutter.
3. **Feedback-Driven:** Provide clear visual feedback for all interactions (e.g., connected status, upload progress, successful copy).

### Specifics
- **Theme:** Clean, modern design (support for both Light and Dark modes). Consider a "glassmorphism" aesthetic for a premium feel.
- **Layout:** Google Keep-style masonry board with CSS columns (`columns-1 sm:2 lg:3 xl:4`). Input bar pinned to bottom of viewport (Gemini-style).
- **Cards:** Truncated at 280 chars with "View more" hint. Clicking any card opens a detail modal overlay (Google Keep-style) with full text, attachments, and download options.
- **Interactions:** 
  - Smooth transitions (150-300ms) for all state changes.
  - Hover states on interactive elements without layout shifts.
  - Copy/Delete actions appear as hover-only overlay on cards.
  - No emojis for UI elements; use crisp SVG icons (e.g., Lucide).
- **Typography & Layout:** 
  - Standardized max-width containers (`max-w-6xl` board, `max-w-3xl` input).
  - Generous padding and legible, accessible contrast ratios (minimum 4.5:1).
  - Clear, readable typography (e.g., Inter or a similar modern sans-serif).

## Project Structure

```text
src/
├── app/
│   ├── globals.css           # Global Tailwind CSS and utilities
│   ├── layout.tsx            # Root layout (Theme provider setup)
│   └── page.tsx              # Main Board view (flex column, masonry grid)
├── components/
│   ├── board/
│   │   ├── BoardItemCard.tsx         # Card with truncation + opens detail modal
│   │   ├── Header.tsx                # App header & connection status
│   │   ├── IncomingFilesProgress.tsx  # File download progress bars
│   │   ├── ItemDetailModal.tsx        # Google Keep-style detail overlay
│   │   └── ShareInput.tsx            # Bottom-pinned compact input bar
│   └── ui/                   # Shadcn UI generic components
├── hooks/
│   └── useBoardNetwork.ts    # WebRTC and Pusher networking logic
├── lib/
│   ├── pusher.ts             # Pusher client singleton
│   ├── utils.ts              # Tailwind/general utils
│   └── webrtc.ts             # Custom RTCPeerConnection wrapper
└── store/
    └── useBoardStore.ts      # Zustand global state (Items, UI states)
```

## Project Files Reference
| File | Purpose |
|------|---------|
| `documentation.md` | Architecture, tech stack, UX rules (this file) |
| `timeline.md` | Development progress tracker — what's done, in progress, and planned |
| `skills.md` | Categorized list of available `.agent` skills with usage instructions |

## Maintenance & Updates
**CRITICAL INSTRUCTION FOR AI AGENTS:**
- **Read `documentation.md` first** to understand the architecture and constraints.
- **Read `timeline.md` second** to understand where development currently stands.
- You MUST update **both files** whenever there is a notable change in architecture, tech stack, data flow, major UI/UX decisions, or when a development milestone is reached.
- Keep sections concise and focused.
