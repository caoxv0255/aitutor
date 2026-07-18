#!/bin/bash
# ============================================================
# 远程服务器高考试卷文件诊断脚本
# 使用方法：在远程服务器高考真题目录下执行 ./remote-diagnose.sh
# ============================================================

set -e

cd ~/Desktop/NewDisk_2T/new_fastapi.git/aitutor/database/高考真题

echo "========== [1/7] 总文件统计 =========="
pdf_count=$(find . -type f -name "*.pdf" 2>/dev/null | wc -l)
doc_count=$(find . -type f -name "*.doc" 2>/dev/null | wc -l)
docx_count=$(find . -type f -name "*.docx" 2>/dev/null | wc -l)
total=$((pdf_count + doc_count + docx_count))
echo "PDF文件: $pdf_count"
echo "DOC文件: $doc_count"
echo "DOCX文件: $docx_count"
echo "总文件数: $total"
echo ""

echo "========== [2/7] 各省份目录列表 =========="
province_dirs=$(ls -d */ 2>/dev/null | sed 's|/$||')
echo "省份目录数: $(echo "$province_dirs" | wc -l)"
echo "$province_dirs"
echo ""

echo "========== [3/7] 各省份文件数统计 =========="
echo "省份目录                  PDF   DOC  DOCX  合计"
echo "-----------------------------------------------"
for dir in $province_dirs; do
  pd=$(find "$dir" -type f -name "*.pdf" 2>/dev/null | wc -l)
  dc=$(find "$dir" -type f -name "*.doc" 2>/dev/null | wc -l)
  dx=$(find "$dir" -type f -name "*.docx" 2>/dev/null | wc -l)
  total=$((pd + dc + dx))
  printf "%-24s %4d %4d %4d %6d\n" "$dir" "$pd" "$dc" "$dx" "$total"
done
echo ""

echo "========== [4/7] 各省份学科目录文件数矩阵 =========="
echo "省份        语文    数学    英语    物理    化学    生物    历史    政治    地理"
echo "---------------------------------------------------------------------------------"
for dir in $province_dirs; do
  prov=$(echo "$dir" | sed 's/高考//')
  counts=()
  for num in 1 2 3 4 5 6 7 8 9; do
    sub_dir=$(find "$dir" -maxdepth 1 -type d -name "${num}.*" 2>/dev/null | head -1)
    if [ -n "$sub_dir" ]; then
      cnt=$(find "$sub_dir" -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | wc -l)
    else
      cnt=0
    fi
    counts+=("$cnt")
  done
  printf "%-12s" "$prov"
  for c in "${counts[@]}"; do
    printf "%6d" "$c"
  done
  echo ""
done
echo ""

echo "========== [5/7] 理科数学文件检查 =========="
science_math_files=$(find . -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | grep -i "理科" | head -20)
if [ -n "$science_math_files" ]; then
  echo "找到理科数学文件:"
  echo "$science_math_files"
else
  echo "未找到理科数学文件"
fi
echo ""

echo "========== [6/7] 文综/理综文件检查 =========="
comprehensive_files=$(find . -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | grep -iE "文综|理综|文科综合|理科综合" | head -20)
if [ -n "$comprehensive_files" ]; then
  echo "找到文综/理综文件:"
  echo "$comprehensive_files"
else
  echo "未找到文综/理综文件"
fi
echo ""

echo "========== [7/7] 北京目录详细检查（作为基准）=========="
echo "北京高考各学科目录文件数:"
for num in 1 2 3 4 5 6 7 8 9; do
  sub_dir=$(find "北京高考" -maxdepth 1 -type d -name "${num}.*" 2>/dev/null | head -1)
  if [ -n "$sub_dir" ]; then
    cnt=$(find "$sub_dir" -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | wc -l)
    echo "  ${sub_dir}: ${cnt}个文件"
  else
    echo "  北京高考/${num}.*: 目录不存在"
  fi
done

echo ""
echo "北京高考数学目录中的全国卷文件:"
find "北京高考/2. 北京高考数学2008-2025" -type f -name "*全国*" 2>/dev/null | sort
echo ""

echo "========== 诊断完成 =========="
echo "请将以上输出复制粘贴给AI助手，以便制定文件补充方案。"
