# AIEffect 后端项目结构文档

## 项目概述

AIEffect 是一个 AI 语音交互适配器后端，基于 FastAPI 框架构建，提供 API 服务、TTS（文本转语音）、字幕显示、记忆管理、代理服务等核心功能。

---

## 目录结构

```
backend/
├── .env.example              # 环境变量示例文件
├── pyproject.toml            # 项目配置（Python 版本、代码格式化规则等）
├── requirements.txt          # Python 依赖包列表
├── PROJECT_STRUCTURE.md      # 本文档
└── src/                      # 源代码目录
    ├── __init__.py           # 包初始化文件
    ├── main.py               # FastAPI 应用入口
    ├── api/                  # API 路由层
    │   ├── __init__.py
    │   ├── agents.py         # AI 代理管理接口
    │   ├── asr.py            # 语音识别（ASR）接口
    │   ├── characters.py     # 游戏角色管理接口
    │   ├── config.py         # 系统配置管理接口
    │   ├── files.py          # 文件浏览管理接口
    │   ├── logs.py           # 系统日志查询接口
    │   ├── memory.py         # 角色记忆管理接口
    │   ├── providers.py      # AI 服务商预设管理接口
    │   ├── proxy.py          # Ollama 代理服务接口
    │   ├── subtitle.py       # 字幕服务接口
    │   ├── system.py         # 系统信息与健康检查接口
    │   └── tts.py            # 语音合成（TTS）接口
    ├── core/                 # 核心基础设施层
    │   ├── __init__.py
    │   ├── config.py         # 配置管理器（单例模式）
    │   ├── database.py       # SQLite 数据库操作封装
    │   ├── logger.py         # 日志系统（内存+文件）
    │   └── port_manager.py   # 端口管理工具
    ├── models/               # 数据模型层
    │   ├── __init__.py
    │   └── schemas.py        # Pydantic 数据模型定义
    └── services/             # 业务服务层
        ├── __init__.py
        ├── log_service.py    # 日志服务封装
        ├── memory_service.py # 记忆管理服务
        ├── proxy_service.py  # 代理服务实现
        ├── subtitle_service.py # 字幕服务实现
        └── tts_service.py    # TTS 服务实现
```

---

## 文件功能详解

### 根目录文件

| 文件 | 功能说明 |
|------|----------|
| `.env.example` | 环境变量模板，包含所有可配置的环境变量示例 |
| `pyproject.toml` | 项目元数据和工具配置（Black、Ruff 代码格式化规则） |
| `requirements.txt` | Python 依赖清单（FastAPI、Uvicorn、Pydantic 等） |

---

### src/main.py

**FastAPI 应用主入口**

- 创建 FastAPI 应用实例
- 配置 CORS 跨域支持
- 注册所有 API 路由
- 实现应用生命周期管理（启动/关闭）
- 提供健康检查端点 `/api/health`

---

### API 层 (src/api/)

#### agents.py - AI 代理管理
- 获取代理列表
- 创建/更新/删除代理
- 代理位置更新
- 代理状态管理
- 向代理发送消息

#### asr.py - 语音识别
- ASR 配置管理（百度/讯飞）
- 启动/停止语音识别会话
- 支持快捷键和粘贴模式配置

#### config.py - 系统配置
- 获取完整系统配置
- 更新配置（API、TTS、字幕、记忆等模块）
- 重置配置为默认值

#### files.py - 文件管理
- 目录浏览（支持分页）
- 目录树形结构获取
- 文件信息查询（类型、大小、修改时间）

#### logs.py - 日志查询
- 分页查询系统日志
- 支持按级别、模块、时间范围筛选
- 日志统计信息
- 清空日志

#### memory.py - 记忆管理
- 记忆配置管理
- 提示词模板管理
- 角色记忆压缩

#### providers.py - 服务商预设
- 获取内置和自定义 AI 服务商预设
- 创建/更新/删除自定义预设
- 支持 OpenAI、DeepSeek、Ollama 等服务商

#### proxy.py - Ollama 代理
- 代理服务状态查询
- 启动/停止代理服务
- 代理连接测试

#### subtitle.py - 字幕服务
- 字幕配置管理（颜色、字体、透明度等）
- 颜色预设管理
- 字幕窗口控制

#### system.py - 系统信息
- 获取系统信息（版本、平台、运行时间）
- 健康检查（数据库、代理、TTS、记忆服务状态）

#### tts.py - 语音合成
- TTS 配置管理
- TTS 引擎管理（GPT-SoVITS、讯飞等）
- 语音角色管理
- 角色情感配置

#### characters.py - 游戏角色管理
- 游戏角色列表查询（支持分页、存档筛选）
- 创建/更新/删除角色
- 角色详情查询
- 角色导入功能

---

### 核心层 (src/core/)

#### config.py - 配置管理器
- 单例模式实现的配置管理器
- 支持从环境变量和 JSON 文件加载配置
- 配置数据模型定义（APIConfig、TTSConfig、SubtitleConfig 等）
- 自动创建数据目录

#### database.py - 数据库封装
- 基于 aiosqlite 的异步 SQLite 操作
- 数据库初始化（创建表结构）
- 提供 fetchone、fetchall、execute 等方法
- 支持配置表、服务商预设表、TTS 引擎表、语音角色表等

#### logger.py - 日志系统
- 内存日志处理器（InMemoryLogHandler）
- 文件日志输出
- 日志监听器机制（支持实时推送）
- 日志级别筛选和统计

#### port_manager.py - 端口管理
- 检测端口是否可用
- 自动查找可用端口
- 管理服务端口分配（API、WebSocket、字幕、TTS、日志等）

---

### 模型层 (src/models/)

#### schemas.py - 数据模型
- Pydantic 模型定义
- 请求/响应数据结构
- 核心模型：Message、CharacterMemory、BaseResponse
- 配置模型：APIConfig、TTSConfig、SubtitleConfig、MemoryConfig、PortConfig
- 角色模型：GameCharacter、CreateGameCharacterRequest、UpdateGameCharacterRequest
- 记忆模型：CharacterMemoryInfo、ConversationMessageItem、MemoryCompressionHistoryItem
- Agent模型：Agent、CreateAgentRequest、AgentMessage、AgentZone
- TTS模型：TTSSynthesizeRequest、VoiceCharacter、CharacterEmotion
- 字幕模型：SubtitleHistoryEntry、SubtitleSendRequest
- 文件模型：FileItem、DirectoryBrowseResponse、DirectoryTreeNode

---

### 服务层 (src/services/)

#### log_service.py - 日志服务
- 封装内存日志处理器
- 提供日志查询、统计、清空接口
- 支持日志监听器注册

#### memory_service.py - 记忆服务
- 角色对话记忆管理
- JSON 文件持久化存储
- 自动压缩机制（当消息数超过阈值）
- 记忆摘要生成

#### proxy_service.py - 代理服务
- Ollama 代理服务管理
- OpenAI 格式与 Ollama 格式转换
- 请求转发和响应处理

#### subtitle_service.py - 字幕服务
- 字幕显示/隐藏控制
- 字幕历史记录管理
- 事件监听器机制

#### tts_service.py - TTS 服务
- 多引擎支持（GPT-SoVITS、讯飞）
- 文本转语音合成
- 引擎抽象基类设计

---

## 技术栈

| 组件 | 用途 |
|------|------|
| FastAPI | Web 框架 |
| Uvicorn | ASGI 服务器 |
| Pydantic | 数据验证和序列化 |
| aiosqlite | 异步 SQLite 数据库 |
| httpx | HTTP 客户端 |
| websockets | WebSocket 支持 |
| python-dotenv | 环境变量管理 |

---

## 数据库表结构

| 表名 | 用途 |
|------|------|
| config | 系统配置存储 |
| provider_presets | AI 服务商预设 |
| tts_engines | TTS 引擎配置 |
| voice_characters | 语音角色定义 |
| character_emotions | 角色情感配置 |
| subtitle_color_presets | 字幕颜色预设 |
| subtitle_history | 字幕历史记录 |
| system_logs | 系统日志 |
| agents | AI 代理信息 |
| agent_messages | Agent 消息记录 |
| agent_zones | 工作室区域管理 |
| asr_config | 语音识别配置 |
| characters | 游戏角色管理 |
| character_memories | 角色记忆统计 |
| conversation_messages | 对话消息存储 |
| memory_compression_history | 记忆压缩历史 |

---

## 端口分配

| 服务 | 默认端口 | 说明 |
|------|----------|------|
| API | 8500 | FastAPI 主服务 |
| Ollama Proxy | 8501 | Ollama 代理服务 |
| WebSocket | 8502 | WebSocket 服务 |
| Subtitle | 8503 | 字幕服务 |
| TTS | 8504 | TTS 服务端口 |
| Log | 8505 | 日志服务端口 |