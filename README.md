# archComply —— 合同/标书合规评审系统（比武赛用）

> 给定文档 + 规则清单 → Agent 协同逐条核查 → 输出**可溯源、全覆盖**的评审报告。
> 核心主张：**不漏查（覆盖矩阵）、可复核（点击溯源）、省成本（确定性规则优先）。**

四人队 120 分钟赛制项目。角色：队长（需求/架构/集成/演示）、后端A（Agent 框架与链路）、后端B（解析与规则引擎）、前端F（Vue3 展示）。

---

## 目录结构

```
archComply/
├── docs/                      # 契约与文档（队长 Owner，别人只读）
│   ├── rules清单.md           # 规则清单：B2 按列解析，唯一规则来源
│   ├── result.schema.json     # 结果 Schema：B2 产出 / B1 透传 / F 渲染
│   ├── sse-events.md          # SSE 事件协议：B1 按此发 / F 按此解
│   ├── 任务看板.md            # 现场进度与硬节点
│   ├── submission-checklist.md# 封版验收清单
│   ├── demo-script.md         # 3 分钟演示逐秒脚本
│   └── qa-bank.md             # 2 分钟答辩题库
├── mock/                      # Mock SSE：前端/后端并行开发的公共地基
│   ├── sse-server.mjs         # 本地假后端（协议 100% 真实）
│   ├── mock-sse.mjs           # 纯内存 Mock（前端直接 import）
│   ├── fixtures/review-sample.json  # 回放数据（含 fail/review/pass/未覆盖）
│   ├── validate.mjs           # 契约校验脚本
│   └── README.md
├── .qwen/
│   ├── qwen-demo/             # @qwen-code/sdk 最小调用样例（B1 从这里抄）
│   └── skill-creator/         # 官方 skill 脚手架
├── pom.xml / src/             # Java 21 骨架（见「技术栈」）
└── .env.example               # 环境变量模板
```

## 快速开始

```bash
# 1) 环境
cp .env.example .env          # 填 API key / 模型名

# 2) 前端并行开发（不等后端）
node mock/sse-server.mjs      # → http://localhost:8787
curl -N -X POST http://localhost:8787/api/review \
  -H 'Content-Type: application/json' -d '{"docIds":["doc-001"]}'

# 3) 契约自检（改 Mock 或 Schema 后必跑）
node mock/validate.mjs        # 期望输出 ✅ 契约校验通过

# 4) qwen sdk 最小调用（B1 第一步）
cd .qwen/qwen-demo && npm install && node demo.js
```

真实服务起来后，前端只改一个变量：

```bash
VITE_API_BASE=http://localhost:8080
```

## 环境变量

见 [`.env.example`](.env.example)。**任何 key 都不许写进代码**，`.env` 已在 `.gitignore` 里。

## 技术栈

| 层 | 选型 | 负责人 |
|---|---|---|
| Agent 框架 | Node + `@qwen-code/sdk` | B1 |
| 文档解析 | docx/pdf → block 级结构（保留页码/偏移） | B2 |
| 后端服务 | HTTP + SSE（`POST /api/review`） | B1 |
| 前端 | Vue3 + Vite，SSE 用 `fetch` + `ReadableStream` | F |
| Java 骨架 | `pom.xml` / `src/main/java`（保留，非主链路） | 队长协商 |

> Java 骨架与方案要求的 Node 链路并存，**13:50 前在 `docs/任务看板.md` 的「技术栈待决」处拍板**写成 A 或 B。

## 交付标准（一句话版）

- **B1**：跑得通、稳、省 —— 服务能启、SSE 合协议、有超时/重试/防死循环、Token 与耗时能统计。
- **B2**：查得准、有证据、全覆盖 —— 能定位到 block，确定性规则代码比对，覆盖矩阵有未覆盖告警。
- **F**：看得见、点得准、能中断 —— 流式、卡片、图表、溯源高亮、错误/中断/重试。
- **队长**：契约、集成、卡点、演示与答辩。

## 现场硬节点

| 时间 | 必须达成 |
|---|---|
| 13:50 | 四人环境全通（SDK / 解析 / Mock SSE / 契约模板） |
| **14:10** | 三份契约发群 ← 队友的"开工信号" |
| **14:40** | 至少 1 条规则端到端跑通 |
| **15:20** | 有可演示版本 |
| 16:05 | 封版，只修 bug |
| 16:20 | 提交 |

## 协作纪律

- 15 分钟同步只答三件事：**完成了什么 / 卡在哪 / 需要谁配合**。
- 目录隔离：只改自己的目录；队长的 `docs/` 是单写者。
- 契约变更走流程：先改 `docs/`，再通知两方，不许口头加字段。
- 16:05 后不重构、不换框架、不加页面。
