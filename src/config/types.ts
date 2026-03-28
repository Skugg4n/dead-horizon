// Dead Horizon -- Shared TypeScript types

export type ResourceType = 'scrap' | 'food' | 'ammo' | 'parts' | 'meds';

export type WeaponClass = 'melee' | 'pistol' | 'shotgun' | 'rifle' | 'explosives';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type RefugeeStatus = 'healthy' | 'injured' | 'away';

export type RefugeeJob = 'gather_food' | 'gather_scrap' | 'loot_run' | 'repair' | 'rest';

export type CharacterType = 'scavenger' | 'engineer' | 'soldier' | 'medic';

export type SkillType = 'combat_melee' | 'combat_pistol' | 'combat_rifle' | 'combat_shotgun' | 'looting' | 'building';

export type WeaponUpgradeType = 'damage_boost' | 'suppressor' | 'extended_mag' | 'scope' | 'reinforcement';

export interface SkillEffects {
  [effectName: string]: number;
}

export interface SkillData {
  id: SkillType;
  name: string;
  maxLevel: number;
  xpPerLevel: number[];
  effectPerLevel: SkillEffects;
}

export interface CharacterData {
  id: CharacterType;
  name: string;
  description: string;
  skillBonuses: Partial<Record<SkillType, number>>;
}

export interface WeaponData {
  id: string;
  name: string;
  class: WeaponClass;
  damage: number;
  range: number;
  noiseLevel: number;
  ammoPerNight: number;
  fireRate: number;
  rarity: Rarity;
  maxDurability: number;
}

export interface WeaponUpgradeData {
  id: WeaponUpgradeType;
  name: string;
  description: string;
  partsCost: number;
}

export interface WeaponInstance {
  id: string;
  weaponId: string;
  rarity: Rarity;
  level: number;
  xp: number;
  durability: number;
  maxDurability: number;
  upgrades: WeaponUpgradeType[];
}

export interface RefugeeInstance {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  status: RefugeeStatus;
  job: RefugeeJob | null;
  skillBonus: string;
}

export interface StructureInstance {
  id: string;
  structureId: string;
  level: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
}

export interface GameState {
  version: string;
  player: {
    character: CharacterType;
    skills: Record<SkillType, number>;
    hp: number;
    maxHp: number;
  };
  inventory: {
    weapons: WeaponInstance[];
    resources: Record<ResourceType, number>;
    loadedAmmo: number;
  };
  base: {
    structures: StructureInstance[];
    level: number;
  };
  refugees: RefugeeInstance[];
  progress: {
    currentWave: number;
    highestWave: number;
    totalRuns: number;
    totalKills: number;
  };
  map: {
    fogOfWar: boolean[][];
    explored: string[];
  };
}
