#!/bin/bash
# AI Tutor 完整流程测试脚本

echo "=== AI Tutor 完整流程测试 ==="
echo

# 1. 测试省份 API
echo "1. 测试省份数据..."
curl -s "http://localhost:3002/api/provinces" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'  ✓ 省份数量: {data[\"total\"]}')
if data['data']:
    print(f'  ✓ 示例省份: {data[\"data\"][0][\"name\"]}')
"
echo

# 2. 测试省份详情
echo "2. 测试省份详情..."
curl -s "http://localhost:3002/api/provinces/beijing" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['success']:
    province = data['data']
    print(f'  ✓ 省份: {province[\"name\"]}')
    print(f'  ✓ 类型: {province[\"exam_type\"]}')
else:
    print('  ✗ API 调用失败')
"
echo

# 3. 测试试卷查询
echo "3. 测试试卷查询..."
curl -s "http://localhost:3002/api/exam-papers?province=beijing&limit=5" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['success']:
    print(f'  ✓ 北京试卷数量: {data[\"data\"]}')
    if data['data']:
        print(f'  ✓ 示例: {data["data"][0]["year"]}年{data["data"][0]["subject"]}试卷')
    else:
        print('  (暂无试卷数据)')
else:
    print('  ✗ API 调用失败')
"
echo

# 4. 测试趋势分析（如果有数据）
echo "4. 测试趋势分析..."
curl -s -w "HTTP_CODE: %{http_code}\n" "http://localhost:3002/api/province-trends/beijing?years=3" 2>/dev/null | tail -1 | grep -v "HTTP_CODE" > /dev/null
if [ $? -eq 0 ]; then
    curl -s "http://localhost:3002/api/province-trends/beijing?years=3" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['success']:
    print('  ✓ 趋势数据获取成功')
    if data['data'].get('summary'):
        print(f'  ✓ 趋势摘要: {data[\"data\"][\"summary\"][\"title\"]}')
    else:
        print('  (暂无趋势数据)')
else:
    print('  ✗ 趋势数据获取失败')
    "
else
    echo "  ! 趋势 API 不可用"
fi
echo

# 5. 测试用户省份偏好（需要登录）
echo "5. 测试用户省份偏好（需登录）..."
echo "  ! 需要登录才能测试此功能"
echo

# 6. 测试首页功能
echo "6. 测试首页..."
curl -s "http://localhost:3002/" | head -20 | grep -i "tutor\|省份\|选择" > /dev/null
if [ $? -eq 0 ]; then
    echo "  ✓ 首页可访问"
    echo "  ! 可以在浏览器访问 http://localhost:3002/ 测试省份选择功能"
else
    echo "  ✗ 首页访问异常"
fi
echo

# 7. 测试 PWA 应用
echo "7. 测试 PWA 应用..."
curl -s "http://localhost:3002/app" | head -10 | grep -i "menu\|login\|省份" > /dev/null
if [ $? -eq 0 ]; then
    echo "  ✓ PWA 应用可访问"
    echo "  ! 可以在手机浏览器访问 http://localhost:3002/app 测试省份选择流程"
else
    echo "  ✗ PWA 访问异常"
fi
echo

echo "=== 测试完成 ==="
echo
echo "建议下一步："
echo "1. 访问 http://localhost:3002/ 测试首页省份选择功能"
echo "2. 访问 http://localhost:3002/province.html?code=beijing 测试省份详情页"
echo "3. 访问 http://localhost:3002/app 测试 PWA 手机端"