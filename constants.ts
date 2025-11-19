import { EntityStats, EntityType, FactionType } from './types';

export const MAP_WIDTH = 2000;
export const MAP_HEIGHT = 2000;
export const GRID_SIZE = 40; // Size of building grid cells

export const ORE_VALUE = 500;
export const HARVESTER_CAPACITY = 500; // Reduced slightly to force more trips

export const STATS: Record<EntityType, EntityStats> = {
  [EntityType.CONSTRUCTION_YARD]: {
    name: '建造场', hp: 2000, cost: 0, buildTime: 0, speed: 0, range: 0, damage: 0, attackSpeed: 0,
    color: '#ffffff', width: 80, height: 80, isBuilding: true
  },
  [EntityType.POWER_PLANT]: {
    name: '发电厂', hp: 800, cost: 800, buildTime: 4, speed: 0, range: 0, damage: 0, attackSpeed: 0,
    color: '#4ade80', width: 40, height: 80, isBuilding: true, prerequisite: EntityType.CONSTRUCTION_YARD
  },
  [EntityType.ORE_REFINERY]: {
    name: '矿石精炼厂', hp: 1000, cost: 2000, buildTime: 8, speed: 0, range: 0, damage: 0, attackSpeed: 0,
    color: '#facc15', width: 80, height: 60, isBuilding: true, prerequisite: EntityType.POWER_PLANT
  },
  [EntityType.BARRACKS]: {
    name: '兵营', hp: 800, cost: 500, buildTime: 4, speed: 0, range: 0, damage: 0, attackSpeed: 0,
    color: '#f87171', width: 60, height: 40, isBuilding: true, prerequisite: EntityType.POWER_PLANT
  },
  [EntityType.WAR_FACTORY]: {
    name: '战车工厂', hp: 1500, cost: 2000, buildTime: 10, speed: 0, range: 0, damage: 0, attackSpeed: 0,
    color: '#60a5fa', width: 120, height: 80, isBuilding: true, prerequisite: EntityType.BARRACKS
  },
  [EntityType.ORE_PATCH]: {
    name: '金矿', hp: 9999, cost: 0, buildTime: 0, speed: 0, range: 0, damage: 0, attackSpeed: 0,
    color: '#d97706', width: 30, height: 30, isBuilding: true
  },
  [EntityType.HARVESTER]: {
    name: '采矿车', hp: 1000, cost: 1400, buildTime: 8, speed: 2, range: 100, damage: 0, attackSpeed: 0,
    color: '#fbbf24', width: 30, height: 30, isBuilding: false, prerequisite: EntityType.WAR_FACTORY
  },
  [EntityType.SOLDIER]: {
    name: '步兵', hp: 100, cost: 200, buildTime: 2, speed: 1.5, range: 150, damage: 15, attackSpeed: 30,
    color: '#d4d4d8', width: 15, height: 15, isBuilding: false, prerequisite: EntityType.BARRACKS
  },
  [EntityType.TANK]: {
    name: '主战坦克', hp: 400, cost: 800, buildTime: 5, speed: 2.5, range: 250, damage: 40, attackSpeed: 90,
    color: '#9ca3af', width: 35, height: 35, isBuilding: false, prerequisite: EntityType.WAR_FACTORY
  },
  [EntityType.HEAVY_TANK]: {
    name: '重型坦克', hp: 800, cost: 1500, buildTime: 8, speed: 1.8, range: 350, damage: 80, attackSpeed: 120,
    color: '#e11d48', width: 45, height: 45, isBuilding: false, prerequisite: EntityType.WAR_FACTORY
  }
};

export const FACTION_COLORS = {
  [FactionType.ALLIES]: '#3b82f6', // Blue
  [FactionType.SOVIET]: '#ef4444', // Red
  [FactionType.NEUTRAL]: '#d97706', // Gold/Ore
};

export const POWER_VALUES: Record<string, number> = {
  [EntityType.CONSTRUCTION_YARD]: 0,
  [EntityType.POWER_PLANT]: 150,
  [EntityType.ORE_REFINERY]: -50,
  [EntityType.BARRACKS]: -10,
  [EntityType.WAR_FACTORY]: -50,
};