import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { DayScene } from './scenes/DayScene';
import { NightScene } from './scenes/NightScene';
import { ResultScene } from './scenes/ResultScene';
import { ZoneCompleteScene } from './scenes/ZoneCompleteScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config/constants';
import { AudioManager } from './systems/AudioManager';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: document.body,
  backgroundColor: '#1A1A2E',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, DayScene, NightScene, ResultScene, ZoneCompleteScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  pixelArt: true,
};

new Phaser.Game(config);

// Initialize audio context on first user interaction (browser requirement)
AudioManager.initOnInteraction();
