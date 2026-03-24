import React, { useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Play, Pause, Plus, Trash2, Save, Settings, User, Folder, MessageSquare, Keyboard, AlertCircle, ExternalLink } from 'lucide-react';
import { useAppStore } from '../store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Switch, Select } from '../components';

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
  const [mixEnabled, setMixEnabled] = useState(false); // 混音播放状态，默认停用

  // ASR 状态
  const [asrEnabled, setAsrEnabled] = useState(false);
  const [shortcut, setShortcut] = useState('Ctrl+Shift+,');
  const [pasteMode, setPasteMode] = useState('direct');
  const [baiduAppId, setBaiduAppId] = useState('');
  const [baiduApiKey, setBaiduApiKey] = useState('');
  const [baiduSecretKey, setBaiduSecretKey] = useState('');
  const [xunfeiAppId, setXunfeiAppId] = useState('');
  const [xunfeiApiKey, setXunfeiApiKey] = useState('');
  const [xunfeiApiSecret, setXunfeiApiSecret] = useState('');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0f172a] mb-2">
            语音配置
          </h1>
          <p className="text-[#64748b] text-sm">
            打造个性化的语音交互体验，支持多种高性能合成引擎。
          </p>
        </div>

        <div className="flex bg-white rounded-xl p-1 border border-[#e2e8f0] shadow-sm w-fit gap-2">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {activeTab === 'tts' ? (
          <>
            {/* TTS 左侧栏 */}
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
                    <Select
                      value="dialog"
                      onChange={() => {}}
                      options={[
                        { value: 'dialog', label: '只播放对话 (Dialog Only)' },
                        { value: 'full', label: '播放全文 (Full Text)' }
                      ]}
                      placeholder="选择播放模式"
                    />
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
                    <button
                      onClick={() => setMixEnabled(!mixEnabled)}
                      className={cn(
                        'flex-1 py-2.5 px-4 text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2',
                        mixEnabled
                          ? 'text-[#22c55e] bg-[#f0fdf4] hover:bg-[#dcfce7]'
                          : 'text-[#ef4444] bg-[#fef2f2] hover:bg-[#fee2e2]'
                      )}
                    >
                      {mixEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      {mixEnabled ? '启用播放' : '停用播放'}
                    </button>
                    <button className="flex-1 py-2.5 px-4 text-sm text-[#64748b] border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] transition-all duration-200">
                      空闲
                    </button>
                  </div>
                </div>
              </div>

              {/* 语音合成测试 - 移到左侧栏 */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-[#6366f1]" />
                  </div>
                  <h3 className="font-semibold text-[#0f172a]">语音合成测试</h3>
                </div>
                <p className="text-xs text-[#64748b] mb-4">输入文本并选择情感进行语音合成测试</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">测试文本</label>
                    <textarea className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl min-h-[80px] text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" placeholder="你好，这是一段语音合成测试。" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">情感</label>
                      <Select
                        value="calm"
                        onChange={() => {}}
                        options={[{ value: 'calm', label: '平静 (calm)' }]}
                        placeholder="选择情感"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">使用角色</label>
                      <Select
                        value="current"
                        onChange={() => {}}
                        options={[{ value: 'current', label: '当前选中角色' }]}
                        placeholder="选择角色"
                      />
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

            {/* TTS 右侧栏 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex bg-white rounded-xl p-1 border border-[#e2e8f0] shadow-sm w-full gap-2">
                <button
                  onClick={() => setActiveEngine('gptsovits')}
                  className={cn(
                    'flex-1 py-2.5 px-6 rounded-lg text-sm font-medium transition-all duration-200',
                    activeEngine === 'gptsovits'
                      ? 'bg-[#6366f1] text-white shadow-md'
                      : 'text-[#64748b] hover:text-[#334155] hover:bg-[#f8fafc]'
                  )}
                >
                  GPT-SoVITS
                </button>
                <button
                  onClick={() => setActiveEngine('xunfei')}
                  className={cn(
                    'flex-1 py-2.5 px-6 rounded-lg text-sm font-medium transition-all duration-200',
                    activeEngine === 'xunfei'
                      ? 'bg-[#6366f1] text-white shadow-md'
                      : 'text-[#64748b] hover:text-[#334155] hover:bg-[#f8fafc]'
                  )}
                >
                  讯飞语音
                </button>
              </div>

              {activeEngine === 'gptsovits' ? (
                <>
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
                        <Select
                          value=""
                          onChange={() => {}}
                          options={[{ value: '', label: '选择角色' }]}
                          placeholder="选择角色"
                        />
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

                  <div className="grid grid-cols-3 gap-4">
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

                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">top_k</label>
                          <span className="text-xs text-[#94a3b8]">40</span>
                        </div>
                        <input type="text" className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="40" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">top_p</label>
                          <span className="text-xs text-[#94a3b8]">0.9</span>
                        </div>
                        <input type="text" className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="0.9" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">temp</label>
                          <span className="text-xs text-[#94a3b8]">1.3</span>
                        </div>
                        <input type="text" className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="1.3" />
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

                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">最少音频数</label>
                          <span className="text-xs text-[#94a3b8]">2</span>
                        </div>
                        <input type="text" className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="2" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">最多音频数</label>
                          <span className="text-xs text-[#94a3b8]">3</span>
                        </div>
                        <input type="text" className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="3" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">情感阈值</label>
                          <span className="text-xs text-[#94a3b8]">30%</span>
                        </div>
                        <input type="text" className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200" value="0.3" />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* 讯飞语音配置 */
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                      <Volume2 className="w-5 h-5 text-[#6366f1]" />
                    </div>
                    <h3 className="font-semibold text-[#0f172a]">讯飞语音配置</h3>
                  </div>

                  <div className="bg-[#f8fafc] rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="w-20 text-sm text-[#64748b]">APP ID</span>
                      <input
                        type="text"
                        className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                        placeholder=""
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="w-20 text-sm text-[#64748b]">API Key</span>
                      <input
                        type="text"
                        className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                        placeholder=""
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="w-20 text-sm text-[#64748b]">API Secret</span>
                      <input
                        type="password"
                        className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                        placeholder=""
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#64748b]">发音人选择</span>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#fef3c7] text-[#d97706] rounded-lg text-sm">
                        <AlertCircle className="w-4 h-4" />
                        未配置
                      </div>
                    </div>
                    <Select
                      value="x4_yezi"
                      onChange={() => {}}
                      options={[{ value: 'x4_yezi', label: 'x4_yezi' }]}
                      placeholder="选择发音人"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* ASR 左侧栏 */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                    <Keyboard className="w-5 h-5 text-[#6366f1]" />
                  </div>
                  <h3 className="font-semibold text-[#0f172a]">全局语音快捷键</h3>
                </div>
                <p className="text-xs text-[#64748b] mb-4">设置全局快捷键，在游戏中按下即可语音输入，识别后自动粘贴到当前窗口</p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#334155]">启用全局快捷键</span>
                    <Switch checked={asrEnabled} onChange={setAsrEnabled} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-[#334155]">快捷键</label>
                      <button className="px-3 py-1 bg-[#f0f4ff] text-[#6366f1] border border-[#6366f1]/20 rounded-full text-xs font-medium hover:bg-[#e0e7ff] transition-all duration-200">
                        修改
                      </button>
                    </div>
                    <input
                      type="text"
                      value={shortcut}
                      onChange={(e) => setShortcut(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                      placeholder="Ctrl+Shift+,"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">粘贴模式</label>
                    <Select
                      value={pasteMode}
                      onChange={setPasteMode}
                      options={[
                        { value: 'direct', label: '直接粘贴 (Ctrl+V)' },
                        { value: 'ahk', label: 'AutoHotkey 模式' }
                      ]}
                      placeholder="选择粘贴模式"
                    />
                  </div>

                  <div className="bg-[#f8fafc] rounded-xl p-4 space-y-2">
                    <p className="text-sm font-medium text-[#334155]">使用说明：</p>
                    <ul className="text-xs text-[#64748b] space-y-1 list-disc list-inside">
                      <li>按下快捷键开始录音，再按一次停止录音并识别</li>
                      <li>识别完成后自动复制到剪贴板并粘贴到当前焦点窗口</li>
                      <li>直接粘贴模式使用 Ctrl+V，适用于大多数应用</li>
                      <li>AutoHotkey 模式使用 Ctrl+Shift+V，需配合 AHK 脚本使用</li>
                      <li>需要先配置语音识别 API（百度或讯飞）才能使用</li>
                      <li>快捷键必须是组合键（如 Ctrl+Shift+,）</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ASR 右侧栏 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 百度语音识别 */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                    <Mic className="w-5 h-5 text-[#6366f1]" />
                  </div>
                  <h3 className="font-semibold text-[#0f172a]">语音识别引擎</h3>
                </div>
                <p className="text-xs text-[#64748b] mb-4">选择用于语音识别的引擎，百度和讯飞均支持中文识别</p>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">请输入 APP_ID</label>
                      <input
                        type="text"
                        value={baiduAppId}
                        onChange={(e) => setBaiduAppId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                        placeholder="请输入 APP_ID"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">请输入 API_KEY</label>
                      <input
                        type="text"
                        value={baiduApiKey}
                        onChange={(e) => setBaiduApiKey(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                        placeholder="请输入 API_KEY"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">SECRET_KEY</label>
                    <input
                      type="password"
                      value={baiduSecretKey}
                      onChange={(e) => setBaiduSecretKey(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                      placeholder="请输入 SECRET_KEY"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#fef3c7] text-[#d97706] rounded-lg text-sm">
                      <AlertCircle className="w-4 h-4" />
                      未配置
                    </div>
                    <button className="px-4 py-2 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#4f46e5] transition-all duration-200">
                      测试连接
                    </button>
                    <button className="px-4 py-2 bg-[#f0f4ff] text-[#6366f1] border border-[#6366f1]/20 rounded-lg text-sm font-medium hover:bg-[#e0e7ff] transition-all duration-200">
                      申请API
                    </button>
                  </div>

                  <div className="bg-[#fefce8] rounded-xl p-4 space-y-2">
                    <p className="text-sm font-medium text-[#854d0e] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      百度语音 API 申请指引：
                    </p>
                    <ol className="text-sm text-[#a16207] space-y-1 list-decimal list-inside">
                      <li>访问：<a href="#" className="text-[#6366f1] hover:underline">百度智能云控制台</a></li>
                      <li>登录百度账号，创建应用</li>
                      <li>获取 APP_ID, API_KEY, SECRET_KEY</li>
                      <li>填入上方输入框即可自动保存</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* 讯飞语音识别 */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                    <Mic className="w-5 h-5 text-[#6366f1]" />
                  </div>
                  <h3 className="font-semibold text-[#0f172a]">讯飞语音识别 API 配置</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">APP_ID</label>
                    <input
                      type="text"
                      value={xunfeiAppId}
                      onChange={(e) => setXunfeiAppId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">API_KEY</label>
                    <input
                      type="text"
                      value={xunfeiApiKey}
                      onChange={(e) => setXunfeiApiKey(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">API_SECRET</label>
                    <input
                      type="password"
                      value={xunfeiApiSecret}
                      onChange={(e) => setXunfeiApiSecret(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#fef3c7] text-[#d97706] rounded-lg text-sm">
                      <AlertCircle className="w-4 h-4" />
                      未配置
                    </div>
                    <button className="px-4 py-2 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#4f46e5] transition-all duration-200">
                      测试连接
                    </button>
                    <button className="px-4 py-2 bg-[#f0f4ff] text-[#6366f1] border border-[#6366f1]/20 rounded-lg text-sm font-medium hover:bg-[#e0e7ff] transition-all duration-200">
                      申请API
                    </button>
                  </div>

                  <p className="text-xs text-[#64748b] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full"></span>
                    访问：<a href="https://console.xfyun.cn/services/tts" className="text-[#6366f1] hover:underline">讯飞开放平台</a>申请语音听写（流式版）API
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
