# BNI Natcon 2026 — Event Readiness Review

> Date: 2026-08-27 · Event: **3 September 2026** (~1,000 attendees, one day)
> Host: WITServerUtama (AMD Ryzen 9 3900X, 12C/24T, 31 GB RAM) · Path:
> `bninatcon.com` → Cloudflare → `tunnel-wit` → nginx `:8088` → Go API → Postgres 16

## Verdict

The server is not the risk. At the modelled event-day peak the API used ~20 % of
one core; the stack absorbed **4× that load with no measurable latency change**.
The one finding that would have broken the day was a configuration defect in the
login rate limiter, now fixed and verified.

## 1. Critical — login rate limiter was shared by every visitor on earth

**Symptom.** After 10 logins in any minute, every further attendee received
HTTP 429 — for the whole event, not per person.

**Cause.** Three links in a chain:

1. `nginx` forwarded `X-Real-IP $remote_addr`, but with Cloudflare Tunnel
   `$remote_addr` is the *cloudflared container's* address (`172.27.0.6`),
   identical for every visitor.
2. chi's `middleware.RealIP` prefers `X-Real-IP` over `X-Forwarded-For`, so the
   real address in XFF was discarded. Verified directly: XFF alone resolved to
   `1.2.3.4`; XFF plus `X-Real-IP` resolved to the `X-Real-IP` value.
3. `httprate.LimitByIP(10, time.Minute)` therefore keyed one bucket globally.

**Reproduction (before).** Fourteen distinct attendees against the production
config: `401 ×10`, then `429 ×4`.

**Fix.**

- `frontend/`, `admin/`, `door/` `nginx.conf`: `X-Real-IP` now carries
  `$http_cf_connecting_ip`, via a `map` that falls back to `$remote_addr` for
  direct/local access — an *empty* `X-Real-IP` would collapse everyone into one
  bucket again, which is the same bug wearing a different hat.
- Ceilings raised and made env-tunable: `LOGIN_RATE_PER_MIN` (default 200),
  `RECOVERY_RATE_PER_MIN` (default 60). Conference WiFi puts the whole hall
  behind one NAT address, so the ceiling is shared by everyone on that network
  and must clear a registration rush, not one honest user. Recovery stays
  tighter because it is guessable by design (chapter + phone).

**Verification (after).**

| Check | Result |
|---|---|
| API sees real client IP through the tunnel | `182.253.176.163` (was `172.27.0.6`) ✅ |
| 25 distinct attendees log in | 25 × 401, zero 429 ✅ |
| Brute force from one IP | 200 × 401 then 429 ✅ |
| Recovery from one IP | 60 × 401 then 429 ✅ |
| `go vet` · `go build` · `go test ./...` | all pass ✅ |

## 2. `natcon-door` had no restart policy

The door app — the QR scanner the arrival crew uses on every attendee — was the
only service left at `restart: no`, so a crash or reboot would have taken it
away with nothing to bring it back. Now `unless-stopped`, matching the rest.

## 3. Disk and OOM exposure

Root was 86 % full and swap was 100 % consumed, on a host that OOM-killed 73
processes in the preceding 30 days. Reclaimed **150 GB** (137 GB Docker build
cache + 13 GB dangling images); root is now **55 %** (198 GB free).

Because ~89 containers share this host, the natcon services now declare their
own posture: `cpu_shares` 4096 (api, db) / 2048 (web tier) to win CPU
contention, `mem_limit` as a runaway backstop, and a negative `oom_score_adj`
(-700 db, -600 api, -400 web) so the kernel reaches for a neighbour first.

## 4. Backups

`docker-infra/natcon-backup.sh`, every 15 minutes via cron, 7-day retention.
Dumps land under a `.partial` name and are promoted only after the
`PostgreSQL database dump complete` trailer is confirmed, so an interrupted dump
can never be mistaken for a usable snapshot.

**Restore was tested, not assumed** — restored into a scratch database and
compared row counts: `users` 808, `tenants` 36, `seminars` 4, `visits` 0,
`seminar_registrations` 0, `networking_checkins` 0 — all matching.

Fifteen minutes is the chosen data-loss ceiling: a scan or check-in that is lost
cannot be reconstructed, because the attendee has already walked away.

## 5. Event-day load rehearsal

New harness at `perf/eventday/` (see its README). It drives the **real public
path**; the existing suites in `scripts/` hit the API directly and never
exercise the tunnel.

The dominant load is polling, not login: `Networking.jsx` refetches every 5 s
while seated and the session clock every 20 s, so 1,000 attendees generate
~250 req/s before anyone logs in or scans anything.

| Run | Throughput | p95 | p99 | Failures |
|---|---|---|---|---|
| Event-day peak (`PEAK=1000`) | 266 req/s | 51 ms | 56 ms | 0 / 39,868 |
| Headroom (`PEAK=4000`) | 1,005 req/s | 51 ms | 58 ms | 0 / 80,434 |

Latency is flat across a 4× range, so the knee sits above 4× expected peak.
Server during the peak run: `natcon-api` ~20 % of one core / 20 MB, `natcon-db`
~10 % / 60 MB, system load 1.5–2.1 on 24 threads.

This also corrects the 2026-08-26 figure of ~58 req/s for the tunnel. That
number was the Python test client's ceiling, not the tunnel's: a direct k6 probe
sustained 702 req/s at p99 57 ms, and 1,000 requests at 100-way concurrency
returned zero errors.

## 6. Uploads volume

`docker-infra/natcon-uploads-backup.sh`, hourly, 14-day retention, writing a
snapshot only when the content fingerprint changes. Restore verified by
extracting into a scratch volume and comparing file contents.

Worth recording why this is separate from the database script: the speaker
photos and covers that ship with the app live in `admin/public/speakers/` and
are baked into the image at build time, so they are already in version control.
The volume holds only what the admin panel uploads after deploy — currently
nothing. It changes rarely, so an hourly no-op is cheaper than another
15-minute tarball.

The first version of that script used `find -printf`, which busybox does not
implement. The listing came back empty, its md5 was a constant, and the script
reported "unchanged" forever — a backup that silently never runs. It now uses
`stat -c` and requires a `COUNT:` marker in the probe output, so a broken probe
fails loudly instead of claiming nothing happened.

## Still open — needs a decision or a password

- **Second `cloudflared` replica.** `tunnel-wit` is a single instance started
  with `docker run`; its token exists only inside the container, with no config
  file anywhere on disk. Creating a replica means handling that credential, so
  it is left for a human to run (command in the handover notes). The tunnel logs
  show QUIC connections dropping and re-registering on 25 and 26 August.

- **Swap is 100 % consumed (8 GB), but this is not the danger it looks like.**
  The occupants are cold pages from idle neighbours — uvicorn 503 MB, GitLab's
  java 347 MB and ruby 310 MB, seven celery workers at 142 MB each. There is no
  active pressure: PSI memory reads 0.00 across all windows and `vmstat` shows
  si/so at zero. Those pages are *correctly* swapped out; having them there is
  what keeps 12 GB of RAM available.

  The 73 OOM kills in the preceding 30 days trace to a runaway `next-server`
  that reached 10.7 GB RSS on 13 August — an application bug, not a capacity
  shortfall. So the useful mitigation is headroom, not reclamation:
  **adding an 8 GB swapfile is lower risk than `swapoff -a && swapon -a`**,
  which would have to pull 8 GB back into 12 GB of available RAM and can stall
  the host while it does. Either way natcon is already insulated by its negative
  `oom_score_adj`.
