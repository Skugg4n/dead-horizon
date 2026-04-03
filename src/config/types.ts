// Dead Horizon -- Shared TypeScript types

export type ResourceType = 'scrap' | 'food' | 'ammo' | 'parts' | 'meds';

export type WeaponClass = 'melee' | 'pistol' | 'shotgun' | 'rifle' | 'explosives';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type RefugeeStatus = 'healthy' | 'injured' | 'away';

export type RefugeeJob = 'gather_food' | 'gather_scrap' | 'loot_run' | 'repair' | 'rest' | 'pillbox';

export type CharacterType = 'scavenger' | 'engineer' | 'soldier' | 'medic';

export type SkillType = 'combat_melee' | 'combat_pistol' | 'combat_rifle' | 'combat_shotgun' | 'looting' | 'building' | 'speed_agility' | 'leadership' | 'survival' | 'stealth';

export type ZoneId = 'forest' | 'city' | 'military';

export interface ZoneData {
  id: ZoneId;
  name: string;
  description: string;
  waveFile: string;
  lootMultiplier: number;
  unlockCondition: {
    type: 'wave_cleared';
    zone: ZoneId;
    wave: number;
  } | null;
}

export interface RecipeData {
  id: string;
  name: string;
  ingredients: Partial<Record<ResourceType, number>>;
  result: { type: string; amount: number };
  apCost: number;
}

export interface AchievementData {
  id: string;
  name: string;
  description: string;
  condition: {
    type: string;
    target: number;
  };
}

export type WeaponUpgradeType =
  | 'damage_boost'
  | 'suppressor'
  | 'extended_mag'
  | 'scope'
  | 'reinforcement'
  | 'sharpening'
  | 'quick_grip'
  | 'serrated_edge';

// One upgrade slot on a weapon instance -- tracks which upgrade and its current level (1-based)
export interface WeaponUpgrade {
  id: WeaponUpgradeType;
  level: number; // 1..maxLevel for this upgrade type
}

// Upgrade definition loaded from upgrades.json
export interface UpgradeDefinition {
  id: WeaponUpgradeType;
  name: string;
  description: string; // template: {percent} or {value} placeholder
  maxLevel: number;
  costs: number[];   // costs[i] = parts cost to reach level i+1
  values: number[];  // values[i] = effect magnitude at level i+1
  applicableTo: WeaponClass[];
}

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

export interface WeaponSpecialEffect {
  type: 'bleed' | 'knockback' | 'cripple' | 'stun' | 'cleave' | 'crit' | 'piercing' | 'headshot' | 'incendiary';
  chance: number;   // 0-1 probability to trigger
  value: number;    // bleed: extra damage, knockback: pixels, cripple: speed multiplier (0-1), stun: unused, cleave/incendiary: radius, crit/headshot: damage multiplier
  duration: number; // milliseconds -- bleed: dot interval, cripple/stun: how long the debuff lasts, incendiary: burn zone duration
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
  specialEffect: WeaponSpecialEffect | null;
}

// Legacy type -- kept only for SaveManager migration path; new code uses WeaponUpgrade[]
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
  // Each entry = one upgrade slot (max 3 slots per weapon).
  // Level inside WeaponUpgrade is 1-based (1 = first tier, maxLevel = fully upgraded).
  upgrades: WeaponUpgrade[];
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

// Result from TerrainGenerator.generateTerrain()
export interface TerrainResult {
  // Static physics group for trees and large rocks (zombies + player collide with these)
  colliders: Phaser.Physics.Arcade.StaticGroup;
  // Non-physics group for water zones (overlap triggers slow debuff)
  waterZones: Phaser.GameObjects.Group;
  // Container holding all visual decorations (no physics)
  decorContainer: Phaser.GameObjects.Container;
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
  // Which weapon instances are carried into the night (primary = key 1, secondary = key 2).
  // null means the slot is empty. Populated by EquipmentPanel or auto-equip logic.
  equipped: {
    primaryWeaponId: string | null;
    secondaryWeaponId: string | null;
  };
  base: {
    structures: StructureInstance[];
    level: number;
    hp: number;
    maxHp: number;
  };
  refugees: RefugeeInstance[];
  progress: {
    currentWave: number;
    highestWave: number;
    totalRuns: number;
    totalKills: number;
  };
  zone: ZoneId;
  // Terrain seed: stays constant within a run (day+night), changes only on death
  mapSeed: number;
  achievements: string[];
  stats: {
    structuresPlaced: number;
    lootRunsCompleted: number;
    itemsCrafted: number;
  };
  zoneProgress: Partial<Record<ZoneId, { highestWaveCleared: number }>>;
  map: {
    fogOfWar: boolean[][];
    explored: string[];
  };
}
