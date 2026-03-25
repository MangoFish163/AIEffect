import React from 'react';
import { Sidebar } from './components/Sidebar';
import { ControlPanel } from './pages/ControlPanel';
import { SubtitleVisual } from './pages/SubtitleVisual';
import { VoiceConfig } from './pages/VoiceConfig';
import { MemoryManager } from './pages/MemoryManager';
import { CharacterManager } from './pages/CharacterManager';
import { LogsViewer } from './pages/LogsViewer';
import { AgentsOfficeZones } from './pages/AgentsOfficeZones';
import { useAppStore } from './store';

const App: React.FC = () => {
  const { currentPage } = useAppStore();

  const renderPage = () => {
    switch (currentPage) {
      case 'control':
        return <ControlPanel />;
      case 'subtitle':
        return <SubtitleVisual />;
      case 'voice':
        return <VoiceConfig />;
      case 'memory':
        return <MemoryManager />;
      case 'character':
        return <CharacterManager />;
      case 'logs':
        return <LogsViewer />;
      case 'agents':
        return <AgentsOfficeZones />;
      default:
        return <ControlPanel />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
