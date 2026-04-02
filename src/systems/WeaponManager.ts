// Manages weapon inventory, equipping, XP, leveling, durability, and upgrades
import Phaser from 'phaser';
import type {
  GameState,
  WeaponInstance,
  WeaponUpgrade,
  WeaponData,
  WeaponClass,
  WeaponUpgradeType,
  WeaponUpgradeData,
  UpgradeDefinition,
  WeaponSpecialEffect,
  Rarity,
} from '../config/types';
import weaponsJson from '../data/weapons.json';
import upgradesJson from '../data/upgrades.json';
import legacyUpgradesJson from '../data/weapon-upgrades.json';

const weaponDataList = weaponsJson.weapons as WeaponData[];

// New multi-level upgrade definitions (upgrades.json)
const upgradeDefinitions = upgradesJson.upgrades as UpgradeDefinition[];

// Legacy single-level data kept for rarityMultipliers / xpPerLevel in weapon-upgrades.json
const rarityMultipliers = legacyUpgradesJson.rarityMultipliers as Record<Rarity, number>;
const xpPerLevel = legacyUpgradesJson.xpPerLevel as number[];

// Legacy WeaponUpgradeData list -- only used by callers that need partsCost for old system
const legacyUpgradeDataList = legacyUpgradesJson.upgrades as WeaponUpgradeData[];

// Cached Map for O(1) weapon lookups by id
const weaponMap = new Map<string, WeaponData>();
for (const w of weaponDataList) {
  weaponMap.set(w.id, w);
}

// Cached Map for O(1) new-style upgrade definitions by id
const upgradeDefMap = new Map<WeaponUpgradeType, UpgradeDefinition>();
for (const u of upgradeDefinitions) {
  upgradeDefMap.set(u.id, u);
}

// Cached Map for O(1) legacy upgrade data by id
const legacyUpgradeMap = new Map<string, WeaponUpgradeData>();
for (const u of legacyUpgradeDataList) {
  legacyUpgradeMap.set(u.id, u);
}

// Maximum number of distinct upgrade slots per weapon
const MAX_UPGRADES_PER_WEAPON = 3;

// Level bonuses: cumulative reload speed and damage bonuses per weapon level
// Lvl2 +10% reload, Lvl3 +10% damage, Lvl4 +10% reload, Lvl5 special
function getLevelDamageMultiplier(level: number): number {
  if (level >= 3) return 1.10;
  return 1.0;
}

function getLevelFireRateMultiplier(level: number): number {
  let mult = 1.0;
  if (level >= 2) mult *= 0.90; // faster = lower cooldown
  if (level >= 4) mult *= 0.90;
  return mult;
}

export class WeaponManager {
  private scene: Phaser.Scene;
  private gameState: GameState;
  private equippedIndex: number = 0;

  constructor(scene: Phaser.Scene, gameState: GameState) {
    this.scene = scene;
    this.gameState = gameState;

    if (this.gameState.inventory.weapons.length > 0) {
      this.equippedIndex = 0;
    }
  }

  getWeapons(): WeaponInstance[] {
    return this.gameState.inventory.weapons;
  }

  getEquipped(): WeaponInstance | null {
    const weapons = this.gameState.inventory.weapons;
    if (weapons.length === 0) return null;
    if (this.equippedIndex >= weapons.length) this.equippedIndex = 0;
    return weapons[this.equippedIndex] ?? null;
  }

  getEquippedIndex(): number {
    return this.equippedIndex;
  }

  switchWeapon(slot: number): void {
    const weapons = this.gameState.inventory.weapons;
    if (slot < 0 || slot >= weapons.length) return;
    this.equippedIndex = slot;
    this.scene.events.emit('weapon-switched', this.getEquipped());
  }

  equip(weaponId: string): void {
    const idx = this.gameState.inventory.weapons.findIndex(w => w.id === weaponId);
    if (idx >= 0) {
      this.equippedIndex = idx;
      this.scene.events.emit('weapon-switched', this.getEquipped());
    }
  }

  static getWeaponData(weaponId: string): WeaponData | undefined {
    return weaponMap.get(weaponId);
  }

  /** Returns the new-style multi-level upgrade definition for a given id. */
  static getUpgradeDef(upgradeId: WeaponUpgradeType): UpgradeDefinition | undefined {
    return upgradeDefMap.get(upgradeId);
  }

  /** Returns all new-style upgrade definitions. */
  static getAllUpgradeDefs(): UpgradeDefinition[] {
    return upgradeDefinitions;
  }

  // ---------------------------------------------------------------------------
  // Legacy API -- kept for any existing callers that use getUpgradeData()
  // ---------------------------------------------------------------------------
  static getUpgradeData(upgradeId: WeaponUpgradeType): WeaponUpgradeData | undefined {
    return legacyUpgradeMap.get(upgradeId);
  }

  static getAllUpgradeData(): WeaponUpgradeData[] {
    return legacyUpgradeDataList;
  }
  // ---------------------------------------------------------------------------

  // Get effective stats for a weapon instance (base * rarity * level * upgrades)
  getWeaponStats(weapon: WeaponInstance): {
    damage: number;
    range: number;
    fireRate: number;
    noiseLevel: number;
    ammoPerNight: number;
    maxDurability: number;
    weaponClass: WeaponClass;
    name: string;
    specialEffect: WeaponSpecialEffect | null;
  } {
    const data = WeaponManager.getWeaponData(weapon.weaponId);
    if (!data) {
      return {
        damage: 1,
        range: 40,
        fireRate: 500,
        noiseLevel: 0,
        ammoPerNight: 0,
        maxDurability: 10,
        weaponClass: 'melee',
        name: 'Unknown',
        specialEffect: null,
      };
    }

    const rarityMult = rarityMultipliers[weapon.rarity] ?? 1.0;
    const levelDamageMult = getLevelDamageMultiplier(weapon.level);
    const levelFireRateMult = getLevelFireRateMultiplier(weapon.level);

    let damage = data.damage * rarityMult * levelDamageMult;
    let range = data.range;
    let fireRate = data.fireRate * levelFireRateMult;
    let noiseLevel = data.noiseLevel;
    let ammoPerNight = data.ammoPerNight;
    let maxDurability = data.maxDurability;

    // Apply each upgrade at its current level using the definition's values array
    for (const upgrade of weapon.upgrades) {
      const def = upgradeDefMap.get(upgrade.id);
      if (!def) continue;

      // level is 1-based; index into values[] is level-1
      const idx = upgrade.level - 1;
      const val = def.values[idx] ?? 0;

      switch (upgrade.id) {
        case 'damage_boost':
          damage *= (1 + val / 100);
          break;
        case 'reinforcement':
          maxDurability = Math.round(maxDurability * (1 + val / 100));
          break;
        case 'suppressor':
          noiseLevel = Math.max(0, noiseLevel - val);
          break;
        case 'extended_mag':
          ammoPerNight = Math.round(ammoPerNight * (1 - val / 100));
          break;
        case 'scope':
          range *= (1 + val / 100);
          break;
        case 'quick_grip':
          // Lower fireRate number = faster firing
          fireRate *= (1 - val / 100);
          break;
        // sharpening and serrated_edge affect combat math, handled in Player/NightScene
        case 'sharpening':
        case 'serrated_edge':
          break;
      }
    }

    return {
      damage: Math.round(damage),
      range: Math.round(range),
      fireRate: Math.round(fireRate),
      noiseLevel,
      ammoPerNight,
      maxDurability,
      weaponClass: data.class,
      name: data.name,
      specialEffect: data.specialEffect ?? null,
    };
  }

  // XP and leveling
  addXP(weaponInstanceId: string, amount: number): void {
    const weapon = this.gameState.inventory.weapons.find(w => w.id === weaponInstanceId);
    if (!weapon || weapon.level >= 5) return;

    weapon.xp += amount;
    const needed = xpPerLevel[weapon.level] ?? 999;
    if (weapon.xp >= needed && weapon.level < 5) {
      weapon.xp -= needed;
      weapon.level++;
      this.scene.events.emit('weapon-leveled', weapon);
    }
  }

  getXPForNextLevel(weapon: WeaponInstance): number {
    if (weapon.level >= 5) return 0;
    return xpPerLevel[weapon.level] ?? 999;
  }

  // Durability
  decreaseDurability(weaponInstanceId: string): void {
    const weapon = this.gameState.inventory.weapons.find(w => w.id === weaponInstanceId);
    if (!weapon) return;
    weapon.durability = Math.max(0, weapon.durability - 1);
    if (weapon.durability <= 0) {
      this.scene.events.emit('weapon-broken', weapon);
    }
  }

  repair(weaponInstanceId: string): boolean {
    const weapon = this.gameState.inventory.weapons.find(w => w.id === weaponInstanceId);
    if (!weapon) return false;
    if (weapon.durability >= weapon.maxDurability) return false;
    if (this.gameState.inventory.resources.parts < 1) return false;

    this.gameState.inventory.resources.parts -= 1;
    weapon.durability = weapon.maxDurability;
    return true;
  }

  // ---------------------------------------------------------------------------
  // New multi-level upgrade API
  // ---------------------------------------------------------------------------

  /**
   * Returns all upgrades that can be applied or leveled up on this weapon.
   * Filters by applicableTo (weapon class) and excludes upgrades at maxLevel.
   */
  getAvailableUpgradesForWeapon(weapon: WeaponInstance): UpgradeDefinition[] {
    const data = WeaponManager.getWeaponData(weapon.weaponId);
    if (!data) return [];

    return upgradeDefinitions.filter(def => {
      // Must apply to this weapon class
      if (!def.applicableTo.includes(data.class)) return false;

      const existing = weapon.upgrades.find(u => u.id === def.id);
      if (existing) {
        // Already installed -- only show if not at max level
        return existing.level < def.maxLevel;
      }

      // Not yet installed -- only show if there is a free upgrade slot
      return weapon.upgrades.length < MAX_UPGRADES_PER_WEAPON;
    });
  }

  /**
   * Returns the current level (0 = not installed) of a specific upgrade on a weapon.
   */
  getUpgradeLevel(weapon: WeaponInstance, upgradeId: WeaponUpgradeType): number {
    return weapon.upgrades.find(u => u.id === upgradeId)?.level ?? 0;
  }

  /**
   * Returns the parts cost to upgrade to the next level.
   * Returns null if the upgrade is already at max level or not applicable.
   */
  getNextUpgradeCost(weapon: WeaponInstance, upgradeId: WeaponUpgradeType): number | null {
    const def = upgradeDefMap.get(upgradeId);
    if (!def) return null;

    const currentLevel = this.getUpgradeLevel(weapon, upgradeId);
    if (currentLevel >= def.maxLevel) return null;

    return def.costs[currentLevel] ?? null;
  }

  /**
   * Checks whether the player can afford the next upgrade level for upgradeId.
   * Also validates upgrade slot availability.
   */
  canUpgradeNew(weaponInstanceId: string, upgradeId: WeaponUpgradeType): boolean {
    const weapon = this.gameState.inventory.weapons.find(w => w.id === weaponInstanceId);
    if (!weapon) return false;

    const def = upgradeDefMap.get(upgradeId);
    if (!def) return false;

    const currentLevel = this.getUpgradeLevel(weapon, upgradeId);

    // Already at max level
    if (currentLevel >= def.maxLevel) return false;

    // Not yet installed and no free slots
    if (currentLevel === 0 && weapon.upgrades.length >= MAX_UPGRADES_PER_WEAPON) return false;

    const cost = def.costs[currentLevel];
    if (cost === undefined) return false;

    return this.gameState.inventory.resources.parts >= cost;
  }

  /**
   * Applies the next upgrade level (or installs at level 1) for upgradeId.
   * Returns true on success, false if prerequisites not met.
   */
  upgradeNew(weaponInstanceId: string, upgradeId: WeaponUpgradeType): boolean {
    if (!this.canUpgradeNew(weaponInstanceId, upgradeId)) return false;

    const weapon = this.gameState.inventory.weapons.find(w => w.id === weaponInstanceId);
    if (!weapon) return false;

    const def = upgradeDefMap.get(upgradeId);
    if (!def) return false;

    const currentLevel = this.getUpgradeLevel(weapon, upgradeId);
    const cost = def.costs[currentLevel];
    if (cost === undefined) return false;

    this.gameState.inventory.resources.parts -= cost;

    const existing = weapon.upgrades.find(u => u.id === upgradeId);
    if (existing) {
      existing.level++;
    } else {
      const newUpgrade: WeaponUpgrade = { id: upgradeId, level: 1 };
      weapon.upgrades.push(newUpgrade);
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Legacy single-level upgrade API (kept for backward compat; delegates to new)
  // ---------------------------------------------------------------------------

  canUpgrade(weaponInstanceId: string, upgradeType: WeaponUpgradeType): boolean {
    return this.canUpgradeNew(weaponInstanceId, upgradeType);
  }

  upgrade(weaponInstanceId: string, upgradeType: WeaponUpgradeType): boolean {
    return this.upgradeNew(weaponInstanceId, upgradeType);
  }

  // ---------------------------------------------------------------------------

  // Create a new weapon instance from weapon data
  static createWeaponInstance(weaponId: string, rarity?: Rarity): WeaponInstance | null {
    const data = WeaponManager.getWeaponData(weaponId);
    if (!data) return null;

    return {
      id: `${weaponId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      weaponId: weaponId,
      rarity: rarity ?? data.rarity,
      level: 1,
      xp: 0,
      durability: data.maxDurability,
      maxDurability: data.maxDurability,
      upgrades: [],
    };
  }

  isBroken(weapon: WeaponInstance): boolean {
    return weapon.durability <= 0;
  }

  /** Returns the maximum number of upgrade slots per weapon. */
  static getMaxUpgradesPerWeapon(): number {
    return MAX_UPGRADES_PER_WEAPON;
  }
}
