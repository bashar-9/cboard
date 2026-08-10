# Project Documentation & Memory

## Overview
A browser-based text and file sharing service with an online Vercel mode and an offline local-network mode.

## Current Active Release

- **Online:** Vercel + Pusher public room, grouped by public IP
- **Local:** Host + one Receiver through a custom Node.js/Next.js server
- **Local Pairing:** Open Public room or PIN-locked Private room
- **Transfer:** Direct browser-to-browser WebRTC data channels
- **Cloud features:** Supabase Private Mode is preserved but hidden and inactive
- **Online signaling:** Pusher carries WebRTC connection setup only

## Core Architecture & Tech Stack
- **Framework:** Next.js (App Router)
- **Runtime:** Vercel online or local Node.js server (`server.mjs`)
- **Styling & Physics:** Tailwind CSS + Shadcn/ui + Framer Motion
- **State Management:** Zustand
- **Networking/Data Transfer:** WebRTC for direct local file/text transfer.
- **Signaling:** Pusher online; a same-origin WebSocket server locally.
- **Legacy Cloud Code:** Supabase authentication and sync files remain for a future version but are not mounted or shown.

## Key Mechanisms
### 1. Local Pairing
- The first browser opened on the Host device receives the Host role.
- The server shows the LAN address and lets the Host choose Public or PIN-locked Private.
- One Receiver opens that address and joins under the chosen rule.
- Extra devices are rejected.

- All file and text transfers occur over **WebRTC Data Channels** using local ICE candidates only.
- Data channels support chunking and reassembly to transfer **bundled posts** containing text and multiple files up to 50MB.
- Files never touch a cloud service or the local signaling server.
- The Host's local Next.js server serves the full web app without internet.
- **File Data Persistence:** After sharing, ephemeral `blob:` URLs are converted to base64 `data:` URIs. This enables Zustand `persist` to save post items (with attachments ≤ 4MB) to `localStorage`, surviving page refreshes. Posts with attachments exceeding 4MB retain metadata but strip binary data from persistence — they are re-transferred via WebRTC from connected peers.
- **WebRTC Signaling Pattern:** Uses "Perfect Negotiation" to avoid Glare/State errors when peers connect. A deterministic comparison of string User IDs decides which device is "polite" (waits for offer) vs "impolite" (sends offer). WebRTC signaling is serialized with a Promise chain to avoid `InvalidStateError` race conditions caused by network or signaling duplicates.
- **Network Singletons:** Active `WebRTCManager` and WebSocket references are stored as module-level singletons to avoid duplicate peer handshakes.
- **Session Identity:** The local server gives each connected browser a random session ID.
- **State Synchronization:** New peers passively receive the full message history from the existing active peer upon data channel connection over WebRTC. Real-time actions, such as item deletion, are broadcasted globally to ensure all peers remain in sync.

### 2. Parked Private Mode & Authentication
The following code is retained but inactive. `PRIVATE_MODE_ENABLED` is false, the auth provider is not mounted, Private controls are hidden, and Supabase middleware does not run.
- **OAuth Providers:** Google OAuth and Magic Link Email login are supported. Next.js server-side intercept tunnels (`/auth/callback`) exchange query `?code` tokens for secure SSR user sessions. The callback uses native `new URL(request.url)` parsing to handle Vercel proxy headers flawlessly during domain redirects.
- **State Hydration:** A global `<AuthProvider>` wrapper at the root layout listens dynamically for Supabase `onAuthStateChange` events, linking remote identity directly into the local `useBoardStore` Zustand store without full page lifecycles.
- **Data Sync, RLS, & Keys:** Utilizing modern `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` strings (no legacy anon keys). When toggled to Private Mode, the client bypasses WebRTC and reads/writes exclusively to a `private_items` Supabase table. Row Level Security limits visibility strictly to the authenticated `user_id`.
- **Realtime Webhooks & Optimistic UI:** Supabase Realtime subscriptions replace Pusher to keep UI tabs concurrently perfectly in sync. Because the DB uses RLS, `REPLICA IDENTITY FULL` is configured on the `private_items` table so that `DELETE` webhook events carry the `user_id` required for RLS rule validation. The frontend utilizes **Optimistic UI Updates** that natively inject or remove rows from the local Zustand store the instant the REST insert/delete is fired via `.select().single()`, achieving zero-latency visually before the Webhook round-trip finishes.

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
- **Layout:** Google Keep-style masonry board with CSS columns (`columns-1 sm:2 lg:3 xl:4`). The container uses `justify-start` flex-box rules so items dynamically stack from the top-left downward instead of vertically centering. Input bar is pinned to the bottom of the viewport (Gemini-style).
- **Cards:** Truncated at 280 chars with "View more" hint. Clicking any card opens a detail modal overlay (Google Keep-style) with full text, attachments, and download options.
- **Onboarding / Help:** Split Tabbed Modal (Public/Private) accessed from the top navigation bar to guide users. Dynamically hides when the board is populated to reduce visual clutter.
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
│   └── page.tsx              # Active local Host/Receiver board
├── components/
│   ├── board/
│   │   ├── LocalConnectionPanel.tsx  # Host address/PIN and Receiver join UI
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
│   ├── useBoardNetwork.ts    # Local WebSocket signaling and WebRTC transfer logic
│   └── usePrivateNetwork.ts  # Supabase Realtime synchronization layer
├── lib/
│   ├── pusher.ts             # Legacy internet signaling code; inactive
│   ├── supabase/             # Supabase Client Wrappers (browser/server/middleware)
│   ├── utils.ts              # Tailwind/general utils
│   └── webrtc.ts             # Custom RTCPeerConnection wrapper
└── store/
    └── useBoardStore.ts      # Zustand global state (Items, UI states, User Auth context)
server.mjs                    # Secure local HTTP and WebSocket host
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
