import Phaser from 'phaser';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  create(): void {
    // Placeholder for Fas 1E
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Result Scene -- Coming in Fas 1',
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#E8DCC8',
      }
    ).setOrigin(0.5);
  }
}
