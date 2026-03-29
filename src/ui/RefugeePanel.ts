// Dead Horizon -- Refugee panel UI for DayScene
// Shows refugee list with name, HP, status, job, skill bonus, and job assignment buttons
// All text is word-wrapped to fit within the panel width

import Phaser from 'phaser';
import { RefugeeManager } from '../systems/RefugeeManager';
import { REFUGEE_FOOD_PER_DAY } from '../config/constants';
import { UIPanel } from './UIPanel';
import type { RefugeeJob } from '../config/types';

const ROW_HEIGHT = 56;
// Panel inner content width: UIPanel uses width=360, padding=12 each side
const CONTENT_WIDTH = 336;

const JOB_LABELS: Record<RefugeeJob, string> = {
  gather_food: 'Food',
  gather_scrap: 'Scrap',
  repair: 'Fix',
  rest: 'Rest',
  loot_run: 'Loot',
};

const JOB_BUTTONS: RefugeeJob[] = ['gather_food', 'gather_scrap', 'repair', 'rest'];

export class RefugeePanel {
  private scene: Phaser.Scene;
  private refugeeManager: RefugeeManager;
  private panel: UIPanel;

  constructor(scene: Phaser.Scene, refugeeManager: RefugeeManager) {
    this.scene = scene;
    this.refugeeManager = refugeeManager;

    this.panel = new UIPanel(scene, 'REFUGEES', 360, 400);

    this.buildPanel();

    // Listen for refugee events to refresh
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

    // Info line -- word-wrapped to content width
    const infoStr = `${refugees.length}/${maxRefugees} refugees  |  Food: ${foodNeeded}/day`;
    const info = this.scene.add.text(0, 0, infoStr, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
      wordWrap: { width: CONTENT_WIDTH },
    });
    content.add(info);

    if (refugees.length === 0) {
      const empty = this.scene.add.text(0, 20, 'No refugees yet', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#6B6B6B',
      });
      content.add(empty);
      return;
    }

    // Refugee rows
    refugees.forEach((refugee, i) => {
      const y = 20 + i * ROW_HEIGHT;

      const statusColor = refugee.status === 'injured' ? '#F44336' : '#4CAF50';
      const hpStr = `HP:${refugee.hp}/${refugee.maxHp}`;
      const jobStr = refugee.job ? JOB_LABELS[refugee.job] : 'Idle';

      // Name line -- clamp to CONTENT_WIDTH to prevent overflow
      // Truncate long names with ellipsis if needed (max ~22 chars at 10px)
      const maxNameLen = 22;
      const displayName = refugee.name.length > maxNameLen
        ? refugee.name.slice(0, maxNameLen - 1) + '.'
        : refugee.name;

      const nameLine = this.scene.add.text(0, y, displayName, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#E8DCC8',
        wordWrap: { width: CONTENT_WIDTH },
      });
      content.add(nameLine);

      // Status tags on the right side of the name row
      const statusTag = this.scene.add.text(CONTENT_WIDTH, y, `[${refugee.status}]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: statusColor,
      }).setOrigin(1, 0);
      content.add(statusTag);

      // Stats line: HP and current job
      const statsStr = `${hpStr}  Job: ${jobStr}  +${refugee.skillBonus}`;
      const statsLine = this.scene.add.text(0, y + 13, statsStr, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#9A9A9A',
        wordWrap: { width: CONTENT_WIDTH },
      });
      content.add(statsLine);

      // Job assignment buttons -- laid out with fixed spacing to prevent overflow
      // 4 buttons across CONTENT_WIDTH with even spacing
      const btnY = y + 28;
      const btnSpacing = Math.floor(CONTENT_WIDTH / JOB_BUTTONS.length);

      JOB_BUTTONS.forEach((job, btnIndex) => {
        const isCurrentJob = refugee.job === job;
        const canAssign = refugee.status !== 'injured' || job === 'rest';
        const btnX = btnIndex * btnSpacing;

        let color: string;
        if (isCurrentJob) {
          color = '#FFD700';
        } else if (canAssign) {
          color = '#E8DCC8';
        } else {
          color = '#444444';
        }

        const btn = this.scene.add.text(btnX, btnY, `[${JOB_LABELS[job]}]`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color,
        });

        if (canAssign && !isCurrentJob) {
          btn.setInteractive({ useHandCursor: true });
          btn.on('pointerover', () => btn.setColor('#FFD700'));
          btn.on('pointerout', () => btn.setColor('#E8DCC8'));
          btn.on('pointerdown', () => {
            this.refugeeManager.assignJob(refugee.id, job);
            this.refresh();
          });
        }

        content.add(btn);
      });

      // Separator line
      if (i < refugees.length - 1) {
        const sep = this.scene.add.graphics();
        sep.lineStyle(1, 0x6B6B6B, 0.25);
        sep.lineBetween(0, y + ROW_HEIGHT - 3, CONTENT_WIDTH, y + ROW_HEIGHT - 3);
        content.add(sep);
      }
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

  getContainer(): Phaser.GameObjects.Container {
    return this.panel.getContainer();
  }
}
