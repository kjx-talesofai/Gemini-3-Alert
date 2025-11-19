export enum FactionType {
  ALLIES = 'ALLIES',
  SOVIET = 'SOVIET',
  NEUTRAL = 'NEUTRAL' // For Ore
}

export enum EntityType {
  // Buildings
  CONSTRUCTION_YARD = 'CONSTRUCTION_YARD',
  POWER_PLANT = 'POWER_PLANT',
  ORE_REFINERY = 'ORE_REFINERY',
  BARRACKS = 'BARRACKS',
  WAR_FACTORY = 'WAR_FACTORY',
  
  // Units
  HARVESTER = 'HARVESTER',
  SOLDIER = 'SOLDIER',
  TANK = 'TANK',
  HEAVY_TANK = 'HEAVY_TANK',
  
  // Resources
  ORE_PATCH = 'ORE_PATCH'
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface EntityStats {
  name: string;
  hp: number;
  cost: number;
  buildTime: number; // in seconds
  speed: number; // 0 for buildings
  range: number;
  damage: number;
  attackSpeed: number; // cooldown in frames
  color: string;
  width: number;
  height: number;
  isBuilding: boolean;
  prerequisite?: EntityType;
}

export interface Entity {
  id: string;
  type: EntityType;
  faction: FactionType;
  position: Vector2;
  hp: number;
  maxHp: number;
  targetPosition: Vector2 | null; // Moving to
  targetEntityId: string | null; // Attacking/Gathering
  cooldown: number;
  state: 'IDLE' | 'MOVING' | 'ATTACKING' | 'GATHERING' | 'RETURNING';
  cargo: number; // For harvesters
}

export interface PlayerState {
  credits: number;
  power: number;
  powerUsage: number;
  faction: FactionType;
}

export interface Particle {
  id: string;
  position: Vector2;
  life: number;
  color: string;
  type: 'EXPLOSION' | 'SHOT' | 'TEXT';
  text?: string;
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface GameConfig {
  playerFaction: FactionType;
  playerStartPos: number; // 0-3
  enemyCount: number;
  enemyDifficulty: Difficulty;
  enemyFaction: FactionType;
}