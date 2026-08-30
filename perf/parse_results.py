#!/usr/bin/env python3
"""Parse k6 raw JSONL output into summary.json (same schema as handleSummary)."""
import json
import sys
import statistics
from datetime import datetime, timezone

def pct(sorted_vals, p):
    if not sorted_vals:
        return None
    idx = min(len(sorted_vals) - 1, int(round(p / 100 * (len(sorted_vals) - 1))))
    return sorted_vals[idx]

def main(raw_path, out_path):
    points = {}   # metric -> list of values
    counters = {} # metric -> last counter values
    thresholds = {}
    meta = {}
    with open(raw_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            t = obj.get('type')
            if t == 'Point':
                m = obj.get('metric')
                v = obj['data'].get('value')
                if m and v is not None:
                    points.setdefault(m, []).append(v)
            elif t == 'Metric':
                d = obj.get('data', {})
                m = d.get('name') or obj.get('metric')
                if d.get('type') == 'counter':
                    counters[m] = d.get('values', {})
                if d.get('thresholds'):
                    thresholds[m] = [{'ok': x.get('ok'), 'source': x.get('source')} if isinstance(x, dict)
                                     else {'ok': None, 'source': x} for x in d['thresholds']]

    def stats(name):
        vals = sorted(points.get(name, []))
        if not vals:
            return {'count': 0}
        return {
            'count': len(vals),
            'avg_ms': statistics.fmean(vals),
            'min_ms': vals[0],
            'med_ms': statistics.median(vals),
            'max_ms': vals[-1],
            'p90_ms': pct(vals, 90),
            'p95_ms': pct(vals, 95),
            'p99_ms': pct(vals, 99),
        }

    endpoint_meta = {
        'landing': ('GET', '/'),
        'me': ('GET', '/api/v1/me'),
        'tenants': ('GET', '/api/v1/tenants'),
        'seminars': ('GET', '/api/v1/seminars'),
        'networking': ('GET', '/api/v1/networking'),
        'networking_history': ('GET', '/api/v1/networking/history'),
        'booth_stats': ('GET', '/api/v1/booth/stats'),
    }

    endpoints = {}
    for name, (method, path) in endpoint_meta.items():
        s = stats(f'trend_{name}')
        fails = points.get(f'fail_{name}', [])
        endpoints[name] = {
            'method': method, 'path': path,
            **s,
            'fails': sum(1 for v in fails if v == 1),
            'fail_rate': (sum(1 for v in fails if v == 1) / len(fails)) if fails else 0,
        }

    agg = stats('http_req_duration')
    failed_pts = points.get('http_req_failed', [])
    failed_rate = (sum(1 for v in failed_pts if v == 1) / len(failed_pts)) if failed_pts else 0

    total = counters.get('http_reqs', {}).get('count', sum(e['count'] for e in endpoints.values()))

    summary = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'base_url': 'https://bni-natcon.reddie.id',
        'scenario': 'ramping-vus 0→10→30→30→0 (total 105s)',
        'total_requests': total,
        'aggregates': {**agg, 'failed_rate': failed_rate},
        'thresholds': thresholds,
        'endpoints': endpoints,
    }
    with open(out_path, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f"summary.json ditulis: {out_path}")
    print(f"total requests: {total}, failed_rate: {failed_rate:.4f}")

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
