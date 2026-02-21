# Project Documentation & Memory

## Overview
A local network text and file sharing service (similar to Apple's Universal Clipboard/AirDrop). It allows devices on the same local network to share text and files in real-time via a web browser.

## Core Architecture & Tech Stack
- **Framework:** Next.js (App Router)
- **Deployment:** Vercel
- **Styling & Physics:** Tailwind CSS + Shadcn/ui + Framer Motion
- **State Management:** Zustand
- **Networking/Data Transfer (Public Mode):** WebRTC (Peer-to-Peer) for direct, serverless file/text transfer on the local network.
- **Signaling (Public Mode):** Pusher Channels for initial device discovery and WebRTC handshake.
- **Backend & Auth (Private Mode):** Supabase (Auth, Postgres DB, Database Webhooks/Realtime) for persistent, secure cross-device sync.

## Key Mechanisms
### 1. Peer Discovery & Grouping
- **Primary (Internet Available):** Users are grouped automatically based on their public IP address. Devices with matching public IPs are placed in the same signaling "room."
- **Fallback (No Internet):** A "Local First" approach. Device A displays a QR code containing its local IP address. Device B scans it to connect directly over the local Wi-Fi router.

- All file and text transfers occur over **WebRTC Data Channels**.
- Data channels support chunking and reassembly to transfer **bundled posts** containing text and multiple files up to 50MB.
- Files never touch Vercel's servers, ensuring zero bandwidth cost for transfers and strict privacy.
- The web app operates as a Progressive Web App (PWA) so it can load from the device cache when offline.
- **File Data Persistence:** After sharing, ephemeral `blob:` URLs are converted to base64 `data:` URIs. This enables Zustand `persist` to save post items (with attachments ≤ 4MB) to `localStorage`, surviving page refreshes. Posts with attachments exceeding 4MB retain metadata but strip binary data from persistence — they are re-transferred via WebRTC from connected peers.
- **WebRTC Signaling Pattern:** Uses "Perfect Negotiation" to avoid Glare/State errors when peers connect. A deterministic comparison of string User IDs decides which device is "polite" (waits for offer) vs "impolite" (sends offer). WebRTC signaling is serialized with a Promise chain to avoid `InvalidStateError` race conditions caused by network or signaling duplicates.
- **Network Singletons:** Active `WebRTCManager` and Pusher `Channel` references are stored as module-level singletons (outside React component scopes) to gracefully handle React Strict Mode double hooks avoiding duplicated peer handshakes.
- **Persistent Identity:** A persistent device ID is stored in `localStorage`. This prevents the "Sender" attribution resolving to "Someone" when a user refreshes the page and gets assigned a new Pusher socket ID.
- **State Synchronization:** New peers passively receive the full message history from the existing active peer upon data channel connection over WebRTC. Real-time actions, such as item deletion, are broadcasted globally to ensure all peers remain in sync.

### 2. Private Mode & Authentication
- **OAuth Providers:** Google OAuth enables seamless login. Next.js server-side intercept tunnels (`/auth/callback`) exchange query `?code` tokens for secure SSR user sessions, redirecting them back to the app cleanly.
- **State Hydration:** A global `<AuthProvider>` wrapper at the root layout listens dynamically for Supabase `onAuthStateChange` events, linking remote identity directly into the local `useBoardStore` Zustand store without full page lifecycles.
- **Data Sync & RLS:** When toggled to Private Mode, the client bypasses WebRTC and reads/writes exclusively to a `private_items` Supabase table. Row Level Security limits visibility strictly to the authenticated `user_id`. Supabase Realtime subscriptions replace Pusher to keep UI tabs concurrently perfectly in sync.

## Future Scalability Considerations
- **Native Apps:** Build mobile (iOS/Android) and desktop (Windows/Mac/Linux) apps using frameworks like React Native or Electron/Tauri. These will integrate deeply with the OS Clipboard API (Direct OS Clipboard Integration) to allow true "magic" copy-paste without opening the app, reading directly from the Private Mode Supabase queue.
- **Direct Device Targeting:** AirDrop-style targeting over LAN for specific public users.

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
│   ├── auth/                 # Auth UI and Callback routing
│   │   ├── callback/         # Next.js API route to exchange OAuth Code
│   │   └── page.tsx          # Authentication Form (Google Auth + Email)
│   ├── globals.css           # Global Tailwind CSS and utilities
│   ├── layout.tsx            # Root layout (Theme provider setup + AuthProvider wrap)
│   └── page.tsx              # Main Board view (flex column, masonry grid)
├── components/
│   ├── board/
│   │   ├── BoardItemCard.tsx         # Card with truncation + opens detail modal
│   │   ├── Header.tsx                # App header & connection status (Synced/Offline logic)
│   │   ├── PublicHowItWorks.tsx      # Initial empty state onboarding guide for peer-to-peer sharing
│   │   ├── PrivateHowItWorks.tsx     # Initial empty state onboarding guide for cloud sync
│   │   ├── IncomingFilesProgress.tsx  # File download progress bars
│   │   ├── ItemDetailModal.tsx        # Google Keep-style detail overlay
│   │   └── ShareInput.tsx            # Bottom-pinned compact input bar
│   ├── providers/
│   │   └── AuthProvider.tsx          # Global Supabase Session Context Hydration
│   └── ui/                   # Shadcn UI generic components
├── hooks/
│   ├── useBoardNetwork.ts    # WebRTC and Pusher networking logic
│   └── usePrivateNetwork.ts  # Supabase Realtime synchronization layer
├── lib/
│   ├── pusher.ts             # Pusher client singleton
│   ├── supabase/             # Supabase Client Wrappers (browser/server/middleware)
│   ├── utils.ts              # Tailwind/general utils
│   └── webrtc.ts             # Custom RTCPeerConnection wrapper
└── store/
    └── useBoardStore.ts      # Zustand global state (Items, UI states, User Auth context)
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
