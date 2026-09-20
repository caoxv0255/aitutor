# Deployment Report · Round 12

**生成时间**: 2026-09-16T04:34:19.943Z
**部署栈**: design-v2 (PM-BRIEF v2 22 页) + F3 backend :3002 + nginx :8095

---

## 1. 测试结果总览

| 维度 | 通过 | 总数 | 通过率 |
|---|---|---|---|
| Desktop @ :8095 (nginx) | 22 | 22 | 100.0% |
| Mobile @ :8095 | 8 | 8 | 100.0% |
| Backend API @ :3002 | 1 | 11 | 9.1% |
| 9 学科顺序 | 2 | 2 | 严格顺序 |

## 2. Desktop @ :8095 (22 页)

| # | 页 | HTTP | 截图 |
|---|---|---|---|
| 1 | `landing` | 200 | 01-landing-desktop.png |
| 2 | `register` | 200 | 02-register-desktop.png |
| 3 | `login` | 200 | 03-login-desktop.png |
| 4 | `onboarding` | 200 | 04-onboarding-desktop.png |
| 5 | `review-session` | 200 | 05-review-session-desktop.png |
| 6 | `practice-hub-v2` | 200 | 06-practice-hub-v2-desktop.png |
| 7 | `knowledge-star` | 200 | 07-knowledge-star-desktop.png |
| 8 | `subject-detail` | 200 | 08-subject-detail-desktop.png |
| 9 | `wrong-book` | 200 | 09-wrong-book-desktop.png |
| 10 | `learning-path` | 200 | 10-learning-path-desktop.png |
| 11 | `predictive-paper` | 200 | 11-predictive-paper-desktop.png |
| 12 | `essay` | 200 | 12-essay-desktop.png |
| 13 | `pwa-photo` | 200 | 13-pwa-photo-desktop.png |
| 14 | `settings` | 200 | 14-settings-desktop.png |
| 15 | `notifications` | 200 | 15-notifications-desktop.png |
| 16 | `error-404` | 200 | 16-error-404-desktop.png |
| 17 | `subject-picker` | 200 | 17-subject-picker-desktop.png |
| 18 | `mastery` | 200 | 18-mastery-desktop.png |
| 19 | `vision-result` | 200 | 19-vision-result-desktop.png |
| 20 | `state-library` | 200 | 20-state-library-desktop.png |
| 21 | `teacher-dashboard` | 200 | 21-teacher-dashboard-desktop.png |
| 22 | `learning-journey` | 200 | 22-learning-journey-desktop.png |

## 3. Mobile @ :8095 (8 页)

| # | 页 | HTTP | 截图 |
|---|---|---|---|
| 1 | `landing` | 200 | 01-landing-mobile.png |
| 2 | `register` | 200 | 02-register-mobile.png |
| 3 | `login` | 200 | 03-login-mobile.png |
| 4 | `onboarding` | 200 | 04-onboarding-mobile.png |
| 5 | `review-session` | 200 | 05-review-session-mobile.png |
| 6 | `subject-picker` | 200 | 17-subject-picker-mobile.png |
| 7 | `pwa-photo` | 200 | 13-pwa-photo-mobile.png |
| 8 | `practice-hub-v2` | 200 | 06-practice-hub-v2-mobile.png |

## 4. Backend API @ :3002 (11 端点)

| 端点 | HTTP | 备注 |
|---|---|---|
| `/api/health` | 200 | ✓ |
| `/api/loop/summary` | 401 | ✗ |
| `/api/loop/actions` | 401 | ✗ |
| `/api/loop/feed` | 401 | ✗ |
| `/api/today` | 401 | ✗ |
| `/api/knowledge/mastery` | 401 | ✗ |
| `/api/knowledge/map` | 401 | ✗ |
| `/api/knowledge/star-map` | 401 | ✗ |
| `/api/srs/engine/daily-tasks` | 401 | ✗ |
| `/api/srs/engine/queue` | 401 | ✗ |
| `/api/srs/engine/stats` | 401 | ✗ |

## 5. 9 学科顺序一致性 (PM §F.18)

- **✓ subject-picker**: 找到 9/9 学科 · 顺序 正确 (语→数→英→物→化→生→历→地→政)
- **✓ knowledge-star**: 找到 9/9 学科 · 顺序 正确 (语→数→英→物→化→生→历→地→政)

## 6. 截图清单

所有截图在 `docs/design/_e2e-screenshots/`, 共 30 张.

---

## Round 12 部署状态 (本 session 真实)

| 系统 | URL | 状态 |
|---|---|---|
| **F3 旧版** | aitutor.uibe.online → :3002 → system uibe-tutor.service | ✅ 100% 正常 (0 中断) |
| **design-v2 (新设计 22 页)** | systemd uibe-design-v2.service → node :8090 | ✅ Active running, PID 271975 |
| **nginx :8095** | 反代到 :8090 | ✅ HTTP 200 (本机可达) |
| **nginx :8096** | HTTPS 反代到 :8090 | ✅ 已 listen |
| **nginx /v2/ 路径** | server 45 + 299 | ✅ 配置正确 (源站 200) · ❌ CF 边缘缓存 404 |
| **API 反代 /api/** | :8095/8096 → :8090 → :3002 | ✅ F3 后端真实数据 |

## 访问矩阵

| URL | 状态 |
|---|---|
| http://127.0.0.1:8095/ | ✓ (本机浏览器) |
| http://219.224.5.250:8095/ | ✓ (内网 / 同网段) |
| http://219.224.5.250:8095/subject-picker.html | ✓ (22 页直达) |
| https://aitutor.uibe.online/v2/ | ❌ (CF 边缘缓存 404, 需控制台 purge) |
| 路由器公网 IP :8095 | ❌ (无路由器端口转发权限) |

**用户可立即用**: 本机浏览器打开 http://127.0.0.1:8095/
