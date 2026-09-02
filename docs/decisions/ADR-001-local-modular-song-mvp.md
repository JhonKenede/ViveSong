# ADR-001: Local Modular Song MVP

## Status
Accepted

## Date
2026-09-02

## Context
ViveSong is currently a Vite React application with TypeScript, localStorage persistence, and no backend, database, or real authentication layer. The requested feature set includes group isolation and role-based permissions that must eventually be enforced on a server.

## Decision
Keep the current frontend monolith and extend it as a modular local MVP. Domain logic for songs, ChordPro import/export, transposition, setlists, storage migration, and permissions remains in `src/lib`. The UI consumes those modules from `src/App.tsx` and `src/components`.

Group and role behavior is represented with a local `UserSession` and pure permission helpers. This gives the app usable MVP behavior and tests without pretending that client-side checks are real security.

## Alternatives Considered

### Add a backend now
This would allow real server-side authorization and group isolation, but the repository has no backend foundation, database migrations, auth provider, environment configuration, or deployment target. Adding all of that in one pass would be a large product and infrastructure decision.

### Keep only UI-level checks
This would be faster, but it would scatter permission logic inside components and make future backend integration harder.

## Consequences
- The app supports import, edit, archive, duplicate, export, and local role behavior now.
- Existing local data is migrated when loaded from localStorage.
- Permission tests document intended behavior, but real data protection still requires a server.
- A future backend should enforce the same permission and group checks using these interfaces as the contract.
