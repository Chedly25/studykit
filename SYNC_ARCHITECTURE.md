# Real-Time Sync Architecture — Design Spec

> **Status:** Design only — not implemented yet.
> **Estimated effort:** 2-3 dedicated implementation sessions.

---

## Current Limitations

- Full profile export every 5 min (25MB max)
- No incremental change tracking
- No conflict resolution
- Pull only on app open

---

## Target Architecture

### Cloudflare Durable Objects — one DO per user profile

```
Client A (phone)  ──┐
                    ├──→ Durable Object (profile-{userId}-{profileId})
Client B (laptop) ──┘         │
                              ├── In-memory state: last-write timestamps per table
                              ├── Storage: incremental change log
                              └── WebSocket: push notifications to connected clients
```

---

## Change Tracking

- Add `_syncVersion: number` field to all major tables (topics, flashcards, exercises, etc.)
- Client tracks `lastSyncVersion` per table
- On write: increment `_syncVersion`, record change in local `syncQueue` table
- **Push:** send only records where `_syncVersion > lastPushed`
- **Pull:** request records where server `_syncVersion > lastPulled`

---

## Conflict Resolution

- **Last-write-wins** with field-level merging
- Timestamps on each record (`updatedAt` already exists on most tables)
- If same record modified on both devices: merge by field, newest wins per field
- Deletions tracked via **tombstones** (soft delete with `_deletedAt` field)

---

## Real-Time Notification

- DO opens WebSocket to connected clients
- On change received from Client A: notify Client B via WebSocket
- Client B pulls delta on notification
- Heartbeat every 30s to keep connection alive

---

## Migration Path

1. Add `_syncVersion` to tables (DB version bump)
2. Build `syncQueue` table for pending changes
3. Create DO class + API endpoints (`/api/sync/push`, `/api/sync/pull`, `/api/sync/ws`)
4. Replace `useCloudSync` push/pull with incremental sync
5. Add WebSocket connection for live updates

---

## Security

- All sync endpoints require valid Clerk JWT
- DO scoped to `userId:profileId` — no cross-user access
- Rate limit: max 60 sync ops/minute per user
- WebSocket authenticated on connect, re-validated on each message

---

## Schema Changes Required

```typescript
// Added to all syncable tables:
interface Syncable {
  _syncVersion: number    // auto-incremented on write
  _deletedAt?: string     // tombstone for soft deletes
}

// New table:
interface SyncQueue {
  id: string
  table: string           // e.g. 'topics', 'flashcards'
  recordId: string
  operation: 'put' | 'delete'
  syncVersion: number
  createdAt: string
}

// New table:
interface SyncState {
  id: string              // table name
  lastPushedVersion: number
  lastPulledVersion: number
}
```

---

## Open Questions

1. **Offline duration limit** — how long can a client be offline before a full re-sync is needed?
2. **Large file sync** — PDF blobs in `documentFiles` are too large for incremental sync. Keep separate?
3. **Multi-profile sync** — one DO per profile or one per user with sub-routing?
