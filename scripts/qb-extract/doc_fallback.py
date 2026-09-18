#!/usr/bin/env python3
"""
legacy .doc → .docx 兜底转换器 (olefile + Word97 分片表)

用于 LibreOffice 会挂死的 .doc。不依赖 LibreOffice, 直接解 OLE：
  1. 读 WordDocument 流
  2. 解析 FIB (File Information Block) 取 fcClx / lcbClx / fWhichTblStm
  3. 从 1Table|0Table 流取 Clx → 跳过 Prc → 取 Pcdt (PlcPcd)
  4. 按分片表取出各段文本 (每片独立判定 CP1252压缩 / UTF-16 未压缩)
  5. 合成一个最小合法 .docx, 交给主流水线 (qbx.py) 正常处理

为什么不用「UTF-16 粗解码 + 正则抠中文」: 那样会丢失段落边界与选项/题号结构,
下游的题号锚点与选项锚点全部失效。分片表是唯一能同时拿对编码和边界的正路。

用法:
    from doc_fallback import doc_to_docx_via_ole
    doc_to_docx_via_ole(src_doc, dst_docx)   # -> bool
"""
from __future__ import annotations

import struct
import zipfile
from pathlib import Path

try:
    import olefile
except ImportError:  # pragma: no cover
    olefile = None

# Word 97 FIB 字段偏移
FIB_FLAGS = 0x000A
FIB_FC_MIN = 0x0018
FIB_FC_CLX = 0x01A2
FIB_LCB_CLX = 0x01A6

CT_DOCX = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''

RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

DOC_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'''


def _sanitize(s: str) -> str:
    """去掉 XML 1.0 非法字符。
    .doc 的原始文本里常混有控制字符 (\x00-\x08, \x0e-\x1f) 与 utf-16 解码出的孤儿代理对,
    直接写进 document.xml 会让 ElementTree 报 'not well-formed (invalid token)'。"""
    out = []
    for ch in s:
        o = ord(ch)
        if o in (0x09, 0x0A, 0x0D):
            out.append(ch)
        elif o < 0x20:
            continue                      # C0 控制字符
        elif 0x7F <= o <= 0x9F:
            continue                      # C1 控制字符
        elif 0xD800 <= o <= 0xDFFF:
            continue                      # 孤儿代理对
        elif o in (0xFFFE, 0xFFFF):
            continue
        else:
            out.append(ch)
    return ''.join(out)


def _xml_escape(s: str) -> str:
    s = _sanitize(s)
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))


def doc_text_paragraphs(path) -> list[str]:
    """用 Word97 分片表取出段落文本列表"""
    if olefile is None:
        raise RuntimeError('olefile 未安装')
    ole = olefile.OleFileIO(str(path))
    try:
        doc = ole.openstream('WordDocument').read()
        if len(doc) < 0x01AA:
            raise ValueError('WordDocument 流过短, 不是 Word97 文档')
        flags = struct.unpack_from('<H', doc, FIB_FLAGS)[0]
        table_name = '1Table' if (flags & 0x0200) else '0Table'
        if not ole.exists(table_name):
            table_name = '1Table' if ole.exists('1Table') else '0Table'
        fc_clx, lcb_clx = struct.unpack_from('<II', doc, FIB_FC_CLX)
        if lcb_clx == 0 or fc_clx == 0:
            raise ValueError('FIB 未给出分片表位置')
        tbl = ole.openstream(table_name).read()
        clx = tbl[fc_clx:fc_clx + lcb_clx]
        # 跳过可选的 Prc 数组 (以 0x01 开头, 后跟 2 字节长度)
        i = 0
        while i < len(clx) and clx[i] == 0x01:
            cb = struct.unpack_from('<h', clx, i + 1)[0]
            i += 3 + cb
        if i >= len(clx) or clx[i] != 0x02:
            raise ValueError('Clx 中找不到 Pcdt')
        lcb_pcdt = struct.unpack_from('<I', clx, i + 1)[0]
        plc = clx[i + 5:i + 5 + lcb_pcdt]
        n = (lcb_pcdt - 4) // 12
        if n <= 0:
            raise ValueError('分片数为 0')
        cps = list(struct.unpack_from(f'<{n + 1}I', plc, 0))
        base = 4 * (n + 1)
        parts = []
        for k in range(n):
            pcd = plc[base + k * 8: base + k * 8 + 8]
            fc = struct.unpack_from('<I', pcd, 2)[0]
            compressed = bool(fc & 0x40000000)
            off = (fc & 0x3FFFFFFF) // 2 if compressed else (fc & 0x3FFFFFFF)
            ln = cps[k + 1] - cps[k]
            raw = doc[off:off + (ln if compressed else ln * 2)]
            parts.append(raw.decode('cp1252', 'ignore') if compressed
                         else raw.decode('utf-16-le', 'ignore'))
        text = ''.join(parts)
    finally:
        ole.close()

    # Word 的段落结束符: \r (0x0D); 另有 \x07 单元格结束, \x0B 换行, \x0C 分页
    text = text.replace('\x0b', '\n').replace('\x0c', '\n\r')
    text = text.replace('\x07', '\t').replace('\x01', '')     # 图片占位符
    text = text.replace('\x13', '').replace('\x14', '').replace('\x15', '')  # 域标记
    paras = [p.strip() for p in text.split('\r')]
    return [p for p in paras if p]


def paragraphs_to_docx(paras: list[str], dst: Path) -> None:
    """合成最小合法 docx (一 <w:p> 一段)"""
    body = []
    for p in paras:
        body.append(
            '<w:p><w:r><w:t xml:space="preserve">'
            + _xml_escape(p) + '</w:t></w:r></w:p>')
    doc_xml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
               '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
               '<w:body>' + ''.join(body) + '</w:body></w:document>')
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix('.docx.part')
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', CT_DOCX)
        z.writestr('_rels/.rels', RELS)
        z.writestr('word/_rels/document.xml.rels', DOC_RELS)
        z.writestr('word/document.xml', doc_xml)
    tmp.rename(dst)


def doc_to_docx_via_ole(src, dst) -> bool:
    """兜底转换; 成功返回 True。失败不抛异常 (交由调用方记录)"""
    src, dst = Path(src), Path(dst)
    try:
        paras = doc_text_paragraphs(src)
        if not paras:
            return False
        paragraphs_to_docx(paras, dst)
        return True
    except Exception:
        return False


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 3:
        print('用法: doc_fallback.py <src.doc> <dst.docx>'); raise SystemExit(2)
    ok = doc_to_docx_via_ole(sys.argv[1], sys.argv[2])
    if ok:
        paras = doc_text_paragraphs(sys.argv[1])
        print(f'OK: {len(paras)} 段')
        for p in paras[:8]:
            print('  ', p[:88])
    else:
        print('FAILED'); raise SystemExit(1)
