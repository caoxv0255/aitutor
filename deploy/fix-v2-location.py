#!/usr/bin/env python3
"""
fix-v2-location.py
==================
修复 aitutor.uibe.online 上 /v2/ 404 的问题：往 nginx 注入 /v2/ 反代。

注入策略 (--mode 选择):
  include (默认, 推荐):
    1. 扫描 /etc/nginx/sites-enabled/ 和 /etc/nginx/conf.d/ 下所有 .conf
       自动找含 server_name aitutor.uibe.online; 的文件
    2. 在该文件 server_name 行后追加:
         include /etc/nginx/conf.d/aitutor-v2.conf;
    3. 创建 /etc/nginx/conf.d/aitutor-v2.conf 包含 location ^~ /v2/ { ... }
    ✅ 风险最低, 不动主文件的 location 块, 自动定位文件

  inline (旧版兼容):
    在指定文件的 location ^~ /api/ 块后直接插入 location ^~ /v2/ { ... }
    ⚠️ 要求该文件里有标准的 ^~ /api/ 块

特性:
  ✅ 自动扫描多文件找 aitutor 配置 (不再依赖单一文件名)
  ✅ 幂等 (重复执行不会重复插入)
  ✅ 自动备份原文件 (uibe.conf.bak.YYYYMMDD_HHMMSS)
  ✅ 自动 nginx -t 验证, 失败自动回滚
  ✅ 自动 reload (--no-reload 可禁用)
  ✅ --dry-run 干跑预览
  ✅ --scan-only 只扫描定位不打针 (诊断用)

用法:
  sudo python3 fix-v2-location.py --scan-only        # 只找 aitutor 在哪个文件
  sudo python3 fix-v2-location.py --dry-run          # 预览
  sudo python3 fix-v2-location.py                    # 默认 include 模式
  sudo python3 fix-v2-location.py --mode inline      # 内联模式
  sudo python3 fix-v2-location.py --conf /path/to/X.conf  # 指定文件
"""

import argparse
import datetime as dt
import pathlib
import re
import shutil
import subprocess
import sys

DEFAULT_CONF_PATHS = [
    "/etc/nginx/sites-enabled/uibe.conf",
    "/etc/nginx/conf.d/uibe.conf",
    "/etc/nginx/sites-enabled/aitutor.conf",
    "/etc/nginx/conf.d/aitutor.conf",
]
SCAN_DIRS = [
    "/etc/nginx/sites-enabled",
    "/etc/nginx/conf.d",
    "/etc/nginx/sites-available",
]
SNIPPET_PATH = "/etc/nginx/conf.d/aitutor-v2.conf"
AITUTOR_DOMAIN = "aitutor.uibe.online"

V2_LOCATION = """\
    # Design V2 新前端（22 页 PM-BRIEF）
    # 由 deploy/fix-v2-location.py 注入 (D-v2-direct 反代)
    # 反代到本机 uibe-design-v2.service (上游端口 8090,
    # 经 design-v2-cf.conf / design-v2-direct.conf 暴露)
    location ^~ /v2/ {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
"""

INCLUDE_LINE = "    include /etc/nginx/conf.d/aitutor-v2.conf;  # Design V2 反代 (auto-added)\n"

# 备选锚点: uibe.conf 里已有的 /aitutor 代理块 (line 382, 710)
AITUTOR_ANCHOR_RE = re.compile(
    r'(location\s+\^~\s+/aitutor\s+\{[^{}]*?proxy_pass\s+http://tutor_server;[^{}]*?\n[ \t]{4}\})\n',
    re.DOTALL
)

API_BLOCK_RE = re.compile(
    r'(location \^~ /api/ \{[^}]*?\n[ \t]{4}\})\n',
    re.DOTALL
)


def check_existing_v2_inline(src: str) -> bool:
    return bool(re.search(r'location\s+\^~\s+/v2/\s*\{', src))


def check_existing_include(src: str) -> bool:
    return '/etc/nginx/conf.d/aitutor-v2.conf' in src


def find_api_blocks(src: str):
    return list(API_BLOCK_RE.finditer(src))


def find_aitutor_anchor(src: str):
    """找 /aitutor 块作为注入锚点, 返回 (match, line_no, content) 或 None."""
    m = AITUTOR_ANCHOR_RE.search(src)
    if not m:
        return None
    line_no = src[:m.start()].count('\n') + 1
    return (m, line_no, m.group(0))


def check_design_v2_service() -> bool:
    try:
        out = subprocess.run(
            ['systemctl', 'is-active', 'uibe-design-v2'],
            capture_output=True, text=True, timeout=5
        )
        return out.stdout.strip() == 'active'
    except Exception:
        return False


def backup(p: pathlib.Path) -> pathlib.Path:
    ts = dt.datetime.now().strftime('%Y%m%d_%H%M%S')
    bak = p.with_suffix(f'.conf.bak.{ts}')
    shutil.copy2(p, bak)
    return bak


def nginx_test_and_reload(no_reload: bool) -> bool:
    print("\n─── nginx -t ───")
    rt = subprocess.run(['nginx', '-t'], capture_output=True, text=True)
    print(rt.stdout)
    if rt.returncode != 0:
        print(rt.stderr, file=sys.stderr)
        return False
    print("✅ nginx -t 通过")

    if no_reload:
        print("\nℹ️  --no-reload 模式, 未 reload nginx")
        return True

    print("\n─── nginx -s reload ───")
    rr = subprocess.run(['nginx', '-s', 'reload'], capture_output=True, text=True)
    if rr.returncode != 0:
        print(f"⚠️  reload 失败: {rr.stderr}", file=sys.stderr)
        return False
    print("✅ nginx 已热加载")
    return True


def print_verify_commands():
    print("\n" + "=" * 60)
    print("🎉 完成！请验证：")
    print("=" * 60)
    print("  curl -I https://aitutor.uibe.online/v2/")
    print("  curl -s https://aitutor.uibe.online/v2/ | head -20")
    print("\n如果仍 404, 多半是 Cloudflare 边缘缓存, 到 CF 控制台:")
    print("  Caching → Purge Cache → aitutor.uibe.online/v2/*")


# ────────── 自动扫描定位 aitutor 配置文件 ──────────

def scan_nginx_files() -> list[tuple[pathlib.Path, list[str]]]:
    """扫描所有 .conf, 返回 [(file, server_name_lines), ...]"""
    results = []
    seen = set()
    # 1) 先扫默认路径
    for p in DEFAULT_CONF_PATHS:
        pp = pathlib.Path(p)
        if pp.exists() and pp not in seen:
            seen.add(pp)
            hits = _extract_server_names(pp.read_text(encoding='utf-8', errors='replace'))
            results.append((pp, hits))
    # 2) 再扫所有目录
    for d in SCAN_DIRS:
        dd = pathlib.Path(d)
        if not dd.exists():
            continue
        for p in sorted(dd.glob('*.conf')):
            if p in seen:
                continue
            seen.add(p)
            hits = _extract_server_names(p.read_text(encoding='utf-8', errors='replace'))
            results.append((p, hits))
    return results


def _extract_server_names(src: str) -> list[str]:
    """提取 src 里所有 server_name ...; 行 (去重保留顺序)。"""
    out = []
    for line in src.splitlines():
        m = re.match(r'\s*server_name\s+([^;]+);', line)
        if m:
            names = m.group(1).split()
            for n in names:
                if n not in out:
                    out.append(n)
    return out


def find_aitutor_conf() -> pathlib.Path | None:
    """自动找含 server_name aitutor.uibe.online; 的文件。"""
    for path, names in scan_nginx_files():
        if AITUTOR_DOMAIN in names:
            return path
    return None


# ────────── 主逻辑 ──────────

def mode_include(conf_path: pathlib.Path, dry_run: bool, no_reload: bool) -> int:
    src = conf_path.read_text(encoding='utf-8')

    if check_existing_include(src):
        print(f"ℹ️  检测到已 include aitutor-v2.conf, 无需重复")
        return 0

    if check_existing_v2_inline(src):
        print(f"⚠️  检测到主文件已有 location ^~ /v2/ 内联块")
        print(f"   include 模式会跳过主文件修改, 只确保 conf.d/aitutor-v2.conf 存在")

    if not check_design_v2_service():
        print(f"⚠️  uibe-design-v2.service 不是 active")
        print(f"   反代配置会装上, 但访问 /v2/ 会 502 (上游不通)")
        ans = input("   仍要继续？[y/N] ").strip().lower()
        if ans != 'y':
            return 0

    anchor = f'server_name {AITUTOR_DOMAIN};'
    idx = src.find(anchor)
    if idx < 0:
        print(f"❌ 在 {conf_path} 中没找到锚点: {anchor!r}", file=sys.stderr)
        return 3
    end_of_line = src.find('\n', idx)

    new_src = src[:end_of_line] + '\n' + INCLUDE_LINE + src[end_of_line:]

    if dry_run:
        print("=" * 60)
        print(f"DRY RUN [include 模式] 目标: {conf_path}")
        print("=" * 60)
        line_no = src[:end_of_line].count('\n') + 1
        print(f"\n将在 line {line_no} 后追加 ({len(INCLUDE_LINE)} 字符):")
        print(INCLUDE_LINE.rstrip())
        print(f"\n并创建/更新 {SNIPPET_PATH}:")
        print(V2_LOCATION)
        return 0

    snippet = pathlib.Path(SNIPPET_PATH)
    snippet.parent.mkdir(parents=True, exist_ok=True)
    snippet.write_text(V2_LOCATION, encoding='utf-8')
    print(f"✅ 已更新: {snippet}")

    bak = backup(conf_path)
    print(f"✅ 已备份: {bak}")
    conf_path.write_text(new_src, encoding='utf-8')
    print(f"✅ 已追加 include 到 {conf_path}")

    if not nginx_test_and_reload(no_reload):
        shutil.copy2(bak, conf_path)
        print(f"❌ 校验失败, 已回滚到 {bak}")
        return 4

    print_verify_commands()
    return 0


def mode_inline(conf_path: pathlib.Path, dry_run: bool, no_reload: bool) -> int:
    src = conf_path.read_text(encoding='utf-8')

    if check_existing_v2_inline(src):
        print(f"ℹ️  检测到已存在 location ^~ /v2/, 无需重复")
        return 0

    if not check_design_v2_service():
        print(f"⚠️  uibe-design-v2.service 不是 active")
        ans = input("   仍要继续？[y/N] ").strip().lower()
        if ans != 'y':
            return 0

    targets = find_api_blocks(src)
    if not targets:
        # Fallback: 用 /aitutor 块作为锚点 (uibe.conf line 382/710 的常见模式)
        anchor = find_aitutor_anchor(src)
        if anchor:
            print(f"ℹ️  没找到 ^~ /api/ 块, 用 ^~ /aitutor 块作为锚点 (line {anchor[1]})")
            m, line_no, content = anchor
        else:
            print(f"❌ 没找到 ^~ /api/ 块, 也没找到 ^~ /aitutor 块", file=sys.stderr)
            print(f"   请改用 --mode include", file=sys.stderr)
            return 3
    else:
        if len(targets) > 1:
            print(f"⚠️  发现 {len(targets)} 个 /api/ 块, 只改第 1 个")
        m = targets[0]

    new_src = src[:m.end()] + '\n' + V2_LOCATION + src[m.end():]

    if dry_run:
        print("=" * 60)
        print(f"DRY RUN [inline 模式] 目标: {conf_path}")
        print("=" * 60)
        print(V2_LOCATION)
        return 0

    bak = backup(conf_path)
    print(f"✅ 已备份: {bak}")
    conf_path.write_text(new_src, encoding='utf-8')
    print(f"✅ 已插入 /v2/ 块到 {conf_path}")

    if not nginx_test_and_reload(no_reload):
        shutil.copy2(bak, conf_path)
        print(f"❌ 校验失败, 已回滚到 {bak}")
        return 4

    print_verify_commands()
    return 0


def do_scan() -> int:
    print("─── 扫描 nginx 配置 ───")
    results = scan_nginx_files()
    if not results:
        print("❌ 没找到任何 nginx .conf 文件")
        return 1
    for p, names in results:
        marker = "  ← aitutor 在这!" if AITUTOR_DOMAIN in names else ""
        print(f"  {p}  (server_name: {', '.join(names) if names else '无'}){marker}")
    aitutor_conf = find_aitutor_conf()
    print()
    if aitutor_conf:
        print(f"✅ 自动定位: {aitutor_conf}")
        return 0
    print(f"❌ 扫描完毕, 找不到含 '{AITUTOR_DOMAIN}' 的 server_name")
    print(f"   提示: 该域名可能走通配符 (server_name _; 或 .uibe.online)")
    return 2


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument('conf', nargs='?', default=None, help='nginx 主配置路径 (留空自动扫描)')
    ap.add_argument('--mode', choices=['include', 'inline'], default='include')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--no-reload', action='store_true')
    ap.add_argument('--scan-only', action='store_true', help='只扫描定位 aitutor 配置文件, 不修改')
    args = ap.parse_args()

    if args.scan_only:
        sys.exit(do_scan())

    # 决定目标配置文件
    if args.conf:
        conf_path = pathlib.Path(args.conf)
        if not conf_path.exists():
            print(f"❌ 配置文件不存在: {conf_path}", file=sys.stderr)
            sys.exit(2)
    else:
        print("未指定 --conf, 自动扫描定位 aitutor.uibe.online 的配置...")
        conf_path = find_aitutor_conf()
        if not conf_path:
            print(f"❌ 自动扫描没找到含 '{AITUTOR_DOMAIN}' 的文件", file=sys.stderr)
            print(f"   试试 --scan-only 看扫描结果, 或 --conf /path/to/xxx.conf 手动指定", file=sys.stderr)
            sys.exit(3)
        print(f"✅ 自动定位到: {conf_path}")

    if args.mode == 'include':
        rc = mode_include(conf_path, args.dry_run, args.no_reload)
    else:
        rc = mode_inline(conf_path, args.dry_run, args.no_reload)

    sys.exit(rc)


if __name__ == '__main__':
    sys.exit(main() or 0)
