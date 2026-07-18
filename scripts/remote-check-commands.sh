#!/bin/bash
# ============================================================
# 远程服务器试卷文件检查脚本
# 在远程服务器 ~/Desktop/NewDisk_2T/new_fastapi.git/aitutor/database/高考真题 目录下执行
# ============================================================

echo "========== 1. 检查远程服务器高考真题目录结构 =========="
cd ~/Desktop/NewDisk_2T/new_fastapi.git/aitutor/database/高考真题
echo "当前目录: $(pwd)"
echo "省份目录数: $(ls -d */ 2>/dev/null | wc -l)"
echo ""

echo "========== 2. 检查各省份目录列表 =========="
ls -d */
echo ""

echo "========== 3. 统计总文件数 =========="
find . -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) | wc -l
echo ""

echo "========== 4. 检查是否存在全国卷共享目录 =========="
ls -d *全国* 2>/dev/null || echo "无全国卷目录"
ls -d *文综* *理综* 2>/dev/null || echo "无文综理综目录"
echo ""

echo "========== 5. 检查政治学科目录分布 =========="
for dir in */; do
  if [ -d "${dir}8. "*"政治"* ]; then
    count=$(find "${dir}8. "*"政治"* -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | wc -l)
    echo "  ${dir}8.*政治*: ${count}个文件"
  fi
done
echo ""

echo "========== 6. 检查数学学科目录分布 =========="
for dir in */; do
  if [ -d "${dir}2. "*"数学"* ]; then
    count=$(find "${dir}2. "*"数学"* -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | wc -l)
    echo "  ${dir}2.*数学*: ${count}个文件"
  fi
done
echo ""

echo "========== 7. 检查是否有理科数学文件 =========="
find . -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) | grep -i "理科" | head -20
echo ""

echo "========== 8. 检查是否有文综/理综文件 =========="
find . -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) | grep -iE "文综|理综|文科综合|理科综合" | head -20
echo ""

echo "========== 9. 检查北京目录中的全国卷文件 =========="
find "北京高考/2. 北京高考数学2008-2025" -type f -name "*全国*" 2>/dev/null | sort
echo ""

echo "========== 10. 各省份文件数统计 =========="
for dir in */; do
  count=$(find "$dir" -type f \( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" \) 2>/dev/null | wc -l)
  echo "  ${dir}: ${count}个文件"
done
