
import React, { useEffect, useRef, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Entity, EntityType, FactionType, Particle, PlayerState, Vector2, GameConfig, Difficulty } from '../types';
import { STATS, POWER_VALUES, MAP_HEIGHT, MAP_WIDTH, GRID_SIZE, ORE_VALUE, HARVESTER_CAPACITY, FACTION_COLORS } from '../constants';
import { distance, normalize, getCenter, getFactionEntityName } from '../utils';
import { AudioManager } from '../audio';

interface GameProps {
  config: GameConfig;
  onExit: () => void;
}

export const Game: React.FC<GameProps> = ({ config, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  
  // Game State References
  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const selectionStartRef = useRef<Vector2 | null>(null);
  const cameraRef = useRef<Vector2>({ x: 0, y: 0 });
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<Vector2>({ x: 0, y: 0 });
  const frameRef = useRef<number>(0);
  const lastUnderAttackRef = useRef<number>(0);
  const placementModeRef = useRef<EntityType | null>(null);
  const prevBuildingsRef = useRef<Set<EntityType>>(new Set());
  const aiActionCooldownRef = useRef<number>(0); // Cooldown to prevent instant rebuilds

  // Input State Refs
  const keysPressedRef = useRef<Set<string>>(new Set());
  const isMiddleDraggingRef = useRef<boolean>(false);
  const lastMiddleDragPosRef = useRef<Vector2>({ x: 0, y: 0 });

  // React State
  const [playerState, setPlayerState] = useState<PlayerState>({
    credits: 3000,
    power: 0,
    powerUsage: 0,
    faction: config.playerFaction
  });
  
  const [enemyState, setEnemyState] = useState<PlayerState>({
    // Give AI a bit more starting cash to ensure they reach War Factory
    credits: config.enemyDifficulty === Difficulty.HARD ? 8000 : 5000,
    power: 0,
    powerUsage: 0,
    faction: config.enemyFaction
  });

  const [placementMode, setPlacementMode] = useState<EntityType | null>(null);
  const [existingBuildings, setExistingBuildings] = useState<Set<EntityType>>(new Set());
  const [gameTime, setGameTime] = useState(0); 

  useEffect(() => {
    placementModeRef.current = placementMode;
  }, [placementMode]);

  // --- Input Listeners (Keyboard / Global) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        keysPressedRef.current.add(e.key.toLowerCase());
        
        // 'H' for Home
        if (e.key.toLowerCase() === 'h') {
            const base = entitiesRef.current.find(ent => ent.type === EntityType.CONSTRUCTION_YARD && ent.faction === config.playerFaction);
            if (base) {
                centerCamera(base.position);
            }
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        keysPressedRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [config.playerFaction]);

  // --- Tech Unlock Notification Logic ---
  useEffect(() => {
    const current = existingBuildings;
    const prev = prevBuildingsRef.current;
    const techBuildings = [EntityType.POWER_PLANT, EntityType.BARRACKS, EntityType.WAR_FACTORY];
    const added = [...current].filter(b => !prev.has(b));
    if (added.some(b => techBuildings.includes(b))) {
        if (gameTime > 0) {
            AudioManager.getInstance().playSystem('new_construction_options');
        }
    }
    prevBuildingsRef.current = current;
  }, [existingBuildings, gameTime]);

  // --- Helpers ---
  const centerCamera = (pos: Vector2) => {
    cameraRef.current = {
        x: Math.max(0, Math.min(MAP_WIDTH - window.innerWidth, pos.x - window.innerWidth/2)),
        y: Math.max(0, Math.min(MAP_HEIGHT - window.innerHeight, pos.y - window.innerHeight/2))
    };
  };

  const spawnEntity = (type: EntityType, pos: Vector2, faction: FactionType): Entity => {
    const stats = STATS[type];
    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      faction,
      position: { ...pos },
      hp: stats.hp,
      maxHp: stats.hp,
      targetPosition: null,
      targetEntityId: null,
      cooldown: 0,
      state: 'IDLE',
      cargo: 0
    };
  };

  const createExplosion = (pos: Vector2) => {
    particlesRef.current.push({
      id: Math.random().toString(),
      position: pos,
      life: 20,
      color: '#fbbf24',
      type: 'EXPLOSION'
    });
    AudioManager.getInstance().playSfx('EXPLOSION');
  };

  const createFloatText = (pos: Vector2, text: string, color: string) => {
     particlesRef.current.push({
      id: Math.random().toString(),
      position: { x: pos.x, y: pos.y - 30 },
      life: 50,
      color: color,
      type: 'TEXT',
      text
    });
  }

  // Initialize Game
  useEffect(() => {
    const positions = [
        { x: 200, y: 200 },   // TL
        { x: 1800, y: 200 },  // TR
        { x: 1800, y: 1800 }, // BR
        { x: 200, y: 1800 }   // BL
    ];

    const playerPos = positions[config.playerStartPos];
    const pYard = spawnEntity(EntityType.CONSTRUCTION_YARD, playerPos, config.playerFaction);
    
    let initialEntities = [pYard];

    // Enemy Spawn
    if (config.enemyCount > 0) {
        const enemyPosIndex = (config.playerStartPos + 2) % 4;
        const enemyPos = positions[enemyPosIndex];
        const eYard = spawnEntity(EntityType.CONSTRUCTION_YARD, enemyPos, config.enemyFaction);
        initialEntities.push(eYard);
        if (config.enemyDifficulty === Difficulty.HARD) {
             initialEntities.push(spawnEntity(EntityType.SOLDIER, {x: enemyPos.x + 100, y: enemyPos.y + 100}, config.enemyFaction));
        }
    }
    
    // Spawn Ore
    for(let i=0; i<40; i++) {
        initialEntities.push(spawnEntity(EntityType.ORE_PATCH, { 
            x: 200 + Math.random() * 1600, 
            y: 200 + Math.random() * 1600 
        }, FactionType.NEUTRAL));
    }

    entitiesRef.current = initialEntities;
    entitiesRef.current.push(spawnEntity(EntityType.SOLDIER, { x: playerPos.x + 100, y: playerPos.y + 100 }, config.playerFaction));
    
    centerCamera(playerPos);

  }, [config]);

  // Main Game Loop
  useEffect(() => {
    let animationId: number;

    const update = () => {
      frameRef.current++;
      
      if (frameRef.current % 60 === 0) {
          setGameTime(t => t + 1);
      }

      if (aiActionCooldownRef.current > 0) {
          aiActionCooldownRef.current--;
      }

      // --- Camera Pan (Keyboard) ---
      const keys = keysPressedRef.current;
      const panSpeed = 15;
      if (keys.has('arrowup') || keys.has('w')) cameraRef.current.y -= panSpeed;
      if (keys.has('arrowdown') || keys.has('s')) cameraRef.current.y += panSpeed;
      if (keys.has('arrowleft') || keys.has('a')) cameraRef.current.x -= panSpeed;
      if (keys.has('arrowright') || keys.has('d')) cameraRef.current.x += panSpeed;

      // Clamp Camera
      const canvasWidth = window.innerWidth - 224; // 224 = Sidebar width
      const canvasHeight = window.innerHeight;
      cameraRef.current.x = Math.max(0, Math.min(MAP_WIDTH - canvasWidth, cameraRef.current.x));
      cameraRef.current.y = Math.max(0, Math.min(MAP_HEIGHT - canvasHeight, cameraRef.current.y));


      const entities = entitiesRef.current;
      const particles = particlesRef.current;

      // 1. Update Entities
      entities.forEach(ent => {
        const stats = STATS[ent.type];
        const center = getCenter(ent, stats);

        if (ent.cooldown > 0) ent.cooldown--;

        // --- HARVESTER LOGIC ---
        if (ent.type === EntityType.HARVESTER) {
            if (ent.state !== 'MOVING') { 
                if (ent.cargo >= HARVESTER_CAPACITY) {
                    ent.state = 'RETURNING';
                } else if (ent.state === 'IDLE' || (ent.state === 'GATHERING' && !ent.targetEntityId)) {
                    const ores = entities.filter(e => e.type === EntityType.ORE_PATCH && e.hp > 0);
                    if (ores.length > 0) {
                        const closestOre = ores.sort((a,b) => distance(ent.position, a.position) - distance(ent.position, b.position))[0];
                        ent.targetEntityId = closestOre.id;
                        ent.state = 'GATHERING';
                    }
                }
            }

            if (ent.state === 'RETURNING') {
                let refinery = entities.find(e => e.id === ent.targetEntityId);
                if (!refinery || refinery.type !== EntityType.ORE_REFINERY || refinery.faction !== ent.faction || refinery.hp <= 0) {
                    const refineries = entities.filter(e => e.type === EntityType.ORE_REFINERY && e.faction === ent.faction && e.hp > 0);
                    if (refineries.length > 0) {
                        refinery = refineries.sort((a,b) => distance(ent.position, a.position) - distance(ent.position, b.position))[0];
                        ent.targetEntityId = refinery.id;
                    }
                }

                if (refinery) {
                    const dist = distance(center, getCenter(refinery, STATS[refinery.type]));
                    if (dist < 100) { 
                        const dumpAmount = ent.cargo;
                        if (dumpAmount > 0) {
                            if (ent.faction === config.playerFaction) {
                                setPlayerState(p => ({...p, credits: p.credits + dumpAmount}));
                                createFloatText(ent.position, `+$${dumpAmount}`, '#10b981');
                            } else {
                                setEnemyState(p => ({...p, credits: p.credits + dumpAmount}));
                            }
                            ent.cargo = 0;
                        }
                        ent.state = 'IDLE';
                        ent.targetEntityId = null;
                    } else {
                        const dir = normalize({ x: refinery.position.x - ent.position.x, y: refinery.position.y - ent.position.y });
                        ent.position.x += dir.x * stats.speed;
                        ent.position.y += dir.y * stats.speed;
                    }
                } else {
                    ent.state = 'IDLE';
                }
            } 
            else if (ent.state === 'GATHERING') {
                let targetOre = entities.find(e => e.id === ent.targetEntityId);
                if (!targetOre || targetOre.hp <= 0) {
                     const ores = entities.filter(e => e.type === EntityType.ORE_PATCH && e.hp > 0);
                     if (ores.length > 0) {
                         targetOre = ores.sort((a,b) => distance(ent.position, a.position) - distance(ent.position, b.position))[0];
                         ent.targetEntityId = targetOre.id;
                     } else {
                         ent.state = 'IDLE';
                         ent.targetEntityId = null;
                     }
                }
                if (targetOre) {
                    const dist = distance(center, getCenter(targetOre, STATS[targetOre.type]));
                    if (dist < 50) {
                        if (ent.cooldown <= 0) {
                            ent.cooldown = 15;
                            const amount = Math.min(25, HARVESTER_CAPACITY - ent.cargo);
                            ent.cargo += amount;
                            targetOre.hp -= amount;
                            if (ent.cargo >= HARVESTER_CAPACITY) {
                                ent.state = 'RETURNING';
                                ent.targetEntityId = null;
                            }
                        }
                    } else {
                        const dir = normalize({ x: targetOre.position.x - ent.position.x, y: targetOre.position.y - ent.position.y });
                        ent.position.x += dir.x * stats.speed;
                        ent.position.y += dir.y * stats.speed;
                    }
                }
            }
            else if (ent.state === 'MOVING') {
                if (ent.targetPosition) {
                    const d = distance(ent.position, ent.targetPosition);
                    if (d < 5) {
                        ent.targetPosition = null;
                        ent.state = 'IDLE';
                    } else {
                        const dir = normalize({ x: ent.targetPosition.x - ent.position.x, y: ent.targetPosition.y - ent.position.y });
                        ent.position.x += dir.x * stats.speed;
                        ent.position.y += dir.y * stats.speed;
                    }
                }
            }
        }

        // --- COMBAT LOGIC ---
        else if (!stats.isBuilding) {
             if (ent.targetEntityId) {
                 const target = entities.find(e => e.id === ent.targetEntityId);
                 if (target && target.hp > 0) {
                    const d = distance(center, getCenter(target, STATS[target.type]));
                    if (d <= stats.range) {
                        ent.state = 'ATTACKING';
                        if (ent.cooldown <= 0) {
                            ent.cooldown = stats.attackSpeed;
                            particles.push({
                                id: Math.random().toString(),
                                position: center,
                                life: 10,
                                color: ent.faction === config.playerFaction ? '#60a5fa' : '#f87171',
                                type: 'SHOT'
                            });
                            if (distance(center, {x: cameraRef.current.x + window.innerWidth/2, y: cameraRef.current.y + window.innerHeight/2}) < window.innerWidth) {
                                AudioManager.getInstance().playSfx('SHOT');
                            }
                            target.hp -= stats.damage;
                            if (target.faction === config.playerFaction && Date.now() - lastUnderAttackRef.current > 5000) {
                                AudioManager.getInstance().playSystem('base_under_attack');
                                lastUnderAttackRef.current = Date.now();
                            }
                            if (target.hp <= 0) {
                                ent.targetEntityId = null;
                                ent.state = 'IDLE';
                                createExplosion(target.position);
                            }
                        }
                    } else {
                        ent.state = 'MOVING';
                        const dir = normalize({ x: target.position.x - ent.position.x, y: target.position.y - ent.position.y });
                        ent.position.x += dir.x * stats.speed;
                        ent.position.y += dir.y * stats.speed;
                    }
                 } else {
                     ent.targetEntityId = null;
                     ent.state = 'IDLE';
                 }
             }
             else if (ent.targetPosition) {
                ent.state = 'MOVING';
                const d = distance(ent.position, ent.targetPosition);
                if (d < 5) {
                    ent.targetPosition = null;
                    ent.state = 'IDLE';
                } else {
                    const dir = normalize({ x: ent.targetPosition.x - ent.position.x, y: ent.targetPosition.y - ent.position.y });
                    ent.position.x += dir.x * stats.speed;
                    ent.position.y += dir.y * stats.speed;
                }
            } else {
                const enemy = entities.find(e => e.faction !== ent.faction && e.faction !== FactionType.NEUTRAL && distance(center, e.position) < stats.range + 100);
                if (enemy) ent.targetEntityId = enemy.id;
            }
        }
      });

      // 2. Cleanup Dead
      entitiesRef.current = entities.filter(e => e.hp > 0);

      // 3. Sync State
      if (frameRef.current % 10 === 0) {
          const myBuildings = new Set(
              entitiesRef.current
              .filter(e => e.faction === config.playerFaction && STATS[e.type].isBuilding)
              .map(e => e.type)
          );
          setExistingBuildings(prev => {
             if (prev.size !== myBuildings.size) return myBuildings;
             for (let b of myBuildings) if (!prev.has(b)) return myBuildings;
             return prev;
          });
          let power = 0;
          let usage = 0;
          entitiesRef.current.forEach(e => {
              if (e.faction === config.playerFaction && STATS[e.type].isBuilding) {
                  const val = POWER_VALUES[e.type] || 0;
                  if (val > 0) power += val;
                  if (val < 0) usage += Math.abs(val);
              }
          });
          setPlayerState(prev => {
              if (prev.power !== power || prev.powerUsage !== usage) return {...prev, power, powerUsage: usage};
              return prev;
          });
      }

      // 4. AI Logic
      if (config.enemyCount > 0) {
          const aiInterval = config.enemyDifficulty === Difficulty.HARD ? 30 : (config.enemyDifficulty === Difficulty.EASY ? 120 : 60);
          if (frameRef.current % aiInterval === 0) runAI(enemyState, entitiesRef.current, config.enemyDifficulty);
      }

      // 5. Render Main Canvas
      render();

      // 6. Render Minimap
      renderMinimap(canvasWidth, canvasHeight);
      
      animationId = requestAnimationFrame(update);
    };

    const runAI = (state: PlayerState, entities: Entity[], difficulty: Difficulty) => {
        const faction = config.enemyFaction;
        const myBuildings = entities.filter(e => e.faction === faction && STATS[e.type].isBuilding);
        const myUnits = entities.filter(e => e.faction === faction && !STATS[e.type].isBuilding);
        const enemyBase = entities.find(e => e.faction === config.playerFaction && e.type === EntityType.CONSTRUCTION_YARD);
        const myBase = myBuildings.find(e => e.type === EntityType.CONSTRUCTION_YARD);

        if (!myBase && myUnits.length === 0) return; // Defeated

        // Resource Cheats / Trickle
        if (difficulty === Difficulty.HARD && state.credits < 2000) {
            setEnemyState(s => ({...s, credits: s.credits + 50}));
        } else if (difficulty === Difficulty.MEDIUM && state.credits < 500) {
            setEnemyState(s => ({...s, credits: s.credits + 10}));
        }

        // --- Building Logic ---
        // AI Cooldown check to prevent instant rebuilds (the "Heal" bug)
        if (aiActionCooldownRef.current <= 0 && myBase && state.credits > 0) {
             const hasPower = myBuildings.some(e => e.type === EntityType.POWER_PLANT);
             const hasRefinery = myBuildings.some(e => e.type === EntityType.ORE_REFINERY);
             const hasBarracks = myBuildings.some(e => e.type === EntityType.BARRACKS);
             const hasWarFactory = myBuildings.some(e => e.type === EntityType.WAR_FACTORY);

             // Priority Order:
             // 1. Initial Power (if none)
             if (!hasPower && state.credits >= STATS[EntityType.POWER_PLANT].cost) {
                 entitiesRef.current.push(spawnEntity(EntityType.POWER_PLANT, { x: myBase.position.x - 80, y: myBase.position.y }, faction));
                 setEnemyState(s => ({...s, credits: s.credits - STATS[EntityType.POWER_PLANT].cost}));
                 aiActionCooldownRef.current = 300; // 5 seconds wait
             }
             // 2. Refinery (if none)
             else if (!hasRefinery && hasPower && state.credits >= STATS[EntityType.ORE_REFINERY].cost) {
                 entitiesRef.current.push(spawnEntity(EntityType.ORE_REFINERY, { x: myBase.position.x, y: myBase.position.y - 100 }, faction));
                 entitiesRef.current.push(spawnEntity(EntityType.HARVESTER, { x: myBase.position.x + 40, y: myBase.position.y - 100 }, faction));
                 setEnemyState(s => ({...s, credits: s.credits - STATS[EntityType.ORE_REFINERY].cost}));
                 aiActionCooldownRef.current = 300;
             }
             // 3. Barracks (if none)
             else if (!hasBarracks && hasRefinery && state.credits >= STATS[EntityType.BARRACKS].cost) {
                 entitiesRef.current.push(spawnEntity(EntityType.BARRACKS, { x: myBase.position.x + 100, y: myBase.position.y }, faction));
                 setEnemyState(s => ({...s, credits: s.credits - STATS[EntityType.BARRACKS].cost}));
                 aiActionCooldownRef.current = 300;
             }
             // 4. War Factory (if none)
             else if (!hasWarFactory && hasBarracks && state.credits >= STATS[EntityType.WAR_FACTORY].cost) {
                 entitiesRef.current.push(spawnEntity(EntityType.WAR_FACTORY, { x: myBase.position.x, y: myBase.position.y + 120 }, faction));
                 setEnemyState(s => ({...s, credits: s.credits - STATS[EntityType.WAR_FACTORY].cost}));
                 aiActionCooldownRef.current = 300;
             }
             // 5. Additional Power (If low power)
             // AI calculates its own power needs roughly
             else {
                 let power = 0;
                 let usage = 0;
                 entities.forEach(e => {
                    if (e.faction === faction && STATS[e.type].isBuilding) {
                        const val = POWER_VALUES[e.type] || 0;
                        if (val > 0) power += val;
                        if (val < 0) usage += Math.abs(val);
                    }
                 });
                 
                 if (usage >= power && state.credits >= STATS[EntityType.POWER_PLANT].cost) {
                     // Build extra power plant slightly offset
                     const offset = myBuildings.filter(e => e.type === EntityType.POWER_PLANT).length * 50;
                     entitiesRef.current.push(spawnEntity(EntityType.POWER_PLANT, { x: myBase.position.x - 80, y: myBase.position.y + 60 + offset }, faction));
                     setEnemyState(s => ({...s, credits: s.credits - STATS[EntityType.POWER_PLANT].cost}));
                     aiActionCooldownRef.current = 300;
                 }
             }
        }

        // --- Unit Production Logic ---
        if (aiActionCooldownRef.current <= 0) {
            const hasWarFactory = myBuildings.some(e => e.type === EntityType.WAR_FACTORY);
             
            if (hasWarFactory) {
                const factory = myBuildings.find(e => e.type === EntityType.WAR_FACTORY);
                if (factory) {
                    let type = EntityType.TANK;
                    if (difficulty === Difficulty.HARD && Math.random() > 0.6) type = EntityType.HEAVY_TANK;
                    if (difficulty === Difficulty.EASY && Math.random() > 0.8) type = EntityType.HEAVY_TANK;
                    const cost = STATS[type].cost;
                    if (state.credits >= cost) {
                        entitiesRef.current.push(spawnEntity(type, { x: factory.position.x, y: factory.position.y + 100 }, faction));
                        setEnemyState(s => ({...s, credits: s.credits - cost}));
                        aiActionCooldownRef.current = 180; // 3 seconds between tanks
                    }
                }
            }
        }

        // --- Attack Logic ---
        const attackThreshold = difficulty === Difficulty.HARD ? 5 : (difficulty === Difficulty.MEDIUM ? 10 : 15);
        if (myUnits.length > attackThreshold && enemyBase) {
            myUnits.forEach(u => {
                if (u.type !== EntityType.HARVESTER && !u.targetEntityId && !u.targetPosition) {
                    if (Math.random() < 0.05) {
                        u.targetPosition = {
                            x: enemyBase.position.x + (Math.random() * 300 - 150),
                            y: enemyBase.position.y + (Math.random() * 300 - 150)
                        };
                    }
                }
            });
        }
    };

    const render = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, cvs.width, cvs.height);

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let x = -cameraRef.current.x % 50; x < cvs.width; x+=50) {
          ctx.moveTo(x, 0); ctx.lineTo(x, cvs.height);
      }
      for(let y = -cameraRef.current.y % 50; y < cvs.height; y+=50) {
        ctx.moveTo(0, y); ctx.lineTo(cvs.width, y);
      }
      ctx.stroke();

      entitiesRef.current.forEach(ent => {
          const screenX = ent.position.x - cameraRef.current.x;
          const screenY = ent.position.y - cameraRef.current.y;
          const stats = STATS[ent.type];
          const isSelected = selectedIdsRef.current.has(ent.id);

          if (isSelected) {
              ctx.strokeStyle = '#00ff00';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.ellipse(screenX + stats.width/2, screenY + stats.height, stats.width/1.5, stats.height/3, 0, 0, Math.PI*2);
              ctx.stroke();
          }

          ctx.fillStyle = ent.type === EntityType.ORE_PATCH ? stats.color : FACTION_COLORS[ent.faction];
          if (stats.isBuilding) {
            ctx.fillRect(screenX, screenY, stats.width, stats.height);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(screenX + 5, screenY + 5, stats.width - 10, stats.height - 10);
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(screenX + 10, screenY + 10, 10, 10);
          } else {
            ctx.beginPath();
            ctx.arc(screenX + stats.width/2, screenY + stats.height/2, stats.width/2, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(screenX + stats.width/2, screenY + stats.height/2, stats.width/4, 0, Math.PI*2);
            ctx.fill();
            if (ent.type === EntityType.HARVESTER && ent.cargo > 0) {
                 ctx.fillStyle = '#ffd700';
                 const pct = ent.cargo / HARVESTER_CAPACITY;
                 ctx.fillRect(screenX, screenY - 5, stats.width * pct, 3);
            }
          }

          if (ent.hp < ent.maxHp || isSelected) {
              const hpPct = ent.hp / ent.maxHp;
              ctx.fillStyle = 'red';
              ctx.fillRect(screenX, screenY - 8, stats.width, 4);
              ctx.fillStyle = '#00ff00';
              ctx.fillRect(screenX, screenY - 8, stats.width * hpPct, 4);
          }

          const name = getFactionEntityName(ent.type, ent.faction);
          ctx.font = '10px "Microsoft YaHei", sans-serif';
          const textWidth = ctx.measureText(name).width;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(screenX + stats.width/2 - textWidth/2 - 2, screenY + stats.height + 4, textWidth + 4, 12);
          ctx.fillStyle = ent.faction === FactionType.SOVIET ? '#ffaaaa' : (ent.faction === FactionType.NEUTRAL ? '#fbbf24' : '#aaddee');
          if (ent.faction === FactionType.NEUTRAL) ctx.fillStyle = '#ccc';
          ctx.fillText(name, screenX + stats.width/2 - textWidth/2, screenY + stats.height + 14);
      });

      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      particlesRef.current.forEach(p => {
          p.life--;
          const screenX = p.position.x - cameraRef.current.x;
          const screenY = p.position.y - cameraRef.current.y;
          
          if (p.type === 'EXPLOSION') {
            ctx.fillStyle = `rgba(255, 100, 0, ${p.life / 20})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 25 - p.life/2, 0, Math.PI*2);
            ctx.fill();
          } else if (p.type === 'SHOT') {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 3, 0, Math.PI*2);
            ctx.fill();
          } else if (p.type === 'TEXT' && p.text) {
              ctx.font = 'bold 14px "Microsoft YaHei"';
              ctx.fillStyle = p.color;
              ctx.strokeStyle = 'black';
              ctx.lineWidth = 2;
              ctx.globalAlpha = p.life / 50;
              ctx.strokeText(p.text, screenX, screenY - (50 - p.life));
              ctx.fillText(p.text, screenX, screenY - (50 - p.life));
              ctx.globalAlpha = 1;
          }
      });

      const pMode = placementModeRef.current;
      if (pMode) {
          const stats = STATS[pMode];
          const mx = mouseRef.current.x;
          const my = mouseRef.current.y;
          const worldX = mx + cameraRef.current.x;
          const worldY = my + cameraRef.current.y;
          const snapX = Math.floor(worldX / GRID_SIZE) * GRID_SIZE - cameraRef.current.x;
          const snapY = Math.floor(worldY / GRID_SIZE) * GRID_SIZE - cameraRef.current.y;
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = stats.color;
          ctx.fillRect(snapX, snapY, stats.width, stats.height);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(snapX, snapY, stats.width, stats.height);
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#fff';
          ctx.fillText("建造", snapX, snapY - 5);
      }

      if (selectionStartRef.current) {
          const sx = selectionStartRef.current.x - cameraRef.current.x;
          const sy = selectionStartRef.current.y - cameraRef.current.y;
          const mx = mouseRef.current.x;
          const my = mouseRef.current.y;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, sy, mx - sx, my - sy);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(sx, sy, mx - sx, my - sy);
      }
    };

    const renderMinimap = (viewWidth: number, viewHeight: number) => {
        const mCtx = minimapRef.current?.getContext('2d');
        if (!mCtx) return;
        
        // Minimap Size
        const mW = 200; 
        const mH = 200;
        const scaleX = mW / MAP_WIDTH;
        const scaleY = mH / MAP_HEIGHT;

        mCtx.fillStyle = '#000';
        mCtx.fillRect(0, 0, mW, mH);

        // Draw Entities
        entitiesRef.current.forEach(ent => {
            const stats = STATS[ent.type];
            mCtx.fillStyle = ent.type === EntityType.ORE_PATCH ? '#d97706' : FACTION_COLORS[ent.faction];
            const w = Math.max(2, stats.width * scaleX);
            const h = Math.max(2, stats.height * scaleY);
            mCtx.fillRect(ent.position.x * scaleX, ent.position.y * scaleY, w, h);
        });

        // Draw Camera Viewport
        mCtx.strokeStyle = '#fff';
        mCtx.lineWidth = 1;
        mCtx.strokeRect(
            cameraRef.current.x * scaleX, 
            cameraRef.current.y * scaleY, 
            viewWidth * scaleX, 
            viewHeight * scaleY
        );
    };

    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [config]); 

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Middle Click Drag Start
    if (e.button === 1) {
        e.preventDefault();
        isMiddleDraggingRef.current = true;
        lastMiddleDragPosRef.current = { x: e.clientX, y: e.clientY };
        return;
    }

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldPos = { x: mx + cameraRef.current.x, y: my + cameraRef.current.y };

    if (e.button === 0) { // Left Click
        if (placementMode) {
            const stats = STATS[placementMode];
            const snapX = Math.floor(worldPos.x / GRID_SIZE) * GRID_SIZE;
            const snapY = Math.floor(worldPos.y / GRID_SIZE) * GRID_SIZE;
            const overlap = entitiesRef.current.some(ent => {
                const eStats = STATS[ent.type];
                return (
                    snapX < ent.position.x + eStats.width &&
                    snapX + stats.width > ent.position.x &&
                    snapY < ent.position.y + eStats.height &&
                    snapY + stats.height > ent.position.y
                );
            });

            if (!overlap) {
                setPlayerState(prev => ({ ...prev, credits: prev.credits - stats.cost }));
                entitiesRef.current.push(spawnEntity(placementMode, { x: snapX, y: snapY }, config.playerFaction));
                if (placementMode === EntityType.ORE_REFINERY) {
                     const harvester = spawnEntity(EntityType.HARVESTER, { x: snapX + 20, y: snapY + 80 }, config.playerFaction);
                     entitiesRef.current.push(harvester);
                     createFloatText({x: snapX, y: snapY}, "获得采矿车!", "#fbbf24");
                }
                setPlacementMode(null);
            }
        } else {
            selectionStartRef.current = worldPos;
        }
    } else if (e.button === 2) { // Right Click
        e.preventDefault();
        if (placementMode) {
            setPlacementMode(null);
        } else {
            const clickedEntity = entitiesRef.current.find(ent => {
                const stats = STATS[ent.type];
                return (
                    worldPos.x >= ent.position.x &&
                    worldPos.x <= ent.position.x + stats.width &&
                    worldPos.y >= ent.position.y &&
                    worldPos.y <= ent.position.y + stats.height
                );
            });

            let voicePlayed = false;
            selectedIdsRef.current.forEach(id => {
                const unit = entitiesRef.current.find(u => u.id === id);
                if (unit && !STATS[unit.type].isBuilding) {
                    if (unit.type === EntityType.HARVESTER) {
                        if (clickedEntity && clickedEntity.type === EntityType.ORE_PATCH) {
                            unit.state = 'GATHERING';
                            unit.targetEntityId = clickedEntity.id;
                            unit.targetPosition = null;
                            createFloatText(unit.position, "采集中...", "#fbbf24");
                        } else if (clickedEntity && clickedEntity.type === EntityType.ORE_REFINERY && clickedEntity.faction === unit.faction) {
                            unit.state = 'RETURNING';
                            unit.targetEntityId = clickedEntity.id;
                            unit.targetPosition = null;
                            createFloatText(unit.position, "返回基地...", "#fbbf24");
                        } else {
                            unit.state = 'MOVING';
                            unit.targetPosition = { x: worldPos.x, y: worldPos.y };
                            unit.targetEntityId = null;
                            particlesRef.current.push({ id: Math.random().toString(), position: { x: worldPos.x, y: worldPos.y }, life: 15, color: '#00ff00', type: 'SHOT' });
                        }
                    } else {
                        if (clickedEntity && clickedEntity.faction !== config.playerFaction && clickedEntity.faction !== FactionType.NEUTRAL) {
                            unit.targetEntityId = clickedEntity.id;
                            unit.targetPosition = null;
                            createFloatText(unit.position, "攻击!", "#ef4444");
                            if (!voicePlayed && (unit.faction === 'ALLIES' || unit.faction === 'SOVIET')) {
                                AudioManager.getInstance().playUnit(unit.faction, 'attack');
                                voicePlayed = true;
                            }
                        } else {
                            unit.targetPosition = { 
                                x: worldPos.x + (Math.random() * 40 - 20), 
                                y: worldPos.y + (Math.random() * 40 - 20) 
                            };
                            unit.targetEntityId = null;
                            particlesRef.current.push({ id: Math.random().toString(), position: { x: worldPos.x, y: worldPos.y }, life: 15, color: '#00ff00', type: 'SHOT' });
                            if (!voicePlayed && (unit.faction === 'ALLIES' || unit.faction === 'SOVIET')) {
                                AudioManager.getInstance().playUnit(unit.faction, 'move');
                                voicePlayed = true;
                            }
                        }
                    }
                }
            });
        }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Middle Click Panning
    if (isMiddleDraggingRef.current) {
        const dx = e.clientX - lastMiddleDragPosRef.current.x;
        const dy = e.clientY - lastMiddleDragPosRef.current.y;
        
        cameraRef.current.x -= dx;
        cameraRef.current.y -= dy;
        
        lastMiddleDragPosRef.current = { x: e.clientX, y: e.clientY };
        return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseUp = (e: React.MouseEvent) => {
      if (e.button === 1) {
          isMiddleDraggingRef.current = false;
          return;
      }

      if (e.button === 0 && selectionStartRef.current) {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const worldPos = { x: mx + cameraRef.current.x, y: my + cameraRef.current.y };
          const startPos = selectionStartRef.current;

          const left = Math.min(startPos.x, worldPos.x);
          const right = Math.max(startPos.x, worldPos.x);
          const top = Math.min(startPos.y, worldPos.y);
          const bottom = Math.max(startPos.y, worldPos.y);

          const isClick = (right - left < 5) && (bottom - top < 5);

          const newSelection = new Set<string>();
          let playedVoice = false;

          entitiesRef.current.forEach(ent => {
              if (ent.faction !== config.playerFaction) return;
              const stats = STATS[ent.type];
              const centerX = ent.position.x + stats.width/2;
              const centerY = ent.position.y + stats.height/2;
              let selected = false;
              if (isClick) {
                  if (worldPos.x >= ent.position.x && worldPos.x <= ent.position.x + stats.width && worldPos.y >= ent.position.y && worldPos.y <= ent.position.y + stats.height) {
                      selected = true;
                  }
              } else {
                  if (centerX >= left && centerX <= right && centerY >= top && centerY <= bottom) {
                      selected = true;
                  }
              }
              if (selected) {
                  newSelection.add(ent.id);
                  if (!playedVoice && !stats.isBuilding && (ent.faction === 'ALLIES' || ent.faction === 'SOVIET')) {
                       AudioManager.getInstance().playUnit(ent.faction, 'select');
                       playedVoice = true;
                  }
              }
          });
          if (newSelection.size > 0 || isClick) selectedIdsRef.current = newSelection;
          selectionStartRef.current = null;
      }
  };

  const handlePlaceBuilding = (type: EntityType) => {
    setPlacementMode(type);
  };

  const handleTrainUnit = (type: EntityType) => {
    const stats = STATS[type];
    if (playerState.credits >= stats.cost) {
        let producerType = EntityType.BARRACKS;
        if ([EntityType.TANK, EntityType.HARVESTER, EntityType.HEAVY_TANK].includes(type)) {
            producerType = EntityType.WAR_FACTORY;
        }
        const producers = entitiesRef.current.filter(e => e.type === producerType && e.faction === config.playerFaction);
        if (producers.length > 0) {
            setPlayerState(p => ({ ...p, credits: p.credits - stats.cost }));
            const producer = producers[0]; 
            const unit = spawnEntity(type, { 
                x: producer.position.x + STATS[producerType].width/2, 
                y: producer.position.y + STATS[producerType].height + 20 
            }, config.playerFaction);
            unit.targetPosition = { x: unit.position.x, y: unit.position.y + 80 };
            entitiesRef.current.push(unit);
            AudioManager.getInstance().playSystem('unit_ready');
        }
    } else {
        AudioManager.getInstance().playSystem('insufficient_funds');
    }
  };

  return (
    <div className="w-screen h-screen flex bg-black text-white overflow-hidden font-mono select-none">
      <div className="relative flex-1 h-full cursor-crosshair">
        <div className="absolute top-0 left-0 right-0 h-10 bg-gray-900/80 flex items-center px-4 justify-between pointer-events-none border-b border-gray-700 z-10">
            <div className="flex items-center gap-4">
                <button onClick={onExit} className="pointer-events-auto px-3 py-1 bg-red-600 text-xs font-bold border border-red-400 hover:bg-red-500">退出 (EXIT)</button>
                <div className="text-yellow-400 font-bold text-lg tracking-widest drop-shadow-md">资金: ${playerState.credits}</div>
                <div className={`text-xs font-bold ${playerState.power >= playerState.powerUsage ? 'text-green-400' : 'text-red-500 blink'}`}>电力: {playerState.powerUsage} / {playerState.power}</div>
            </div>
            <div className="text-gray-400 text-xs">任务时间: {Math.floor(gameTime / 60)}:{String(gameTime % 60).padStart(2, '0')}</div>
        </div>
        <canvas
            ref={canvasRef}
            width={window.innerWidth - 224} 
            height={window.innerHeight}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={(e) => e.preventDefault()}
            className="block bg-[#111]"
        />
      </div>
      <Sidebar 
        playerState={playerState} 
        onPlaceBuilding={handlePlaceBuilding}
        onTrainUnit={handleTrainUnit}
        existingBuildings={existingBuildings}
        minimapRef={minimapRef}
      />
    </div>
  );
}
