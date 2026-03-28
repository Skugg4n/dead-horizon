import Phaser from 'phaser';

export class DayScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DayScene' });
  }

  create(): void {
    // Placeholder for Fas 2
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Day Scene -- Coming in Fas 2',
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#E8DCC8',
      }
    ).setOrigin(0.5);
  }
}
