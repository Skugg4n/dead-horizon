// Dead Horizon -- Skill panel UI for DayScene
// Shows all skills with name, level, and XP progress bar

import Phaser from 'phaser';
import { SkillManager } from '../systems/SkillManager';
import { GAME_WIDTH } from '../config/constants';

const PANEL_WIDTH = 260;
const PANEL_PADDING = 12;
const ROW_HEIGHT = 44;
const BAR_WIDTH = 180;
const BAR_HEIGHT = 8;

export class SkillPanel {
  private scene: Phaser.Scene;
  private skillManager: SkillManager;
  private container: Phaser.GameObjects.Container;
  private visible: boolean = false;

  constructor(scene: Phaser.Scene, skillManager: SkillManager) {
    this.scene = scene;
    this.skillManager = skillManager;

    this.container = this.scene.add.container(
      GAME_WIDTH - PANEL_WIDTH - 16,
      60
    );
    this.container.setDepth(150);
    this.container.setVisible(false);

    this.buildPanel();

    // Listen for level-up events to refresh
    this.scene.events.on('skill-leveled', () => this.refresh());
  }

  private buildPanel(): void {
    // Clear existing children
    this.container.removeAll(true);

    const skills = this.skillManager.getAllSkills();
    const panelHeight = PANEL_PADDING * 2 + skills.length * ROW_HEIGHT + 24;

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.92);
    bg.fillRect(0, 0, PANEL_WIDTH, panelHeight);
    bg.lineStyle(1, 0x6B6B6B);
    bg.strokeRect(0, 0, PANEL_WIDTH, panelHeight);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(PANEL_WIDTH / 2, PANEL_PADDING, 'SKILLS', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#E8DCC8',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Skill rows
    skills.forEach((entry, i) => {
      const y = PANEL_PADDING + 24 + i * ROW_HEIGHT;

      // Skill name and level
      const label = this.scene.add.text(PANEL_PADDING, y, `${entry.data.name}  Lv ${entry.level}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#E8DCC8',
      });
      this.container.add(label);

      // XP progress bar
      const barY = y + 18;
      const currentLevelXP = this.skillManager.getXPForLevel(entry.data.id, entry.level);
      const nextLevelXP = this.skillManager.getXPForLevel(entry.data.id, entry.level + 1);

      // Bar background
      const barBg = this.scene.add.graphics();
      barBg.fillStyle(0x333333);
      barBg.fillRect(PANEL_PADDING, barY, BAR_WIDTH, BAR_HEIGHT);
      this.container.add(barBg);

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
        barFill.fillRect(PANEL_PADDING, barY, BAR_WIDTH * progress, BAR_HEIGHT);
        this.container.add(barFill);
      }

      // XP text
      const xpText = entry.level >= entry.data.maxLevel
        ? 'MAX'
        : `${entry.xp - currentLevelXP} / ${nextLevelXP - currentLevelXP}`;
      const xpLabel = this.scene.add.text(PANEL_PADDING + BAR_WIDTH + 6, barY - 1, xpText, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#6B6B6B',
      });
      this.container.add(xpLabel);
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.refresh();
    }
    this.container.setVisible(this.visible);
  }

  refresh(): void {
    this.buildPanel();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
