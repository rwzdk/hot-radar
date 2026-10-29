# 热点雷达 · 卡通贴纸风 UI 实施方案

> 终稿 = 方案 B 的造型语言（粗描边、不规则气泡圆角、手绘星星、微旋转）× 方案 A 的配色（奶油底 + 暖橙/青绿/明黄）。
> 视觉基准稿：`design-final.html`（可直接在浏览器打开对照）。
> 项目技术栈：Vite + React + TypeScript + Tailwind CSS v4（`@theme` 令牌）。

---

## 1. 设计令牌（改写 `src/styles.css` 的 `@theme`）

### 1.1 色彩

| 令牌 | 值 | 用途 |
|---|---|---|
| `--color-paper` | `#FFF6E9` | 页面底色（奶油纸） |
| `--color-surface` | `#FFFDF7` | 卡片 / 输入框 / 按钮底 |
| `--color-ink` | `#3B2F2A` | 全部描边 + 主标题文字（深咖，非纯黑） |
| `--color-ink-soft` | `#6E5F56` | 正文 / 次级文字 |
| `--color-muted` | `#A08F81` | 辅助说明、未选中态 |
| `--color-accent` | `#FF6B35` | 主色：主按钮、选中 chip、热度条、第一名 |
| `--color-accent-deep` | `#E8501A` | 主色加深：悬停文字 |
| `--color-accent-soft` | `#FFE3D3` | 主色浅底：图标底盒、「沸」徽标 |
| `--color-teal` | `#2A9D8F` | 辅助色：次按钮、第二名、「新」徽标 |
| `--color-teal-soft` | `#DDF3EF` | 辅助浅底 |
| `--color-yellow` | `#FFC94D` | 点缀：导航选中、铃铛、提示标签、齿轮 |
| `--color-yellow-soft` | `#FFF3D6` | 提示条底色 |
| `--color-blue` | `#4D96FF` | 第三点缀：第三名、搜索图标底 |
| `--color-blue-soft` | `#E3EEFF` | 搜索图标浅底 |
| `--color-ok` | `#2A9D8F` | 语义-成功（复用 teal） |
| `--color-warn` | `#E8501A` | 语义-警告 |
| `--color-danger` | `#D8452A` | 语义-危险/删除 |

原 `panel` 深色系整套删除（侧边栏不再用深色墨板，改为 `--color-surface` 白底 + 右侧粗描边分隔）。

### 1.2 造型令牌

```css
--border-toon: 3px solid #3B2F2A;          /* 全部描边统一 3px */
--shadow-toon: 5px 5px 0 #3B2F2A;          /* 大卡片硬投影 */
--shadow-toon-sm: 3px 3px 0 #3B2F2A;       /* 按钮/chip/小元素硬投影 */
--radius-blob-1: 50% 46% 52% 48%;          /* 不规则气泡（图标盒、铃铛、第一名） */
--radius-blob-2: 46% 52% 48% 50%;
--radius-blob-3: 52% 48% 50% 46%;
--radius-card: 26px 22px 28px 24px;        /* 大卡片：略不对称圆角 */
--radius-btn: 14px;                        /* 按钮 / 时钟 */
--radius-nav: 16px 18px 16px 20px;         /* 导航项：微不对称 */
```

规则：**禁用一切模糊阴影**（`shadow-*` 模糊类全删），只用 `box-shadow: Npx Npx 0 <ink>` 硬投影。分割线一律 `dashed`，不用实线细边。

### 1.3 背景纹理

`body` 叠加波点纹理（伪元素，固定定位，不拦截事件）：

```css
body::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image: radial-gradient(rgba(255,107,53,.13) 1.5px, transparent 1.5px);
  background-size: 26px 26px;
}
```

### 1.4 排版

- 字体栈不变；标题 `font-weight: 800/900`，正文 700（`font-bold`），辅助 600。
- 数字（时钟、热度、计数）用 `font-mono` + `tabular-nums`。
- 页面标题 27px/900 + 右侧英文胶囊副标（teal 底白字、3px 描边、硬投影、`rotate(2deg)`）。

### 1.5 通用交互（所有可点元素）

| 状态 | 效果 |
|---|---|
| hover | `translate(-1px,-1px)`，阴影 3px→5px；图标盒/铃铛可额外 `rotate(±2~3deg)` |
| active | `translate(2px,2px)`，阴影归零（按进纸面） |
| transition | `all .12s ease` |
| disabled | `opacity: .45`，不旋转不位移 |

---

## 2. 手绘 SVG 图标系统（重写 `src/components/icons.tsx`）

废弃现有线性图标与一切 emoji，改为 **手绘多彩 SVG**：`viewBox="0 0 24 24"`，描边 `--color-ink`（宽 1.5–2.4），色块填充，路径带轻微抖动（手绘感）。每个图标导出为接收 `className` 的 React 组件。以下 path 已定稿，直接抄用（`INK` = `var(--color-ink)` 或 `#3B2F2A`）：

**RadarIcon（Logo，白描边用于橙色底盒）**
```xml
<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round">
  <circle cx="12" cy="12" r="1.8" fill="#fff" stroke="none"/>
  <path d="M12 12l4.6-4.6"/>
  <path d="M12 5.3a6.7 6.7 0 0 1 6.8 6.6"/><path d="M12 8.6a3.4 3.4 0 0 1 3.5 3.3"/>
  <path d="M12 18.7a6.7 6.7 0 0 1-6.8-6.6"/><path d="M12 15.4a3.4 3.4 0 0 1-3.5-3.3"/>
</svg>
```

**FlameIcon（热榜/热度）**
```xml
<svg viewBox="0 0 24 24">
  <path d="M12.2 2.8c.5 2.2 2.9 3.5 3.9 5.6 1.1 2.3.9 5.3-.7 7.2-1.7 2-4.6 2.6-7 1.6-2.3-1-3.9-3.4-3.7-5.9.1-1.9 1.1-3.5 2.4-4.7.3 1 .9 1.9 1.9 2.2-.2-2.1.5-4.3 1.7-6z" fill="#FF6B35" stroke="INK" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M12 12.3c1.1 1.1 1.8 2.3 1.6 3.7-.2 1.3-1.3 2.2-2.6 2.1-1.2-.1-2.1-1.2-2-2.4.1-1.2 1.8-2.2 3-3.4z" fill="#FFC94D" stroke="INK" stroke-width="1.3" stroke-linejoin="round"/>
</svg>
```

**TargetIcon（关键词监控）**：外圆 `fill="#DDF3EF"` + 中圆 `fill="#2A9D8F"` + 心点 `fill="#FFC94D"`，path 见 `design-final.html` 对应 nav-item。

**SearchIcon（全网搜索）**：镜片 `fill="#E3EEFF"` + 加粗手柄 + 镜片高光弧线，同上来源。

**GearIcon（设置）**：八角星齿轮 `fill="#FFC94D"` + 白心圆，同上来源。

**BellIcon（通知）**：铃身 `fill` 随场景（顶栏用 `#fff`，强调处用 `#FFC94D`）+ 摆锤弧线，同上来源。

**RefreshIcon（刷新，描边跟随文字色）**
```xml
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M19.5 8.5A8 8 0 0 0 5.9 5.5"/><path d="M4 2.8v3.6h3.6"/>
  <path d="M4.5 15.5A8 8 0 0 0 18.1 18.5"/><path d="M20 21.2v-3.6h-3.6"/>
</svg>
```

**SparkIcon（星星装饰 / AI 研判）**
```xml
<svg viewBox="0 0 24 24"><path d="M12 2.5l2 5.8 5.8 1.7-5.8 2-2 5.8-2-5.8-5.8-2 5.8-1.7z" fill="#FFC94D" stroke="INK" stroke-width="1.6" stroke-linejoin="round"/></svg>
```

其余功能图标（Plus / Trash / Play / Pause / External / Check / X / Download / Upload / Key / Database / Shield / Github）按同一风格补齐：ink 粗描边（1.8–2.2）、圆头线帽、必要时一小块彩色填充（如 Trash 桶盖 yellow、Check 用 teal）。**行内 emoji（如结果卡片里的 🔥）一律删除或换成 FlameIcon。**

---

## 3. 全局组件改造（`src/components/ui.tsx` / `shell.tsx` / `result-card.tsx`）

### 3.1 Shell 布局（shell.tsx）

- **侧边栏**：`bg-surface` + `border-right: 3px solid ink`；删除 panel 深色。
  - Logo：44px 橙色底盒（`--radius-blob-1`、硬投影、`rotate(-6deg)`）内嵌 RadarIcon；右侧「热点雷达」17px/900 + `HOTRADAR` 10px 字距 3px。
  - 导航项：`--radius-nav`；默认透明边框；hover 加 3px 描边 + `bg-paper` + 微旋转浮起；**选中项 `bg-yellow` + 3px 描边 + 硬投影 + `rotate(-1.5deg)`**，删掉原来的左侧红色指示条。
  - 底部：3px dashed 分隔线 + GitHub 链接。
- **顶栏**：去掉毛玻璃实线边；标题 27px/900 + 英文胶囊副标（见 1.4）；右侧时钟（surface 底 + 描边 + 硬投影）+ 铃铛按钮（42px blob 形、yellow 底、未读角标 orange 底白字 2.5px 描边）。
- 通知弹层：卡片化——3px 描边、`--radius-card`、硬投影；未读条目的左侧圆点改 accent 色块小方块（`--radius-blob-3`）。

### 3.2 Button（ui.tsx）

统一基类：`border: 3px solid ink; border-radius: 14px; box-shadow: 3px 3px 0 ink; font-weight: 900;` + 通用交互（1.5）。

| variant | 样式 |
|---|---|
| primary | `bg-accent` 白字 |
| secondary（新增，替换部分 outline 强调位） | `bg-teal` 白字 |
| outline（默认） | `bg-surface` ink 字 |
| danger | `bg-surface` 底、danger 字，描边仍 ink |
| ghost | 仅 hover 时补描边+投影（用于次要位） |

### 3.3 Card（ui.tsx）

`bg-surface` + 3px ink 描边 + `--radius-card` + `--shadow-toon`。`hover` 属性不再改模糊阴影，改为 `translate(-2px,-2px)` + 阴影加大到 `7px 7px 0`。

### 3.4 Badge / SourceBadge / ImportanceTag（ui.tsx）

胶囊形（`rounded-full`）、2.5px ink 描边、900 字重；tone 映射改为：

| tone | 底 / 字 |
|---|---|
| accent | accent-soft / accent-deep |
| ok | teal-soft / teal |
| warn | yellow-soft / accent-deep |
| danger | accent-soft / danger |
| neutral | surface / ink-soft |
| ink（原深色底） | yellow / ink |

SourceBadge 平台映射：微博→accent、知乎→blue 系（新增 `blue` tone：blue-soft/blue）、抖音→ink、头条→warn、B站→ok、HackerNews→neutral。

### 3.5 HeatBar / RelevanceMeter（ui.tsx）

外框：高 13px 胶囊 + 2.5px ink 描边 + `bg-surface`；内条 `bg-accent` 纯色（**去掉渐变**）。RelevanceMeter 分级色：≥70 accent、40–69 yellow、<40 muted。

### 3.6 Input / Select / Toggle

- Input/Select：`bg-surface` + 3px ink 描边 + radius 14px；focus 时 `box-shadow: 3px 3px 0 ink`（替代原 ring），边框不变。
- Toggle：轨道 3px 描边；关=`bg-surface`、开=`bg-teal`；滑块白底 + 2.5px 描边。

### 3.7 ResultCard（result-card.tsx）

- 行分隔改 `2.5px dashed rgba(ink,.12)`；hover 行 `bg-paper`。
- 「AI 研判」按钮套用 outline 按钮规范（小尺寸）。
- AI 结论区：`bg-paper` 改为 `bg-yellow-soft` + 2.5px ink 描边 + radius 14px。
- 热度 emoji 🔥 换 FlameIcon（14px）。

### 3.8 EmptyState / 骨架屏 / 提示条

- EmptyState：图标放入 56px blob 底盒（yellow-soft 底 + 3px 描边 + 硬投影 + 微旋转）。
- 骨架屏（`skeleton`）：底色改 `#FFEED6 → #FFF6E9` 扫光。
- 快照提示条（boards 页）：`bg-yellow-soft` + 3px 描边 + radius 16px + 硬投影，前置黄色小标签「提示」（9px 圆角 + rotate(-2deg)）。

---

## 4. 页面级改造要点

### 4.1 热榜总览（pages/boards.tsx）
- 平台切换 chip：胶囊 + 3px 描边 + 硬投影；选中 `bg-accent` 白字 + `rotate(-1deg)`；hover 时 `bg-yellow`。
- 刷新按钮：secondary（teal）。
- 榜单卡头部：火焰图标放入 36px blob 底盒（accent-soft 底 + rotate(-6deg)）；英文小标 muted。
- 排名 1/2/3：31px blob 块（分别 accent / teal / blue 底白字，r1/r2/r3 用三种 blob 圆角 + ∓4~5° 旋转）；4 名以后 muted 纯数字。
- 「沸/新」等徽标按 3.4 规范。

### 4.2 关键词监控（pages/monitor.tsx）
- 关键词列表选中项：`bg-yellow` + 3px 描边 + 硬投影（替代原 accent-soft 淡底）。
- 状态圆点改为 10px 小方块 blob：监控中 teal、暂停 muted、选中 accent。
- 「立即扫描」primary；「AI 研判」outline + SparkIcon。
- AI 进度条：外框 2.5px 描边胶囊 + teal 内条。
- 过滤 select 按 3.6 规范。

### 4.3 全网搜索（pages/search.tsx）
- 搜索框 + 主按钮按 3.6 / 3.2；来源筛选 chip 同 4.1 规范（选中 teal 而非 accent，与榜单页区分）。
- 结果统计徽标按 3.4 accent tone。

### 4.4 设置（pages/settings.tsx）
- 各 Card 头部图标放入 36px blob 底盒（yellow-soft / teal-soft / accent-soft 轮换）。
- 「测试」primary、「显示/隐藏」「导出/导入」outline、「清空数据」danger。
- 数据源体检格子：3px 描边 + radius 14px；成功左侧 Check 图标 teal、失败 X 图标 danger。

---

## 5. 装饰元素

主区域（`.main`）固定 3 颗 SparkIcon 星星（fixed，pointer-events:none）：
- 26px yellow @ top:70px left:250px
- 18px teal @ top:150px right:60px
- 16px orange @ bottom:120px left:300px

可加 8–10s 的轻微上下浮动动画（`transform: translateY(±4px)`，尊重 `prefers-reduced-motion`）。

---

## 6. 验收清单

1. 全站无模糊阴影、无实线 1px 灰边、无渐变填充、无 emoji 图标。
2. 所有描边统一 `--color-ink` 3px（徽标 2.5px 除外）。
3. 仅 4 个彩色：橙（主）/ 青绿（辅）/ 黄（点缀）/ 蓝（第三点缀），语义色与之对齐。
4. 交互三态（hover 浮起 / active 按下 / disabled 半透明）在所有按钮、chip、导航项上一致。
5. 四个页面 + 通知弹层 + 空状态 + 骨架屏均套用上述规范，视觉与 `design-final.html` 一致。
6. 构建通过（`npm run build`），无遗留 `panel` 色板引用。
