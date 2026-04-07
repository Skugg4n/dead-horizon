// Dead Horizon -- Camp Crew panel (simplified refugee UI)
// Replaces the old job-assignment panel.
// Each refugee shows: name | bonus type | status (healthy / injured - healing).
// Only interactive element: "Heal" button for injured refugees (costs 1 med).

import Phaser from 'phaser';
import { RefugeeManager } from '../systems/RefugeeManager';
import { REFUGEE_FOOD_PER_DAY, REFUGEE_HEAL_MEDS_COST } from '../config/constants';
import { UIPanel } from './UIPanel';
import type { RefugeeInstance } from '../config/types';

// Height per refugee row: portrait circle + text + separator
const ROW_HEIGHT = 42;

// Portrait circle radius
const PORTRAIT_R = 12;

// Human-readable labels for each bonus type
const BONUS_LABELS: Record<string, string> = {
  food:   '+1 Food/day',
  scrap:  '+1 Scrap/day',
  repair: '+1 Repair',
};

// Portrait colour by status
const STATUS_COLORS: Record<string, number> = {
  healthy: 0x4CAF50,
  injured: 0xFFD700,
  away:    0x4A90D9,
};

// Colour used when hp is critically low
const CRITICAL_COLOR = 0xF44336;

// Content area width (panel 360, padding 12 each side)
const CONTENT_W = 360 - 24;

export class RefugeePanel {
  private scene: Phaser.Scene;
  private refugeeManager: RefugeeManager;
  private panel: UIPanel;

  constructor(scene: Phaser.Scene, refugeeManager: RefugeeManager) {
    this.scene = scene;
    this.refugeeManager = refugeeManager;

    this.panel = new UIPanel(scene, 'CAMP CREW', 360, 380);

    this.buildPanel();

    // Refresh on any refugee state change
    this.scene.events.on('refugee-arrived',  () => this.refresh());
    this.scene.events.on('refugee-healed',   () => this.refresh());
    this.scene.events.on('refugee-died',     () => this.refresh());
    this.scene.events.on('refugee-injured',  () => this.refresh());
  }

  /** Handle keyboard input for the refugee panel (1-9 heals injured refugees). Returns true if handled. */
  handleKey(key: string): boolean {
    if (!this.panel.isVisible()) return false;

    if (key === 'Escape') {
      this.panel.hide();
      return true;
    }

    // Number keys: heal injured refugee at that position among injured refugees
    const num = parseInt(key, 10);
    if (num >= 1 && num <= 9) {
      const injured = this.refugeeManager.getAll().filter(r => r.status === 'injured');
      const target = injured[num - 1];
      if (target && this.refugeeManager.hasMedsForHeal()) {
        this.refugeeManager.healRefugee(target.id);
        this.refresh();
        return true;
      }
    }

    return false;
  }

  private buildPanel(): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const refugees = this.refugeeManager.getAll();
    const maxRefugees = this.refugeeManager.getMaxRefugees();

    // Header summary
    const foodNeeded = refugees.length * REFUGEE_FOOD_PER_DAY + 1;
    const summaryStr = `CAMP CREW (${refugees.length}/${maxRefugees})  |  Food: ${foodNeeded}/day`;
    content.add(
      this.scene.add.text(0, 0, summaryStr, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#6B6B6B',
      }),
    );

    if (refugees.length === 0) {
      content.add(
        this.scene.add.text(0, 20, 'No crew yet. Rescue survivors on loot runs.', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: '#6B6B6B',
          wordWrap: { width: CONTENT_W },
        }),
      );
      return;
    }

    // Total daily bonuses from all healthy refugees
    const totalFood = refugees.filter(r => r.status === 'healthy' && r.bonusType === 'food').length;
    const totalScrap = refugees.filter(r => r.status === 'healthy' && r.bonusType === 'scrap').length;
    const totalRepair = refugees.filter(r => r.status === 'healthy' && r.bonusType === 'repair').length;
    const bonusParts: string[] = [];
    if (totalFood > 0) bonusParts.push(`+${totalFood} food`);
    if (totalScrap > 0) bonusParts.push(`+${totalScrap} scrap`);
    if (totalRepair > 0) bonusParts.push(`+${totalRepair} repair`);
    const bonusStr = bonusParts.length > 0 ? `Daily: ${bonusParts.join(', ')}` : 'No bonuses yet';
    content.add(
      this.scene.add.text(0, 12, bonusStr, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#88FF88',
      }),
    );

    // Track injured index separately so heal buttons can show [1] [2] etc per-injured
    let injuredIndex = 0;
    refugees.forEach((refugee, i) => {
      const rowY = 30 + i * ROW_HEIGHT;
      const keyIndex = refugee.status === 'injured' ? injuredIndex++ : -1;
      this.buildCrewRow(content, refugee, rowY, i < refugees.length - 1, keyIndex);
    });

    // Help line at the bottom explaining refugee mechanics
    const helpY = 30 + refugees.length * ROW_HEIGHT + 6;
    content.add(
      this.scene.add.text(0, helpY, 'Rescue survivors on loot runs. Max 5. Each gives +1 bonus/day.', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#555555',
        wordWrap: { width: CONTENT_W },
      }),
    );
  }

  // Build one crew member row: portrait circle | name + bonus label | status / heal button
  // keyIndex: if >= 0, this is an injured refugee at that keyboard-shortcut index
  private buildCrewRow(
    content: Phaser.GameObjects.Container,
    refugee: RefugeeInstance,
    rowY: number,
    addSeparator: boolean,
    keyIndex: number = -1,
  ): void {
    const isCritical = refugee.status === 'injured' && refugee.hp <= refugee.maxHp * 0.2;
    const portraitColor = isCritical
      ? CRITICAL_COLOR
      : (STATUS_COLORS[refugee.status] ?? 0x4CAF50);

    // Portrait circle with initials
    const portrait = this.scene.add.graphics();
    portrait.fillStyle(portraitColor, 1);
    portrait.fillCircle(PORTRAIT_R, PORTRAIT_R, PORTRAIT_R);
    portrait.lineStyle(1, 0x000000, 0.4);
    portrait.strokeCircle(PORTRAIT_R, PORTRAIT_R, PORTRAIT_R);
    portrait.setPosition(0, rowY + 2);
    content.add(portrait);

    const initials = refugee.name
      .split(' ')
      .map(n => n[0] ?? '')
      .join('')
      .substring(0, 2)
      .toUpperCase();
    const initialsText = this.scene.add.text(PORTRAIT_R, rowY + 2 + PORTRAIT_R, initials, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#000000',
    }).setOrigin(0.5);
    content.add(initialsText);

    // Name and bonus label
    const textX = PORTRAIT_R * 2 + 6;
    content.add(
      this.scene.add.text(textX, rowY + 3, refugee.name, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#E8DCC8',
      }),
    );

    const bonusLabel = BONUS_LABELS[refugee.bonusType] ?? refugee.bonusType;
    const bonusColor = refugee.status === 'healthy' ? '#88FF88' : '#888888';
    content.add(
      this.scene.add.text(textX, rowY + 16, bonusLabel, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: bonusColor,
      }),
    );

    // Status text + optional Heal button (right side)
    const rightX = CONTENT_W;

    if (refugee.status === 'injured') {
      // Status label
      content.add(
        this.scene.add.text(rightX, rowY + 3, 'injured', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: '#FFD700',
        }).setOrigin(1, 0),
      );

      // Heal button (costs REFUGEE_HEAL_MEDS_COST med) -- show keyboard shortcut if index in range
      const keyLabel = keyIndex >= 0 && keyIndex < 9 ? `[${keyIndex + 1}] ` : '';
      const healLabel = `${keyLabel}Heal (${REFUGEE_HEAL_MEDS_COST} med)`;
      const healText = this.scene.add.text(rightX, rowY + 18, healLabel, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#4A90D9',
      }).setOrigin(1, 0);

      const hasMeds =
        // Access gameState indirectly via manager -- read current resource count
        this.refugeeManager.getAll().length >= 0 &&
        this.canAffordHeal();

      if (hasMeds) {
        healText.setInteractive({ useHandCursor: true });
        healText.on('pointerover', () => healText.setColor('#FFD700'));
        healText.on('pointerout',  () => healText.setColor('#4A90D9'));
        healText.on('pointerdown', () => {
          this.refugeeManager.healRefugee(refugee.id);
          this.refresh();
        });
      } else {
        healText.setColor('#555555');
      }

      content.add(healText);
    } else {
      // Healthy status
      content.add(
        this.scene.add.text(rightX, rowY + 3, 'healthy', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: '#4CAF50',
        }).setOrigin(1, 0),
      );
    }

    // Row separator
    if (addSeparator) {
      const sep = this.scene.add.graphics();
      sep.lineStyle(1, 0x444444, 0.5);
      sep.lineBetween(0, rowY + ROW_HEIGHT - 4, CONTENT_W, rowY + ROW_HEIGHT - 4);
      content.add(sep);
    }
  }

  // Check if meds are available via refugeeManager (uses public accessor)
  private canAffordHeal(): boolean {
    return this.refugeeManager.hasMedsForHeal();
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

  getContainer(): Phaser.GameObjects.Container {
    return this.panel.getContainer();
  }

  getPanel(): UIPanel {
    return this.panel;
  }
}
