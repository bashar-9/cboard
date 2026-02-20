# Project Documentation & Memory

## Overview
A local network text and file sharing service (similar to Apple's Universal Clipboard/AirDrop). It allows devices on the same local network to share text and files in real-time via a web browser.

## Core Architecture & Tech Stack
- **Framework:** Next.js (App Router)
- **Deployment:** Vercel
- **Styling:** Tailwind CSS + Shadcn/ui
- **State Management:** Zustand
- **Networking/Data Transfer:** WebRTC (Peer-to-Peer) for direct, serverless file/text transfer on the local network.
- **Signaling:** Pusher Channels (or similar lightweight WebSocket service) for initial device discovery and WebRTC handshake.

## Key Mechanisms
### 1. Peer Discovery & Grouping
- **Primary (Internet Available):** Users are grouped automatically based on their public IP address. Devices with matching public IPs are placed in the same signaling "room."
- **Fallback (No Internet):** A "Local First" approach. Device A displays a QR code containing its local IP address. Device B scans it to connect directly over the local Wi-Fi router.

### 2. Data Transfer
- All file and text transfers occur over WebRTC Data Channels.
- Files never touch Vercel's servers, ensuring zero bandwidth cost for transfers, unlimited file sizes (dictated by device memory), and strict privacy.
- The web app operates as a Progressive Web App (PWA) so it can load from the device cache when offline.

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
- **Interactions:** 
  - Smooth transitions (150-300ms) for all state changes.
  - Hover states on interactive elements without layout shifts.
  - No emojis for UI elements; use crisp SVG icons (e.g., Lucide).
- **Typography & Layout:** 
  - Standardized max-width containers.
  - Generous padding and legible, accessible contrast ratios (minimum 4.5:1).
  - Clear, readable typography (e.g., Inter or a similar modern sans-serif).

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
