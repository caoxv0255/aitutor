#!/usr/bin/env python3
"""probe_maas_v2.py — 走 proxy 7897 测 Maas endpoint"""
import json, urllib.request, urllib.error, socket
from pathlib import Path
from urllib.parse import urlparse

env = {}
for line in Path("/home/cx/aitutor/.env.local").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k] = v

KEY = env["DASHSCOPE_API_KEY"]
print(f"key length: {len(KEY)}")

# 装 proxy 7897
PROXY = "http://127.0.0.1:7897"
proxy_handler = urllib.request.ProxyHandler({
    "http": PROXY,
    "https": PROXY,
})
opener = urllib.request.build_opener(proxy_handler)


def probe(name, url, payload, extra=None):
    headers = {
        "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json",
        "User-Agent": "aitutor-rag-ingest/1.0",
    }
    if extra:
        headers.update(extra)
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with opener.open(req, timeout=15) as r:
            body = r.read()[:800].decode("utf-8", errors="ignore")
            return r.status, body
    except urllib.error.HTTPError as e:
        body = e.read()[:800].decode("utf-8", errors="ignore")
        return e.code, body
    except Exception as e:
        return 0, str(e)[:300]


base = env["DASHSCOPE_BASE_URL"]
workspace = env.get("DASHSCOPE_WORKSPACE_ID", "llm-ecz0dfm8sux9p8y6")

tests = [
    ("embed v3", f"{base}/embeddings", {"model": "text-embedding-v3", "input": "测试"}),
    ("embed v3 + workspace header", f"{base}/embeddings", {"model": "text-embedding-v3", "input": "测试"}, {"X-DashScope-Workspace": workspace}),
    ("chat qwen-turbo smoke", f"{base}/chat/completions", {"model": "qwen-turbo", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 10}),
]

for t in tests:
    if len(t) == 3:
        name, url, payload = t; extra = None
    else:
        name, url, payload, extra = t
    code, body = probe(name, url, payload, extra)
    print(f"\n=== {name} (via proxy 7897) ===")
    print(f"  status: {code}")
    print(f"  body: {body[:700]}")