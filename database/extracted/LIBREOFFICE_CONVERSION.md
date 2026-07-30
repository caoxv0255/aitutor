# LibreOffice .doc → .docx 转换

## 为什么需要
exam-extract-v5 zipfile-based docx parser 不支持 OLE2 旧 Word (.doc)。
aitutor database/ 下有 699 个 .doc 历史真题，必须先转成 .docx 才能抽 schema v5。

## 一次性转换 (已完成)
- 时间: 2026-07-30 21:45-21:57 (~12 分钟, 2 workers)
- AppImage: /home/cx/libreoffice/LibreOffice.AppImage (LibreOffice 25.8.7 still-base, 287 MB)
- 输入: 699 .doc 路径列表 (/tmp/lo_docs_to_convert.txt)
- 输出: /tmp/lo_converted/*.docx (696 unique files, 0 duplicates)
- 脚本: /tmp/convert_docs.sh

## 已弃用 (一次性)
- LibreOffice AppImage 是 download-once 工具，不需要 commit
- /tmp/lo_converted/ 是 build 产物，不进 git
- 后续真要再转，单跑 `/tmp/convert_docs.sh <list> <outdir> <workers>`

## 在 Node 桥接中的角色
scripts/extract_docx_via_exam_extract.mjs:
- 扫到的 .doc 自动 fallback 到 DOC_CONVERTED_DIR 里的同名 .docx
- DOC_CONVERTED_DIR 默认 /tmp/lo_converted, env 可覆盖
- paper_id 用原 .doc filename（不是 docx）

## 复现 (如需)
```bash
# 1) 下载 LO AppImage (287 MB)
curl -L -o /home/cx/libreoffice/LibreOffice.AppImage \
  'https://download.documentfoundation.org/libreoffice/stable/25.8.7/deb/x86_64/LibreOffice_25.8.7_Linux_x86-64_deb.tar.gz'

# 2) 扫 .doc 路径
find /home/cx/aitutor/database -name '*.doc' -not -name '*.docx' > /tmp/lo_docs_to_convert.txt

# 3) 转换 (2 workers 已证安全)
bash /tmp/convert_docs.sh /tmp/lo_docs_to_convert.txt /tmp/lo_converted 2

# 4) 跑提取
node scripts/extract_docx_via_exam_extract.mjs --workers 8
```
