# AIEffect API Gateway

API 网关服务 - 统一的 API 入口

## 功能

- 统一的 API 入口
- 请求路由和转发
- 日志服务代理
- 配置管理
- AI 助手 API
- Agent 管理
- 角色管理
- TTS 服务
- 字幕服务
- 记忆管理
- 文件管理
- 系统管理

## 目录结构

```
services/api_gateway/
├── src/
│   └── api_gateway/
│       ├── __init__.py
│       ├── main.py              # 服务入口
│       ├── api/                 # API 路由
│       │   ├── __init__.py
│       │   ├── agents.py
│       │   ├── ai_assistant.py
│       │   ├── asr.py
│       │   ├── characters.py
│       │   ├── config.py
│       │   ├── files.py
│       │   ├── logs.py          # 日志服务代理
│       │   ├── memory.py
│       │   ├── providers.py
│       │   ├── proxy.py
│       │   ├── subtitle.py
│       │   ├── system.py
│       │   └── tts.py
│       ├── models/              # 数据模型
│       │   ├── __init__.py
│       │   └── schemas.py
│       └── services/            # 业务服务
│           ├── __init__.py
│           ├── log_service.py
│           ├── memory_service.py
│           ├── proxy_service.py
│           ├── subtitle_service.py
│           └── tts_service.py
├── start.py                     # 启动脚本
├── pyproject.toml               # Poetry 配置
└── README.md
```

## 启动服务

### 使用 Poetry

```bash
cd services/api_gateway
poetry install
poetry run python start.py
```

### 使用 pip

```bash
cd services/api_gateway
pip install -e ../../shared/python
pip install -r requirements.txt
python start.py
```

## 端口

- API Gateway: 8501

## API

- `GET /api/health` - 健康检查
- `GET /api/ports` - 获取服务端口
