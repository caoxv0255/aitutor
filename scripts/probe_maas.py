#!/usr/bin/env python3
"""probe_maas.py — 测阿里云 Maas endpoint (不打印 key)"""
import json, urllib.request, urllib.error, os
from pathlib import Path

env = {}
for line in Path("/home/cx/aitutor/.env.local").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k] = v

KEY = env["DASHSCOPE_API_KEY"]
print(f"key length: {len(KEY)}")
print(f"base: {env['DASHSCOPE_BASE_URL'][:60]}...")

def probe(name, url, payload, extra_headers=None):
    headers = {
        "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read()[:500].decode("utf-8", errors="ignore")
            return r.status, body
    except urllib.error.HTTPError as e:
        body = e.read()[:500].decode("utf-8", errors="ignore")
        return e.code, body
    except Exception as e:
        return 0, str(e)[:300]

base = env["DASHSCOPE_BASE_URL"]
dashscope = env["DASHSCOPE_DASHSCOPE_URL"]
workspace = env.get("DASHSCOPE_WORKSPACE_ID", "llm-ecz0dfm8sux9p8y6")

tests = [
    ("test 1: compatible-mode embed", f"{base}/embeddings", {"model": "text-embedding-v3", "input": "测试"}),
    ("test 2: +workspace header", f"{base}/embeddings", {"model": "text-embedding-v3", "input": "测试"}, {"X-Workspace-Id": workspace}),
    ("test 3: dashscope 原生 embed", f"{dashscope}/services/embeddings/text-embedding/text-embedding", {"model": "text-embedding-v3", "input": {"texts": ["测试"]}}),
    ("test 4: smoke chat qwen", f"{base}/chat/completions", {"model": "qwen-turbo", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 10}),
    ("test 5: smoke chat qwen3-14b", f"{base}/chat/completions", {"model": "qwen3-14b", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 10}),
    ("test 6: smoke embed bge", f"{base}/embeddings", {"model": "text-embedding-v2", "input": "测试"}),
]

for t in tests:
    if len(t) == 3:
        name, url, payload = t
        extra = None
    else:
        name, url, payload, extra = t
    code, body = probe(name, url, payload, extra)
    print(f"\n=== {name} ===")
    print(f"  status: {code}")
    print(f"  body: {body[:500]}")