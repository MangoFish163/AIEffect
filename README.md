# AIEffect - AI 语音交互适配器

一款集 Ollama 代理服务、AI 语音合成（TTS）、字幕展示、对话记忆管理于一体的现代化 AI 交互工具。

## 🚀 快速开始

### 开发环境一键启动

```powershell
# 在项目根目录执行
.\script\start-dev.ps1
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

- **Python 3.11+**
- **Node.js 18+**
- **Windows 10/11**

## 📊 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 后端 API | 8500 | FastAPI 主服务 |
| 前端开发 | 5173 | Vite 开发服务器 |
| 前端预览 | 4173 | Vite 预览服务器 |
| API 文档 | 8500/docs | Swagger UI |

## 📁 项目结构

```
AIEffect/
├── backend/              # Python 后端 (FastAPI)
│   ├── src/
│   │   ├── api/         # API 路由
│   │   ├── services/    # 业务逻辑
│   │   ├── models/      # 数据模型
│   │   └── core/        # 核心配置
│   ├── data/            # 数据目录
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/            # React 前端
│   ├── src/
│   │   ├── components/  # 组件
│   │   ├── pages/       # 页面
│   │   └── store/       # 状态管理
│   └── package.json
├── script/              # 开发和构建脚本
│   ├── start-dev.ps1    # 开发环境启动
│   ├── build.ps1        # 打包构建
│   └── README.md        # 脚本说明
└── 开发规范要求/        # 项目文档
```

## 🛠️ 功能特性

- **Ollama 代理服务**：将 Ollama API 转换为 OpenAI 兼容格式
- **AI 语音合成**：支持多种 TTS 引擎
- **字幕展示**：悬浮窗字幕，支持打字机效果
- **记忆管理**：对话历史智能压缩
- **实时日志**：SSE 实时日志推送

## 📖 更多文档

- [脚本使用说明](./script/README.md)
- [开发规范要求](./开发规范要求/)

## 📝 License

MIT
