// scripts/qb/lib/kp-map.js — Gate B deterministic KP tag → knowledge_points.id mapping
//
// 事实 (QB-P0-AUDIT §8 / F9): parsed kp 标签 1,309 个, taxonomy(gaokao 381 节点, id 形如 BIO-G0-001)
// 确定性全匹配不可达 (~17-22%). 本模块提供确定性匹配 (exact → 规范化 equal → name/subtopic 包含),
// 未命中不强行映射 (Q14 硬约束 0 无效 id, 优先于 Q13 覆盖率).
//
// buildKpIndex(nodes) -> Map<subject, [{id,name,subtopics[]}]>
// mapKpTags(subject, tags, index) -> { matched:[{tag,id,name,how}], unmatched:[string] }

function norm(text) {
  return String(text ?? '')
    .replace(/\s+/g, '')
    .replace(/第/g, '')
    .replace(/章/g, '')
    .replace(/节/g, '')
    .toLowerCase();
}

function flattenSubtopic(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return x.map(flattenSubtopic).join(' ');
  if (typeof x === 'object') {
    const parts = [x.name, x.title, x.subtopic, x.label].filter(Boolean);
    return parts.join(' ');
  }
  return '';
}

export function buildKpIndex(nodes) {
  const index = new Map();
  for (const n of nodes) {
    if (!n || !n.subject) continue;
    if (!index.has(n.subject)) index.set(n.subject, []);
    index.get(n.subject).push({
      id: n.id,
      name: String(n.name ?? '').trim(),
      subtopics: Array.isArray(n.subtopics) ? n.subtopics : [],
    });
  }
  for (const list of index.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id)); // 稳定选择: id 最小优先
  }
  return index;
}

/**
 * 单 tag → 最佳节点 (同 subject). 返回 null 若无命中.
 * 优先级: exact name → norm(name) equal → tag 作为子串出现在 name/subtopics 中.
 */
export function matchTag(subject, tag, index) {
  const nodes = index.get(subject);
  if (!nodes || !tag) return null;
  const t = String(tag).trim();
  if (!t) return null;
  const tn = norm(t);

  for (const n of nodes) {
    if (n.name === t) return { id: n.id, name: n.name, how: 'exact' };
  }
  for (const n of nodes) {
    if (tn && norm(n.name) === tn) return { id: n.id, name: n.name, how: 'norm' };
  }
  // name/subtopic 关键词包含: tag 含某关键词 (关键词长度>=2), 或 tag 是节点 blob 的子串
  for (const n of nodes) {
    const keywords = [n.name, ...n.subtopics.map(flattenSubtopic)]
      .map(norm)
      .filter((k) => k.length >= 2);
    if (tn && keywords.some((k) => tn.includes(k))) {
      return { id: n.id, name: n.name, how: 'substring' };
    }
    const blob = norm(`${n.name} ${n.subtopics.map(flattenSubtopic).join(' ')}`);
    if (tn && blob.includes(tn)) return { id: n.id, name: n.name, how: 'substring' };
  }
  return null;
}

export function mapKpTags(subject, tags, index) {
  const matched = [];
  const unmatched = [];
  for (const raw of tags || []) {
    const hit = matchTag(subject, raw, index);
    if (hit) matched.push({ tag: String(raw).trim(), ...hit });
    else unmatched.push(String(raw).trim());
  }
  return { matched, unmatched };
}
