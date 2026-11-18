# Security Specification — APEX DROP 30 & /kontrol

## 1. Data Invariants
1. **Super Admin Authority**: Only `ismailkozak2026@gmail.com` with `request.auth.token.email_verified == true` holds `isAdmin()` privilege. No user can self-assign admin status or mutate `game_config/live` or `admin_logs`.
2. **Player Identity & PII Isolation**: `/players/{playerId}` contains `email` (PII). Reads (`get`) are strictly restricted to `request.auth.uid == playerId` or `isAdmin()`. `list` queries on `/players` are strictly restricted to `isAdmin()`.
3. **Immutable Audit Trail**: `/admin_logs/{logId}` is append-only by `isAdmin()`, requiring `adminEmail == request.auth.token.email` and `createdAt == request.time`. Updates and deletes on `admin_logs` are unconditionally denied.
4. **Anti-Tamper Moderation & Stats**: Players cannot unban themselves (`existing().status == 'banned'` blocks self-updates), cannot mute/unmute themselves, and cannot inject ghost fields or unbounded stat jumps.
5. **Singleton Live Config**: Only `/game_config/live` may be written by `isAdmin()` with strict numerical bounds (`50 <= startingHp <= 300`, `0 <= startingShield <= 200`, `0.3 <= zoneShrinkSpeed <= 3.0`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Admin Email Spoof**: User with `email: "ismailkozak2026@gmail.com"` and `email_verified: false` tries to write `game_config/live` -> `PERMISSION_DENIED`.
2. **Non-Admin Config Tamper**: Authenticated non-admin player writes `game_config/live` -> `PERMISSION_DENIED`.
3. **PII Blanket Read**: Authenticated player A attempts `get(/players/playerB)` -> `PERMISSION_DENIED`.
4. **PII Collection Scrape**: Authenticated player A attempts `list(/players)` -> `PERMISSION_DENIED`.
5. **Self-Unban Escalation**: Banned player updates own `/players/{uid}` setting `status: "active"` -> `PERMISSION_DENIED`.
6. **Self-Mute Bypass**: Muted player updates own `/players/{uid}` setting `muted: false` -> `PERMISSION_DENIED`.
7. **Shadow Ghost Field Injection**: Player creates/updates `/players/{uid}` with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
8. **Stat Overflow Tamper**: Player updates `wins: 9999` in a single match update -> `PERMISSION_DENIED`.
9. **ID Poisoning**: Player tries to create `/players/../../etc/passwd` or 200-char ID -> `PERMISSION_DENIED`.
10. **Out-of-Bounds Config**: Admin or attacker tries `startingHp: 9999` or `zoneShrinkSpeed: 50` -> `PERMISSION_DENIED`.
11. **Audit Log Forgery / Deletion**: Non-admin writes `admin_logs`, or anyone tries to `update`/`delete` an existing `admin_logs` doc -> `PERMISSION_DENIED`.
12. **Client Timestamp Spoof**: Client submits `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
