# Development Timeline & Progress

> **Purpose:** A quick-read summary of what has been done, what is in progress, and what is planned. Any developer or AI agent should read this file first to understand the current state of the project.

---

## Current Stage: 🟢 Execution

---

## Completed

| Date | Milestone | Details |
|------|-----------|---------|
| 2026-02-20 | Architecture Finalized | Chose WebRTC (P2P) + Pusher signaling + Next.js App Router + Tailwind/Shadcn. See `documentation.md`. |
| 2026-02-20 | Project Docs Created | `documentation.md` (architecture, UX rules, maintenance protocol) and `timeline.md` (this file). |
| 2026-02-20 | Phase 1 — Foundation | Next.js initialized with Tailwind, Shadcn/ui configured, and `next-pwa` installed. |
| 2026-02-20 | Phase 2 — Signaling | Pusher integration, IP-based room grouping |
| 2026-02-20 | Phase 3 — WebRTC Core | Vanilla WebRTC data channels for text broadcast setup |
| 2026-02-20 | Phase 4 — UI/UX | Shared board dashboard built, Shadcn applied, linting passed |
| 2026-02-20 | Enhancement | Added Dark Mode via next-themes with ThemeToggle |
| 2026-02-20 | Enhancement | Added 60-minute item expiration logic and `ExpiresIn` UI timer |
| 2026-02-20 | Phase 5 — Network Debugging | Fixed WebRTC glare state errors via Perfect Negotiation |
| 2026-02-20 | UI/UX Level Up | Refactored UI entirely replacing standard layouts with `ui-ux-pro-max` premium styling (glassmorphism/framer-motion). |
| 2026-02-20 | Deployment Preparation | Pushed repository to GitHub as CBoard |
| 2026-02-20 | Phase 6 — File Transfers | Implemented File ArrayBuffer chunking natively over WebRTC DataChannels + Droppable UI + Object URL Previews. |
| 2026-02-20 | Bug Fix | Tracked down WebRTC `InvalidStateError` race condition due to duplicate Pusher signaling messages and isolated states. Implemented serial promise dispatcher for WebRTC signalling. |
| 2026-02-20 | Phase 7 — UI Component Extraction | Modularized monolithic `page.tsx` into `<ShareInput />`, `<Header />`, `<BoardItemCard />` and `<IncomingFilesProgress />`. |
| 2026-02-20 | Multi-File Payload | Refactored WebRTC network layer to transmit bundled "Posts" containing Text and multiple File blobs under a single parent Item ID. |
| 2026-02-20 | Bug Fix | Resolved duplicate WebRTC connection initialization bug. Pushed network singletons outside React component scope to mitigate React Strict Mode remount issues. |
| 2026-02-20 | Home Page Redesign | Masonry board layout (CSS columns), bottom-pinned Gemini-style input bar, Google Keep-style detail modal with text truncation, attachment downloads, and "Download All". New component: `ItemDetailModal.tsx`. |
| 2026-02-21 | UI/UX | Created "How It Works" Onboarding Component for the initial empty board state. |
| 2026-02-21 | Feature | Added global "Delete Item" functionality broadcasting across the WebRTC network. |
| 2026-02-21 | Bug Fix | Fixed cross-browser sync and file persistence (base64 data URI conversion, proper data channel timing). |
| 2026-02-21 | UI/UX | Mobile Responsiveness completed (layout looks perfect on mobile devices). |
| 2026-02-21 | Feature | v2: Private Sync Mode implemented using Supabase Realtime Database. Redesigned Auth Page built. |
| 2026-02-21 | Integration | Google OAuth configured properly complete with API callback route exchanging the code for a browser session. |
| 2026-02-21 | UI/UX | Refactored `HowItWorks` onboarding into `PublicHowItWorks` and `PrivateHowItWorks` to fix staggered animation variants and CSS overflow layout bugs. Built new tabbed onboarding modal in `Header.tsx`. |
| 2026-02-21 | Security | Migrated entirely away from legacy Supabase `ANON_KEY` to modern `PUBLISHABLE_KEY` patterns across SSR, Middleware, and Client configurations for security and rotation support. |
| 2026-02-21 | Bug Fix | Resolved Production Login Redirect loop by implementing standard Next.js `new URL(request.url)` parsing inside the `auth/callback` route, ensuring OAuth tokens are sent to Vercel domains correctly. |
| 2026-02-21 | Bug Fix | Diagnosed missing Realtime `DELETE` propagation for Private Mode. Used Supabase MCP to remotely run `ALTER TABLE private_items REPLICA IDENTITY FULL`, fixing RLS filter webhook drops instantly. |
| 2026-02-21 | Bug Fix | Fixed Masonry Grid layout bug where empty states triggered a `justify-center` flex collapse by decoupling grid loading from generic item states, restoring "Google Keep" style masonry anchoring. |
| 2026-02-21 | Optimization | Implemented instant 'Optimistic' UI Updates for sending and deleting Private Items so the UI reflects changes instantly before the websocket response fires. |

## In Progress

| Feature | Status | Notes |
|------|--------|-------|
| Stabilization | 🟢 Active | Monitoring for any edge cases in Private Sync Mode transitions. |

## Future Versions

| Version | Features |
|---------|----------|
| v3 | Device-to-device direct send (AirDrop-style targeting over LAN) |
| v4 | Native apps (Android, Windows, Linux) via React Native / Electron or Tauri |

---

## How to Update This File

**INSTRUCTION FOR AI AGENTS:**
- When you **start** a new phase or task, move it from "Planned" to "In Progress."
- When you **complete** a task, move it to "Completed" with the date and a short summary.
- When new phases or features are added, append them to the appropriate section.
- Keep entries brief — one line per item. Link to relevant files or PRs if applicable.
