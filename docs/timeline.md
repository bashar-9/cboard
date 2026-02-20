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
| 2026-02-20 | Phase 5 — Network Debugging | Fixed WebRTC glare state errors via Perfect Negotiation |
| 2026-02-20 | Deployment Preparation | Pushed repository to GitHub as CBoard |

## In Progress

| Task | Status | Notes |
|------|--------|-------|
| Phase 6 — File Transfers | 🟢 Active | Need to extend WebRTC Core and UI to support large file chunking and drag-and-drop. |

## Future Versions

| Version | Features |
|---------|----------|
| v2 | Device-to-device direct send (AirDrop-style targeting) |
| v3 | Private mode with authentication |
| v4 | Native apps (Android, Windows, Linux) via React Native / Electron or Tauri |

---

## How to Update This File

**INSTRUCTION FOR AI AGENTS:**
- When you **start** a new phase or task, move it from "Planned" to "In Progress."
- When you **complete** a task, move it to "Completed" with the date and a short summary.
- When new phases or features are added, append them to the appropriate section.
- Keep entries brief — one line per item. Link to relevant files or PRs if applicable.
