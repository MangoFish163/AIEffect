# AIEffect WebSocket Service

WebSocket 服务 - 实时 AI 对话服务

## 功能

- 实时 WebSocket 连接管理
- AI 助手对话
- Agent 对话
- 心跳检测
- 会话管理

## 目录结构

```
services/websocket/
├── src/
│   └── websocket_service/
│       ├── __init__.py
│       ├── main.py              # 服务入口
│       ├── connection/          # 连接管理
│       │   └── manager.py
│       ├── handlers/            # 消息处理器
│       │   ├── __init__.py
│       │   ├── base.py
│       │   ├── ai_assistant.py
│       │   └── agent_chat.py
│       ├── models/              # 数据模型
│       │   └── session.py
│       ├── protocol/            # 协议定义
│       │   ├── constants.py
│       │   └── schemas.py
│       └── session/             # 会话管理
│           └── manager.py
├── start.py                     # 启动脚本
├── pyproject.toml               # Poetry 配置
└── README.md
```

## 启动服务

### 使用 Poetry

```bash
cd services/websocket
poetry install
poetry run python start.py
```

### 使用 pip

```bash
cd services/websocket
pip install -e ../../shared/python
pip install -r requirements.txt
python start.py
```

## 端口

- WebSocket: 8502

## API

- `ws://localhost:8502/ws` - WebSocket 端点
- `GET /health` - 健康检查
