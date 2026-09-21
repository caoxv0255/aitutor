# 部署边界与项目归属 (Deployment Boundaries)

> ⚠️ **本文件记录部署机上各配置文件的项目归属, 任何修改前必读!**

## 核心原则

**部署机 `/etc/nginx/sites-enabled/` 目录是「共享区域」**, 多个项目的配置共存于此。修改任何文件前, 必须确认它属于哪个项目、会影响哪些域名。

## 部署机配置文件清单 (以 2026-09-17 状态为准)

| 路径 | 归属项目 | 服务的域名 | 修改风险 |
|------|---------|-----------|---------|
| `/etc/nginx/sites-enabled/uibe.conf` | **new_fastapi.git** (学校主站网关) | `lab.uibe.edu.cn`, `www.uibe.online`, `aitutor-v2.duckdns.org` | 🔴 **极高**: 影响全校站点 |
| `/etc/nginx/sites-enabled/design-v2-cf.conf` | aitutor (设计 v2, Cloudflare SSL) | `_` (兜底, listen 8096 ssl → 8090) | 🟡 中: 只影响 8096 端口 |
| `/etc/nginx/sites-enabled/design-v2-direct.conf` | aitutor (设计 v2, 直连) | `_` (兜底, listen 8095 → 8090) | 🟡 中: 只影响 8095 端口 |

## aitutor 项目对外暴露路径（以 2026-09-17 18:24 实测为准）

| 入口 | 链路 | 状态 |
|------|------|------|
| `https://aitutor.uibe.online/` | Cloudflare → **`uibe-tutor.service` (:3002, `node server.js`, cwd `/home/flaskappuser/Desktop/NewDisk_2T/aitutor`)** | ✅ 200 |
| `https://aitutor.uibe.online/v2/*` | 同上 :3002，由 `server.js` 内 `V2-DESIGN` 区块托管 `frontend-v2/`（2026-09-21 从 `docs/design/` 迁入） | ✅ 200 |
| `https://lab.uibe.edu.cn/aitutor/*` | uibe.conf `location ^~ /aitutor` → `tutor_server` (:3002) | ✅ 公网直通 |
| `https://aitutor-v2.duckdns.org/` | uibe.conf `location / { root .../aitutor/docs/design; try_files /hero.html; }` | ⚠️ DuckDNS 解析到服务器才通 |

> 2026-09-21 注：页面已迁入 `frontend-v2/`，两个服务均已重启并改指新目录：
> `server.js`（:3002 的 `/v2`）与 `server-design-v2.js`（systemd `uibe-design-v2`，:8090）。
> `docs/design/` 现只保留设计文档（.md）与验证截图，不再含运行时页面。

> ⚠️ **实测纠正 (2026-09-17 18:00)**：`aitutor.uibe.online` 的源站是 **:3002**。
> 判据：线上每条路径（`/vendor/katex.min.js`、`/manifest.json`、`/health` 的错误信封）
> 与 `127.0.0.1:3002` 逐字节一致。
> `~/.cloudflared/aitutor-uibe.yml` 里写的 `aitutor.uibe.online → :8090` **实测未生效**，
> 排查该域名时**不要**被它误导。
> 另注：本文档早先写的「CNAME → www.uibe.online (Host 重写) → uibe.conf → root .../public」
> 与实际不符，已按实测更正。

## `/v2/` 现状与历史方案

**结论（2026-09-17 18:24 起）**：`/v2/` 由**应用层**提供，不需要任何 nginx / Cloudflare 改动。

- 实现位置：`server.js` 内 `V2-DESIGN-BEGIN` … `V2-DESIGN-END` 区块
- 目录：`frontend-v2/`（可用 `DESIGN_V2_DIR` 环境变量覆盖）
- 行为：`/v2/` → `hero.html`；`/v2/<slug>` → 301 `/v2/<slug>.html`；
  `*.md` 与 `_e2e-screenshots/` 主动 404
- 之所以能挂子路径：24 页全部用相对路径引用资源，仅 `hero.html` 一处 `href="/"`

**历史**：`lab.uibe.edu.cn` 的 `/v2/` location（2026-09-17 17:01 误加到 uibe.conf，
proxy 到 :8090）已于同日 **18:24 移除**，`lab.uibe.edu.cn/v2/` 现落到 Next.js 应用返回 404。

以下方案对比**已作废**，保留仅作历史记录：

| 方案 | 是否改 uibe.conf | 影响范围 | 结果 |
|------|------------------|---------|--------|
| Cloudflare Worker / Origin Rules | ❌ 否 | 仅 `/v2/*` 路径 | 未采用（需 CF 凭据） |
| Cloudflare Tunnel (cloudflared) | ❌ 否 | 仅 v2 子域名 | 未采用（该隧道规则实测未生效） |
| 独立 conf.d / include | 🟡 改一行 include | 仅 `/v2/*` | 未采用 |
| **应用层 `server.js` 子路径挂载** | ❌ 否 | 仅 `/v2/*` | ⭐ **已采用** |
| 在 uibe.conf 里加 `location ^~ /v2/` | ❌ 是 | 🔴 影响 lab/www | ❌ 绝对不要（曾误加，已移除） |

## 教训 (L-2026-09-17)

**错误**: 以为 `/etc/nginx/sites-enabled/uibe.conf` 是 aitutor 项目专属, 给它加了 `/v2/` location。

**真相**: 这个文件是 `new_fastapi.git` (学校主站) 的网关, 同时服务 `lab.uibe.edu.cn` / `www.uibe.online` / `aitutor-v2.duckdns.org` 三个域名。修改它意味着修改全校站点配置。

**根因**:
1. 文件名误导 (`uibe.conf` 看起来像是 UIBE aitutor 项目的, 实际是学校主项目的)
2. 没在动手前 grep `server_name` 看清楚服务哪些域名
3. 没在动手前问用户「这个文件属于哪个项目」

**修复**:
- 回滚 uibe.conf 到最早备份
- 以后给 aitutor 加任何 nginx 规则, **只能用** conf.d/include 或 Cloudflare 边缘方案, **绝不直接改 uibe.conf**

## 修改部署机配置前的检查清单

修改任何 `/etc/nginx/sites-enabled/*.conf` 前, 必须:

- [ ] `grep "server_name" <文件>` 确认服务哪些域名
- [ ] 询问用户: 这个文件属于哪个项目? 影响范围是什么?
- [ ] 如果目标是 aitutor, 优先用 conf.d/include 或 CF 边缘方案
- [ ] 修改前**必须**做完整备份 (cp 到 /tmp 而不是放在 sites-enabled/!)
- [ ] `nginx -t` 必须先通过再 `nginx -s reload`
- [ ] 任何 .bak 备份**不能**放在 sites-enabled/ 目录里!

## 相关文件

- `server.js` 内 `V2-DESIGN-BEGIN` … `V2-DESIGN-END` 区块 — `/v2` 设计稿托管（应用层，无需 nginx）
- `deploy/uibe.conf` — aitutor 部署**模板** (仅参考, 千万别覆盖主站网关)
- `deploy/design-v2-cf.conf` — aitutor 设计 v2 反代配置 (新建)
- `deploy/design-v2-direct.conf` — aitutor 设计 v2 直连配置 (新建)
- `deploy/uibe-tutor.service` — aitutor 主后端 systemd unit (3002)，**就是它提供 aitutor.uibe.online**
- `deploy/uibe-design-v2.service` — aitutor 设计 v2 systemd unit (8090)；lab 的 `/v2` 移除后已无调用方，可考虑 `systemctl disable --now`
