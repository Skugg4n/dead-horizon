// Dead Horizon -- Game constants

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const TILE_SIZE = 32;

export const MAP_WIDTH = 40;  // tiles
export const MAP_HEIGHT = 30; // tiles

export const AP_PER_DAY = 12;

export const PLAYER_SPEED = 150;
export const PLAYER_SPRINT_SPEED = 250;
export const PLAYER_MAX_HP = 100;
export const PLAYER_MAX_STAMINA = 100;
export const STAMINA_DRAIN_RATE = 25; // per second while sprinting
export const STAMINA_REGEN_RATE = 10; // per second while not sprinting

// Skill XP rewards
export const XP_PER_KILL = 10;
export const XP_PER_BUILD = 25;

// Refugee system
export const REFUGEE_MAX_HP = 50;
export const REFUGEE_ARRIVAL_CHANCE = 0.2;
export const REFUGEES_PER_SHELTER = 2;
export const REFUGEE_FOOD_PER_DAY = 1;
export const REFUGEE_FOOD_STARVE_DAMAGE = 10;
export const REFUGEE_HEAL_MEDS_COST = 1;
export const REFUGEE_GATHER_FOOD_AMOUNT = 2;
export const REFUGEE_GATHER_SCRAP_AMOUNT = 3;
export const REFUGEE_REPAIR_AMOUNT = 10;
export const REFUGEE_PILLBOX_RANGE = 150;
export const REFUGEE_PILLBOX_DAMAGE = 5;
export const REFUGEE_PILLBOX_COOLDOWN = 1500;

export const REFUGEE_NAMES: string[] = [
  'Ash', 'Raven', 'Flint', 'Ember', 'Slate',
  'Thorn', 'Rust', 'Haze', 'Sable', 'Dusk',
  'Pike', 'Crane', 'Wren', 'Bolt', 'Forge',
  'Grit', 'Storm', 'Cinder', 'Drift', 'Vex',
  'Nyx', 'Koda', 'Jett', 'Shard', 'Blaze',
  'Reed', 'Moss', 'Lark', 'Sage', 'Knox',
  'Vera', 'Axel', 'Rook', 'Faye', 'Zane',
];

export const REFUGEE_SKILL_BONUSES: string[] = [
  'Good shot',
  'Fast gatherer',
  'Mechanic',
  'Tough',
  'Medic',
];

// Base expansion
export const DEFAULT_RESOURCE_CAP = 100;
export const STORAGE_CAP_BONUS = 50;

// Fog of War
export const FOG_BLOCK_SIZE = 128; // 4x4 tiles (32 * 4)
export const FOG_ALPHA = 0.85;
export const FOG_INDICATOR_RANGE = 3; // blocks from fog edge to show zombie indicators

// Loot run constants
export const XP_PER_LOOT_RUN = 50;
export const COMPANION_STRENGTH = 20;
export const REFUGEE_INJURY_CHANCE = 0.4;
export const ENCOUNTER_LOOT_MULTIPLIER = 1.5;
export const ENCOUNTER_RESCUE_CHANCE = 0.3;
export const ENCOUNTER_THRESHOLDS: Record<string, number> = {
  nearby_houses: 50,
  abandoned_store: 70,
  ranger_station: 65,
  city_ruins: 60,
  hospital: 65,
  police_station: 80,
  military_outpost: 100,
  armory: 120,
};

export const GAME_VERSION = '2.0.3';

// Base HP (used in NightScene for base health bar)
export const BASE_MAX_HP = 200;
