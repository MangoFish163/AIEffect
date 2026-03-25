# AIEffect 前端项目结构文档

## 项目概述

AIEffect 前端是一个基于 React + TypeScript + Vite 构建的现代化管理界面，用于配置和控制 AI 语音交互适配器。提供可视化的配置管理、角色管理、字幕控制、语音设置等功能模块。

---

## 目录结构

```
frontend/
├── docs/                           # 项目文档目录
│   ├── agents工作室设计.md          # Agents 功能设计文档
│   ├── pixijs/                     # PixiJS 相关文档
│   │   ├── llms-full.txt
│   │   ├── llms-medium.txt
│   │   └── llms.txt
│   └── 页面设计图/                  # UI 设计参考图
│       ├── 字幕视觉页_1.png
│       ├── 字幕视觉页_2.png
│       ├── 服务连接页_1.png
│       ├── 服务连接页_2.png
│       ├── 记忆管理页.png
│       ├── 语音配置页_1.png
│       ├── 语音配置页_2.png
│       └── 运行日志页.png
├── src/                            # 源代码目录
│   ├── components/                 # 通用组件
│   │   ├── index.ts                # 组件统一导出
│   │   ├── Select.tsx              # 下拉选择组件
│   │   ├── Sidebar.tsx             # 侧边导航栏组件
│   │   └── Switch.tsx              # 开关切换组件
│   ├── pages/                      # 页面组件
│   │   ├── AgentsOffice.tsx        # Agents 办公室（基础版）
│   │   ├── AgentsOfficeAdvanced.tsx # Agents 办公室（高级版）
│   │   ├── AgentsOfficePixi.tsx    # Agents 办公室（PixiJS 版）
│   │   ├── AgentsOfficeZones.tsx   # Agents 办公室（分区版，当前使用）
│   │   ├── CharacterManager.tsx    # 角色管理页面
│   │   ├── ControlPanel.tsx        # 控制面板（API 配置）
│   │   ├── LogsViewer.tsx          # 运行日志查看器
│   │   ├── MemoryManager.tsx       # 记忆管理页面
│   │   ├── SubtitleVisual.tsx      # 字幕视觉配置页面
│   │   └── VoiceConfig.tsx         # 语音配置页面
│   ├── store/                      # 状态管理
│   │   └── index.ts                # Zustand 全局状态存储
│   ├── types/                      # TypeScript 类型定义
│   │   └── index.ts                # 全局类型定义文件
│   ├── App.tsx                     # 应用根组件
│   ├── index.css                   # 全局样式文件
│   └── main.tsx                    # 应用入口文件
├── index.html                      # HTML 入口模板
├── package.json                    # 项目依赖配置
├── package-lock.json               # 依赖锁定文件
├── postcss.config.js               # PostCSS 配置
├── tailwind.config.js              # Tailwind CSS 配置
├── tsconfig.json                   # TypeScript 配置
├── tsconfig.node.json              # Node 环境 TypeScript 配置
└── vite.config.ts                  # Vite 构建配置
```

---

## 文件功能详解

### 根目录文件

| 文件 | 功能说明 |
|------|----------|
| `index.html` | HTML 入口模板，包含根 DOM 节点 |
| `package.json` | 项目元数据和依赖清单 |
| `postcss.config.js` | PostCSS 配置，用于处理 CSS |
| `tailwind.config.js` | Tailwind CSS 主题和自定义配置 |
| `tsconfig.json` | TypeScript 编译器配置 |
| `vite.config.ts` | Vite 构建工具配置，含路径别名 |

---

### src/main.tsx

**应用入口文件**

- 创建 React 根节点
- 渲染 App 组件
- 启用 React.StrictMode

---

### src/App.tsx

**应用根组件**

- 全局布局结构（侧边栏 + 主内容区）
- 页面路由切换逻辑（基于状态管理）
- 支持页面：控制面板、字幕视觉、语音配置、记忆管理、角色管理、运行日志、Agents 办公室

---

### 组件层 (src/components/)

#### Sidebar.tsx - 侧边导航栏
- 项目 Logo 和品牌信息展示
- 导航菜单项渲染
- 当前页面高亮状态
- 服务状态指示器

#### Select.tsx - 下拉选择组件
- 支持自定义选项列表
- 自动定位（上/下展开）
- 点击外部关闭
- 支持 placeholder 和自定义样式

#### Switch.tsx - 开关切换组件
- 支持三种尺寸：sm、md、lg
- 禁用状态支持
- 平滑过渡动画

#### index.ts - 组件统一导出
- 集中导出所有组件，简化导入路径
- 当前导出: Select, Switch

---

### 页面层 (src/pages/)

#### ControlPanel.tsx - 控制面板
**功能：API 服务商配置管理**
- AI 服务商预设选择（DeepSeek、豆包、MiMo、OpenRouter、OpenAI、本地模型）
- API URL、API Key、模型名称配置
- 自定义服务商预设的增删改查
- 连接测试功能
- 配置保存和重置

#### SubtitleVisual.tsx - 字幕视觉
**功能：字幕显示配置**
- 字体颜色预设管理（白、黑、粉、黄、青、金、深蓝灰）
- 背景颜色预设管理（科技极光、自定义）
- 透明度、字体大小、打字速度调节
- 字幕预览功能
- 颜色预设的增删改查
- 字幕窗口显示/隐藏控制

#### VoiceConfig.tsx - 语音配置
**功能：TTS/ASR 语音设置**
- TTS 全局控制（启用/禁用、自动播放、保存音频、混音）
- TTS 引擎选择（GPT-SoVITS、讯飞等）
- 音量调节
- ASR 语音输入配置
- 快捷键设置
- 粘贴模式选择
- 百度/讯飞 ASR 密钥配置

#### MemoryManager.tsx - 记忆管理
**功能：角色记忆压缩配置**
- 存档目录设置
- 压缩触发阈值配置
- 压缩数量配置
- 检查频率配置
- 自动压缩开关
- 压缩前备份开关

#### CharacterManager.tsx - 角色管理
**功能：AI 角色管理**
- 角色列表展示（头像、名称、AI 灵魂、AI 语音）
- 角色增删改查
- Token 使用量和对话次数统计
- 存档文件加载
- 对话历史预览
- 角色属性编辑（AI 灵魂、语音、压缩开关、交互操作）

#### LogsViewer.tsx - 运行日志
**功能：系统日志查看**
- 实时日志流显示
- 日志级别筛选（INFO、WARNING、ERROR 等）
- 模块筛选
- 搜索功能
- 分页浏览
- 日志导出（JSON、CSV、TXT）
- 实时/暂停切换
- 日志清空

#### AgentsOfficeZones.tsx - Agents 办公室
**功能：可视化 AI 代理管理（当前主版本）**
- 基于 PixiJS 的像素风格办公室场景
- 多区域划分：工作区、休息区、大厅
- 代理角色可视化展示
- 代理状态管理（空闲、工作中、交谈中、移动中、休息中）
- 交互物品（电脑、书架、音乐、电视、Boss 台等）
- 实时消息气泡显示
- 代理移动动画

#### AgentsOffice.tsx / AgentsOfficeAdvanced.tsx / AgentsOfficePixi.tsx
- Agents 办公室的历史版本实现
- 保留作为功能迭代参考

---

### 状态管理 (src/store/)

#### index.ts - Zustand 全局状态存储

**状态定义：**
- `currentPage`: 当前活动页面
- `config`: 应用配置（API、TTS、字幕、记忆、端口）
- `characters`: 角色列表

**操作方法：**
- `setCurrentPage`: 切换当前页面
- `setConfig`: 更新配置（支持部分更新）
- `resetConfig`: 重置为默认配置
- `addCharacter`: 添加新角色
- `updateCharacter`: 更新角色信息
- `deleteCharacter`: 删除角色

---

### 类型定义 (src/types/)

#### index.ts - 全局 TypeScript 类型

**配置类型：**
- `AppConfig`: 应用总配置
- `APIConfig`: API 服务商配置
- `TTSConfig`: TTS 语音合成配置
- `SubtitleConfig`: 字幕显示配置
- `MemoryConfig`: 记忆管理配置
- `PortConfig`: 服务端口配置

**数据模型：**
- `Message`: 消息结构
- `CharacterMemory`: 角色记忆结构
- `Character`: 角色完整信息
- `CharacterFormData`: 角色表单数据

**枚举类型：**
- `PageType`: 页面类型枚举

---

### 样式文件 (src/index.css)

**CSS 变量定义：**
- 主色调（primary、primary-light、primary-dark）
- 渐变色（gradient-primary、gradient-bg）
- 状态色（success、warning、error、info）
- 文字色（text-primary、text-secondary、text-muted）
- 边框色（border、border-light）
- 背景色（bg-white、bg-gray、bg-dark）
- 阴影（shadow-sm、shadow、shadow-md、shadow-lg、shadow-glow）

**Tailwind 指令：**
- `@tailwind base`
- `@tailwind components`
- `@tailwind utilities`

---

## 技术栈

| 组件 | 用途 | 版本 |
|------|------|------|
| React | UI 框架 | ^18.2.0 |
| TypeScript | 类型系统 | ^5.2.2 |
| Vite | 构建工具 | ^5.2.0 |
| Tailwind CSS | 原子化 CSS 框架 | ^3.4.1 |
| Zustand | 状态管理 | ^4.5.2 |
| PixiJS | 2D 图形渲染引擎 | ^8.17.1 |
| Lucide React | 图标库 | ^0.344.0 |
| clsx | 条件类名合并 | ^2.1.0 |
| tailwind-merge | Tailwind 类名合并 | ^2.2.1 |

---

## 开发脚本

| 命令 | 功能 |
|------|------|
| `npm run dev` | 启动开发服务器（端口 8500） |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | ESLint 代码检查 |
| `npm run format` | Prettier 代码格式化 |

---

## 页面路由映射

| 页面标识 | 组件 | 功能描述 |
|----------|------|----------|
| `control` | ControlPanel | API 服务商连接配置 |
| `subtitle` | SubtitleVisual | 字幕样式和显示配置 |
| `voice` | VoiceConfig | TTS/ASR 语音设置 |
| `memory` | MemoryManager | 记忆压缩策略配置 |
| `character` | CharacterManager | AI 角色管理 |
| `logs` | LogsViewer | 系统日志查看 |
| `agents` | AgentsOfficeZones | 可视化代理办公室 |

---

## 主题配色

**主色调：**
- Primary: `#6366f1`（靛紫色）
- Primary Light: `#818cf8`
- Primary Dark: `#4f46e5`

**背景渐变：**
- 主背景：`linear-gradient(180deg, #f0f4ff 0%, #e8f0ff 100%)`

**功能色：**
- Success: `#10b981`（绿）
- Warning: `#f59e0b`（橙）
- Error: `#ef4444`（红）
- Info: `#3b82f6`（蓝）
- Accent: `#ec4899`（粉）
- Cyan: `#06b6d4`（青）

---

## 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端开发服务器 | 8500 | Vite dev server |
| 后端 API | 8501 | FastAPI 服务 |
| Ollama 代理 | 11434 | Ollama 兼容 API |
| WebSocket | 8502 | 实时通信 |
| 字幕服务 | 8503 | 字幕窗口服务 |
| TTS 服务 | 8504 | 语音合成服务 |
| 日志服务 | 8505 | 日志推送服务 |

---

## 项目特点

1. **现代化技术栈**：React 18 + TypeScript + Vite，开发体验优秀
2. **原子化 CSS**：Tailwind CSS 提供高效的样式开发
3. **轻量状态管理**：Zustand 替代 Redux，代码更简洁
4. **可视化交互**：PixiJS 实现像素风 Agents 办公室
5. **类型安全**：完整的 TypeScript 类型定义
6. **模块化设计**：组件、页面、状态、类型分层清晰
