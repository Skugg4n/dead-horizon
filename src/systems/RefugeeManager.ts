// Dead Horizon -- Refugee manager
// Camp Crew: each refugee provides a passive daily bonus (food, scrap, or repair).
// No job assignment needed -- they just exist and help.

import Phaser from 'phaser';
import type { GameState, RefugeeInstance, RefugeeJob, RefugeeStatus, RefugeeBonusType } from '../config/types';
import {
  REFUGEE_NAMES,
  REFUGEE_SKILL_BONUSES,
  REFUGEE_MAX_HP,
  REFUGEE_ARRIVAL_CHANCE,
  REFUGEES_PER_SHELTER,
  REFUGEE_FOOD_PER_DAY,
  REFUGEE_FOOD_STARVE_DAMAGE,
  REFUGEE_HEAL_MEDS_COST,
} from '../config/constants';

// Possible passive bonus types in order so we can cycle through them evenly
const BONUS_TYPES: RefugeeBonusType[] = ['food', 'scrap', 'repair'];

export class RefugeeManager {
  private scene: Phaser.Scene;
  private gameState: GameState;
  private refugees: RefugeeInstance[];

  constructor(scene: Phaser.Scene, gameState: GameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.refugees = [...gameState.refugees];
  }

  getAll(): RefugeeInstance[] {
    return this.refugees;
  }

  getByStatus(status: RefugeeStatus): RefugeeInstance[] {
    return this.refugees.filter(r => r.status === status);
  }

  getByJob(job: RefugeeJob): RefugeeInstance[] {
    return this.refugees.filter(r => r.job === job);
  }

  getById(id: string): RefugeeInstance | undefined {
    return this.refugees.find(r => r.id === id);
  }

  getMaxRefugees(): number {
    const shelterCount = this.gameState.base.structures.filter(
      s => s.structureId === 'shelter'
    ).length;
    return shelterCount === 0 ? 1 : shelterCount * REFUGEES_PER_SHELTER;
  }

  addRefugee(): RefugeeInstance | null {
    if (this.refugees.length >= this.getMaxRefugees()) {
      return null;
    }

    // Assign bonus type at rescue time: cycle through food/scrap/repair evenly
    const bonusType: RefugeeBonusType =
      BONUS_TYPES[this.refugees.length % BONUS_TYPES.length] ?? 'food';

    const refugee: RefugeeInstance = {
      id: `refugee_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: this.generateName(),
      hp: REFUGEE_MAX_HP,
      maxHp: REFUGEE_MAX_HP,
      status: 'healthy',
      job: null,
      skillBonus: REFUGEE_SKILL_BONUSES[Math.floor(Math.random() * REFUGEE_SKILL_BONUSES.length)] ?? 'Tough',
      bonusType,
    };

    this.refugees.push(refugee);
    this.scene.events.emit('refugee-arrived', refugee);
    return refugee;
  }

  // Ensure all loaded refugees have a bonusType (backward compat with saves from before Camp Crew).
  // Called once after constructing the manager. Old save files lack this field at runtime.
  ensureBonusTypes(): void {
    this.refugees.forEach((refugee, i) => {
      // Cast to allow undefined-check on data that predates the bonusType field
      const r = refugee as RefugeeInstance & { bonusType?: RefugeeBonusType };
      if (!r.bonusType) {
        refugee.bonusType = BONUS_TYPES[i % BONUS_TYPES.length] ?? 'food';
      }
    });
  }

  removeRefugee(id: string): void {
    const idx = this.refugees.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.refugees.splice(idx, 1);
    }
  }

  assignJob(id: string, job: RefugeeJob): boolean {
    const refugee = this.getById(id);
    if (!refugee) return false;

    // Injured refugees can only rest
    if (refugee.status === 'injured' && job !== 'rest') {
      return false;
    }

    refugee.job = job;
    return true;
  }

  // Called at day start -- 20% chance to get a new refugee
  tryRandomArrival(): RefugeeInstance | null {
    if (Math.random() < REFUGEE_ARRIVAL_CHANCE) {
      return this.addRefugee();
    }
    return null;
  }

  // Called at day start -- each refugee eats 1 food, player eats 1 food
  consumeFood(): { needed: number; available: number; missing: number } {
    const needed = this.refugees.length * REFUGEE_FOOD_PER_DAY + 1; // +1 for player
    const available = this.gameState.inventory.resources.food;
    const consumed = Math.min(needed, available);
    this.gameState.inventory.resources.food -= consumed;

    const missing = needed - consumed;
    if (missing > 0) {
      // Starve refugees (not player -- player HP is handled elsewhere)
      let remaining = missing;
      for (const refugee of this.refugees) {
        if (remaining <= 0) break;
        refugee.hp -= REFUGEE_FOOD_STARVE_DAMAGE;
        remaining--;
        if (refugee.hp <= 0) {
          this.scene.events.emit('refugee-died', refugee);
        }
      }
      // Remove dead refugees
      this.refugees = this.refugees.filter(r => r.hp > 0);
    }

    return { needed, available, missing };
  }

  // Returns true if the inventory has at least one med for healing
  hasMedsForHeal(): boolean {
    return this.gameState.inventory.resources.meds >= REFUGEE_HEAL_MEDS_COST;
  }

  // Manually heal one refugee via the panel Heal button (costs 1 med)
  healRefugee(id: string): boolean {
    const refugee = this.getById(id);
    if (!refugee || refugee.status !== 'injured') return false;
    if (!this.hasMedsForHeal()) return false;

    this.gameState.inventory.resources.meds -= REFUGEE_HEAL_MEDS_COST;
    refugee.hp = refugee.maxHp;
    refugee.status = 'healthy';
    this.scene.events.emit('refugee-healed', refugee);
    return true;
  }

  // Called at day start -- injured refugees heal passively if player spends 1 med
  // In Camp Crew mode the player clicks "Heal" in the panel, but this auto-heals on day start too.
  processHealing(): string[] {
    const messages: string[] = [];
    // Heal any injured refugees that can afford meds (no job assignment required)
    const injured = this.refugees.filter(r => r.status === 'injured');

    for (const refugee of injured) {
      if (this.gameState.inventory.resources.meds >= REFUGEE_HEAL_MEDS_COST) {
        this.gameState.inventory.resources.meds -= REFUGEE_HEAL_MEDS_COST;
        refugee.hp = refugee.maxHp;
        refugee.status = 'healthy';
        this.scene.events.emit('refugee-healed', refugee);
        messages.push(`${refugee.name} healed`);
      }
    }
    return messages;
  }

  // --- Camp Crew passive bonuses ---

  // Returns count of healthy refugees with a given bonus type
  private countHealthyByBonus(type: RefugeeBonusType): number {
    return this.refugees.filter(r => r.status === 'healthy' && r.bonusType === type).length;
  }

  getDailyFoodBonus(): number {
    return this.countHealthyByBonus('food');
  }

  getDailyScrapBonus(): number {
    return this.countHealthyByBonus('scrap');
  }

  // Returns the repair bonus count -- used to extend trap lifetime by this many nights
  getRepairBonus(): number {
    return this.countHealthyByBonus('repair');
  }

  // Apply passive daily bonuses to game state resources.
  // Repair bonus applies via getRepairBonus() -- callers read the value and handle trap extension.
  applyDailyBonuses(): { food: number; scrap: number; repairBonus: number } {
    const food = this.getDailyFoodBonus();
    const scrap = this.getDailyScrapBonus();
    const repairBonus = this.getRepairBonus();

    this.gameState.inventory.resources.food += food;
    this.gameState.inventory.resources.scrap += scrap;

    return { food, scrap, repairBonus };
  }

  // Legacy method kept for backward compatibility -- returns zeroes since gathering is now passive
  processGathering(): { food: number; scrap: number; repaired: number } {
    // Gathering is now handled by applyDailyBonuses() at day start.
    // This stub prevents compile errors from any remaining callers.
    return { food: 0, scrap: 0, repaired: 0 };
  }

  // Night phase: damage a refugee in a pillbox when the structure takes damage
  damageRefugeeInPillbox(refugeeId: string, damage: number): void {
    const refugee = this.getById(refugeeId);
    if (!refugee) return;

    const toughReduction = refugee.skillBonus === 'Tough' ? 0.5 : 1.0;
    const actualDamage = Math.round(damage * toughReduction);
    refugee.hp -= actualDamage;

    if (refugee.hp <= 0) {
      refugee.hp = 0;
      this.scene.events.emit('refugee-died', refugee);
      this.removeRefugee(refugeeId);
    } else {
      refugee.status = 'injured';
      refugee.job = 'rest';
      this.scene.events.emit('refugee-injured', refugee);
    }
  }

  // Get refugees assigned to pillbox duty (job === 'pillbox' and healthy)
  getPillboxRefugees(): RefugeeInstance[] {
    return this.refugees.filter(r => r.job === 'pillbox' && r.status === 'healthy');
  }

  syncToState(): void {
    this.gameState.refugees = [...this.refugees];
  }

  private generateName(): string {
    // Avoid duplicate names
    const usedNames = new Set(this.refugees.map(r => r.name));
    const available = REFUGEE_NAMES.filter(n => !usedNames.has(n));
    if (available.length === 0) {
      return `Refugee #${this.refugees.length + 1}`;
    }
    return available[Math.floor(Math.random() * available.length)] ?? `Refugee #${this.refugees.length + 1}`;
  }
}
