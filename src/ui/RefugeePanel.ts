// Dead Horizon -- Refugee panel UI for DayScene
// Shows refugee list with name, HP, status, job, skill bonus, and job assignment buttons

import Phaser from 'phaser';
import { RefugeeManager } from '../systems/RefugeeManager';
import { GAME_WIDTH, REFUGEE_FOOD_PER_DAY } from '../config/constants';
import type { RefugeeJob } from '../config/types';

const PANEL_WIDTH = 300;
const PANEL_X = (GAME_WIDTH - PANEL_WIDTH) / 2;
const PANEL_Y = 40;
const ROW_HEIGHT = 52;
const PANEL_PADDING = 10;

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
  private container: Phaser.GameObjects.Container;
  private visible: boolean = false;

  constructor(scene: Phaser.Scene, refugeeManager: RefugeeManager) {
    this.scene = scene;
    this.refugeeManager = refugeeManager;

    this.container = scene.add.container(PANEL_X, PANEL_Y);
    this.container.setDepth(150);
    this.container.setVisible(false);

    this.buildPanel();

    // Listen for refugee events to refresh
    this.scene.events.on('refugee-arrived', () => this.refresh());
    this.scene.events.on('refugee-healed', () => this.refresh());
    this.scene.events.on('refugee-died', () => this.refresh());
  }

  private buildPanel(): void {
    this.container.removeAll(true);

    const refugees = this.refugeeManager.getAll();
    const maxRefugees = this.refugeeManager.getMaxRefugees();
    const foodNeeded = refugees.length * REFUGEE_FOOD_PER_DAY + 1;

    const headerHeight = 44;
    const contentHeight = Math.max(30, refugees.length * ROW_HEIGHT);
    const panelHeight = headerHeight + contentHeight + PANEL_PADDING;

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.94);
    bg.fillRect(0, 0, PANEL_WIDTH, panelHeight);
    bg.lineStyle(1, 0x6B6B6B);
    bg.strokeRect(0, 0, PANEL_WIDTH, panelHeight);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(PANEL_WIDTH / 2, PANEL_PADDING, 'REFUGEES', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '13px',
      color: '#E8DCC8',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Info line
    const infoStr = `${refugees.length}/${maxRefugees} refugees  |  Food needed: ${foodNeeded}/day`;
    const info = this.scene.add.text(PANEL_WIDTH / 2, PANEL_PADDING + 16, infoStr, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#AAAAAA',
    }).setOrigin(0.5, 0);
    this.container.add(info);

    if (refugees.length === 0) {
      const empty = this.scene.add.text(PANEL_WIDTH / 2, headerHeight + 8, 'No refugees yet', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#6B6B6B',
      }).setOrigin(0.5, 0);
      this.container.add(empty);
      return;
    }

    // Refugee rows
    refugees.forEach((refugee, i) => {
      const y = headerHeight + i * ROW_HEIGHT;

      // Name, HP, status, skill
      const statusColor = refugee.status === 'injured' ? '#F44336' : '#4CAF50';
      const hpStr = `HP:${refugee.hp}/${refugee.maxHp}`;
      const jobStr = refugee.job ? JOB_LABELS[refugee.job] : 'Idle';

      const nameLine = this.scene.add.text(PANEL_PADDING, y, `${refugee.name}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#E8DCC8',
      });
      this.container.add(nameLine);

      const statsLine = this.scene.add.text(PANEL_PADDING, y + 13, `${hpStr}  [${refugee.status}]  Job: ${jobStr}  Skill: ${refugee.skillBonus}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: statusColor,
      });
      this.container.add(statsLine);

      // Job assignment buttons
      const btnY = y + 28;
      let btnX = PANEL_PADDING;

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

        this.container.add(btn);
        btnX += btn.width + 8;
      }

      // Separator line
      if (i < refugees.length - 1) {
        const sep = this.scene.add.graphics();
        sep.lineStyle(1, 0x6B6B6B, 0.3);
        sep.lineBetween(PANEL_PADDING, y + ROW_HEIGHT - 2, PANEL_WIDTH - PANEL_PADDING, y + ROW_HEIGHT - 2);
        this.container.add(sep);
      }
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
