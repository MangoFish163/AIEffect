import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Eye,
  EyeOff,
  Copy,
  Check,
  Settings,
  Volume2,
  Plus,
  RefreshCw,
  Globe,
  Bot,
  Zap,
  Trash2,
  Save,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Shuffle,
  LayoutDashboard,
  TestTube,
} from "lucide-react";
import { useAppStore } from "../store";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Select, Switch } from "../components";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// API 基础地址
const API_BASE_URL = "http://localhost:8501";

// 本地存储键名
const MODEL_CONFIG_CACHE_KEY = 'model_config_cache';
const MODEL_CONFIG_HASH_KEY = 'model_config_hash';

// 生成配置hash（简化版，用于前端比较）
function generateConfigHash(config: any): string {
  const str = JSON.stringify(config);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// 从localStorage加载缓存的配置
function loadCachedModelConfig(): { api: any, hash: string } | null {
  try {
    const cached = localStorage.getItem(MODEL_CONFIG_CACHE_KEY);
    const cachedHash = localStorage.getItem(MODEL_CONFIG_HASH_KEY);
    if (cached && cachedHash) {
      return { api: JSON.parse(cached), hash: cachedHash };
    }
  } catch (e) {
    console.error('Failed to load cached config:', e);
  }
  return null;
}

// 保存配置到localStorage
function saveCachedModelConfig(apiConfig: any, hash: string) {
  try {
    localStorage.setItem(MODEL_CONFIG_CACHE_KEY, JSON.stringify(apiConfig));
    localStorage.setItem(MODEL_CONFIG_HASH_KEY, hash);
  } catch (e) {
    console.error('Failed to save cached config:', e);
  }
}

// 预设服务商类型
interface ProviderPreset {
  id: string;
  name: string;
  icon: string;
  apiUrl: string;
  apiKey?: string;
  modelName?: string;
  docUrl?: string;
  curlExample?: string;
  isCustom?: boolean;
}

// 测试响应类型
interface TestResponse {
  success: boolean;
  latency_ms?: number;
  model_list?: string[];
  message: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// 内置预设服务商
const BUILTIN_PRESETS: ProviderPreset[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "🗿",
    apiUrl: "https://api.deepseek.com/v1",
  },
  {
    id: "doubao",
    name: "豆包Seed (火山引擎)",
    icon: "😍",
    apiUrl: "https://ark.cn-beijing.volces.com/api/v3",
  },
  {
    id: "mimo",
    name: "MiMo (XiaoMi)",
    icon: "🐿️",
    apiUrl: "https://api.mimo.ai/v1",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: "🤖",
    apiUrl: "https://openrouter.ai/api/v1",
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "🐳",
    apiUrl: "https://api.openai.com/v1",
  },
  {
    id: "local",
    name: "本地模型",
    icon: "🏠",
    apiUrl: "http://127.0.0.1:11434/v1",
  },
];

// 随机图标选项
const RANDOM_ICONS = ["🐿️", "🐳", "🐸", "😎", "🤖", "🦞"];

// cURL 输入弹窗组件
interface CurlModalProps {
  isOpen: boolean;
  onClose: () => void;
  curlExample: string;
  onSave: (curlExample: string) => void;
}

const CurlModal: React.FC<CurlModalProps> = ({
  isOpen,
  onClose,
  curlExample,
  onSave,
}) => {
  const [value, setValue] = useState(curlExample || "");

  useEffect(() => {
    setValue(curlExample || "");
  }, [curlExample, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(value.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#0f172a]">cURL 示例代码</h3>
          <button
            onClick={onClose}
            className="p-1 text-[#94a3b8] hover:text-[#64748b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-[#64748b] mb-4">
          输入 cURL 示例代码，用于测试和参考
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`curl -X POST "https://api.example.com/v1/chat/completions" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`}
              className="input w-full h-48 font-mono text-sm resize-none focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
              spellCheck={false}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-[#64748b] border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium bg-[#6366f1] text-white rounded-xl hover:bg-[#4f46e5] transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 新建预设弹窗组件
interface CreatePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (preset: Omit<ProviderPreset, "id" | "isCustom">) => void;
}

const CreatePresetModal: React.FC<CreatePresetModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [curlExample, setCurlExample] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCurlModalOpen, setIsCurlModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate({
        name: name.trim(),
        icon: icon || "⭐",
        apiUrl: apiUrl.trim(),
        apiKey: apiKey.trim(),
        modelName: modelName.trim(),
        docUrl: docUrl.trim(),
        curlExample: curlExample.trim(),
      });
      setName("");
      setIcon("");
      setApiUrl("");
      setApiKey("");
      setModelName("");
      setDocUrl("");
      setCurlExample("");
      onClose();
    }
  };

  const handleRandomIcon = () => {
    const randomIcon =
      RANDOM_ICONS[Math.floor(Math.random() * RANDOM_ICONS.length)];
    setIcon(randomIcon);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#0f172a]">新建模型预设</h3>
          <button
            onClick={onClose}
            className="p-1 text-[#94a3b8] hover:text-[#64748b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-[#64748b] mb-6">
          创建一个新的模型配置预设，方便快速切换不同的服务商
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-[2]">
              <label className="block text-sm font-medium text-[#334155] mb-1.5">
                预设名称
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：Claude API"
                className="input focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-[#334155] mb-1.5">
                图标
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 2) {
                      setIcon(value);
                    }
                  }}
                  placeholder="⭐"
                  className="input w-full text-center pr-10 pl-3 focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={handleRandomIcon}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-[#64748b] hover:text-[#6366f1] transition-all duration-200"
                  title="随机图标"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#334155] mb-1.5">
              默认 URL (可选)
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="input focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
            />
          </div>
          {isExpanded && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">
                  API Key (可选)
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="input pr-10 focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] transition-colors duration-200"
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">
                  模型名称 (可选)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="例如：gpt-4"
                    className="input pr-10 focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#6366f1] transition-colors duration-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-[#334155]">
                    官方接口文档地址 (可选)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCurlModalOpen(true)}
                    className={cn(
                      "text-xs px-2 py-1 rounded-lg border transition-all duration-200",
                      curlExample
                        ? "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0] hover:bg-[#dcfce7]"
                        : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] hover:bg-[#f1f5f9] hover:border-[#cbd5e1]"
                    )}
                  >
                    {curlExample ? "已配置 cURL" : "+ cURL"}
                  </button>
                </div>
                <input
                  type="text"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://docs.example.com"
                  className="input focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                />
              </div>
            </>
          )}
          <div className="flex justify-center -mt-3">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#94a3b8] hover:text-[#64748b] transition-colors duration-200 leading-none h-4 flex items-center"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-[#64748b] border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium rounded-xl transition-colors",
                name.trim()
                  ? "bg-[#6366f1] text-white hover:bg-[#4f46e5]"
                  : "bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed",
              )}
            >
              创建
            </button>
          </div>
        </form>
      </div>
      <CurlModal
        isOpen={isCurlModalOpen}
        onClose={() => setIsCurlModalOpen(false)}
        curlExample={curlExample}
        onSave={setCurlExample}
      />
    </div>
  );
};

// 编辑预设弹窗组件
interface EditPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset: ProviderPreset | null;
  onSave: (preset: ProviderPreset) => void;
}

const EditPresetModal: React.FC<EditPresetModalProps> = ({
  isOpen,
  onClose,
  preset,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [curlExample, setCurlExample] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isCurlModalOpen, setIsCurlModalOpen] = useState(false);

  useEffect(() => {
    if (preset) {
      setName(preset.name);
      setIcon(preset.icon);
      setApiUrl(preset.apiUrl);
      setApiKey(preset.apiKey || "");
      setModelName(preset.modelName || "");
      setDocUrl(preset.docUrl || "");
      setCurlExample(preset.curlExample || "");
    }
  }, [preset]);

  if (!isOpen || !preset) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave({
        ...preset,
        name: name.trim(),
        icon: icon || "⭐",
        apiUrl: apiUrl.trim(),
        apiKey: apiKey.trim(),
        modelName: modelName.trim(),
        docUrl: docUrl.trim(),
        curlExample: curlExample.trim(),
      });
      onClose();
    }
  };

  const handleRandomIcon = () => {
    const randomIcon =
      RANDOM_ICONS[Math.floor(Math.random() * RANDOM_ICONS.length)];
    setIcon(randomIcon);
  };

  const handleCurlSave = (newCurlExample: string) => {
    setCurlExample(newCurlExample);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#0f172a]">编辑模型预设</h3>
            <button
              onClick={onClose}
              className="p-1 text-[#94a3b8] hover:text-[#64748b] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-[#64748b] mb-6">
            修改模型配置预设的详细信息
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-[2]">
                <label className="block text-sm font-medium text-[#334155] mb-1.5">
                  预设名称
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：Claude API"
                  className="input focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#334155] mb-1.5">
                  图标
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 2) {
                        setIcon(value);
                      }
                    }}
                    placeholder="⭐"
                    className="input w-full text-center pr-10 pl-3 focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={handleRandomIcon}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-[#64748b] hover:text-[#6366f1] transition-all duration-200"
                    title="随机图标"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">
                默认 URL
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="input focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="input pr-10 focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] transition-colors duration-200"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">
                模型名称
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="例如：gpt-4"
                className="input focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[#334155]">
                  官方接口文档地址
                </label>
                <button
                  type="button"
                  onClick={() => setIsCurlModalOpen(true)}
                  className={cn(
                    "text-xs px-2 py-1 rounded-lg border transition-all duration-200",
                    curlExample
                      ? "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0] hover:bg-[#dcfce7]"
                      : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] hover:bg-[#f1f5f9] hover:border-[#cbd5e1]"
                  )}
                >
                  {curlExample ? "已配置 cURL" : "+ cURL"}
                </button>
              </div>
              <input
                type="text"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://docs.example.com"
                className="input focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-[#64748b] border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className={cn(
                  "flex-1 px-4 py-2 text-sm font-medium rounded-xl transition-colors",
                  name.trim()
                    ? "bg-[#6366f1] text-white hover:bg-[#4f46e5]"
                    : "bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed",
                )}
              >
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
      <CurlModal
        isOpen={isCurlModalOpen}
        onClose={() => setIsCurlModalOpen(false)}
        curlExample={curlExample}
        onSave={handleCurlSave}
      />
    </>
  );
};

// 自定义预设下拉菜单组件
interface PresetSelectProps {
  value: string;
  onChange: (value: string) => void;
  builtinPresets: ProviderPreset[];
  customPresets: ProviderPreset[];
  onCreateNew: () => void;
  onDeleteCustom: (id: string) => void;
}

const PresetSelect: React.FC<PresetSelectProps> = ({
  value,
  onChange,
  builtinPresets,
  customPresets,
  onCreateNew,
  onDeleteCustom,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const allPresets = [...builtinPresets, ...customPresets];
  const selectedPreset = allPresets.find((p) => p.id === value);
  const isCustomSelected = customPresets.some((p) => p.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (presetId: string) => {
    onChange(presetId);
    setIsOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 bg-white border rounded-xl text-sm transition-all duration-200",
          isOpen
            ? "border-[#6366f1] ring-2 ring-[#6366f1]/10 shadow-sm"
            : "border-[#e2e8f0] hover:border-[#94a3b8]",
        )}
      >
        <span className={selectedPreset ? "text-[#334155]" : "text-[#94a3b8]"}>
          {selectedPreset
            ? `${selectedPreset.icon} ${selectedPreset.name}`
            : "选择服务商"}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-[#64748b] transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full min-w-[240px] bg-white border border-[#e2e8f0] rounded-xl shadow-lg overflow-hidden top-full mt-1">
          <div className="py-1 max-h-[320px] overflow-y-auto">
            {/* 默认预设分组 */}
            <div className="px-3 py-2 text-xs font-medium text-[#94a3b8] uppercase tracking-wider">
              自定义 (Custom)
            </div>
            {builtinPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelect(preset.id)}
                className={cn(
                  "w-full px-4 py-2.5 text-left text-sm transition-colors duration-150 flex items-center gap-2",
                  value === preset.id
                    ? "bg-[#f0f4ff] text-[#6366f1]"
                    : "text-[#334155] hover:bg-[#f8fafc]",
                )}
              >
                <span>{preset.icon}</span>
                <span className="flex-1">{preset.name}</span>
                {value === preset.id && <Check className="w-4 h-4" />}
              </button>
            ))}

            {/* 分隔线 */}
            {customPresets.length > 0 && (
              <div className="border-t border-[#e2e8f0] mt-1 pt-1">
                <div className="px-3 py-2 text-xs font-medium text-[#94a3b8] uppercase tracking-wider">
                  我的预设
                </div>
                {customPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelect(preset.id)}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-sm transition-colors duration-150 flex items-center gap-2 group",
                      value === preset.id
                        ? "bg-[#f0f4ff] text-[#6366f1]"
                        : "text-[#334155] hover:bg-[#f8fafc]",
                    )}
                  >
                    <span>{preset.icon}</span>
                    <span className="flex-1">{preset.name}</span>
                    {value === preset.id && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            )}

            {/* 新建预设按钮 */}
            <div className="border-t border-[#e2e8f0] mt-1 pt-1 px-2 pb-1">
              <button
                type="button"
                onClick={() => {
                  onCreateNew();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-[#6366f1] hover:bg-[#f0f4ff] rounded-lg transition-colors duration-150 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                新建预设...
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ControlPanel: React.FC = () => {
  const { config, setConfig } = useAppStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isServiceRunning, setIsServiceRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  // 新增状态
  const [antigravityEnabled, setAntigravityEnabled] = useState(false);
  const [auxModelEnabled, setAuxModelEnabled] = useState(false);
  const [lanEnabled, setLanEnabled] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [activePromptTab, setActivePromptTab] = useState<
    "system" | "assistant"
  >("system");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState("");

  // 自定义预设状态
  const [customPresets, setCustomPresets] = useState<ProviderPreset[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 测试按钮加载状态
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [isTestingService, setIsTestingService] = useState(false);
  const [testResult, setTestResult] = useState<TestResponse | null>(null);
  const [showTestResult, setShowTestResult] = useState(false);

  // 加载状态
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // 自动保存定时器ref
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedConfigRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // 获取配置和预设列表（带hash校验）
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // 先尝试从缓存加载模型配置
        const cached = loadCachedModelConfig();
        let clientHash = cached?.hash || '';

        // 先获取服务商预设列表（用于验证provider有效性）
        let customList: ProviderPreset[] = [];
        const providersRes = await fetch(`${API_BASE_URL}/api/providers`);
        if (providersRes.ok) {
          const providersData = await providersRes.json();
          if (providersData.data?.custom) {
            customList = providersData.data.custom.map((p: any) => ({
              id: p.id,
              name: p.name,
              icon: p.icon,
              apiUrl: p.api_url,
              apiKey: p.api_key,
              modelName: p.model_name,
              docUrl: p.doc_url,
              curlExample: p.curl_example,
              isCustom: p.is_custom,
            }));
            setCustomPresets(customList);
          }
        }

        // 获取所有可用预设ID（包括内置和自定义）
        const allPresetIds = [...BUILTIN_PRESETS.map(p => p.id), ...customList.map(p => p.id)];

        // 携带hash请求后端，进行校验
        const configRes = await fetch(`${API_BASE_URL}/api/config${clientHash ? `?hash=${clientHash}` : ''}`);
        if (configRes.ok) {
          const configData = await configRes.json();
          if (configData.data) {
            // 如果后端返回hash_mismatch为true或没有缓存，使用后端数据
            if (configData.hash_mismatch || !cached) {
              // 检查后端返回的provider是否有效，无效则默认使用本地模型
              const savedProvider = configData.data.api?.provider;
              const isValidProvider = savedProvider && allPresetIds.includes(savedProvider);
              const defaultProvider = isValidProvider ? savedProvider : 'local';
              // 获取默认预设的配置
              const defaultPreset = BUILTIN_PRESETS.find(p => p.id === defaultProvider);

              const newApiConfig = {
                provider: defaultProvider,
                api_url: configData.data.api?.api_url || defaultPreset?.apiUrl || '',
                api_key: configData.data.api?.api_key || '',
                model_name: configData.data.api?.model_name || '',
              };
              setConfig({
                api: newApiConfig,
                tts: configData.data.tts || config.tts,
                subtitle: configData.data.subtitle || config.subtitle,
                memory: configData.data.memory || config.memory,
                ports: configData.data.ports || config.ports,
                lan_enabled: configData.data.lan_enabled || false,
              });
              // 更新缓存
              const newHash = configData.server_hash || generateConfigHash(newApiConfig);
              saveCachedModelConfig(newApiConfig, newHash);
              lastSavedConfigRef.current = JSON.stringify(newApiConfig);
            } else {
              // 有缓存且hash匹配，但仍需验证provider是否有效
              const cachedProvider = cached.api?.provider;
              const isCachedProviderValid = cachedProvider && allPresetIds.includes(cachedProvider);

              if (!isCachedProviderValid) {
                // 缓存的provider无效，回退到本地模型
                const localPreset = BUILTIN_PRESETS.find(p => p.id === 'local');
                const fallbackConfig = {
                  provider: 'local',
                  api_url: localPreset?.apiUrl || 'http://127.0.0.1:11434/v1',
                  api_key: '',
                  model_name: '',
                };
                setConfig({
                  api: fallbackConfig,
                  tts: config.tts,
                  subtitle: config.subtitle,
                  memory: config.memory,
                  ports: config.ports,
                  lan_enabled: config.lan_enabled,
                });
                // 更新缓存
                const newHash = generateConfigHash(fallbackConfig);
                saveCachedModelConfig(fallbackConfig, newHash);
                lastSavedConfigRef.current = JSON.stringify(fallbackConfig);
              } else {
                // 缓存有效，使用缓存数据
                setConfig({
                  api: cached.api,
                  tts: config.tts,
                  subtitle: config.subtitle,
                  memory: config.memory,
                  ports: config.ports,
                  lan_enabled: config.lan_enabled,
                });
                lastSavedConfigRef.current = JSON.stringify(cached.api);
              }
            }
            setLanEnabled(configData.data.lan_enabled || false);
            setTtsEnabled(configData.data.tts?.enabled ?? true);
            setAutoPlayEnabled(configData.data.tts?.auto_play ?? true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // 当自定义预设列表加载完成后，验证当前provider是否仍然有效
  useEffect(() => {
    // 只有在非加载状态下才进行验证
    if (isLoading) return;

    const allPresetIds = [...BUILTIN_PRESETS.map(p => p.id), ...customPresets.map(p => p.id)];
    const currentProvider = config.api.provider;

    // 如果当前provider不在预设列表中，回退到本地模型
    if (currentProvider && !allPresetIds.includes(currentProvider)) {
      const localPreset = BUILTIN_PRESETS.find(p => p.id === 'local');
      const fallbackConfig = {
        provider: 'local',
        api_url: localPreset?.apiUrl || 'http://127.0.0.1:11434/v1',
        api_key: '',
        model_name: '',
      };
      setConfig({
        api: fallbackConfig,
      });
      // 更新缓存
      const newHash = generateConfigHash(fallbackConfig);
      saveCachedModelConfig(fallbackConfig, newHash);
      lastSavedConfigRef.current = JSON.stringify(fallbackConfig);
    }
  }, [customPresets, isLoading]);

  // 保存配置到后端
  const saveConfig = async (configToSave?: typeof config, isAutoSave: boolean = false) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    
    try {
      if (!isAutoSave) {
        setIsSaving(true);
      }
      setSaveStatus('saving');
      const configData = configToSave || config;
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, 10000); // 10秒超时
      
      const res = await fetch(`${API_BASE_URL}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api: configData.api,
          tts: configData.tts,
          lan_enabled: lanEnabled,
        }),
        signal: abortControllerRef.current.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        // 更新本地缓存和hash
        const serverHash = data.server_hash || generateConfigHash(configData.api);
        saveCachedModelConfig(configData.api, serverHash);
        lastSavedConfigRef.current = JSON.stringify(configData.api);
        setSaveStatus('saved');
        // 3秒后恢复idle状态
        setTimeout(() => setSaveStatus('idle'), 3000);
        return true;
      } else {
        console.error("Save config failed:", res.status, res.statusText);
        setSaveStatus('error');
        return false;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error("Save config timeout or cancelled");
      } else {
        console.error("Failed to save config:", error);
      }
      setSaveStatus('error');
      return false;
    } finally {
      abortControllerRef.current = null;
      if (!isAutoSave) {
        setIsSaving(false);
      }
    }
  };

  // 自动保存逻辑：检测到配置变化后1.5秒自动保存
  useEffect(() => {
    // 只在初始数据加载完成后才启用自动保存
    if (isLoading) return;
    
    // 检查配置是否有实际变化
    const currentConfigStr = JSON.stringify(config.api);
    if (currentConfigStr === lastSavedConfigRef.current) {
      return; // 配置没有变化，不需要保存
    }
    
    // 清除之前的定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // 设置新的定时器，1.5秒后保存
    autoSaveTimerRef.current = setTimeout(() => {
      saveConfig(config, true);
    }, 1500);
    
    // 清理函数
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [config.api, isLoading]);
  
  // 组件卸载时取消正在进行的请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // 处理测试按钮点击
  const handleTestProvider = async () => {
    setIsTestingProvider(true);
    setShowTestResult(false);
    try {
      // 获取当前预设
      const currentPreset = getCurrentPreset();
      const presetName = currentPreset?.name || config.api.provider;
      
      // 获取cURL示例（优先从自定义预设中获取）
      let curlExample: string | undefined;

      // 如果是自定义预设，从customPresets中获取curlExample
      const customPreset = customPresets.find(p => p.id === config.api.provider);
      if (customPreset?.curlExample) {
        curlExample = customPreset.curlExample;
        // 将cURL中的占位符替换为实际的API Key
        // 支持 $ARK_API_KEY, ${ARK_API_KEY}, {{ARK_API_KEY}} 等常见占位符格式
        curlExample = curlExample
          .replace(/\$\{?ARK_API_KEY\}?/g, config.api.api_key)
          .replace(/\$\{?api_key\}?/gi, config.api.api_key)
          .replace(/\{\{ARK_API_KEY\}\}/g, config.api.api_key)
          .replace(/\{\{api_key\}\}/gi, config.api.api_key);
      }

      // 如果没有配置cURL，生成默认的cURL
      if (!curlExample) {
        curlExample = generateDefaultCurl(
          config.api.api_url,
          config.api.api_key,
          config.api.model_name,
          presetName
        );
      }
      
      const params = new URLSearchParams({
        api_url: config.api.api_url,
        api_key: config.api.api_key,
        model_name: config.api.model_name,
      });
      
      // 如果有cURL示例，添加到参数中
      if (curlExample) {
        params.append('curl_example', curlExample);
      }
      params.append('preset_name', presetName);
      
      const res = await fetch(`${API_BASE_URL}/api/providers/test?${params}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data.data);
        setShowTestResult(true);
      }
    } catch (error) {
      console.error("Test failed:", error);
      setTestResult({
        success: false,
        message: "测试请求失败，请检查网络连接",
      });
      setShowTestResult(true);
    } finally {
      setIsTestingProvider(false);
    }
  };

  // 生成默认cURL命令
  const generateDefaultCurl = (
    apiUrl: string,
    apiKey: string,
    modelName: string,
    presetName: string
  ): string => {
    return `curl ${apiUrl} \\
-H "Authorization: Bearer ${apiKey}" \\
-H 'Content-Type: application/json' \\
-d '{
    "model": "${modelName}",
    "input": [
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": "你好，${presetName}！"
                }
            ]
        }
    ]
}'`;
  };

  const handleTestService = () => {
    setIsTestingService(true);
    setTimeout(() => {
      setIsTestingService(false);
    }, 3000);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText("http://localhost:11434");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 处理预设选择
  const handleProviderChange = (value: string) => {
    const allPresets = [...BUILTIN_PRESETS, ...customPresets];
    const preset = allPresets.find((p) => p.id === value);
    if (preset) {
      setConfig({
        api: {
          ...config.api,
          provider: value,
          api_url: preset.apiUrl || '',
          // 如果预设有值就用预设的，否则清空（不使用旧值）
          api_key: preset.apiKey !== undefined ? preset.apiKey : '',
          model_name: preset.modelName !== undefined ? preset.modelName : '',
        },
      });
    }
  };

  // 创建新预设
  const handleCreatePreset = async (
    newPreset: Omit<ProviderPreset, "id" | "isCustom">,
  ) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPreset.name,
          icon: newPreset.icon,
          api_url: newPreset.apiUrl,
          api_key: newPreset.apiKey,
          model_name: newPreset.modelName,
          doc_url: newPreset.docUrl,
          curl_example: newPreset.curlExample,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          const preset: ProviderPreset = {
            id: data.data.id,
            name: data.data.name,
            icon: data.data.icon,
            apiUrl: data.data.api_url,
            apiKey: data.data.api_key,
            modelName: data.data.model_name,
            docUrl: data.data.doc_url,
            curlExample: data.data.curl_example,
            isCustom: data.data.is_custom,
          };
          // 1. 添加到自定义预设列表
          setCustomPresets([...customPresets, preset]);

          // 2. 将模型配置中的选中模型切换到新创建的模型
          const newApiConfig = {
            provider: preset.id,
            api_url: preset.apiUrl || '',
            api_key: preset.apiKey || '',
            model_name: preset.modelName || '',
          };
          setConfig({
            api: newApiConfig,
          });

          // 3. 立即保存配置到后端（确保入库）
          await saveConfig({
            ...config,
            api: newApiConfig,
          }, false);

          // 4. 更新本地缓存
          const newHash = generateConfigHash(newApiConfig);
          saveCachedModelConfig(newApiConfig, newHash);
          lastSavedConfigRef.current = JSON.stringify(newApiConfig);

          // 5. 关闭弹窗
          setIsCreateModalOpen(false);

          // 6. 重新请求后端更新前端模型配置数据
          await refreshConfigData();
        }
      }
    } catch (error) {
      console.error("Failed to create preset:", error);
    }
  };

  // 刷新配置数据（用于创建预设后更新）
  const refreshConfigData = async () => {
    try {
      const cached = loadCachedModelConfig();
      let clientHash = cached?.hash || '';

      const configRes = await fetch(`${API_BASE_URL}/api/config${clientHash ? `?hash=${clientHash}` : ''}`);
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.data) {
          // 如果后端返回hash_mismatch为true，说明需要更新配置
          if (configData.hash_mismatch) {
            // 获取所有可用预设ID
            const allPresetIds = [...BUILTIN_PRESETS.map(p => p.id), ...customPresets.map(p => p.id)];
            // 检查后端返回的provider是否有效，无效则默认使用本地模型
            const savedProvider = configData.data.api?.provider;
            const isValidProvider = savedProvider && allPresetIds.includes(savedProvider);
            const defaultProvider = isValidProvider ? savedProvider : 'local';
            // 获取默认预设的配置
            const defaultPreset = BUILTIN_PRESETS.find(p => p.id === defaultProvider);

            const newApiConfig = {
              provider: defaultProvider,
              api_url: configData.data.api?.api_url || defaultPreset?.apiUrl || '',
              api_key: configData.data.api?.api_key || '',
              model_name: configData.data.api?.model_name || '',
            };
            setConfig({
              api: newApiConfig,
              tts: configData.data.tts || config.tts,
              subtitle: configData.data.subtitle || config.subtitle,
              memory: configData.data.memory || config.memory,
              ports: configData.data.ports || config.ports,
              lan_enabled: configData.data.lan_enabled || false,
            });
            // 更新缓存
            const newHash = configData.server_hash || generateConfigHash(newApiConfig);
            saveCachedModelConfig(newApiConfig, newHash);
            lastSavedConfigRef.current = JSON.stringify(newApiConfig);
          }
        }
      }
    } catch (error) {
      console.error("Failed to refresh config data:", error);
    }
  };

  // 编辑预设
  const handleEditPreset = async (updatedPreset: ProviderPreset) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/providers/${updatedPreset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedPreset.name,
          icon: updatedPreset.icon,
          api_url: updatedPreset.apiUrl,
          api_key: updatedPreset.apiKey,
          model_name: updatedPreset.modelName,
          doc_url: updatedPreset.docUrl,
          curl_example: updatedPreset.curlExample,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setCustomPresets(
            customPresets.map((p) => (p.id === updatedPreset.id ? {
              ...updatedPreset,
              name: data.data.name,
              icon: data.data.icon,
              apiUrl: data.data.api_url,
              apiKey: data.data.api_key,
              modelName: data.data.model_name,
              docUrl: data.data.doc_url,
              curlExample: data.data.curl_example,
            } : p)),
          );
          // 如果编辑的是当前选中的预设，更新配置
          if (config.api.provider === updatedPreset.id) {
            setConfig({
              api: {
                ...config.api,
                api_url: data.data.api_url || config.api.api_url,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("Failed to update preset:", error);
    }
  };

  // 删除自定义预设
  const handleDeleteCustomPreset = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/providers/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCustomPresets(customPresets.filter((p) => p.id !== id));
        // 如果删除的是当前选中的预设，切换到本地模型
        if (config.api.provider === id) {
          const localPreset = BUILTIN_PRESETS.find(p => p.id === 'local') || BUILTIN_PRESETS[0];
          setConfig({
            api: {
              ...config.api,
              provider: localPreset.id,
              api_url: localPreset.apiUrl,
            },
          });
        }
      }
    } catch (error) {
      console.error("Failed to delete preset:", error);
    }
  };

  // 获取当前选中的预设
  const getCurrentPreset = (): ProviderPreset | null => {
    const allPresets = [...BUILTIN_PRESETS, ...customPresets];
    return allPresets.find((p) => p.id === config.api.provider) || null;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* 顶部标题和状态标签 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#6366f1] rounded-xl flex items-center justify-center shadow-md border-2 border-[#4f46e5]">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#0f172a]">控制面板</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* 模型配置状态 - 根据配置动态显示 */}
          <span
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border flex items-center gap-1.5 transition-colors duration-200",
              config.api.api_url && config.api.api_key && config.api.model_name
                ? "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]"
                : "bg-[#f8fafc] text-[#94a3b8] border-[#e2e8f0]"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                config.api.api_url && config.api.api_key && config.api.model_name
                  ? "bg-[#22c55e]"
                  : "bg-[#94a3b8]"
              )}
            />
            {config.api.api_url && config.api.api_key && config.api.model_name
              ? "模型已配置"
              : "模型未配置"}
          </span>
          <span
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border flex items-center gap-1.5 transition-colors duration-200",
              ttsEnabled
                ? "bg-[#f0f4ff] text-[#6366f1] border-[#e2e8f0]"
                : "bg-[#f8fafc] text-[#94a3b8] border-[#e2e8f0]",
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                ttsEnabled ? "bg-[#6366f1]" : "bg-[#94a3b8]",
              )}
            />
            {ttsEnabled ? "TTS 待机" : "TTS 未启用"}
          </span>
          <span className="px-3 py-1.5 bg-[#fef3c7] text-[#92400e] rounded-full text-sm font-medium border border-[#fde68a]">
            角色: 未设置
          </span>
        </div>
      </div>

      {/* Ollama 代理服务卡片 */}
      <div className="card hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#f8fafc] rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-[#64748b]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0f172a]">Ollama 代理服务</h3>
              <p className="text-sm text-[#64748b]">
                在 11434 端口提供 Ollama 兼容 API
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium border transition-colors duration-200",
                isServiceRunning
                  ? "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]"
                  : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]",
              )}
            >
              <span
                className={cn(
                  "inline-block w-1.5 h-1.5 rounded-full mr-1.5",
                  isServiceRunning
                    ? "bg-[#22c55e] animate-pulse"
                    : "bg-[#94a3b8]",
                )}
              />
              {isServiceRunning ? "已启动" : "已停止"}
            </span>
            <button
              onClick={() => setIsServiceRunning(!isServiceRunning)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                isServiceRunning
                  ? "bg-[#f59e0b] hover:bg-[#d97706] text-white"
                  : "bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-md hover:shadow-lg",
              )}
            >
              {isServiceRunning ? (
                <>
                  <Pause className="w-4 h-4" /> 停止服务
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> 启动服务
                </>
              )}
            </button>
            <button
              onClick={handleTestService}
              disabled={isTestingService}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] hover:border-[#94a3b8] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <TestTube
                className={cn("w-4 h-4", isTestingService && "animate-spin")}
              />
              测试
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <span className="text-sm text-[#64748b]">外部应用访问地址:</span>
          <div className="flex-1 bg-[#f8fafc] rounded-lg px-4 py-2 text-[#334155] font-mono text-sm border border-[#e2e8f0]">
            http://localhost:11434
          </div>
          <button
            onClick={handleCopy}
            className="p-2 text-[#94a3b8] hover:text-[#6366f1] transition-colors duration-200"
          >
            {copied ? (
              <Check className="w-5 h-5 text-[#22c55e]" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* API 配置和语音合成 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 模型配置卡片 */}
        <div className="card hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-[#6366f1]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0f172a]">模型配置</h3>
                <p className="text-sm text-[#64748b]">
                  配置 LLM 模型服务商、接口地址和密钥
                </p>
              </div>
            </div>
            {/* 配置同步状态指示器 - 右上角 */}
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300",
                saveStatus === 'saving' && "bg-[#f0f4ff] text-[#6366f1]",
                saveStatus === 'saved' && "bg-[#f0fdf4] text-[#166534]",
                saveStatus === 'error' && "bg-[#fef2f2] text-[#dc2626]",
                saveStatus === 'idle' && "bg-[#f8fafc] text-[#94a3b8]"
              )}
            >
              {saveStatus === 'saving' && (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>保存中...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check className="w-3 h-3" />
                  <span>已自动保存</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <X className="w-3 h-3" />
                  <span>保存失败</span>
                </>
              )}
              {saveStatus === 'idle' && (
                <>
                  <Check className="w-3 h-3" />
                  <span>配置已同步</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[#334155]">
                  服务商预设
                </label>
                {customPresets.some((p) => p.id === config.api.provider) && (
                  <button
                    onClick={() =>
                      handleDeleteCustomPreset(config.api.provider)
                    }
                    className="flex items-center gap-1 text-xs text-[#ef4444] hover:text-[#dc2626] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除预设
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <PresetSelect
                    value={config.api.provider}
                    onChange={handleProviderChange}
                    builtinPresets={BUILTIN_PRESETS}
                    customPresets={customPresets}
                    onCreateNew={() => setIsCreateModalOpen(true)}
                    onDeleteCustom={handleDeleteCustomPreset}
                  />
                </div>
                <button
                  onClick={handleTestProvider}
                  disabled={isTestingProvider}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#64748b] border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] hover:border-[#94a3b8] transition-all duration-200 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                  title="测试连接"
                >
                  {isTestingProvider ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4" />
                  )}
                  测试
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">
                模型URL
              </label>
              <input
                type="text"
                className="input focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                placeholder="https://api.example.com/v1"
                value={config.api.api_url}
                onChange={(e) =>
                  setConfig({ api: { ...config.api, api_url: e.target.value } })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  autoComplete="new-password"
                  className="input pr-10 focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                  placeholder="sk-..."
                  value={config.api.api_key}
                  onChange={(e) =>
                    setConfig({
                      api: { ...config.api, api_key: e.target.value },
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] transition-colors duration-200"
                >
                  {showApiKey ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#334155] mb-1.5">
                  模型名称
                </label>
                <input
                  type="text"
                  className="input focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                  placeholder="gpt-4"
                  value={config.api.model_name}
                  onChange={(e) =>
                    setConfig({
                      api: { ...config.api, model_name: e.target.value },
                    })
                  }
                />
              </div>
              <div className="flex gap-2 mt-7">
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-2 border border-[#e2e8f0] rounded-lg hover:bg-[#f0f4ff] hover:border-[#6366f1] hover:text-[#6366f1] transition-all duration-200"
                  title="配置预设"
                >
                  <Settings className="w-4 h-4 text-[#64748b] hover:text-[#6366f1]" />
                </button>
              </div>
            </div>

            {/* 测试结果展示 */}
            {showTestResult && testResult && (
              <div className={cn(
                "p-3 rounded-lg text-sm",
                testResult.success
                  ? "bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]"
                  : "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
              )}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  <span>
                    {testResult.success && testResult.latency_ms
                      ? `连接成功，测试耗时 ${(testResult.latency_ms / 1000).toFixed(2)}s`
                      : testResult.message}
                  </span>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 语音合成卡片 */}
        <div className="card hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-[#6366f1]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0f172a]">语音合成</h3>
              </div>
            </div>
            <Switch checked={ttsEnabled} onChange={setTtsEnabled} />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-2">
                选择引擎
              </label>
              <div className="flex gap-2">
                <button className="flex-1 py-2 px-4 border border-[#e2e8f0] rounded-lg text-sm text-[#64748b] hover:border-[#6366f1] hover:text-[#6366f1] hover:bg-[#f0f4ff] flex items-center justify-center gap-2 transition-all duration-200">
                  <Settings className="w-4 h-4" />
                  GPT-SoVITS
                </button>
                <button className="px-4 py-2 border border-dashed border-[#e2e8f0] rounded-lg text-sm text-[#94a3b8] hover:border-[#6366f1] hover:text-[#6366f1] transition-all duration-200 flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  待添加
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-[#334155]">角色配置</p>
              <div className="space-y-2">
                {["全局默认", "男性默认", "女性默认"].map((role, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-[#64748b]">{role}</span>
                    <Select
                      className="flex-1"
                      value=""
                      onChange={() => {}}
                      options={[{ value: "", label: "选择角色" }]}
                      placeholder="选择角色"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#334155]">音量</span>
                <span className="text-sm text-[#6366f1] font-medium">
                  {Math.round(config.tts.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.tts.volume}
                onChange={(e) =>
                  setConfig({
                    tts: { ...config.tts, volume: parseFloat(e.target.value) },
                  })
                }
                className="w-full accent-[#6366f1] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-[#64748b]">自动播放语音</span>
              <Switch checked={autoPlayEnabled} onChange={setAutoPlayEnabled} />
            </div>
          </div>
        </div>
      </div>

      {/* 局域网开放 */}
      <div className="card hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#6366f1]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#0f172a]">局域网开放</h3>
            <p className="text-sm text-[#64748b]">
              开启后服务绑定
              0.0.0.0，允许局域网内其他设备（如手机、平板）通过本机 IP 访问。
              <span className="text-[#f59e0b]">
                修改后需重启代理服务器生效。
              </span>
            </p>
          </div>
          <Switch checked={lanEnabled} onChange={setLanEnabled} />
        </div>
      </div>

      {/* Antigravity 自动化桥接 */}
      <div className="card hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#6366f1]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#0f172a]">
              Antigravity 自动化桥接{" "}
              <span className="text-xs text-[#f59e0b] font-normal">
                (实验性功能)
              </span>
            </h3>
            <p className="text-sm text-[#64748b]">
              开启后将不再走 API，改为 UI 自动化桥接
            </p>
          </div>
          <Switch
            checked={antigravityEnabled}
            onChange={setAntigravityEnabled}
          />
        </div>
      </div>

      {/* 辅助模型 */}
      <div className="card hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#f0fdf4] rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#22c55e]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#0f172a]">辅助模型</h3>
            <p className="text-sm text-[#64748b]">
              简单场景自动切换到低成本模型
            </p>
          </div>
          <Switch checked={auxModelEnabled} onChange={setAuxModelEnabled} />
        </div>
      </div>

      {/* 系统提示词 / AI 助手 */}
      <div className="card hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePromptTab("system")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                activePromptTab === "system"
                  ? "bg-[#6366f1] text-white shadow-md"
                  : "text-[#64748b] hover:bg-[#f8fafc]",
              )}
            >
              <Bot className="w-4 h-4" />
              系统提示词
            </button>
            <button
              onClick={() => setActivePromptTab("assistant")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                activePromptTab === "assistant"
                  ? "bg-[#6366f1] text-white shadow-md"
                  : "text-[#64748b] hover:bg-[#f8fafc]",
              )}
            >
              <Sparkles className="w-4 h-4" />
              AI 助手
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] hover:border-[#94a3b8] transition-all duration-200">
              <Trash2 className="w-4 h-4" />
              清空
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-[#6366f1] rounded-lg hover:bg-[#4f46e5] hover:shadow-md transition-all duration-200">
              <Save className="w-4 h-4" />
              保存
            </button>
          </div>
        </div>

        {activePromptTab === "system" ? (
          <div className="relative">
            <textarea
              className="input min-h-[200px] resize-none focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
              placeholder="在此输入系统角色设定..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
            <div className="absolute bottom-3 right-3 text-xs text-[#94a3b8]">
              {systemPrompt.length} 字符
            </div>
          </div>
        ) : (
          <AIAssistantChat />
        )}
      </div>

      {/* 新建预设弹窗 */}
      <CreatePresetModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreatePreset}
      />

      {/* 编辑预设弹窗 */}
      <EditPresetModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        preset={getCurrentPreset()}
        onSave={handleEditPreset}
      />
    </div>
  );
};

// AI 助手聊天组件
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const AIAssistantChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "你好呀～我是星野，是 AI Voice Bridge 的虚拟助手。我可以将文字变成有感情的声音，还能理解你说的话哦！有什么想聊的吗？",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState<{
    configured: boolean;
    error?: string;
    checked: boolean;
  }>({ configured: false, checked: false });
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 检查模型配置状态
  React.useEffect(() => {
    const checkModelStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/ai-assistant/status`);
        if (response.ok) {
          const result = await response.json();
          setModelStatus({
            configured: result.data?.model_configured || false,
            error: result.data?.error_message || undefined,
            checked: true,
          });
        }
      } catch (error) {
        console.error("Failed to check model status:", error);
        setModelStatus({ configured: false, error: "无法连接到服务", checked: true });
      }
    };

    // 立即检查一次
    checkModelStatus();

    // 每 5 秒轮询检查配置状态
    const intervalId = setInterval(checkModelStatus, 5000);

    // 窗口获得焦点时也检查一次
    const handleFocus = () => {
      checkModelStatus();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // 加载历史聊天记录
  React.useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/ai-assistant/history`);
        if (response.ok) {
          const result = await response.json();
          if (result.data?.messages?.length > 0) {
            const historyMessages = result.data.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.timestamp),
            }));
            setMessages([
              {
                id: "1",
                role: "assistant",
                content:
                  "你好呀～我是星野，是 AI Voice Bridge 的虚拟助手。我可以将文字变成有感情的声音，还能理解你说的话哦！有什么想聊的吗？",
                timestamp: new Date(),
              },
              ...historyMessages,
            ]);
          }
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    };
    loadHistory();
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    // 检查模型是否已配置
    if (!modelStatus.configured) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `⚠️ 模型未配置\n\n${modelStatus.error || "请先前往控制面板的「模型配置」区域，配置 API 地址、API Key 和模型名称后再试。"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setInputValue("");
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai-assistant/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: userMessage.id,
          content: userMessage.content,
        }),
      });

      const result = await response.json();

      // 处理模型未配置的情况
      if (result.code === 400 && result.data?.configured === false) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `⚠️ 模型未配置\n\n${result.data?.error || "请先前往控制面板的「模型配置」区域，配置 API 地址、API Key 和模型名称后再试。"}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        // 更新模型状态
        setModelStatus({
          configured: false,
          error: result.data?.error,
          checked: true,
        });
        return;
      }

      if (response.ok && result.data?.message) {
        const assistantMessage: Message = {
          id: result.data.message.id,
          role: result.data.message.role,
          content: result.data.message.content,
          timestamp: new Date(result.data.message.timestamp),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(result.message || "Failed to get response");
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "抱歉，与服务端通信时发生错误。请检查网络连接或 API 配置。",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (message: Message) => {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerate = async (messageId: string) => {
    // 找到该 AI 消息对应的用户消息
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex <= 0) return;

    // 获取对应用户消息的内容
    let userMessage: Message | null = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMessage = messages[i];
        break;
      }
    }

    if (!userMessage) return;

    // 删除该 AI 消息
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai-assistant/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: Date.now().toString(),
          content: userMessage.content,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data?.message) {
          const assistantMessage: Message = {
            id: result.data.message.id,
            role: result.data.message.role,
            content: result.data.message.content,
            timestamp: new Date(result.data.message.timestamp),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      }
    } catch (error) {
      console.error("Regenerate error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayVoice = (message: Message) => {
    // 播放语音功能占位
    console.log("播放语音:", message.content);
  };

  // 判断是否为最后一条 AI 消息
  const getLastAssistantMessageId = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return messages[i].id;
      }
    }
    return null;
  };

  const lastAssistantId = getLastAssistantMessageId();

  return (
    <div className="flex flex-col h-[400px]">
      {/* 模型未配置提示卡片 */}
      {modelStatus.checked && !modelStatus.configured && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-800 mb-1">AI 模型未配置</h4>
              <p className="text-xs text-amber-700 mb-2">
                {modelStatus.error || "请先配置模型信息后再使用 AI 助手功能"}
              </p>
              <p className="text-xs text-amber-600">
                请前往控制面板的「模型配置」区域，设置 API 地址、API Key 和模型名称
              </p>
            </div>
          </div>
        </div>
      )}
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((message) => {
          const isLastAssistant =
            message.id === lastAssistantId && message.role === "assistant";
          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "flex-row-reverse" : "flex-row",
              )}
            >
              {/* 头像 */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  message.role === "user"
                    ? "bg-[#6366f1]"
                    : "bg-gradient-to-br from-[#fbbf24] to-[#f59e0b]",
                )}
              >
                {message.role === "user" ? (
                  <span className="text-white text-sm font-medium">我</span>
                ) : (
                  <Sparkles className="w-4 h-4 text-white" />
                )}
              </div>

              {/* 消息内容 */}
              <div className="flex flex-col gap-1.5 max-w-[70%]">
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-2xl text-sm",
                    message.role === "user"
                      ? "bg-[#6366f1] text-white rounded-tr-sm"
                      : "bg-[#f8fafc] text-[#334155] border border-[#e2e8f0] rounded-tl-sm",
                  )}
                >
                  {message.content}
                </div>

                {/* 最后一条 AI 消息的操作按钮 */}
                {isLastAssistant && (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => handlePlayVoice(message)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#6366f1] bg-[#f0f4ff] rounded-lg hover:bg-[#6366f1] hover:text-white transition-all duration-200"
                    >
                      <Play className="w-3 h-3" />
                      播放语音
                    </button>
                    <button
                      onClick={() => handleRegenerate(message.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg hover:border-[#6366f1] hover:text-[#6366f1] transition-all duration-200"
                    >
                      <RefreshCw className="w-3 h-3" />
                      重新生成
                    </button>
                    <button
                      onClick={() => handleCopy(message)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg hover:border-[#6366f1] hover:text-[#6366f1] transition-all duration-200"
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check className="w-3 h-3 text-[#22c55e]" />
                          <span className="text-[#22c55e]">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          复制
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading || (modelStatus.checked && !modelStatus.configured)}
          placeholder={
            isLoading
              ? "AI 正在思考中..."
              : modelStatus.checked && !modelStatus.configured
              ? "请先配置 AI 模型..."
              : "输入消息，或按住空格键说话..."
          }
          className={cn(
            "w-full pl-4 pr-24 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200",
            (isLoading || (modelStatus.checked && !modelStatus.configured)) && "opacity-60 cursor-not-allowed"
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button className="p-2 text-[#94a3b8] hover:text-[#6366f1] transition-colors duration-200">
            <Volume2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              "p-2 rounded-lg transition-all duration-200",
              inputValue.trim() && !isLoading
                ? "bg-[#6366f1] text-white hover:bg-[#4f46e5]"
                : "bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed",
            )}
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
