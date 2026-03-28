import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

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

    // Start button
    const startText = this.add.text(centerX, centerY + 30, '[ START GAME ]', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#D4620B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startText.on('pointerover', () => {
      startText.setColor('#FFD700');
    });

    startText.on('pointerout', () => {
      startText.setColor('#D4620B');
    });

    startText.on('pointerdown', () => {
      this.scene.start('NightScene');
    });

    // Version
    this.add.text(centerX, centerY + 120, 'v0.0.1', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#3A3A3A',
    }).setOrigin(0.5);
  }
}
