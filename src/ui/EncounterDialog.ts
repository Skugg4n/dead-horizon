// Dead Horizon -- Encounter dialog during loot runs
// Modal dialog showing encounter description with Fight/Flee choices
// Uses UIPanel for consistent look but with modal behavior (backdrop, no click-outside-close)

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

const DIALOG_WIDTH = 380;
const DIALOG_HEIGHT = 220;
const DIALOG_X = Math.floor((GAME_WIDTH - DIALOG_WIDTH) / 2);
const DIALOG_Y = Math.floor((GAME_HEIGHT - DIALOG_HEIGHT) / 2);

export type EncounterChoice = 'fight' | 'flee';

export class EncounterDialog {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Graphics;
  private onChoice: ((choice: EncounterChoice) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Semi-transparent backdrop covering full screen
    this.backdrop = scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.6);
    this.backdrop.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.backdrop.setDepth(190);
    this.backdrop.setVisible(false);
    // Backdrop is interactive to block clicks but does NOT close the dialog
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );

    this.container = scene.add.container(DIALOG_X, DIALOG_Y);
    this.container.setDepth(200);
    this.container.setVisible(false);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /** Show the encounter dialog with a callback for the player's choice */
  show(strength: number, threshold: number, onChoice: (choice: EncounterChoice) => void): void {
    this.onChoice = onChoice;
    this.container.removeAll(true);

    // Dialog background with UIPanel styling
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A1A, 0.95);
    bg.fillRect(0, 0, DIALOG_WIDTH, DIALOG_HEIGHT);
    bg.lineStyle(1, 0x333333, 1);
    bg.strokeRect(0, 0, DIALOG_WIDTH, DIALOG_HEIGHT);
    this.container.add(bg);

    // Header bar
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(0x333333, 1);
    headerBg.fillRect(0, 0, DIALOG_WIDTH, 24);
    this.container.add(headerBg);

    // Title
    const title = this.scene.add.text(12, 6, 'ENCOUNTER!', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#D4620B',
    });
    this.container.add(title);

    // Description
    const desc = this.scene.add.text(DIALOG_WIDTH / 2, 40, 'You encounter hostile survivors.\nThey block your path and demand your loot.', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#E8DCC8',
      align: 'center',
      wordWrap: { width: DIALOG_WIDTH - 32 },
    }).setOrigin(0.5, 0);
    this.container.add(desc);

    // Strength indicator
    const chanceColor = strength >= threshold ? '#4CAF50' : '#F44336';
    const chanceText = strength >= threshold ? 'GOOD ODDS' : 'RISKY';
    const strengthInfo = this.scene.add.text(DIALOG_WIDTH / 2, 90, `Your strength: ${strength} vs ${threshold}  [${chanceText}]`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: chanceColor,
    }).setOrigin(0.5, 0);
    this.container.add(strengthInfo);

    // Fight button
    const fightBtn = this.scene.add.text(DIALOG_WIDTH / 2 - 70, 130, '[ FIGHT ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#D4620B',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    fightBtn.on('pointerover', () => fightBtn.setColor('#FFD700'));
    fightBtn.on('pointerout', () => fightBtn.setColor('#D4620B'));
    fightBtn.on('pointerdown', () => this.resolve('fight'));
    this.container.add(fightBtn);

    // Flee button
    const fleeBtn = this.scene.add.text(DIALOG_WIDTH / 2 + 70, 130, '[ FLEE ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#4A90D9',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    fleeBtn.on('pointerover', () => fleeBtn.setColor('#FFD700'));
    fleeBtn.on('pointerout', () => fleeBtn.setColor('#4A90D9'));
    fleeBtn.on('pointerdown', () => this.resolve('flee'));
    this.container.add(fleeBtn);

    // Hint
    const hint = this.scene.add.text(DIALOG_WIDTH / 2, DIALOG_HEIGHT - 16, 'Fight: win = 1.5x loot, lose = all loot lost. Flee: lose 1 resource type.', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    }).setOrigin(0.5, 1);
    this.container.add(hint);

    this.backdrop.setVisible(true);
    this.container.setVisible(true);
  }

  /** Show the result of the encounter */
  showResult(
    outcome: 'win' | 'lose' | 'flee',
    details: string,
    onDismiss: () => void,
  ): void {
    this.container.removeAll(true);

    // Dialog background with UIPanel styling
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A1A, 0.95);
    bg.fillRect(0, 0, DIALOG_WIDTH, DIALOG_HEIGHT);
    const borderColor = outcome === 'win' ? 0x4CAF50 : (outcome === 'lose' ? 0xF44336 : 0x4A90D9);
    bg.lineStyle(1, 0x333333, 1);
    bg.strokeRect(0, 0, DIALOG_WIDTH, DIALOG_HEIGHT);
    this.container.add(bg);

    // Header bar with outcome color
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(0x333333, 1);
    headerBg.fillRect(0, 0, DIALOG_WIDTH, 24);
    // Thin color accent at top of header
    const accent = this.scene.add.graphics();
    accent.fillStyle(borderColor, 1);
    accent.fillRect(0, 0, DIALOG_WIDTH, 2);
    this.container.add(headerBg);
    this.container.add(accent);

    // Title
    const titleMap = { win: 'VICTORY!', lose: 'DEFEATED...', flee: 'ESCAPED!' };
    const titleColorMap = { win: '#4CAF50', lose: '#F44336', flee: '#4A90D9' };
    const title = this.scene.add.text(12, 6, titleMap[outcome], {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: titleColorMap[outcome],
    });
    this.container.add(title);

    // Details
    const desc = this.scene.add.text(DIALOG_WIDTH / 2, 46, details, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#E8DCC8',
      align: 'center',
      wordWrap: { width: DIALOG_WIDTH - 32 },
    }).setOrigin(0.5, 0);
    this.container.add(desc);

    // OK button
    const okBtn = this.scene.add.text(DIALOG_WIDTH / 2, DIALOG_HEIGHT - 30, '[ OK ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#E8DCC8',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    okBtn.on('pointerover', () => okBtn.setColor('#FFD700'));
    okBtn.on('pointerout', () => okBtn.setColor('#E8DCC8'));
    okBtn.on('pointerdown', () => {
      this.hide();
      onDismiss();
    });
    this.container.add(okBtn);

    this.backdrop.setVisible(true);
    this.container.setVisible(true);
  }

  hide(): void {
    this.backdrop.setVisible(false);
    this.container.setVisible(false);
    this.container.removeAll(true);
  }

  private resolve(choice: EncounterChoice): void {
    if (this.onChoice) {
      const cb = this.onChoice;
      this.onChoice = null;
      cb(choice);
    }
  }
}
