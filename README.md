<div align="center">

<img src="public/logo.svg" width="72" alt="HotRadar logo"/>

# 热点雷达 HotRadar

**多平台热榜聚合 + 关键词监控 + AI 简报**

零后端 · 零数据库 · 打开即用 · 可部署到任意静态托管

[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![在线体验](https://img.shields.io/badge/在线体验-qoder.website-D8452A)](https://hot-radar-j8vzdjdlheu.qoder.website)

**在线体验:https://hot-radar-j8vzdjdlheu.qoder.website**

</div>

## 这是什么?

一个跑在浏览器里的热点监控台:

- **热榜总览** —— 「聚合」一屏看九大平台(微博 / 知乎 / 抖音 / 头条 / 百度 / B站 / 贴吧 / 小红书 / Hacker News)各前 10 条,也可单榜细看,按榜内相对热度可视化;对比每日快照标出「新上榜」和排名升降;成功拉取过的榜单本地缓存,二次访问秒开;
- **关键词监控** —— 添加关注词,一键从全部热榜 + HackerNews 聚合扫描;支持关键词排除词、全局排除词、页面打开期间的定时自动扫描(多关键词共享一次热榜拉取),命中内容去重留存并通知;
- **AI 研判** —— 接入 OpenRouter 任意模型,对单条内容做相关度评分、真实性判断、重要度分级与一句话摘要;
- **AI 简报** —— 把一次扫描的关键进展压缩成一份结构化简报:一句话结论、整体脉络、关键进展和接下来值得关注的信号;
- **全网搜索** —— 不入库的即时聚合检索,支持平台多选、最近搜索、结果过滤与批量 AI 研判;
- **PWA** —— 可安装到桌面/主屏,弱网环境可打开应用壳并查看已缓存的榜单;
- **移动端可用** —— 桌面侧栏 + 手机底部导航,四页在 375px 宽度下完整可用;
- **零后端** —— 没有服务器、没有数据库。监控记录跟着浏览器走,换设备时用备份导入导出即可。

## 界面

| 热榜总览 | 关键词监控 |
| --- | --- |
| ![热榜总览](docs/screenshots/boards.png) | ![关键词监控](docs/screenshots/monitor.png) |

| 全网搜索 | 移动端 |
| --- | --- |
| ![全网搜索](docs/screenshots/search.png) | ![移动端](docs/screenshots/mobile.png) |

<sub>界面截图使用演示数据。</sub>

## 快速开始

```bash
git clone https://github.com/rwzdk/hot-radar.git
cd hot-radar
npm install
npm run dev        # http://localhost:5173
```

构建生产包:

```bash
npm run build      # 产物在 dist/
npm run preview    # 本地预览构建产物
```

## 启用 AI 研判(可选)

AI 能力通过 [OpenRouter](https://openrouter.ai) 提供:

1. 到 [openrouter.ai/keys](https://openrouter.ai/settings/keys) 创建一个 API Key(建议设置消费上限);
2. 打开本站「设置」页,填入 Key,点「测试」验证;
3. 回到「监控」页,对单条结果「研判」、批量「AI 研判」,或点「AI 简报」生成汇总。

默认模型 `deepseek/deepseek-v3.2`,可在设置页更换为 OpenRouter 上的任意对话模型。简报是单次调用、限 15 条输入,失败不会影响已有的单条研判。

## 部署

`npm run build` 产出的 `dist/` 是完全自包含的静态站点,本项目自己的线上站点就跑在 Qoder Sites 上:[hot-radar-j8vzdjdlheu.qoder.website](https://hot-radar-j8vzdjdlheu.qoder.website)。

- **Qoder Sites** —— 直接发布 `dist/` 目录;
- **Vercel / Netlify / Cloudflare Pages** —— 按框架预设 Vite 自动识别,零配置;
- **GitHub Pages** —— `vite build` 后将 `dist/` 推到 `gh-pages` 分支即可。

项目使用 hash 路由(`#/monitor`),不需要服务端 SPA 回退规则,静态文件服务器直接可用。

## 数据从哪来?

| 数据源 | 用途 | 说明 |
| --- | --- | --- |
| [60s API](https://github.com/vikiboss/60s) | 微博/知乎/抖音/头条/百度/贴吧/小红书/B站热榜 | 公开聚合接口,受网络环境/限流影响时会回退快照 |
| [HN Search API (Algolia)](https://hn.algolia.com/api) | HackerNews 榜单与全文搜索 | 官方免费接口,允许跨域 |
| OpenRouter | AI 研判 / 简报 | 用户自带 Key,浏览器直连 |

### 快照、趋势与限流

仓库内置 GitHub Actions(见 [`.github/workflows/snapshot.yml`](.github/workflows/snapshot.yml)),每天定时抓取各榜单生成 `public/data/snapshot.json`;推送到 `main` 时也会刷新一次。运行时实时接口拉取失败(接口变更、限流、断网)会自动回退到这份快照。

- **趋势对比**:榜单页把实时榜单与最近一次单榜快照对比,标出「新上榜」与 `↑/↓` 排名变化;快照超过 7 天时自动隐藏趋势,避免误导;
- **单源保留**:某一路源抓取失败时,快照会保留该源上一次成功的数据,不会让整榜消失;
- **限流保护**:多源扫描最多 2 并发并留出间隔;网络错误/5xx 重试一次,429 直接交给快照兜底;
- **手动刷新**:`npm run snapshot` 可在本地重新生成快照。

## 技术栈与结构

```
React 19 + TypeScript + Vite 7 + Tailwind CSS v4
运行时依赖只有 react / react-dom,路由、图标、存储、通知全部手写

src/
├─ app.tsx               # 路由入口(hash 路由,四页切换,页面级 ErrorBoundary)
├─ styles.css            # 设计令牌(@theme)+ 贴纸风描边/硬投影 + 动画
├─ components/
│  ├─ shell.tsx          # 侧栏 + 顶栏 + 通知中心 + 移动端底部导航
│  ├─ ui.tsx             # Button/Card/Badge/热力条/相关度仪表…
│  ├─ icons.tsx          # 手绘多彩 SVG 图标集
│  ├─ error-boundary.tsx # 单页渲染异常兜底
│  └─ result-card.tsx    # 监控/搜索结果卡片(含 AI 结论与复制链接)
├─ pages/
│  ├─ boards.tsx         # 聚合总览 + 单榜细看(快照趋势/新上榜/本地缓存秒开)
│  ├─ monitor.tsx        # 关键词监控(扫描/自动扫描/排除词/过滤/研判/简报/导出)
│  ├─ search.tsx         # 全网搜索(最近搜索/结果过滤/批量研判)
│  └─ settings.tsx       # 密钥/扫描偏好/通知/备份/数据源体检
└─ lib/
   ├─ boards.ts          # 九源热榜适配(按源字段映射)+ 快照校验 + localStorage 缓存
   ├─ hackernews.ts      # HN Algolia 客户端(带超时)
   ├─ aggregate.ts       # 单词/批量聚合扫描(热榜一次拉取共享)+ 历史合并去重
   ├─ ai.ts              # OpenRouter 单条研判/批量研判/AI 简报
   ├─ storage.ts         # localStorage 持久化 + 同页更新广播 + 备份导入导出
   ├─ notices.tsx        # 应用内通知中心 + 浏览器通知
   ├─ url.ts             # http(s) 链接白名单
   ├─ router.ts          # hash 路由
   └─ format.ts          # 时间/数值格式化

public/
├─ manifest.webmanifest  # PWA 清单(SVG 图标)
├─ sw.js                 # Service Worker(导航 network-first / 静态资源 SWR)
└─ data/snapshot.json    # 每日快照兜底数据
```

## 设计参考

v1.1 的产品与交互思路参考了以下长期维护的开源项目,仅借鉴数据模型与交互模式,未复制代码:

| 项目 | 借鉴点 |
| --- | --- |
| [sansan0/TrendRadar](https://github.com/sansan0/TrendRadar) | 关键词排除、热点趋势/新增检测、日报式汇总、HTML 报告的可搜索与复制 |
| [ourongxing/newsnow](https://github.com/ourongxing/newsnow) | 干净的阅读体验、按来源组织、相对时间、聚焦刷新 |
| [Thysrael/Horizon](https://github.com/Thysrael/Horizon) | 每日简报、按主题筛选、去重后交付 |
| [KKKKhazix/AIHOT](https://github.com/KKKKhazix/AIHOT) | 事件热度、「新/上升」标记、备份与阅读设置 |
| [imsyy/DailyHotApi](https://github.com/imsyy/DailyHotApi) | 多平台热榜 API 的数据形态 |

## 已知边界

- 微博/B站等平台官方接口不允许浏览器跨域,本项目通过开源聚合接口间接获取;部分网络环境下 60s API 也可能被 CORS 或限流拦截,此时榜单会使用最近快照或本地缓存;
- 监控是"打开页面时"的拉取式扫描;设置页可开启页面打开期间的自动扫描(每 5/10/30 分钟),但仍然不是 7×24 后台爬虫,需要无人值守监控可参考快照工作流自行扩展定时任务;
- 第三方免费接口存在限流或停服的可能,「设置 → 数据源体检」可随时检查各源健康状态;
- 趋势对比依赖每日快照,首次部署或快照缺失时不会显示「新上榜/升降」;
- AI 研判与简报需要你自己的 OpenRouter Key,费用由所选模型与调用量决定。

## 更新日志

版本变更记录见 [CHANGELOG.md](CHANGELOG.md),各版本详细说明见 [Releases](https://github.com/rwzdk/hot-radar/releases)。

## License

[MIT](LICENSE) © rwzdk
