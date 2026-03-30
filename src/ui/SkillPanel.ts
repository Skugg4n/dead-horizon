// Dead Horizon -- Skill panel UI for DayScene
// Shows all skills with name, level, and XP progress bar

import Phaser from 'phaser';
import { SkillManager } from '../systems/SkillManager';
import { UIPanel } from './UIPanel';

const ROW_HEIGHT = 44;
const BAR_WIDTH = 160;
const BAR_HEIGHT = 8;

export class SkillPanel {
  private scene: Phaser.Scene;
  private skillManager: SkillManager;
  private panel: UIPanel;

  constructor(scene: Phaser.Scene, skillManager: SkillManager) {
    this.scene = scene;
    this.skillManager = skillManager;

    const skills = this.skillManager.getAllSkills();
    const panelHeight = skills.length * ROW_HEIGHT + 48;
    this.panel = new UIPanel(scene, 'SKILLS', 360, panelHeight);

    this.buildPanel();

    // Listen for level-up events to refresh
    this.scene.events.on('skill-leveled', () => this.refresh());
  }

  private buildPanel(): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const skills = this.skillManager.getAllSkills();

    // Skill rows
    skills.forEach((entry, i) => {
      const y = i * ROW_HEIGHT;

      // Skill name and level
      const label = this.scene.add.text(0, y, `${entry.data.name}  Lv ${entry.level}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#E8DCC8',
      });
      content.add(label);

      // XP progress bar
      const barY = y + 18;
      const currentLevelXP = this.skillManager.getXPForLevel(entry.data.id, entry.level);
      const nextLevelXP = this.skillManager.getXPForLevel(entry.data.id, entry.level + 1);

      // Bar background
      const barBg = this.scene.add.graphics();
      barBg.fillStyle(0x333333);
      barBg.fillRect(0, barY, BAR_WIDTH, BAR_HEIGHT);
      content.add(barBg);

      // Bar fill
      let progress = 0;
      if (entry.level >= entry.data.maxLevel) {
        progress = 1;
      } else if (nextLevelXP > currentLevelXP) {
        progress = (entry.xp - currentLevelXP) / (nextLevelXP - currentLevelXP);
      }
      progress = Math.max(0, Math.min(1, progress));

      if (progress > 0) {
        const barFill = this.scene.add.graphics();
        barFill.fillStyle(entry.level >= entry.data.maxLevel ? 0xC5A030 : 0x4CAF50);
        barFill.fillRect(0, barY, BAR_WIDTH * progress, BAR_HEIGHT);
        content.add(barFill);
      }

      // XP text
      const xpText = entry.level >= entry.data.maxLevel
        ? 'MAX'
        : `${entry.xp - currentLevelXP} / ${nextLevelXP - currentLevelXP}`;
      const xpLabel = this.scene.add.text(BAR_WIDTH + 6, barY - 1, xpText, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#6B6B6B',
      });
      content.add(xpLabel);
    });
  }

  toggle(): void {
    this.panel.toggle();
    if (this.panel.isVisible()) {
      this.refresh();
    }
  }

  refresh(): void {
    this.buildPanel();
  }

  isVisible(): boolean {
    return this.panel.isVisible();
  }

  /** Handle keyboard input. Returns true if handled. */
  handleKey(key: string): boolean {
    if (!this.panel.isVisible()) return false;

    if (key === 'Escape') {
      this.panel.hide();
      return true;
    }

    return false;
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.panel.getContainer();
  }

  getPanel(): UIPanel {
    return this.panel;
  }
}
