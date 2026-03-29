// Dead Horizon -- Refugee panel UI for DayScene
// Shows refugee list with name, HP, status, job, skill bonus, and job assignment buttons

import Phaser from 'phaser';
import { RefugeeManager } from '../systems/RefugeeManager';
import { REFUGEE_FOOD_PER_DAY } from '../config/constants';
import { UIPanel } from './UIPanel';
import type { RefugeeJob } from '../config/types';

const PANEL_WIDTH = 400;
const ROW_HEIGHT = 52;

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

    this.panel = new UIPanel(scene, 'REFUGEES', PANEL_WIDTH, 400);

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

    // Info line
    const infoStr = `${refugees.length}/${maxRefugees} refugees  |  Food needed: ${foodNeeded}/day`;
    const info = this.scene.add.text(0, 0, infoStr, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#AAAAAA',
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

      // Name, HP, status, skill
      const statusColor = refugee.status === 'injured' ? '#F44336' : '#4CAF50';
      const hpStr = `HP:${refugee.hp}/${refugee.maxHp}`;
      const jobStr = refugee.job ? JOB_LABELS[refugee.job] : 'Idle';

      const nameLine = this.scene.add.text(0, y, `${refugee.name}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#E8DCC8',
      });
      content.add(nameLine);

      const statsLine = this.scene.add.text(0, y + 13, `${hpStr}  [${refugee.status}]  Job: ${jobStr}  Skill: ${refugee.skillBonus}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: statusColor,
      });
      content.add(statsLine);

      // Job assignment buttons
      const btnY = y + 28;
      let btnX = 0;

      for (const job of JOB_BUTTONS) {
        const isCurrentJob = refugee.job === job;
        const canAssign = refugee.status !== 'injured' || job === 'rest';
        const color = isCurrentJob ? '#FFD700' : (canAssign ? '#E8DCC8' : '#444444');

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
        btnX += btn.width + 8;
      }

      // Separator line
      if (i < refugees.length - 1) {
        const sep = this.scene.add.graphics();
        sep.lineStyle(1, 0x6B6B6B, 0.3);
        sep.lineBetween(0, y + ROW_HEIGHT - 2, PANEL_WIDTH - 24, y + ROW_HEIGHT - 2);
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
