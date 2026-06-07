# WebApp (PWA) 使用指南

## 已完成配置

✅ manifest.json - PWA 配置文件
✅ sw.js - Service Worker 离线缓存
✅ index.html - 添加 PWA meta 标签

## 安装到手机

### iOS (iPhone/iPad)
1. 用 Safari 打开你的网站
2. 点击底部分享按钮
3. 选择"添加到主屏幕"
4. 点击"添加"

### Android
1. 用 Chrome 打开你的网站
2. 点击右上角菜单
3. 选择"安装应用"或"添加到主屏幕"
4. 点击"安装"

## 需要准备的图标

在 `/icons/` 目录下放置以下尺寸的 PNG 图标：
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

可以使用在线工具生成：https://realfavicongenerator.net/

## PWA 功能

✅ 离线访问 - 缓存静态资源
✅ 添加到主屏幕 - 像原生 App 一样
✅ 全屏显示 - 隐藏浏览器地址栏
✅ 启动画面 - 自定义加载界面
✅ 主题色 - 状态栏颜色适配

## 测试

部署到 Vercel 后，用手机浏览器访问，即可看到"安装应用"提示。
