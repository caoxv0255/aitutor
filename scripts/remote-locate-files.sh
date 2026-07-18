#!/bin/bash
# ============================================================
# 定位远程服务器上文件的实际位置
# ============================================================

cd ~/Desktop/NewDisk_2T/new_fastapi.git/aitutor/database/高考真题

echo "========== [1/6] 检查省份目录下的文件分布 =========="
echo "省份目录下直接的文件数（不在子目录中）:"
for dir in $(ls -d */ 2>/dev/null | sed 's|/$||'); do
  cnt=$(find "$dir" -maxdepth 1 -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | wc -l)
  if [ $cnt -gt 0 ]; then
    echo "  $dir: $cnt个文件"
  fi
done
echo ""

echo "========== [2/6] 检查是否有二级子目录 =========="
echo "各省份目录下的二级目录:"
for dir in $(ls -d */ 2>/dev/null | sed 's|/$||'); do
  sub_dirs=$(find "$dir" -maxdepth 2 -type d ! -path "$dir" 2>/dev/null | sed "s|$dir/||")
  if [ -n "$sub_dirs" ]; then
    echo "  $dir:"
    echo "$sub_dirs" | head -10
    echo "  ..."
  fi
done
echo ""

echo "========== [3/6] 查看北京目录下的文件结构 =========="
echo "北京高考目录下直接的文件:"
find "北京高考" -maxdepth 1 -type f 2>/dev/null | head -20
echo ""

echo "北京高考数学子目录中的文件:"
ls -la "北京高考/2. 北京高考数学2008-2025/" 2>/dev/null | head -20
echo ""

echo "========== [4/6] 查看任意一个有文件的省份目录 =========="
echo "上海高考目录下直接的文件:"
find "上海高考" -maxdepth 1 -type f 2>/dev/null | head -20
echo ""

echo "上海高考语文子目录中的文件:"
ls -la "上海高考/1. 上海高考语文2008-2025/" 2>/dev/null | head -20
echo ""

echo "========== [5/6] 检查文件命名模式 =========="
echo "前50个文件名样本:"
find . -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | head -50
echo ""

echo "========== [6/6] 检查是否存在文综/理综文件 =========="
echo "搜索文综/理综相关文件:"
find . -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | grep -iE "文综|理综|文科综合|理科综合" | head -20
echo ""

echo "搜索理科数学文件:"
find . -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | grep -i "理科" | head -20
echo ""

echo "搜索文科数学文件:"
find . -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | grep -i "文科" | head -20
