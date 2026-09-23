#!/usr/bin/env node
/**
 * scripts/check-graphrag-settings-fields.mjs — GraphRAG settings.yaml 字段名静默吞字段 永久闸门
 *
 * 起因 (真实事故, 2026-09-23 修复 f06fbc8):
 *   graphrag_service/indexer.py 生成 settings.yaml 时把 LLM/embedding 的 base URL 写成
 *   `base_url`, 而 graphrag_llm.ModelConfig 的真字段名是 **`api_base`**。该 pydantic 模型
 *   设了 `extra="allow"` —— 未知字段被**静默忽略**(不报错/不警告), api_base 于是为 None,
 *   litellm 退回默认端点 https://api.openai.com/v1。本机 DNS 又把该域名指向黑洞 IP,
 *   整个索引过程**直接卡死**, 表面上却"配置都在、进程也在"。
 *   这类错靠 review 看不出来(因为不报错), 必须机械拦。
 *
 * 判据 (字段集**从 venv 里 import 真实模型取得, 不硬编码字段名清单**, 模型改字段本闸门自动跟随):
 *   1. 用 .venv/bin/python 执行探针: import graphrag 的 pydantic 配置模型, 读真实 field 集合;
 *      再真实调用 indexer.create_settings_yaml() 生成 settings.yaml 并解析 —— 校验的是
 *      "indexer 实际写出的字段", 不是脚本里挑几个字段名硬比。
 *   2. completion_models / embedding_models 的每个模型项: 字段名必须 ⊆ ModelConfig.field 集合;
 *      出现未知字段(如 base_url)即判红并指名 段/字段/indexer.py 行号。
 *   3. 每个模型项的 api_base / api_key / model 必须**存在且非空** —— 光字段名对但没填,
 *      同样会静默走默认端点。
 *   4. vector_store: 字段名 ⊆ VectorStoreConfig.field 集合; `vector_size` 必须存在、为正整数,
 *      且等于 config 的 GRAPHRAG_EMBEDDING_DIMS —— 3.1.2 默认 3072 与本项目 bge-m3(1024) 不符,
 *      写错字段名被吞掉后写 lancedb 会抛维度错。
 *
 * ALLOW 登记机制 (当前为空):
 *   每项 { key: "<section>.<field>", reason, date }。确需保留的未知字段才登记, 且必须写明理由。
 *   正常做法是改用模型真字段名, 不要用登记绕过 —— 被吞掉的字段不会生效。
 *
 * 空转防护:
 *   - `.venv/bin/python` 不存在 → **判红 (fail)**, 绝不静默 pass。
 *     理由: 本闸门是为"配置看似正常、实则没生效"这类静默失败兜底的; 若环境缺失时跳过,
 *     门禁照样输出"全部通过", 就复现了事故本身。缺 venv 时 GraphRAG 本就跑不起来,
 *     报红并提示修复(`python -m venv .venv && .venv/bin/pip install graphrag==3.1.2`)才诚实。
 *   - 探针导入/生成失败 → 判红并回显错误。
 *   - 探针成功但生成结果里没有模型段 / 没有 vector_size → 判红(说明生成逻辑已失效)。
 *
 * 射程: 只针对 graphrag_service/indexer.py 生成的 settings 结构。不覆盖 graphrag CLI
 *   运行时的 .env 解析(GRAPHRAG_API_KEY 占位符替换)、也不覆盖 graphrag 内部默认值。
 *
 * 输出: 存在未知字段 / 必填字段为空 / vector_size 异常 → 非零退出。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VENV_PY = path.join(ROOT, '.venv', 'bin', 'python');
const INDEXER_REL = 'graphrag_service/indexer.py';
const INDEXER_ABS = path.join(ROOT, INDEXER_REL);

// 模型段 → 真实字段集来源类名 (类名字段集由探针从 venv 取, 非硬编码字段名)
const MODEL_SECTIONS = ['completion_models', 'embedding_models'];
const MODEL_CLASS = 'ModelConfig';
const VECTOR_SECTION = 'vector_store';
const VECTOR_CLASS = 'VectorStoreConfig';

// 每个模型项必须存在且非空的字段 (字段名对但没填 → 静默走默认端点)
const REQUIRED_NONEMPTY = ['api_base', 'api_key', 'model'];

// ── ALLOW 登记: 未知字段豁免 (当前为空; key = "<section>.<field>") ──────────
const ALLOW = [];
const ALLOW_KEYS = new Set(ALLOW.map((e) => e.key));

/** 探针: 在 .venv 里取真实字段集 + 真实生成 settings.yaml, 仅输出 JSON。 */
const PROBE = `
import json, os, sys, tempfile, importlib.metadata, traceback
from pathlib import Path

root = os.getcwd()
sys.path.insert(0, root)

out = {}
try:
    from graphrag_llm.config.model_config import ModelConfig
    from graphrag_vectors.vector_store_config import VectorStoreConfig
    import graphrag_service.config as cfg
    import graphrag_service.indexer as ix

    def describe(model):
        return {"fields": sorted(model.model_fields.keys()),
                "extra": model.model_config.get("extra")}

    def redact(node):
        if isinstance(node, dict):
            res = {}
            for k, v in node.items():
                if k == "api_key":
                    res[k] = "***" if v else ""
                else:
                    res[k] = redact(v)
            return res
        if isinstance(node, list):
            return [redact(x) for x in node]
        return node

    tmp = tempfile.mkdtemp(prefix="gate-graphrag-")
    spath = ix.create_settings_yaml(Path(tmp), "gatecheck")
    import yaml
    with open(spath, "r", encoding="utf-8") as fh:
        settings = yaml.safe_load(fh)

    out = {
        "ok": True,
        "graphrag_version": importlib.metadata.version("graphrag"),
        "embedding_dims": cfg.GRAPHRAG_EMBEDDING_DIMS,
        "models": {
            "ModelConfig": describe(ModelConfig),
            "VectorStoreConfig": describe(VectorStoreConfig),
        },
        "settings": redact(settings),
    }
except Exception as exc:
    out = {"ok": False,
           "error": type(exc).__name__ + ": " + str(exc),
           "traceback": traceback.format_exc()[-2000:]}

sys.stdout.write(json.dumps(out, ensure_ascii=False))
`;

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// ── 空转防护 #1: venv/python 缺失 → 判红 (见文件头「空转防护」) ──
if (!fs.existsSync(VENV_PY)) {
  die(
    `❌ 闸门无法运行: 未找到 GraphRAG 虚拟环境解释器 ${path.relative(ROOT, VENV_PY)}\n` +
      '   本闸门需要从 venv 里 import graphrag 的配置模型来取真实字段集 —— 缺环境时\n' +
      '   它一个字段都没校验。若静默 pass，就复现了"配置看似正常实则没生效"的事故。\n' +
      '   修复: python -m venv .venv && .venv/bin/pip install "graphrag==3.1.2"'
  );
}

const probe = spawnSync(VENV_PY, ['-c', PROBE], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});

// ── 空转防护 #2: 探针执行失败 → 判红 ──
if (probe.error) {
  die(`❌ 探针执行失败 (${VENV_PY}): ${probe.error.message}`);
}
if (probe.status !== 0) {
  die(`❌ 探针以退出码 ${probe.status} 结束 —— 未能校验任何字段: \n` + `${(probe.stderr || '').trim().slice(-1500)}`);
}

let data;
try {
  data = JSON.parse(probe.stdout);
} catch (e) {
  die(`❌ 探针输出不是合法 JSON: ${e.message}\n   stdout 尾: ${(probe.stdout || '').slice(-500)}`);
}
if (!data.ok) {
  die(
    `❌ 探针无法生成/校验 settings: ${data.error}\n` +
      '   (venv 里 graphrag 未装或配置模型导入失败 → 本闸门未校验任何字段, 判红)\n' +
      `${(data.traceback || '').trim().slice(-1200)}`
  );
}

const modelFields = new Set(data.models?.[MODEL_CLASS]?.fields || []);
const vectorFields = new Set(data.models?.[VECTOR_CLASS]?.fields || []);
const settings = data.settings || {};

// ── 空转防护 #3: 字段集/生成结果的形状必须成立, 否则判红 ──
const spin = [];
if (modelFields.size === 0) spin.push(`${MODEL_CLASS} 字段集为空`);
if (vectorFields.size === 0) spin.push(`${VECTOR_CLASS} 字段集为空`);
for (const sec of MODEL_SECTIONS) {
  const entries = settings[sec];
  if (!entries || typeof entries !== 'object' || Object.keys(entries).length === 0) {
    spin.push(`生成结果缺少模型段 ${sec}`);
  }
}
if (!settings[VECTOR_SECTION] || typeof settings[VECTOR_SECTION] !== 'object') {
  spin.push(`生成结果缺少 ${VECTOR_SECTION} 段`);
}
if (spin.length) {
  die(
    '❌ 闸门空转: 探针虽返回成功, 但比对所需的结构不成立 —— 本闸门未真正校验字段。\n' +
      spin.map((s) => `   - ${s}`).join('\n') +
      '\n   请检查 scripts/check-graphrag-settings-fields.mjs 与 indexer.create_settings_yaml 是否已失配。'
  );
}

// indexer.py 行号定位 (报告"哪个字段在哪一行")
const indexerLines = fs.existsSync(INDEXER_ABS) ? fs.readFileSync(INDEXER_ABS, 'utf8').split(/\r?\n/) : [];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function fieldLines(field) {
  const re = new RegExp(`^\\s*["']?${esc(field)}["']?\\s*:`);
  const hits = [];
  indexerLines.forEach((l, i) => {
    if (re.test(l)) hits.push(i + 1);
  });
  return hits;
}
const at = (field) => {
  const ls = fieldLines(field);
  return ls.length ? ` (${INDEXER_REL}:${ls.join(',')})` : ` (未在 ${INDEXER_REL} 找到该字段)`;
};

const problems = [];
const allowed = (sec, field) => ALLOW_KEYS.has(`${sec}.${field}`);

// ── 检查 1+2: 模型段字段名 + 必填非空 ──
for (const sec of MODEL_SECTIONS) {
  for (const [id, entry] of Object.entries(settings[sec])) {
    if (!entry || typeof entry !== 'object') {
      problems.push(`[${sec}.${id}] 不是键值对象`);
      continue;
    }
    for (const key of Object.keys(entry)) {
      if (!modelFields.has(key) && !allowed(sec, key)) {
        problems.push(`[${sec}.${id}] 未知字段 "${key}"${at(key)} —— ${MODEL_CLASS} 无此字段 (extra=allow 会静默吞掉)`);
      }
    }
    for (const req of REQUIRED_NONEMPTY) {
      if (!(req in entry)) {
        // 字段缺失时不附行号: fieldLines 只能给全文件出现处, 会指向别的段, 反而误导
        problems.push(`[${sec}.${id}] 缺少必填字段 "${req}" (该段未写出此字段)`);
      } else if (req === 'api_key') {
        if (entry[req] === '' || entry[req] == null) {
          problems.push(`[${sec}.${id}] 必填字段 "${req}" 为空${at(req)} (空 key 会被 provider 拒绝/静默失败)`);
        }
      } else if (typeof entry[req] !== 'string' || entry[req].trim() === '') {
        problems.push(`[${sec}.${id}] 必填字段 "${req}" 为空${at(req)} —— 会静默退回默认端点, 必须显式填值`);
      }
    }
  }
}

// ── 检查 3: vector_store 字段名 + vector_size ──
const vs = settings[VECTOR_SECTION];
for (const key of Object.keys(vs)) {
  if (!vectorFields.has(key) && !allowed(VECTOR_SECTION, key)) {
    problems.push(
      `[${VECTOR_SECTION}] 未知字段 "${key}"${at(key)} —— ${VECTOR_CLASS} 无此字段 (extra=allow 会静默吞掉)`
    );
  }
}
const vsz = vs.vector_size;
if (!('vector_size' in vs)) {
  problems.push(
    `[${VECTOR_SECTION}] 缺少 "vector_size"${at('vector_size')} —— 会退回 graphrag 默认 3072, 与 embedding 维度不符时抛错`
  );
} else if (!Number.isInteger(vsz) || vsz <= 0) {
  problems.push(`[${VECTOR_SECTION}] "vector_size" 非正整数: ${JSON.stringify(vsz)}${at('vector_size')}`);
} else if (Number.isInteger(data.embedding_dims) && vsz !== data.embedding_dims) {
  problems.push(
    `[${VECTOR_SECTION}] "vector_size"=${vsz} 与 GRAPHRAG_EMBEDDING_DIMS=${data.embedding_dims} 不一致${at('vector_size')}`
  );
}

if (problems.length) {
  console.error('❌ GraphRAG settings.yaml 字段名/取值异常 (被 extra=allow 静默吞掉, 不报错却会打默认端点或抛维度错):');
  for (const p of problems) console.error(`   ${p}`);
  console.error(
    `\n共 ${problems.length} 处。请改用模型真字段名 (LLM/embedding 的 base URL 是 "api_base", 不是 "base_url"),` +
      ' 必填字段显式填值; 确需保留的未知字段才登记到 scripts/check-graphrag-settings-fields.mjs 的 ALLOW (含理由 + 日期)。'
  );
  process.exit(1);
}

const ids = MODEL_SECTIONS.map((s) => `${s}=${Object.keys(settings[s]).join(',')}`).join(' ');
console.log(
  `✓ GraphRAG settings 字段名与 graphrag 模型一致 ` +
    `(${MODEL_CLASS} ${modelFields.size} 字段 / ${VECTOR_CLASS} ${vectorFields.size} 字段, graphrag ${data.graphrag_version})`
);
console.log(
  `  已校验: ${ids}; vector_store.vector_size=${vs.vector_size} (dims=${data.embedding_dims}); 必填非空: ${REQUIRED_NONEMPTY.join(', ')}`
);
