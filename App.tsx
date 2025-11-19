
import React, { useState } from 'react';
import { MainMenu } from './components/MainMenu';
import { Game } from './components/Game';
import { GameConfig } from './types';
import { AudioManager } from './audio';

export default function App() {
  const [config, setConfig] = useState<GameConfig | null>(null);

  const handleStart = (cfg: GameConfig) => {
    // Browser blocks AudioContext unless started via user gesture
    AudioManager.getInstance().resume();
    setConfig(cfg);
  };

  if (!config) {
    return <MainMenu onStart={handleStart} />;
  }

  return (
    <Game 
      config={config} 
      onExit={() => setConfig(null)} 
    />
  );
}
