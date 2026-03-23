import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, RotateCw, Type, Palette, Monitor, History, Plus } from 'lucide-react';
import { useAppStore } from '../store';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export const SubtitleVisual: React.FC = () => {
  const { config, setConfig } = useAppStore();
  const [previewText, setPreviewText] = useState('输入测试字幕...');
  const [activeTab, setActiveTab] = useState<'page' | 'stream'>('page');

  return (
    <div className="flex h-full">
      <div className="w-96 bg-white border-r border-[#e2e8f0] flex flex-col overflow-y-auto">
        <div className="p-6">
          <h1 className="text-3xl font-bold text-[#0f172a] mb-2">
            字幕视觉
          </h1>
          <p className="text-[#64748b] text-sm">
            自定义悬浮窗外行为与外观，打造沉浸式阅读体验。
          </p>
        </div>

        <div className="px-6 pb-6 space-y-6">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <Monitor className="w-5 h-5 text-[#6366f1]" />
              </div>
              <h3 className="font-semibold text-[#0f172a]">窗口控制</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 py-2 px-3 border border-[#e2e8f0] rounded-xl text-sm text-[#64748b] hover:border-[#6366f1] hover:text-[#6366f1] hover:bg-[#f0f4ff] transition-colors">
                <Eye className="w-4 h-4" />
                显示字幕
              </button>
              <button className="flex items-center justify-center gap-2 py-2 px-3 border border-[#e2e8f0] rounded-xl text-sm text-[#64748b] hover:border-[#6366f1] hover:text-[#6366f1] hover:bg-[#f0f4ff] transition-colors">
                <EyeOff className="w-4 h-4" />
                隐藏字幕
              </button>
              <button className="flex items-center justify-center gap-2 py-2 px-3 border border-[#e2e8f0] rounded-xl text-sm text-[#64748b] hover:border-[#6366f1] hover:text-[#6366f1] hover:bg-[#f0f4ff] transition-colors">
                <Palette className="w-4 h-4" />
                隐藏控件
              </button>
              <button className="flex items-center justify-center gap-2 py-2 px-3 border border-[#e2e8f0] rounded-xl text-sm text-[#64748b] hover:border-[#6366f1] hover:text-[#6366f1] hover:bg-[#f0f4ff] transition-colors">
                <Trash2 className="w-4 h-4" />
                清空内容
              </button>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <History className="w-5 h-5 text-[#6366f1]" />
              </div>
              <h3 className="font-semibold text-[#0f172a]">历史记录</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-[#f8fafc] rounded-xl">
                <span className="w-6 h-6 bg-[#f0f4ff] text-[#6366f1] rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#334155] truncate">
                    "猛地咽回了翠色的眼睛，作势抬..."
                  </p>
                  <p className="text-xs text-[#94a3b8] mt-1">共 20 条记录，连续后可在字幕窗口中查看</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                  <Type className="w-5 h-5 text-[#6366f1]" />
                </div>
                <h3 className="font-semibold text-[#0f172a]">字幕设置</h3>
              </div>
              <button className="text-[#94a3b8] hover:text-[#64748b]">
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-2">字体颜色</label>
                <div className="flex items-center gap-3">
                  <button className="w-10 h-10 border-2 border-[#e2e8f0] rounded-lg bg-white flex items-center justify-center">
                    <div className="w-5 h-5 bg-white border border-[#e2e8f0] rounded" />
                  </button>
                  <span className="text-sm text-[#64748b]">自定义颜色</span>
                  <div className="flex-1" />
                  <input type="color" value="#ffffff" className="w-8 h-8 rounded cursor-pointer" />
                  <button className="w-8 h-8 rounded-lg bg-[#f8fafc] flex items-center justify-center hover:bg-[#e2e8f0]">
                    <Plus className="w-4 h-4 text-[#64748b]" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#334155] mb-2">背景颜色</label>
                <div className="flex items-center gap-3">
                  <button className="w-10 h-10 border-2 border-[#6366f1] rounded-lg bg-gradient-to-br from-[#6366f1] via-[#818cf8] to-[#8b5cf6]" />
                  <span className="text-sm text-[#64748b]">科技极光</span>
                  <div className="flex-1" />
                  <input type="color" value="#0a0a0f" className="w-8 h-8 rounded cursor-pointer" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-[#334155]">不透明度</label>
                  <span className="text-sm text-[#6366f1]">{Math.round(config.subtitle.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.subtitle.opacity}
                  onChange={(e) => setConfig({ subtitle: { ...config.subtitle, opacity: parseFloat(e.target.value) } })}
                  className="w-full accent-[#6366f1]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-[#334155]">字体大小</label>
                  <span className="text-sm text-[#6366f1]">{config.subtitle.font_size}px</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="32"
                  value={config.subtitle.font_size}
                  onChange={(e) => setConfig({ subtitle: { ...config.subtitle, font_size: parseInt(e.target.value) } })}
                  className="w-full accent-[#6366f1]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-[#334155]">打字速度</label>
                  <span className="text-sm text-[#6366f1]">{config.subtitle.typing_speed}ms</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={config.subtitle.typing_speed}
                  onChange={(e) => setConfig({ subtitle: { ...config.subtitle, typing_speed: parseInt(e.target.value) } })}
                  className="w-full accent-[#6366f1]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 bg-gradient-to-br from-[#f0f4ff] via-[#f8fafc] to-[#e8f0ff]">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[#334155]">实时预览</h2>
            <div className="flex bg-white rounded-xl p-1 border border-[#e2e8f0] shadow-sm">
              <button
                onClick={() => setActiveTab('page')}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'page'
                    ? 'bg-[#f0f4ff] text-[#6366f1]'
                    : 'text-[#64748b] hover:text-[#334155]'
                )}
              >
                字幕页面
              </button>
              <button
                onClick={() => setActiveTab('stream')}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'stream'
                    ? 'bg-[#f0f4ff] text-[#6366f1]'
                    : 'text-[#64748b] hover:text-[#334155]'
                )}
              >
                流式窗口
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <p className="text-center text-[#94a3b8] mb-4">字幕页面 - Galgame 风格悬浮字幕</p>
              
              <div className="relative bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-2xl p-1 shadow-2xl">
                <div className="bg-white/10 backdrop-blur-sm rounded-t-xl px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#6366f1]" />
                    <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                    <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
                  </div>
                  <div className="flex items-center gap-3 text-white/80 text-xs">
                    <span>透明</span>
                    <div className="w-12 h-1 bg-white/30 rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-[#6366f1] rounded-full" />
                    </div>
                    <span>重置</span>
                    <div className="w-12 h-1 bg-white/30 rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-[#6366f1] rounded-full" />
                    </div>
                    <span>5秒关闭</span>
                    <div className="w-12 h-1 bg-white/30 rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-[#6366f1] rounded-full" />
                    </div>
                    <span>穿透</span>
                    <div className="w-12 h-1 bg-white/30 rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-[#6366f1] rounded-full" />
                    </div>
                    <span>30ms</span>
                  </div>
                  <button className="text-white/60 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="p-6 relative overflow-hidden">
                  <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#22c55e] animate-pulse" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#6366f1]/10 via-transparent to-[#8b5cf6]/10 pointer-events-none" />
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#6366f1]/20 rounded-full blur-3xl" />
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#8b5cf6]/20 rounded-full blur-3xl" />
                  
                  <p className="text-sm text-white/60 mb-3">💬 查看历史记录</p>
                  <p className="text-white leading-relaxed" style={{ fontSize: config.subtitle.font_size }}>
                    "猛地咽回了翠色的眼睛，作势抬脚要踢你，靴尖蹭到你椅腿又收了回去，褐色的碎发被风刮得糊了半张脸，耳尖唰地红了个透，声音凶得像炸毛的小狼崽"谁要你暖心？西帝国那群狗崽子见了我都得绕着走，就算被发现了我一箭一个用串成插在城墙上，能抓得住我？"顿了顿，指尖无意识抠了抠腰问的剑鞘，眼珠子转了转，故意装出不看你的样子"不过话说回来，凭啥要跑他们的地盘去？不看烦不烦的样子？"指了指鹿、猎鹿、射靶、摸鱼摸贼随便你挑，我主场还能欺负你不成？省得跑那么远路上还要花我的冤枉钱——哦不对，反正你掏钱买马不要钱啊？"顿时翻了个大大的白眼，叉着腰哼了一声"抠买买马不要钱啊？至少少兵招不到，还能顺便摸鱼顺便把新弓，亏了你出的主意靠谱？"说完先暗自封了自己的"纳尔纳帝国的弓箭手，嘴角却压不住地往上翘，藏在碎发后面的耳尖红得都快透明了"
                  </p>
                  
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Pen className="w-4 h-4 text-[#6366f1]" />
                        <input
                          type="text"
                          value={previewText}
                          onChange={(e) => setPreviewText(e.target.value)}
                          className="flex-1 bg-white/10 text-white placeholder-white/50 rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-[#6366f1] focus:outline-none"
                          placeholder="输入测试字幕..."
                        />
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-[#6366f1] text-white rounded-lg font-medium hover:bg-[#4f46e5] hover:shadow-lg hover:shadow-[#6366f1]/25 transition-all">
                      发送
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function X({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function Pen({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
