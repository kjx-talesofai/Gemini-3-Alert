import React, { useState } from 'react';
import { Difficulty, FactionType, GameConfig } from '../types';

interface MainMenuProps {
  onStart: (config: GameConfig) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart }) => {
  const [config, setConfig] = useState<GameConfig>({
    playerFaction: FactionType.ALLIES,
    playerStartPos: 0,
    enemyCount: 0, // Default to free play
    enemyDifficulty: Difficulty.EASY,
    enemyFaction: FactionType.SOVIET,
  });

  const locations = ["左上 (Top-Left)", "右上 (Top-Right)", "右下 (Bottom-Right)", "左下 (Bottom-Left)"];

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center text-white font-mono bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
      <div className="w-[600px] bg-gray-900 border-2 border-gray-600 shadow-2xl p-8 relative overflow-hidden">
         {/* Decor */}
         <div className="absolute top-0 left-0 w-full h-2 bg-red-600"></div>
         <div className="absolute bottom-0 right-0 w-full h-2 bg-blue-600"></div>

        <h1 className="text-4xl font-extrabold text-center mb-8 italic tracking-tighter text-red-600 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">
          RED ALERT 2 <span className="text-white text-xl block mt-2 not-italic font-normal tracking-normal">WEB SKIRMISH</span>
        </h1>

        <div className="space-y-6">
          {/* Player Setup */}
          <div className="bg-gray-800 p-4 border border-gray-700">
            <h2 className="text-yellow-500 font-bold mb-3 border-b border-gray-600 pb-1">指挥官设定 (Player)</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">阵营 (Faction)</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setConfig({...config, playerFaction: FactionType.ALLIES})}
                    className={`flex-1 py-2 text-sm font-bold border ${config.playerFaction === FactionType.ALLIES ? 'bg-blue-900 border-blue-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-400'}`}
                  >
                    盟军
                  </button>
                  <button 
                    onClick={() => setConfig({...config, playerFaction: FactionType.SOVIET})}
                    className={`flex-1 py-2 text-sm font-bold border ${config.playerFaction === FactionType.SOVIET ? 'bg-red-900 border-red-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-400'}`}
                  >
                    苏联
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">起始位置 (Location)</label>
                <select 
                  value={config.playerStartPos}
                  onChange={(e) => setConfig({...config, playerStartPos: parseInt(e.target.value)})}
                  className="w-full bg-gray-700 border border-gray-600 text-white p-2 text-sm focus:outline-none focus:border-yellow-500"
                >
                  {locations.map((loc, i) => (
                    <option key={i} value={i}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Enemy Setup */}
          <div className="bg-gray-800 p-4 border border-gray-700">
             <h2 className="text-red-500 font-bold mb-3 border-b border-gray-600 pb-1">对手设定 (Opponent)</h2>
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">对手数量 (Count)</label>
                  <div className="flex gap-2">
                     <button onClick={() => setConfig({...config, enemyCount: 0})} className={`flex-1 py-1 text-sm border ${config.enemyCount === 0 ? 'bg-green-900 border-green-500' : 'bg-gray-700 border-gray-600'}`}>无 (Free)</button>
                     <button onClick={() => setConfig({...config, enemyCount: 1})} className={`flex-1 py-1 text-sm border ${config.enemyCount === 1 ? 'bg-red-900 border-red-500' : 'bg-gray-700 border-gray-600'}`}>1 AI</button>
                  </div>
                </div>
                <div>
                   <label className="block text-xs text-gray-400 mb-1">AI 难度 (Difficulty)</label>
                   <select 
                    disabled={config.enemyCount === 0}
                    value={config.enemyDifficulty}
                    onChange={(e) => setConfig({...config, enemyDifficulty: e.target.value as Difficulty})}
                    className={`w-full bg-gray-700 border border-gray-600 text-white p-2 text-sm focus:outline-none focus:border-red-500 ${config.enemyCount === 0 ? 'opacity-50' : ''}`}
                   >
                      <option value={Difficulty.EASY}>简单 (Easy)</option>
                      <option value={Difficulty.MEDIUM}>普通 (Medium)</option>
                      <option value={Difficulty.HARD}>冷酷 (Brutal)</option>
                   </select>
                </div>
             </div>
          </div>

          <button 
            onClick={() => onStart(config)}
            className="w-full py-4 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 border-2 border-red-400 text-white font-black text-xl uppercase tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all transform hover:scale-[1.01] active:scale-[0.99]"
          >
            开始游戏 (Start Game)
          </button>
        </div>
      </div>
    </div>
  );
};