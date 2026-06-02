@echo off
chcp 65001
echo ============================================
echo     AI Tutor 启动脚本 (Windows)
echo ============================================
echo.

:: 检查 Node.js 是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Node.js，请先安装 Node.js
    echo        下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查是否已安装依赖
if not exist "node_modules" (
    echo 📦 正在安装依赖...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)

:: 设置环境变量
set NODE_ENV=development

:: 启动服务器
echo 🚀 启动 AI Tutor 服务...
echo.
echo 服务将在 http://localhost:3002 运行
echo.
npm start

pause
