# AIEffect - AI 交互 Agent

一款集 Ollama 代理服务、AI 语音合成（TTS）、字幕展示、对话记忆管理于一体的现代化 AI 交互工具。

## 🚀 快速开始

### 使用 Make 命令（推荐）

```bash
# 安装所有依赖
make install

# 启动开发服务器（分别在不同的终端）
make dev-api        # API Gateway (端口 8501)
make dev-websocket  # WebSocket 服务 (端口 8502)
make dev-log        # 日志服务 (端口 8505)
```

### 使用 Docker Compose

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 手动启动

```powershell
# 1. 安装共享包
cd shared/python
pip install -e .

# 2. 启动日志服务（端口 8505）
cd services/log
pip install -r requirements.txt
python start.py

# 3. 启动 WebSocket 服务（端口 8502）
cd services/websocket
pip install -r requirements.txt
python start.py

# 4. 启动 API Gateway（端口 8501）
cd services/api_gateway
pip install -r requirements.txt
python start.py
```

### 一键打包构建

```powershell
# 在项目根目录执行
.\script\build.ps1
```

### 运行打包后的应用

```bash
cd dist
start.bat
```

## 📋 前置要求

- **Python 3.12+**
- **Node.js 18+**
- **Poetry** (Python 依赖管理)
- **Docker & Docker Compose** (可选，用于容器化部署)
- **Windows 10/11**

## 📊 服务端口

| 服务        | 端口      | 说明             |
| ----------- | --------- | ---------------- |
| 前端开发    | 8500      | Vite 开发服务器  |
| API Gateway | 8501      | 统一 API 入口    |
| WebSocket   | 8502      | 实时对话服务     |
| 日志服务    | 8505      | 独立日志收集服务 |
| 前端预览    | 8500      | Vite 预览服务器  |
| API 文档    | 8501/docs | Swagger UI       |

## 📁 项目结构

```
AIEffect/
├── services/                   # 所有微服务
│   ├── api_gateway/           # API 网关服务
│   │   ├── src/api_gateway/
│   │   │   ├── api/          # API 路由
│   │   │   ├── models/       # 数据模型
│   │   │   └── services/     # 业务逻辑
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   └── start.py
│   │
│   ├── websocket/             # WebSocket 服务
│   │   ├── src/websocket_service/
│   │   │   ├── connection/   # 连接管理
│   │   │   ├── handlers/     # 消息处理器
│   │   │   ├── models/       # 数据模型
│   │   │   ├── protocol/     # 协议定义
│   │   │   └── session/      # 会话管理
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   └── start.py
│   │
│   └── log/                   # 日志服务
│       ├── src/log_service/
│       │   ├── api/          # API 路由
│       │   ├── core/         # 核心模块
│       │   └── models/       # 数据模型
│       ├── Dockerfile
│       ├── pyproject.toml
│       └── start.py
│
├── shared/                     # 共享代码库
│   └── python/
│       └── shared_core/       # Python 共享包
│           ├── __init__.py
│           ├── config.py      # 配置管理
│           ├── database.py    # 数据库管理
│           ├── logger.py      # 日志系统
│           └── schemas.py     # 共享模型
│
├── frontend/                  # React 前端
│   ├── src/
│   │   ├── components/       # 组件
│   │   ├── pages/            # 页面
│   │   └── store/            # 状态管理
│   └── package.json
│
├── docker-compose.yml         # Docker 编排
├── Makefile                   # 常用命令
└── 开发规范要求/              # 项目文档
```

## 🛠️ 功能特性

- **Ollama 代理服务**：将 Ollama API 转换为 OpenAI 兼容格式
- **AI 语音合成**：支持多种 TTS 引擎
- **字幕展示**：悬浮窗字幕，支持打字机效果
- **记忆管理**：对话历史智能压缩
- **实时日志**：SSE 实时日志推送
- **微服务架构**：独立部署，易于扩展

## 🏗️ 架构设计

项目采用**微服务架构**，各服务独立部署：

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Frontend)                       │
│                     React + Vite + TypeScript               │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│   Frontend   │ │ WebSocket│ │  Log Service │
│  (Port 8500) │ │(Port 8502│ │ (Port 8505)  │
└──────────────┘ │          │ │              │
                 │ - Real-  │ │ - Log Collect│
┌──────────────┐ │   time   │ │ - Query      │
│ API Gateway  │ │ - Chat   │ │ - SSE Stream │
│  (Port 8501) │ │          │ │              │
│              │ └──────────┘ └──────────────┘
│ - REST API   │
│ - Proxy      │
│ - Routing    │
└──────┬───────┘ └────┬─────┘ └──────────────┘
       │              │
       └──────────────┴──────────────────┐
                                          ▼
                              ┌─────────────────────┐
                              │  Shared Core        │
                              │  - Config           │
                              │  - Database         │
                              │  - Logger           │
                              └─────────────────────┘
```

### 服务间通信

- **API Gateway** → **Log Service**: HTTP 代理
- **WebSocket** → **Shared Core**: 共享包调用
- **All Services** → **Shared Core**: 共享包调用

## 📖 更多文档

- [架构重构迁移设计](./架构重构迁移设计.md)
- [日志服务设计](./开发规范要求/日志服务设计.md)
- [脚本使用说明](./script/README.md)
- [开发规范要求](./开发规范要求/)

## 📝 License

MIT
