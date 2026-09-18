#!/usr/bin/env python3
"""
qbx — 原卷原子化提取库 (P1 核心)

关键事实 (实测, 2026-09-17):
  * 原卷 1634 份在 database/incoming/gaokao|zhongkao, 9 学科 × 2008-2025
  * 公式载体 = MathType / Equation 3.0 OLE 对象: <w:object> > <v:imagedata r:id> → .wmf
    (北京2024数学卷 698 个; OMML m:oMath = 0)
  * 只认 <a:blip> 的老流水线会丢掉全部公式 → stem 出现空洞
  * 答案有三种排布, 必须都支持:
      A) 每题后跟  【答案】X / 【解析】 / 【详解】
      B) 卷末集中答案区  (…生物·答案  之后整块)
      C) 紧凑连写      1`5. CBAAB   6~10.CDBCB   11~13.DBA
  * 段落切分必须走 XML 树遍历; 正则会吃到 <w:pPr> 里的标签

对应关系: exam_questions.stem/options/answer/analysis + has_image/has_formula
"""
from __future__ import annotations

import collections

import hashlib
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
V = '{urn:schemas-microsoft-com:vml}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
M = '{http://schemas.openxmlformats.org/officeDocument/2006/math}'

# ───────────────────────── 身份识别 ─────────────────────────

PROVINCE_BY_NAME = {
    '安徽': 'anhui', '北京': 'beijing', '重庆': 'chongqing', '福建': 'fujian',
    '甘肃': 'gansu', '广东': 'guangdong', '广西': 'guangxi', '贵州': 'guizhou',
    '海南': 'hainan', '河北': 'hebei', '黑龙江': 'heilongjiang', '河南': 'henan',
    '湖北': 'hubei', '湖南': 'hunan', '江苏': 'jiangsu', '江西': 'jiangxi',
    '吉林': 'jilin', '辽宁': 'liaoning', '内蒙古': 'neimenggu', '宁夏': 'ningxia',
    '青海': 'qinghai', '陕西': 'shaanxi', '山东': 'shandong', '上海': 'shanghai',
    '山西': 'shanxi', '四川': 'sichuan', '天津': 'tianjin', '新疆': 'xinjiang',
    '西藏': 'xizang', '云南': 'yunnan', '浙江': 'zhejiang', '全国': 'national',
}
PROVINCE_BY_SLUG = {
    'shaanxi': 'shaanxi', 'anhui': 'anhui', 'beijing': 'beijing', 'chongqing': 'chongqing',
    'fujian': 'fujian', 'gansu': 'gansu', 'guangdong': 'guangdong', 'guangxi': 'guangxi',
    'guizhou': 'guizhou', 'hainan': 'hainan', 'hebei': 'hebei', 'henan': 'henan',
    'hubei': 'hubei', 'hunan': 'hunan', 'jiangsu': 'jiangsu', 'jiangxi': 'jiangxi',
    'jilin': 'jilin', 'liaoning': 'liaoning', 'neimenggu': 'neimenggu', 'ningxia': 'ningxia',
    'qinghai': 'qinghai', 'shandong': 'shandong', 'shanghai': 'shanghai', 'shanxi': 'shanxi',
    'sichuan': 'sichuan', 'tianjin': 'tianjin', 'xinjiang': 'xinjiang', 'xizang': 'xizang',
    'yunnan': 'yunnan', 'zhejiang': 'zhejiang', 'national': 'national',
}

# 试卷类型: 文件名关键词 → paper_type (与 exam_papers.ck_exam_papers_paper_type 白名单一致)
#
# 两个必须遵守的坑:
# 1) 尾部的 `卷` 必须可选 (`卷?`)。源文件名普遍写作「（新课标Ⅲ）」而不是「新课标Ⅲ卷」,
#    早期三条新课标规则写成 `新课标\s*[ⅢIII3]卷` (字面卷), 于是**全部失配**,
#    掉到兜底 'independent' → 全国卷被当成独立命题卷, 且省份为空,
#    直接后果是「新课标Ⅱ」和「新课标Ⅲ」身份撞车 (实测 39 组)。
# 2) Ⅲ 必须排在 Ⅱ 前面。若先试 Ⅱ 的 `(?:Ⅱ|II|2)`, 则 `新课标III` 会被 'II' 抢先匹配 → 误判 national_ii。
#    字母形式用 alternation 而非字符组, 才能表达「两个字母的 II」。
PAPER_TYPE_RULES = [
    (r'全国\s*甲\s*卷?', 'national_a'),
    (r'全国\s*乙\s*卷?', 'national_b'),
    (r'新课标\s*(?:Ⅲ|III|3)\s*卷?', 'national_iii'),
    (r'新课标\s*(?:Ⅱ|II|2)\s*卷?', 'national_ii'),
    (r'新课标\s*[ⅠI1]\s*卷?', 'national_i'),
    (r'新高考\s*(?:Ⅱ|II|2)\s*卷?', 'new_gaokao_ii'),
    (r'新高考\s*[ⅠI1]\s*卷?', 'new_gaokao_i'),
    (r'全国\s*卷', 'national_new'),
    (r'大纲\s*版?\s*卷?', 'national_outline'),
]
# 全国卷口径: paper_type 为国家卷时, province_code 用 'national' (与库内既有约定一致)
NATIONAL_TYPES = {
    'national_a', 'national_b', 'national_i', 'national_ii', 'national_iii',
    'national_new', 'national_outline', 'new_gaokao_i', 'new_gaokao_ii',
}
# 中文科目词 (语料文件名用中文, 目录名用英文 slug)。
# 语料里存在**放错目录**的文件 (实测: biology/2010/2010年高考生物政治（山东）内容全是政治题),
# 所以文件名里的科目词优先于目录推断 —— 但只在**唯一无歧义**时才覆盖。
SUBJECT_BY_CN = {
    '语文': 'chinese', '数学': 'math', '英语': 'english', '物理': 'physics',
    '化学': 'chemistry', '生物': 'biology', '思想政治': 'politics', '政治': 'politics',
    '历史': 'history', '地理': 'geography',
}
SUBJECT_SLUGS = {
    'chinese': 'chinese', 'math': 'math', 'english': 'english', 'physics': 'physics',
    'chemistry': 'chemistry', 'biology': 'biology', 'politics': 'politics',
    'history': 'history', 'geography': 'geography',
}
EXAM_LEVELS = {'gaokao', 'zhongkao'}

_YEAR_RE = re.compile(r'(19|20)\d{2}')
_SLUG_RE = re.compile(r'_(chinese|math|english|physics|chemistry|biology|politics|history|geography)_')


def parse_identity(path: Path, subject_hint: str | None = None) -> dict:
    """文件名 → (year, province_code, subject, paper_type)。best-effort, 带置信度。
    注意: 目录结构是 database/incoming/<exam_level>/<subject>/<year>/<file>,
    所以按目录反推时必须跳过 exam_level 层 (gaokao|zhongkao), 否则 subject 会变成 'gaokao'。"""
    name = path.stem
    year = None
    ym = _YEAR_RE.search(name)
    if ym:
        year = int(ym.group(0))
    if year is None:  # 退化: 用父目录名的年份
        for part in reversed(path.parts[:-1]):
            if re.fullmatch(r'(19|20)\d{2}', part):
                year = int(part)
                break

    exam_level = next((p for p in path.parts if p in EXAM_LEVELS), None)

    subject = subject_hint
    if subject in EXAM_LEVELS or subject not in SUBJECT_SLUGS:
        subject = None
    if subject is None:
        sm = _SLUG_RE.search(name)
        if sm:
            subject = sm.group(1)
    if subject is None:
        for part in reversed(path.parts[:-1]):
            if part in SUBJECT_SLUGS:
                subject = part
                break

    # 文件名里的中文科目词优先 —— 只在唯一无歧义时覆盖目录推断 (修「放错目录」)
    _cn_hits = {v for k, v in SUBJECT_BY_CN.items() if k in name}
    if len(_cn_hits) == 1:
        subject = _cn_hits.pop()

    province, conf = None, 'low'
    for cn, code in PROVINCE_BY_NAME.items():
        if cn in name:
            province, conf = code, 'high'
            break
    if province is None:
        for slug, code in PROVINCE_BY_SLUG.items():
            if re.search(rf'(^|_){slug}(_|$)', name):
                province, conf = code, 'high'
                break
    if province is None:
        for slug, code in PROVINCE_BY_SLUG.items():
            if slug in name.lower():
                province, conf = code, 'medium'
                break

    paper_type = None
    for pat, pt in PAPER_TYPE_RULES:
        if re.search(pat, name):
            paper_type = pt
            break
    if paper_type is None and province == 'national':
        paper_type = 'national_new'
    if paper_type is None:
        paper_type = 'independent'
    # 全国卷没有单一省份, 但身份与检索都需要一个稳定的省份口径 → 统一 'national'
    # (库内既有 37 卷即用此约定)。不这么做的话 province_code 留在 NULL,
    # 而 Postgres 唯一索引把 NULL 视为互不相同, 会让真正重复的卷悄悄并存。
    if province is None and paper_type in NATIONAL_TYPES:
        province, conf = 'national', 'medium'
    if province is None:
        # 兜底: 多省联卷 (如 2025「黑吉辽蒙卷」= 黑龙江/吉林/辽宁/内蒙古四省共用)
        # 与其它无法归到单一省份的卷, 仍然**不能留空** —— exam_papers.province_code
        # 有外键指向 provinces.code, 写 NULL 或 'unknown' 会被 FK 拒掉。
        # 落到 'national' (provinces 里已有该 code) 语义上是「不属于单一省份」。
        province, conf = 'national', 'low'

    is_analysis = bool(re.search(r'解析|详解|答案', name))
    return {
        'year': year, 'province_code': province, 'subject': subject,
        'exam_level': exam_level,
        'paper_type': paper_type, 'identity_confidence': conf,
        'has_answer_in_name': is_analysis,
        'source_name': path.name,
    }


# ───────────────────────── docx 读取 ─────────────────────────

def load_rels(z: zipfile.ZipFile) -> dict:
    rels = z.read('word/_rels/document.xml.rels').decode('utf-8', 'ignore')
    return {rid: tgt for rid, tgt in re.findall(r'Id="([^"]+)"[^>]*?Target="([^"]+)"', rels)}


def _walk(el, rels, out, media):
    tag = el.tag
    if tag == W + 't':
        out.append(el.text or '')
        return
    if tag == V + 'imagedata':                       # MathType / Equation3.0 公式
        rid = el.get(R + 'id')
        if rid:
            out.append(f'⟦F:{rid}⟧')
            media.append({'kind': 'formula', 'rid': rid, 'target': rels.get(rid)})
        return
    if tag == A + 'blip':                            # 浮动图片
        rid = el.get(R + 'embed')
        if rid:
            out.append(f'⟦IMG:{rid}⟧')
            media.append({'kind': 'figure', 'rid': rid, 'target': rels.get(rid)})
        return
    if tag == M + 'oMath':                            # 真 OMML (少见)
        txt = ''.join(t.text or '' for t in el.iter(M + 't'))
        out.append(f'⟦OMML:{txt}⟧' if txt else '⟦OMML⟧')
        media.append({'kind': 'omml', 'rid': None, 'target': None, 'omml': txt})
        return
    for child in el:
        _walk(child, rels, out, media)


def read_paras(path: Path):
    """返回 (段落列表[(文本, media)], ZipFile)"""
    z = zipfile.ZipFile(path)
    rels = load_rels(z)
    try:
        root = ET.fromstring(z.read('word/document.xml'))
    except ET.ParseError as e:
        raise ValueError(f'document.xml 解析失败: {e}') from e
    body = root.find(W + 'body')
    paras = []
    for p in (body.iter(W + 'p') if body is not None else []):
        out, media = [], []
        _walk(p, rels, out, media)
        paras.append((''.join(out), media))
    return paras, z


# ───────────────────────── 锚点与切分 ─────────────────────────

QNUM = re.compile(r'^\s*(\d{1,2})\s*[.．、]\s*(?=\S|$)')
# 候选锚点: 字母 + 点号。**不加前瞻断言** —— 见 _anchors() 的说明。
OPT_ANCHOR_ANY = re.compile(r'([A-D])\s*[.．、]\s*')
# 选项**标签**（比 OPT_ANCHOR_ANY 严: 点号后必须跟 >=2 个可见字符, 即真的有选项正文）。
# 用途: 判定一段文字是不是「题干/选项正文」而不是「答案串」—— 见 _expand_compact_runs 闸①。
OPTION_LABEL = re.compile(r'[A-D]\s*[.．、]\s*\S{2,}')
# 独立答案行: 整行只有「数字 + 分隔符 + 单个字母」(`1．C` / `12.B`), 空行/空格可有。
# 用途: 这种行**不是题号**(见 split_questions 的说明) —— 2011 上海地理的答案区就是这种形态,
# 曾因此被当成 25 道新题, 把题号唯一性彻底破坏, 导致 51 道客观题 0 答案。
ANS_ONLY_LINE = re.compile(r'^\s*\d{1,3}\s*[.．、:：]\s*[A-D]\s*$')
# 独立答案行(带答案标签): `1.【答案】B` / `1.答案：C` / `1. 参考答案 A` —— 同样**不是题号**。
# 实测 2009 上海历史: 答案区全是这种形态, 官方答案率 0, 且这些行被当成幻影题。
ANS_STANDALONE = re.compile(
    r'^\s*(\d{1,3})\s*[.．、]?\s*(?:【\s*答\s*案\s*】|答\s*案|参考答案)\s*[:：]?\s*([A-D])\s*$')
FILL_BLANK = re.compile(r'_{2,}|＿{2,}|（\s{2,}）|\(\s{2,}\)|（\s*）')
SUBQ = re.compile(r'[（(]\s*(\d{1,2})\s*[)）]|([①②③④⑤⑥⑦⑧⑨⑩])')

ANS_INLINE = re.compile(r'[【\[(]\s*(?:参考答案|答案)\s*[】\])]?\s*[:：]?\s*(.*)$')
ANA_INLINE = re.compile(r'[【\[(]\s*(?:解析|详解|分析|点拨|考点|解答|评分标准)\s*[】\])]?\s*[:：]?\s*(.*)$')
HAS_ANS_TAG = re.compile(r'[【\[]\s*(?:参考答案|答案)\s*[】\]]')
HAS_ANA_TAG = re.compile(r'[【\[]\s*(?:解析|详解|分析|点拨|考点)\s*[】\]]')
# 无括号形态 (语文/英语类): "答案 C" / "答案是B。" / "答案为 D"
#   **必须允许「是/为」**: 实测 2012 重庆英语整批答案写成「答案是B。」, 旧正则捕获成「是B。」,
#   ANS_SHORT 认不出首字母 → 整行掉进 analysis/stem, 导致 32 道选择题无答案。
ANS_BARE = re.compile(r'^\s*(?:参考答案|答案)\s*(?:是|为|选)?\s*[:：]?\s*(.*)$')
ANA_BARE = re.compile(r'^\s*(?:解析|详解|分析|点拨|考点|解答|评分标准)\s*[:：]?\s*(.*)$')
ANS_SHORT = re.compile(r'^([A-D])(?![A-Za-z0-9])')

# 卷末集中答案区锚点: 短行(<=40字)内含该锚点即算。
# 包含「以答案结尾」形态 (如 `2010广东语文卷答案`), 早期版本为求稳去掉了它, 结果语文卷
# 整卷识别不出答案区; 现在有「多候选 + 质量分择优」兜底, 放宽是安全的。
ANSWER_SECTION_STRONG = re.compile(
    r'(参考答案(与试题解析|及解析|与解析|与答案)?|答案与解析|试题答案|答案详解|'
    r'标准答案|答案解析|完整答案|试题解析|[·．\-—]\s*答案\s*$|答案\s*$)')
ANSWER_LINE_MAX = 40
# 单个卷子最多提交多少个 tail 候选给择优器 (宁可多试, 交质量分裁决)
MAX_TAIL_CANDIDATES = 6
# 学科网老式解析五段锚点 (无括号): 考点：/专题：/分析：/解答：/点评：
ANA_LABEL = re.compile(r'^\s*(考点|专题|分析|解答|点评|思路|解析|详解|命题立意|考查)\s*[:：]')
# 从解析正文反推答案: 故选D / 故答案选D / 故答案为C / 答案选C / 故选：C
ANS_FROM_TEXT = re.compile(
    r'(?:故\s*答案\s*(?:选|为|是)?|故\s*选|答案\s*选|故选|答案\s*[:：]|故\s*答案\s*[:：])'
    r'\s*[：:，,]?\s*([A-D])(?![A-Za-z0-9])')
# 填空题答案: '故答案为：1．' / '故填：⟦IMG:rId54⟧' / '答案：2n+1'
# **为什么必须有这条**: ANS_FROM_TEXT 只认 A-D 字母答案, 而数学/化学/生物的填空题答案是
# 数字/表达式 —— 全部失配。实测 2017 江苏数学 52 题只捞到 1 个答案(且是垃圾 '一.填空题'),
# 26 个题号全空。这不是「源里没答案」, 而是「正则只认字母」。
# 截取到第一个句末标点为止, 并限长 60 —— 避免把整段解析当成答案吞进来。
ANS_FILL = re.compile(
    r'(?:故\s*答案\s*(?:为|是)|故\s*填|故填|答\s*案\s*[:：]|答\s*案\s*为)'
    r'\s*[:：]?\s*([^．。\n；;]{1,60})')
ANA_JUNK_ANS = re.compile(r'^(?:一|二|三|四|五|六|七|八)[.．、]?\s*(?:填空题|选择题|解答题|计算题|简答题)')

JUNK_LINE = re.compile(
    r'^\s*(绝密|保密|注意事项|考试时间|本试卷|考生|试卷说明|命题人|审核人|第\s*[一二三四五六七八九十]+\s*部分|'
    r'[（(]\s*[一二三四五六七八九十]+\s*[)）]|.{0,6}共\s*\d+\s*小?题|.{0,8}满分\s*\d+|'
    r'[\-—=]{4,}|第\s*[ⅠⅡⅢIVX]+\s*卷|分\s*值\s*[:：]|I{1,3}\s*[.．]|Section\s+[A-D])')

SECTION_HEAD = re.compile(
    r'^\s*[一二三四五六七八九十]+\s*[、.．]\s*(选择题|填空题|解答题|非选择题|单项选择题|多项选择题|'
    r'综合题|计算题|实验题|简答题|论述题|材料题|现代文|文言文|书面表达|作文|语言知识|阅读理解|完形填空)')


def _route_line(cur, t, media):
    """把一行文本按当前段落状态路由到 stem / options / answer / analysis。
    统一处理「题号锚点之后紧跟答案/解析」的形态 (如 "1.答案 C"、"12.B【解析】…")。"""
    # 1) 行内答案锚点 (【答案】X / 答案 X / B【解析..)
    if HAS_ANS_TAG.search(t):
        mm = ANS_INLINE.search(t)
        cur['answer'] = (cur['answer'] or '') + (mm.group(1) if mm else '')
        cur['seg'] = 'answer'
        cur['media'].extend(media)
        return
    m_bare = ANS_BARE.match(t)
    if m_bare and (m_bare.group(1).strip() == '' or ANS_SHORT.match(m_bare.group(1))
                   or cur['seg'] in ('options', 'stem')):
        rest = m_bare.group(1)
        m_short = ANS_SHORT.match(rest)
        cur['answer'] = (cur['answer'] or '') + (m_short.group(1) if m_short else '')
        cur['seg'] = 'answer'
        cur['media'].extend(media)
        tail = rest[m_short.end():].strip() if m_short else ''
        if tail:
            _route_line(cur, tail, media)
        return
    # 2) 行内解析锚点
    if HAS_ANA_TAG.search(t):
        mm = ANA_INLINE.search(t)
        body = mm.group(1) if mm else re.sub(r'^[【\[(]?\s*\S{2,4}\s*[】\])]?', '', t)
        cur['analysis'] = (cur['analysis'] or '') + body
        cur['seg'] = 'analysis'
        cur['media'].extend(media)
        return
    m_ana = ANA_BARE.match(t)
    if m_ana and cur['seg'] in ('answer', 'stem', 'options', 'analysis'):
        cur['analysis'] = (cur['analysis'] or '') + m_ana.group(1)
        cur['seg'] = 'analysis'
        cur['media'].extend(media)
        return
    # 学ke网五段式: 考点：/专题：/分析：/解答：/点评： → 进入解析段
    if ANA_LABEL.match(t):
        cur['analysis'] = (cur['analysis'] or '') + t
        cur['seg'] = 'analysis'
        cur['media'].extend(media)
        return
    # 3) 题干区 -> 选项判定
    if cur['seg'] == 'stem':
        anchors = _anc(t, cur['options'])
        if anchors and _is_option_line(t, anchors, 'stem', cur['options']):
            _absorb_options(cur, t, anchors)
            cur['seg'] = 'options'
            cur['media'].extend(media)
            return
        if SECTION_HEAD.match(t):
            return
        cur['stem'] += t
        cur['media'].extend(media)
        return
    # 4) 选项区续行
    if cur['seg'] == 'options':
        anchors = _anc(t, cur['options'])
        if anchors and _is_option_line(t, anchors, 'options', cur['options']):
            _absorb_options(cur, t, anchors)
        else:
            last = max(cur['options']) if cur['options'] else None
            if last:
                cur['options'][last] = (cur['options'][last] + t).strip()
            else:
                cur['stem'] += t
        cur['media'].extend(media)
        return
    # 5) 答案区 / 解析区续行
    if cur['seg'] == 'answer':
        # ⚠️ **不能无脑并入** (实测 2026-09-18): 一旦某行把 seg 置成 'answer',
        # 后面每一段都会被追加进答案字段 —— 整篇听力原文 / 写作范文 / 章节标题
        # 就是这样灌进 answer 的 (inline_routed 里 38 处答案字段是整段正文, 根因在此)。
        # 只接受「像答案的短内容」; 不像就**宁可丢掉也不污染** —— 错答案比缺答案更糟。
        if _looks_like_answer_continuation(t):
            cur['answer'] = (cur['answer'] or '') + t
            cur['media'].extend(media)
        return
    cur['analysis'] = (cur['analysis'] or '') + t
    cur['media'].extend(media)


PURE_NUM = re.compile(r'^\s*\d{1,3}\s*$')
PURE_LET = re.compile(r'^\s*[A-D]\s*[.．]?\s*$')
# 表头单元: 很短且不是数字/字母 ('题号' / '答案' / '参考答案' / '分值')
TABLE_HEAD = re.compile(r'^\s*(题\s*号|答\s*案|参考答案|分\s*值|得\s*分)\s*$')


def expand_answer_tables(paras) -> dict:
    """把「题号行 + 答案行」的**双行表格**还原成 {题号: 答案}。

    实测形态 (2011 上海历史·参考答案, 该卷 30 道客观题此前答案率 **0**):
        '题号' '1' '2' … '10'  '答案' 'B' 'D' 'A' 'C' …
    表格被 read_paras **行主序摊平**成独立段落 —— 既不是 `1．C`(独立答案行),
    也不是 `1-10 ABC`(紧凑串), 所以此前三种路径全部抽不到。
    2008 上海历史的形态一样, 只是答案带点号 ('A.' 'D.' …)。

    算法: 找「连续纯数字段」→ 允许跳过表头单元 → 找「连续单字母段」→ 一一对应。
    安全性: 要求数字段 >=3 个且**严格递增**, 字母段长度 >= 数字段长度,
    且两段之间只允许表头 —— 普通正文不会长成这样。
    """
    out = {}
    texts = [((it[0] if isinstance(it, (tuple, list)) else it) or '').strip() for it in paras]
    n = len(texts)
    i = 0
    while i < n:
        if not PURE_NUM.match(texts[i]):
            i += 1
            continue
        j = i
        nums = []
        while j < n and PURE_NUM.match(texts[j]):
            nums.append(int(texts[j]))
            j += 1
        if len(nums) < 3 or any(nums[k + 1] <= nums[k] for k in range(len(nums) - 1)):
            i = j if j > i else i + 1
            continue
        k = j
        # 允许跳过表头单元 **和空段落** —— 实测 2008 上海历史在「题号行」与「答案行」
        # 之间夹了一个空段, 不容忍空段会导致还原出 0 个 (该卷 39 道客观题因此全丢)。
        while k < n and (TABLE_HEAD.match(texts[k]) or not texts[k]):
            k += 1
        lets = []
        m = k
        while m < n and PURE_LET.match(texts[m]):
            lets.append(re.sub(r'[.．]', '', texts[m]))
            m += 1
        if len(lets) >= len(nums):
            for idx, num in enumerate(nums):
                out.setdefault(num, lets[idx])
            i = m
        else:
            i = j if j > i else i + 1
    return out


def number_ambiguity(qs) -> dict:
    """{题号: 该题号下**不同题干**的个数} —— 答案归属护栏的统一判据。

    为什么不能只数**行数**: 实测 2009 上海历史, 同一道题在卷中出现两次 (题干逐字相同),
    老护栏按行数判成「题号不唯一」→ 已扫出的 28 个答案**一个都没补上** (该卷 30 道客观题答案率 0)。
    护栏的目的是回答「能否判断这个答案属于哪一道题」; 重复出现的**同一道题**不存在歧义。
    所以按「去重后的题干」计数, 而不是按题行计数。
    """
    seen = {}
    for q in qs:
        key = PLACEHOLDER_RE.sub('', (q.get('stem') or '')).strip()[:80]
        seen.setdefault(q['number'], set()).add(key)
    return {n: len(s) for n, s in seen.items()}


def backfill_table_positional(qs, paras) -> int:
    """分叉卷 (A组/B组) 的答案归属: 用**段落位置**把答案表配给「最早出现」的那道同号题。

    为什么需要 (实测 2008 上海历史: 39 道客观题只落地 15 道)
    ------------------------------------------------------
    上海卷是「A组/B组」**分叉卷** —— 题号 1-15 在 A 组和 B 组**各出现一次, 且是不同的题**,
    而文件里的参考答案表只覆盖其中一组。此时「题号唯一」护栏**正确拒绝** (乱配会给一半题写错答案),
    结果是答案池有 30 个、只落地 15 个。

    判据 (为什么「最早出现的那道」是对的)
    ------------------------------------
    文档顺序是 `A组题目 → B组题目 → … → 卷末参考答案`, 参考答案表按**同样的组顺序**排列,
    所以**第一张表对应第一组题** = 文档中最早出现的那批同号题。
    这正是分叉卷的排版约定, 不是随便挑一个。

    审计: 这类补写标 `answer_source='table_positional'`, 与高置信来源分开 ——
    万一某份卷不符合上述约定, 可以只回滚这一类, 不影响其它答案。
    """
    pool = expand_answer_tables(paras)
    if not pool:
        return 0
    # **收紧**: 必须有显式的组标记作为证据, 否则不猜。
    # 为什么: table_positional 写进去的答案与表格自洽, 冲突检查**验不了它**
    # (核对池就是那张表), 所以只能靠「文档里确实有 A组/B组 标记」这个外部证据。
    # 没有组标记的卷 → 歧义无法消解 → 保持不补 (错答案比缺答案更糟)。
    group_marks = []
    for i, it in enumerate(paras):
        t = ((it[0] if isinstance(it, (tuple, list)) else it) or '').strip()
        if re.match(r'^[AB]\s*[.．、]?\s*组', t) or re.match(r'^[AB]组[（(]', t):
            group_marks.append(i)
    if len(group_marks) < 2:
        return 0
    b_start = next((i for i in group_marks
                    if re.match(r'^B\s*[.．、]?\s*组', (paras[i][0] if isinstance(paras[i], (tuple, list)) else paras[i]) or '')
                    or re.match(r'^B组[（(]', ((paras[i][0] if isinstance(paras[i], (tuple, list)) else paras[i]) or '').strip())),
                   None)
    if b_start is None:
        return 0
    amb = number_ambiguity(qs)
    filled = 0
    for n, a in pool.items():
        if amb.get(n, 0) <= 1:
            continue                       # 不歧义 → 由高置信路径处理, 不走这里
        cands = [q for q in qs if q['number'] == n and not q.get('answer')]
        if not cands:
            continue
        cands.sort(key=lambda q: q.get('para_index', 10 ** 9))
        first = cands[0]
        if first.get('para_index', 10 ** 9) >= b_start:
            continue                       # 落在 B 组范围 → 第一张表不覆盖它, 不补
        first['answer'] = a
        first['answer_source'] = 'table_positional'
        filled += 1
    return filled


def backfill_answer_tables(qs, paras) -> int:
    """把双行表格还原出的答案回填给缺答案的题 (见 expand_answer_tables)。"""
    pool = expand_answer_tables(paras)
    if not pool:
        return 0
    cnt = number_ambiguity(qs)
    filled = 0
    for q in qs:
        if q.get('answer'):
            continue
        n = q['number']
        if cnt.get(n) != 1:            # 与既有归属同一护栏: 题号唯一才补
            continue
        a = pool.get(n)
        if a:
            q['answer'] = a
            q['answer_source'] = 'answer_table'
            filled += 1
    return filled


def _looks_like_answer_continuation(t: str) -> bool:
    """判定一行是否还能并入「答案」字段 (见 _route_line 第 5 条)。

    两道否决:
      ① 太长 —— 正常答案(含填空的式子)不会超过 40 字; 超过的基本是正文/范文/标题。
      ② 它自已被 `_expand_compact_runs` 展开过 —— 说明它像「紧凑答案串」
         (如 `1-5 CABAC 6-10 BBACC`), 那是**别的题**的答案,
         由 backfill_compact_all 在答案区统一展开, 不能并进当前这道题。
    """
    s = PLACEHOLDER_RE.sub('', t).strip()
    if not s:
        return False
    if len(s) > 40:
        return False
    if _expand_compact_runs(s):
        return False
    return True


def split_questions(paras):
    """Pass A: 按题号锚点切片 (只切题目区; 答案区由 find_answer_section 分离).
    锚点规则: 题号单调递增即视为新题 —— 修正「大跨度跳号被并入上一题」的缺陷
    (实测: 英语陕西2014 语音知识 5 题后接 11 题, 旧规则只切出 5 题, 应为 40+)."""
    qs, cur = [], None

    def flush():
        nonlocal cur
        if cur is not None:
            qs.append(cur)
        cur = None

    for _pi, (text, media) in enumerate(paras):
        t = text.replace('\u3000', ' ').replace('\xa0', ' ').strip()
        if not t and not media:
            continue
        m = QNUM.match(t)
        # ⚠️ **独立答案行 (`1．C`) 不是题号** —— 实测 2011 上海地理 (缺口最大的卷):
        # 答案区 25 行 `1．C … 25．D` 被当成了 25 道「新题」(题号=1..25, 题干="C"),
        # 于是题号 1 在全卷出现 **18 次**、2 出现 6 次 …… 而答案归属的护栏是
        # 「题号全卷唯一」→ 整批挡死, 该卷 51 道客观题**一个答案都没进来**。
        # 判据安全: 整行只有「数字+分隔符+单个字母」, 不可能是题干。
        # 跳过之后, 这些答案由 backfill_compact_all 扫全段落时按题号归属
        # (`_expand_compact_runs('1．C')` → {1:'C'})。
        if m and (ANS_ONLY_LINE.match(t) or ANS_STANDALONE.match(t)):
            continue
        if m:
            n = int(m.group(1))
            # 题号单调递增 → 新题; n==1 允许重启 (实测: 部分卷子答案区/大题会从 1 重新编号)
            if cur is None or n > cur['number'] or n == 1:
                flush()
                cur = {'number': n, 'stem': '', 'options': {},
                       'answer': None, 'analysis': None,
                       'sub_questions': [], 'media': [],
                       'seg': 'stem', 'raw': [], 'para_index': _pi}
                rest = t[m.end():].strip()
                cur['raw'].append(t)
                cur['media'].extend(media)
                if rest:
                    _route_line(cur, rest, media)
                continue
            # n <= 上一题号: 正文里的编号引用, 不视为题号
        if cur is None:
            continue
        cur['raw'].append(t)
        _route_line(cur, t, media)

    flush()
    return qs


def _anc(t, opts):
    """在一行里挑出「选项标签锚点」。

    做法: 先无脑匹配所有 `字母+点号`, 再**只保留构成 A→B→C→D 严格递增序列的那些**。
    这样既是宽松的又不会误伤:

      * `startB. have startedC. startedD. had started`
        —— 旧版用了 `(?<![0-9A-Za-z])`, 紧跟拉丁字母的 B./C./D. 全被拦掉, 只剩 A,
           于是整行都并进 A 选项。实测这一类占剩余粘连的绝大多数。
      * 英文单词里的字母 (rRNA / DNA) 后面没有点号, 本来就不会被匹配;
        万一匹配到 (如 `etc.A.`), 序列过滤也会把它排除。

    种子: 还没有任何选项就从 A 开始; 已有选项则从 max(已有) 的**下一个字母**开始。
    行首若重新出现 A, 允许重启序列 (少量卷子会把新一题的选项接在同一段里)。
    """
    if not opts:
        expected = 0
    else:
        expected = ord(max(opts)) - 64          # 'A'→1, 所以下一个期望字母的 0 基下标
    out = []
    for m in OPT_ANCHOR_ANY.finditer(t):
        idx = ord(m.group(1)) - 65              # 0=A, 1=B, ...
        if idx == 0 and m.start() <= 2:
            expected = 0                        # 行首重新从 A 开始
        if idx == expected:
            out.append(m)
            expected += 1
    return out


def _is_option_line(t: str, anchors, seg: str = 'stem', existing=None) -> bool:
    """判定是否选项行。

    题干区(seg='stem')从严: 起点必须是 A 且靠行首, 或一行内有 >=2 个锚点 ——
      防止题干里的「选项 B 的说法正确」这类文字被误当成选项。

    选项区(seg='options')从宽: **行首的单个 B/C/D 就是一个新选项**。
      历史缺陷: 早期两个区共用「必须从 A 开始」这一条, 于是每行一个选项的卷子
      (非常普遍) 里 `B. ...` 只有 1 个锚点、又不是 A → 被判为非选项行 →
      拼接到上一选项上, 结果 B/C/D 全部粘进 A。
      实测该类粘连占「有选项的题」的 19.31% (4121 / 21338)。
    """
    if not anchors:
        return False
    first = anchors[0]
    if len(anchors) >= 2:
        return True
    if first.start() > 2:
        return False
    return first.group(1) == 'A' or seg == 'options'


def _absorb_options(cur, t, anchors):
    """把一行里的锚点切成选项。
    另外: 若首锚点不是 A 且锚点前还有正文, 这段前导文本就是 A 选项的内容
    (源文档常见 `Passengers are full of curiosity.B. ...` 这种 A 标签丢失的写法)。"""
    if anchors and anchors[0].group(1) != 'A' and anchors[0].start() > 0:
        lead = t[:anchors[0].start()].strip()
        if lead and 'A' not in cur['options']:
            cur['options']['A'] = lead
    for k, om in enumerate(anchors):
        end = anchors[k + 1].start() if k + 1 < len(anchors) else len(t)
        label = om.group(1)
        val = t[om.end():end].strip()
        cur['options'][label] = (cur['options'].get(label, '') + val).strip()


# ───────────────── Pass B/C: 卷末集中答案区 + 紧凑答案串 ─────────────────

def _expand_compact_runs(text: str) -> dict:
    """
    把紧凑答案串展开成 {题号: 答案}。支持写法:
      1. C 2. B            逐题
      1`5. CBAAB           范围+答案串
      6~10.CDBCB 11~13.DBA 连写多段范围
      1-5 ABCDE
      21.B  22.A          点号前置

    ⚠️ 实测过的坑 (2026-09-18, 曾造成 10.4% 错答案)
    ------------------------------------------------------------------
    选项行 `21. A. xxx  B. yyy  C. zzz  D. www` 会被形态2 读成「21 题答案是 A」:
    `21` + `.` + `A`, 而 `A` 后面是 `.` 不是字母数字 → 前瞻通过 → out[21]='A'。
    实测后果: 「按节匹配」回填的答案里 18/173 = 10.4% 是错的, 且**错的清一色是 A**;
    已入库的 `answer_section` 也有同一个毛病 (上海秋考 Q2-Q5 库全='A', 源是 C/D/C/D)。

    两道闸:
      ① 段落级: 整段里若出现 >=2 个「选项标签」(`A. 正文`), 就认定这是**题干/选项正文**,
         整段不抽答案 —— 答案串段落不会长这样。
      ② 匹配级: 拒绝 `N. X. 正文` 这种「字母后面还跟着带正文的点号」的形态,
         只接受 `N. X` / `N. X 解析...` / `N. X【解析】...`。
    取向: **错答案比缺答案更糟**, 所以宁可漏抽也不误抽。
    """
    out = {}
    s = text
    # 归一化分隔符
    s = s.replace('`', '-').replace('～', '~').replace('—', '-').replace('–', '-')
    s = s.replace('．', '.').replace('、', '.')

    # 闸①: 段落级 —— 选项块不是答案串
    if len(OPTION_LABEL.findall(s)) >= 2:
        return out

    # 形态1: 范围 + 字母串  "6-10.CDBCB"  /  "1-5 ABCDE"
    for m in re.finditer(r'(\d{1,2})\s*[-~]\s*(\d{1,2})\s*[.．:：]?\s*([A-Da-d\s]{2,60}?)(?=\s*\d{1,2}\s*[-~.]|\s*$)', s):
        lo, hi = int(m.group(1)), int(m.group(2))
        letters = re.sub(r'\s+', '', m.group(3))
        if all(c.isalpha() for c in letters) and hi - lo + 1 == len(letters):
            for i, ch in enumerate(letters):
                out[lo + i] = out.get(lo + i, ch.upper())

    # 形态2: 逐题 "21.B" 或 "21. B" —— 加闸② 防选项行
    for m in re.finditer(r'(?<![0-9])(\d{1,2})\s*[.．:：]\s*([A-Da-d])(?![A-Za-z0-9])', s):
        tail = s[m.end():]
        if re.match(r'\s*[.．、]\s*\S{2,}', tail):
            continue                      # `21. A. 某选项正文` → 这是选项行, 不是答案
        n, a = int(m.group(1)), m.group(2).upper()
        out.setdefault(n, a)

    return out


def parse_answer_section(paras, start_idx):
    """Pass B: 从卷末答案区解析。返回 {题号: {'answer':..,'analysis':..}}"""
    result = {}
    cur_no = None
    for text, media in paras[start_idx:]:
        t = text.replace('\u3000', ' ').replace('\xa0', ' ').strip()
        if not t:
            continue
        m = QNUM.match(t)
        if m:
            cur_no = int(m.group(1))
            rest = t[m.end():]
            rec = result.setdefault(cur_no, {'answer': None, 'analysis': None})
            # "1. C 【解析】..." 或 "1. A"
            a = re.match(r'^\s*([A-D])(?![A-Za-z0-9])', rest)
            if a:
                rec['answer'] = a.group(1)
                rest = rest[a.end():]
            if HAS_ANA_TAG.search(rest) or HAS_ANS_TAG.search(rest):
                aa = ANA_INLINE.search(rest)
                if aa:
                    rec['analysis'] = (rec['analysis'] or '') + aa.group(1)
                else:
                    rec['analysis'] = (rec['analysis'] or '') + rest
            elif rest.strip():
                rec['analysis'] = (rec['analysis'] or '') + rest
            continue
        # 紧凑串整体展开
        runs = _expand_compact_runs(t)
        if runs:
            for n, a in runs.items():
                result.setdefault(n, {'answer': None, 'analysis': None})
                if result[n]['answer'] is None:
                    result[n]['answer'] = a
            continue
        if cur_no is not None:
            rec = result.setdefault(cur_no, {'answer': None, 'analysis': None})
            if HAS_ANA_TAG.search(t) or ANA_INLINE.search(t):
                aa = ANA_INLINE.search(t)
                rec['analysis'] = (rec['analysis'] or '') + ((aa.group(1) if aa else t))
            else:
                rec['analysis'] = (rec['analysis'] or '') + t
    return result


COMPACT_RUN = re.compile(r'\d{1,2}\s*[-~`]\s*\d{1,2}\s*[.．:：]\s*[A-Da-d\s]{2,}')
ANA_LIKE = re.compile(r'^\s*[【\[(]?\s*(?:解析|详解|分析|点拨|考点|解答|评分标准|答案)')


def candidate_layouts(paras):
    """给出所有可能的答案布局候选, 交给 extract_paper 用质量分择优。
    不在这里预先否决 —— 实测「内联【答案】」既可能是正文内联 (语文广东2011), 也可能是
    卷末集中答案区的逐题标记 (英语陕西), 靠锚点无法区分, 只能靠实测覆盖度裁决。

    重要: 早期版本只取「位置 >= 全文 35%」的第一个锚点作为 tail 起点, 结果
    语文山东2009 的 `语文参考答案` 落在 31% 处被拒 → 前 10 题答案全丢。
    现在把每个强锚点都作为独立候选 (上限 MAX_TAIL_CANDIDATES), 位置阈值不再参与否决。

    返回 [(kind, regions), ...], kind ∈ {inline, tail, answer_only}
    """
    n = len(paras)
    out = [('inline', [])]
    if n == 0:
        return out
    qnum = [bool(QNUM.match(t.replace('\u3000', ' ').strip())) for t, _ in paras]
    cands = [i for i, (t, _) in enumerate(paras)
             if (s := t.replace('\u3000', ' ').strip()) and len(s) <= ANSWER_LINE_MAX
             and ANSWER_SECTION_STRONG.search(s)]
    if not cands:
        return out

    first = cands[0]
    if first <= max(4, int(n * 0.06)) and sum(qnum[:first]) <= 1:
        out.append(('answer_only', [(first, min(n, first + 120))]))

    # 每个「后面还有足够多题号行」的锚点都作为 tail 候选
    seen = set()
    for c in cands:
        if len(seen) >= MAX_TAIL_CANDIDATES:
            break
        if sum(qnum[c:]) < 3:
            continue
        if any(abs(c - s) <= 2 for s in seen):     # 相邻锚点合并, 避免候选爆炸
            continue
        seen.add(c)
        out.append(('tail', [(c, n)]))
    return out


def backfill(qs, section_map):
    """Pass D: 把集中答案回填到缺答案的题目"""
    n_fill = 0
    for q in qs:
        rec = section_map.get(q['number'])
        if not rec:
            continue
        if not q['answer'] and rec.get('answer'):
            q['answer'] = rec['answer']
            q['answer_source'] = 'answer_section'
            n_fill += 1
        if not q['analysis'] and rec.get('analysis'):
            q['analysis'] = rec['analysis']
            q['analysis_source'] = 'answer_section'
            n_fill += 1
    return n_fill


# ───────────────── Pass E: 小问 / 题型 ─────────────────

def split_sub_questions(q):
    stem = q['stem']
    marks = list(SUBQ.finditer(stem))
    if len(marks) < 2:
        return []
    subs = []
    for k, m in enumerate(marks):
        end = marks[k + 1].start() if k + 1 < len(marks) else len(stem)
        label = m.group(1) or m.group(2)
        subs.append({'index': k + 1, 'label': label, 'text': stem[m.end():end].strip()})
    return subs


def infer_question_type(q):
    n_opt = len(q['options'])
    if n_opt >= 2:
        return 'choice'
    if FILL_BLANK.search(q['stem']):
        return 'fill'
    if q['sub_questions'] or re.search(r'[（(]\s*\d\s*[)）]', q['stem']):
        return 'solve'
    if len(q['stem']) > 220:
        return 'solve'
    if n_opt == 1:
        return 'choice'
    return 'unknown'


def normalize_options(opts: dict):
    """选项统一成 'A. xxx\\nB. yyy' 纯文本 (与库内既有格式一致, 避免 JSON/文本混存)"""
    if not opts:
        return None
    return '\n'.join(f'{k}. {v}' for k, v in sorted(opts.items()) if v is not None)


# ───────────────────────── 媒体 (内容寻址、全局去重) ─────────────────────────

def media_digest(target: str, data: bytes) -> tuple[str, str]:
    h = hashlib.sha256(data).hexdigest()
    ext = os.path.splitext(target or '')[1].lower() or '.bin'
    return h, ext


def store_media(z, media_list, media_root: Path, prefix: str):
    """按 sha256 全局落盘, 返回 [{kind, sha256, ext, rel_path, bytes}]"""
    out = []
    for m in media_list:
        target = m.get('target')
        if not target or not target.startswith('media/'):
            if m.get('kind') == 'omml':
                out.append({'kind': 'omml', 'sha256': None, 'ext': None,
                            'rel_path': None, 'omml': m.get('omml'), 'bytes': 0})
            continue
        try:
            data = z.read('word/' + target)
        except KeyError:
            continue
        h, ext = media_digest(target, data)
        rel = f'{prefix}/{h[:2]}/{h}{ext}'
        dst = media_root / rel
        if not dst.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            tmp = dst.with_suffix(dst.suffix + '.part')
            tmp.write_bytes(data)
            tmp.rename(dst)
        out.append({'kind': m['kind'], 'sha256': h, 'ext': ext,
                    'rel_path': rel, 'bytes': len(data)})
    return out


# ───────────────────────── 单份原卷提取 ─────────────────────────

def mask_regions(paras, regions):
    """把答案区段落从题干切分输入里屏蔽 (只留一道空行, 保持索引对齐)"""
    masked = list(paras)
    in_region = set()
    for s, e in regions:
        in_region.update(range(s, e))
    for i in in_region:
        masked[i] = ('', [])
    return masked


def _quality_score(stats, n):
    """一份卷子的提取质量分 (用于在多种布局策略间自动择优)"""
    if n <= 0:
        return -1.0
    ans = stats['with_answer'] / n
    ana = stats['with_analysis'] / n
    opt = stats['with_options'] / n
    known = 1 - stats['type_unknown'] / n
    usable = stats['usable'] / n
    return 0.35 * ans + 0.15 * ana + 0.10 * opt + 0.10 * known + 0.30 * usable


def run_strategy(paras, doc_kind, regions):
    """按给定布局策略跑一遍, 返回 (qs, section_map, filled)"""
    mask = regions if doc_kind == 'tail' else []
    qs = split_questions(mask_regions(paras, mask))
    section_map = {}
    for s, e in regions:
        for n, rec in parse_answer_section(paras, s).items():
            cur = section_map.setdefault(n, {'answer': None, 'analysis': None})
            if not cur['answer'] and rec.get('answer'):
                cur['answer'] = rec['answer']
            if not cur['analysis'] and rec.get('analysis'):
                cur['analysis'] = rec['analysis']
    filled = backfill(qs, section_map) if section_map else 0
    return qs, section_map, filled


# ---- 伪题过滤: 试卷说明 / 答案串 / 听力原文被题号锚点误切成「题」----
# 实测 (37383 题): 1387 题命中说明类关键词; 2961 题「题干<30字且无答案无解析」。
# 样例:
#   「答题前，请务必将自己的姓名、准考证号用黑色字迹的签字笔…」          → 试卷说明
#   「B     17. C     18. B     19. C     20. A听力原文：第一节…」      → 答案串+听力原文
# 这些不是「漏题」(题号断层大多是综合卷跨科编号或真实卷面结构), 而是**多出来的噪声题**。
#
# 分两档, 避免误杀真题:
#   强规则 —— 形态上不可能是题干 (以答案串开头 / 开头就是听力原文), 无视选项直接判噪声;
#   弱规则 —— 说明类关键词, **只在无答案、无解析、无选项时**才判噪声。
#             真带答案的题即使提到「答题卡」也保留。
BOILERPLATE_STRONG = re.compile(
    r'^\s*[A-D](?:\s+\d{1,3}\s*[.．、]\s*[A-D]){2,}'      # B  17. C  18. B
    r'|^.{0,60}?(?:听力原文|听力材料|录音原文)'
)
# 位置强规则: **题干开头**就是说明语 —— 真题干不会以「答题前/注意事项/本试卷」开头,
# 所以这条可以无视选项/答案直接判噪声。
# 为什么需要它: 弱规则要求「无选项、无答案、无解析」, 而实测说明语常被 layout 策略
# 顺手挂上选项 (2018 浙江英语 11月 Q1「答题前, 请务必将自己的姓名、准考证号…」丢弃0 =
# 没被弱规则拦住), 漏掉这类伪题会污染选项率与答案率。
BOILERPLATE_HEAD = re.compile(
    r'^\s*(?:答题?前|答题时|答卷前|考试结束|考生务必|注意事项|监考|本试卷|'
    r'选择题部分|非选择题部分|第[一二三四]部分)'
).search
# 弱规则: 说明语出现在题干**中段**, 只在无答案、无解析、无选项时才判噪声 (真带答案的题即使
# 提到「答题卡」也保留)。
BOILERPLATE_WEAK = re.compile(
    r'答卷前|考试结束后|考生务必|答题卡|本试卷|准考证|注意事项|监考|'
    r'用铅笔把|橡皮擦|答案无效|写在试卷上|一律无效|规范作答|'
    r'选择题部分|非选择题部分'
)
CJK_RE = re.compile(r'[\u4e00-\u9fff]')
# 管线自己的占位符: ⟦F:rIdN⟧ / ⟦IMG:rIdN⟧ / ⟦OMML:…⟧ (见 read_paras 的生成处)
PLACEHOLDER_RE = re.compile(r'⟦[^⟧]*⟧')


def is_fragment(q) -> bool:
    """是否是**碎片噪声** —— 表格单元格 / 数值 / 写作题要点行 / 语法填空答案 / 解析行。

    只在无选项、无答案、无解析时才判 (真带答案的短题多半是有效填空题)。
    实测 (无选项/无答案/无解析的题共 4452 道) 的分布与样例:
      · 数值碎片 394   : '35' '30' '00' '0图1' '18.5m'          (表格单元格)
      · 短<12   551   : '词数80左右；' '参加者；' '时间、地点；'
      · 短12-30 574   : '所续写短文的词数应为150左右；' '应使用5个以上短文…'
                        'a，考查冠词，model是可数名词，前应使用冠词a．'   (语法填空解析行)
      · 单个英文词    : 'if' 'the' 'and' "shouldn't" 'Select'      (语法填空的空格词)
    判据刻意保守: 只在**形态上不像题干**时才命中, 宁可漏也不误杀。
    """
    st = (q.get('stem') or '').strip()
    L = len(st)
    if L == 0:
        return True
    # T1 数值碎片: 数字+标点占比高、没有设问/填空标记 ('35' '00' '18.5m' '500.59350乔—灌—草')
    #    为什么放到 L<30 而不是 L<12: 表格单元格常带中文列名 (乔—灌—草), 实测 L=15,
    #    旧阈值漏掉整批。用「数字+标点占比 > 0.5」而不是「纯数字」来覆盖这种混排。
    if L < 30 and not re.search(r'[？?（(_]', st):
        dp = sum(1 for c in st if c.isdigit() or c in '.．,，—-/·')
        if dp / L > 0.5:
            return True
    # T2 写作题要点行: 极短, 以分号/冒号收尾, 且没有问号/括号 ('词数80左右；' '想提的问题。注意：')
    if L < 40 and st.endswith(('；', ';', '：', ':')) and not re.search(r'[？?（(]', st):
        return True
    # T3 英文碎片: 无中文、很短、没有问号也没有填空下划线
    #    ('if' 'the' 'Select' 'job/position/post' —— 语法填空的空格词/选项词)
    #    真题干要么以问号收尾 (听力), 要么带 ___ 填空位, 所以两个标记都没有就不是题干。
    if (not CJK_RE.search(st)) and L < 24 and not re.search(r'[?？_]', st):
        return True
    # T4 解析行: 以单个答案字母开头后接解析题型词 ('C 细节题。根据第三段第一句…')
    #    或含「考查」的解析语气 ('a，考查冠词，model是可数名词…')
    #    实测 2014 浙江英语整批解析行被当成题, 且因带前导答案字母而污染答案率。
    if L < 120 and re.match(r'^\s*[A-D][\s.．、,，]*'
                            r'(?:细节题|推理题|主旨题|推断题|词义猜测|标题|态度题|数字计算|'
                            r'概括|归纳|判断题|考查|解析|分析)', st):
        return True
    # T5 语法填空/改错解析行: 'holding改为hold．句中used to do…' / 'passes改为passed．该句描述…'
    #    实测 2013 安徽英语整批这类解析行被当成题 (题干以「X改为Y．」开头后接讲解)。
    if L < 120 and re.match(r'^\s*[A-Za-z][A-Za-z\'’]*\s*(?:改为|改成|应改为|改成)\s*[A-Za-z]', st):
        return True
    if L < 100 and '考查' in st and re.search(r'[．.。]', st):
        return True
    return False


def is_boilerplate(q) -> bool:
    """是否是「非题目」内容被误切成题（试卷说明 / 答案串 / 听力原文 / 碎片）。"""
    st = (q.get('stem') or '').strip()
    if not st:
        return True
    if BOILERPLATE_STRONG.search(st) or BOILERPLATE_HEAD(st):
        return True
    # T0 **无视选项/答案**的碎片判据: 剥掉占位符后, 数字+标点占比 > 0.6 的短串不可能是题干。
    # 为什么需要无视元数据: 表格碎片常被 layout 策略顺手挂上答案/选项, 于是被下面的
    # 「仅无元数据时才判碎片」挡住而漏网 —— 实测 2024 安徽生物
    # 「67针叶林40.13…⟦IMG:rId7⟧17灌丛3.82…」就是这样活下来的。
    # 为什么必须**先剥占位符**: 该串原长 78, 占位符把比例稀释到 0.53 从而绕过阈值;
    # 剥掉后真实文本长 42、占比 0.98。占位符是管线自己的标记, 不该算进长度与占比。
    # 为什么安全: 真题干一定含疑问/设问/填空标记或题眼动词, 两者都排除了才判。
    st_clean = PLACEHOLDER_RE.sub('', st)
    if st_clean and len(st_clean) < 60 and not re.search(r'[？?（(_]', st_clean) \
            and not re.search(r'求|计算|下列|选择|说明|简述|分析|比较|判断|正确的是|错误的是', st_clean):
        dp = sum(1 for c in st_clean if c.isdigit() or c in '.．,，—-/·')
        if dp / len(st_clean) > 0.6:
            return True
    if q.get('answer') or q.get('analysis') or q.get('options'):
        return False
    if BOILERPLATE_WEAK.search(st[:160]):
        return True
    return is_fragment(q)


# 补充形态: 范围+空格+答案串 (`1-5 ABCDE`)。现有 COMPACT_RUN 强制要求点号,
# 导致文档里声称支持的这一形态实测解析为空。这里要求**大写** A-D 且串内无空白, 更严更安全,
# 所以单独放而不去放宽 COMPACT_RUN (后者被答案区路径复用, 放宽会波及既有行为)。
COMPACT_RUN_SP = re.compile(r'\d{1,2}\s*[-~`]\s*\d{1,2}\s*[.．:：]?\s*[A-D]{2,}')


def backfill_compact_all(qs, paras):
    """从**全部段落**(不止已识别的答案区)扫紧凑答案串, 回填缺答案的题。

    为什么需要: `_expand_compact_runs` 只在答案区内被调用, 而紧凑答案串常出现在**正文**里
    (听力答案行「16. B 17. C 18. B…」紧接听力原文)。这类段落此前被当伪题过滤掉, 答案一起丢了。
    抽样 60 份「答案最少」的卷: 44 份能扫出答案串、共 1559 组 (题号→答案),
    而这些卷的无答案题合计 2889 道 → **可补 54%**。

    安全性: 只补**题号在全卷唯一**的题。一卷多节 (migration 022) 会共用题号,
    紧凑串里没有节信息, 无法判断该给哪一节 —— **宁可不补, 不猜**。
    """
    pool = {}
    for item in paras:
        t = item[0] if isinstance(item, (tuple, list)) else item
        if not t:
            continue
        for n, a in _expand_compact_runs(t).items():
            pool.setdefault(n, a)
        # 带标签的独立答案行 `1.【答案】B` / `1.答案：C` —— _expand_compact_runs 不认,
        # 而它正是 2009 上海历史答案区的唯一形态 (该卷 30 道客观题官方 0 答案)。
        ms = ANS_STANDALONE.match(t.strip())
        if ms:
            pool.setdefault(int(ms.group(1)), ms.group(2))
        for m in COMPACT_RUN_SP.finditer(t):
            for n, a in _expand_compact_runs(m.group(0)).items():
                pool.setdefault(n, a)
    if not pool:
        return 0
    cnt = number_ambiguity(qs)
    filled = 0
    for q in qs:
        if q.get('answer'):
            continue
        n = q['number']
        if cnt.get(n) != 1:               # 题号不唯一 → 无法归属到节, 跳过
            continue
        a = pool.get(n)
        if a:
            q['answer'] = a
            q['answer_source'] = 'compact_global'
            filled += 1
    return filled


# 答案字段被污染: 「答案码 + 紧跟解析标记/占位符」('A【解析】根据…' / 'C【试题解析】对于…' / 'BD⟦IMG:rId51⟧19-II…')
# 实测 22001 条有答案里 4446 条长度 >12, 但其中**大部分是合法主观题答案**
# (语文鉴赏/政治大题的标准答案本来就长: '（1）思念远隔天涯的心上人的怅恨之情。（2）…'), 不能一律截断。
# 只有「以答案码开头、后面紧跟解析标记或占位符」才是明确污染 —— 就只切这一种。
ANS_SPLIT = re.compile(
    r'^\s*([A-D]{1,8})\s*[.．、]?\s*'
    r'(?=⟦|【[^】]*(?:解析|详解|分析|解答|点评|考点|试题)[^】]*】|试题解析|解析\s*[:：])'
)


ANS_PROSE_MARK = re.compile(r'[。；;]')
# 章节/栏目标题标记: 出现在答案字段里 = 这是正文, 不是答案
ANS_SECTION_MARK = re.compile(
    r'听力原文|听力理解|第一部分|第二部分|第三部分|第四部分|【考点定位】|【难度】|'
    r'【长难句|读后续写|短文写作|书面表达|知识运用|单项填空|完形填空|阅读理解|注意：|Text\s*\d'
)


def purge_prose_answers(qs) -> int:
    """清掉「答案字段里其实是整段正文」的假答案。

    为什么必须清 (实测 1426 条, 全在英语卷)
    --------------------------------------
    抽样: `'听力原文Text 1Text 2M：Hello!...'` / `'第一部分：知识运用（共两节，45分）...'`
    / `'⟦IMG:rId43⟧【考点定位】社会生活类短文阅读。Part IV Writing...'`。

    危害不只是「答案难看」: 这些题在**客观题可判率**里被算成「有答案」,
    让指标虚高 (1426/23338 ≈ 6pp) —— 而它们根本不可判。
    **宁可指标难看, 也不要假答案。**

    判据分档 (避免误杀):
      · `choice` 题: 答案**定义上**必须是选项码 —— 出现句末标点即判污染;
      · `fill`/`solve`: 长答案本来就合法 (语文鉴赏/政治大题), 只有出现
        **章节标题标记** (听力原文/第一部分/【考点定位】…) 才判污染。

    被清的题记 `answer_purged` 原文片段, 便于事后审计「丢了多少、能不能找回」。
    """
    n = 0
    for q in qs:
        a = (q.get('answer') or '').strip()
        if not a:
            continue
        s = PLACEHOLDER_RE.sub('', a).strip()
        if len(s) < 40:
            continue
        qt = q.get('question_type')
        polluted = False
        if qt == 'choice':
            polluted = bool(ANS_PROSE_MARK.search(s))
        else:
            polluted = bool(ANS_SECTION_MARK.search(s))
        if polluted:
            q['answer'] = None
            q['answer_source'] = None
            q['answer_purged'] = s[:120]
            n += 1
    return n


def normalize_answer(q) -> bool:
    """把被污染的 answer 切回「答案码」, 解析部分移入 analysis。返回是否发生切分。"""
    a = (q.get('answer') or '').strip()
    if len(a) < 10:
        return False
    m = ANS_SPLIT.match(a)
    if not m:
        return False
    rest = a[m.end():].strip()
    if len(rest) < 10:
        return False
    q['answer'] = m.group(1)
    if not (q.get('analysis') or '').strip():
        q['analysis'] = rest
        q['analysis_source'] = 'split_from_answer'
    return True


QNO_ANCHOR = re.compile(r'^\s*(?:第\s*)?(\d{1,3})\s*[.．、）)]')
# 独立答案行: '答案是B。' / '【答案】：B' / '答案：C' / '37.答案：D' / '答案为 D'
#   必须容忍 '】' —— 语料主流形态是 '【答案】：B', 少了它整批答案行匹配不到 (实测重庆英语只命中 2/段)。
ANS_LINE = re.compile(
    r'(?:参考答案|答案)\s*[】\]]?\s*(?:是|为|选)?\s*[:：]?\s*([A-D])(?![A-Za-z0-9])'
)
ANS_LINE_NUM = re.compile(r'^\s*(?:第\s*)?(\d{1,3})\s*[.．、）)]\s*(?:参考答案|答案)')


def backfill_answers_all(qs, paras):
    """从**全部段落**按「最近题号锚点」回填字母答案。

    为什么需要 (实测 2012 重庆英语): 源里答案写成**独立段落**「答案是B。」「【答案】：B」,
    它们并不紧跟在题干之后, 而是散落在正文里。`_route_line` 只把答案挂给「当前正在解析的那道题」,
    所以这类游离答案段落**全被丢掉**, 该卷 32 道选择题没有答案。
    做法: 顺序扫段落, 记住最近一次出现的题号锚点; 遇到答案行就把它记到该题号上
    (答案行自带题号时以自带的为准)。最后只回填**题号在全卷唯一**的题 (同 backfill_compact_all
    的理由: 多节卷共用题号时无法归属, 宁可不补)。
    """
    # **必须有「题号全卷唯一」护栏**: 试过按「第 k 次出现」做位置归属(想解开多节卷), 实测
    # 聚合结果反而更差 —— 有答案 24161→24050、严格可用 20393→20284。原因是正文里偶然出现的
    # 数字会让出现次数漂移, 导致整串答案错位。**保守的护栏净收益更高, 且错答案比缺答案更糟。**
    pool, last_num = {}, None
    for item in paras:
        t = item[0] if isinstance(item, (tuple, list)) else item
        if not t:
            continue
        t = PLACEHOLDER_RE.sub('', t).strip()
        m_num = ANS_LINE_NUM.match(t)
        if m_num:
            am = ANS_LINE.search(t)
            if am:
                pool[int(m_num.group(1))] = am.group(1)
        else:
            am = ANS_LINE.search(t)
            if am and last_num is not None:
                pool.setdefault(last_num, am.group(1))
        a = QNO_ANCHOR.match(t)
        if a:
            try:
                last_num = int(a.group(1))
            except ValueError:
                pass
    if not pool:
        return 0
    cnt = number_ambiguity(qs)
    filled = 0
    for q in qs:
        if q.get('answer'):
            continue
        if cnt.get(q['number']) != 1:
            continue
        v = pool.get(q['number'])
        if v:
            q['answer'] = v
            q['answer_source'] = 'answer_line_global'
            filled += 1
    return filled


def backfill_section_matched(qs, paras):
    """多节卷的答案归属: 用「节题号集合 vs 答案池题号集合」的最佳匹配节来归属。

    为什么需要 (实测 2010 浙江英语): 源的答案是**全卷连续编号**的答案串
    `'1-10 CBABDACCBA11-20 DCDBBACDAD'`, 覆盖 1-60; 而提取出的题被切成多节
    (s1 卷面 45 题 / s3 解析区 32 题), 题号跨节重复 → 被「题号全卷唯一」护栏**整批挡掉**,
    该卷 42 道客观题因此无答案 —— 而答案明明就在源里、解析器也读得出来。

    做法: 池里的答案属于哪一节? 算每一节的 coverage = |池∩节题号| / |节题号|,
    只让 **coverage 最高且 >= 0.6** 的那一节承接 (只放开这一节, 其余仍走严格护栏)。
    只承接**缺答案**的题, 已有答案的一律不动 —— 错答案比缺答案更糟。
    """
    # **只信「显式区间答案串」** (`1-10 CBABDACCBA`), 不用 ANS_LINE + last_num 的启发式追踪。
    # 为什么: 第一次实现把两者都收进池, 独立核对发现 18/173 = **10.4% 的答案是错的**
    # (源=C 库=A 这类) —— 错答案比缺答案更糟, 所以砍掉启发式那一半。
    # 显式区间串自带题号范围, 无歧义, 是唯一可安全用于「跨节归属」的证据。
    pool = {}
    for it in paras:
        t = it[0] if isinstance(it, (tuple, list)) else it
        if not t:
            continue
        t = PLACEHOLDER_RE.sub('', t).strip()
        for n, a in _expand_compact_runs(t).items():
            pool.setdefault(n, a)
    if not pool:
        return 0
    bysec = {}
    for q in qs:
        bysec.setdefault(q.get('section') or 'main', []).append(q)
    best, best_cov = None, 0.0
    for sec, g in bysec.items():
        nums = [q['number'] for q in g if isinstance(q.get('number'), int)]
        if not nums:
            continue
        cov = sum(1 for n in set(nums) if n in pool) / len(set(nums))
        if cov > best_cov:
            best, best_cov = sec, cov
    if best is None or best_cov < 0.5:
        return 0
    filled = 0
    for q in bysec[best]:
        if q.get('answer'):
            continue
        v = pool.get(q['number'])
        if v:
            q['answer'] = v
            q['answer_source'] = 'section_matched'
            filled += 1
    return filled


def finalize(qs, prefix, media_root, z):
    """Pass E: 答案兜底 / 小问拆分 / 题型推定 / 选项归一 / 媒体落盘"""
    ans_split = 0
    for q in qs:
        # 答案切分: 'A【解析】…' → answer='A' + analysis 收下半段 (见 normalize_answer 文档)
        if normalize_answer(q):
            ans_split += 1
        # 答案兜底: 学科网五段式把答案写在解析正文里
        #   字母答案 故答案选D／故选：C     → ANS_FROM_TEXT
        #   填空答案 故答案为：1．／故填：2n+1 → ANS_FILL
        # **只认字母的正则会漏掉全部填空答案** —— 实测 2017 江苏数学 52 题因此只捞到 1 个答案。
        # 先把「答案」其实是小标题的情况清掉 (实测存在 ans='一.填空题')。
        if q['answer'] and ANA_JUNK_ANS.match(str(q['answer']).strip()):
            q['answer'] = None
            q['answer_source'] = None
        if not q['answer'] and q['analysis']:
            am = ANS_FROM_TEXT.search(q['analysis'])
            if am:
                q['answer'] = am.group(1)
                q['answer_source'] = 'from_analysis'
            else:
                fm = ANS_FILL.search(q['analysis'])
                if fm:
                    v = fm.group(1).strip()
                    # 排除纯标点 ('故答案为：' 会因回溯把冒号捕获进来) 与小标题
                    if v and not re.fullmatch(r'[：:，,．。；;\s]+', v) and not ANA_JUNK_ANS.match(v):
                        q['answer'] = v
                        q['answer_source'] = 'from_analysis_fill'
        # 溯源补全: 主路由路径 (题干后紧跟答案) 也要记来源, 否则「无静默覆盖」不成立 ——
        # 实测 22095 条答案没有来源标记, 无法回答「它从哪来」。
        if q.get('answer') and not q.get('answer_source'):
            q['answer_source'] = 'inline_routed'
        if q.get('analysis') and not q.get('analysis_source'):
            q['analysis_source'] = 'inline_routed'
        q['sub_questions'] = split_sub_questions(q)
        q['question_type'] = infer_question_type(q)
        q['options_text'] = normalize_options(q['options'])
        q['has_formula'] = any(m['kind'] in ('formula', 'omml') for m in q['media'])
        q['has_image'] = any(m['kind'] == 'figure' for m in q['media'])
        q['stem_len'] = len(q['stem'].strip())
        if media_root is not None:
            q['media_stored'] = store_media(z, q['media'], media_root, prefix)
        q.pop('raw', None)
    # 反答案污染: 答案字段里其实是整段正文的, 一律清掉 —— 见 purge_prose_answers 文档。
    # 必须在这里调用 (question_type 已推定), 判据分 choice / fill|solve 两档。
    ans_purged = purge_prose_answers(qs)
    good = [q for q in qs if q['stem_len'] >= 2 and not is_boilerplate(q)]
    # 丢弃数必须显式落盘 —— 静默跳过是这套管线最危险的失败模式 (见 SKILL「静默跳过必须先对账」)。
    dropped_boilerplate = sum(1 for q in qs if q['stem_len'] >= 2) - len(good)
    st = {
        'with_options': sum(1 for q in good if q['options']),
        'with_answer': sum(1 for q in good if q['answer']),
        'with_analysis': sum(1 for q in good if q['analysis']),
        'with_media': sum(1 for q in good if q['media']),
        'with_formula': sum(1 for q in good if q['has_formula']),
        'with_image': sum(1 for q in good if q['has_image']),
        'with_subq': sum(1 for q in good if q['sub_questions']),
        'type_choice': sum(1 for q in good if q['question_type'] == 'choice'),
        'type_fill': sum(1 for q in good if q['question_type'] == 'fill'),
        'type_solve': sum(1 for q in good if q['question_type'] == 'solve'),
        'type_unknown': sum(1 for q in good if q['question_type'] == 'unknown'),
        'usable': sum(1 for q in good if usable(q)),
        'dropped_boilerplate': dropped_boilerplate,
        'answer_split': ans_split,
        'answer_purged': ans_purged,
    }
    return good, st


def extract_paper(path: Path, media_root: Path | None = None, subject_hint=None, debug=False) -> dict:
    """提取一份原卷。

    布局策略自动择优: 同一份 docx 分别按 inline / tail / answer_only 三种假设跑一遍,
    取质量分最高者。理由: 各卷的答案排布差异极大 (逐题内联 / 卷末集中 / 答案区在头部 /
    学科网五段式), 单一锚点规则会上演「修一个坏一个」的地鼠效应。
    """
    ident = parse_identity(path, subject_hint)
    paras, z = read_paras(path)
    candidates = candidate_layouts(paras)
    prefix = f'{ident["subject"] or "na"}/{ident["year"] or "na"}'

    best = None
    trials = []
    for ci, (kind, regs) in enumerate(candidates):
        try:
            qs, sec_map, filled = run_strategy(paras, kind, regs)
        except Exception as e:                      # 单策略失败不影响其他策略
            trials.append({'kind': kind, 'regions': [list(r) for r in regs],
                           'error': str(e)[:80], 'score': None})
            continue
        good, st = finalize([dict(q) for q in qs], prefix, None, z)
        sc = _quality_score(st, len(good))
        trials.append({'kind': kind, 'regions': [list(r) for r in regs],
                       'questions': len(good), 'answer': st['with_answer'],
                       'analysis': st['with_analysis'], 'usable': st['usable'],
                       'score': round(sc, 4)})
        if best is None or sc > best[0]:
            # 注意: 必须连 regions 一起记住 —— 现在同一个 kind 可能有多个候选 (多个 tail 起点),
            # 只按 kind 回查会取到第一个候选而不是胜出的那个。
            best = (sc, kind, regs, good, len(good), st, sec_map, filled)

    if best is None:
        z.close()
        raise ValueError('所有布局策略均失败')

    # 硬门槛: 胜出候选的「绝对可用题数」不得低于各候选最大值的 70%。
    # 为什么要这道门槛: 如果某个 tail 候选起点过早, 会把正文整片屏蔽掉 —— 分母变小让比率
    # 看起来更漂亮 (实测 2014 新课标语文 题 12→3 却评分更高)。纯比率评分抓不住这种退步。
    # 为什么用「可用题数」而不是「题数」: 用题数做门槛会为了凑题数而牺牲答案
    # (实测 2009 语文多卷 题 24→44 但答案 11→0)。可用题数才是我真正要最大化的量。
    scored = [t for t in trials if t.get('score') is not None]
    gate = None
    if scored:
        maxu = max(t['usable'] for t in scored)
        maxq = max(t['questions'] for t in scored)
        u_thr = 0.7 * maxu
        q_thr = 0.7 * maxq
        # **两条门槛必须同时成立**: 可用题数 >= 70% 最大值, **并且** 题数 >= 70% 最大值。
        #
        # 只用「可用题数」不够 —— 实测 2015 安徽英语: inline 候选 76 题/22 可用,
        # tail 候选 24 题/21 可用, 门槛 0.7×22=15.4 让 tail 轻松过关, 而 tail 把 76 题里的
        # 52 题 (68%) 当答案区屏蔽掉了, 可用题数只差 1。旧语料在同一卷上有 75 题,
        # 正好对应 inline 的 76 —— 证明该取 inline。
        #
        # 只用「题数」也不行 (踩过的坑): 2009 语文多卷 题 24→44 但答案 11→0,
        # 用题数做门槛会为了凑题数把答案全丢掉。所以两条一起用, 互为约束:
        #   · 题数门槛挡住「吞正文」的候选 (它题少)
        #   · 可用题数门槛挡住「只凑题数」的候选 (它可用少)
        keep = [t for t in scored if t['usable'] >= u_thr and t['questions'] >= q_thr]
        if not keep:                       # 兜底: 都不过就退回旧的单条规则, 再不行全留
            keep = [t for t in scored if t['usable'] >= u_thr] or scored
        if keep:
            win = max(keep, key=lambda t: t['score'])
            gate = {
                'max_usable': maxu,
                'usable_threshold': round(u_thr, 2),
                'max_questions': maxq,
                'questions_threshold': round(q_thr, 2),
                'winner_kind': win['kind'],
                'winner_usable': win['usable'],
                'winner_questions': win['questions'],
                'winner_score': win['score'],
                'overrode_best': win['score'] < best[0],
                'rejected': [{'kind': t['kind'], 'usable': t['usable'],
                              'questions': t['questions'], 'score': t['score']}
                             for t in scored if t not in keep],
            }
            if win['score'] < best[0]:
                regs = [tuple(r) for r in win['regions']]
                qs_w, sec_w, filled_w = run_strategy(paras, win['kind'], regs)
                good_w, st_w = finalize([dict(q) for q in qs_w], prefix, None, z)
                best = (win['score'], win['kind'], regs, good_w, len(good_w), st_w, sec_w, filled_w)

    sc, kind, regs, good, n, st, sec_map, filled = best
    # 用胜出策略 (含胜出的 regions) 重跑一次以落盘媒体
    qs2, sec_map2, filled2 = run_strategy(paras, kind, regs)
    # 全段落扫紧凑答案串 + 独立答案行回填 (不止答案区) —— 见两个 backfill 函数文档
    compact_filled = backfill_compact_all(qs2, paras)
    answer_line_filled = backfill_answers_all(qs2, paras)
    # ⚠️ backfill_section_matched (解多节卷答案归属): 曾因 _expand_compact_runs 把
    # 选项行 `21. A. xxx` 读成「21 题答案是 A」而在独立核对中 FAIL (18/173=10.4% 错)。
    # **根因已在 _expand_compact_runs 里修掉** (段落级 + 匹配级双闸), 重新启用;
    # 但启用/停用一律以独立核对为准 —— 见 10-mark-answer-conflicts.py 的准入判定。
    section_filled = backfill_section_matched(qs2, paras)
    # 双行表格答案 (『题号 1 2 3…』+『答案 B D A…』被摊平成段落) —— 见 expand_answer_tables
    table_filled = backfill_answer_tables(qs2, paras)
    # 分叉卷 (A组/B组) 按段落位置归属 —— 见 backfill_table_positional
    positional_filled = backfill_table_positional(qs2, paras)
    good2, st2 = finalize(qs2, prefix, media_root, z)
    good2 = assign_sections(good2)     # 分节 + 同卷重复抽取去重 (见 assign_sections 文档)
    z.close()

    return {
        'source_file': str(path),
        'source_name': path.name,
        'identity': ident,
        'doc_kind': kind,
        'layout_candidates': len(candidates),
        'answer_regions': [[int(a), int(b)] for a, b in regs],
        'answer_section_entries': len(sec_map2),
        'backfilled': filled2,
        'compact_backfilled': compact_filled,
        'answer_line_backfilled': answer_line_filled,
        'section_matched_backfilled': section_filled,
        'question_count': len(good2),
        'strategy_score': round(sc, 4),
        # **始终落盘** (此前是 `trials if debug else None`, 生产跑出来全是 0 个):
        # 候选择优与 70% 硬门槛必须能事后审计 —— 否则「某卷为何只剩 24 题」只能靠猜,
        # 实测 62 份退步卷就是这么卡住的。代价约 0.8MB, 换可审计性。
        'strategy_trials': trials,
        'strategy_gate': gate,
        'questions': good2,
        'stats': st2,
    }


_DUP_NORM = re.compile(r'\W+')


def assign_sections(questions):
    """卷内分节 + 同卷重复抽取去重。

    **分节规则**: 题号**不递增**即为新节开始。上海/浙江/江苏等卷按 听力/语法/阅读/写作
    分节, 每节各自从第 1 题编号 —— 实测 725/1634 份卷 (44%) 存在卷内题号重复,
    共 5660 题, 其中 95% 的重复对题干**不同** (不是冗余, 是分节各自编号)。
    单节卷统一写 'main', 多节卷写 s1/s2/s3...。

    **去重规则**: 同一卷内, 若某题与前面出现过的题 **题号相同且归一化题干相同**,
    视为同一题被重复抽取 (常见于答案区回填时重复切分), 丢弃后出现的那条。
    实测 10096 个重复对里只有 573 对 (5.7%) 属于这种真冗余。

    分节与去重必须同时做: 仅去重会丢 95% 的真题, 仅分节会把 5.7% 的冗余留进库。
    """
    kept, seen, secs, prev = [], set(), [], None
    for q in questions:
        n = q.get('number')
        if prev is None or n <= prev:
            secs.append(len(secs) + 1)          # 新节
        else:
            secs.append(secs[-1] if secs else 1)
        prev = n
        key = (n, _DUP_NORM.sub('', (q.get('stem') or ''))[:80])
        if key in seen:
            continue
        seen.add(key)
        kept.append((secs[-1], q))
    total_secs = len({s for s, _ in kept})
    remap = {}
    for s, _ in kept:
        if s not in remap:
            remap[s] = len(remap) + 1
    for s, q in kept:
        q['section'] = 'main' if total_secs <= 1 else f's{remap[s]}'
    return [q for _, q in kept]


def usable(q) -> bool:
    """严格可用: 题干>=20字符 且 有答案 且 题型已知"""
    return q['stem_len'] >= 20 and bool(q['answer']) and q['question_type'] != 'unknown'
