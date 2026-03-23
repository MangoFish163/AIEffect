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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-2">
          语音配置
        </h1>
        <p className="text-gray-500 text-sm">
          打造个性化的语音交互体验，支持多种高性能合成引擎。
        </p>
      </div>

      <div className="flex bg-white rounded-xl p-1 border border-gray-200 shadow-sm w-fit">
        <button
          onClick={() => setActiveTab('tts')}
          className={cn(
            'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === 'tts'
              ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
              ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          )}
        >
          <Mic className="w-4 h-4" />
          语音输入 (ASR)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800">全局控制</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">启用 TTS 输出</p>
                  <p className="text-xs text-gray-500">开启后将朗读 AI 回复</p>
                </div>
                <Switch checked={ttsEnabled} onChange={setTtsEnabled} />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-gray-600">自动播放</span>
                <Switch checked={autoPlayEnabled} onChange={setAutoPlayEnabled} />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-gray-600">保存音频文件</span>
                <Switch checked={saveAudioEnabled} onChange={setSaveAudioEnabled} />
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">播放模式</label>
                <select className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200">
                  <option>只播放对话 (Dialog Only)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800">混音控制</h3>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">主音量</label>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">{Math.round(config.tts.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.tts.volume}
                  onChange={(e) => setConfig({ tts: { ...config.tts, volume: parseFloat(e.target.value) } })}
                  className="w-full accent-pink-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-2.5 px-4 text-sm text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-all duration-200 flex items-center justify-center gap-2">
                  <MicOff className="w-4 h-4" />
                  停止播放
                </button>
                <button className="flex-1 py-2.5 px-4 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200">
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
                  ? 'border-pink-400 bg-pink-50 text-pink-600 shadow-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              GPT-SoVITS
            </button>
            <button
              onClick={() => setActiveEngine('xunfei')}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border',
                activeEngine === 'xunfei'
                  ? 'border-pink-400 bg-pink-50 text-pink-600 shadow-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              讯飞语音
            </button>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-pink-600" />
              </div>
              <h3 className="font-semibold text-gray-800">连接设置</h3>
              <div className="ml-auto">
                <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
                  未检测
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">API</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200"
                  value="http://localhost:9880/tts"
                />
              </div>
              <button className="mt-7 px-6 py-2.5 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl font-medium hover:shadow-md transition-all duration-200">
                测试
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">角色音色管理</h3>
                <p className="text-xs text-gray-500">配置精调模型和参考音频以克隆目标声线</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">当前角色</label>
                <select className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200">
                  <option>选择角色</option>
                </select>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-24 text-sm text-gray-500">角色名称</span>
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200" placeholder="Display Name" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-sm text-gray-500">参考音频目录</span>
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200" />
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all duration-200">
                    <Folder className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-sm text-gray-500">情感音频配置</span>
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200" />
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all duration-200">
                    <Folder className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-sm text-gray-500">GPT模型路径</span>
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200" />
                  <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all duration-200">
                    <Folder className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-md transition-all duration-200">
              <Plus className="w-4 h-4" />
              添加角色
            </button>
            <button className="flex items-center justify-center gap-2 py-2.5 text-blue-600 bg-blue-50 border border-blue-100 rounded-xl font-medium hover:bg-blue-100 transition-all duration-200">
              <Save className="w-4 h-4" />
              保存
            </button>
            <button className="flex items-center justify-center gap-2 py-2.5 text-red-500 bg-red-50 border border-red-100 rounded-xl font-medium hover:bg-red-100 transition-all duration-200">
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-800">推理参数配置</h3>
              </div>
              <button className="px-3 py-1.5 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-all duration-200">
                应用参数
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">top_k</label>
                <div className="flex items-center gap-2">
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-center text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200" value="40" />
                  <span className="text-xs text-gray-400">top_p</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1"></label>
                <div className="flex items-center gap-2">
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-center text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200" value="0.9" />
                  <span className="text-xs text-gray-400">temp</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1"></label>
                <div className="flex items-center gap-2">
                  <input type="text" className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-center text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200" value="1.3" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">参考音频配置</h3>
                <p className="text-xs text-gray-500">(设置太多可能导致速度变慢)</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">最少音频数</label>
                <input type="text" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-center text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200" value="2" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">最多音频数</label>
                <input type="text" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-center text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200" value="3" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">情感阈值</label>
                <input type="text" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-center text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200" value="0.3" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800">语音合成测试</h3>
              <p className="text-sm text-gray-500">输入文本并选择情感进行语音合成测试</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">测试文本</label>
                <textarea className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl min-h-[100px] text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200" placeholder="你好，这是一段语音合成测试。" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">情感</label>
                  <select className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200">
                    <option>平静 (calm)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">使用角色</label>
                  <select className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all duration-200">
                    <option>当前选中角色</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-green-500/25 transition-all duration-200">
                  <Play className="w-4 h-4" />
                  合成并播放
                </button>
                <button className="px-6 py-3 text-red-500 bg-red-50 border border-red-100 rounded-xl font-medium hover:bg-red-100 transition-all duration-200">
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
