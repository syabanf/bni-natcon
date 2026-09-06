# BNI Natcon 2026 — Pre-event check, 1 September 2026 (H-2)

> Follow-up to `2026-08-27-event-readiness.md`. Same host, same path
> (`bninatcon.com` → Cloudflare → `tunnel-wit`/`tunnel-wit-2` → nginx → Go API → Postgres 16).

## Verdict

The natcon stack itself is fast and idle: during a 1,000-attendee rehearsal the API
served 19,183 requests at **p50 1.1 ms / p95 1.9 ms / p99 3.1 ms**, the database is
10 MB and fully indexed, both API replicas sit at ~10 MB RSS. What can take the day
down is the **host**, not the app:

1. **The host rebooted at 16:13 today** after several minutes of critical memory
   pressure (`journald: Under memory pressure, flushing caches` ×8, hermes
   `system memory pressure is critical`). Every natcon container went with it.
   The previous boot logged 133 OOM kills. Neighbours on the same box: GitLab
   (native, ~7 GB: 4 puma workers × 1.1 GB + java), Penpot (2.3 GB), two Plane
   instances (~2.7 GB), Firefox on the desktop session (1.7 GB), 104 containers.
2. **An autonomous agent (OpenClaw `main`) deploys to production on its own.**
   It ran `git pull && docker compose up -d --build` at 16:07, 16:20 and 17:50
   today — the last one in the middle of the load test, which is where the
   49 × 502 and p95 242 ms in the first run came from. After each deploy it also
   "resets drift": placeholder passwords, `consent = NULL`, **deletes seminar
   registrations**, restarts the API. On 3 September that routine would erase
   real attendee data.

## Rehearsal (clean run, after the fixes below)

`PEAK=1000 RAMP=20s HOLD=60s`, through the public tunnel, from this host.

| Metric | 27 Aug | 1 Sep (clean) |
|---|---|---|
| Throughput | 266 req/s | 259 req/s |
| p95 / p99 | 51 / 56 ms | 126 / 255 ms |
| Failures | 0 / 39,868 | **0 / 20,736** |
| API-side p99 (chi logger) | — | 3.1 ms |

The extra latency is the Cloudflare ↔ tunnel round trip, not the origin (the load
generator shares the host's uplink with the origin, so this is pessimistic).

## Changed today

| Change | Why | Proof |
|---|---|---|
| `frontend/admin/door nginx.conf`: `Cache-Control` by path — `/assets/*` (content-hashed) `immutable, 1y`; HTML `no-cache`; photos/logos 1 h; proxied paths untouched | Cloudflare's default (no header → 4 h for everything) cached HTML for 4 h and the immutable bundle for only 4 h — a stale index after a deploy = blank page | `curl -I` public: `/` → `no-cache`, `/assets/index-*.js` → `immutable`, `cf-cache-status: HIT` |
| gzip on the three nginx tiers | Main bundle 334 KB → 100 KB over the tunnel | `content-encoding: gzip`, 100,068 B |
| `docker-compose.yml`: json-file log rotation 50 MB × 5 on all six services | Every request is logged; ~2 GB/container/day uncapped; host was 86 % full once | `docker inspect … LogConfig` |
| `natcon-lb`: `cpu_shares 4096`, `mem_limit 256m`, `oom_score_adj -600` | It is the only way to the API and had no posture at all | `docker inspect natcon-lb` |
| `natcon-db` port bound to `127.0.0.1:5436` | Was `0.0.0.0` (LAN-exposed). Backups use `docker exec`; nothing needs the LAN | `docker port natcon-db` |

Also verified: `tunnel-wit-2` replica now exists (open item from 27 Aug — closed);
backups landing every 15 min (`natcon-db-20260901-173001.sql.gz`), 38 booths /
865 members / 4 seminars / 90 tables in the DB.

## Must do before 3 September (needs sudo, a dashboard, or a decision)

1. **Code + deploy freeze from the evening of 2 Sep.** Tell the OpenClaw agent
   (and everyone with a shell) that natcon is frozen: no `compose up --build`, no
   "drift reset", no DB restore during the event. Every rebuild is a 502 blip
   for the whole hall; a drift reset is data loss.
2. **Free memory on the host for the day** — the reboot was memory, and natcon's
   negative `oom_score_adj` does not help when the whole box locks up:
   `sudo gitlab-ctl stop` (~7 GB), `docker stop penpot-backend penpot-frontend
   penpot-exporter` (~2.4 GB), `docker compose -f …/plane-app-cek stop` (~2.7 GB),
   close Firefox on the desktop (1.7 GB). Optionally `sudo apt install earlyoom`
   so a runaway process is killed before the host thrashes.
3. **Uptime Kuma has no monitor for natcon** (25 monitors, none of them). Add
   `https://bninatcon.com/api/v1/public/agenda` at 60 s with the existing
   Telegram notifier.
4. **Cloudflare ingress `api.bninatcon.com → http://natcon-api:8080` is dead**
   (that name no longer exists; the API is behind `natcon-lb`). Nothing in the
   apps uses it, but fix it to `http://natcon-lb:80` or delete it.
5. **Commit and push the four files above** so the agent's next `git pull` does
   not fight the working tree.
