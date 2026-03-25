import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Trash2, RotateCw, Type, Palette, Monitor, History, Plus, X, Check, LayoutTemplate, PanelLeftClose, PanelLeftOpen, Loader2, Subtitles } from 'lucide-react';
import { useAppStore } from '../store';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface ColorPreset {
  id: string;
  name: string;
  color: string;
  isCustom?: boolean;
}

const defaultColorPresets: ColorPreset[] = [
  { id: 'white', name: '白色', color: '#ffffff' },
  { id: 'black', name: '黑色', color: '#000000' },
  { id: 'pink', name: '粉色', color: '#ec4899' },
  { id: 'yellow', name: '黄色', color: '#eab308' },
  { id: 'cyan', name: '青色', color: '#06b6d4' },
  { id: 'gold', name: '金色', color: '#f59e0b' },
  { id: 'darkblue', name: '深蓝灰', color: '#475569' },
];

export const SubtitleVisual: React.FC = () => {
  const { config, setConfig } = useAppStore();
  const [previewText, setPreviewText] = useState('输入测试字幕...');
  const [activeTab, setActiveTab] = useState<'page' | 'stream'>('page');

  const [fontColorPresets, setFontColorPresets] = useState<ColorPreset[]>(defaultColorPresets);
  const [bgColorPresets, setBgColorPresets] = useState<ColorPreset[]>([
    { id: 'aurora', name: '科技极光', color: '#6366f1' },
    { id: 'custom', name: '自定义颜色', color: '#0a0a0f' },
  ]);

  const [selectedFontColor, setSelectedFontColor] = useState('#ffffff');
  const [selectedBgColor, setSelectedBgColor] = useState('#6366f1');
  const [fontColorDropdownOpen, setFontColorDropdownOpen] = useState(false);
  const [bgColorDropdownOpen, setBgColorDropdownOpen] = useState(false);

  const [saveColorModalOpen, setSaveColorModalOpen] = useState(false);
  const [saveColorType, setSaveColorType] = useState<'font' | 'bg'>('font');
  const [saveColorName, setSaveColorName] = useState('');
  const [saveColorValue, setSaveColorValue] = useState('');

  // 窗口控制状态
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(true);
  const [isControlsHidden, setIsControlsHidden] = useState(false);

  // 加载状态
  const [isCompressing, setIsCompressing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const bgDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(event.target as Node)) {
        setFontColorDropdownOpen(false);
      }
      if (bgDropdownRef.current && !bgDropdownRef.current.contains(event.target as Node)) {
        setBgColorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveColor = () => {
    if (!saveColorName.trim()) return;

    const newPreset: ColorPreset = {
      id: `custom-${Date.now()}`,
      name: saveColorName.trim(),
      color: saveColorValue,
      isCustom: true,
    };

    if (saveColorType === 'font') {
      setFontColorPresets([...fontColorPresets, newPreset]);
      setSelectedFontColor(saveColorValue);
    } else {
      setBgColorPresets([...bgColorPresets, newPreset]);
      setSelectedBgColor(saveColorValue);
    }

    setSaveColorModalOpen(false);
    setSaveColorName('');
  };

  const handleDeletePreset = (type: 'font' | 'bg', id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (type === 'font') {
      const preset = fontColorPresets.find(p => p.id === id);
      if (preset && selectedFontColor === preset.color) {
        setSelectedFontColor(defaultColorPresets[0].color);
      }
      setFontColorPresets(fontColorPresets.filter(p => p.id !== id));
    } else {
      const preset = bgColorPresets.find(p => p.id === id);
      if (preset && selectedBgColor === preset.color) {
        setSelectedBgColor(bgColorPresets[0].color);
      }
      setBgColorPresets(bgColorPresets.filter(p => p.id !== id));
    }
  };

  const openSaveModal = (type: 'font' | 'bg', color: string) => {
    setSaveColorType(type);
    setSaveColorValue(color);
    setSaveColorName('');
    setSaveColorModalOpen(true);
  };

  const getColorDot = (color: string) => {
    const colorMap: Record<string, string> = {
      '#ffffff': 'bg-white',
      '#000000': 'bg-black',
      '#ec4899': 'bg-pink-500',
      '#eab308': 'bg-yellow-500',
      '#06b6d4': 'bg-cyan-500',
      '#f59e0b': 'bg-amber-500',
      '#475569': 'bg-slate-600',
    };
    return colorMap[color] || '';
  };

  const getCurrentFontPreset = () => {
    return fontColorPresets.find(p => p.color === selectedFontColor) || fontColorPresets[0];
  };

  const getCurrentBgPreset = () => {
    return bgColorPresets.find(p => p.color === selectedBgColor) || bgColorPresets[0];
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* 共同页头 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#6366f1] rounded-xl flex items-center justify-center shadow-md border-2 border-[#4f46e5]">
          <Subtitles className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-[#0f172a]">
          字幕视觉
        </h1>
        {/* <p className="text-[#64748b] text-sm">
          自定义悬浮窗外行为与外观，打造沉浸式阅读体验。
        </p> */}
      </div>

      {/* 左右两栏内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：配置区 */}
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f0f4ff] rounded-xl flex items-center justify-center">
                <Monitor className="w-5 h-5 text-[#6366f1]" />
              </div>
              <h3 className="font-semibold text-[#0f172a]">窗口控制</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 字幕显示/隐藏按钮 - 默认为显示字幕选中状态 */}
              <button
                onClick={() => setIsSubtitleVisible(!isSubtitleVisible)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 border rounded-xl text-sm transition-colors",
                  isSubtitleVisible
                    ? "border-[#6366f1] text-[#6366f1] bg-[#f0f4ff]"
                    : "border-[#e2e8f0] text-[#64748b] hover:border-[#6366f1] hover:text-[#6366f1] hover:bg-[#f0f4ff]"
                )}
              >
                {isSubtitleVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {isSubtitleVisible ? "显示字幕" : "隐藏字幕"}
              </button>
              {/* 控件显示/隐藏按钮 - 默认为显示控件选中状态 */}
              <button
                onClick={() => setIsControlsHidden(!isControlsHidden)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 border rounded-xl text-sm transition-colors",
                  !isControlsHidden
                    ? "border-[#6366f1] text-[#6366f1] bg-[#f0f4ff]"
                    : "border-[#e2e8f0] text-[#64748b] hover:border-[#6366f1] hover:text-[#6366f1] hover:bg-[#f0f4ff]"
                )}
              >
                {!isControlsHidden ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                {!isControlsHidden ? "隐藏控件" : "显示控件"}
              </button>
              {/* 压缩对话按钮 */}
              <button
                onClick={() => {
                  if (isCompressing) return;
                  setIsCompressing(true);
                  setTimeout(() => setIsCompressing(false), 3000);
                }}
                disabled={isCompressing}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 border rounded-xl text-sm transition-colors",
                  isCompressing
                    ? "border-[#e2e8f0] text-[#94a3b8] cursor-not-allowed"
                    : "border-[#e2e8f0] text-[#64748b] hover:border-[#6366f1] hover:text-[#6366f1] hover:bg-[#f0f4ff]"
                )}
              >
                {isCompressing ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutTemplate className="w-4 h-4" />}
                压缩对话
              </button>
              {/* 清空内容按钮 */}
              <button
                onClick={() => {
                  if (isClearing) return;
                  setIsClearing(true);
                  setTimeout(() => setIsClearing(false), 3000);
                }}
                disabled={isClearing}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 border rounded-xl text-sm transition-colors",
                  isClearing
                    ? "border-[#e2e8f0] text-[#94a3b8] cursor-not-allowed"
                    : "border-[#e2e8f0] text-[#64748b] hover:border-[#6366f1] hover:text-[#6366f1] hover:bg-[#f0f4ff]"
                )}
              >
                {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
              {/* 字体颜色 */}
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-2">字体颜色</label>
                <div className="flex items-center gap-2" ref={fontDropdownRef}>
                  <div className="relative flex-1">
                    <button
                      onClick={() => setFontColorDropdownOpen(!fontColorDropdownOpen)}
                      className="w-full flex items-center gap-2 px-3 py-2 border border-[#e2e8f0] rounded-lg bg-white hover:border-[#6366f1] transition-colors"
                    >
                      <div
                        className="w-4 h-4 rounded border border-[#e2e8f0]"
                        style={{ backgroundColor: selectedFontColor }}
                      />
                      <span className="text-sm text-[#334155] flex-1 text-left">
                        {getCurrentFontPreset().name}
                      </span>
                      <svg className="w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {fontColorDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                        {fontColorPresets.map((preset) => (
                          <div
                            key={preset.id}
                            onClick={() => {
                              setSelectedFontColor(preset.color);
                              setFontColorDropdownOpen(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-[#f8fafc] cursor-pointer"
                          >
                            <div
                              className="w-4 h-4 rounded-full border border-[#e2e8f0]"
                              style={{ backgroundColor: preset.color }}
                            />
                            <span className="text-sm text-[#334155] flex-1">{preset.name}</span>
                            {selectedFontColor === preset.color && (
                              <Check className="w-4 h-4 text-[#6366f1]" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    type="color"
                    value={selectedFontColor}
                    onChange={(e) => setSelectedFontColor(e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-[#e2e8f0] p-0.5"
                  />

                  <button
                    onClick={() => openSaveModal('font', selectedFontColor)}
                    className="w-9 h-9 rounded-lg bg-[#f8fafc] flex items-center justify-center hover:bg-[#e2e8f0] border border-[#e2e8f0]"
                    title="保存为预设"
                  >
                    <Plus className="w-4 h-4 text-[#64748b]" />
                  </button>

                  {getCurrentFontPreset().isCustom && (
                    <button
                      onClick={(e) => handleDeletePreset('font', getCurrentFontPreset().id, e)}
                      className="w-9 h-9 rounded-lg bg-[#fef2f2] flex items-center justify-center hover:bg-[#fee2e2] border border-[#fecaca]"
                      title="删除预设"
                    >
                      <X className="w-4 h-4 text-[#ef4444]" />
                    </button>
                  )}
                </div>
              </div>

              {/* 背景颜色 */}
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-2">背景颜色</label>
                <div className="flex items-center gap-2" ref={bgDropdownRef}>
                  <div className="relative flex-1">
                    <button
                      onClick={() => setBgColorDropdownOpen(!bgColorDropdownOpen)}
                      className="w-full flex items-center gap-2 px-3 py-2 border border-[#e2e8f0] rounded-lg bg-white hover:border-[#6366f1] transition-colors"
                    >
                      <div
                        className="w-4 h-4 rounded border border-[#e2e8f0]"
                        style={{ backgroundColor: selectedBgColor }}
                      />
                      <span className="text-sm text-[#334155] flex-1 text-left">
                        {getCurrentBgPreset().name}
                      </span>
                      <svg className="w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {bgColorDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                        {bgColorPresets.map((preset) => (
                          <div
                            key={preset.id}
                            onClick={() => {
                              setSelectedBgColor(preset.color);
                              setBgColorDropdownOpen(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-[#f8fafc] cursor-pointer"
                          >
                            <div
                              className="w-4 h-4 rounded-full border border-[#e2e8f0]"
                              style={{ backgroundColor: preset.color }}
                            />
                            <span className="text-sm text-[#334155] flex-1">{preset.name}</span>
                            {selectedBgColor === preset.color && (
                              <Check className="w-4 h-4 text-[#6366f1]" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    type="color"
                    value={selectedBgColor}
                    onChange={(e) => setSelectedBgColor(e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-[#e2e8f0] p-0.5"
                  />

                  <button
                    onClick={() => openSaveModal('bg', selectedBgColor)}
                    className="w-9 h-9 rounded-lg bg-[#f8fafc] flex items-center justify-center hover:bg-[#e2e8f0] border border-[#e2e8f0]"
                    title="保存为预设"
                  >
                    <Plus className="w-4 h-4 text-[#64748b]" />
                  </button>

                  {getCurrentBgPreset().isCustom && (
                    <button
                      onClick={(e) => handleDeletePreset('bg', getCurrentBgPreset().id, e)}
                      className="w-9 h-9 rounded-lg bg-[#fef2f2] flex items-center justify-center hover:bg-[#fee2e2] border border-[#fecaca]"
                      title="删除预设"
                    >
                      <X className="w-4 h-4 text-[#ef4444]" />
                    </button>
                  )}
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

        {/* 右侧：实时预览区 */}
        <div className="bg-gradient-to-br from-[#f0f4ff] via-[#f8fafc] to-[#e8f0ff] rounded-2xl p-6 border border-[#e2e8f0] shadow-sm">
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

          <div className="flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <p className="text-center text-[#94a3b8] mb-4">字幕页面 - Galgame 风格悬浮字幕</p>

              <div className="relative bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-2xl p-1 shadow-2xl">
                <div className="bg-white/10 backdrop-blur-sm rounded-t-xl px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#6366f1]" />
                    <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                    <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
                  </div>
                  <button className="text-white/60 hover:text-white">
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 relative overflow-hidden rounded-b-xl" style={{ backgroundColor: selectedBgColor + Math.round(config.subtitle.opacity * 255).toString(16).padStart(2, '0') }}>
                  <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#22c55e] animate-pulse" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#6366f1]/10 via-transparent to-[#8b5cf6]/10 pointer-events-none" />
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#6366f1]/20 rounded-full blur-3xl" />
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#8b5cf6]/20 rounded-full blur-3xl" />

                  <p className="text-sm text-white/60 mb-3">💬 查看历史记录</p>
                  <p className="leading-relaxed break-words" style={{ fontSize: config.subtitle.font_size, color: selectedFontColor }}>
                    "猛地咽回了翠色的眼睛，作势抬脚要踢你，靴尖蹭到你椅腿又收了回去，褐色的碎发被风刮得糊了半张脸，耳尖唰地红了个透，声音凶得像炸毛的小狼崽"谁要你暖心？西帝国那群狗崽子见了我都得绕着走，就算被发现了我一箭一个用串成插在城墙上，能抓得住我？"顿了顿，指尖无意识抠了抠腰问的剑鞘，眼珠子转了转，故意装出不看你的样子"不过话说回来，凭啥要跑他们的地盘去？不看烦不烦的样子？"指了指鹿、猎鹿、射靶、摸鱼摸贼随便你挑，我主场还能欺负你不成？省得跑那么远路上还要花我的冤枉钱——哦不对，反正你掏钱买马不要钱啊？"顿时翻了个大大的白眼，叉着腰哼了一声"抠买买马不要钱啊？至少少兵招不到，还能顺便摸鱼顺便把新弓，亏了你出的主意靠谱？"说完先暗自封了自己的"纳尔纳帝国的弓箭手，嘴角却压不住地往上翘，藏在碎发后面的耳尖红得都快透明了"
                  </p>

                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <PenIcon className="w-4 h-4 text-[#6366f1]" />
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

      {/* 保存自定义颜色弹窗 */}
      {saveColorModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#0f172a]">保存自定义颜色</h3>
              <button
                onClick={() => setSaveColorModalOpen(false)}
                className="text-[#94a3b8] hover:text-[#64748b]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#64748b] mb-4">
              为当前{saveColorType === 'font' ? '字体' : '背景'}颜色命名，保存到预设库中。
            </p>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-lg border border-[#e2e8f0]"
                style={{ backgroundColor: saveColorValue }}
              />
              <input
                type="text"
                value={saveColorName}
                onChange={(e) => setSaveColorName(e.target.value)}
                placeholder="输入颜色名称，如：樱花粉"
                className="flex-1 px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#6366f1] focus:outline-none"
                onKeyPress={(e) => e.key === 'Enter' && handleSaveColor()}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSaveColorModalOpen(false)}
                className="px-4 py-2 text-sm text-[#64748b] hover:text-[#334155] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveColor}
                disabled={!saveColorName.trim()}
                className="px-4 py-2 bg-[#6366f1] text-white text-sm rounded-lg hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function CloseIcon({ className }: { className?: string }) {
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

function PenIcon({ className }: { className?: string }) {
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
