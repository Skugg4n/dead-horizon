import Phaser from 'phaser';
import { GAME_VERSION } from '../config/constants';
import { generateAllTextures } from '../utils/spriteFactory';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Generate all programmatic textures
    generateAllTextures(this);
  }

  create(): void {
    // Display boot message
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 40,
      'DEAD HORIZON',
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '24px',
        color: '#E8DCC8',
      }
    ).setOrigin(0.5);

    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 10,
      `v${GAME_VERSION} -- Loading...`,
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#6B6B6B',
      }
    ).setOrigin(0.5);

    // Transition to MenuScene after a short delay
    this.time.delayedCall(1500, () => {
      this.scene.start('MenuScene');
    });
  }
}
