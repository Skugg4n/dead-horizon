import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { GAME_VERSION } from '../config/constants';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    this.cameras.main.setBackgroundColor('#1A1A2E');

    // Title
    this.add.text(centerX, centerY - 80, 'DEAD HORIZON', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#E8DCC8',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(centerX, centerY - 40, 'Survive. Build. Die. Repeat.', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#6B6B6B',
    }).setOrigin(0.5);

    // Show saved progress if exists
    if (SaveManager.hasSave()) {
      const state = SaveManager.load();
      this.add.text(centerX, centerY - 5, `Runs: ${state.progress.totalRuns} -- Total kills: ${state.progress.totalKills}`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#C5A030',
      }).setOrigin(0.5);
    }

    // Start button
    const startText = this.add.text(centerX, centerY + 30, '[ START GAME ]', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#D4620B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startText.on('pointerover', () => startText.setColor('#FFD700'));
    startText.on('pointerout', () => startText.setColor('#D4620B'));
    startText.on('pointerdown', () => this.scene.start('NightScene'));

    // New Game button (only if save exists)
    if (SaveManager.hasSave()) {
      const newGameText = this.add.text(centerX, centerY + 65, '[ NEW GAME ]', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#6B6B6B',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      newGameText.on('pointerover', () => newGameText.setColor('#F44336'));
      newGameText.on('pointerout', () => newGameText.setColor('#6B6B6B'));
      newGameText.on('pointerdown', () => {
        SaveManager.clearSave();
        this.scene.restart();
      });
    }

    // Version
    this.add.text(centerX, centerY + 120, `v${GAME_VERSION}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#3A3A3A',
    }).setOrigin(0.5);
  }
}
