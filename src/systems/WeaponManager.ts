// Manages weapon inventory, equipping, XP, leveling, durability, and upgrades
import Phaser from 'phaser';
import type {
  GameState,
  WeaponInstance,
  WeaponData,
  WeaponClass,
  WeaponUpgradeType,
  WeaponUpgradeData,
  Rarity,
} from '../config/types';
import weaponsJson from '../data/weapons.json';
import upgradesJson from '../data/weapon-upgrades.json';

const weaponDataList = weaponsJson.weapons as WeaponData[];
const upgradeDataList = upgradesJson.upgrades as WeaponUpgradeData[];
const rarityMultipliers = upgradesJson.rarityMultipliers as Record<Rarity, number>;
const xpPerLevel = upgradesJson.xpPerLevel as number[];

// Cached Map for O(1) weapon lookups by id
const weaponMap = new Map<string, WeaponData>();
for (const w of weaponDataList) {
  weaponMap.set(w.id, w);
}

// Cached Map for O(1) upgrade lookups by id
const upgradeMap = new Map<string, WeaponUpgradeData>();
for (const u of upgradeDataList) {
  upgradeMap.set(u.id, u);
}

// Level bonuses: cumulative reload speed and damage bonuses per level
// Lvl2 +10% reload, Lvl3 +10% damage, Lvl4 +10% reload, Lvl5 special
function getLevelDamageMultiplier(level: number): number {
  // Lvl3+ gets +10% damage
  if (level >= 3) return 1.10;
  return 1.0;
}

function getLevelFireRateMultiplier(level: number): number {
  // Lvl2 +10% reload speed, Lvl4 another +10% (cumulative)
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

    // Default to first weapon if available
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

  static getUpgradeData(upgradeId: WeaponUpgradeType): WeaponUpgradeData | undefined {
    return upgradeMap.get(upgradeId);
  }

  static getAllUpgradeData(): WeaponUpgradeData[] {
    return upgradeDataList;
  }

  // Get effective stats for a weapon instance (base * rarity * level * upgrades)
  getWeaponStats(weapon: WeaponInstance): {
    damage: number;
    range: number;
    fireRate: number;
    noiseLevel: number;
    weaponClass: WeaponClass;
    name: string;
  } {
    const data = WeaponManager.getWeaponData(weapon.weaponId);
    if (!data) {
      return { damage: 1, range: 40, fireRate: 500, noiseLevel: 0, weaponClass: 'melee', name: 'Unknown' };
    }

    const rarityMult = rarityMultipliers[weapon.rarity] ?? 1.0;
    const levelDamageMult = getLevelDamageMultiplier(weapon.level);
    const levelFireRateMult = getLevelFireRateMultiplier(weapon.level);

    let damage = data.damage * rarityMult * levelDamageMult;
    let range = data.range;
    const fireRate = data.fireRate * levelFireRateMult;
    let noiseLevel = data.noiseLevel;

    // Apply upgrades
    for (const upgrade of weapon.upgrades) {
      switch (upgrade) {
        case 'damage_boost':
          damage *= 1.15;
          break;
        case 'scope':
          range *= 1.15;
          break;
        case 'suppressor':
          noiseLevel = Math.max(0, noiseLevel - 1);
          break;
        // extended_mag and reinforcement handled elsewhere
      }
    }

    return {
      damage: Math.round(damage),
      range: Math.round(range),
      fireRate: Math.round(fireRate),
      noiseLevel,
      weaponClass: data.class,
      name: data.name,
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

  // Upgrades
  canUpgrade(weaponInstanceId: string, upgradeType: WeaponUpgradeType): boolean {
    const weapon = this.gameState.inventory.weapons.find(w => w.id === weaponInstanceId);
    if (!weapon) return false;
    if (weapon.upgrades.includes(upgradeType)) return false;

    const upgradeData = WeaponManager.getUpgradeData(upgradeType);
    if (!upgradeData) return false;

    return this.gameState.inventory.resources.parts >= upgradeData.partsCost;
  }

  upgrade(weaponInstanceId: string, upgradeType: WeaponUpgradeType): boolean {
    if (!this.canUpgrade(weaponInstanceId, upgradeType)) return false;

    const weapon = this.gameState.inventory.weapons.find(w => w.id === weaponInstanceId);
    if (!weapon) return false;

    const upgradeData = WeaponManager.getUpgradeData(upgradeType);
    if (!upgradeData) return false;

    this.gameState.inventory.resources.parts -= upgradeData.partsCost;
    weapon.upgrades.push(upgradeType);

    // Apply reinforcement immediately to maxDurability
    if (upgradeType === 'reinforcement') {
      weapon.maxDurability = Math.round(weapon.maxDurability * 1.25);
    }

    return true;
  }

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
}
