#!/usr/bin/env python3
"""Mint attendee session tokens for the event-day rehearsal.

k6 cannot log 1,000 attendees in: the login endpoint is rate-limited per client
IP, and Cloudflare refuses a spoofed CF-Connecting-IP (it answers 403), so every
request from the load generator counts as one IP no matter what headers we send.
Signing tokens directly with the server's own secret sidesteps login entirely
and leaves the limiter free to be tested on its own.

This mirrors what scripts/stress.py already does for the same reason.

    python3 perf/eventday/mint-tokens.py            # reads .env for JWT_SECRET
    python3 perf/eventday/mint-tokens.py --count 1000

Writes perf/eventday/tokens.json — gitignored, because those are live
credentials for this deployment. Delete it after the rehearsal.
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "perf" / "eventday" / "tokens.json"


def load_env():
    """Real environment wins; otherwise fall back to the repo's .env."""
    env = {}
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("\"'")
    return env


def b64url(raw: bytes) -> bytes:
    return base64.urlsafe_b64encode(raw).rstrip(b"=")


def mint(secret: str, user_id, role: str, ttl: int) -> str:
    """HS256 token in the same shape the backend's JWTIssuer produces."""
    now = int(time.time())
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = b64url(json.dumps(
        {"role": role, "sub": str(user_id), "exp": now + ttl, "iat": now}
    ).encode())
    sig = b64url(hmac.new(secret.encode(), header + b"." + payload,
                          hashlib.sha256).digest())
    return (header + b"." + payload + b"." + sig).decode()


def ids_for(role: str, limit: int):
    """Read real user IDs straight from the running database container."""
    sql = "SELECT id FROM users WHERE role=%s ORDER BY id LIMIT %d;" % (
        "'" + role.replace("'", "''") + "'", limit)
    out = subprocess.run(
        ["docker", "exec", "natcon-db", "psql", "-U", "natcon", "-d", "natcon",
         "-tAc", sql],
        capture_output=True, text=True, check=True).stdout
    return [int(x) for x in out.split() if x.strip().isdigit()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=1000,
                    help="attendee tokens to mint (reuses members if fewer exist)")
    ap.add_argument("--ttl", type=int, default=7200, help="token lifetime, seconds")
    args = ap.parse_args()

    env = load_env()
    secret = os.environ.get("JWT_SECRET") or env.get("JWT_SECRET")
    if not secret:
        sys.exit("JWT_SECRET tidak ditemukan (cek .env atau export JWT_SECRET)")

    members = ids_for("member", args.count)
    if not members:
        sys.exit("tidak ada user role=member di database")
    # Three different crews scan on the day and they do not share a role:
    # booth crews (tenant) run POST /scans, door staff (door) run seminar
    # check-in and goodiebag redemption, the committee (admin) watches the
    # dashboards. Minting only one of them would leave two paths untested.
    admins = ids_for("admin", 4)
    doors = ids_for("door", 4)
    tenants = ids_for("tenant", 40)

    # The hall holds more attendees than the database has seeded members, so
    # wrap around: the API does not care that two virtual phones share a login,
    # and the request mix is what we are measuring.
    attendees = [mint(secret, members[i % len(members)], "member", args.ttl)
                 for i in range(args.count)]

    OUT.write_text(json.dumps({
        "minted_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "attendees": attendees,
        "admins": [mint(secret, i, "admin", args.ttl) for i in admins],
        "doors": [mint(secret, i, "door", args.ttl) for i in doors],
        "tenants": [mint(secret, i, "tenant", args.ttl) for i in tenants],
    }), encoding="utf-8")
    print("OK: %d peserta, %d admin, %d door, %d booth -> %s"
          % (len(attendees), len(admins), len(doors), len(tenants),
             OUT.relative_to(ROOT)))
    print("    (%d member unik di DB, dipakai berulang bila --count lebih besar)"
          % len(members))


if __name__ == "__main__":
    main()
