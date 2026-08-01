#!/usr/bin/env python3
"""web_fetch.py — 调 Windows PowerShell 抓 URL, 绕过 WSL DNS 隔离

Usage:
  python3 scripts/web_fetch.py <url> [--max-bytes N] [--timeout 15]
"""
import argparse, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PS1 = os.path.join(HERE, 'web_fetch.ps1')

def main():
    p = argparse.ArgumentParser()
    p.add_argument('url')
    p.add_argument('--max-bytes', type=int, default=5*1024*1024)
    p.add_argument('--timeout', type=int, default=15)
    args = p.parse_args()

    cmd = ['powershell.exe', '-NoProfile', '-NoLogo', '-NonInteractive',
           '-ExecutionPolicy', 'Bypass',
           '-File', PS1,
           '-Url', args.url, '-TimeoutSec', str(args.timeout),
           '-MaxBytes', str(args.max_bytes)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=args.timeout + 10)
    out = r.stdout.strip()
    if not out:
        sys.stderr.write(f"PowerShell no output. stderr: {r.stderr[:300]}\n")
        sys.exit(1)
    try:
        data = json.loads(out)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except json.JSONDecodeError as e:
        sys.stderr.write(f"JSON decode fail: {e}\n")
        sys.stderr.write(f"raw stdout: {out[:500]}\n")
        sys.exit(2)

if __name__ == '__main__':
    main()
