# ADR-002: Supabase Shared Backend

## Status
Accepted

## Date
2026-09-02

## Context
ViveSong needs to be tested by a worship group outside the developer's local network, often through mobile data. The previous localStorage-only model cannot share songs or setlists between devices and cannot enforce group permissions.

## Decision
Use Supabase as the shared backend for the MVP. The frontend talks to Supabase through `src/lib/supabaseRepository.ts`, keeping database details out of React components. The schema lives in `supabase/migrations/001_vivesong_core.sql`.

The backend model uses Supabase Auth, Postgres tables, and Row Level Security:
- `groups` and `group_members` define workspace access.
- `songs`, `setlists`, and `setlist_songs` are scoped by group.
- Admins and editors can write songs and setlists.
- Musicians can read and transpose in their personal view.
- Only admins can hard-delete songs.

## Alternatives Considered

### Self-hosted API
A custom API would give full control, but it would add hosting, auth, deployment, database migrations, and operational work before the group can test the app.

### Public API without authentication
This would be faster but unsafe. Anyone with the frontend key could access or mutate data if RLS was not enforced.

## Consequences
- The group can test from mobile data using a deployed frontend and Supabase.
- Security rules live in the database, not only in the UI.
- The app still supports localStorage fallback when Supabase is not configured.
- Future work should add member management screens and deployment environment configuration.
