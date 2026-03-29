// Dead Horizon -- Refugee manager
// Tracks refugees, job assignments, healing, food consumption, and random arrivals

import Phaser from 'phaser';
import type { GameState, RefugeeInstance, RefugeeJob, RefugeeStatus } from '../config/types';
import {
  REFUGEE_NAMES,
  REFUGEE_SKILL_BONUSES,
  REFUGEE_MAX_HP,
  REFUGEE_ARRIVAL_CHANCE,
  REFUGEES_PER_SHELTER,
  REFUGEE_FOOD_PER_DAY,
  REFUGEE_FOOD_STARVE_DAMAGE,
  REFUGEE_HEAL_MEDS_COST,
  REFUGEE_GATHER_FOOD_AMOUNT,
  REFUGEE_GATHER_SCRAP_AMOUNT,
  REFUGEE_REPAIR_AMOUNT,
} from '../config/constants';

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

    const refugee: RefugeeInstance = {
      id: `refugee_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: this.generateName(),
      hp: REFUGEE_MAX_HP,
      maxHp: REFUGEE_MAX_HP,
      status: 'healthy',
      job: null,
      skillBonus: REFUGEE_SKILL_BONUSES[Math.floor(Math.random() * REFUGEE_SKILL_BONUSES.length)] ?? 'Tough',
    };

    this.refugees.push(refugee);
    this.scene.events.emit('refugee-arrived', refugee);
    return refugee;
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

  // Called at day start -- injured refugees on 'rest' job heal if meds available
  processHealing(): string[] {
    const messages: string[] = [];
    const resting = this.refugees.filter(r => r.status === 'injured' && r.job === 'rest');

    for (const refugee of resting) {
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

  // Called at end of day -- refugees on jobs produce resources
  processGathering(): { food: number; scrap: number; repaired: number } {
    let food = 0;
    let scrap = 0;
    let repaired = 0;

    for (const refugee of this.refugees) {
      if (refugee.status !== 'healthy') continue;

      switch (refugee.job) {
        case 'gather_food': {
          const amount = refugee.skillBonus === 'Fast gatherer'
            ? REFUGEE_GATHER_FOOD_AMOUNT + 1
            : REFUGEE_GATHER_FOOD_AMOUNT;
          food += amount;
          break;
        }
        case 'gather_scrap': {
          const amount = refugee.skillBonus === 'Fast gatherer'
            ? REFUGEE_GATHER_SCRAP_AMOUNT + 1
            : REFUGEE_GATHER_SCRAP_AMOUNT;
          scrap += amount;
          break;
        }
        case 'repair': {
          const amount = refugee.skillBonus === 'Mechanic'
            ? REFUGEE_REPAIR_AMOUNT + 5
            : REFUGEE_REPAIR_AMOUNT;
          // Find a damaged structure and repair it
          const damaged = this.gameState.base.structures.filter(s => s.hp < s.maxHp);
          if (damaged.length > 0) {
            const target = damaged[Math.floor(Math.random() * damaged.length)];
            if (target) {
              target.hp = Math.min(target.maxHp, target.hp + amount);
              repaired += amount;
            }
          }
          break;
        }
      }
    }

    this.gameState.inventory.resources.food += food;
    this.gameState.inventory.resources.scrap += scrap;

    return { food, scrap, repaired };
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

  // Get refugees that can be stationed in pillboxes (healthy, not on other critical jobs)
  getPillboxRefugees(): RefugeeInstance[] {
    return this.refugees.filter(r => r.status === 'healthy');
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
