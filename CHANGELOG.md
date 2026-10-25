# 更新日志

本项目的所有显著变更都记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-10-25

首个正式版本,并已部署上线 [Qoder Sites](https://hot-radar-j8vzdjdlheu.qoder.website)。

### 新增

- **热榜总览**:微博 / 知乎 / 抖音 / 今日头条 / B 站 / Hacker News 六榜切换,相对热度条、封面缩略图、骨架屏加载,实时拉取失败自动回退仓库快照;
- **关键词监控**:关键词管理(添加/暂停/删除),多源聚合扫描(热榜词元匹配 + HN 全文检索),历史去重合并留存,来源/重要度过滤与热度/相关度/时间排序,通知中心(应用内 + 浏览器系统通知);
- **AI 研判**:OpenRouter 浏览器直连,相关度评分(0-100)、真实性判断、重要度分级、一句话摘要;支持单条研判与批量小并发研判,扫描后可自动执行;
- **全网搜索**:即时聚合检索,平台多选,批量 AI 研判,不写入监控历史;
- **设置**:API Key 管理与连通性测试、模型配置、浏览器通知授权、数据导出/导入/清空、数据源健康体检;
- **每日快照**:`scripts/snapshot.mjs` + GitHub Actions 定时抓取六榜生成 `public/data/snapshot.json` 提交回仓库,作为实时接口的兜底数据。

### 工程

- Vite 7 + React 19 + TypeScript 5 + Tailwind CSS v4 工程骨架;
- 运行时依赖仅 `react` / `react-dom`,hash 路由、SVG 图标、localStorage 持久化、通知中心全部手写实现;
- MIT 开源协议,部署于 Qoder Sites(纯静态)。
