import { Vector2, Entity, EntityType, FactionType } from './types';

export const distance = (a: Vector2, b: Vector2) => {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
};

export const normalize = (v: Vector2): Vector2 => {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
};

export const checkCollision = (pos: Vector2, r: number, entities: Entity[]): boolean => {
  // Simple circle collision check
  return entities.some(e => {
     const dist = distance(pos, e.position);
     const size = Math.max(40, 40) / 2; 
     return dist < (r + size);
  });
};

export const getCenter = (e: Entity, stats: any): Vector2 => {
  return { x: e.position.x + stats.width / 2, y: e.position.y + stats.height / 2 };
}

export const getFactionEntityName = (type: EntityType, faction: FactionType): string => {
    if (type === EntityType.ORE_PATCH) return "金矿";
    if (type === EntityType.CONSTRUCTION_YARD) return "建造场";
    if (type === EntityType.ORE_REFINERY) return "矿石精炼厂";
    if (type === EntityType.WAR_FACTORY) return "战车工厂";
    if (type === EntityType.BARRACKS) return "兵营";

    // Faction specific names
    const isSoviet = faction === FactionType.SOVIET;

    if (type === EntityType.POWER_PLANT) return isSoviet ? "磁能反应炉" : "发电厂";
    if (type === EntityType.HARVESTER) return isSoviet ? "武装采矿车" : "超时空采矿车";
    if (type === EntityType.SOLDIER) return isSoviet ? "动员兵" : "美国大兵";
    if (type === EntityType.TANK) return isSoviet ? "犀牛坦克" : "灰熊坦克";
    if (type === EntityType.HEAVY_TANK) return isSoviet ? "天启坦克" : "光棱坦克";

    return "未知单位";
};