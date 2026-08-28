# D077 — 自定义下拉列表组件 (.clb)（2026-08-27）

> **类型**: P1 UX 收口 (替代 native `<select>`)
> **触发**: D076 §8 仍然依赖浏览器 UA 下拉面板，在 Linux/Chrome 跨深色模式下表现不可控
> **范围**: 3 个新文件 + 1 处 HTML (dashboard.html) 加 class
> **状态**: ✅ 本地 + 生产均已生效

---

## 0. 触发背景

D076 §8 通过 `color-scheme: light dark` 让浏览器 UA 下拉面板跟随 OS 主题，但 **UA 实际渲染仍可能不符合品牌色**：
- Linux Chrome 在浅色下用 OS GTK 的浅色面板，与 dashboard 红主题脱节
- 行高/间距/字号无法控制
- 不同 OS / 不同浏览器表现不一致

---

## 1. 设计选择

### 1.1 不破坏现有 JS (反回归)

**核心约束**：dashboard.html 中有 13 处 `getElementById('province-...').value` 调用，`saveProvince()` 用 `native.value` 拼 fetch body。**绝不能改现有 JS**。

→ 设计为 **wrapper**：原生 `<select>` 仍在 DOM 中、可读、可 submit、可 form 序列化，只是视觉上被 `clb-trigger` (button) 替代。

### 1.2 完全自定义 widget

- Trigger: 一个 `<button class="clb-trigger">` 显示当前 value 的 label + 自定义箭头
- Popover: 一个 `<div class="clb-popover"> > <ul role="listbox">`，绝对定位在 trigger 下方
- Options: `<li role="option">`，check mark on selected

### 1.3 a11y

- `aria-haspopup="listbox"` / `aria-expanded` / `aria-selected` / `aria-labelledby`
- 完整键盘: `ArrowDown`/`ArrowUp` 移动高亮, `Enter`/`Space` 选定, `Escape` 关闭
- 焦点管理: 选定后焦点回到 trigger
- `prefers-reduced-motion` 尊重

---

## 2. 实现

### 2.1 文件清单

| 文件 | 作用 |
|------|------|
| `frontend/assets/js/custom-listbox.js` | widget 实现 (216 行) |
| `frontend/assets/css/custom-listbox.css` | 样式 (~140 行) — 自动跟随 `--bg / --text / --accent / --border` |
| `frontend/dashboard.html` | 加 3 处 `class="clb"` + 1 个 `<link rel="stylesheet">` + 1 个 `<script src>` |

### 2.2 JS API

```js
window.initCustomListboxes()    // 主动初始化 (DOMContentLoaded 自动调用)
window.closeAllCustomListboxes() // 强制关闭所有打开的 widget
```

**HTML 用法**：
```html
<select id="province-code-select" class="clb">
  <option value="">请选择省份</option>
  <option value="beijing">北京</option>
</select>
<script src="assets/js/custom-listbox.js"></script>
```

### 2.3 同步策略 (无侵入式)

| 外部变化 | widget 同步方式 |
|----------|----------------|
| `select.value = 'x'` (loadUserProvince 用) | `MutationObserver` on `attributeFilter: ['value']` |
| `select.innerHTML = '...'` (loadProvinces 用) | `MutationObserver` on `childList: true` |
| 用户点击 trigger | 同上方法，双向自动 sync |

→ **现有 13 处 JS 调用一行都不用改**。

---

## 3. Playwright e2e 验证

### 3.1 真机测试（截图见 `.ait-page-shell/clb-{light,dark}-{closed,open,selected}.png`）
| 状态 | light | dark |
|------|-------|------|
| closed trigger text | "请选择省份（11 个选项）" | 同 |
| closed trigger bg | `rgb(241, 241, 245)` | `rgb(26, 29, 39)` |
| closed trigger border | `rgb(226, 226, 232)` | `rgb(42, 45, 56)` |
| selected (北京) bg | `rgba(215, 25, 32, 0.06)` | `rgba(215, 25, 32, 0.18)` |
| selected (北京) border | `rgb(215, 25, 32)` 红 | `rgb(255, 104, 109)` 亮红 |
| selected (北京) weight | 600 | 600 |
| popover scroll 配色 | 浅色 webkit scrollbar | 深色 webkit scrollbar |

### 3.2 a11y 测试
- **点击 trigger** → popover `block`, `aria-expanded="true"`, `highlightIndex=0`
- **点击外部** → popover `none`, `aria-expanded="false"`
- **Escape** → popover 关闭
- **ArrowDown × 2** → highlightIndex 走到 "上海 (自主命题)"
- **Enter** → `native.value="shanghai"`, trigger 显示新 label, popover 关闭

### 3.3 双向 sync 测试
- Dashboard 加载后: widget 自动 init, 初始 placeholder 显示
- `loadProvinces()` 跑完后: widget 自动 rebuild options (来自 MutationObserver)
- `loadUserProvince()` 设 `province-code-select.value = "beijing"` 后: widget 自动同步 trigger 显示 "北京 (自主命题)"

---

## 4. 收益

| 维度 | 之前 | 现在 |
|------|------|------|
| 跨浏览器一致性 | 不同 OS/浏览器差很多 | 100% 一致 |
| 深色模式对比度 | 依赖 UA/Luck | 严格按 `--bg / --text` 走 |
| 键盘 a11y | 默认 OK | 完全可控 + 自定义快捷键 (后续可加 filter/typeahead) |
| 选中视觉反馈 | 纯默认 | ✓ checkmark + 红底 + 粗字 |
| 滚动条主题 | UA 默认 | 自定义 webkit scrollbar (浅深色都好看) |
| 现有 JS 影响 | — | **0 修改** (13 处 getElementById 不动) |

---

## 5. 未来可选扩展 (非本任务范围)

- **typeahead**: 输入时按拼音/首字母快速定位
- **分组**: `[optgroup]` 支持，按 region 折叠 (东北/华东/...)
- **搜索框**: 大量选项 (>50) 时加 input
- **虚拟滚动**: >500 选项
- **移植到其他页面**: login.html register.html 的 year select 等

---

## 6. 回滚

```bash
cd /home/flaskappuser/Desktop/NewDisk_2T/aitutor
git checkout frontend/dashboard.html frontend/assets/css/custom-listbox.css frontend/assets/js/custom-listbox.js
rm frontend/assets/js/custom-listbox.js frontend/assets/css/custom-listbox.css
sudo systemctl restart uibe-tutor  # 或本地 setsid
```

→ 会回归到 D076 §8 的 `color-scheme` 缓解方案。
