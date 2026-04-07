// Dead Horizon -- Shared TypeScript types

export type ResourceType = 'scrap' | 'food' | 'ammo' | 'parts' | 'meds';

export type WeaponClass = 'melee' | 'pistol' | 'shotgun' | 'rifle' | 'explosives';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type RefugeeStatus = 'healthy' | 'injured' | 'away';

export type RefugeeJob = 'gather_food' | 'gather_scrap' | 'loot_run' | 'repair' | 'rest' | 'pillbox';

export type CharacterType = 'scavenger' | 'engineer' | 'soldier' | 'medic';

export type SkillType = 'combat_melee' | 'combat_pistol' | 'combat_rifle' | 'combat_shotgun' | 'looting' | 'building' | 'speed_agility' | 'leadership' | 'survival' | 'stealth';

export type ZoneId = 'forest' | 'city' | 'military' | 'endless';

export type ChallengeId = 'no_build' | 'pacifist' | 'speed_run';

// Challenge definition loaded from challenges.json
export interface ChallengeData {
  id: ChallengeId;
  name: string;
  description: string;
  icon: string;
  lpReward: number;
  unlockCondition: string; // e.g. 'forest_cleared'
}

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

// Per-trap kill count entry for the debrief screen
export interface TrapKillEntry {
  trapId: string;
  trapName: string;
  kills: number;
}

// Stats collected during a night -- passed to ResultScene
export interface NightStats {
  kills: number;
  trapKills: number;
  weaponKills: number;
  topTraps: TrapKillEntry[];
  breakthroughs: number;
  structuresDestroyed: Array<{ structureId: string; x: number; y: number }>;
  ammoUsedStart: number;
  ammoUsedEnd: number;
  baseHpStart: number;
  baseHpEnd: number;
  baseHpMax: number;
  wave: number;
  survived: boolean;
  // Endless mode: which endless night number this was
  endlessNight?: number;
  bossKills: number;
}

// Legacy Perk definition loaded from perks.json
export interface PerkData {
  id: string;
  name: string;
  description: string;
  cost: number;
  // Effect keys map to effect values (e.g. startScrap: 10, startRarity: 'uncommon')
  effect: Record<string, string | number | boolean>;
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

// Ultimate ability types unlocked at weapon level 5
export type WeaponUltimateType =
  | 'spin_attack'
  | 'cleave_pierce'
  | 'buckshot'
  | 'phosphor_rounds'
  | 'piercing_shot'
  | 'explosive_impact';

export interface WeaponUltimateCost {
  parts: number;
  scrap: number;
}

export interface WeaponUltimate {
  name: string;
  description: string;
  type: WeaponUltimateType;
  cost: WeaponUltimateCost;
}

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
  // Weapon level cap (default 4, extended to 5 when ultimate is defined)
  maxLevel?: number;
  // Ultimate ability unlocked when weapon reaches level 5
  ultimate?: WeaponUltimate;
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

// Camp Crew bonus type: what passive bonus this refugee provides per day
export type RefugeeBonusType = 'food' | 'scrap' | 'repair';

export interface RefugeeInstance {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  status: RefugeeStatus;
  job: RefugeeJob | null;
  skillBonus: string;
  // Passive Camp Crew bonus (assigned at rescue, persists for the refugee's lifetime)
  bonusType: RefugeeBonusType;
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

/**
 * Common interface for all structures that interact with zombies on contact.
 * Used by SpatialBucketGrid so NightScene can query nearby structures per-zombie
 * instead of checking all 49+ structure arrays.
 *
 * x/y are the world-space top-left pixel coordinates of the structure tile.
 * active must be true for the structure to be considered; destroyed structures
 * set active=false and are removed from the grid on the next rebuild.
 */
export interface InteractableStructure {
  /** structureId string matching structures.json, e.g. 'barricade', 'nail_board'. */
  structureType: string;
  /** Top-left world-pixel X of the structure tile. */
  x: number;
  /** Top-left world-pixel Y of the structure tile. */
  y: number;
  /** False once the structure has been destroyed or consumed. */
  active: boolean;
}

// Axis-aligned bounding rect for a natural terrain blocker (building ruin, bunker).
// Used by PathGrid to mark tiles as impassable without adding to GameState.base.structures.
export interface NaturalBlockerRect {
  x: number; // world pixel centre-x
  y: number; // world pixel centre-y
  w: number; // width in pixels
  h: number; // height in pixels
}

// Result from TerrainGenerator.generateTerrain()
export interface TerrainResult {
  // Static physics group for trees and large rocks (zombies + player collide with these)
  colliders: Phaser.Physics.Arcade.StaticGroup;
  // Non-physics group for water zones (overlap triggers slow debuff)
  waterZones: Phaser.GameObjects.Group;
  // Container holding all visual decorations (no physics)
  decorContainer: Phaser.GameObjects.Container;
  // Natural terrain blockers (building ruins in city, bunkers in military).
  // NightScene passes these to PathGrid so zombies navigate around them.
  naturalBlockerRects: NaturalBlockerRect[];
}

// Blueprint data loaded from blueprints.json
export interface BlueprintData {
  id: string;
  name: string;
  description: string;
  unlocks: string[];
  destinations: string[];
  dropChance: number;
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
  // Blueprint IDs unlocked via loot runs. Empty array = only alwaysAvailable traps are buildable.
  unlockedBlueprints: string[];
  // Endless mode high score (number of endless nights survived in a single run)
  endlessHighScore: number;
  // Current endless night counter (reset to 0 when leaving endless mode)
  endlessNight: number;
  // Meta-progression: persists across all runs
  meta: {
    legacyPoints: number;
    unlockedPerks: string[];
  };
  // Challenge mode: active challenge for the current run (null = normal run)
  activeChallenge: ChallengeId | null;
  // Which challenges have been completed at least once (array of challenge IDs)
  challengeCompletions: string[];
  // Speed Run accumulated time in milliseconds (only used when activeChallenge === 'speed_run')
  speedRunTimer: number;
}
