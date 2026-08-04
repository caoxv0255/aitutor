#!/usr/bin/env python3
"""probe_maas_v6.py — 最后尝试各种 endpoint 形式"""
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
orig = env["DASHSCOPE_DASHSCOPE_URL"]


def probe(url, payload=None, method="POST"):
    headers = {"Authorization": "Bearer " + KEY, "Content-Type": "application/json"}
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            return r.status, r.read()[:300].decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:300].decode("utf-8", errors="ignore")
    except Exception as e:
        return 0, str(e)[:200]


# 最后尝试 — 看是否只是 embed endpoint 被禁, 试其它 compute
tests = [
    # DashScope 原始 (原生协议, 不是 OpenAI compatible)
    ("DashScope 原生 embed v3", f"{orig}/services/embeddings/text-embedding/text-embedding", {"model": "text-embedding-v3", "input": {"texts": ["测试"]}}, "POST"),
    # multimodal generate
    ("multimodal generation", f"{base}/services/aigc/multimodal-generation/generation", {"model": "qwen-vl-max", "input": {"messages": [{"role": "user", "content": [{"image": "https://example.com/x.jpg"}, {"text": "hi"}]}]}}, "POST"),
    # 文件上传类 (跟 embedding 无关, 看是否权限限制 compute 全部)
    ("dashscope files", f"{orig}/files", None, "GET"),
    # 元数据 / usage
    ("dashscope usage", f"{base}/usage", None, "GET"),
    # 看 models 权限范围 (不同的 model 都 403?)
    ("chat qwen3.7-max", f"{base}/chat/completions", {"model": "qwen3.7-max", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5}, "POST"),
    ("chat qwen3.7-flash", f"{base}/chat/completions", {"model": "qwen3.7-flash", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5}, "POST"),
]

for t in tests:
    name, url, payload, method = t
    code, body = probe(url, payload, method)
    print(f"  {name:35} {code}  {body[:180]}")