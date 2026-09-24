# aitutor.zip 内容清单（摘要）

`/home/flaskappuser/Desktop/NewDisk_2T/aitutor.zip` 已于 2026-09-24 删除以释放磁盘。
本文件 + `aitutor-zip-manifest-2026-09-24.tsv.gz` 是这次操作留下的账。

## 原始 zip 概况

| 项目 | 值 |
|---|---|
| 文件大小 | 61,598,913,827 B（57.4 GiB） |
| 条目数 | 20,237 |
| 未压缩总量 | 68,224,518,666 B（63.5 GiB） |
| 压缩后总量 | 61,586,612,018 B |
| 修复说明 | 从 local header 重建中央目录、纯追加 4,888,027 B；原 size 61,594,025,800 |

## 按扩展名汇总（count / 未压缩字节）

| ext | count | bytes |
|---|---:|---:|
| .pdf | 18,476 | 39,641,188,848 |
| .mp3 | 1,370 | 16,880,210,052 |
| .docx | 166 | 83,255,245 |
| .jpg | 50 | 12,750,662 |
| .html | 34 | 670,994 |
| .js | 32 | 166,999 |
| .png | 28 | 17,183,333 |
| .json | 17 | 4,286,491 |
| .md | 12 | 48,835 |
| .cypher | 11 | 24,403,852 |
| .py | 7 | 49,123 |
| (无扩展名/目录) | 6 | 57,608,781 |
| .7z | 6 | 3,803,349,274 |
| .sh | 5 | 10,914 |
| .zip | 4 | 7,695,499,123 |
| .css | 4 | 68,839 |
| .jsonl | 3 | 3,691,771 |
| .service | 2 | 1,147 |
| .conf / .yml / .ico / .bak | 各 1 | 2,640 / 37,793 / 4,286 / 29,664 |

## 按顶层目录汇总（count / 未压缩字节）

| dir | count | bytes |
|---|---:|---:|
| aitutor/database/高考真题 | 11,762 | 49,758,913,833 |
| aitutor/database/OLD | 8,319 | 18,350,811,145 |
| aitutor（根级小文件） | 34 | 9,275,253 |
| aitutor/database/graphify-zhongkao-beijing | 11 | 3,754,170 |
| aitutor/database/高中知识点归纳汇总 | 9 | 14,762,235 |
| aitutor/database/graphify-gaokao | 6 | 17,357,613 |
| aitutor/database/graphify-gaokao-knowledge | 5 | 10,885,469 |

## 本次抽出与保留

- 抽取范围：**仅 `.json`(17) 与 `.docx`(166)**，合计 183 个 / 约 83.7 MiB（未解压 .pdf/.mp3/.zip/.7z，用户已决定放弃）。
- 落点（剥离 `aitutor/` 顶层前缀，按原相对路径还原，均位于 `.gitignore` 内）：
  - `database/OLD/`：71 docx + 3 json
  - `database/高考真题/`：95 docx
- 去重丢弃：
  - 10 个与仓库现有文件**逐字节相同**的 .json（graphify-* / public/manifest.json）。
  - 2 个根级配置 `package.json`、`package-lock.json`：大小不同（zip 内为更旧快照），还原会覆盖仓库较新版本，故不还原。
  - 2 个本地工具配置 `.claude/settings.local.json`、`.gitnexus/meta.json`：属于另一 checkout 的本地状态且可重生成，不还原。
- 实际新增：166 docx + 3 json = **169 个**。

## 如何读完整逐条清单

完整 20,237 行（`path<TAB>uncompressed_size<TAB>mtime`）存于同目录
`aitutor-zip-manifest-2026-09-24.tsv.gz`（gzip，约 206 KB）：

```bash
zcat database/aitutor-zip-manifest-2026-09-24.tsv.gz | less
# 未压缩版 4.1 MB（>1MB 阈值，故只入库压缩版，且已被 .gitignore 忽略）
```
