---
name: uibe-git-server
description: UIBE 内部 Git 服务 (git.uibe.online) 完整操作手册 — 所有 Git 操作、认证、仓库管理、用户管理
category: devops
tags: [git, uibe, git-server, http, smart-http, ssh, htpasswd, repository-management]
---

# UIBE Git 服务器完整操作手册

UIBE 自建 Git 服务器（本机），通过 Cloudflare Tunnel 对外暴露。本机可直接操作仓库文件，无需走网络。

## ⚡ 连接策略（重要！）

```
本机/局域网 → 优先用 IP：219.224.5.250:8081
外网/公网  → 用域名：git.uibe.online
本机直达   → localhost:8081
```

**规则：局域网内（UIBE 内网）优先用 IP 直连**，绕过 Cloudflare Tunnel，延迟最低。域名 `git.uibe.online` 走 Tunnel 会经过 Cloudflare 边缘节点，在局域网内反而更慢。

## 架构总览

```
公网用户 → git.uibe.online → Cloudflare Tunnel → localhost:8081 → Nginx + git-http-backend → /home/git/repos/
局域网用户 → 219.224.5.250:8081 → (直连) → Nginx → /home/git/repos/
本机操作（免网络）→ 直接读写 /home/git/repos/
本机 SSH  → 219.224.5.250:22 → 本机 → 直接读写 /home/git/repos/
```

## 服务器信息

| 项目 | 值 |
|------|-----|
| **HTTPS URL（公网）** | `https://git.uibe.online` |
| **HTTP IP（局域网优先）** | `http://219.224.5.250:8081` |
| **本机 HTTP** | `http://localhost:8081` |
| **本机路径** | `/home/git/repos/` |
| **SSH（局域网免密）** | `flaskappuser@219.224.5.250:/home/git/repos/` |
| **认证** | HTTP Basic Auth (8个用户) |

## 认证信息 — 所有用户密码

### HTTP Basic Auth 用户（htpasswd）

| 用户名 | 密码 | 说明 |
|--------|------|------|
| **main** | **Uibeliu60!** | ❗管理员账号，拥有所有仓库权限 |
| git | (htpasswd hash, 见 `/etc/nginx/git-auth/htpasswd`) | 默认git用户 |
| jwgong | (同文件) | 教师/学生用户 |
| yliu | (同文件) | 教师/学生用户 |
| jlchen | (同文件) | 教师/学生用户 |
| ywang | (同文件) | 教师/学生用户 |
| dyzheng | (同文件) | 教师/学生用户 |
| wzlin | (同文件) | 教师/学生用户 |

> 💡 所有 htpasswd 密码为 Apache $apr1$ 加密哈希。重置密码用 `sudo htpasswd /etc/nginx/git-auth/htpasswd <用户名>`。

### SSH 免密（本机/局域网自连接）

```
用户: flaskappuser
方式: SSH 公钥 (id_rsa.pub 已在 authorized_keys 中)
连接: ssh flaskappuser@219.224.5.250
```

## 本机仓库列表

| 仓库 | 大小 | 路径 |
|------|------|------|
| next_fastapi.git | ~4.4G | `/home/git/repos/next_fastapi.git` |
| next_pyweb.git | ~2.2G | `/home/git/repos/next_pyweb.git` |
| myproject.git | ~176K | `/home/git/repos/myproject.git` |
| wukong.git | ~12M | `/home/git/repos/wukong.git` |
| aiswitch.git | ~? | `/home/git/repos/aiswitch.git` |
| ai4family.git | ~144K | `/home/git/repos/ai4family.git` |
| 6alpha.git | ~116K | `/home/git/repos/6alpha.git` |

---

## 🔴 一、克隆仓库（5种方式，按优先级排序）

### 方式1：本机文件路径（最快，零网络）

```bash
git clone /home/git/repos/next_fastapi.git
```

### 方式2：本机 HTTP（不走网络，次快）

```bash
git clone http://main:Uibeliu60%21@localhost:8081/next_fastapi.git
```

### 方式3：局域网 SSH（免密，推荐局域网内用）

```bash
git clone flaskappuser@219.224.5.250:/home/git/repos/next_fastapi.git
```

### 方式4：局域网 HTTP（直接 IP，适合局域网内其他机器）

```bash
git clone http://main:Uibeliu60%21@219.224.5.250:8081/next_fastapi.git
```

### 方式5：HTTPS 域名（公网，最后选择）

```bash
# 基本用法（会提示输入密码）
git clone https://git.uibe.online/next_fastapi.git

# 内嵌用户名（密码会提示输入）
git clone https://main@git.uibe.online/next_fastapi.git

# 内嵌用户名和密码（注意！需URL编码）
# ! → %21, @ → %40, # → %23, $ → %24
git clone https://main:Uibeliu60%21@git.uibe.online/next_fastapi.git
```

### 凭证缓存（避免重复输入密码）

```bash
# 缓存密码 1 小时
git config --global credential.helper 'cache --timeout=3600'

# 缓存密码 1 天
git config --global credential.helper 'cache --timeout=86400'

# 永久存储凭证
git config --global credential.helper store
```

---

## 🟢 二、推送代码

### 首次推送（设置远程，按优先级排序）

```bash
# 1️⃣ 优先：本机路径（不需要认证，最快）
git remote add origin /home/git/repos/项目名.git
git push -u origin main

# 2️⃣ 次选：局域网 IP（其他机器在同一内网）
git remote add origin http://main:Uibeliu60%21@219.224.5.250:8081/项目名.git
git push -u origin main

# 3️⃣ 最后：公网域名
git remote add origin https://main:Uibeliu60%21@git.uibe.online/项目名.git
git push -u origin main
```

### 日常推送

```bash
git add .
git commit -m "提交说明"
git push
```

### 强制推送（谨慎！）

```bash
git push --force origin main
# 或使用 force-with-lease（更安全，检测冲突）
git push --force-with-lease origin main
```

### 推送到特定分支

```bash
git push origin main:dev-branch
```

---

## 🟡 三、拉取和同步

```bash
# 拉取最新代码
git pull

# 拉取但不要自动合并
git fetch origin

# 拉取并 rebase（保持线性历史）
git pull --rebase

# 查看远程分支
git branch -r

# 查看所有分支（本地+远程）
git branch -a
```

---

## 🔵 四、仓库管理（本机操作）

### 4.1 创建新仓库（bare）

```bash
# flaskappuser 在 git 组中（setgid），直接创建即可，无需 sudo
git init --bare /home/git/repos/新仓库名.git
chmod -R g+ws /home/git/repos/新仓库名.git
```

> ⚠️ 新 bare 仓库的 HEAD 默认指向 `master`。如果推送的分支名为 `main`，需手动修正：
> ```bash
> git --git-dir=/home/git/repos/新仓库名.git symbolic-ref HEAD refs/heads/main
> ```

### 4.2 从现有项目创建远程仓库并推送

```bash
# 先在 git 目录下创建 bare 仓库（flaskappuser 在 git 组中，无需 sudo）
git init --bare /home/git/repos/新仓库名.git
chmod -R g+ws /home/git/repos/新仓库名.git

# 在本地项目中关联并推送
git remote add origin https://main:Uibeliu60%21@git.uibe.online/新仓库名.git
git push -u origin main
```

> 创建完毕后，网页端（https://git.uibe.online）会自动显示新仓库。
> 如需更新网页列表，编辑 `/etc/nginx/sites-available/git-uibe` 中的 HTML 部分。

### 4.3 删除仓库

```bash
sudo rm -rf /home/git/repos/要删除的仓库名.git
```

> ⚠️ 此操作不可逆！删除前建议备份或确认。

### 4.4 重命名仓库

```bash
sudo mv /home/git/repos/旧名.git /home/git/repos/新名.git
sudo chown -R git:git /home/git/repos/新名.git
```

> 重命名后记得更新 nginx 的仓库列表页面。

### 4.5 备份仓库

```bash
# 打包备份
tar -czf /home/git/repos-备份-$(date +%Y%m%d).tar.gz /home/git/repos/某仓库.git

# 克隆镜像备份
git clone --mirror /home/git/repos/某仓库.git /backup/某仓库.git
```

### 4.6 查看仓库详情

```bash
# 查看仓库大小
du -sh /home/git/repos/某仓库.git

# 查看最新提交
git --git-dir=/home/git/repos/某仓库.git log --oneline -10

# 查看所有分支
git --git-dir=/home/git/repos/某仓库.git branch -a

# 查看所有标签
git --git-dir=/home/git/repos/某仓库.git tag -l

# 查看提交历史（带时间）
git --git-dir=/home/git/repos/某仓库.git log --oneline --graph --all -20

# 查看仓库总大小
du -sh /home/git/repos/
```

---

## 🟣 五、用户管理

### 5.1 查看所有用户

```bash
sudo cat /etc/nginx/git-auth/htpasswd
```

### 5.2 添加新用户

```bash
sudo htpasswd /etc/nginx/git-auth/htpasswd 新用户名
# 会提示输入两次密码
```

### 5.3 修改用户密码

```bash
sudo htpasswd /etc/nginx/git-auth/htpasswd 已存在的用户名
# 会提示输入新密码
```

### 5.4 删除用户

```bash
sudo htpasswd -D /etc/nginx/git-auth/htpasswd 要删除的用户名
```

### 5.5 重置 main 管理员密码

```bash
sudo htpasswd /etc/nginx/git-auth/htpasswd main
# 输入新密码
```

---

## 🟠 六、分支和标签管理

### 远程分支

```bash
# 创建远程分支
git push origin 本地分支名:远程分支名

# 删除远程分支
git push origin --delete 分支名

# 或
git push origin :分支名
```

### 标签

```bash
# 创建标签
git tag v1.0.0 -m "版本1.0.0"

# 推送标签到远程
git push origin v1.0.0

# 推送所有标签
git push origin --tags

# 删除远程标签
git push origin --delete v1.0.0
```

---

## 🟤 七、合并与变基

```bash
# 合并分支
git merge feature-branch

# 变基（推荐，保持历史线性）
git rebase main

# 变基并应用到远程
git pull --rebase origin main
git push

# 如果有冲突，解决后继续变基
git add .
git rebase --continue
```

---

## ⚪ 八、查看服务器日志

### Git HTTP 访问日志

```bash
# 实时查看
tail -f /var/log/nginx/git-uibe-access.log

# 按时间过滤
grep "08:4[0-9]:" /var/log/nginx/git-uibe-access.log

# 查询特定仓库
grep "6alpha.git" /var/log/nginx/git-uibe-access.log

# 查询特定操作 (git-receive-pack = push, git-upload-pack = clone/fetch)
grep "git-receive-pack" /var/log/nginx/git-uibe-access.log
grep "git-upload-pack" /var/log/nginx/git-uibe-access.log
```

### Git HTTP 错误日志

```bash
tail -f /var/log/nginx/git-uibe-error.log
```

### SSH 连接日志

```bash
# 查看 SSH 登录记录
grep "sshd" /var/log/auth.log | grep "219.224.5.88" | tail -20

# 查看 session 关闭记录
grep "session closed" /var/log/auth.log | grep "flaskappuser"
```

---

## 🔧 九、故障排查

### 9.0 .gitignore 已忽略文件强制提交

当某目录在根 `.gitignore` 中被排除（如 `config/`），但需要强制提交时：

```bash
# git add -f 可绕过 .gitignore
git add -f config/

# 注意：子目录 .gitignore 只对未跟踪文件生效。
# 如果提交了不该有的文件，从跟踪中移除但保留本地文件：
git rm --cached config/*.log config/*.db
git commit --amend  # 整理到上一个提交中
```

### 9.1 Push 报 "unable to create temporary object directory"

```bash
# 修复权限
sudo chmod -R g+ws /home/git/repos/某仓库.git
```

### 9.2 Push 报 "403 Forbidden"

```bash
# 检查密码是否正确
curl -I -u main:密码 http://localhost:8081/
# 返回 401 → 密码错误；返回 200 → 密码正确
```

### 9.3 Clone 超时

```bash
# 检查 cloudflared 是否运行
ps aux | grep cloudflared

# 检查 nginx 是否运行
systemctl status nginx

# 检查端口
netstat -tlnp | grep 8081

# 从本机直接测试（绕过 tunnel）
curl -s -u main:Uibeliu60 http://localhost:8081/
```

### 9.4 仓库损坏

```bash
# 检查完整性
git --git-dir=/home/git/repos/某仓库.git fsck

# 修复（谨慎）
git --git-dir=/home/git/repos/某仓库.git fsck --unreachable

# 清理无效对象
git --git-dir=/home/git/repos/某仓库.git gc --prune=now
```

### 9.5 仓库太大，clone 慢

```bash
# 浅克隆（只取最近 N 个提交）
git clone --depth 1 https://git.uibe.online/next_fastapi.git

# 克隆后取消浅层限制（可选）
git fetch --unshallow
```

### 9.6 已有仓库在内外网间切换网络环境

**场景：** 仓库在校园网内用 SSH 克隆（`flaskappuser@219.224.5.250:/home/git/repos/...`），拿到外网连接失败（"Connection closed by 219.224.5.250"）。

**原因：** SSH 端口 22 从外网不可达。需要临时或永久切换到 HTTPS 公网域名。

**解决方案：**

```bash
# 1️⃣ 查看当前 remote
git remote -v

# 2️⃣ 切换到公网 HTTPS（带认证）
git remote set-url origin https://main:Uibeliu60%21@git.uibe.online/仓库名.git

# 3️⃣ 拉取/推送
git pull
# 或 git push

# 4️⃣ 回到校园网后切回 SSH 免密
git remote set-url origin flaskappuser@219.224.5.250:/home/git/repos/仓库名.git
```

**⚠️ 坑：已跟踪的二进制数据库文件冲突**

如果仓库的 `.gitignore` 忽略了 `config/` 目录（如 aiswitch 项目），但远程仍跟踪了其中的二进制 DB 文件（`.db`, `.db-shm`, `.db-wal`），`git pull` 更新这些文件时会报冲突：

```
error: Your local changes to the following files would be overwritten by merge:
    config/aiswitch.db
```

正确做法是保留本地版本（使用 `--ours`），因为这些是运行时数据，应跟随本地状态：

```bash
# 先 stash 本地 config 文件
git stash push -- config/aiswitch.db config/aiswitch.db-shm config/aiswitch.db-wal
git pull

# 用本地版本覆盖远程的 config 文件
git checkout --ours -- config/aiswitch.db config/aiswitch.db-shm config/aiswitch.db-wal
git restore --staged config/aiswitch.db config/aiswitch.db-shm config/aiswitch.db-wal
git stash drop
```

> 注意：这些文件在 `.gitignore` 中，所以 `git add` 会报 "ignored by .gitignore" — 要用 `git checkout --ours` + `git restore --staged` 而非 `git add` 来标记解决。

---

## ⚙️ 十、服务器配置管理

### Nginx 配置

```bash
# 查看配置
cat /etc/nginx/sites-available/git-uibe

# 编辑后重载
sudo nginx -t && sudo systemctl reload nginx
```

### Cloudflare Tunnel 配置

```bash
# 查看 tunnel ingress 规则
cat ~/.cloudflared/aitutor-uibe.yml

# 重启 tunnel
systemctl --user restart cloudflared-aitutor-uibe
```

### 更新仓库列表页面

编辑 `/etc/nginx/sites-available/git-uibe` 中 `location = /` 的 HTML 部分，添加/删除新仓库的 `<li>` 条目，然后 `sudo nginx -t && sudo systemctl reload nginx`。

---

## 📝 十一、常用快捷命令汇总

```bash
# 🔴 克隆
# ① 本机路径
git clone /home/git/repos/某仓库.git
# ② 本机HTTP
git clone http://main:Uibeliu60%21@localhost:8081/某仓库.git
# ③ 局域网SSH免密
git clone flaskappuser@219.224.5.250:/home/git/repos/某仓库.git
# ④ 局域网HTTP
git clone http://main:Uibeliu60%21@219.224.5.250:8081/某仓库.git
# ⑤ 公网HTTPS
git clone https://main:Uibeliu60%21@git.uibe.online/某仓库.git

# 🆕 创建新仓库
git init --bare /home/git/repos/新仓库.git
chmod -R g+ws /home/git/repos/新仓库.git

# 📋 查看仓库列表
ls -la /home/git/repos/

# 👥 查看所有用户
sudo cat /etc/nginx/git-auth/htpasswd

# ➕ 添加用户
sudo htpasswd /etc/nginx/git-auth/htpasswd 用户名

# 📡 检查服务
curl -s -u main:Uibeliu60 http://localhost:8081/
curl -s -u main:Uibeliu60 http://219.224.5.250:8081/
```
