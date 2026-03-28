import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Create placeholder graphics programmatically
    this.createPlaceholderAssets();
  }

  create(): void {
    // Display boot message
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 40,
      'DEAD HORIZON',
      {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#E8DCC8',
      }
    ).setOrigin(0.5);

    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 10,
      'v0.0.1 -- Loading...',
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#6B6B6B',
      }
    ).setOrigin(0.5);

    // Transition to MenuScene after a short delay
    this.time.delayedCall(1500, () => {
      this.scene.start('MenuScene');
    });
  }

  private createPlaceholderAssets(): void {
    // Player placeholder (green square)
    const playerGraphics = this.make.graphics({ x: 0, y: 0 });
    playerGraphics.fillStyle(0x4CAF50);
    playerGraphics.fillRect(0, 0, 32, 32);
    playerGraphics.lineStyle(2, 0x2D4A22);
    playerGraphics.strokeRect(0, 0, 32, 32);
    playerGraphics.generateTexture('player', 32, 32);
    playerGraphics.destroy();

    // Walker placeholder (dark red square)
    const walkerGraphics = this.make.graphics({ x: 0, y: 0 });
    walkerGraphics.fillStyle(0x8B0000);
    walkerGraphics.fillRect(0, 0, 32, 32);
    walkerGraphics.generateTexture('walker', 32, 32);
    walkerGraphics.destroy();

    // Bullet placeholder (yellow dot)
    const bulletGraphics = this.make.graphics({ x: 0, y: 0 });
    bulletGraphics.fillStyle(0xC5A030);
    bulletGraphics.fillCircle(4, 4, 4);
    bulletGraphics.generateTexture('bullet', 8, 8);
    bulletGraphics.destroy();
  }
}
