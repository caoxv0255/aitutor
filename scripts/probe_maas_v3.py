#!/usr/bin/env python3
"""probe_maas_v3.py — 测 4 个 endpoint + 看 endpoint 真实 IP"""
import json, urllib.request, urllib.error, socket
from pathlib import Path

env = {}
for line in Path("/home/cx/aitutor/.env.local").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k] = v

KEY = env["DASHSCOPE_API_KEY"]
print(f"key length: {len(KEY)}\n")

PROXY = "http://127.0.0.1:7897"
opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": PROXY, "https": PROXY}))


def probe(name, url, payload, headers_extra=None):
    headers = {
        "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json",
    }
    if headers_extra:
        headers.update(headers_extra)
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with opener.open(req, timeout=12) as r:
            return r.status, r.read()[:400].decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:400].decode("utf-8", errors="ignore")
    except Exception as e:
        return 0, str(e)[:200]


# 看 endpoint 域名 + 试公共 endpoint
endpoints = [
    ("Maas compatible", env["DASHSCOPE_BASE_URL"]),
    ("Maas 原始", env["DASHSCOPE_DASHSCOPE_URL"]),
    ("公共 DashScope compatible", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
    ("公共 DashScope 原始", "https://dashscope.aliyuncs.com/api/v1"),
    ("Maas 北京 vpc", "https://cn-beijing.maas.aliyuncs.com"),
]

for name, base in endpoints:
    code, body = probe(f"{name} chat", f"{base}/chat/completions",
                       {"model": "qwen-turbo", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5})
    print(f"{name:30} chat: {code}  {body[:200]}")

# 看 Maas endpoint 走的 IP
print("\n=== DNS via proxy (resolve via 8.8.8.8) ===")
import subprocess
r = subprocess.run(["bash", "-c", "curl --dns-servers 8.8.8.8:53 -svv --max-time 8 https://llm-ecz0dfm8sux9p8y6.cn-beijing.maas.aliyuncs.com/ 2>&1 | grep -E 'Trying|Connected to|Subject:' | head -10"], capture_output=True, text=True, timeout=12)
print(r.stdout)