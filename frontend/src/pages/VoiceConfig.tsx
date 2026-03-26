import React, { useState, useEffect, useCallback } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Plus,
  Trash2,
  Save,
  Settings,
  User,
  Folder,
  MessageSquare,
  Keyboard,
  AlertCircle,
  ExternalLink,
  AudioLines,
} from "lucide-react";
import { useAppStore } from "../store";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Switch, Select } from "../components";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE_URL = "";

export const VoiceConfig: React.FC = () => {
  const { config, setConfig } = useAppStore();
  const [activeTab, setActiveTab] = useState<"tts" | "asr">("tts");
  const [activeEngine, setActiveEngine] = useState("gptsovits");
  const [mixEnabled, setMixEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ASR 状态
  const [asrEnabled, setAsrEnabled] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl+Shift+,");
  const [pasteMode, setPasteMode] = useState("direct");
  const [baiduAppId, setBaiduAppId] = useState("");
  const [baiduApiKey, setBaiduApiKey] = useState("");
  const [baiduSecretKey, setBaiduSecretKey] = useState("");
  const [xunfeiAppId, setXunfeiAppId] = useState("");
  const [xunfeiApiKey, setXunfeiApiKey] = useState("");
  const [xunfeiApiSecret, setXunfeiApiSecret] = useState("");

  // 从后端获取 TTS 配置
  const fetchTTSConfig = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts/config`);
      const result = await response.json();
      if (result.code === 200 && result.data) {
        const ttsConfig = result.data;
        setConfig({
          tts: {
            ...config.tts,
            enabled: ttsConfig.enabled ?? config.tts.enabled,
            auto_play: ttsConfig.auto_play ?? config.tts.auto_play,
            save_audio: ttsConfig.save_audio ?? config.tts.save_audio,
            play_mode: ttsConfig.play_mode ?? config.tts.play_mode,
            volume: ttsConfig.volume ?? config.tts.volume,
            engine: ttsConfig.engine ?? config.tts.engine,
          },
        });
      }
    } catch (error) {
      console.error("Failed to fetch TTS config:", error);
    }
  }, []);

  // 更新后端 TTS 配置
  const updateTTSConfig = useCallback(async (updates: Partial<typeof config.tts>) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      const result = await response.json();
      if (result.code !== 200) {
        console.error("Failed to update TTS config:", result.message);
      }
    } catch (error) {
      console.error("Failed to update TTS config:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 组件挂载时获取配置
  useEffect(() => {
    fetchTTSConfig();
  }, [fetchTTSConfig]);

  // 处理 TTS 启用状态变更
  const handleTTSEnabledChange = (enabled: boolean) => {
    setConfig({
      tts: {
        ...config.tts,
        enabled,
      },
    });
    updateTTSConfig({ enabled });
  };

  // 处理自动播放状态变更
  const handleAutoPlayChange = (auto_play: boolean) => {
    setConfig({
      tts: {
        ...config.tts,
        auto_play,
      },
    });
    updateTTSConfig({ auto_play });
  };

  // 处理保存音频状态变更
  const handleSaveAudioChange = (save_audio: boolean) => {
    setConfig({
      tts: {
        ...config.tts,
        save_audio,
      },
    });
    updateTTSConfig({ save_audio });
  };

  // 处理播放模式变更
  const handlePlayModeChange = (play_mode: string) => {
    setConfig({
      tts: {
        ...config.tts,
        play_mode,
      },
    });
    updateTTSConfig({ play_mode });
  };

  // 处理音量变更
  const handleVolumeChange = (volume: number) => {
    setConfig({
      tts: {
        ...config.tts,
        volume,
      },
    });
    // 音量变更使用防抖，避免频繁请求
    debouncedUpdateVolume(volume);
  };

  // 防抖函数
  const debouncedUpdateVolume = useCallback(
    debounce((volume: number) => {
      updateTTSConfig({ volume });
    }, 500),
    [updateTTSConfig]
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#6366f1] rounded-xl flex items-center justify-center shadow-md border-2 border-[#4f46e5]">
            <AudioLines className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#0f172a]">语音配置</h1>
        </div>

        <div className="flex bg-white rounded-xl p-1 border border-[#e2e8f0] shadow-sm w-fit gap-2">
          <button
            onClick={() => setActiveTab("tts")}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === "tts"
                ? "bg-[#6366f1] text-white shadow-md"
                : "text-[#64748b] hover:text-[#334155] hover:bg-[#f8fafc]",
            )}
          >
            <Volume2 className="w-4 h-4" />
            语音合成 (TTS)
          </button>
          <button
            onClick={() => setActiveTab("asr")}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === "asr"
                ? "bg-[#6366f1] text-white shadow-md"
                : "text-[#64748b] hover:text-[#334155] hover:bg-[#f8fafc]",
            )}
          >
            <Mic className="w-4 h-4" />
            语音输入 (ASR)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {activeTab === "tts" ? (
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
                      <p className="text-sm font-medium text-[#334155]">
                        启用 TTS 输出
                      </p>
                      <p className="text-xs text-[#64748b]">
                        开启后将朗读 AI 回复
                      </p>
                    </div>
                    <Switch
                      checked={config.tts.enabled}
                      onChange={handleTTSEnabledChange}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-[#64748b]">自动播放</span>
                    <Switch
                      checked={config.tts.auto_play}
                      onChange={handleAutoPlayChange}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-[#64748b]">保存音频文件</span>
                    <Switch
                      checked={config.tts.save_audio}
                      onChange={handleSaveAudioChange}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-[#334155] mb-2">
                      播放模式
                    </label>
                    <Select
                      value={config.tts.play_mode}
                      onChange={handlePlayModeChange}
                      options={[
                        { value: "dialog", label: "只播放对话 (Dialog Only)" },
                        { value: "full", label: "播放全文 (Full Text)" },
                      ]}
                      placeholder="选择播放模式"
                      disabled={isLoading}
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
                      <label className="text-sm font-medium text-[#334155]">
                        主音量
                      </label>
                      <span className="text-xs bg-[#f0f4ff] px-2 py-1 rounded text-[#6366f1]">
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
                        handleVolumeChange(parseFloat(e.target.value))
                      }
                      className="w-full accent-[#6366f1]"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setMixEnabled(!mixEnabled)}
                      className={cn(
                        "flex-1 py-2.5 px-4 text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2",
                        mixEnabled
                          ? "text-[#22c55e] bg-[#f0fdf4] hover:bg-[#dcfce7]"
                          : "text-[#ef4444] bg-[#fef2f2] hover:bg-[#fee2e2]",
                      )}
                    >
                      {mixEnabled ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <VolumeX className="w-4 h-4" />
                      )}
                      {mixEnabled ? "启用播放" : "停用播放"}
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
                <p className="text-xs text-[#64748b] mb-4">
                  输入文本并选择情感进行语音合成测试
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">
                      测试文本
                    </label>
                    <textarea
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl min-h-[80px] text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                      placeholder="你好，这是一段语音合成测试。"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">
                        情感
                      </label>
                      <Select
                        value="calm"
                        onChange={() => {}}
                        options={[{ value: "calm", label: "平静 (calm)" }]}
                        placeholder="选择情感"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#334155] mb-2">
                        使用角色
                      </label>
                      <Select
                        value="current"
                        onChange={() => {}}
                        options={[{ value: "current", label: "当前选中角色" }]}
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
                  onClick={() => setActiveEngine("gptsovits")}
                  className={cn(
                    "flex-1 py-2.5 px-6 rounded-lg text-sm font-medium transition-all duration-200",
                    activeEngine === "gptsovits"
                      ? "bg-[#6366f1] text-white shadow-md"
                      : "text-[#64748b] hover:text-[#334155] hover:bg-[#f8fafc]",
                  )}
                >
                  GPT-SoVITS
                </button>
                <button
                  onClick={() => setActiveEngine("xunfei")}
                  className={cn(
                    "flex-1 py-2.5 px-6 rounded-lg text-sm font-medium transition-all duration-200",
                    activeEngine === "xunfei"
                      ? "bg-[#6366f1] text-white shadow-md"
                      : "text-[#64748b] hover:text-[#334155] hover:bg-[#f8fafc]",
                  )}
                >
                  讯飞语音
                </button>
              </div>

              {activeEngine === "gptsovits" ? (
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
                        <label className="block text-sm font-medium text-[#334155] mb-2">
                          API
                        </label>
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
                        <h3 className="font-semibold text-[#0f172a]">
                          角色音色管理
                        </h3>
                        <p className="text-xs text-[#64748b]">
                          配置精调模型和参考音频以克隆目标声线
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#334155] mb-2">
                          当前角色
                        </label>
                        <Select
                          value=""
                          onChange={() => {}}
                          options={[{ value: "", label: "选择角色" }]}
                          placeholder="选择角色"
                        />
                      </div>

                      <div className="bg-[#f8fafc] rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="w-24 text-sm text-[#64748b]">
                            角色名称
                          </span>
                          <input
                            type="text"
                            className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                            placeholder="Display Name"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="w-24 text-sm text-[#64748b]">
                            参考音频目录
                          </span>
                          <input
                            type="text"
                            className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                          />
                          <button className="p-2.5 border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] transition-all duration-200">
                            <Folder className="w-4 h-4 text-[#94a3b8]" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="w-24 text-sm text-[#64748b]">
                            情感音频配置
                          </span>
                          <input
                            type="text"
                            className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                          />
                          <button className="p-2.5 border border-[#e2e8f0] rounded-xl hover:bg-[#f8fafc] transition-all duration-200">
                            <Folder className="w-4 h-4 text-[#94a3b8]" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="w-24 text-sm text-[#64748b]">
                            GPT模型路径
                          </span>
                          <input
                            type="text"
                            className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                          />
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
                        <h3 className="font-semibold text-[#0f172a]">
                          推理参数配置
                        </h3>
                      </div>
                      <button className="px-3 py-1.5 bg-[#0f172a] text-white text-sm rounded-lg hover:bg-[#334155] transition-all duration-200">
                        应用参数
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">
                            top_k
                          </label>
                          <span className="text-xs text-[#94a3b8]">40</span>
                        </div>
                        <input
                          type="text"
                          className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                          value="40"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">
                            top_p
                          </label>
                          <span className="text-xs text-[#94a3b8]">0.9</span>
                        </div>
                        <input
                          type="text"
                          className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                          value="0.9"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">temp</label>
                          <span className="text-xs text-[#94a3b8]">1.3</span>
                        </div>
                        <input
                          type="text"
                          className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                          value="1.3"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                        <Settings className="w-5 h-5 text-[#6366f1]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#0f172a]">
                          参考音频配置
                        </h3>
                        <p className="text-xs text-[#64748b]">
                          (设置太多可能导致速度变慢)
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">
                            最少音频数
                          </label>
                          <span className="text-xs text-[#94a3b8]">2</span>
                        </div>
                        <input
                          type="text"
                          className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                          value="2"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">
                            最多音频数
                          </label>
                          <span className="text-xs text-[#94a3b8]">3</span>
                        </div>
                        <input
                          type="text"
                          className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                          value="3"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-[#64748b]">
                            情感阈值
                          </label>
                          <span className="text-xs text-[#94a3b8]">30%</span>
                        </div>
                        <input
                          type="text"
                          className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-center text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                          value="0.3"
                        />
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
                    <h3 className="font-semibold text-[#0f172a]">
                      讯飞语音配置
                    </h3>
                  </div>

                  <div className="bg-[#f8fafc] rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="w-20 text-sm text-[#64748b]">
                        APP ID
                      </span>
                      <input
                        type="text"
                        className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                        placeholder=""
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="w-20 text-sm text-[#64748b]">
                        API Key
                      </span>
                      <input
                        type="text"
                        className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                        placeholder=""
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="w-20 text-sm text-[#64748b]">
                        API Secret
                      </span>
                      <input
                        type="password"
                        className="flex-1 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                        placeholder=""
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-6">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
                      <span className="text-sm text-[#64748b]">未连接</span>
                    </div>
                    <button className="px-6 py-2.5 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] hover:shadow-md transition-all duration-200">
                      测试连接
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ASR 配置 */
          <>
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                    <Mic className="w-5 h-5 text-[#6366f1]" />
                  </div>
                  <h3 className="font-semibold text-[#0f172a]">ASR 设置</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#334155]">
                        启用语音输入
                      </p>
                      <p className="text-xs text-[#64748b]">
                        开启后可以通过语音输入文字
                      </p>
                    </div>
                    <Switch
                      checked={asrEnabled}
                      onChange={setAsrEnabled}
                    />
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-[#334155] mb-2">
                      快捷键
                    </label>
                    <input
                      type="text"
                      value={shortcut}
                      onChange={(e) => setShortcut(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-[#334155] mb-2">
                      粘贴模式
                    </label>
                    <Select
                      value={pasteMode}
                      onChange={setPasteMode}
                      options={[
                        { value: "direct", label: "直接输入 (Direct)" },
                        { value: "clipboard", label: "剪贴板 (Clipboard)" },
                      ]}
                      placeholder="选择粘贴模式"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-[#6366f1]" />
                  </div>
                  <h3 className="font-semibold text-[#0f172a]">百度 ASR</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">
                      App ID
                    </label>
                    <input
                      type="text"
                      value={baiduAppId}
                      onChange={(e) => setBaiduAppId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">
                      API Key
                    </label>
                    <input
                      type="text"
                      value={baiduApiKey}
                      onChange={(e) => setBaiduApiKey(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">
                      Secret Key
                    </label>
                    <input
                      type="password"
                      value={baiduSecretKey}
                      onChange={(e) => setBaiduSecretKey(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-[#6366f1]" />
                  </div>
                  <h3 className="font-semibold text-[#0f172a]">讯飞 ASR</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">
                      App ID
                    </label>
                    <input
                      type="text"
                      value={xunfeiAppId}
                      onChange={(e) => setXunfeiAppId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">
                      API Key
                    </label>
                    <input
                      type="text"
                      value={xunfeiApiKey}
                      onChange={(e) => setXunfeiApiKey(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#334155] mb-2">
                      API Secret
                    </label>
                    <input
                      type="password"
                      value={xunfeiApiSecret}
                      onChange={(e) => setXunfeiApiSecret(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all duration-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                    <Keyboard className="w-5 h-5 text-[#6366f1]" />
                  </div>
                  <h3 className="font-semibold text-[#0f172a]">快捷键说明</h3>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-[#e2e8f0]">
                    <span className="text-[#64748b]">开始录音</span>
                    <span className="font-medium text-[#334155]">
                      {shortcut}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[#e2e8f0]">
                    <span className="text-[#64748b]">停止录音</span>
                    <span className="font-medium text-[#334155]">松开按键</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#e2e8f0]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-[#6366f1]" />
                  </div>
                  <h3 className="font-semibold text-[#0f172a]">使用提示</h3>
                </div>

                <ul className="space-y-2 text-sm text-[#64748b]">
                  <li className="flex items-start gap-2">
                    <span className="text-[#6366f1]">•</span>
                    <span>按住快捷键开始语音输入</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6366f1]">•</span>
                    <span>松开按键自动识别并输入</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6366f1]">•</span>
                    <span>建议在安静环境下使用</span>
                  </li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// 防抖函数
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
