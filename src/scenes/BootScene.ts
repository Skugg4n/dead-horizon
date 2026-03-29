import Phaser from 'phaser';
import { GAME_VERSION } from '../config/constants';
import { generateAllTextures } from '../utils/spriteFactory';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Load pixel art sprites (static)
    this.load.image('player', 'assets/sprites/player.png');
    this.load.image('walker', 'assets/sprites/walker.png');
    this.load.image('runner', 'assets/sprites/runner.png');
    this.load.image('brute', 'assets/sprites/brute.png');
    this.load.image('spitter', 'assets/sprites/spitter.png');
    this.load.image('screamer', 'assets/sprites/screamer.png');
    this.load.image('bullet', 'assets/sprites/bullet.png');
    this.load.image('spitter_projectile', 'assets/sprites/spitter_projectile.png');

    // Structure sprites
    this.load.image('struct_barricade', 'assets/sprites/struct_barricade.png');
    this.load.image('struct_wall', 'assets/sprites/struct_wall.png');
    this.load.image('struct_trap', 'assets/sprites/struct_trap.png');
    this.load.image('struct_pillbox', 'assets/sprites/struct_pillbox.png');
    this.load.image('struct_storage', 'assets/sprites/struct_storage.png');
    this.load.image('struct_shelter', 'assets/sprites/struct_shelter.png');
    this.load.image('struct_farm', 'assets/sprites/struct_farm.png');

    // Base level sprites
    this.load.image('base_tent', 'assets/sprites/base_tent.png');
    this.load.image('base_camp', 'assets/sprites/base_camp.png');
    this.load.image('base_outpost', 'assets/sprites/base_outpost.png');
    this.load.image('base_settlement', 'assets/sprites/base_settlement.png');

    // Sprite sheets (animations) -- 32x32 frames unless noted
    this.load.spritesheet('player_walk', 'assets/sprites/player_walk.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('player_attack', 'assets/sprites/player_attack.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('player_death', 'assets/sprites/player_death.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('walker_walk', 'assets/sprites/walker_walk.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('walker_attack', 'assets/sprites/walker_attack.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('walker_death', 'assets/sprites/walker_death.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('runner_walk', 'assets/sprites/runner_walk.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('runner_death', 'assets/sprites/runner_death.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('brute_walk', 'assets/sprites/brute_walk.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('brute_death', 'assets/sprites/brute_death.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('spitter_attack', 'assets/sprites/spitter_attack.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('screamer_scream', 'assets/sprites/screamer_scream.png', { frameWidth: 32, frameHeight: 32 });

    // Refugee sprites
    for (let i = 1; i <= 5; i++) {
      this.load.image(`refugee_${i}`, `assets/sprites/refugee_${i}.png`);
    }
    this.load.image('refugee_injured', 'assets/sprites/refugee_injured.png');

    // UI and effect sprites
    this.load.image('icon_heart', 'assets/sprites/icon_heart.png');
    this.load.image('icon_skull', 'assets/sprites/icon_skull.png');
    this.load.image('loot_drop', 'assets/sprites/loot_drop.png');
    this.load.image('icon_scrap', 'assets/sprites/icon_scrap.png');
    this.load.image('icon_food', 'assets/sprites/icon_food.png');
    this.load.image('icon_ammo', 'assets/sprites/icon_ammo.png');
    this.load.image('icon_parts', 'assets/sprites/icon_parts.png');
    this.load.image('icon_meds', 'assets/sprites/icon_meds.png');

    // Toolbar button icons (32x32)
    this.load.image('icon_build', 'assets/sprites/icon_build.png');
    this.load.image('icon_weapons', 'assets/sprites/icon_weapons.png');
    this.load.image('icon_craft', 'assets/sprites/icon_craft.png');
    this.load.image('icon_skills', 'assets/sprites/icon_skills.png');
    this.load.image('icon_refugees', 'assets/sprites/icon_refugees.png');
    this.load.image('icon_lootrun', 'assets/sprites/icon_lootrun.png');
    this.load.image('icon_endday', 'assets/sprites/icon_endday.png');

    // Terrain tiles (from public/assets/sprites/terrain/)
    for (let i = 1; i <= 3; i++) {
      this.load.image(`terrain_grass_${i}`, `assets/sprites/terrain/terrain_grass_${i}.png`);
    }
    this.load.image('terrain_dirt_1', 'assets/sprites/terrain/terrain_dirt_1.png');
    this.load.image('terrain_dirt_2', 'assets/sprites/terrain/terrain_dirt_2.png');
    this.load.image('terrain_path_1', 'assets/sprites/terrain/terrain_path_1.png');
    this.load.image('terrain_leaves', 'assets/sprites/terrain/terrain_leaves.png');

    // Tree sprites
    this.load.image('tree_trunk', 'assets/sprites/terrain/tree_trunk.png');
    this.load.image('tree_canopy_1', 'assets/sprites/terrain/tree_canopy_1.png');
    this.load.image('tree_canopy_2', 'assets/sprites/terrain/tree_canopy_2.png');
    this.load.image('tree_canopy_3', 'assets/sprites/terrain/tree_canopy_3.png');

    // Bushes, rocks, water
    this.load.image('bush_1', 'assets/sprites/terrain/bush_1.png');
    this.load.image('bush_2', 'assets/sprites/terrain/bush_2.png');
    this.load.image('rock_1', 'assets/sprites/terrain/rock_1.png');
    this.load.image('rock_2', 'assets/sprites/terrain/rock_2.png');
    this.load.image('rock_cluster', 'assets/sprites/terrain/rock_cluster.png');
    this.load.image('water_puddle', 'assets/sprites/terrain/water_puddle.png');

    // Decorations
    this.load.image('decor_flower_1', 'assets/sprites/terrain/decor_flower_1.png');
    this.load.image('decor_flower_2', 'assets/sprites/terrain/decor_flower_2.png');
    this.load.image('decor_mushroom', 'assets/sprites/terrain/decor_mushroom.png');
    this.load.image('decor_bones', 'assets/sprites/terrain/decor_bones.png');
    this.load.image('decor_crate', 'assets/sprites/terrain/decor_crate.png');
    this.load.image('decor_log', 'assets/sprites/terrain/decor_log.png');
    this.load.image('decor_lantern', 'assets/sprites/terrain/decor_lantern.png');

    // Character portraits (64x64) for character select screen
    this.load.image('portrait_soldier',   'assets/sprites/characters/portrait_soldier.png');
    this.load.image('portrait_scavenger', 'assets/sprites/characters/portrait_scavenger.png');
    this.load.image('portrait_engineer',  'assets/sprites/characters/portrait_engineer.png');
    this.load.image('portrait_medic',     'assets/sprites/characters/portrait_medic.png');

    // Silently ignore missing files -- spriteFactory fallbacks will cover them
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[BootScene] Asset not found, using fallback: ${file.key}`);
    });
  }

  create(): void {
    // Generate programmatic fallback textures for assets that failed to load
    generateAllTextures(this);

    // Create animations from loaded sprite sheets
    this.createAnimations();

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

  /** Create Phaser animations from loaded sprite sheets. Only creates if the sheet loaded. */
  private createAnimations(): void {
    // Helper: only create anim if the spritesheet texture exists and has frames
    const tryAnim = (key: string, sheet: string, endFrame: number, frameRate: number, repeat: number): void => {
      if (!this.textures.exists(sheet)) return;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(sheet, { start: 0, end: endFrame }),
        frameRate,
        repeat,
      });
    };

    // Player animations
    tryAnim('player-walk', 'player_walk', 3, 8, -1);
    tryAnim('player-attack', 'player_attack', 2, 10, 0);
    tryAnim('player-death', 'player_death', 3, 6, 0);

    // Walker animations
    tryAnim('walker-walk', 'walker_walk', 3, 6, -1);
    tryAnim('walker-attack', 'walker_attack', 2, 8, 0);
    tryAnim('walker-death', 'walker_death', 3, 6, 0);

    // Runner animations
    tryAnim('runner-walk', 'runner_walk', 3, 10, -1);
    tryAnim('runner-death', 'runner_death', 3, 6, 0);

    // Brute animations
    tryAnim('brute-walk', 'brute_walk', 3, 5, -1);
    tryAnim('brute-death', 'brute_death', 3, 6, 0);

    // Spitter animations
    tryAnim('spitter-attack', 'spitter_attack', 2, 8, 0);

    // Screamer animations
    tryAnim('screamer-scream', 'screamer_scream', 2, 6, 0);
  }
}
