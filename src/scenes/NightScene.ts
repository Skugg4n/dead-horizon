import Phaser from 'phaser';

export class NightScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NightScene' });
  }

  create(): void {
    // Placeholder: dark background with text
    this.cameras.main.setBackgroundColor('#1A1A2E');

    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Night Scene -- Coming in Fas 1',
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#E8DCC8',
      }
    ).setOrigin(0.5);

    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 40,
      'Press ESC to return to menu',
      {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#6B6B6B',
      }
    ).setOrigin(0.5);

    const escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey?.on('down', () => {
      this.scene.start('MenuScene');
    });
  }
}
