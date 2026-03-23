import React, { useState } from 'react';
import { Mic, MicOff, Volume2, Play, Pause, Plus, Trash2, Save, Settings, User, Folder, MessageSquare } from 'lucide-react';
import { useAppStore } from '../store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Switch } from '../components';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const VoiceConfig: React.FC = () => {
  const { config, setConfig } = useAppStore();
  const [activeTab, setActiveTab] = useState<'tts' | 'asr'>('tts');
  const [activeEngine, setActiveEngine] = useState('gptsovits');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [saveAudioEnabled, setSaveAudioEnabled] = useState(true);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#0f172a] mb-2">
          语音配置
        </h1>
        <p className="text-[#64748b] text-sm">
          打造个性化的语音交互体验，支持多种高性能合成引擎。
        </p>
      </div>

      <div className="flex bg-white rounded-xl p-1 border border-[#e2e8f0] shadow-sm w-fit">
        <button
          onClick={() => setActiveTab('tts')}
          className={cn(
            'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === 'tts'
              ? 'bg-[#6366f1] text-white shadow-md'
              : 'text-[#64748b] hover:text-[#334155] hover:bg-[#f8fafc]'
          )}
        >
          <Volume2 className="w-4 h-4" />
          语音合成 (TTS)
        </button>
        <button
          onClick={() => setActiveTab('asr')}
          className={cn(
            'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === 'asr'
              ? 'bg-[#6366f1] text-white shadow-md'
              : 'text-[#64748b] hover:text-[#334155] hover:bg-[#f8fafc]'
          )}
        >
          <Mic className="w-4 h-4" />
          语音输入 (ASR)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-[#6366f1]" />
              </div>
              <h3 className="font-semibold text-[#0f172a]">全局控制</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#334155]">启用 TTS 输出</p>
                  <p className="text-xs text-[#64748b]">开启后将朗读 AI 回复</p>
                </div>
                <Switch checked={ttsEnabled} onChange={setTtsEnabled} />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-[#64748b]">自动播放</span>
                <Switch checked={autoPlayEnabled} onChange={setAutoPlayEnabled} />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-[#64748b]">保存音频文件</span>
                <Switch checked={saveAudioEnabled} onChange={setSaveAudioEnabled} />
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-[#334155] mb-2">播放模式</label>
                <select className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200">
                  <option>只播放对话 (Dialog Only)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-[#6366f1]" />
              </div>
              <h3 className="font-semibold text-[#0f172a]">混音控制</h3>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-[#334155]">主音量</label>
                  <span className="text-xs bg-[#f0f4ff] px-2 py-1 rounded text-[#6366f1]">{Math.round(config.tts.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.tts.volume}
                  onChange={(e) => setConfig({ tts: { ...config.tts, volume: parseFloat(e.target.value) } })}
                  className="w-full accent-[#6366f1]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-2.5 px-4 text-sm text-[#ef4444] bg-[#fef2f2] rounded-xl hover:bg-[#fee2e2] transition-all duration-200 flex items-center justify-center gap-2">
                  <MicOff className="w-4 h-4" />
                  停止播放
                </button>
                <button className="flex-1 py-2.5 px-4 text-sm text-[#64748b] border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] transition-all duration-200">
                  空闲
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-3">
            <button
              onClick={() => setActiveEngine('gptsovits')}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border',
                activeEngine === 'gptsovits'
                  ? 'border-[#6366f1] bg-[#f0f4ff] text-[#6366f1] shadow-sm'
                  : 'border-transparent text-[#64748b] hover:text-[#334155] hover:bg-[#f8fafc]'
              )}
            >
              GPT-SoVITS
            </button>
            <button
              onClick={() => setActiveEngine('xunfei')}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border',
                activeEngine === 'xunfei'
                  ? 'border-[#6366f1] bg-[#f0f4ff] text-[#6366f1] shadow-sm'
                  : 'border-transparent text-[#64748b] hover:text-[#334155] hover:bg-[#f8fafc]'
              )}
            >
              讯飞语音
            </button>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-[#6366f1]" />
              </div>
              <h3 className="font-semibold text-[#0f172a]">连接设置</h3>
              <div className="ml-auto">
                <span className="px-3 py-1 bg-[#f0f4ff] text-[#6366f1] rounded-full text-xs font-medium border border-[#e2e8f0]">
                  未检测
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#334155] mb-2">API</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                  value="http://localhost:9880/tts"
                />
              </div>
              <button className="mt-7 px-6 py-2.5 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] hover:shadow-md transition-all duration-200">
                测试
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-[#6366f1]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0f172a]">角色音色管理</h3>
                <p className="text-xs text-[#64748b]">配置精调模型和参考音频以克隆目标声线</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-2">当前角色</label>
                <select className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200">
                  <option>选择角色</option>
                </select>
              </div>

              <div className="bg-[#f8fafc] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-24 text-sm text-[#64748b]">角色名称</span>
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" placeholder="Display Name" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-sm text-[#64748b]">参考音频目录</span>
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" />
                  <button className="p-2.5 border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] transition-all duration-200">
                    <Folder className="w-4 h-4 text-[#94a3b8]" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-sm text-[#64748b]">情感音频配置</span>
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" />
                  <button className="p-2.5 border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] transition-all duration-200">
                    <Folder className="w-4 h-4 text-[#94a3b8]" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-sm text-[#64748b]">GPT模型路径</span>
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" />
                  <button className="p-2.5 border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] transition-all duration-200">
                    <Folder className="w-4 h-4 text-[#94a3b8]" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 py-2.5 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] hover:shadow-md transition-all duration-200">
              <Plus className="w-4 h-4" />
              添加角色
            </button>
            <button className="flex items-center justify-center gap-2 py-2.5 text-[#6366f1] bg-[#f0f4ff] border border-[#6366f1]/20 rounded-xl font-medium hover:bg-[#e0e7ff] transition-all duration-200">
              <Save className="w-4 h-4" />
              保存
            </button>
            <button className="flex items-center justify-center gap-2 py-2.5 text-[#ef4444] bg-[#fef2f2] border border-[#ef4444]/20 rounded-xl font-medium hover:bg-[#fee2e2] transition-all duration-200">
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-[#6366f1]" />
                </div>
                <h3 className="font-semibold text-[#0f172a]">推理参数配置</h3>
              </div>
              <button className="px-3 py-1.5 bg-[#0f172a] text-white text-sm rounded-lg hover:bg-[#334155] transition-all duration-200">
                应用参数
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-[#64748b] mb-1">top_k</label>
                <div className="flex items-center gap-2">
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="40" />
                  <span className="text-xs text-[#94a3b8]">top_p</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#64748b] mb-1"></label>
                <div className="flex items-center gap-2">
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="0.9" />
                  <span className="text-xs text-[#94a3b8]">temp</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#64748b] mb-1"></label>
                <div className="flex items-center gap-2">
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="1.3" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-[#6366f1]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0f172a]">参考音频配置</h3>
                <p className="text-xs text-[#64748b]">(设置太多可能导致速度变慢)</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-[#64748b] mb-1">最少音频数</label>
                <input type="text" className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="2" />
              </div>
              <div>
                <label className="block text-xs text-[#64748b] mb-1">最多音频数</label>
                <input type="text" className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="3" />
              </div>
              <div>
                <label className="block text-xs text-[#64748b] mb-1">情感阈值</label>
                <input type="text" className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="0.3" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[#6366f1]" />
              </div>
              <h3 className="font-semibold text-[#0f172a]">语音合成测试</h3>
              <p className="text-sm text-[#64748b]">输入文本并选择情感进行语音合成测试</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-2">测试文本</label>
                <textarea className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl min-h-[100px] text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" placeholder="你好，这是一段语音合成测试。" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">情感</label>
                  <select className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200">
                    <option>平静 (calm)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#334155] mb-2">使用角色</label>
                  <select className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200">
                    <option>当前选中角色</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] hover:shadow-md transition-all duration-200">
                  <Play className="w-4 h-4" />
                  合成并播放
                </button>
                <button className="px-6 py-3 text-[#ef4444] bg-[#fef2f2] border border-[#ef4444]/20 rounded-xl font-medium hover:bg-[#fee2e2] transition-all duration-200">
                  停止
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
