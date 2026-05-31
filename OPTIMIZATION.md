# Optimization Targets

## Performance Baseline (from BLUEPRINT §12)
- Client-to-client realtime updates: < 500 ms.
- Initial interactive load: < 2.5 s on a typical connection.
- Edge Function authoritative round-trip: < 300 ms typical.
- Scale: rooms of up to 8 players; dozens of concurrent rooms.

## Known Bottlenecks
(none identified yet)

## Refactoring Candidates
(none yet)

## Scaling Notes
- Realtime fan-out is per-room; filters scope subscriptions to `room_id`/`game_id`.
- If concurrent rooms grow, consider Broadcast for high-frequency presence to reduce
  Postgres Changes load.
