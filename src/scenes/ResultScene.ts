import Phaser from 'phaser';

interface ResultData {
  kills: number;
  wave: number;
  survived: boolean;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  create(data: ResultData): void {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    this.cameras.main.setBackgroundColor('#1A1A2E');

    this.add.text(centerX, centerY - 60, 'ALL WAVES SURVIVED!', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#4CAF50',
    }).setOrigin(0.5);

    this.add.text(centerX, centerY, `Kills: ${data.kills ?? 0}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#E8DCC8',
    }).setOrigin(0.5);

    const continueText = this.add.text(centerX, centerY + 60, '[ CONTINUE ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#D4620B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    continueText.on('pointerover', () => continueText.setColor('#FFD700'));
    continueText.on('pointerout', () => continueText.setColor('#D4620B'));
    continueText.on('pointerdown', () => this.scene.start('DayScene'));
  }
}
