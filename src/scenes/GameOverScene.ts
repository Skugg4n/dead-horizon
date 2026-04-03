import Phaser from 'phaser';

interface GameOverData {
  kills: number;
  wave: number;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data: GameOverData): void {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    this.cameras.main.setBackgroundColor('#1A1A2E');

    this.add.text(centerX, centerY - 60, 'YOU DIED', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#8B0000',
    }).setOrigin(0.5);

    this.add.text(centerX, centerY - 10, 'But you keep everything...', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#6B6B6B',
    }).setOrigin(0.5);

    this.add.text(centerX, centerY + 20, `Wave ${data.wave ?? '?'} -- ${data.kills ?? 0} kills`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#E8DCC8',
    }).setOrigin(0.5);

    // "Try again" appears after 3 seconds -- prevents accidental skip from combat keys
    const retryText = this.add.text(centerX, centerY + 70, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#D4620B',
    }).setOrigin(0.5);

    const advance = () => this.scene.start('DayScene');

    this.time.delayedCall(3000, () => {
      retryText.setText('[ TRY AGAIN ]');
      retryText.setInteractive({ useHandCursor: true });
      retryText.on('pointerover', () => retryText.setColor('#FFD700'));
      retryText.on('pointerout', () => retryText.setColor('#D4620B'));
      retryText.on('pointerdown', advance);

      this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
          advance();
        }
      });
    });
  }
}
