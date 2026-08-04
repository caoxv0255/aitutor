#!/usr/bin/env python3
"""probe_maas_v5.py — VPN 模式 (不 proxy)"""
import json, urllib.request, urllib.error
from pathlib import Path

env = {}
for line in Path("/home/cx/aitutor/.env.local").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k] = v

KEY = env["DASHSCOPE_API_KEY"]
base = env["DASHSCOPE_BASE_URL"]
print(f"key length: {len(KEY)}")
print(f"base: {base}\n")


def probe(name, url, payload):
    headers = {"Authorization": "Bearer " + KEY, "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read()[:600].decode("utf-8", errors="ignore")
            return r.status, body
    except urllib.error.HTTPError as e:
        body = e.read()[:600].decode("utf-8", errors="ignore")
        return e.code, body
    except Exception as e:
        return 0, str(e)[:300]


# 测 embed
code, body = probe("embed v3", f"{base}/embeddings",
                   {"model": "text-embedding-v3", "input": "测试中文 embedding 验证"})
print(f"embed v3: {code}")
print(f"body: {body[:600]}\n")

# 测 chat
code, body = probe("chat qwen-turbo", f"{base}/chat/completions",
                   {"model": "qwen-turbo", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5})
print(f"chat qwen-turbo: {code}")
print(f"body: {body[:300]}\n")

# 测 models list
req = urllib.request.Request(f"{base}/models", headers={"Authorization": "Bearer " + KEY})
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        body = r.read()[:1500].decode("utf-8", errors="ignore")
        print(f"models: {r.status}\n{body[:1000]}")
except urllib.error.HTTPError as e:
    body = e.read()[:600].decode("utf-8", errors="ignore")
    print(f"models: {e.code}  {body[:300]}")
except Exception as e:
    print(f"models: {e}")