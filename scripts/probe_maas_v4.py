#!/usr/bin/env python3
"""probe_maas_v4.py — 试 model 变种 + 各种 header"""
import json, urllib.request, urllib.error
from pathlib import Path

env = {}
for line in Path("/home/cx/aitutor/.env.local").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k] = v

KEY = env["DASHSCOPE_API_KEY"]
PROXY = "http://127.0.0.1:7897"
opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": PROXY, "https": PROXY}))
base = env["DASHSCOPE_BASE_URL"]


def probe(name, url, payload, headers_extra=None):
    headers = {"Authorization": "Bearer " + KEY, "Content-Type": "application/json"}
    if headers_extra:
        headers.update(headers_extra)
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with opener.open(req, timeout=12) as r:
            return r.status, r.read()[:300].decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:300].decode("utf-8", errors="ignore")
    except Exception as e:
        return 0, str(e)[:200]


# 不同 model + 不同 header
tests = [
    ("text-embedding-v3", "/embeddings", {"model": "text-embedding-v3", "input": "测试"}),
    ("text-embedding-v2", "/embeddings", {"model": "text-embedding-v2", "input": "测试"}),
    ("bge-large-zh-v1.5", "/embeddings", {"model": "bge-large-zh-v1.5", "input": "测试"}),
    ("qwen-turbo chat", "/chat/completions", {"model": "qwen-turbo", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5}),
    ("v3 + X-DashScope-Workspace", "/embeddings", {"model": "text-embedding-v3", "input": "测试"}, {"X-DashScope-Workspace": "llm-ecz0dfm8sux9p8y6"}),
    ("v3 + Workspace-Id", "/embeddings", {"model": "text-embedding-v3", "input": "测试"}, {"Workspace-Id": "llm-ecz0dfm8sux9p8y6"}),
    ("v3 + Workspace", "/embeddings", {"model": "text-embedding-v3", "input": "测试"}, {"Workspace": "llm-ecz0dfm8sux9p8y6"}),
]

for t in tests:
    if len(t) == 3:
        name, ep, payload = t; extra = None
    else:
        name, ep, payload, extra = t
    code, body = probe(name, f"{base}{ep}", payload, extra)
    print(f"  {name:50} {code}  {body[:150]}")