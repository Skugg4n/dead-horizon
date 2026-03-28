// Dead Horizon -- Skill system manager
// Tracks XP per skill, computes levels and bonuses from skills.json data

import Phaser from 'phaser';
import type { SkillType, SkillData, GameState } from '../config/types';
import skillsJson from '../data/skills.json';

const skillDataList = skillsJson.skills as unknown as SkillData[];

// Build a lookup map: skillId -> SkillData
const skillDataMap = new Map<SkillType, SkillData>();
for (const skill of skillDataList) {
  skillDataMap.set(skill.id, skill);
}

export class SkillManager {
  private scene: Phaser.Scene;
  private skillXP: Record<SkillType, number>;

  constructor(scene: Phaser.Scene, gameState: GameState) {
    this.scene = scene;
    // Copy current XP from game state
    this.skillXP = { ...gameState.player.skills };
  }

  /** Add XP to a skill. Returns true if the skill leveled up. */
  addXP(skillType: SkillType, amount: number): boolean {
    const oldLevel = this.getLevel(skillType);
    this.skillXP[skillType] += amount;
    const newLevel = this.getLevel(skillType);

    if (newLevel > oldLevel) {
      this.scene.events.emit('skill-leveled', { skill: skillType, newLevel });
      return true;
    }
    return false;
  }

  /** Get the current level for a skill based on accumulated XP. */
  getLevel(skillType: SkillType): number {
    const data = skillDataMap.get(skillType);
    if (!data) return 0;

    const xp = this.skillXP[skillType];
    let level = 0;
    let cumulativeXP = 0;

    for (let i = 0; i < data.xpPerLevel.length; i++) {
      cumulativeXP += data.xpPerLevel[i] ?? 0;
      if (xp >= cumulativeXP) {
        level = i + 1;
      } else {
        break;
      }
    }

    return Math.min(level, data.maxLevel);
  }

  /** Get the cumulative XP required to reach a given level. */
  getXPForLevel(skillType: SkillType, level: number): number {
    const data = skillDataMap.get(skillType);
    if (!data) return 0;

    let total = 0;
    for (let i = 0; i < level && i < data.xpPerLevel.length; i++) {
      total += data.xpPerLevel[i] ?? 0;
    }
    return total;
  }

  /** Get current XP for a skill. */
  getXP(skillType: SkillType): number {
    return this.skillXP[skillType];
  }

  /** Get the bonus value for a specific effect at the current skill level. */
  getBonus(skillType: SkillType, effectName: string): number {
    const data = skillDataMap.get(skillType);
    if (!data) return 0;

    const level = this.getLevel(skillType);
    const perLevel = data.effectPerLevel[effectName];
    if (perLevel === undefined) return 0;

    return level * perLevel;
  }

  /** Get all skill data with current XP and levels. */
  getAllSkills(): Array<{ data: SkillData; xp: number; level: number }> {
    return skillDataList.map(data => ({
      data,
      xp: this.skillXP[data.id],
      level: this.getLevel(data.id),
    }));
  }

  /** Get the static SkillData for a skill type. */
  static getSkillData(skillType: SkillType): SkillData | undefined {
    return skillDataMap.get(skillType);
  }

  /** Sync current XP values back into the GameState for saving. */
  syncToState(gameState: GameState): void {
    gameState.player.skills = { ...this.skillXP };
  }
}
