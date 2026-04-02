import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { Projectile } from '../entities/Projectile';
import { WaveManager } from '../systems/WaveManager';
import { ResourceManager } from '../systems/ResourceManager';
import { SoundMechanic } from '../systems/SoundMechanic';
import { SaveManager } from '../systems/SaveManager';
import { Barricade } from '../structures/Barricade';
import { Wall } from '../structures/Wall';
import { Trap } from '../structures/Trap';
import { SpikeStrip } from '../structures/SpikeStrip';
import { BearTrap } from '../structures/BearTrap';
import { Landmine } from '../structures/Landmine';
import { Sandbags } from '../structures/Sandbags';
import { OilSlick } from '../structures/OilSlick';
import { HUD } from '../ui/HUD';
import { WeaponManager } from '../systems/WeaponManager';
import { SkillManager } from '../systems/SkillManager';
import { ZoneManager } from '../systems/ZoneManager';
import { AchievementManager } from '../systems/AchievementManager';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, GAME_WIDTH, GAME_HEIGHT, XP_PER_KILL, REFUGEE_PILLBOX_RANGE, REFUGEE_PILLBOX_DAMAGE, REFUGEE_PILLBOX_COOLDOWN, BASE_MAX_HP } from '../config/constants';
import visualConfig from '../data/visual-config.json';
import { RefugeeManager } from '../systems/RefugeeManager';
import { FogOfWar } from '../systems/FogOfWar';
import { distanceBetween, angleBetween } from '../utils/math';
import { AudioManager } from '../systems/AudioManager';
import type { ResourceType, SkillType, WeaponClass, StructureInstance, RefugeeInstance, WeaponSpecialEffect } from '../config/types';
import type { ZombieConfig } from '../entities/Zombie';
// zombie-loot.json replaced by per-enemy dropTable in enemies.json (v1.9.1)
import structuresData from '../data/structures.json';
import baseLevelsJson from '../data/base-levels.json';
import enemiesData from '../data/enemies.json';
import { getStructureSpriteKey, getBaseSpriteKey } from '../utils/spriteFactory';
import { generateTerrain } from '../systems/TerrainGenerator';
import type { TerrainResult } from '../config/types';

// Parse structure colors from JSON (string hex to number)
const STRUCTURE_COLORS: Record<string, number> = Object.fromEntries(
  Object.entries(visualConfig.structureColors).map(([k, v]) => [k, parseInt(v.replace('0x', ''), 16)])
);

// Per-enemy drop table entry -- resource + weight-based random selection
interface DropTableEntry {
  resource: ResourceType;
  min: number;
  max: number;
  weight: number;
}

export class NightScene extends Phaser.Scene {
  private player!: Player;
  private zombieGroup!: Phaser.Physics.Arcade.Group;
  private projectileGroup!: Phaser.Physics.Arcade.Group;
  private waveManager!: WaveManager;
  private resourceManager!: ResourceManager;
  private weaponManager!: WeaponManager;
  private soundMechanic!: SoundMechanic;
  private skillManager!: SkillManager;
  private zoneManager!: ZoneManager;
  private achievementManager!: AchievementManager;
  private refugeeManager!: RefugeeManager;
  private hud!: HUD;
  private shootCooldown: number = 0;
  private pillboxAssignments: { structure: StructureInstance; refugee: RefugeeInstance; cooldown: number }[] = [];
  private kills: number = 0;
  private loadedAmmo: number = 0;
  private weaponUsedThisNight: Set<string> = new Set();
  private gameState!: ReturnType<typeof SaveManager.load>;
  private barricades: Barricade[] = [];
  private walls: Wall[] = [];
  private traps: Trap[] = [];
  // New trap/hazard arrays -- populated in create(), used by future interaction loops
  private _spikeStrips: SpikeStrip[] = [];
  private _bearTraps: BearTrap[] = [];
  private _landmines: Landmine[] = [];
  private _sandbags: Sandbags[] = [];
  private _oilSlicks: OilSlick[] = [];
  private wallBodies!: Phaser.Physics.Arcade.StaticGroup;
  private fogOfWar!: FogOfWar;
  private fpsText: Phaser.GameObjects.Text | null = null;
  // Visual effects
  private damageOverlay!: Phaser.GameObjects.Graphics;
  private muzzleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bloodEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trapEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  // Player damage feedback: blood splatter particles and screen-edge vignette flash
  private playerBloodEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private vignetteFlash!: Phaser.GameObjects.Graphics;
  private isFirstGame: boolean = false;
  // Movement tracking for speed_agility XP
  private lastPlayerX: number = 0;
  private lastPlayerY: number = 0;
  private movementAccumulator: number = 0;
  private playerTookDamage: boolean = false;
  private meleeKillsThisNight: number = 0;
  // Spitter projectile pool (enemy projectiles that damage the player)
  private spitterProjectileGroup!: Phaser.Physics.Arcade.Group;
  // Event effects from day phase
  private fogPenalty: number = 0;
  // F2: Blood splatter graphics layer (persistent for entire night, depth=0)
  private bloodSplatContainer!: Phaser.GameObjects.Container;
  // F3: Base HP tracking
  private baseHp: number = BASE_MAX_HP;
  private baseMaxHp: number = BASE_MAX_HP;
  // Base center position (set once map is created)
  private baseCenterX: number = 0;
  private baseCenterY: number = 0;
  // Procedural terrain (generated each night)
  private terrainResult!: TerrainResult;
  // Set of zombie IDs currently inside a water zone (for speed debuff)
  private zombiesInWater: Set<Zombie> = new Set();
  // Total damage taken by the base this night (for game over stats)
  private baseDamageTaken: number = 0;
  // Guard: prevent player-died from firing twice (e.g. base destroyed then player killed same frame)
  private gameOverShown: boolean = false;

  constructor() {
    super({ key: 'NightScene' });
  }

  create(data?: { hordeMultiplier?: number; fogPenalty?: number }): void {
    this.gameState = SaveManager.load();
    this.kills = 0;
    this.shootCooldown = 0;
    this.loadedAmmo = this.gameState.inventory.loadedAmmo;
    this.weaponUsedThisNight = new Set();
    this.fogPenalty = data?.fogPenalty ?? 0;
    this.playerTookDamage = false;
    this.meleeKillsThisNight = 0;
    this.movementAccumulator = 0;
    this.baseDamageTaken = 0;
    this.gameOverShown = false;

    this.createMap();


    // F2: Blood splatter container -- depth 0, below everything else
    this.bloodSplatContainer = this.add.container(0, 0);
    this.bloodSplatContainer.setDepth(0);

    // F3: Load base HP from save (restores between nights)
    this.baseHp = this.gameState.base.hp ?? BASE_MAX_HP;
    this.baseMaxHp = this.gameState.base.maxHp ?? BASE_MAX_HP;
    // Restore full HP each night (base regenerates overnight)
    this.baseHp = this.baseMaxHp;

    this.createTerrain();

    this.createStructures();
    this.createFogOfWar();
    this.createPlayer();
    this.createGroups();
    this.setupWaveManager();
    // Apply horde multiplier from day events
    if (data?.hordeMultiplier && data.hordeMultiplier > 1.0) {
      this.waveManager.setHordeMultiplier(data.hordeMultiplier);
    }
    this.setupCollisions();
    this.setupCamera();
    this.setupEvents();

    this.resourceManager = new ResourceManager(this, this.gameState);
    this.weaponManager = new WeaponManager(this, this.gameState);
    this.soundMechanic = new SoundMechanic(this, this.zombieGroup);
    this.skillManager = new SkillManager(this, this.gameState);
    this.zoneManager = new ZoneManager(this, this.gameState);
    this.achievementManager = new AchievementManager(this, this.gameState);
    this.refugeeManager = new RefugeeManager(this, this.gameState);
    this.setupPillboxRefugees();
    this.hud = new HUD(this);
    this.hud.updateAmmo(this.loadedAmmo);
    this.updateWeaponHUD();
    // F3: Initialize base HP bar
    this.hud.updateBaseHpBar(this.baseHp, this.baseMaxHp);

    this.setupWeaponKeys();
    this.setupParticles();
    this.setupLighting();
    this.setupDamageOverlay();
    this.isFirstGame = this.gameState.progress.totalRuns === 0 && this.gameState.progress.currentWave <= 1;
    if (this.isFirstGame) {
      this.showTutorialOverlay();
    }

    // FPS counter in dev mode
    if (import.meta.env.DEV) {
      this.fpsText = this.add.text(this.cameras.main.width - 10, 10, 'FPS: 0', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#00FF00',
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(200);
    }

    // Start night ambient sound + F4 day-to-night whoosh
    AudioManager.play('day_to_night');
    AudioManager.startAmbient('night');

    // Start wave 1 after a brief delay
    this.time.delayedCall(1500, () => {
      this.waveManager.startWave(this.gameState.progress.currentWave);
    });

    // Clean up all event listeners on scene shutdown to prevent memory leaks
    this.events.once('shutdown', () => {
      this.events.off('zombie-killed');
      this.events.off('wave-started');
      this.events.off('wave-complete');
      this.events.off('all-waves-complete');
      this.events.off('player-damaged');
      this.events.off('player-died');
      this.events.off('spitter-shoot');
      this.events.off('screamer-scream');
      this.events.off('boss-death-spawn');
      this.events.off('weapon-fired');

      this.soundMechanic.destroy();
      this.tweens.killAll();
      this.input.keyboard?.removeAllListeners();
    });
  }

  update(_time: number, delta: number): void {
    this.player.update(delta);
    this.hud.updateStaminaBar(this.player.stamina, this.player.maxStamina);

    // Track movement distance for speed_agility XP (1 XP per 100px)
    const dx = this.player.x - this.lastPlayerX;
    const dy = this.player.y - this.lastPlayerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.movementAccumulator += dist;
    this.lastPlayerX = this.player.x;
    this.lastPlayerY = this.player.y;
    if (this.movementAccumulator >= 100) {
      const xpToAward = Math.floor(this.movementAccumulator / 100);
      this.skillManager.addXP('speed_agility', xpToAward);
      this.movementAccumulator -= xpToAward * 100;
      // F4: Footstep sound -- plays every ~100px of movement
      AudioManager.play('footstep');
    }

    // Update zombies -- mark off-screen for pathfinding throttle
    const cam = this.cameras.main;
    const camLeft = cam.scrollX - 500;
    const camRight = cam.scrollX + cam.width + 500;
    const camTop = cam.scrollY - 500;
    const camBottom = cam.scrollY + cam.height + 500;

    // Snapshot which zombies were in water last frame, then clear for this frame.
    // The water overlap callbacks will re-populate zombiesInWater during physics step.
    const prevInWater = new Set(this.zombiesInWater);
    this.zombiesInWater.clear();

    this.zombieGroup.getChildren().forEach(child => {
      const zombie = child as Zombie;
      if (zombie.active) {
        zombie.offScreen = zombie.x < camLeft || zombie.x > camRight ||
                           zombie.y < camTop || zombie.y > camBottom;

        // Apply water speed debuff: halve moveSpeed while inside a water zone.
        // We use a flag stored on the zombie to avoid double-multiplying each frame.
        const wasSlowed = zombie.getData('waterSlowed') as boolean | undefined;
        const isInWater = prevInWater.has(zombie);
        if (isInWater && !wasSlowed) {
          zombie.moveSpeed *= 0.5;
          zombie.setData('waterSlowed', true);
        } else if (!isInWater && wasSlowed) {
          zombie.moveSpeed *= 2; // Restore full speed
          zombie.setData('waterSlowed', false);
        }

        zombie.update(delta);
      }
    });

    // Update projectiles
    this.projectileGroup.getChildren().forEach(child => {
      const proj = child as Projectile;
      if (proj.active) {
        proj.update(0, delta);
      }
    });

    // Update spitter projectiles
    this.spitterProjectileGroup.getChildren().forEach(child => {
      const proj = child as Projectile;
      if (proj.active) {
        proj.update(0, delta);
      }
    });

    // Update sound mechanic (noise ring animation)
    this.soundMechanic.update(delta);

    // Check zombie-structure interactions
    this.checkZombieStructureInteractions();

    // Update fog of war and zombie visibility
    this.fogOfWar.update();
    // Fog overlay removed -- all zombies always visible
    // (fogOfWar.updateZombieVisibility removed to prevent hiding zombies)

    // Update lighting overlay to follow player
    this.updateLighting();

    // F3: Check if zombies have reached the base and damage it
    this.checkZombieBaseInteractions();

    // Pillbox refugee shooting
    this.updatePillboxShooting(delta);

    // Auto-shoot
    this.shootCooldown = Math.max(0, this.shootCooldown - delta);
    if (this.shootCooldown <= 0) {
      this.tryAutoShoot();
    }

    // Update FPS counter
    if (this.fpsText) {
      this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
    }
  }

  private createMap(): void {
    const mapPixelWidth  = MAP_WIDTH  * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;
    const centerX = mapPixelWidth  / 2;
    const centerY = mapPixelHeight / 2;

    // Store base center for HP bar, zombie aggro, and lighting
    this.baseCenterX = centerX;
    this.baseCenterY = centerY;

    // Determine road row (horizontal path through map center)
    const roadRow = Math.floor(MAP_HEIGHT / 2);
    const roadY   = roadRow * TILE_SIZE;

    // ------------------------------------------------------------------
    // GROUND LAYER
    // ------------------------------------------------------------------
    // Sprite tiles disabled: WebGL sub-pixel seams. Graphics path is seam-free.
    const hasGrassTiles = false; // this.textures.exists('terrain_grass_1');

    // Always draw a solid green base layer to fill gaps between tiles
    const groundFill = this.add.graphics();
    groundFill.fillStyle(0x2D4A22);
    groundFill.fillRect(0, 0, mapPixelWidth, mapPixelHeight);

    if (hasGrassTiles) {
      // --- Sprite-based grass tiles over solid base ---
      for (let ty = 0; ty < MAP_HEIGHT; ty++) {
        for (let tx = 0; tx < MAP_WIDTH; tx++) {
          // Use integer positions (origin 0,0) to prevent subpixel gaps
          const tileX = tx * TILE_SIZE;
          const tileY = ty * TILE_SIZE;
          const hash = (tx * 1619 + ty * 3571) | 0;

          const tileKey = ((hash >>> 0) % 10 === 0) ? 'terrain_grass_2' : 'terrain_grass_1';
          const img = this.add.image(tileX, tileY, tileKey).setOrigin(0, 0);
          if (tx < 2 || tx >= MAP_WIDTH - 2 || ty < 2 || ty >= MAP_HEIGHT - 2) {
            img.setTint(0xBBBBBB);
          }
        }
      }
    } else {
      // --- Graphics-based ground: single solid fill, no per-tile variation ---
      // Per-tile color variation caused visible checkerboard patterns.
      // One solid color + terrain decorations provides all visual interest.
      const ground = this.add.graphics();
      ground.setDepth(0);
      ground.fillStyle(0x2A4A22);
      ground.fillRect(0, 0, mapPixelWidth, mapPixelHeight);

      // ------------------------------------------------------------------
      // ROAD -- single continuous horizontal band across the full map.
      // Three stacked fillRects create a soft edge: dark shoulders + bright
      // centre. No per-tile variation so there are no visible seams.
      // ------------------------------------------------------------------
      const road = this.add.graphics();
      road.setDepth(0);

      // Road centre Y in pixels
      const roadCentreY = roadRow * TILE_SIZE + TILE_SIZE / 2;
      const roadHalfH   = TILE_SIZE; // half-height of the main road band

      // Soft outer edges (semi-transparent dark dirt, slightly wider)
      road.fillStyle(0x3A2510, 0.55);
      road.fillRect(0, roadCentreY - roadHalfH - 4, mapPixelWidth, 8);
      road.fillRect(0, roadCentreY + roadHalfH - 4, mapPixelWidth, 8);

      // Main road body -- single solid fill spanning full map width
      road.fillStyle(0x4A3218);
      road.fillRect(0, roadCentreY - roadHalfH, mapPixelWidth, roadHalfH * 2);

      // Subtle inner highlight strip along the road centre
      road.fillStyle(0x5A3E20, 0.45);
      road.fillRect(0, roadCentreY - 3, mapPixelWidth, 6);

      // ------------------------------------------------------------------
      // CLEARED AREA AROUND BASE -- single circular dirt patch.
      // Uses fillEllipse for one smooth shape instead of per-tile rects.
      // ------------------------------------------------------------------
      const baseArea = this.add.graphics();
      baseArea.setDepth(0);

      const baseClearRadius = 100; // pixels
      const baDiameter = baseClearRadius * 2;

      // Outer soft halo (slightly transparent)
      baseArea.fillStyle(0x3E2A12, 0.55);
      baseArea.fillEllipse(centerX, centerY, baDiameter + 56, baDiameter + 56);

      // Main dirt circle
      baseArea.fillStyle(0x4A3218);
      baseArea.fillEllipse(centerX, centerY, baDiameter, baDiameter);

      // ------------------------------------------------------------------
      // SCATTERED GROUND DETAIL PATCHES (leaves, small stones, grass tufts)
      // Small semi-transparent overlays at depth 1.
      // ------------------------------------------------------------------
      const patches = this.add.graphics();
      patches.setDepth(1);

      // Use a simple deterministic scatter -- not SeededRandom, just math
      for (let ty = 0; ty < MAP_HEIGHT; ty++) {
        for (let tx = 0; tx < MAP_WIDTH; tx++) {
          const hash4 = ((tx * 3571 + ty * 6173) * 2654435769) >>> 0;
          // ~15% chance of a patch per tile
          if ((hash4 % 100) < 15) {
            const tileX  = tx * TILE_SIZE;
            const tileY  = ty * TILE_SIZE;
            const patchX = tileX + (hash4 % TILE_SIZE);
            const patchY = tileY + ((hash4 >> 5) % TILE_SIZE);
            // Patch type: 0=grass tuft, 1=leaf, 2=tiny pebble
            const pType = (hash4 >> 10) % 3;
            if (pType === 0) {
              // Small bright grass tuft
              patches.fillStyle(0x4A7A2A, 0.55);
              patches.fillEllipse(patchX, patchY, 6, 4);
            } else if (pType === 1) {
              // Dead leaf -- brownish
              patches.fillStyle(0x6B4A1A, 0.45);
              patches.fillEllipse(patchX, patchY, 5, 3);
            } else {
              // Tiny pebble
              patches.fillStyle(0x777060, 0.5);
              patches.fillCircle(patchX, patchY, 1.5);
            }
          }
        }
      }
    }

    // Road markings -- only for the Graphics path (no tile sprites)
    if (!hasGrassTiles) {
      const markings = this.add.graphics();
      markings.setDepth(1);
      markings.fillStyle(0x5A4028, 0.5);
      // Subtle edge lines along road
      for (let x = 0; x < mapPixelWidth; x += TILE_SIZE * 3) {
        markings.fillRect(x + 6, roadY - 2, TILE_SIZE - 10, 3);
      }
    }

    // ------------------------------------------------------------------
    // BASE STRUCTURE
    // ------------------------------------------------------------------
    const baseLevelIdx = Math.min(this.gameState.base.level, baseLevelsJson.baseLevels.length - 1);
    const baseLevelData = baseLevelsJson.baseLevels[baseLevelIdx];
    if (!baseLevelData) throw new Error('No base levels defined');
    const baseSize    = baseLevelData.visual.size;
    const halfSize    = baseSize / 2;
    const baseFillColor   = parseInt(baseLevelData.visual.color.replace('0x', ''), 16);
    const baseStrokeColor = parseInt(baseLevelData.visual.strokeColor.replace('0x', ''), 16);

    const baseSpriteKey = getBaseSpriteKey(this, this.gameState.base.level);
    if (baseSpriteKey) {
      const baseImg = this.add.image(centerX, centerY, baseSpriteKey);
      baseImg.setDisplaySize(baseSize, baseSize);
    } else {
      const tent = this.add.graphics();
      tent.fillStyle(baseFillColor);
      tent.fillRect(centerX - halfSize, centerY - halfSize, baseSize, baseSize);
      tent.lineStyle(baseLevelData.visual.strokeWidth, baseStrokeColor);
      tent.strokeRect(centerX - halfSize, centerY - halfSize, baseSize, baseSize);

      if (this.gameState.base.level >= 1) {
        const inset = 4;
        tent.lineStyle(1, baseStrokeColor, 0.4);
        tent.strokeRect(
          centerX - halfSize + inset,
          centerY - halfSize + inset,
          baseSize - inset * 2,
          baseSize - inset * 2
        );
      }
    }

    // Base label -- rendered on the game world; 9px + stroke for readability over terrain
    this.add.text(centerX, centerY - halfSize - 8, 'BASE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // Set world bounds
    this.physics.world.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
  }

  private createTerrain(): void {
    const mapPixelWidth  = MAP_WIDTH  * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;
    const basePos = { x: mapPixelWidth / 2, y: mapPixelHeight / 2 };

    // mapSeed: persisted in GameState, constant within a run, changes only on death
    const seed = this.gameState.mapSeed;
    console.log(`[NightScene] terrain seed = ${seed}`);

    this.terrainResult = generateTerrain(this, this.gameState.zone, basePos, seed);
  }

  private createStructures(): void {
    this.barricades = [];
    this.walls = [];
    this.traps = [];
    this._spikeStrips = [];
    this._bearTraps = [];
    this._landmines = [];
    this._sandbags = [];
    this._oilSlicks = [];

    const trapDef = structuresData.structures.find(s => s.id === 'trap');
    const defaultTrapDamage = trapDef && 'trapDamage' in trapDef ? (trapDef as { trapDamage: number }).trapDamage : 20;

    // Read new trap definitions from structures.json
    const spikeStripDef = structuresData.structures.find(s => s.id === 'spike_strip');
    const bearTrapDef   = structuresData.structures.find(s => s.id === 'bear_trap');
    const landmineDef   = structuresData.structures.find(s => s.id === 'landmine');
    const sandbagsDef   = structuresData.structures.find(s => s.id === 'sandbags');
    const oilSlickDef   = structuresData.structures.find(s => s.id === 'oil_slick');

    for (const structure of this.gameState.base.structures) {
      switch (structure.structureId) {
        case 'barricade': {
          const barricade = new Barricade(this, structure);
          this.barricades.push(barricade);
          break;
        }
        case 'wall': {
          const wall = new Wall(this, structure);
          this.walls.push(wall);
          // Add physics body for wall collision
          const wallBody = this.wallBodies.create(
            structure.x + TILE_SIZE / 2,
            structure.y + TILE_SIZE / 2,
            ''
          ) as Phaser.Physics.Arcade.Sprite;
          wallBody.setDisplaySize(TILE_SIZE, TILE_SIZE);
          wallBody.setVisible(false);
          wallBody.refreshBody();
          wallBody.setData('wallRef', wall);
          break;
        }
        case 'trap': {
          const trap = new Trap(this, structure, defaultTrapDamage);
          this.traps.push(trap);
          break;
        }
        case 'spike_strip': {
          // Read config from JSON; fall back to spec values if missing
          const dmg    = (spikeStripDef as { trapDamage?: number } | undefined)?.trapDamage ?? 15;
          const dur    = (spikeStripDef as { crippleDuration?: number } | undefined)?.crippleDuration ?? 3000;
          const uses   = (spikeStripDef as { trapDurability?: number } | undefined)?.trapDurability ?? 5;
          const strip  = new SpikeStrip(this, structure, dmg, dur, uses);
          this._spikeStrips.push(strip);
          break;
        }
        case 'bear_trap': {
          const dmg    = (bearTrapDef as { trapDamage?: number } | undefined)?.trapDamage ?? 25;
          const stun   = (bearTrapDef as { stunDuration?: number } | undefined)?.stunDuration ?? 2000;
          const bt     = new BearTrap(this, structure, dmg, stun);
          this._bearTraps.push(bt);
          break;
        }
        case 'landmine': {
          const dmg    = (landmineDef as { trapDamage?: number } | undefined)?.trapDamage ?? 50;
          const radius = (landmineDef as { aoeRadius?: number } | undefined)?.aoeRadius ?? 60;
          const mine   = new Landmine(this, structure, dmg, radius);
          this._landmines.push(mine);
          break;
        }
        case 'sandbags': {
          const slow   = (sandbagsDef as { slowFactor?: number } | undefined)?.slowFactor ?? 0.4;
          const bags   = new Sandbags(this, structure, slow);
          this._sandbags.push(bags);
          break;
        }
        case 'oil_slick': {
          const slow   = (oilSlickDef as { slowFactor?: number } | undefined)?.slowFactor ?? 0.2;
          const width  = (oilSlickDef as { widthTiles?: number } | undefined)?.widthTiles ?? 3;
          const slick  = new OilSlick(this, structure, slow, width);
          this._oilSlicks.push(slick);
          break;
        }
        default: {
          // Render non-interactive structures: sprite if available, else color fallback
          const spriteKey = getStructureSpriteKey(this, structure.structureId);
          if (spriteKey) {
            const img = this.add.image(
              structure.x + TILE_SIZE / 2,
              structure.y + TILE_SIZE / 2,
              spriteKey,
            );
            img.setDisplaySize(TILE_SIZE, TILE_SIZE);
          } else {
            const color = STRUCTURE_COLORS[structure.structureId] ?? 0x888888;
            const g = this.add.graphics();
            g.fillStyle(color);
            g.fillRect(structure.x, structure.y, TILE_SIZE, TILE_SIZE);
            g.lineStyle(1, 0xE8DCC8, 0.6);
            g.strokeRect(structure.x, structure.y, TILE_SIZE, TILE_SIZE);
          }
          break;
        }
      }
    }
  }

  private createFogOfWar(): void {
    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;
    const fogLevelIdx = Math.min(this.gameState.base.level, baseLevelsJson.baseLevels.length - 1);
    const fogLevelData = baseLevelsJson.baseLevels[fogLevelIdx];
    if (!fogLevelData) throw new Error('No base levels defined');
    const fogRadius = Math.max(1, fogLevelData.fogRadius - this.fogPenalty);

    this.fogOfWar = new FogOfWar(
      this,
      this.gameState,
      mapPixelWidth,
      mapPixelHeight,
      fogRadius
    );

    // Graphics for directional indicators at fog boundary
  }

  private createPlayer(): void {
    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;
    this.player = new Player(this, mapPixelWidth / 2, mapPixelHeight / 2);
    this.lastPlayerX = this.player.x;
    this.lastPlayerY = this.player.y;
  }

  private createGroups(): void {
    this.zombieGroup = this.physics.add.group({
      classType: Zombie,
      runChildUpdate: false,
    });

    this.projectileGroup = this.physics.add.group({
      classType: Projectile,
      runChildUpdate: false,
    });

    this.wallBodies = this.physics.add.staticGroup();

    // Spitter projectile pool (enemy projectiles)
    this.spitterProjectileGroup = this.physics.add.group({
      classType: Projectile,
      runChildUpdate: false,
    });
  }

  private setupWaveManager(): void {
    // Zone manager not yet initialized during create() flow, load wave data directly
    const zoneManager = new ZoneManager(this, this.gameState);
    const waveData = zoneManager.getWaveData();
    this.waveManager = new WaveManager(this, this.zombieGroup, waveData);
    this.waveManager.setTarget(this.player);

    // Dynamic wave count: night 1 = 1 wave, night 2 = 2 waves, ..., night 5+ = 5 waves (capped)
    // gameState.progress.currentWave is the night number (1-indexed)
    const nightNumber = this.gameState.progress.currentWave;
    const totalWaves = Math.min(Math.max(nightNumber, 1), 5);
    this.waveManager.setMaxWaves(totalWaves);

    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;

    // Zombies walk toward base by default, only aggro player via sound
    this.waveManager.setBasePosition(mapPixelWidth / 2, mapPixelHeight / 2);

    // Pass map dimensions to waveManager for wanderer boundary calculations
    this.waveManager.setMapSize(mapPixelWidth, mapPixelHeight);

    // Spawn zones at the four edges
    this.waveManager.setSpawnZones([
      { x: 0, y: mapPixelHeight / 2 },           // left
      { x: mapPixelWidth, y: mapPixelHeight / 2 }, // right
      { x: mapPixelWidth / 2, y: 0 },             // top
      { x: mapPixelWidth / 2, y: mapPixelHeight }, // bottom
    ]);
  }

  private setupCollisions(): void {
    // Projectile hits zombie
    // IMPORTANT: Phaser overlap callback argument order is NOT guaranteed.
    // We must use instanceof to identify which is the Projectile and which is the Zombie.
    this.physics.add.overlap(
      this.projectileGroup,
      this.zombieGroup,
      (_a, _b) => {
        const proj = (_a instanceof Projectile ? _a : _b) as Projectile;
        const zombie = (_a instanceof Zombie ? _a : _b) as Zombie;
        if (!(proj instanceof Projectile) || !(zombie instanceof Zombie)) return;
        if (!proj.active || !zombie.active) return;

        // Apply ranged special effects before damage to allow crit/headshot multiplier
        const finalDamage = this.calcRangedDamage(proj);
        zombie.takeDamage(finalDamage);

        // Piercing: projectile passes through the zombie -- do NOT deactivate
        const isPiercing = proj.specialEffect?.type === 'piercing';
        if (!isPiercing) {
          proj.deactivate();
        }

        // Apply on-hit ranged effects that require a zombie target (knockback, incendiary)
        if (proj.specialEffect && zombie.active) {
          this.applyRangedSpecialEffect(zombie, proj, proj.specialEffect);
        }
      },
    );

    // Zombie hits player
    this.physics.add.overlap(
      this.player,
      this.zombieGroup,
      (_player, _zombie) => {
        const zombie = _zombie as Zombie;
        if (!zombie.active || !zombie.canAttack() || !this.player.active) return;

        this.player.takeDamage(zombie.damage);
        zombie.resetAttackCooldown();
        zombie.playAttackPulse();
        this.flashDamageOverlay();
        // F4: Guttural zombie attack sound
        AudioManager.play('zombie_attack_hit');
      },
    );

    // Walls block zombies (collider, not overlap)
    this.physics.add.collider(
      this.zombieGroup,
      this.wallBodies,
      (_zombie, _wallBody) => {
        const zombie = _zombie as Zombie;
        const wallBody = _wallBody as Phaser.Physics.Arcade.Sprite;
        if (!zombie.active) return;

        // Brutes damage walls on collision
        if (zombie.canAttackStructure()) {
          const wallData = wallBody.getData('wallRef');
          const wallRef = wallData instanceof Wall ? wallData : undefined;
          if (wallRef) {
            const destroyed = wallRef.takeDamage(zombie.structureDamage);
            zombie.resetStructureAttackCooldown();
            if (destroyed) {
              AudioManager.play('structure_break');
              wallBody.destroy();
            } else {
              // F4: Structure creak/crack on damage
              AudioManager.play('structure_damage');
            }
          }
        }
      },
    );

    // Walls also block player
    this.physics.add.collider(this.player, this.wallBodies);

    // Terrain slows zombies (overlap, not collider -- they push through but slowly)
    this.physics.add.overlap(
      this.zombieGroup,
      this.terrainResult.colliders,
      (_zombie) => {
        const zombie = _zombie as Zombie;
        if (!zombie.active) return;
        // Halve velocity while overlapping terrain
        if (zombie.body) {
          zombie.setVelocity(zombie.body.velocity.x * 0.5, zombie.body.velocity.y * 0.5);
        }
      },
    );

    // Water zones slow zombies (overlap -- no physical block)
    this.physics.add.overlap(
      this.zombieGroup,
      this.terrainResult.waterZones,
      (_zombie) => {
        const zombie = _zombie as Zombie;
        if (!zombie.active) return;
        // Mark zombie as in-water so the update loop can apply speed debuff
        this.zombiesInWater.add(zombie);
      }
    );

    // Spitter projectile hits player
    // IMPORTANT: argument order not guaranteed -- use instanceof
    this.physics.add.overlap(
      this.spitterProjectileGroup,
      this.player,
      (_a, _b) => {
        const proj = (_a instanceof Projectile ? _a : _b instanceof Projectile ? _b : null);
        if (!proj || !this.player.active || !proj.active) return;
        this.player.takeDamage(proj.damage);
        proj.deactivate();
      },
    );
  }

  private setupCamera(): void {
    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;

    this.cameras.main.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBackgroundColor('#1E3216');
  }

  private setupEvents(): void {
    this.events.on('zombie-killed', (zombie: Zombie) => {
      this.kills++;
      this.player.kills = this.kills;
      this.hud.updateKills(this.kills);
      this.waveManager.onEnemyKilled();
      this.rollLootDrops(zombie.x, zombie.y, zombie.zombieId);
      AudioManager.play('zombie_death');
      // Blood splatter particles (short-lived burst)
      this.bloodEmitter.emitParticleAt(zombie.x, zombie.y, 6);
      // F2: Persistent blood splat on ground layer
      this.createBloodSplat(zombie.x, zombie.y);

      // Add weapon XP and combat skill XP based on equipped weapon class
      const equipped = this.weaponManager.getEquipped();
      if (equipped) {
        this.weaponManager.addXP(equipped.id, 1);
        const stats = this.weaponManager.getWeaponStats(equipped);
        const skillType = this.weaponClassToSkill(stats.weaponClass);
        if (skillType) {
          this.skillManager.addXP(skillType, XP_PER_KILL);
        }
        // Stealth XP from melee kills (15 XP per melee kill)
        if (stats.weaponClass === 'melee') {
          this.meleeKillsThisNight++;
          this.skillManager.addXP('stealth', 15);
        }
      }
    });

    this.events.on('wave-started', (wave: number) => {
      this.hud.updateWave(wave, this.waveManager.getMaxWaves());
      this.hud.showWaveAnnouncement(wave);
      AudioManager.play('wave_start');
    });

    this.events.on('wave-complete', (wave: number) => {
      this.hud.showMessage('WAVE CLEAR!');
      AudioManager.play('wave_clear');
      // Golden screen flash
      this.cameras.main.flash(400, 197, 160, 11);

      // Survival XP: 100 XP per wave survived
      this.skillManager.addXP('survival', 100);

      // Record zone progress
      this.zoneManager.recordWaveCleared(wave);

      // Only start next wave if there are more waves (dynamic max for this night)
      const maxWaves = this.waveManager.getMaxWaves();
      if (wave < maxWaves) {
        this.time.delayedCall(3000, () => {
          this.waveManager.startWave(wave + 1);
        });
      }
    });

    this.events.on('all-waves-complete', () => {
      this.gameState.progress.totalKills += this.kills;
      this.gameState.progress.totalRuns++;
      this.gameState.progress.currentWave++;
      if (this.gameState.progress.currentWave > this.gameState.progress.highestWave) {
        this.gameState.progress.highestWave = this.gameState.progress.currentWave;
      }
      this.gameState.inventory.loadedAmmo = this.loadedAmmo;
      this.decreaseUsedWeaponDurability();
      this.skillManager.syncToState(this.gameState);
      this.resourceManager.syncToState(this.gameState);
      this.refugeeManager.syncToState();
      this.fogOfWar.syncToState();

      // Achievement: Untouchable (survived night without damage)
      if (!this.playerTookDamage) {
        this.achievementManager.unlockNoDamage();
      }
      // Check all other achievements
      this.achievementManager.checkAll();

      SaveManager.save(this.gameState);
      AudioManager.stopAmbient();
      this.scene.start('ResultScene', { kills: this.kills, wave: this.waveManager.getMaxWaves(), survived: true });
    });

    this.events.on('player-damaged', (hp: number, maxHp: number) => {
      this.hud.updateHpBar(hp, maxHp);
      this.playerTookDamage = true;
      AudioManager.play('player_hurt');
      // Enhanced damage feedback: blood particles + vignette + shake + HP blink
      this.flashPlayerDamage();
    });

    this.events.on('player-died', (reason: string = 'player_killed') => {
      // Guard against double-fire (e.g. base destroyed + player killed same frame)
      if (this.gameOverShown) return;
      this.gameOverShown = true;

      AudioManager.play('player_death');
      AudioManager.stopAmbient();
      this.gameState.progress.totalKills += this.kills;
      this.gameState.progress.totalRuns++;
      // New "parallel dimension" -- randomize map seed on death
      this.gameState.mapSeed = Math.floor(Math.random() * 100000);
      this.gameState.inventory.loadedAmmo = this.loadedAmmo;
      this.decreaseUsedWeaponDurability();
      this.skillManager.syncToState(this.gameState);
      this.resourceManager.syncToState(this.gameState);
      this.refugeeManager.syncToState();
      this.fogOfWar.syncToState();
      SaveManager.save(this.gameState);

      // Short delay so death animation can start before we show the panel
      this.time.delayedCall(600, () => {
        this.showGameOver(reason);
      });
    });

    // Spitter fires a projectile at the player
    this.events.on('spitter-shoot', (zombie: Zombie, target: Phaser.GameObjects.Sprite) => {
      if (!zombie.active) return;
      const angle = angleBetween(zombie.x, zombie.y, target.x, target.y);
      const useSpitterSprite = this.textures.exists('spitter_projectile');
      const existing = this.spitterProjectileGroup.getFirstDead(false) as Projectile | null;
      if (existing) {
        if (useSpitterSprite) existing.setTexture('spitter_projectile');
        existing.fire(zombie.x, zombie.y, angle, zombie.damage);
        if (!useSpitterSprite) existing.setTint(0x44FF44);
      } else {
        const proj = new Projectile(this, zombie.x, zombie.y);
        if (useSpitterSprite) proj.setTexture('spitter_projectile');
        this.spitterProjectileGroup.add(proj);
        proj.fire(zombie.x, zombie.y, angle, zombie.damage);
        if (!useSpitterSprite) proj.setTint(0x44FF44);
      }
    });

    // Screamer attracts all zombies within radius
    this.events.on('screamer-scream', (screamer: Zombie, radius: number) => {
      if (!screamer.active) return;
      this.zombieGroup.getChildren().forEach(child => {
        const zombie = child as Zombie;
        if (!zombie.active || zombie === screamer) return;
        const dist = distanceBetween(screamer.x, screamer.y, zombie.x, zombie.y);
        if (dist <= radius) {
          zombie.attractTo(screamer.x, screamer.y);
        }
      });
      // Visual: expanding purple ring
      const ring = this.add.graphics();
      ring.lineStyle(2, 0xAA44FF, 0.8);
      ring.strokeCircle(screamer.x, screamer.y, 10);
      ring.setDepth(10);
      this.tweens.add({
        targets: ring,
        scaleX: radius / 10,
        scaleY: radius / 10,
        alpha: 0,
        duration: 600,
        ease: 'Power2',
        onComplete: () => ring.destroy(),
      });
    });

    // Boss spawns minions on death
    this.events.on('boss-death-spawn', (boss: Zombie) => {
      if (!boss.spawnOnDeath) return;
      const rawConfig = enemiesData.enemies.find(e => e.id === boss.spawnOnDeath);
      if (!rawConfig) {
        console.warn(`Missing enemy config for spawn-on-death: ${boss.spawnOnDeath}`);
        return;
      }
      // Safe cast: rawConfig validated via .find() + null check above
      const spawnConfig = rawConfig as ZombieConfig;
      for (let i = 0; i < boss.spawnCount; i++) {
        const offsetX = (Math.random() - 0.5) * 60;
        const offsetY = (Math.random() - 0.5) * 60;
        const existing = this.zombieGroup.getFirstDead(false) as Zombie | null;
        const target = boss.getTarget();
        if (existing) {
          existing.reset(boss.x + offsetX, boss.y + offsetY, spawnConfig);
          if (target) existing.setTarget(target);
        } else {
          const zombie = new Zombie(this, boss.x + offsetX, boss.y + offsetY, spawnConfig);
          if (target) zombie.setTarget(target);
          this.zombieGroup.add(zombie);
        }
        // Count the spawned enemy for wave tracking
        this.waveManager.addExtraEnemy();
      }
    });

    // Landmine AOE: damage all zombies within explosion radius
    this.events.on('landmine-exploded', (cx: number, cy: number, damage: number, radius: number) => {
      // Visual: orange burst particles at explosion center
      this.trapEmitter.emitParticleAt(cx, cy, 20);

      // Damage every active zombie within radius
      this.zombieGroup.getChildren().forEach(child => {
        const z = child as Zombie;
        if (!z.active) return;
        const dist = Phaser.Math.Distance.Between(z.x, z.y, cx, cy);
        if (dist <= radius) {
          z.takeDamage(damage);
        }
      });
    });
  }

  private setupWeaponKeys(): void {
    if (!this.input.keyboard) return;
    // Number keys 1-5 to switch weapons
    for (let i = 1; i <= 5; i++) {
      const key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + (i - 1));
      key.on('down', () => {
        this.weaponManager.switchWeapon(i - 1);
        this.updateWeaponHUD();
        // Show ammo warning if switching to ranged weapon with no ammo
        const w = this.weaponManager.getEquipped();
        if (w) {
          const s = this.weaponManager.getWeaponStats(w);
          if (s.weaponClass !== 'melee' && this.loadedAmmo <= 0) {
            this.hud.showMessage('NO AMMO! Load in Day phase.');
            AudioManager.play('ui_error');
          }
        }
      });
    }

    // ESC to pause
    const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.on('down', () => {
      if (this.scene.isPaused()) {
        this.scene.resume();
        this.pauseOverlay?.setVisible(false);
      } else {
        this.scene.pause();
        this.showPauseOverlay();
      }
    });
  }

  private pauseOverlay: Phaser.GameObjects.Container | null = null;

  private showPauseOverlay(): void {
    if (this.pauseOverlay) {
      this.pauseOverlay.setVisible(true);
      return;
    }
    this.pauseOverlay = this.add.container(0, 0).setDepth(300).setScrollFactor(0);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.pauseOverlay.add(bg);

    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'PAUSED', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '24px',
      color: '#E8DCC8',
    }).setOrigin(0.5);
    this.pauseOverlay.add(text);

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'Press ESC to resume', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#6B6B6B',
    }).setOrigin(0.5);
    this.pauseOverlay.add(hint);

    // Make bg interactive to prevent clicks passing through
    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains
    );
    bg.on('pointerdown', () => {
      this.scene.resume();
      this.pauseOverlay?.setVisible(false);
    });
  }

  private updateWeaponHUD(): void {
    const weapon = this.weaponManager.getEquipped();
    if (weapon) {
      const stats = this.weaponManager.getWeaponStats(weapon);
      this.hud.updateWeapon(stats.name, weapon.durability, weapon.maxDurability, stats.specialEffect);
    }
  }

  private tryAutoShoot(): void {
    const weapon = this.weaponManager.getEquipped();
    if (!weapon) return;
    if (this.weaponManager.isBroken(weapon)) return;

    const stats = this.weaponManager.getWeaponStats(weapon);
    const isMelee = stats.weaponClass === 'melee';

    let nearestZombie: Zombie | null = null;
    let nearestDist = stats.range;

    this.zombieGroup.getChildren().forEach(child => {
      const zombie = child as Zombie;
      if (!zombie.active) return;

      const dist = distanceBetween(
        this.player.x, this.player.y,
        zombie.x, zombie.y
      );

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestZombie = zombie;
      }
    });

    if (!nearestZombie) return;

    // Re-check: zombie could have died during the same frame (e.g. killed by a
    // trap overlap processed earlier in checkZombieStructureInteractions).
    // shootAt() also guards, but checking here avoids consuming ammo / cooldown
    // for a target that is already dead.
    if (!(nearestZombie as Zombie).active) return;

    // Melee weapons don't cost ammo
    if (isMelee) {
      this.shootAt(nearestZombie);
      this.shootCooldown = stats.fireRate;
    } else if (this.loadedAmmo > 0) {
      this.shootAt(nearestZombie);
      this.shootCooldown = stats.fireRate;
    }
  }

  private shootAt(target: Zombie): void {
    if (!target.active) return;
    const weapon = this.weaponManager.getEquipped();
    if (!weapon) return;

    // Play player attack animation
    this.player.playAttackAnim();

    const stats = this.weaponManager.getWeaponStats(weapon);
    const isMelee = stats.weaponClass === 'melee';

    // Consume ammo for ranged weapons
    if (!isMelee) {
      this.loadedAmmo--;
      this.hud.updateAmmo(this.loadedAmmo);
    }

    // Track weapon usage for durability decrease at end of night
    this.weaponUsedThisNight.add(weapon.id);

    // Apply stealth noise reduction from stealth skill
    const noiseReduction = this.skillManager.getBonus('stealth', 'noiseReduction');
    const adjustedNoise = Math.max(0, stats.noiseLevel * (1 - noiseReduction));

    // Play weapon sound effect
    AudioManager.playWeaponSound(stats.weaponClass);

    // Emit weapon-fired event for SoundMechanic
    this.events.emit('weapon-fired', {
      x: this.player.x,
      y: this.player.y,
      noiseLevel: adjustedNoise,
    });

    // Melee weapons apply damage directly -- no projectiles
    if (isMelee) {
      target.takeDamage(stats.damage);
      AudioManager.play('melee_hit');
      this.bloodEmitter.emitParticleAt(target.x, target.y, 6);

      // Apply special effect if weapon has one and zombie survived the hit
      if (stats.specialEffect && target.active) {
        this.applyMeleeSpecialEffect(target, stats.specialEffect);
      }

      // Visual: sweep arc showing melee range
      const arc = this.add.graphics();
      arc.setDepth(9);
      const sweepAngle = angleBetween(this.player.x, this.player.y, target.x, target.y);
      arc.lineStyle(2, 0xE8DCC8, 0.6);
      arc.beginPath();
      arc.arc(this.player.x, this.player.y, stats.range, sweepAngle - 0.8, sweepAngle + 0.8, false);
      arc.strokePath();
      this.tweens.add({
        targets: arc,
        alpha: 0,
        duration: 200,
        onComplete: () => arc.destroy(),
      });
      return;
    }

    // Muzzle flash particles for ranged weapons
    this.muzzleEmitter.emitParticleAt(this.player.x, this.player.y, 4);

    const angle = angleBetween(
      this.player.x, this.player.y,
      target.x, target.y
    );

    if (stats.weaponClass === 'shotgun') {
      // Shotgun fires a spread of 3 pellets -- each pellet carries the special effect
      const spreadAngles = [angle - 0.15, angle, angle + 0.15];
      for (const a of spreadAngles) {
        this.fireProjectile(a, Math.round(stats.damage / 3), stats.specialEffect);
      }
    } else {
      this.fireProjectile(angle, stats.damage, stats.specialEffect);
    }
  }

  private fireProjectile(angle: number, damage: number, specialEffect: WeaponSpecialEffect | null = null): void {
    const existing = this.projectileGroup.getFirstDead(false) as Projectile | null;
    if (existing) {
      existing.fire(this.player.x, this.player.y, angle, damage, specialEffect);
    } else {
      const proj = new Projectile(this, this.player.x, this.player.y);
      this.projectileGroup.add(proj);
      proj.fire(this.player.x, this.player.y, angle, damage, specialEffect);
    }
  }

  // Map weapon class to the corresponding combat skill
  private weaponClassToSkill(weaponClass: WeaponClass): SkillType | null {
    const map: Partial<Record<WeaponClass, SkillType>> = {
      melee: 'combat_melee',
      pistol: 'combat_pistol',
      rifle: 'combat_rifle',
      shotgun: 'combat_shotgun',
    };
    return map[weaponClass] ?? null;
  }

  /**
   * Apply a melee weapon's special effect to a zombie.
   * Called after the base hit damage is applied, only when the zombie is still alive.
   * Each effect has a random chance to trigger (effect.chance 0-1).
   */
  private applyMeleeSpecialEffect(zombie: Zombie, effect: WeaponSpecialEffect): void {
    if (Math.random() > effect.chance) return; // Chance roll failed

    switch (effect.type) {
      case 'knockback': {
        // Push zombie away from player along the hit vector
        const angle = angleBetween(this.player.x, this.player.y, zombie.x, zombie.y);
        const kbVx = Math.cos(angle) * effect.value * 10;
        const kbVy = Math.sin(angle) * effect.value * 10;
        zombie.setVelocity(kbVx, kbVy);
        // Restore normal velocity after a short delay so zombie resumes pathing
        this.time.delayedCall(150, () => {
          if (zombie.active) zombie.setVelocity(0, 0);
        });
        break;
      }

      case 'cripple': {
        // Reduce moveSpeed by (1 - value) fraction for duration ms
        const originalSpeed = zombie.moveSpeed;
        zombie.moveSpeed = originalSpeed * effect.value;
        this.time.delayedCall(effect.duration, () => {
          if (zombie.active) zombie.moveSpeed = originalSpeed;
        });
        break;
      }

      case 'stun': {
        // Stop zombie movement completely for duration ms
        const stunOriginal = zombie.moveSpeed;
        zombie.moveSpeed = 0;
        zombie.setVelocity(0, 0);
        this.time.delayedCall(effect.duration, () => {
          if (zombie.active) zombie.moveSpeed = stunOriginal;
        });
        break;
      }

      case 'bleed': {
        // Deal extra damage after 1 second (damage over time, single tick)
        const bleedDamage = effect.value;
        this.time.delayedCall(1000, () => {
          if (zombie.active) {
            zombie.takeDamage(bleedDamage);
            if (zombie.active) this.bloodEmitter.emitParticleAt(zombie.x, zombie.y, 3);
          }
        });
        break;
      }

      case 'cleave': {
        // Damage all zombies within effect.value pixels radius
        const cleaveRadius = effect.value;
        const equipped = this.weaponManager.getEquipped();
        const cleaveDamage = equipped
          ? Math.round(this.weaponManager.getWeaponStats(equipped).damage * 0.5)
          : 5;
        this.zombieGroup.getChildren().forEach(child => {
          const nearby = child as Zombie;
          if (!nearby.active || nearby === zombie) return;
          const dist = distanceBetween(zombie.x, zombie.y, nearby.x, nearby.y);
          if (dist <= cleaveRadius) {
            nearby.takeDamage(cleaveDamage);
            if (nearby.active) this.bloodEmitter.emitParticleAt(nearby.x, nearby.y, 3);
          }
        });
        break;
      }

      case 'crit': {
        // Double damage on a chance roll -- damage already applied, so deal the bonus portion
        // effect.value = multiplier (e.g. 2 means 2x, so bonus = 1x base)
        const equipped2 = this.weaponManager.getEquipped();
        if (equipped2) {
          const baseDmg = this.weaponManager.getWeaponStats(equipped2).damage;
          const bonusDmg = Math.round(baseDmg * (effect.value - 1));
          zombie.takeDamage(bonusDmg);
          if (zombie.active) this.bloodEmitter.emitParticleAt(zombie.x, zombie.y, 8);
        }
        break;
      }

      // These types are handled by applyRangedSpecialEffect -- no-op here to satisfy exhaustive switch
      case 'piercing':
      case 'headshot':
      case 'incendiary':
        break;
    }
  }

  /**
   * Calculate final damage for a ranged projectile hit.
   * Handles crit/headshot: if the effect triggers, damage is multiplied.
   * Called before zombie.takeDamage() in the collision callback.
   */
  private calcRangedDamage(proj: Projectile): number {
    const effect = proj.specialEffect;
    if (!effect) return proj.damage;

    if ((effect.type === 'headshot' || effect.type === 'crit') && Math.random() <= effect.chance) {
      // effect.value is the damage multiplier (e.g. 2 = double damage)
      return Math.round(proj.damage * effect.value);
    }

    return proj.damage;
  }

  /**
   * Apply ranged special effects that act on the zombie or world after a projectile hit.
   * piercing is handled in the collision callback (skip deactivate).
   * headshot/crit bonus damage is handled in calcRangedDamage.
   * knockback and incendiary are applied here.
   */
  private applyRangedSpecialEffect(zombie: Zombie, proj: Projectile, effect: WeaponSpecialEffect): void {
    if (Math.random() > effect.chance) return; // Chance roll failed

    switch (effect.type) {
      case 'knockback': {
        // Push zombie away from projectile direction
        const angle = angleBetween(proj.x, proj.y, zombie.x, zombie.y);
        const kbVx = Math.cos(angle) * effect.value * 10;
        const kbVy = Math.sin(angle) * effect.value * 10;
        zombie.setVelocity(kbVx, kbVy);
        this.time.delayedCall(150, () => {
          if (zombie.active) zombie.setVelocity(0, 0);
        });
        break;
      }

      case 'incendiary': {
        // Create a burn zone: a Graphics circle that deals DOT to zombies inside it
        // effect.value = radius in pixels, effect.duration = zone lifetime in ms
        const burnRadius = effect.value;
        const burnDuration = effect.duration > 0 ? effect.duration : 3000;
        const burnDmgPerTick = 5; // damage per tick
        const tickInterval = 1000; // ms between damage ticks

        const zone = this.add.graphics();
        zone.setDepth(3);
        // Draw outer glow and inner fire circle
        zone.fillStyle(0xFF4400, 0.35);
        zone.fillCircle(0, 0, burnRadius);
        zone.lineStyle(2, 0xFF8800, 0.7);
        zone.strokeCircle(0, 0, burnRadius);
        zone.setPosition(zombie.x, zombie.y);

        // Flicker tween for visual feedback
        this.tweens.add({
          targets: zone,
          alpha: { from: 0.8, to: 0.4 },
          duration: 400,
          yoyo: true,
          repeat: Math.floor(burnDuration / 800),
        });

        // DOT ticker: damage all zombies inside the burn zone each tick
        let elapsed = 0;
        const ticker = this.time.addEvent({
          delay: tickInterval,
          loop: true,
          callback: () => {
            elapsed += tickInterval;
            this.zombieGroup.getChildren().forEach(child => {
              const z = child as Zombie;
              if (!z.active) return;
              const dist = distanceBetween(z.x, z.y, zone.x, zone.y);
              if (dist <= burnRadius) {
                z.takeDamage(burnDmgPerTick);
                if (z.active) this.bloodEmitter.emitParticleAt(z.x, z.y, 2);
              }
            });
            if (elapsed >= burnDuration) {
              ticker.remove();
              this.tweens.add({
                targets: zone,
                alpha: 0,
                duration: 400,
                onComplete: () => zone.destroy(),
              });
            }
          },
        });
        break;
      }

      case 'cleave': {
        // Explosives AOE: damage all zombies within effect.value pixels of the impact point
        const aoeRadius = effect.value;
        const equipped3 = this.weaponManager.getEquipped();
        const aoeDmg = equipped3
          ? Math.round(this.weaponManager.getWeaponStats(equipped3).damage * 0.7)
          : 10;
        // Visual flash at impact point
        const flash = this.add.graphics();
        flash.setDepth(10);
        flash.fillStyle(0xFFAA00, 0.7);
        flash.fillCircle(0, 0, aoeRadius * 0.5);
        flash.setPosition(proj.x, proj.y);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          scaleX: 2,
          scaleY: 2,
          duration: 300,
          onComplete: () => flash.destroy(),
        });
        // Apply AOE damage to all zombies in radius
        this.zombieGroup.getChildren().forEach(child => {
          const z = child as Zombie;
          if (!z.active) return;
          const dist = distanceBetween(z.x, z.y, proj.x, proj.y);
          if (dist <= aoeRadius) {
            z.takeDamage(aoeDmg);
            if (z.active) this.bloodEmitter.emitParticleAt(z.x, z.y, 4);
          }
        });
        break;
      }

      // crit, headshot: damage multiplier applied in calcRangedDamage -- nothing more to do
      // piercing: handled in collision callback
      case 'crit':
      case 'headshot':
      case 'piercing':
        break;

      // These are melee-only effects -- should not appear on ranged weapons, guard anyway
      case 'bleed':
      case 'cripple':
      case 'stun':
        break;
    }
  }

  // Decrease durability by 1 for each weapon used during this night
  private decreaseUsedWeaponDurability(): void {
    for (const weaponId of this.weaponUsedThisNight) {
      this.weaponManager.decreaseDurability(weaponId);
    }
  }

  // 5D: Check zombie overlap with barricades, traps, and new trap types each frame
  private checkZombieStructureInteractions(): void {
    // Clean up inactive structures once per frame (not per-zombie)
    this.barricades  = this.barricades.filter(b => b && b.active);
    this.traps       = this.traps.filter(t => t && t.active);
    this._spikeStrips = this._spikeStrips.filter(s => s && s.active);
    this._bearTraps   = this._bearTraps.filter(b => b && b.active);
    this._landmines   = this._landmines.filter(m => m && m.active);
    this._sandbags    = this._sandbags.filter(s => s && s.active);
    this._oilSlicks   = this._oilSlicks.filter(o => o && o.active);

    this.zombieGroup.getChildren().forEach(child => {
      const zombie = child as Zombie;
      if (!zombie.active) return;

      // Barricade interaction: slow zombies, brutes damage barricades
      for (let i = this.barricades.length - 1; i >= 0; i--) {
        const barricade = this.barricades[i];
        if (!barricade) continue;

        const bx = barricade.structureInstance.x;
        const by = barricade.structureInstance.y;

        if (
          zombie.x >= bx && zombie.x <= bx + TILE_SIZE &&
          zombie.y >= by && zombie.y <= by + TILE_SIZE
        ) {
          // Slow zombie passing through barricade
          const factor = barricade.getSlowFactor();
          const body = zombie.body;
          if (body) {
            body.velocity.x *= factor;
            body.velocity.y *= factor;
          }

          // Brutes damage barricades on contact
          if (zombie.canAttackStructure()) {
            const destroyed = barricade.takeDamage(zombie.structureDamage);
            zombie.resetStructureAttackCooldown();
            if (destroyed) {
              this.barricades.splice(i, 1);
            }
          }
        }
      }

      // Sandbags interaction: cheap slow zone, brutes can destroy
      for (let i = this._sandbags.length - 1; i >= 0; i--) {
        const bags = this._sandbags[i];
        if (!bags) continue;

        const sx = bags.structureInstance.x;
        const sy = bags.structureInstance.y;

        if (
          zombie.x >= sx && zombie.x <= sx + TILE_SIZE &&
          zombie.y >= sy && zombie.y <= sy + TILE_SIZE
        ) {
          const factor = bags.getSlowFactor();
          const body = zombie.body;
          if (body) {
            body.velocity.x *= factor;
            body.velocity.y *= factor;
          }

          if (zombie.canAttackStructure()) {
            const destroyed = bags.takeDamage(zombie.structureDamage);
            zombie.resetStructureAttackCooldown();
            if (destroyed) {
              this._sandbags.splice(i, 1);
            }
          }
        }
      }

      // Oil Slick interaction: heavy slow in wide zone (zombies walk in unaware)
      for (const slick of this._oilSlicks) {
        if (!slick) continue;
        if (slick.containsPoint(zombie.x, zombie.y)) {
          const factor = slick.getSlowFactor();
          const body = zombie.body;
          if (body) {
            body.velocity.x *= factor;
            body.velocity.y *= factor;
          }
        }
      }

      // Trap interaction: damage zombies walking over traps
      for (let i = this.traps.length - 1; i >= 0; i--) {
        const trap = this.traps[i];
        if (!trap) continue;

        const tx = trap.structureInstance.x;
        const ty = trap.structureInstance.y;

        if (
          zombie.x >= tx && zombie.x <= tx + TILE_SIZE &&
          zombie.y >= ty && zombie.y <= ty + TILE_SIZE
        ) {
          zombie.takeDamage(trap.getDamage());
          // Trap trigger particles
          this.trapEmitter.emitParticleAt(
            trap.structureInstance.x + TILE_SIZE / 2,
            trap.structureInstance.y + TILE_SIZE / 2,
            6,
          );
          // Trap is single-use (hp=1), destroy after triggering
          const destroyed = trap.takeDamage(trap.structureInstance.hp);
          if (destroyed) {
            this.traps.splice(i, 1);
          }
        }
      }

      // Spike Strip interaction: damage + cripple (-50% speed), multi-use durability
      for (let i = this._spikeStrips.length - 1; i >= 0; i--) {
        const strip = this._spikeStrips[i];
        if (!strip) continue;

        const sx = strip.structureInstance.x;
        const sy = strip.structureInstance.y;

        if (
          zombie.x >= sx && zombie.x <= sx + TILE_SIZE &&
          zombie.y >= sy && zombie.y <= sy + TILE_SIZE
        ) {
          zombie.takeDamage(strip.getDamage());
          zombie.applyCripple(strip.crippleDuration);
          this.trapEmitter.emitParticleAt(
            strip.structureInstance.x + TILE_SIZE / 2,
            strip.structureInstance.y + TILE_SIZE / 2,
            4,
          );
          const destroyed = strip.consumeUse();
          if (destroyed) {
            this._spikeStrips.splice(i, 1);
          }
        }
      }

      // Bear Trap interaction: heavy damage + stun, single use
      for (let i = this._bearTraps.length - 1; i >= 0; i--) {
        const bt = this._bearTraps[i];
        if (!bt) continue;

        const bx = bt.structureInstance.x;
        const by = bt.structureInstance.y;

        if (
          zombie.x >= bx && zombie.x <= bx + TILE_SIZE &&
          zombie.y >= by && zombie.y <= by + TILE_SIZE
        ) {
          zombie.takeDamage(bt.getDamage());
          zombie.applyStun(bt.stunDuration);
          this.trapEmitter.emitParticleAt(
            bt.structureInstance.x + TILE_SIZE / 2,
            bt.structureInstance.y + TILE_SIZE / 2,
            8,
          );
          bt.trigger();
          this._bearTraps.splice(i, 1);
        }
      }

      // Landmine interaction: AOE explosion, single use
      // Only trigger once per zombie per frame; break after first mine detected
      for (let i = this._landmines.length - 1; i >= 0; i--) {
        const mine = this._landmines[i];
        if (!mine) continue;

        const mx = mine.structureInstance.x;
        const my = mine.structureInstance.y;

        if (
          zombie.x >= mx && zombie.x <= mx + TILE_SIZE &&
          zombie.y >= my && zombie.y <= my + TILE_SIZE
        ) {
          // trigger() emits 'landmine-exploded' event that NightScene listens to
          mine.trigger();
          this._landmines.splice(i, 1);
          break; // one mine trigger per zombie per frame
        }
      }
    });

    // Pillbox interaction: check once per frame (was incorrectly inside per-zombie loop)
    this.checkPillboxDamage();
  }

  /**
   * F3: Check if base-seeking zombies have reached the base center.
   * Zombies within the base radius deal damage and get knocked back.
   * Uses canAttack() cooldown to prevent spam damage.
   */
  private checkZombieBaseInteractions(): void {
    if (this.baseCenterX === 0) return;

    // Base "hit radius" must match or exceed zombie stop distance (48px in Zombie.ts)
    const baseRadius = 56;

    this.zombieGroup.getChildren().forEach(child => {
      const zombie = child as Zombie;
      if (!zombie.active || !zombie.canAttack()) return;

      const dist = Phaser.Math.Distance.Between(
        zombie.x, zombie.y,
        this.baseCenterX, this.baseCenterY
      );
      if (dist <= baseRadius) {
        // Zombie hits base
        this.damageBase(zombie.damage);
        zombie.resetAttackCooldown();

        // Base defenses slowly wear down zombies so waves can always complete.
        // Without this, base-stuck zombies with velocity 0 could live forever
        // if the player doesn't actively shoot them, blocking wave progression.
        zombie.takeDamage(1);
      }
    });
  }

  // Assign healthy refugees to pillbox structures for night defense
  private setupPillboxRefugees(): void {
    this.pillboxAssignments = [];
    const pillboxes = this.gameState.base.structures.filter(s => s.structureId === 'pillbox');
    const available = this.refugeeManager.getPillboxRefugees();

    // Assign one refugee per pillbox
    for (let i = 0; i < pillboxes.length && i < available.length; i++) {
      const pillbox = pillboxes[i];
      const refugee = available[i];
      if (pillbox && refugee) {
        this.pillboxAssignments.push({
          structure: pillbox,
          refugee,
          cooldown: 0,
        });
      }
    }
  }

  // Refugees in pillboxes auto-shoot nearby zombies
  private updatePillboxShooting(delta: number): void {
    for (const assignment of this.pillboxAssignments) {
      assignment.cooldown = Math.max(0, assignment.cooldown - delta);
      if (assignment.cooldown > 0) continue;

      const px = assignment.structure.x + TILE_SIZE / 2;
      const py = assignment.structure.y + TILE_SIZE / 2;

      // "Good shot" skill bonus gives extra range
      const range = assignment.refugee.skillBonus === 'Good shot'
        ? REFUGEE_PILLBOX_RANGE + 50
        : REFUGEE_PILLBOX_RANGE;

      // Find the nearest active zombie within range using a manual distance loop.
      // Note: this.physics.closest() is NOT part of Phaser 3 Arcade Physics API
      // and always returns null, so we iterate manually instead.
      let nearest: Zombie | null = null;
      let nearestDist = Infinity;
      for (const child of this.zombieGroup.getChildren()) {
        const z = child as Zombie;
        if (!z.active) continue;
        const d = distanceBetween(px, py, z.x, z.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = z;
        }
      }
      if (!nearest) continue;

      const nearestZombie: Zombie | null = nearestDist <= range ? nearest : null;

      if (nearestZombie) {
        const zx = nearestZombie.x;
        const zy = nearestZombie.y;
        const angle = angleBetween(px, py, zx, zy);
        const existing = this.projectileGroup.getFirstDead(false) as Projectile | null;
        if (existing) {
          existing.fire(px, py, angle, REFUGEE_PILLBOX_DAMAGE);
        } else {
          const proj = new Projectile(this, px, py);
          this.projectileGroup.add(proj);
          proj.fire(px, py, angle, REFUGEE_PILLBOX_DAMAGE);
        }
        assignment.cooldown = REFUGEE_PILLBOX_COOLDOWN;
      }
    }
  }

  // Check if zombies reach pillboxes and damage refugees inside
  private checkPillboxDamage(): void {
    for (let i = this.pillboxAssignments.length - 1; i >= 0; i--) {
      const assignment = this.pillboxAssignments[i];
      if (!assignment) continue;

      const sx = assignment.structure.x;
      const sy = assignment.structure.y;
      let removed = false;

      this.zombieGroup.getChildren().forEach(child => {
        if (removed) return;
        const zombie = child as Zombie;
        if (!zombie.active || !zombie.canAttack()) return;

        if (
          zombie.x >= sx && zombie.x <= sx + TILE_SIZE &&
          zombie.y >= sy && zombie.y <= sy + TILE_SIZE
        ) {
          // Structure takes damage
          assignment.structure.hp -= zombie.damage;
          zombie.resetAttackCooldown();

          // Refugee takes proportional damage
          const proportional = Math.round(zombie.damage * 0.5);
          this.refugeeManager.damageRefugeeInPillbox(assignment.refugee.id, proportional);

          // Check if refugee died/injured or structure destroyed
          const updated = this.refugeeManager.getById(assignment.refugee.id);
          if (!updated || updated.status === 'injured' || assignment.structure.hp <= 0) {
            this.pillboxAssignments.splice(i, 1);
            removed = true;
          }
        }
      });
    }
  }

  /**
   * Roll loot drop for a killed zombie using per-enemy dropTable from enemies.json.
   * Each enemy type has its own dropChance (0-1) and a weighted dropTable.
   * Brutes and bosses have higher dropChance (0.4) and better loot ranges.
   *
   * Algorithm:
   *  1. Look up the enemy config by zombieId.
   *  2. Roll against dropChance -- if miss, no drop.
   *  3. Select one resource from dropTable using weighted random (sum weights, pick slice).
   *  4. Roll amount between min and max.
   *  5. Add to inventory and show a floating floater text.
   */
  private rollLootDrops(x: number, y: number, zombieId: string): void {
    // Find the enemy config matching this zombie type
    const enemyConfig = enemiesData.enemies.find(e => e.id === zombieId);
    if (!enemyConfig) return; // unknown enemy type -- skip drop

    // Check if this enemy has drop data
    const dropChance = (enemyConfig as Record<string, unknown>).dropChance as number | undefined;
    const dropTableRaw = (enemyConfig as Record<string, unknown>).dropTable as DropTableEntry[] | undefined;
    if (dropChance === undefined || !dropTableRaw || dropTableRaw.length === 0) return;

    // Roll against dropChance
    if (Math.random() > dropChance) return;

    // Weighted selection: sum all weights, then pick a random slice
    const totalWeight = dropTableRaw.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen: DropTableEntry | undefined;
    for (const entry of dropTableRaw) {
      roll -= entry.weight;
      if (roll <= 0) {
        chosen = entry;
        break;
      }
    }
    // Fallback: floating-point drift may leave roll > 0 -- use last entry
    if (!chosen) chosen = dropTableRaw[dropTableRaw.length - 1];
    // Guard: should never be undefined since we verified dropTableRaw.length > 0 above
    if (!chosen) return;

    const amount = Math.floor(Math.random() * (chosen.max - chosen.min + 1)) + chosen.min;
    this.resourceManager.add(chosen.resource as ResourceType, amount);

    // Floater text: yellow, fades up 30px over 1.5s
    this.showFloatingText(x, y, `+${amount} ${chosen.resource.toUpperCase()}`);
    AudioManager.play('loot_pickup');
  }

  private showFloatingText(x: number, y: number, message: string): void {
    // 10px + stroke for readability over varied terrain backgrounds
    const text = this.add.text(x, y, message, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  // -- Visual effect setup methods --

  private setupParticles(): void {
    if (!this.textures.exists('particle_white')) {
      const pg = this.make.graphics({ x: 0, y: 0 });
      pg.fillStyle(0xFFFFFF);
      pg.fillCircle(3, 3, 3);
      pg.generateTexture('particle_white', 6, 6);
      pg.destroy();
    }
    if (!this.textures.exists('particle_red')) {
      const rg = this.make.graphics({ x: 0, y: 0 });
      rg.fillStyle(0x8B0000);
      rg.fillCircle(2, 2, 2);
      rg.generateTexture('particle_red', 4, 4);
      rg.destroy();
    }
    if (!this.textures.exists('particle_orange')) {
      const og = this.make.graphics({ x: 0, y: 0 });
      og.fillStyle(0xD4620B);
      og.fillCircle(2, 2, 2);
      og.generateTexture('particle_orange', 4, 4);
      og.destroy();
    }

    this.muzzleEmitter = this.add.particles(0, 0, 'particle_white', {
      speed: { min: 80, max: 200 },
      lifespan: 100,
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    this.muzzleEmitter.setDepth(15);

    this.bloodEmitter = this.add.particles(0, 0, 'particle_red', {
      speed: { min: 40, max: 120 },
      lifespan: 400,
      scale: { start: 1.2, end: 0.3 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    this.bloodEmitter.setDepth(4);

    this.trapEmitter = this.add.particles(0, 0, 'particle_orange', {
      speed: { min: 60, max: 150 },
      lifespan: 300,
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    this.trapEmitter.setDepth(6);

    // Player blood splatter: brighter red, emitted at player world position when hit
    this.playerBloodEmitter = this.add.particles(0, 0, 'particle_red', {
      speed: { min: 60, max: 180 },
      angle: { min: 0, max: 360 },
      lifespan: 350,
      scale: { start: 1.4, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: 0xCC0000,
      emitting: false,
    });
    this.playerBloodEmitter.setDepth(12); // above player (depth 10)
  }

  private setupLighting(): void {
    // Night uses same terrain as day -- no overlays, no glow, no vignette
    // Darkness comes from slightly darker background only
    // Match the darkest grass tile color to hide gaps between tiles
    this.cameras.main.setBackgroundColor('#1E3216');
  }

  private updateLighting(): void {
    // No lighting effects -- kept as empty method for API compatibility
  }

  private setupDamageOverlay(): void {
    this.damageOverlay = this.add.graphics();
    this.damageOverlay.setDepth(99);
    this.damageOverlay.setScrollFactor(0);
    this.damageOverlay.setAlpha(0);

    // Screen-edge vignette flash for player damage (not a fullscreen overlay --
    // only the borders of the screen flash red, center stays clear)
    this.vignetteFlash = this.add.graphics();
    this.vignetteFlash.setDepth(98);
    this.vignetteFlash.setScrollFactor(0);
    this.vignetteFlash.setAlpha(0);
  }

  private flashDamageOverlay(): void {
    const flashColor = parseInt(visualConfig.damageFlash.color.replace('0x', ''), 16);
    this.damageOverlay.clear();
    this.damageOverlay.fillStyle(flashColor, visualConfig.damageFlash.overlayAlpha);
    this.damageOverlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
    this.damageOverlay.setAlpha(1);
    this.tweens.add({
      targets: this.damageOverlay,
      alpha: 0,
      duration: visualConfig.damageFlash.duration,
      ease: 'Power2',
    });
  }

  /**
   * Player damage feedback: blood particles at player position, screen-edge vignette flash,
   * camera shake, and HP bar color flash in HUD.
   * Called from player-damaged event.
   */
  private flashPlayerDamage(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const borderThickness = 40;

    // 1. Blood splatter particles around the player (world-space)
    this.playerBloodEmitter.emitParticleAt(this.player.x, this.player.y, 5);

    // 2. Screen-edge vignette flash (NOT fullscreen -- only borders, center clear)
    //    Draw four border rects to simulate a vignette edge
    this.vignetteFlash.clear();
    this.vignetteFlash.fillStyle(0xCC0000, 0.55);
    // Top edge
    this.vignetteFlash.fillRect(0, 0, w, borderThickness);
    // Bottom edge
    this.vignetteFlash.fillRect(0, h - borderThickness, w, borderThickness);
    // Left edge
    this.vignetteFlash.fillRect(0, 0, borderThickness, h);
    // Right edge
    this.vignetteFlash.fillRect(w - borderThickness, 0, borderThickness, h);
    this.vignetteFlash.setAlpha(1);

    this.tweens.killTweensOf(this.vignetteFlash);
    this.tweens.add({
      targets: this.vignetteFlash,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
    });

    // 3. Camera shake: small, 50ms, 2px intensity
    this.cameras.main.shake(50, 0.006);

    // 4. HP bar flash: delegate to HUD
    this.hud.flashHpBar();
  }

  /**
   * F2: Create a persistent blood splat at the given world position.
   * Uses random shapes/sizes/rotations for visual variety.
   * Added to bloodSplatContainer at depth 0 (below all other objects).
   * Container is destroyed on scene shutdown, clearing all splatters.
   */
  private createBloodSplat(x: number, y: number): void {
    const g = this.add.graphics();

    // Random dark-red blood color with slight variation
    const shade = Phaser.Math.Between(0, 30);
    const color = (0x88 - shade) << 16; // dark red, e.g. 0x880000

    g.fillStyle(color, 0.75 + Math.random() * 0.2);

    // Random rotation for variety
    const rotation = Math.random() * Math.PI * 2;
    g.setRotation(rotation);

    // Base splat: 1-3 overlapping ellipses for organic feel
    const count = Phaser.Math.Between(1, 3);
    for (let i = 0; i < count; i++) {
      const rx = 4 + Math.random() * 8;
      const ry = 3 + Math.random() * 6;
      const ox = (Math.random() - 0.5) * 10;
      const oy = (Math.random() - 0.5) * 10;
      g.fillEllipse(ox, oy, rx * 2, ry * 2);
    }

    // Small satellite droplets
    const drops = Phaser.Math.Between(2, 5);
    for (let i = 0; i < drops; i++) {
      const dr = 1 + Math.random() * 3;
      const dx = (Math.random() - 0.5) * 20;
      const dy = (Math.random() - 0.5) * 20;
      g.fillCircle(dx, dy, dr);
    }

    g.setPosition(x, y);

    this.bloodSplatContainer.add(g);
  }

  /**
   * F3: Damage the base when a zombie reaches it.
   * Updates the HUD base bar and plays structure_damage sound.
   */
  private damageBase(amount: number): void {
    this.baseHp = Math.max(0, this.baseHp - amount);
    this.baseDamageTaken += amount;
    this.hud.updateBaseHpBar(this.baseHp, this.baseMaxHp);
    AudioManager.play('structure_damage');

    // Base destroyed: game over
    if (this.baseHp <= 0) {
      this.events.emit('player-died', 'base_destroyed');
    }
  }

  /**
   * Show a Game Over panel explaining WHY the player lost.
   * Uses a centered panel (NOT a fullscreen overlay).
   * reason: 'player_killed' or 'base_destroyed'
   */
  private showGameOver(reason: string): void {
    // Freeze all physics so zombies stop moving during game over screen
    this.physics.pause();

    const isPlayerKilled = reason === 'player_killed';
    const heading = isPlayerKilled ? 'YOU DIED' : 'BASE DESTROYED';
    const headingColor = isPlayerKilled ? '#F44336' : '#D4620B';

    // Panel dimensions
    const panelW = 340;
    const panelH = 240;
    const px = (GAME_WIDTH - panelW) / 2;
    const py = (GAME_HEIGHT - panelH) / 2;

    const container = this.add.container(0, 0).setDepth(250).setScrollFactor(0);

    // Dark panel background (NOT fullscreen -- only the panel itself)
    const panel = this.add.graphics();
    panel.fillStyle(0x0A0A14, 0.95);
    panel.fillRoundedRect(px, py, panelW, panelH, 10);
    panel.lineStyle(2, isPlayerKilled ? 0xF44336 : 0xD4620B);
    panel.strokeRoundedRect(px, py, panelW, panelH, 10);
    container.add(panel);

    // Heading
    const headingText = this.add.text(GAME_WIDTH / 2, py + 32, heading, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '20px',
      color: headingColor,
    }).setOrigin(0.5);
    container.add(headingText);

    // Scale-in animation for heading
    headingText.setScale(0.6);
    this.tweens.add({
      targets: headingText,
      scaleX: 1,
      scaleY: 1,
      duration: 250,
      ease: 'Back.easeOut',
    });

    // Stats section
    const waveSurvived = this.waveManager.getCurrentWave();
    const maxWaves = this.waveManager.getMaxWaves();
    const statsLines: string[] = [];
    statsLines.push(`Kills: ${this.kills}`);
    statsLines.push(`Wave: ${waveSurvived}/${maxWaves}`);
    if (!isPlayerKilled) {
      statsLines.push(`Base damage taken: ${Math.round(this.baseDamageTaken)}`);
    }

    const statsText = this.add.text(
      GAME_WIDTH / 2,
      py + 80,
      statsLines.join('\n'),
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#E8DCC8',
        align: 'center',
        lineSpacing: 8,
      }
    ).setOrigin(0.5, 0);
    container.add(statsText);

    // "You keep all your gear" reassurance
    const gearText = this.add.text(GAME_WIDTH / 2, py + 160, 'You keep all your gear.', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#4CAF50',
    }).setOrigin(0.5);
    container.add(gearText);

    // Click to continue prompt
    const continueText = this.add.text(GAME_WIDTH / 2, py + panelH - 22, 'Click to continue', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    }).setOrigin(0.5);
    container.add(continueText);

    // Blink the continue prompt
    this.tweens.add({
      targets: continueText,
      alpha: 0.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    // Make the panel itself clickable (not fullscreen)
    panel.setInteractive(
      new Phaser.Geom.Rectangle(px, py, panelW, panelH),
      Phaser.Geom.Rectangle.Contains,
    );

    const goToDay = () => {
      this.scene.start('DayScene');
    };

    panel.on('pointerdown', goToDay);
    // Also allow any key to continue
    const keyHandler = (_evt: KeyboardEvent) => {
      goToDay();
    };
    this.input.keyboard?.on('keydown', keyHandler);
    container.once('destroy', () => {
      this.input.keyboard?.off('keydown', keyHandler);
    });
  }

  private showTutorialOverlay(): void {
    const steps = [
      { title: 'MOVE', text: 'Use WASD or arrow keys\nto move your character.' },
      { title: 'SHOOT', text: 'You auto-shoot the\nclosest enemy in range.' },
      { title: 'SPRINT', text: 'Hold SHIFT to sprint.\nWatch your stamina bar.' },
      { title: 'SWITCH', text: 'Press 1-5 to switch\nweapons during combat.' },
      { title: 'SURVIVE', text: `Survive ${this.waveManager.getMaxWaves()} wave(s).\nYou keep everything\nwhen you die.` },
    ];
    let currentStep = 0;

    const container = this.add.container(0, 0).setDepth(200).setScrollFactor(0);

    // Full-screen clickable backdrop
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.5);
    backdrop.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );
    container.add(backdrop);

    const panelW = 320;
    const panelH = 180;
    const px = (GAME_WIDTH - panelW) / 2;
    const py = (GAME_HEIGHT - panelH) / 2 - 20;

    const panel = this.add.graphics();
    panel.fillStyle(0x1A1A2E, 0.95);
    panel.fillRoundedRect(px, py, panelW, panelH, 8);
    panel.lineStyle(2, 0xD4620B);
    panel.strokeRoundedRect(px, py, panelW, panelH, 8);
    container.add(panel);

    // Step counter
    const stepCounter = this.add.text(GAME_WIDTH / 2, py + 16, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    }).setOrigin(0.5);
    container.add(stepCounter);

    // Title
    const titleText = this.add.text(GAME_WIDTH / 2, py + 40, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#D4620B',
    }).setOrigin(0.5);
    container.add(titleText);

    // Body
    const bodyText = this.add.text(GAME_WIDTH / 2, py + 75, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5, 0);
    container.add(bodyText);

    // Continue prompt
    const continueText = this.add.text(GAME_WIDTH / 2, py + panelH - 18, 'Click or press any key', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    }).setOrigin(0.5);
    container.add(continueText);

    // Blink the continue text
    this.tweens.add({
      targets: continueText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    const showStep = () => {
      const step = steps[currentStep];
      if (!step) return;
      stepCounter.setText(`${currentStep + 1} / ${steps.length}`);
      titleText.setText(step.title);
      bodyText.setText(step.text);
    };

    const advance = () => {
      currentStep++;
      if (currentStep >= steps.length) {
        container.destroy();
        return;
      }
      AudioManager.play('ui_click');
      showStep();
    };

    showStep();

    // Pause physics and wave spawning while tutorial is showing
    this.physics.pause();

    // Click anywhere to advance
    backdrop.on('pointerdown', advance);
    const keyHandler = this.input.keyboard?.on('keydown', advance);

    // Clean up when container is destroyed -- resume physics
    container.once('destroy', () => {
      if (keyHandler) this.input.keyboard?.off('keydown', advance);
      this.physics.resume();
    });
  }
}
