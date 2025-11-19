
import React, { useState, useEffect, useRef } from 'react';
import { EntityType, EntityStats, FactionType, PlayerState } from '../types';
import { STATS, POWER_VALUES } from '../constants';
import { getFactionEntityName } from '../utils';
import { AudioManager } from '../audio';

interface SidebarProps {
  playerState: PlayerState;
  onPlaceBuilding: (type: EntityType) => void;
  onTrainUnit: (type: EntityType) => void;
  existingBuildings: Set<EntityType>;
  minimapRef: React.RefObject<HTMLCanvasElement | null>; // Canvas ref passed from Game
}

export const Sidebar: React.FC<SidebarProps> = ({ playerState, onPlaceBuilding, onTrainUnit, existingBuildings, minimapRef }) => {
  const [activeTab, setActiveTab] = useState<'BUILD' | 'DEFENSE' | 'INFANTRY' | 'VEHICLE'>('BUILD');
  const [buildingQueue, setBuildingQueue] = useState<{type: EntityType, progress: number, ready: boolean} | null>(null);
  
  const lastErrorSound = useRef<number>(0);

  // Basic Building/Unit Lists
  const buildings = [EntityType.POWER_PLANT, EntityType.ORE_REFINERY, EntityType.BARRACKS, EntityType.WAR_FACTORY];
  const infantry = [EntityType.SOLDIER];
  const vehicles = [EntityType.HARVESTER, EntityType.TANK, EntityType.HEAVY_TANK];

  // Simulation of build time
  useEffect(() => {
    if (buildingQueue && !buildingQueue.ready) {
      AudioManager.getInstance().playSfx('BUILD');

      const stats = STATS[buildingQueue.type];
      const timer = setInterval(() => {
        setBuildingQueue(prev => {
          if (!prev) return null;
          const newProgress = prev.progress + (100 / (stats.buildTime * 10)); 
          if (newProgress >= 100) {
            if (stats.isBuilding) {
                 AudioManager.getInstance().playSystem('construction_complete');
            } else {
                 AudioManager.getInstance().playSystem('unit_ready');
            }
            return { ...prev, progress: 100, ready: true };
          }
          return { ...prev, progress: newProgress };
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [buildingQueue]);

  const handleBuildClick = (type: EntityType) => {
    const stats = STATS[type];
    
    if (playerState.credits < stats.cost) {
        const now = Date.now();
        if (now - lastErrorSound.current > 2000) {
            AudioManager.getInstance().playSystem('insufficient_funds');
            lastErrorSound.current = now;
        }
        return;
    }

    if (stats.isBuilding) {
      if (buildingQueue) {
        if (buildingQueue.ready && buildingQueue.type === type) {
            onPlaceBuilding(type);
            setBuildingQueue(null);
        } else {
            setBuildingQueue(null);
        }
      } else {
        setBuildingQueue({ type, progress: 0, ready: false });
        AudioManager.getInstance().playSystem('building');
      }
    } else {
        onTrainUnit(type);
    }
  };

  const renderButton = (type: EntityType) => {
    const stats = STATS[type];
    const powerUsage = POWER_VALUES[type] || 0;
    
    const prereqMet = !stats.prerequisite || existingBuildings.has(stats.prerequisite);

    if (!prereqMet) return null;

    const isReady = buildingQueue?.type === type && buildingQueue.ready;
    const isBuilding = buildingQueue?.type === type && !buildingQueue.ready;
    
    const isQueueBusy = buildingQueue !== null && buildingQueue.type !== type;
    const isDisabled = (playerState.credits < stats.cost && !isReady && !isBuilding) || isQueueBusy;

    const displayName = getFactionEntityName(type, playerState.faction);

    return (
      <div 
        key={type}
        onClick={() => handleBuildClick(type)} 
        className={`
          relative flex flex-col items-center justify-center w-full h-20 border-2 mb-2 cursor-pointer select-none transition-all
          ${isDisabled ? 'opacity-40 border-gray-700 bg-gray-900 grayscale' : 'border-gray-500 bg-gray-800 hover:bg-gray-700 hover:border-yellow-400'}
          ${isReady ? 'animate-pulse border-green-500 bg-green-900' : ''}
        `}
      >
        <div className="text-sm font-bold text-center text-white leading-tight mb-1 drop-shadow-md">{displayName}</div>
        <div className={`text-xs font-mono ${playerState.credits < stats.cost ? 'text-red-500' : 'text-yellow-400'}`}>${stats.cost}</div>
        
        {powerUsage !== 0 && (
             <div className={`text-[10px] absolute top-1 right-1 font-mono font-bold ${powerUsage > 0 ? 'text-green-400' : 'text-red-400'}`}>
                 {powerUsage > 0 ? '+' : ''}{powerUsage}⚡
             </div>
        )}

        {isBuilding && (
          <div className="absolute bottom-0 left-0 h-1 bg-yellow-500 transition-all duration-100" style={{ width: `${buildingQueue?.progress}%` }} />
        )}
        {isReady && (
             <div className="absolute inset-0 flex items-center justify-center bg-green-500/40 text-white font-bold tracking-widest uppercase shadow-[0_0_10px_rgba(34,197,94,0.8)]">就绪</div>
        )}
        {buildingQueue?.type === type && !buildingQueue.ready && (
             <div className="absolute inset-0 flex items-center justify-center text-yellow-200/50 font-bold text-xs uppercase">建造中...</div>
        )}
      </div>
    );
  };

  return (
    <div className="w-56 h-full bg-[#1a1a1a] border-l-4 border-gray-600 flex flex-col shadow-2xl z-10 select-none">
      {/* Logo / Top */}
      <div className="h-16 bg-gray-900 border-b border-gray-600 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        <h1 className="text-red-600 font-extrabold text-xl tracking-tighter italic drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">RED ALERT 2</h1>
      </div>

      {/* Radar / Minimap */}
      <div className="h-48 bg-black border-b-4 border-gray-700 relative">
         <canvas 
            ref={minimapRef} 
            width={200} 
            height={200} 
            className="w-full h-full object-contain cursor-crosshair"
         />
         <span className="absolute bottom-1 right-2 text-[10px] text-green-400 font-mono tracking-wider pointer-events-none">RADAR ONLINE</span>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-0.5 bg-black">
        <button onClick={() => setActiveTab('BUILD')} className={`p-2 text-xs font-bold uppercase ${activeTab === 'BUILD' ? 'bg-gray-700 text-white border-b-2 border-yellow-500' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>建筑</button>
        <button onClick={() => setActiveTab('DEFENSE')} className={`p-2 text-xs font-bold uppercase ${activeTab === 'DEFENSE' ? 'bg-gray-700 text-white border-b-2 border-yellow-500' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>防御</button>
        <button onClick={() => setActiveTab('INFANTRY')} className={`p-2 text-xs font-bold uppercase ${activeTab === 'INFANTRY' ? 'bg-gray-700 text-white border-b-2 border-yellow-500' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>步兵</button>
        <button onClick={() => setActiveTab('VEHICLE')} className={`p-2 text-xs font-bold uppercase ${activeTab === 'VEHICLE' ? 'bg-gray-700 text-white border-b-2 border-yellow-500' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>战车</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-600 bg-gray-900/50">
        {activeTab === 'BUILD' && buildings.map(renderButton)}
        {activeTab === 'INFANTRY' && infantry.map(renderButton)}
        {activeTab === 'VEHICLE' && vehicles.map(renderButton)}
        {activeTab === 'DEFENSE' && <div className="text-gray-500 text-center text-xs mt-4">无可用防御建筑</div>}
      </div>
    </div>
  );
};
