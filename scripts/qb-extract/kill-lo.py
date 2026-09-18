#!/usr/bin/env python3
"""
清理本流水线残留的 LibreOffice 进程。

两个必须遵守的要点 (都是踩过的坑):
  1. 按「可执行文件路径前缀」匹配, 不能用 `pkill -f 'pattern'` ——
     如果当前命令行里恰好也含该 pattern, pkill 会把调用者自己一起杀掉。
  2. 必须先杀 oosplash, 再杀 soffice.bin。只杀 soffice.bin 会让 oosplash
     立刻重新拉起一个 soffice 重试同一个文件, 表现为「永远卡在同一批」。

用法:
  python3 kill_lo.py            # 只清转换用 profile (lo-profile/w*)
  python3 kill_lo.py --all      # 连 HTML 渲染用 profile (lo-profile/html*) 一起清
"""
import os
import signal
import subprocess
import sys
import time

LO_PREFIXES = ('/usr/lib/libreoffice/program/oosplash',
               '/usr/lib/libreoffice/program/soffice.bin',
               '/usr/lib/libreoffice/program/soffice')
SCOPE = 'all' if '--all' in sys.argv else 'w'


def targets():
    """返回 [(pid, args)], 只含 args 以 LibreOffice 可执行路径开头的进程"""
    out = subprocess.run(['ps', '-eo', 'pid,args'], capture_output=True, text=True).stdout
    res = []
    for line in out.splitlines()[1:]:
        parts = line.strip().split(None, 1)
        if len(parts) < 2:
            continue
        pid, args = parts
        if not args.startswith(LO_PREFIXES):
            continue
        if 'lo-profile/' not in args:
            continue
        if SCOPE == 'w' and 'lo-profile/w' not in args:
            continue
        try:
            res.append((int(pid), args))
        except ValueError:
            pass
    return res


def kill_all():
    # 先 oosplash (父), 再 soffice.bin (子)
    ts = targets()
    ts.sort(key=lambda x: 0 if 'oosplash' in x[1] else 1)
    for pid, args in ts:
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    return ts


total = []
for _ in range(4):
    killed = kill_all()
    total += killed
    if not killed:
        break
    time.sleep(1.5)

print(f'清理 {len(total)} 个进程 (scope={SCOPE}):')
for pid, args in total:
    tag = args.split('lo-profile/')[-1].split()[0]
    kind = 'oosplash' if 'oosplash' in args else 'soffice.bin'
    print(f'  {pid} {kind} [{tag}]')
left = targets()
print(f'剩余: {len(left)}')
for pid, args in left:
    print(f'  仍存活 {pid} {args[:100]}')
sys.exit(0 if not left else 1)
