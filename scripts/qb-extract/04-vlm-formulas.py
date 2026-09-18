#!/usr/bin/env python3
"""
P1 Stage 04 — 公式 / 图片的 VLM 理解 (LaTeX + 语义描述)

路线决策 (实测依据):
  ❌ 逐张把 WMF 交给 libreoffice 转 PNG —— 80 张里 55 张渲染成全白空画布,
     MathType/Equation3.0 的 OLE 公式脱离文档上下文后渲染失败。
  ✅ 整份 docx → HTML: libreoffice 在文档上下文里把每个 OLE 公式渲染成**尺寸正确的内联图**。
     实测北京2024数学卷 496 张图里 495 张有内容 (公式中位 96×43, 插图 946×787)。
  ✅ 额外收益: HTML 保留段落结构, 因此能拿到每个公式的**上下文文字** ——
     既用于把公式挂回正确题目, 也提升 VLM 识别准确率。

去重: 图片按 sha256 全局去重 (同一公式在全库只调用一次 VLM), 结果落 out/vlm/<sha256>.json 作缓存。
      重跑零成本。

产物:
  out/html/<exam_level>/<subject>/<year>/<name>.json   每卷: 公式/图片清单 + 上下文 + 归属题号
  out/media-html/<sha2>/<sha256>.<ext>                 内容寻址的公式/图片本体
  out/vlm/<sha256>.json                                VLM 结果缓存 (latex / semantic)
  out/vlm-index.jsonl                                  全库 VLM 结果索引

用法:
  python3 04-vlm-formulas.py --dry-run                 # 只统计要不要跑
  python3 04-vlm-formulas.py --limit 5                 # 小样
  python3 04-vlm-formulas.py --workers 8               # 全量
  python3 04-vlm-formulas.py --model qwen3-vl-plus
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import random
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BASE_DIR = REPO / 'database' / 'preflight' / 'qb-extract'
CACHE = BASE_DIR / 'docx-cache'
OUT = BASE_DIR / 'out'
HTML_OUT = OUT / 'html'
MEDIA_HTML = OUT / 'media-html'
VLM = OUT / 'vlm'
VLM_INDEX = OUT / 'vlm-index.jsonl'
HTML_RAW = BASE_DIR / 'html-raw'
LO_PROFILE = BASE_DIR / 'lo-profile'
SRC_ROOT = REPO / 'database' / 'incoming'

KEY_FILE = Path.home() / '.secrets' / 'aliyun_maas_key'
BASE_FILE = Path.home() / '.secrets' / 'aliyun_maas_base'

PROMPT_FORMULA = (
    '这是一个中国高考/中考题目里的数学或理科公式图片（来自 Word 的 MathType 公式对象）。\n'
    '请输出一个 JSON 对象, 且只输出 JSON, 不要 markdown 代码块, 不要额外解释:\n'
    '{"latex": "<LaTeX 代码>", "reading": "<用一行中文把这个公式读出来, 如 \'集合 M 等于 x 大于负4 且小于等于1\'>"}\n'
    'LaTeX 要求:\n'
    '- 不要用 $ 或 \\( \\) 包裹\n'
    '- 保留上下标、分式、根号、积分号、希腊字母、向量箭头、绝对值、不等号、集合符号、矩阵\n'
    '- 中文用 \\text{中文} 包裹\n'
    '- 若图片确实不含任何公式内容(空白/纯装饰), 输出 {"latex":"NONE","reading":""}'
)
PROMPT_FIGURE = (
    '这是一个中国高考/中考题目里的插图（物理受力图/化学装置图/几何图/实验流程图/表格等）。\n'
    '请输出一个 JSON 对象, 且只输出 JSON, 不要 markdown 代码块:\n'
    '{"semantic": "<用一到两句中文客观描述图中内容: 有哪些元素、标注、结构关系>", '
    '"reading": "<图中出现的关键文字/标签, 逗号分隔; 没有则空字符串>"}'
)


# ─────────────── docx → HTML ───────────────

def run_with_timeout(cmd, timeout):
    """见 01-convert-docs.py 同名函数说明: 必须用独立进程组 + killpg,
    否则 subprocess.run(timeout=) 在 oosplash 重生 soffice 时会永不返回。"""
    import signal
    p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         start_new_session=True)
    try:
        p.wait(timeout=timeout)
        return True
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


def docx_to_html(docx: Path, worker_id: int):
    """返回 HTML 路径。产物缓存在 html-raw/ 下 (按源相对路径组织)。"""
    rel = None
    for root in (CACHE, SRC_ROOT):
        try:
            rel = docx.relative_to(root)
            break
        except ValueError:
            continue
    if rel is None:
        rel = Path(docx.name)
    outdir = HTML_RAW / rel.parent
    outdir.mkdir(parents=True, exist_ok=True)
    target = outdir / (docx.stem + '.html')
    if target.exists() and target.stat().st_size > 0 and target.stat().st_mtime >= docx.stat().st_mtime:
        return target
    profile = LO_PROFILE / f'html{worker_id}'
    cmd = ['libreoffice', '--headless', '--norestore',
           f'-env:UserInstallation=file://{profile}',
           '--convert-to', 'html', '--outdir', str(outdir), str(docx)]
    run_with_timeout(cmd, 240)
    return target if target.exists() else None


# ─────────────── HTML 解析: 公式/图片 + 上下文 ───────────────

def strip_tags(s: str) -> str:
    s = re.sub(r'<[^>]+>', '', s)
    s = s.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    return re.sub(r'\s+', ' ', s).strip()


def parse_html(html: Path):
    """返回 items: [{kind, name, sha256, ext, context, para_idx}]
    注意: libreoffice 导出的 img src 是 **URL 编码** 的文件名 (中文被百分号编码), 必须 unquote;
    且 name/src 属性顺序不固定, 正则不能写死顺序。"""
    from urllib.parse import unquote
    txt = html.read_text(encoding='utf-8', errors='ignore')
    paras = re.findall(r'<p[^>]*>(.*?)</p>', txt, re.S)
    items = []
    for pi, p in enumerate(paras):
        refs = []
        for tag in re.findall(r'<img[^>]*>', p):
            m_src = re.search(r'src="([^"]+)"', tag)
            m_nm = re.search(r'name="([^"]+)"', tag)
            if not m_src:
                continue
            src = unquote(m_src.group(1).split('#')[0].split('?')[0])
            nm = m_nm.group(1) if m_nm else 'Image?'
            refs.append((src, nm))
        if not refs:
            continue
        ctx = strip_tags(p)
        for src, name in refs:
            f = (html.parent / src)
            if not f.exists():
                continue
            try:
                data = f.read_bytes()
            except Exception:
                continue
            h = hashlib.sha256(data).hexdigest()
            ext = f.suffix.lower() or '.bin'
            items.append({
                'kind': 'formula' if name.startswith('Object') else 'figure',
                'name': name, 'sha256': h, 'ext': ext,
                'abs_path': str(f),
                'context': ctx[:300], 'para_idx': pi, 'bytes': len(data),
            })
    return items


def store_media(items):
    """内容寻址落盘; 返回 sha256 → 相对路径 映射"""
    m = {}
    for it in items:
        f = Path(it.pop('abs_path', ''))
        if not f.exists():
            continue
        dst = MEDIA_HTML / it['sha256'][:2] / (it['sha256'] + it['ext'])
        if not dst.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            tmp = dst.with_suffix(dst.suffix + '.part')
            tmp.write_bytes(f.read_bytes())
            tmp.rename(dst)
        m[it['sha256']] = str(dst.relative_to(OUT))
    return m


# ─────────────── VLM 调用 ───────────────

def read_creds():
    if not KEY_FILE.exists() or not BASE_FILE.exists():
        raise SystemExit(f'缺少凭据: {KEY_FILE} / {BASE_FILE}')
    return KEY_FILE.read_text().strip(), BASE_FILE.read_text().strip()


def vlm_call(model, prompt, img_bytes, ext, key, base, timeout=120, retries=4):
    """调用 VLM。返回 (文本, token, 错误)。

    关于重试: 实测在并发压力下端点会返回 **HTTP 400 (不是 429)**, 且是瞬时的 ——
    同一请求稍后重试即成功。所以 4xx 也要重试, 并且必须**读出错误体**,
    否则只会看到 "HTTP Error 400: Bad Request" 这种无法定位的报错。
    """
    mime = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
            'gif': 'image/gif', 'emf': 'image/png', 'wmf': 'image/png'}.get(ext.lstrip('.'), 'image/png')
    body = {
        'model': model,
        'messages': [{'role': 'user', 'content': [
            {'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,{base64.b64encode(img_bytes).decode()}'}},
            {'type': 'text', 'text': prompt},
        ]}],
        'max_tokens': 700, 'temperature': 0.0,
    }
    payload = json.dumps(body).encode()
    last = None
    for a in range(retries):
        try:
            req = urllib.request.Request(
                f'{base}/chat/completions', data=payload,
                headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                d = json.loads(r.read().decode())
            txt = d['choices'][0]['message']['content'].strip()
            return txt, d.get('usage', {}).get('total_tokens', 0), None
        except urllib.error.HTTPError as e:
            try:
                detail = e.read().decode()[:300]
            except Exception:
                detail = ''
            last = f'HTTP {e.code}: {detail}'
        except Exception as e:
            last = f'{type(e).__name__}: {str(e)[:200]}'
        time.sleep(min(1.5 * (2 ** a), 12) + random.random() * 0.5)   # 指数退避 + 抖动
    return None, 0, last


def parse_vlm_json(txt: str):
    if not txt:
        return {}
    t = re.sub(r'^```(?:json)?\s*', '', txt.strip())
    t = re.sub(r'\s*```$', '', t).strip()
    try:
        return json.loads(t)
    except Exception:
        m = re.search(r'\{.*\}', t, re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return {'latex': t, 'reading': '', '_unparsed': True}


def clean_latex(s):
    if not s:
        return s
    s = s.strip()
    s = re.sub(r'^\$\$?(.*?)\$\$?$', r'\1', s, flags=re.S)
    return s.strip()


# ─────────────── 空白图前置过滤 ───────────────
# 动机: 语料里有相当比例的空图/只剩水印的图, 送去 VLM 会返回「图中为空白，无任何可见元素」,
#       纯粹浪费调用与 token。
# 阈值依据 (实测, 用 8216 条已有 VLM 结果做验证集, VLM 严格判定空白 94 条):
#       墨迹像素 <= 20  →  捕获 91% 的空白图, **误杀非空白图 0/200** (非空白图墨迹最小 55px)
#       用「绝对墨迹像素数」而不是「占比」: 小尺寸公式图本身像素总数就少, 占比会误判。
BLANK_INK_MAX = 20
WHITE_THRESH = 240


def ink_pixel_count(path):
    """返回 (墨迹像素数, 是否可读)。墨迹 = 灰度 < WHITE_THRESH 的像素。"""
    try:
        from PIL import Image
        import numpy as np
        a = np.array(Image.open(path).convert('L'))
        return int((a < WHITE_THRESH).sum()), True
    except Exception:
        return -1, False


def is_blank_image(path):
    n, ok = ink_pixel_count(path)
    if not ok:
        return False, -1          # 读不了就当非空白, 交给 VLM 判断, 不误杀
    return n <= BLANK_INK_MAX, n


# ─────────────── 主流程 ───────────────

def build_worklist(subjects=None, limit=None):
    out = []
    for src in sorted(SRC_ROOT.rglob('*')):
        if src.suffix.lower() not in ('.doc', '.docx') or not src.is_file():
            continue
        rel = src.relative_to(SRC_ROOT)
        parts = rel.parts
        subj = next((p for p in parts[:-1] if p in {
            'chinese', 'math', 'english', 'physics', 'chemistry', 'biology',
            'politics', 'history', 'geography'}), None)
        if subjects and subj not in subjects:
            continue
        docx = src if src.suffix.lower() == '.docx' else (CACHE / rel).with_suffix('.docx')
        if not docx.exists():
            continue
        out.append({'src': str(src), 'docx': str(docx), 'subject': subj})
    return out[:limit] if limit else out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--limit', type=int)
    ap.add_argument('--subjects')
    ap.add_argument('--workers', type=int, default=8)
    ap.add_argument('--html-workers', type=int, default=3)
    ap.add_argument('--model', default='qwen3-vl-flash')
    ap.add_argument('--figure-model', default='qwen3-vl-plus')
    ap.add_argument('--max-calls', type=int, default=0, help='本轮最多调用次数 (0=不限)')
    ap.add_argument('--force-html', action='store_true')
    args = ap.parse_args()

    subjects = args.subjects.split(',') if args.subjects else None
    items = build_worklist(subjects, args.limit)
    print(f'工作集: {len(items)} 卷')
    if args.dry_run:
        done_html = len(list(HTML_RAW.rglob('*.html')))
        print(f'已渲染 HTML: {done_html}')
        print('--dry-run: 不执行')
        return
    if not items:
        print('无可处理项'); return

    for d in (HTML_OUT, MEDIA_HTML, VLM):
        d.mkdir(parents=True, exist_ok=True)

    # ── 阶段 A: docx → HTML (并行) ──
    # 按 worker 分片, 每个 worker 独占自己的 libreoffice profile。
    # 反例(勿用): ex.submit(docx_to_html, docx, i % html_workers) —— 不同批次会落到同一 profile,
    # soffice 的 profile 锁互相阻塞, 实测导致 1634 份里只有 1068 份渲染成功, 其余静默跳过。
    t0 = time.time()
    print(f'\n[A] docx → HTML ({args.html_workers} worker, 分片独占 profile)')
    htmls = []
    html_failed = []
    shards = [items[i::args.html_workers] for i in range(args.html_workers)]
    shards = [s for s in shards if s]

    def html_shard(wid, shard):
        ok, bad = [], []
        for it in shard:
            h = docx_to_html(Path(it['docx']), wid)
            if h:
                ok.append((it, h))
            else:
                bad.append(it)
        return ok, bad

    with ThreadPoolExecutor(max_workers=len(shards)) as ex:
        futs = [ex.submit(html_shard, wid, s) for wid, s in enumerate(shards)]
        done = 0
        for fut in as_completed(futs):
            ok, bad = fut.result()
            htmls.extend(ok)
            html_failed.extend(bad)
            done += len(ok) + len(bad)
            el = time.time() - t0
            print(f'  [{done}/{len(items)}] 成功 {len(htmls)} 失败 {len(html_failed)} '
                  f'| {done/max(el,1):.1f} 卷/秒', flush=True)
    print(f'  HTML 完成: {len(htmls)}/{len(items)}, 失败 {len(html_failed)}, '
          f'耗时 {(time.time()-t0)/60:.1f} 分钟')
    if html_failed:
        print('  ⚠️ 渲染失败样例:')
        for it in html_failed[:5]:
            print(f"     {Path(it['src']).name[:64]}")

    # ── 阶段 B: 解析 HTML, 抽公式/图片 + 上下文 ──
    print('\n[B] 解析 HTML, 收集公式/图片')
    papers = {}
    all_media = {}
    for it, h in htmls:
        try:
            its = parse_html(h)
        except Exception as e:
            print(f'  解析失败 {h.name}: {str(e)[:80]}'); continue
        store_media(its)
        rel = h.relative_to(HTML_RAW).with_suffix('.json')
        # 归属题号: 用上下文里的题号锚点
        for x in its:
            m = re.match(r'^\s*(\d{1,2})\s*[.．、]', x['context'] or '')
            x['question_number'] = int(m.group(1)) if m else None
        rec = {'source_path': it['src'], 'docx_path': it['docx'], 'subject': it['subject'],
               'html': str(h), 'items': its,
               'n_formula': sum(1 for x in its if x['kind'] == 'formula'),
               'n_figure': sum(1 for x in its if x['kind'] == 'figure')}
        p = HTML_OUT / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(rec, ensure_ascii=False))
        papers[str(p)] = rec
        for x in its:
            all_media.setdefault(x['sha256'], x)
    nf = sum(1 for x in all_media.values() if x['kind'] == 'formula')
    ng = sum(1 for x in all_media.values() if x['kind'] == 'figure')
    print(f'  卷 {len(papers)} | 去重后 公式 {nf} / 插图 {ng} (总 {len(all_media)})')

    # ── 阶段 C: VLM 理解 (只对未缓存的 sha256 调用) ──
    key, base = read_creds()
    todo = []
    for sha, x in all_media.items():
        cp = VLM / f'{sha}.json'
        if cp.exists():
            continue
        p = MEDIA_HTML / sha[:2] / (sha + x['ext'])
        if not p.exists():
            continue
        todo.append((sha, x, p))
    if args.max_calls:
        todo = todo[:args.max_calls]
    print(f'\n[C] VLM 理解: 待调用 {len(todo)} / 总计 {len(all_media)} '
          f'(公式用 {args.model}, 插图用 {args.figure_model})')
    if not todo:
        print('  全部已缓存')
    t1 = time.time()
    called = tokens = failed = 0

    def do_one(sha, x, p):
        # 空白图前置过滤: 直接判定, 不发起 VLM 调用 (省调用 + token)
        blank, ink = is_blank_image(p)
        if blank:
            return sha, {'_blank': True, '_ink': ink}, 0, None
        model = args.model if x['kind'] == 'formula' else args.figure_model
        prompt = PROMPT_FORMULA if x['kind'] == 'formula' else PROMPT_FIGURE
        try:
            data = p.read_bytes()
        except Exception as e:
            return sha, None, 0, f'读取失败 {e}'
        txt, tok, err = vlm_call(model, prompt, data, x['ext'], key, base)
        if err:
            return sha, None, 0, err
        return sha, parse_vlm_json(txt), tok, None

    blank_skipped = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(do_one, sha, x, p): (sha, x) for sha, x, p in todo}
        for n, f in enumerate(as_completed(futs), 1):
            sha, x = futs[f]
            sh, parsed, tok, err = f.result()
            called += 1
            tokens += tok or 0
            if err or parsed is None:
                failed += 1
                if failed <= 3:
                    print(f'  失败 {sha[:10]}: {str(err)[:110]}', flush=True)
                continue
            if parsed.get('_blank'):
                blank_skipped += 1
                d = {'sha256': sha, 'kind': x['kind'], 'model': None,
                     'latex': None, 'semantic': None, 'reading': None,
                     'blank': True, 'ink_pixels': parsed.get('_ink'), 'tokens': 0,
                     'ts': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'ext': x['ext']}
            else:
                d = {'sha256': sha, 'kind': x['kind'],
                     'model': args.model if x['kind'] == 'formula' else args.figure_model,
                     'latex': clean_latex(parsed.get('latex')) if x['kind'] == 'formula' else None,
                     'semantic': parsed.get('semantic') if x['kind'] == 'figure' else parsed.get('reading'),
                     'reading': parsed.get('reading'), 'tokens': tok, 'blank': False,
                     'ts': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'ext': x['ext']}
            tmp = (VLM / f'{sha}.json').with_suffix('.json.part')
            tmp.write_text(json.dumps(d, ensure_ascii=False))
            tmp.rename(VLM / f'{sha}.json')
            if n % 25 == 0 or n == len(todo):
                el = time.time() - t1
                rate = n / max(el, 1)
                eta = (len(todo) - n) / rate / 60 if rate else 0
                print(f'  [{n}/{len(todo)}] {rate:.1f} 个/秒 | tok累计 {tokens} | '
                      f'空白跳过 {blank_skipped} | 失败 {failed} | ETA {eta:.0f} 分钟', flush=True)

    # 重建全局索引
    rows = []
    for cp in sorted(VLM.glob('*.json')):
        try:
            rows.append(json.loads(cp.read_text()))
        except Exception:
            continue
    tmp = VLM_INDEX.with_suffix('.jsonl.part')
    with tmp.open('w', encoding='utf-8') as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + '\n')
    tmp.rename(VLM_INDEX)

    el = time.time() - t1
    print(f'\n完成: 本轮处理 {called} (其中空白跳过 {blank_skipped}), token {tokens}, '
          f'失败 {failed}, 耗时 {el/60:.1f} 分钟')
    if called:
        eff = max(called - blank_skipped, 1)
        print(f'  吞吐 {called/max(el,1):.2f} 个/秒 | 实际调用 {called-blank_skipped} 个, '
              f'均 {tokens/eff:.0f} tok/个')
    print(f'  累计 VLM 结果: {len(rows)} 条 → {VLM_INDEX}')


if __name__ == '__main__':
    main()
