// Dead Horizon -- Refugee panel UI for DayScene
// U2: Redesigned with portrait icon per refugee (circle, colour-coded by health status),
//     cleaner job buttons with active highlight, contained layout (no overflow).

import Phaser from 'phaser';
import { RefugeeManager } from '../systems/RefugeeManager';
import { REFUGEE_FOOD_PER_DAY } from '../config/constants';
import { UIPanel } from './UIPanel';
import type { RefugeeJob, RefugeeInstance } from '../config/types';

// Height per refugee row: portrait (32) + buttons (20) + separator (8) + gap (4)
const ROW_HEIGHT = 68;

// Portrait circle radius
const PORTRAIT_R = 14;

// Jobs shown as buttons (loot_run is not assignable via button)
const JOB_BUTTONS: RefugeeJob[] = ['gather_food', 'gather_scrap', 'repair', 'rest'];

const JOB_LABELS: Record<RefugeeJob, string> = {
  gather_food: 'FOOD',
  gather_scrap: 'SCRAP',
  repair: 'FIX',
  rest: 'REST',
  loot_run: 'LOOT',
};

// Status -> portrait fill colour
const STATUS_COLORS: Record<string, number> = {
  healthy: 0x4CAF50,
  injured: 0xFFD700,
  away: 0x4A90D9,
};

// Used when an injured refugee is critically low on HP
const CRITICAL_COLOR = 0xF44336;

// Content area width (panel width 360, padding 12 each side)
const CONTENT_W = 360 - 24;

export class RefugeePanel {
  private scene: Phaser.Scene;
  private refugeeManager: RefugeeManager;
  private panel: UIPanel;

  constructor(scene: Phaser.Scene, refugeeManager: RefugeeManager) {
    this.scene = scene;
    this.refugeeManager = refugeeManager;

    this.panel = new UIPanel(scene, 'REFUGEES', 360, 460);

    this.buildPanel();

    // Refresh when refugee state changes
    this.scene.events.on('refugee-arrived', () => this.refresh());
    this.scene.events.on('refugee-healed', () => this.refresh());
    this.scene.events.on('refugee-died', () => this.refresh());
  }

  private buildPanel(): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const refugees = this.refugeeManager.getAll();
    const maxRefugees = this.refugeeManager.getMaxRefugees();
    const foodNeeded = refugees.length * REFUGEE_FOOD_PER_DAY + 1;

    // Summary info line
    const infoStr = `${refugees.length}/${maxRefugees} survivors  |  Food: ${foodNeeded}/day`;
    content.add(
      this.scene.add.text(0, 0, infoStr, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#6B6B6B',
      }),
    );

    if (refugees.length === 0) {
      content.add(
        this.scene.add.text(0, 20, 'No survivors yet.', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '10px',
          color: '#6B6B6B',
        }),
      );
      return;
    }

    // Render each refugee row
    refugees.forEach((refugee, i) => {
      const rowY = 18 + i * ROW_HEIGHT;
      this.buildRefugeeRow(content, refugee, rowY, i < refugees.length - 1);
    });
  }

  // Build a single refugee row: portrait | name + stats | job buttons
  private buildRefugeeRow(
    content: Phaser.GameObjects.Container,
    refugee: RefugeeInstance,
    rowY: number,
    addSeparator: boolean,
  ): void {
    // Determine portrait colour: critical (injured + low HP) uses red, otherwise status map
    const isCritical = refugee.status === 'injured' && refugee.hp <= refugee.maxHp * 0.2;
    const portraitColor = isCritical
      ? CRITICAL_COLOR
      : (STATUS_COLORS[refugee.status] ?? 0x4CAF50);

    // --- Portrait circle ---
    const portrait = this.scene.add.graphics();
    portrait.fillStyle(portraitColor, 1);
    portrait.fillCircle(PORTRAIT_R, PORTRAIT_R, PORTRAIT_R);
    // Thin darker ring
    portrait.lineStyle(1, 0x000000, 0.4);
    portrait.strokeCircle(PORTRAIT_R, PORTRAIT_R, PORTRAIT_R);

    // Initials inside circle
    const initials = refugee.name.split(' ').map(n => n[0] ?? '').join('').substring(0, 2).toUpperCase();
    const initialsText = this.scene.add.text(PORTRAIT_R, PORTRAIT_R, initials, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#000000',
    }).setOrigin(0.5);

    portrait.setPosition(0, rowY + 2);
    initialsText.setPosition(PORTRAIT_R, rowY + 2 + PORTRAIT_R);

    content.add(portrait);
    content.add(initialsText);

    // --- Name + stats ---
    const textX = PORTRAIT_R * 2 + 6;

    const nameText = this.scene.add.text(textX, rowY + 2, refugee.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
      wordWrap: { width: CONTENT_W - textX },
    });
    content.add(nameText);

    const hpPct = refugee.maxHp > 0 ? refugee.hp / refugee.maxHp : 0;
    const hpColor = hpPct > 0.5 ? '#4CAF50' : hpPct > 0.25 ? '#FFD700' : '#F44336';
    const jobLabel = refugee.job ? JOB_LABELS[refugee.job] ?? refugee.job : 'Idle';
    const statsText = this.scene.add.text(
      textX,
      rowY + 15,
      `HP ${refugee.hp}/${refugee.maxHp}  |  ${jobLabel}  |  ${refugee.skillBonus}`,
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: hpColor,
        wordWrap: { width: CONTENT_W - textX },
      },
    );
    content.add(statsText);

    // HP bar (narrow, under stats text)
    const barW = CONTENT_W - textX;
    const barBg = this.scene.add.graphics();
    barBg.fillStyle(0x333333, 1);
    barBg.fillRect(textX, rowY + 26, barW, 3);
    content.add(barBg);

    if (hpPct > 0) {
      const barFill = this.scene.add.graphics();
      const fillColor = hpPct > 0.5 ? 0x4CAF50 : hpPct > 0.25 ? 0xFFD700 : 0xF44336;
      barFill.fillStyle(fillColor, 1);
      barFill.fillRect(textX, rowY + 26, Math.floor(barW * hpPct), 3);
      content.add(barFill);
    }

    // --- Job buttons ---
    const btnY = rowY + 34;
    let btnX = textX;

    for (const job of JOB_BUTTONS) {
      const isCurrentJob = refugee.job === job;
      const canAssign = refugee.status !== 'injured' || job === 'rest';

      // Decide colours
      let bgColor = 0x2A2A2A;
      let textColor = '#6B6B6B';
      if (isCurrentJob) {
        bgColor = 0x4A90D9;
        textColor = '#FFFFFF';
      } else if (canAssign) {
        bgColor = 0x333333;
        textColor = '#E8DCC8';
      }

      const label = JOB_LABELS[job];
      // Measure text to size button dynamically
      const tmpText = this.scene.add.text(0, 0, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: textColor,
      });
      const btnW = tmpText.width + 8;
      tmpText.destroy();

      // Button background
      const btnBg = this.scene.add.graphics();
      btnBg.fillStyle(bgColor, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, 16, 2);
      content.add(btnBg);

      // Button label
      const btnText = this.scene.add.text(btnX + btnW / 2, btnY + 8, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: textColor,
      }).setOrigin(0.5);
      content.add(btnText);

      // Interaction
      if (canAssign && !isCurrentJob) {
        btnBg.setInteractive(
          new Phaser.Geom.Rectangle(btnX, btnY, btnW, 16),
          Phaser.Geom.Rectangle.Contains,
        );
        btnBg.on('pointerover', () => {
          btnBg.clear();
          btnBg.fillStyle(0x4A90D9, 0.6);
          btnBg.fillRoundedRect(btnX, btnY, btnW, 16, 2);
          btnText.setColor('#FFD700');
        });
        btnBg.on('pointerout', () => {
          btnBg.clear();
          btnBg.fillStyle(0x333333, 1);
          btnBg.fillRoundedRect(btnX, btnY, btnW, 16, 2);
          btnText.setColor('#E8DCC8');
        });
        btnBg.on('pointerdown', () => {
          this.refugeeManager.assignJob(refugee.id, job);
          this.refresh();
        });
      }

      btnX += btnW + 4;

      // Stop adding buttons if we'd overflow the content area
      if (btnX > CONTENT_W - 20) break;
    }

    // Row separator
    if (addSeparator) {
      const sep = this.scene.add.graphics();
      sep.lineStyle(1, 0x444444, 0.5);
      sep.lineBetween(0, rowY + ROW_HEIGHT - 4, CONTENT_W, rowY + ROW_HEIGHT - 4);
      content.add(sep);
    }
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
