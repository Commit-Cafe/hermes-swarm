# 🐝 Hermes Swarm

**多 Hermes-Agent 并行任务编排与可视化监控平台**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 项目简介

Hermes Swarm 允许你同时启动和管理多个 [Hermes Agent](https://github.com/nicobailey/hermes) 实例，提供：

- **并行任务分发** — 同时运行多个 Hermes Agent，信号量控制最大并发数
- **实时状态监控** — Web 仪表盘实时查看每个 Agent 的运行状态、进度
- **结果自动收集** — 执行输出、日志、错误信息自动持久化到 SQLite
- **成本追踪** — 统计任务耗时，预留 token/cost 追踪能力

## 技术架构

| 层级 | 技术选型 |
|------|----------|
| 后端 | FastAPI + aiosqlite + SSE |
| 前端 | Next.js 15 + React 19 + shadcn/ui + Recharts |
| 存储 | SQLite（文件级持久化） |
| 进程管理 | Python asyncio.subprocess → WSL2 → hermes CLI |
| 实时通信 | SSE (Server-Sent Events) |

## 快速开始

### 环境要求

- Python 3.11+
- Node.js 18+
- WSL2（Ubuntu 24.04）+ Hermes Agent 已安装

### 1. 启动后端

```bash
cd backend
pip install -r requirements.txt
python main.py
```

后端运行在 `http://localhost:8001`，Swagger 文档在 `http://localhost:8001/docs`。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:3000`。

### 3. 环境变量

后端（参考 `backend/.env.example`）：

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `API_HOST` | `0.0.0.0` | 后端监听地址 |
| `API_PORT` | `8001` | 后端端口 |
| `MAX_CONCURRENT_AGENTS` | `4` | 最大并行 Hermes 实例数 |
| `DEFAULT_TIMEOUT` | `3600` | 任务默认超时（秒） |
| `WSL_HERMES_DIR` | `/root/hermes-agent` | WSL 中 hermes-agent 路径 |

前端（`frontend/.env.local`）：

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8001/api/v1` | 后端 API 地址 |

## API 接口

| 方法 | 路径 | 功能 |
|:----:|------|------|
| `POST` | `/api/v1/tasks` | 创建并启动任务 |
| `GET` | `/api/v1/tasks` | 列出所有任务 |
| `GET` | `/api/v1/tasks/{id}` | 查看任务详情 |
| `POST` | `/api/v1/tasks/{id}/cancel` | 取消任务 |
| `GET` | `/api/v1/tasks/{id}/logs` | 查看任务日志 |
| `GET` | `/api/v1/tasks/stream` | SSE 实时事件流 |
| `GET` | `/api/v1/dashboard/kpis` | KPI 统计数据 |
| `GET` | `/api/v1/dashboard/series` | 时间序列趋势 |
| `GET` | `/api/v1/agents/status` | Agent 运行状态 |

## 页面预览

| 页面 | 路径 | 功能 |
|------|------|------|
| Dashboard | `/dashboard` | KPI 卡片 + 趋势图表 + 任务列表 |
| Tasks | `/tasks` | 创建新任务（填写 prompt、选择模型和 skill） |
| Agents | `/agents` | 实时监控 Agent 运行状态（3s 自动刷新） |
| Logs | `/logs` | 按任务查看 stdout/stderr 日志 |

## 项目结构

```
hermes-swarm/
├── backend/                     # FastAPI 后端
│   ├── config.py                # 全局配置
│   ├── models.py                # Pydantic 数据模型
│   ├── database.py              # SQLite 初始化
│   ├── hermes_manager.py        # 核心进程管理器
│   ├── routes.py                # REST API + SSE 路由
│   ├── main.py                  # FastAPI 入口
│   └── requirements.txt
├── frontend/                    # Next.js 15 前端
│   ├── app/
│   │   ├── dashboard/           # 主仪表盘
│   │   ├── tasks/               # 任务创建
│   │   ├── agents/              # Agent 监控
│   │   └── logs/                # 日志查看
│   ├── components/              # UI 组件（shadcn/ui）
│   ├── lib/                     # API 封装 + Hooks
│   └── package.json
├── data/                        # SQLite 数据库（自动创建）
├── 项目说明书.md                 # 详细项目文档
└── .gitignore
```

## 开发计划

### 已完成 ✅

- [x] FastAPI 后端（9 个 API 端点 + SSE）
- [x] Hermes 进程管理器（asyncio.subprocess + 并发控制）
- [x] SQLite 持久化（tasks + task_logs）
- [x] 任务状态机（pending → running → completed/failed/cancelled）
- [x] Dashboard 仪表盘（KPI + 趋势图 + 任务列表）
- [x] 任务创建页面
- [x] Agent 实时状态监控
- [x] 日志查看页面
- [x] Shell 注入防护（base64 编码）

### 待开发 🔲

- [ ] 前端 SSE EventSource 实时对接
- [ ] Hermes 输出解析（token/cost 提取）
- [ ] 端到端集成测试
- [ ] 批量任务创建
- [ ] 任务模板（保存常用 prompt）
- [ ] 实时日志流（浏览器端滚动显示）
- [ ] 成本追踪图表
- [ ] 多模型/多 Profile 支持
- [ ] Docker Compose 一键部署

## 开源复用

前端基于 [OAIHUB](https://github.com/sergiomasellis/OAIHUB)（MIT License）的组件进行适配改造。

## License

MIT
