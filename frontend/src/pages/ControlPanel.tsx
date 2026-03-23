import React, { useState } from 'react';
import { Play, Pause, Eye, EyeOff, Copy, Check, Settings, Volume2, Plus, RefreshCw, Globe, Bot, Zap, Trash2, Save, Sparkles } from 'lucide-react';
import { useAppStore } from '../store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 自定义开关组件
interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled }) => {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative w-12 h-6 rounded-full transition-all duration-300 ease-in-out',
        checked ? 'bg-[#6366f1]' : 'bg-[#e2e8f0]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div
        className={cn(
          'absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ease-in-out',
          checked ? 'left-7' : 'left-1'
        )}
      />
    </button>
  );
};

// 自定义下拉选择框
interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select: React.FC<SelectProps> = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2.5 bg-white border rounded-xl text-sm transition-all duration-200',
          isOpen 
            ? 'border-[#6366f1] ring-2 ring-[#6366f1]/10' 
            : 'border-[#e2e8f0] hover:border-[#94a3b8]'
        )}
      >
        <span className={selectedOption ? 'text-[#334155]' : 'text-[#94a3b8]'}>
          {selectedOption?.label || placeholder || '请选择'}
        </span>
        <svg
          className={cn(
            'w-4 h-4 text-[#94a3b8] transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-1 bg-white border border-[#e2e8f0] rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-sm transition-colors duration-150',
                  value === option.value
                    ? 'bg-[#f0f4ff] text-[#6366f1]'
                    : 'text-[#334155] hover:bg-[#f8fafc]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
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
  const [activePromptTab, setActivePromptTab] = useState<'system' | 'assistant'>('system');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [assistantPrompt, setAssistantPrompt] = useState('');

  const handleCopy = async () => {
    await navigator.clipboard.writeText('http://localhost:8501');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const providerOptions = [
    { value: 'custom', label: '自定义 (Custom)' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'azure', label: 'Azure OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* 顶部标题和状态标签 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0f172a]">
            控制面板
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 bg-[#f0fdf4] text-[#166534] rounded-full text-sm font-medium border border-[#bbf7d0] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full" />
            API 已配置
          </span>
          <span className="px-3 py-1.5 bg-[#f0f4ff] text-[#6366f1] rounded-full text-sm font-medium border border-[#e2e8f0]">
            TTS 待机
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
              <p className="text-sm text-[#64748b]">在 8501 端口提供 Ollama 兼容 API</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              'px-3 py-1 rounded-full text-sm font-medium border transition-colors duration-200',
              isServiceRunning
                ? 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]'
                : 'bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]'
            )}>
              <span className={cn(
                'inline-block w-1.5 h-1.5 rounded-full mr-1.5',
                isServiceRunning ? 'bg-[#22c55e] animate-pulse' : 'bg-[#94a3b8]'
              )} />
              {isServiceRunning ? '已启动' : '已停止'}
            </span>
            <button
              onClick={() => setIsServiceRunning(!isServiceRunning)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200',
                isServiceRunning
                  ? 'bg-[#f59e0b] hover:bg-[#d97706] text-white'
                  : 'bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-md hover:shadow-lg'
              )}
            >
              {isServiceRunning ? <><Pause className="w-4 h-4" /> 停止服务</> : <><Play className="w-4 h-4" /> 启动服务</>}
            </button>
            <button className="px-3 py-2 text-sm text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] hover:border-[#94a3b8] transition-all duration-200">
              测试
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <span className="text-sm text-[#64748b]">外部应用访问地址:</span>
          <div className="flex-1 bg-[#f8fafc] rounded-lg px-4 py-2 text-[#334155] font-mono text-sm border border-[#e2e8f0]">
            http://localhost:8501
          </div>
          <button
            onClick={handleCopy}
            className="p-2 text-[#94a3b8] hover:text-[#6366f1] transition-colors duration-200"
          >
            {copied ? <Check className="w-5 h-5 text-[#22c55e]" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* API 配置和语音合成 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API 配置卡片 */}
        <div className="card hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-[#6366f1]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0f172a]">API 配置</h3>
              <p className="text-sm text-[#64748b]">设置 LLM API 接口地址和密钥</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">服务商预设</label>
              <Select
                value={config.api.provider}
                onChange={(value) => setConfig({ api: { ...config.api, provider: value } })}
                options={providerOptions}
                placeholder="选择服务商"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">API URL</label>
              <input
                type="text"
                className="input focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                placeholder="https://api.example.com/v1"
                value={config.api.api_url}
                onChange={(e) => setConfig({ api: { ...config.api, api_url: e.target.value } })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="input pr-10 focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                  placeholder="sk-..."
                  value={config.api.api_key}
                  onChange={(e) => setConfig({ api: { ...config.api, api_key: e.target.value } })}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] transition-colors duration-200"
                >
                  {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#334155] mb-1.5">模型名称</label>
                <input
                  type="text"
                  className="input focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
                  placeholder="gpt-4"
                  value={config.api.model_name}
                  onChange={(e) => setConfig({ api: { ...config.api, model_name: e.target.value } })}
                />
              </div>
              <div className="flex gap-2 mt-7">
                <button className="p-2 border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] hover:border-[#94a3b8] transition-all duration-200">
                  <RefreshCw className="w-4 h-4 text-[#64748b]" />
                </button>
                <button className="p-2 border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] hover:border-[#94a3b8] transition-all duration-200">
                  <Copy className="w-4 h-4 text-[#64748b]" />
                </button>
              </div>
            </div>
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
              <label className="block text-sm font-medium text-[#334155] mb-2">选择引擎</label>
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
                {['全局默认', '男性默认', '女性默认'].map((role, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-[#64748b]">{role}</span>
                    <select className="input flex-1 text-sm">
                      <option>选择角色</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#334155]">音量</span>
                <span className="text-sm text-[#6366f1] font-medium">{Math.round(config.tts.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.tts.volume}
                onChange={(e) => setConfig({ tts: { ...config.tts, volume: parseFloat(e.target.value) } })}
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
            <p className="text-sm text-[#64748b]">开启后服务绑定 0.0.0.0，允许局域网内其他设备（如手机、平板）通过本机 IP 访问。<span className="text-[#f59e0b]">修改后需重启代理服务器生效。</span></p>
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
            <h3 className="font-semibold text-[#0f172a]">Antigravity 自动化桥接 <span className="text-xs text-[#f59e0b] font-normal">(实验性功能)</span></h3>
            <p className="text-sm text-[#64748b]">开启后将不再走 API，改为 UI 自动化桥接</p>
          </div>
          <Switch checked={antigravityEnabled} onChange={setAntigravityEnabled} />
        </div>
      </div>

      {/* 辅助模型 */}
      <div className="card hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#6366f1]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#0f172a]">辅助模型</h3>
            <p className="text-sm text-[#64748b]">简单场景自动切换到低成本模型</p>
          </div>
          <Switch checked={auxModelEnabled} onChange={setAuxModelEnabled} />
        </div>
      </div>

      {/* 系统提示词 / AI 助手 */}
      <div className="card hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePromptTab('system')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                activePromptTab === 'system'
                  ? 'bg-[#6366f1] text-white shadow-md'
                  : 'text-[#64748b] hover:bg-[#f8fafc]'
              )}
            >
              <Bot className="w-4 h-4" />
              系统提示词
            </button>
            <button
              onClick={() => setActivePromptTab('assistant')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                activePromptTab === 'assistant'
                  ? 'bg-[#6366f1] text-white shadow-md'
                  : 'text-[#64748b] hover:bg-[#f8fafc]'
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

        <div className="relative">
          <textarea
            className="input min-h-[200px] resize-none focus:ring-2 focus:ring-[#6366f1]/10 focus:border-[#6366f1] transition-all duration-200"
            placeholder={activePromptTab === 'system' ? '在此输入系统角色设定...' : '在此输入 AI 助手设定...'}
            value={activePromptTab === 'system' ? systemPrompt : assistantPrompt}
            onChange={(e) => activePromptTab === 'system' ? setSystemPrompt(e.target.value) : setAssistantPrompt(e.target.value)}
          />
          <div className="absolute bottom-3 right-3 text-xs text-[#94a3b8]">
            {activePromptTab === 'system' ? systemPrompt.length : assistantPrompt.length} 字符
          </div>
        </div>
      </div>
    </div>
  );
};
