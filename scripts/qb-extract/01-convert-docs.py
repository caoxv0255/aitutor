#!/usr/bin/env python3
"""
P1 Stage 01 — .doc → .docx 转换池

背景: database/incoming/gaokao 下 1634 份原卷中 1137 份是 legacy 二进制 .doc
      (Composite Document File V2)，mammoth / python-docx 都读不了。libreoffice 可转。

设计要点:
  * 批量调用 libreoffice (单进程处理多个文件, 避免每文件冷启动)
  * 幂等 + 可续跑: 输出 docx 存在且比源文件新 → 跳过 (mtime+size 指纹存 manifest)
  * 只读源目录, 只写 cache 目录, 不触碰 database/incoming
  * 转换结果做最小校验 (是 zip 且含 word/document.xml), 不合格标 FAILED

用法:
  python3 01-convert-docs.py --dry-run          # 只统计待转换数量
  python3 01-convert-docs.py                    # 全量转换
  python3 01-convert-docs.py --limit 20         # 限量
  python3 01-convert-docs.py --workers 4        # 并行 libreoffice 实例
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from doc_fallback import doc_to_docx_via_ole  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
SRC_ROOT = REPO / 'database' / 'incoming'
CACHE_ROOT = REPO / 'database' / 'preflight' / 'qb-extract'
CONV_DIR = CACHE_ROOT / 'docx-cache'
MANIFEST = CACHE_ROOT / 'convert-manifest.json'
LOGDIR = CACHE_ROOT / 'logs'

BATCH_SIZE = 12          # 每次 libreoffice 调用处理的文件数
BATCH_TIMEOUT = 120      # 单批超时(秒)。实测某些老旧 .doc 会让 soffice 永久挂住,
                         # 设 900s 会让一个坏文件拖死整个 shard 十几分钟。
SINGLE_TIMEOUT = 90      # 批失败后逐文件重试的超时
USER_INSTALL = REPO / 'database' / 'preflight' / 'qb-extract' / 'lo-profile'
FAILED_LIST = CACHE_ROOT / 'convert-failed.json'


def load_failed():
    if FAILED_LIST.exists():
        try:
            return set(json.loads(FAILED_LIST.read_text()))
        except Exception:
            return set()
    return set()


def save_failed(s):
    FAILED_LIST.parent.mkdir(parents=True, exist_ok=True)
    FAILED_LIST.write_text(json.dumps(sorted(s), ensure_ascii=False, indent=1))


def fingerprint(p: Path):
    st = p.stat()
    return {'size': st.st_size, 'mtime': int(st.st_mtime)}


def is_valid_docx(p: Path) -> bool:
    """转换产物最小校验: zip + 含 word/document.xml"""
    try:
        if not zipfile.is_zipfile(p):
            return False
        with zipfile.ZipFile(p) as z:
            return 'word/document.xml' in z.namelist()
    except Exception:
        return False


def target_for(src: Path) -> Path:
    """cache 路径保持相对结构: <subject>/<year>/<stem>.docx"""
    rel = src.relative_to(SRC_ROOT)
    return (CONV_DIR / rel).with_suffix('.docx')


def scan(limit=None):
    todo, done, skipped = [], [], []
    failed = load_failed()
    files = sorted(SRC_ROOT.rglob('*.doc'))
    if limit:
        files = files[:limit]
    for src in files:
        if str(src) in failed:
            skipped.append(src)
            continue
        dst = target_for(src)
        if dst.exists() and dst.stat().st_size > 0 and dst.stat().st_mtime >= src.stat().st_mtime:
            if is_valid_docx(dst):
                done.append(src)
                continue
        todo.append(src)
    return todo, done, skipped


def run_with_timeout(cmd, timeout):
    """启动子进程并限时; 超时则**杀掉整个进程组**。
    为什么不用 subprocess.run(timeout=...): 它超时后只 kill 直接子进程 (oosplash),
    随后 communicate() 会一直等待其退出 —— 而 oosplash 的孙子进程 soffice.bin 可能仍活着并占着
    profile 锁, 于是 run() 永不返回 (实测卡死 5 分钟以上)。
    start_new_session=True 让 oosplash 与 soffice.bin 同属一个新进程组, killpg 一次带走两个,
    同时避免 oosplash 重生 soffice 反复重试同一个坏文件。"""
    import signal
    p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         start_new_session=True)
    try:
        p.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(os.getpgid(p.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError):
            try:
                p.kill()
            except Exception:
                pass
        try:
            p.wait(timeout=15)
        except Exception:
            pass
        return False
    return True


def convert_once(files, worker_id, timeout):
    """一次 libreoffice 调用; 返回 (成功映射 {src: dst}, 未成功列表)"""
    tmp = CONV_DIR / f'_tmp_w{worker_id}'
    if tmp.exists():
        shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True, exist_ok=True)
    profile = USER_INSTALL / f'w{worker_id}'
    cmd = [
        'libreoffice', '--headless', '--norestore',
        f'-env:UserInstallation=file://{profile}',
        '--convert-to', 'docx', '--outdir', str(tmp),
    ] + [str(s) for s in files]
    run_with_timeout(cmd, timeout)
    ok, bad = {}, []
    for src in files:
        produced = tmp / (src.stem + '.docx')
        if produced.exists() and is_valid_docx(produced):
            dst = target_for(src)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(produced), str(dst))
            ok[src] = dst
        else:
            bad.append(src)
    shutil.rmtree(tmp, ignore_errors=True)
    return ok, bad


def convert_batch(batch, worker_id):
    """一个 libreoffice 进程处理一批文件。
    批超时/有失败 → 逐文件重试 (单个坏文件不再连累同批其他文件)。
    仍失败 → olefile 兜底 (LibreOffice 会挂死的 legacy .doc, 直读 OLE 分片表文本)。
    返回 (成功数, 永久失败列表)"""
    for d in {str(target_for(s).parent) for s in batch}:
        os.makedirs(d, exist_ok=True)
    ok, bad = convert_once(batch, worker_id, BATCH_TIMEOUT)
    n_ok = len(ok)
    if bad:
        retry_bad = []
        for s in bad:
            o2, _ = convert_once([s], worker_id, SINGLE_TIMEOUT)
            if o2:
                n_ok += 1
            else:
                # 兜底: LibreOffice 对此文件挂死, 用 olefile 直读文本合成 docx
                try:
                    if doc_to_docx_via_ole(s, target_for(s)):
                        n_ok += 1
                        continue
                except Exception:
                    pass
                retry_bad.append(s)
        return n_ok, retry_bad
    return n_ok, []


def kill_stale_soffice(worker_id):
    """清掉本 worker profile 上残留的 soffice (挂死进程会一直占着 profile 锁)"""
    import signal
    profile_tag = f'lo-profile/w{worker_id}'
    out = subprocess.run(['ps', '-eo', 'pid,args'], capture_output=True, text=True).stdout
    for line in out.splitlines()[1:]:
        parts = line.strip().split(None, 1)
        if len(parts) < 2:
            continue
        pid, args = parts
        if args.startswith('/usr/lib/libreoffice/program/soffice.bin') and profile_tag in args:
            try:
                os.kill(int(pid), signal.SIGKILL)
            except (ProcessLookupError, ValueError):
                pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--limit', type=int)
    ap.add_argument('--workers', type=int, default=4)
    args = ap.parse_args()

    CONV_DIR.mkdir(parents=True, exist_ok=True)
    LOGDIR.mkdir(parents=True, exist_ok=True)
    USER_INSTALL.mkdir(parents=True, exist_ok=True)

    todo, done, _ = scan(args.limit)
    total_doc = len(list(SRC_ROOT.rglob('*.doc')))
    total_docx = len(list(SRC_ROOT.rglob('*.docx')))
    print(f'源目录: {SRC_ROOT}')
    print(f'  .doc  {total_doc} 份')
    print(f'  .docx {total_docx} 份 (无需转换)')
    print(f'  cache 已完成 {len(done)} 份')
    print(f'  待转换      {len(todo)} 份')
    if args.dry_run or not todo:
        if args.dry_run:
            print('\n--dry-run: 不执行转换')
        return

    # 按 worker 分片: 每个 worker 独占自己的 libreoffice profile 并顺序处理自己那一片。
    # 反例(勿用): 用 i % workers 给批次贴 worker id 再并发提交 —— 不同批次可能同时落到
    # 同一个 profile, soffice 的 profile 锁会互相阻塞, 实测吞吐掉到 ~8 文件/分钟。
    batches = [todo[i:i + BATCH_SIZE] for i in range(0, len(todo), BATCH_SIZE)]
    shards = [batches[i::args.workers] for i in range(args.workers)]
    shards = [s for s in shards if s]
    print(f'开始转换: {len(batches)} 批 × {BATCH_SIZE} 文件, {len(shards)} 个 worker (各自独占 profile)')
    t0 = time.time()
    ok_total, failed_all = 0, []
    counters = {'ok': 0, 'batches': 0}

    def run_shard(wid, shard):
        lok, lfail = 0, []
        for b in shard:
            kill_stale_soffice(wid)          # 清掉上一批可能留下的挂死 soffice
            o, f = convert_batch(b, wid)
            lok += o
            lfail.extend(f)
            counters['batches'] += 1
            el = time.time() - t0
            done = counters['ok'] + o
            counters['ok'] = done
            rate = done / el if el > 0 else 0
            eta = (len(todo) - done) / rate if rate > 0 else 0
            print(f'  [批 {counters["batches"]}/{len(batches)} w{wid}] +{o} '
                  f'(累计 {done}/{len(todo)}) 失败 {len(failed_all)+len(lfail)} | '
                  f'{rate:.2f} 文件/秒 | ETA {eta/60:.1f} 分钟', flush=True)
        return lok, lfail

    with ThreadPoolExecutor(max_workers=len(shards)) as ex:
        futs = [ex.submit(run_shard, wid, shard) for wid, shard in enumerate(shards)]
        for fut in as_completed(futs):
            ok, failed = fut.result()
            ok_total += ok
            failed_all.extend(failed)

    # 永久失败清单落盘 (下次 scan 直接跳过, 不再浪费超时等待)
    if failed_all:
        prev = load_failed()
        prev.update(str(p) for p in failed_all)
        save_failed(prev)

    el = time.time() - t0
    report = {
        'run_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'source_root': str(SRC_ROOT),
        'cache_dir': str(CONV_DIR),
        'doc_total': total_doc,
        'docx_native': total_docx,
        'converted': ok_total,
        'failed': [str(p) for p in failed_all],
        'elapsed_sec': round(el, 1),
    }
    MANIFEST.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f'\n完成: 转换 {ok_total} 份, 失败 {len(failed_all)} 份, 耗时 {el/60:.1f} 分钟')
    print(f'manifest: {MANIFEST}')
    if failed_all:
        print('失败样例:')
        for p in failed_all[:10]:
            print('  ', p)


if __name__ == '__main__':
    main()
