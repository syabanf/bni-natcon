# Event-day rehearsal harness

Load harness for **3 September 2026** (~1,000 attendees, one day). It drives the
real public path — client → Cloudflare edge → cloudflared tunnel → nginx → Go
API → Postgres — because the earlier suites in `scripts/` test the API directly
and therefore never exercise the tunnel, which is the only hop with a history of
dropping connections.

## Why tokens are minted instead of logged in

k6 cannot log 1,000 attendees in. Login is rate-limited per client IP, and
Cloudflare rejects a spoofed `CF-Connecting-IP` with 403, so every request from
the load generator counts as one IP no matter what headers it sends. Signing
tokens with the server's own secret sidesteps login and leaves the limiter free
to be tested separately (see "Rate limiter" below). `scripts/stress.py` does the
same thing for the same reason.

`tokens.json` holds valid credentials for this deployment. It is gitignored.
Delete it after a rehearsal.

## Running it

```bash
python3 perf/eventday/mint-tokens.py --count 1000
BASE=https://bninatcon.com k6 run perf/eventday/eventday.js
```

| Variable | Default | Meaning |
|---|---|---|
| `BASE` | `https://bninatcon.com` | Target. Use `http://127.0.0.1:8088` to measure without the tunnel. |
| `PEAK` | `1000` | Attendees in the hall. Request rates derive from this. |
| `RAMP` / `HOLD` | `30s` / `2m` | Ramp-up and steady-state duration. |
| `WRITE` | unset | `1` adds booth scans and seminar check-ins. **Inserts rows — scratch stacks only.** |

## The load model

Peak load on the day is not login, it is polling. `Networking.jsx` refetches the
table every 5 s while an attendee is seated and the session clock every 20 s, so
1,000 attendees generate `1000/5 + 1000/20 = 250 req/s` on their own — an order
of magnitude more than the registration rush.

| Scenario | Rate at PEAK=1000 | Role | Endpoint |
|---|---|---|---|
| `networking_table` | 200/s | member | `GET /networking` |
| `networking_clock` | 50/s | member | `GET /networking/session` |
| `browsing` | 30/s | member | `/me`, `/seminars`, `/tenants`, `/rundown`, `/networking/history` |
| `booth_crew` | 8/s | tenant | `/booth`, `/booth/stats`, `/booth/visitors` |
| `committee` | 4/s | admin | `/admin/overview`, `/admin/tenants`, `/admin/activity`, `/admin/tables/seats` |
| `booth_scan` (WRITE) | 5/s | tenant | `POST /scans` |
| `door_checkin` (WRITE) | 3/s | door | `POST /admin/seminars/{id}/checkin` |

The four roles are not interchangeable: members own `/networking`, booth crews
own `/scans`, door staff own seminar check-in, and only admin sees
`/admin/overview`. A rehearsal that mints one role tests one seventh of the day.

## Measured, 27 August 2026

| Run | Throughput | p95 | p99 | Failures |
|---|---|---|---|---|
| Event-day peak (`PEAK=1000`) | 266 req/s | 51 ms | 56 ms | 0 / 39,868 |
| Headroom (`PEAK=4000`) | 1,005 req/s | 51 ms | 58 ms | 0 / 80,434 |

Latency is flat between the two, so the knee is above 4× the expected peak.
During the peak run `natcon-api` used ~20 % of one core and 20 MB of its 2 GB
limit; `natcon-db` used ~10 % and 60 MB. The constraint on the day will not be
this server.

## Rate limiter

The limiter is deliberately *not* exercised by this harness — all its traffic
comes from one IP and would be throttled by design. Test it separately:

```bash
# many attendees, distinct IPs — expect no 429
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8088/api/v1/auth/login \
    -H 'Content-Type: application/json' -H "CF-Connecting-IP: 203.0.113.$i" \
    -d '{"email":"x@invalid.local","password":"x"}'
done | sort | uniq -c

# one attacker, one IP — expect 429 past LOGIN_RATE_PER_MIN
```

Ceilings are `LOGIN_RATE_PER_MIN` (200) and `RECOVERY_RATE_PER_MIN` (60), both
env-tunable on the API container without a rebuild. They are sized for a hall
behind one NAT address, not for one honest user.
