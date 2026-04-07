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
import { BladeSpinner, type BladeSpinnerOverrides } from '../structures/BladeSpinner';
import { FirePit, type FirePitOverrides } from '../structures/FirePit';
import { PropaneGeyser } from '../structures/PropaneGeyser';
import { CartWall } from '../structures/CartWall';
import { WashingCannon } from '../structures/WashingCannon';
import { PitTrap } from '../structures/PitTrap';
import { NailBoard } from '../structures/NailBoard';
import { TripWire } from '../structures/TripWire';
import { GlassShards } from '../structures/GlassShards';
import { TarPit } from '../structures/TarPit';
import { ShockWire } from '../structures/ShockWire';
import { SpringLauncher } from '../structures/SpringLauncher';
import { ChainWall } from '../structures/ChainWall';
import { CircleSawTrap } from '../structures/CircleSawTrap';
import { RazorWireCarousel } from '../structures/RazorWireCarousel';
import { LawnmowerLane } from '../structures/LawnmowerLane';
import { TreadmillOfDoom } from '../structures/TreadmillOfDoom';
import { PendulumAxe } from '../structures/PendulumAxe';
import { GarageDoorSmasher } from '../structures/GarageDoorSmasher';
import { BugZapperXL } from '../structures/BugZapperXL';
import { CarBatteryGrid } from '../structures/CarBatteryGrid';
import { ElectricFence } from '../structures/ElectricFence';
import { NetLauncher } from '../structures/NetLauncher';
import { MeatGrinder } from '../structures/MeatGrinder';
import { BeltSanderGauntlet } from '../structures/BeltSanderGauntlet';
import { PowerDrillPress } from '../structures/PowerDrillPress';
import { PianoWireWeb } from '../structures/PianoWireWeb';
import { CombineHarvester } from '../structures/CombineHarvester';
import { CarBomb } from '../structures/CarBomb';
import { NapalmSprinkler } from '../structures/NapalmSprinkler';
import { GasMainIgniter } from '../structures/GasMainIgniter';
import { FlamethrowerPost } from '../structures/FlamethrowerPost';
import { GlueFloor } from '../structures/GlueFloor';
import { ShoppingCartWall } from '../structures/ShoppingCartWall';
import { CarWreckBarrier } from '../structures/CarWreckBarrier';
import { DumpsterFortress } from '../structures/DumpsterFortress';
import { TractorWheelRoller } from '../structures/TractorWheelRoller';
import { WreckingBall } from '../structures/WreckingBall';
import { LogAvalanche } from '../structures/LogAvalanche';
import { FallingCar } from '../structures/FallingCar';
import { TreadmillBlades } from '../structures/TreadmillBlades';
import { FanGlass } from '../structures/FanGlass';
import { ElevatorShaft } from '../structures/ElevatorShaft';
import { RubeGoldberg } from '../structures/RubeGoldberg';
import type { TrapBase } from '../structures/TrapBase';
import { HUD } from '../ui/HUD';
import { Minimap } from '../ui/Minimap';
import type { MinimapStructurePoint } from '../ui/Minimap';
import { GameLog } from '../ui/GameLog';
import { WeaponManager } from '../systems/WeaponManager';
import { EquipmentPanel } from '../ui/EquipmentPanel';
import { SkillManager } from '../systems/SkillManager';
import { ZoneManager } from '../systems/ZoneManager';
import { AchievementManager } from '../systems/AchievementManager';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, GAME_WIDTH, GAME_HEIGHT, XP_PER_KILL, REFUGEE_PILLBOX_RANGE, REFUGEE_PILLBOX_DAMAGE, REFUGEE_PILLBOX_COOLDOWN, BASE_MAX_HP } from '../config/constants';
import visualConfig from '../data/visual-config.json';
import { RefugeeManager } from '../systems/RefugeeManager';
import { FogOfWar } from '../systems/FogOfWar';
import { NightEventManager, BLOOD_MOON_SPEED_MULTIPLIER, BLOOD_MOON_HP_MULTIPLIER, RAIN_MALFUNCTION_BONUS, RAIN_FIRE_DAMAGE_MULTIPLIER } from '../systems/NightEventManager';
import { distanceBetween, angleBetween } from '../utils/math';
import { AudioManager } from '../systems/AudioManager';
import { SpatialBucketGrid } from '../systems/SpatialGrid';
import type { ResourceType, SkillType, WeaponClass, StructureInstance, RefugeeInstance, WeaponSpecialEffect, WeaponUltimateType } from '../config/types';
import type { ZombieConfig } from '../entities/Zombie';
// zombie-loot.json replaced by per-enemy dropTable in enemies.json (v1.9.1)
import structuresData from '../data/structures.json';
import baseLevelsJson from '../data/base-levels.json';
import enemiesData from '../data/enemies.json';
import { getStructureSpriteKey, getBaseSpriteKey } from '../utils/spriteFactory';
import { generateTerrain, drawZoneBackground } from '../systems/TerrainGenerator';
import { PathGrid } from '../systems/PathGrid';
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

/**
 * Lightweight data entry stored in the SpatialBucketGrid.
 * The grid stores these instead of Phaser object references to stay type-safe
 * and avoid retaining destroyed game objects.
 */
interface StructureGridEntry {
  structureType: string;
  x: number;
  y: number;
  active: boolean;
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
  private minimap!: Minimap;
  private gameLog!: GameLog;
  private shootCooldown: number = 0;
  private isShooting: boolean = false;
  private gamePaused: boolean = false;
  private pillboxAssignments: { structure: StructureInstance; refugee: RefugeeInstance; cooldown: number }[] = [];
  private kills: number = 0;
  // Debrief tracking: kills by source
  private trapKills: number = 0;
  private weaponKills: number = 0;
  // Map from trap TYPE (structureId/name) to kill count -- aggregates all instances of same trap type
  private trapKillMap: Map<string, { name: string; kills: number }> = new Map();
  // Count of base breakthrough events (zombie reached base center)
  private breakthroughCount: number = 0;
  // Guard: only count one breakthrough per wave, not once per hit
  private waveBreachCounted: boolean = false;
  // Structures destroyed this night
  private destroyedStructures: Array<{ structureId: string; x: number; y: number }> = [];
  // Ammo snapshot at night start (set after autoLoadAmmo)
  private ammoAtNightStart: number = 0;
  // Boss kills this night
  private bossKillsThisNight: number = 0;
  // Kill source tracking: set to 'trap' or 'weapon' before zombie.takeDamage() resolves as a kill
  private _currentKillSource: 'trap' | 'weapon' | null = null;
  private _currentKillTrapName: string | null = null;
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
  // Tier 1 passive traps (no mechanical systems)
  private _nailBoards: NailBoard[] = [];
  private _tripWires: TripWire[] = [];
  private _glassShards: GlassShards[] = [];
  private _tarPits: TarPit[] = [];
  // TrapBase-derived mechanical traps (have cooldown/overheat/malfunction)
  private _bladeSpinners: BladeSpinner[] = [];
  private _firePits: FirePit[] = [];
  private _propaneGeysers: PropaneGeyser[] = [];
  private _cartWalls: CartWall[] = [];
  private _washingCannons: WashingCannon[] = [];
  private _pitTraps: PitTrap[] = [];
  // Tier 2 mechanical traps
  private _shockWires: ShockWire[] = [];
  private _springLaunchers: SpringLauncher[] = [];
  private _chainWalls: ChainWall[] = [];
  // Tier 2 new mechanical traps (10 traps from trap-catalog.md)
  private _circleSawTraps: CircleSawTrap[] = [];
  private _razorWireCarousels: RazorWireCarousel[] = [];
  private _lawnmowerLanes: LawnmowerLane[] = [];
  private _treadmillsOfDoom: TreadmillOfDoom[] = [];
  private _pendulumAxes: PendulumAxe[] = [];
  private _garageDoorSmashers: GarageDoorSmasher[] = [];
  private _bugZapperXLs: BugZapperXL[] = [];
  private _carBatteryGrids: CarBatteryGrid[] = [];
  private _electricFences: ElectricFence[] = [];
  private _netLaunchers: NetLauncher[] = [];
  // Tier 3 slaughter machines
  private _meatGrinders: MeatGrinder[] = [];
  private _beltSanderGauntlets: BeltSanderGauntlet[] = [];
  private _powerDrillPresses: PowerDrillPress[] = [];
  private _pianoWireWebs: PianoWireWeb[] = [];
  private _combineHarvesters: CombineHarvester[] = [];
  // Tier 3 explosive traps
  private _carBombs: CarBomb[] = [];
  private _napalmSprinklers: NapalmSprinkler[] = [];
  private _gasMainIgniters: GasMainIgniter[] = [];
  private _flamethrowerPosts: FlamethrowerPost[] = [];
  // Tier 2-3 walls and passive blockers (new)
  private _glueFloors: GlueFloor[] = [];
  private _shoppingCartWalls: ShoppingCartWall[] = [];
  private _carWreckBarriers: CarWreckBarrier[] = [];
  private _dumpsterFortresses: DumpsterFortress[] = [];
  // Tier 3 heavy/gravity traps
  private _tractorWheelRollers: TractorWheelRoller[] = [];
  private _wreckingBalls: WreckingBall[] = [];
  private _logAvalanches: LogAvalanche[] = [];
  private _fallingCars: FallingCar[] = [];
  // Tier 3 combo traps
  private _treadmillBlades: TreadmillBlades[] = [];
  private _fanGlasses: FanGlass[] = [];
  private _elevatorShafts: ElevatorShaft[] = [];
  private _rubeGoldbergs: RubeGoldberg[] = [];
  /**
   * Spatial hash grid for zombie-structure proximity checks.
   * Stores direct references to the passive-structure objects so we can call
   * their methods directly after a query without a secondary lookup.
   *
   * Only covers the passive structures handled in the per-zombie loop.
   * Mechanical traps (TrapBase subclasses) remain in their own loops since
   * they already iterate zombies once per trap, not once per zombie.
   *
   * Cell size = 128px (2 tiles). A query radius of 96px covers the current
   * tile plus all immediate neighbours including zone-based traps.
   * Grid is rebuilt once at night start and again whenever a passive structure
   * is destroyed mid-night.
   */
  private structureGrid: SpatialBucketGrid<StructureGridEntry> = new SpatialBucketGrid<StructureGridEntry>(128);

  // Repair interaction state
  private _repairTarget: TrapBase | null = null;
  private _repairProgressBar: Phaser.GameObjects.Graphics | null = null;
  private _repairKey: Phaser.Input.Keyboard.Key | null = null;
  private wallBodies!: Phaser.Physics.Arcade.StaticGroup;
  private fogOfWar!: FogOfWar;
  private fpsText: Phaser.GameObjects.Text | null = null;
  // Visual effects
  private damageOverlay!: Phaser.GameObjects.Graphics;
  private muzzleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bloodEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trapEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  // Shock Wire discharge: blue/white spark particles
  private shockEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  // Nail Board blood: small red burst on hit
  private nailBloodEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
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
  // Last frame delta (ms) -- stored so mechanical trap update can access it outside update()
  private _lastDelta: number = 16;
  // Boss-night atmosphere: red overlay that pulses in intensity over time
  private bossNightOverlay: Phaser.GameObjects.Graphics | null = null;
  private bossNightTime: number = 0; // accumulated time (ms) for pulse calculation
  // Shared PathGrid for zombie steering around walls and barricades
  private pathGrid!: PathGrid;
  // Night weather/events system
  private nightEventManager!: NightEventManager;
  // Rain effect: fire-based trap damage multiplier (1.0 normally, 0.5 when rain is active)
  private _rainFireDamageMultiplier: number = 1.0;

  constructor() {
    super({ key: 'NightScene' });
  }

  create(data?: { hordeMultiplier?: number; fogPenalty?: number }): void {
    this.gameState = SaveManager.load();
    this.kills = 0;
    this.trapKills = 0;
    this.weaponKills = 0;
    this.trapKillMap = new Map();
    this.breakthroughCount = 0;
    this.waveBreachCounted = false;
    this.destroyedStructures = [];
    this.ammoAtNightStart = 0;
    this.bossKillsThisNight = 0;
    this._currentKillSource = null;
    this._currentKillTrapName = null;
    this.shootCooldown = 0;
    this.isShooting = false;
    this.weaponUsedThisNight = new Set();
    // Auto-load ammo: calculated after weaponManager is created (see below)
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

    // F3: Base HP scales with upgrade level
    const baseLvlIdx = Math.min(this.gameState.base.level, baseLevelsJson.baseLevels.length - 1);
    const baseLvlHp = (baseLevelsJson.baseLevels[baseLvlIdx] as { baseHp?: number }).baseHp ?? BASE_MAX_HP;
    // Apply tough_base perk: +50 max HP if unlocked
    const hasToughBase = (this.gameState.meta?.unlockedPerks ?? []).includes('tough_base');
    this.baseMaxHp = baseLvlHp + (hasToughBase ? 50 : 0);
    // Restore full HP each night (base regenerates overnight)
    this.baseHp = this.baseMaxHp;

    this.createTerrain();

    this.createStructures();
    // Build path grid after structures are placed so walls are registered
    this.pathGrid = new PathGrid();
    this.pathGrid.updateFromStructures(this.gameState.base.structures);
    // Also register natural terrain blockers (building ruins / bunkers) so zombies route around them
    this.pathGrid.addNaturalBlockers(this.terrainResult.naturalBlockerRects);
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

    // Auto-equip the two best weapons if the player has not manually equipped.
    // This runs every night so newly found weapons are considered.
    EquipmentPanel.autoEquipIfNeeded(this.gameState, this.weaponManager);

    // Auto-load ammo: calculate ammoPerNight for each equipped ranged weapon,
    // deduct from stockpile, track per-weapon status for warning display.
    this.loadedAmmo = this.autoLoadAmmo();
    // Record ammo at night start for debrief report
    this.ammoAtNightStart = this.loadedAmmo;

    // Set the active weapon to the primary equipped slot so key 1 is correct on start.
    this.syncEquippedSlotToWeaponManager();

    this.soundMechanic = new SoundMechanic(this, this.zombieGroup);
    this.skillManager = new SkillManager(this, this.gameState);
    this.zoneManager = new ZoneManager(this, this.gameState);
    this.achievementManager = new AchievementManager(this, this.gameState);
    this.refugeeManager = new RefugeeManager(this, this.gameState);
    this.setupPillboxRefugees();
    this.hud = new HUD(this);
    this.gameLog = new GameLog(this);
    // Show night number: "Night 3 / 5"
    const nightNumber = this.gameState.progress.currentWave;
    const isEndless = this.gameState.zone === 'endless';
    this.hud.setNight(nightNumber, isEndless ? nightNumber : 5);
    this.hud.updateAmmo(this.loadedAmmo);
    this.updateWeaponHUD();
    // F3: Initialize base HP bar
    this.hud.updateBaseHpBar(this.baseHp, this.baseMaxHp);

    // Minimap -- created after HUD so it sits on top of the HUD container
    this.minimap = new Minimap(this, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

    // Challenge HUD: show active challenge label and (for speed_run) a running timer
    if (this.gameState.activeChallenge) {
      const challengeLabels: Record<string, string> = {
        no_build: 'NO BUILD',
        pacifist: 'PACIFIST',
        speed_run: 'SPEED RUN',
      };
      const challengeLabel = challengeLabels[this.gameState.activeChallenge] ?? 'CHALLENGE';
      const challengeBadge = this.add.text(GAME_WIDTH / 2, 6, challengeLabel, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#C5A030',
        backgroundColor: '#1A0800',
        padding: { left: 4, right: 4, top: 2, bottom: 2 },
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(200);

      // Speed Run timer display -- updates every second
      if (this.gameState.activeChallenge === 'speed_run') {
        const timerText = this.add.text(GAME_WIDTH / 2, 24, '00:00', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color: '#E8DCC8',
          backgroundColor: '#0A0A0A',
          padding: { left: 4, right: 4, top: 2, bottom: 2 },
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(200);

        // Update timer display every 500ms using Phaser time events
        this.time.addEvent({
          delay: 500,
          loop: true,
          callback: () => {
            // Format total milliseconds as MM:SS
            const totalSec = Math.floor(this.gameState.speedRunTimer / 1000);
            const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
            const secs = (totalSec % 60).toString().padStart(2, '0');
            if (timerText.active) {
              timerText.setText(`${mins}:${secs}`);
            }
          },
        });
      }

      // Suppress unused-variable warning for challengeBadge (it is added to scene directly)
      void challengeBadge;
    }

    this.setupWeaponKeys();
    this.setupParticles();
    this.setupLighting();
    this.setupDamageOverlay();

    // Night events: weather, Blood Moon, power outage, bombardment, etc.
    // Created after setupLighting() so event overlays sit above the boss-night overlay.
    this.nightEventManager = new NightEventManager(
      this,
      this.gameState.zone,
      this.gameState.progress.currentWave
    );
    this.setupNightEventHandlers();

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
    // Use zone-specific ambient when available (forest has richer night sounds)
    if (this.gameState.zone === 'forest') {
      AudioManager.startAmbient('forest_night');
    } else {
      AudioManager.startAmbient('night');
    }

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
      this.events.off('zombie-spawned');
      this.events.off('bombardment-explosion');
      this.events.off('night-event-expired');

      this.nightEventManager.destroy();
      this.soundMechanic.destroy();
      this.tweens.killAll();
      this.input.keyboard?.removeAllListeners();
    });
  }

  update(_time: number, delta: number): void {
    if (this.gamePaused) return;
    this._lastDelta = delta;
    // Accumulate boss-night timer for lighting pulse
    if (this.bossNightOverlay) {
      this.bossNightTime += delta;
    }
    // Update weather and night events (visuals + timed expiry)
    this.nightEventManager.update(delta);
    this.player.update(delta);
    this.hud.updateStaminaBar(this.player.stamina, this.player.maxStamina);

    // Safety: if player HP <= 0 but game over hasn't triggered, force it
    if (this.player.hp <= 0 && !this.gameOverShown) {
      this.events.emit('player-died', 'player_killed');
    }

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

    // Shooting: melee = auto-shoot always, ranged = manual (space/click)
    // Pacifist challenge: player cannot shoot or melee -- only traps kill zombies
    this.shootCooldown = Math.max(0, this.shootCooldown - delta);
    if (this.shootCooldown <= 0 && this.gameState.activeChallenge !== 'pacifist') {
      const weapon = this.weaponManager.getEquipped();
      const isMelee = weapon ? this.weaponManager.getWeaponStats(weapon).weaponClass === 'melee' : false;
      if (isMelee || this.isShooting) {
        this.tryAutoShoot();
      }
    }

    // Speed Run challenge: accumulate night-phase time into the persistent timer
    if (this.gameState.activeChallenge === 'speed_run') {
      this.gameState.speedRunTimer += delta;
    }

    // Update live enemy counter in HUD
    const aliveZombies = this.zombieGroup.getChildren().filter(c => (c as Phaser.GameObjects.Sprite).active).length;
    const currentWave = this.waveManager.getCurrentWave();
    const maxWaves = this.waveManager.getMaxWaves();
    this.hud.updateEnemyCount(aliveZombies, currentWave, maxWaves);

    // Update FPS counter
    if (this.fpsText) {
      this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
    }

    // Update minimap -- internal throttle keeps it at 500ms intervals
    this.updateMinimap(delta);
  }

  /**
   * Collect structure positions from game state and pass them to the minimap.
   * The minimap itself throttles to UPDATE_INTERVAL_MS so this is lightweight.
   */
  private updateMinimap(delta: number): void {
    // Build structure point array from game state (world coords).
    // All StructureInstances in game state are considered active (destroyed ones
    // are removed from the array by BuildingManager when they are destroyed).
    const structures: MinimapStructurePoint[] = this.gameState.base.structures
      .map(s => ({ x: s.x, y: s.y, active: true }));

    this.minimap.update(
      this.player.x,
      this.player.y,
      this.zombieGroup as Phaser.GameObjects.Group,
      structures,
      this.baseCenterX,
      this.baseCenterY,
      delta,
    );
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

    // Draw zone-specific background (ground + road/streets + detail patches).
    // drawZoneBackground handles forest, city and military differently.
    drawZoneBackground(this, this.gameState.zone, mapPixelWidth, mapPixelHeight, centerX, centerY, roadRow);

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
    this._nailBoards = [];
    this._tripWires = [];
    this._glassShards = [];
    this._tarPits = [];
    this._bladeSpinners = [];
    this._firePits = [];
    this._propaneGeysers = [];
    this._cartWalls = [];
    this._washingCannons = [];
    this._pitTraps = [];
    this._shockWires = [];
    this._springLaunchers = [];
    this._chainWalls = [];
    this._circleSawTraps = [];
    this._razorWireCarousels = [];
    this._lawnmowerLanes = [];
    this._treadmillsOfDoom = [];
    this._pendulumAxes = [];
    this._garageDoorSmashers = [];
    this._bugZapperXLs = [];
    this._carBatteryGrids = [];
    this._electricFences = [];
    this._netLaunchers = [];
    // Tier 3
    this._meatGrinders = [];
    this._beltSanderGauntlets = [];
    this._powerDrillPresses = [];
    this._pianoWireWebs = [];
    this._combineHarvesters = [];
    this._carBombs = [];
    this._napalmSprinklers = [];
    this._gasMainIgniters = [];
    this._flamethrowerPosts = [];
    this._glueFloors = [];
    this._shoppingCartWalls = [];
    this._carWreckBarriers = [];
    this._dumpsterFortresses = [];
    this._tractorWheelRollers = [];
    this._wreckingBalls = [];
    this._logAvalanches = [];
    this._fallingCars = [];
    this._treadmillBlades = [];
    this._fanGlasses = [];
    this._elevatorShafts = [];
    this._rubeGoldbergs = [];

    const trapDef = structuresData.structures.find(s => s.id === 'trap');
    const defaultTrapDamage = trapDef && 'trapDamage' in trapDef ? (trapDef as { trapDamage: number }).trapDamage : 20;

    // Read new trap definitions from structures.json
    const spikeStripDef  = structuresData.structures.find(s => s.id === 'spike_strip');
    const bearTrapDef    = structuresData.structures.find(s => s.id === 'bear_trap');
    const landmineDef    = structuresData.structures.find(s => s.id === 'landmine');
    const sandbagsDef    = structuresData.structures.find(s => s.id === 'sandbags');
    const oilSlickDef    = structuresData.structures.find(s => s.id === 'oil_slick');
    const nailBoardDef    = structuresData.structures.find(s => s.id === 'nail_board');
    const tripWireDef     = structuresData.structures.find(s => s.id === 'trip_wire');
    const glassShardsdef  = structuresData.structures.find(s => s.id === 'glass_shards');
    const tarPitDef       = structuresData.structures.find(s => s.id === 'tar_pit');
    const bladeSpinnerDef = structuresData.structures.find(s => s.id === 'blade_spinner');
    const firePitDef      = structuresData.structures.find(s => s.id === 'fire_pit');

    /**
     * Return the effective numeric stat for a structure, merging level-specific
     * upgrade overrides from the "upgrades" field in structures.json.
     * If the structure is Lv1 (or has no upgrades entry), the base value is returned.
     */
    function getLeveledStat<T extends Record<string, unknown>>(
      def: T | undefined,
      level: number,
      key: keyof T,
      fallback: number,
    ): number {
      if (!def) return fallback;
      // Try to find an upgrades entry for the current level
      const upgrades = (def as Record<string, unknown>)['upgrades'] as Record<string, Record<string, number>> | undefined;
      if (upgrades && level >= 2) {
        const lvlData = upgrades[level.toString()];
        if (lvlData && key in lvlData) return lvlData[key as string] as number;
      }
      // Fall back to base value
      const base = def[key];
      return typeof base === 'number' ? base : fallback;
    }

    const noFuelTraps: string[] = [];

    for (const structure of this.gameState.base.structures) {
      console.log(`[NightScene] createStructures: ${structure.structureId} at (${structure.x}, ${structure.y})`);
      try {
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
        case 'blade_spinner': {
          // Build level-based overrides (Lv2: 35 dmg/3s cd, Lv3: 50 dmg/2s cd/-50% overheat)
          const bsOverrides: BladeSpinnerOverrides = {
            trapDamage:  getLeveledStat(bladeSpinnerDef, structure.level, 'trapDamage',  25),
            cooldownMs:  getLeveledStat(bladeSpinnerDef, structure.level, 'cooldownMs',  4000),
            overheatMax: getLeveledStat(bladeSpinnerDef, structure.level, 'overheatMax', 30000),
          };
          const spinner = new BladeSpinner(this, structure, bsOverrides);
          // Roll malfunction at night start
          if (Math.random() < spinner.malfunctionChance) {
            spinner.malfunctioned = true;
          }
          // Deduct fuel: 1 food
          if (!spinner.malfunctioned && spinner.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: spinner.fuelPerNight })) {
              this.resourceManager.spend('food', spinner.fuelPerNight);
            } else {
              spinner.malfunctioned = true;
              noFuelTraps.push('Blade Spinner');
            }
          }
          this._bladeSpinners.push(spinner);
          break;
        }
        case 'fire_pit': {
          // Build level-based overrides (Lv2: 25 dmg/s, Lv3: 35 dmg/s)
          const fpOverrides: FirePitOverrides = {
            damagePerSecond: getLeveledStat(firePitDef, structure.level, 'trapDamage', 15),
          };
          const pit = new FirePit(this, structure, fpOverrides);
          if (Math.random() < pit.malfunctionChance) {
            pit.malfunctioned = true;
          }
          if (!pit.malfunctioned && pit.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: pit.fuelPerNight })) {
              this.resourceManager.spend('food', pit.fuelPerNight);
            } else {
              pit.malfunctioned = true;
              noFuelTraps.push('Fire Pit');
            }
          }
          this._firePits.push(pit);
          break;
        }
        case 'propane_geyser': {
          const geyser = new PropaneGeyser(this, structure);
          if (Math.random() < geyser.malfunctionChance) {
            geyser.malfunctioned = true;
          }
          this._propaneGeysers.push(geyser);
          break;
        }
        case 'cart_wall': {
          // Cart Wall is a passive blocker -- add physics body like Wall
          const cw = new CartWall(this, structure);
          this._cartWalls.push(cw);
          const cwBody = this.wallBodies.create(
            structure.x + TILE_SIZE / 2,
            structure.y + TILE_SIZE / 2,
            '',
          ) as Phaser.Physics.Arcade.Sprite;
          cwBody.setDisplaySize(TILE_SIZE, TILE_SIZE);
          cwBody.setVisible(false);
          cwBody.refreshBody();
          cwBody.setData('cartWallRef', cw);
          break;
        }
        case 'washing_cannon': {
          const cannon = new WashingCannon(this, structure);
          if (Math.random() < cannon.malfunctionChance) {
            cannon.malfunctioned = true;
          }
          this._washingCannons.push(cannon);
          break;
        }
        case 'pit_trap': {
          const pt = new PitTrap(this, structure);
          if (Math.random() < pt.malfunctionChance) {
            pt.malfunctioned = true;
          }
          this._pitTraps.push(pt);
          break;
        }
        case 'nail_board': {
          // Apply level-based stat bonuses (Lv2: 15 dmg / 25 uses, Lv3: 20 dmg / 35 uses)
          const dmg   = getLeveledStat(nailBoardDef, structure.level, 'trapDamage', 10);
          const crip  = (nailBoardDef as { crippleDuration?: number } | undefined)?.crippleDuration ?? 2000;
          const uses  = getLeveledStat(nailBoardDef, structure.level, 'trapDurability', 20);
          const nb    = new NailBoard(this, structure, dmg, crip, uses);
          this._nailBoards.push(nb);
          break;
        }
        case 'trip_wire': {
          const stun  = (tripWireDef as { stunDuration?: number } | undefined)?.stunDuration ?? 1500;
          const uses  = (tripWireDef as { trapDurability?: number } | undefined)?.trapDurability ?? 15;
          const tw    = new TripWire(this, structure, stun, uses);
          this._tripWires.push(tw);
          break;
        }
        case 'glass_shards': {
          const dps   = (glassShardsdef as { damagePerSecond?: number } | undefined)?.damagePerSecond ?? 5;
          const gs    = new GlassShards(this, structure, dps);
          this._glassShards.push(gs);
          break;
        }
        case 'tar_pit': {
          const slow  = (tarPitDef as { slowFactor?: number } | undefined)?.slowFactor ?? 0.2;
          const width = (tarPitDef as { widthTiles?: number } | undefined)?.widthTiles ?? 3;
          const tp    = new TarPit(this, structure, slow, width);
          this._tarPits.push(tp);
          break;
        }
        case 'shock_wire': {
          const sw = new ShockWire(this, structure);
          if (Math.random() < sw.malfunctionChance) {
            sw.malfunctioned = true;
          }
          this._shockWires.push(sw);
          break;
        }
        case 'spring_launcher': {
          const sl = new SpringLauncher(this, structure);
          if (Math.random() < sl.malfunctionChance) {
            sl.malfunctioned = true;
          }
          this._springLaunchers.push(sl);
          break;
        }
        case 'chain_wall': {
          // Chain Wall blocks zombies (physics collider) and deals contact damage
          const cwall = new ChainWall(this, structure);
          if (Math.random() < cwall.malfunctionChance) {
            cwall.malfunctioned = true;
          }
          this._chainWalls.push(cwall);
          // Add physics body so zombies are blocked (same pattern as Wall/CartWall)
          const cwallBody = this.wallBodies.create(
            structure.x + TILE_SIZE / 2,
            structure.y + TILE_SIZE / 2,
            '',
          ) as Phaser.Physics.Arcade.Sprite;
          cwallBody.setDisplaySize(TILE_SIZE, TILE_SIZE);
          cwallBody.setVisible(false);
          cwallBody.refreshBody();
          cwallBody.setData('chainWallRef', cwall);
          break;
        }
        case 'circle_saw_trap': {
          const cst = new CircleSawTrap(this, structure);
          if (Math.random() < cst.malfunctionChance) cst.malfunctioned = true;
          if (!cst.malfunctioned && cst.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: cst.fuelPerNight })) {
              this.resourceManager.spend('food', cst.fuelPerNight);
            } else {
              cst.malfunctioned = true;
              noFuelTraps.push('Circle Saw Trap');
            }
          }
          this._circleSawTraps.push(cst);
          break;
        }
        case 'razor_wire_carousel': {
          const rwc = new RazorWireCarousel(this, structure);
          if (Math.random() < rwc.malfunctionChance) rwc.malfunctioned = true;
          if (!rwc.malfunctioned && rwc.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: rwc.fuelPerNight })) {
              this.resourceManager.spend('food', rwc.fuelPerNight);
            } else {
              rwc.malfunctioned = true;
              noFuelTraps.push('Razor Wire Carousel');
            }
          }
          this._razorWireCarousels.push(rwc);
          break;
        }
        case 'lawnmower_lane': {
          const ll = new LawnmowerLane(this, structure);
          if (Math.random() < ll.malfunctionChance) ll.malfunctioned = true;
          if (!ll.malfunctioned && ll.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: ll.fuelPerNight })) {
              this.resourceManager.spend('food', ll.fuelPerNight);
            } else {
              ll.malfunctioned = true;
              noFuelTraps.push('Lawnmower Lane');
            }
          }
          this._lawnmowerLanes.push(ll);
          break;
        }
        case 'treadmill_of_doom': {
          const tod = new TreadmillOfDoom(this, structure);
          if (Math.random() < tod.malfunctionChance) tod.malfunctioned = true;
          if (!tod.malfunctioned && tod.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: tod.fuelPerNight })) {
              this.resourceManager.spend('food', tod.fuelPerNight);
            } else {
              tod.malfunctioned = true;
              noFuelTraps.push('Treadmill of Doom');
            }
          }
          this._treadmillsOfDoom.push(tod);
          break;
        }
        case 'pendulum_axe': {
          const pa = new PendulumAxe(this, structure);
          if (Math.random() < pa.malfunctionChance) pa.malfunctioned = true;
          this._pendulumAxes.push(pa);
          break;
        }
        case 'garage_door_smasher': {
          const gds = new GarageDoorSmasher(this, structure);
          if (Math.random() < gds.malfunctionChance) gds.malfunctioned = true;
          if (!gds.malfunctioned && gds.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: gds.fuelPerNight })) {
              this.resourceManager.spend('food', gds.fuelPerNight);
            } else {
              gds.malfunctioned = true;
              noFuelTraps.push('Garage Door Smasher');
            }
          }
          this._garageDoorSmashers.push(gds);
          break;
        }
        case 'bug_zapper_xl': {
          const bz = new BugZapperXL(this, structure);
          if (Math.random() < bz.malfunctionChance) bz.malfunctioned = true;
          if (!bz.malfunctioned && bz.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: bz.fuelPerNight })) {
              this.resourceManager.spend('food', bz.fuelPerNight);
            } else {
              bz.malfunctioned = true;
              noFuelTraps.push('Bug Zapper XL');
            }
          }
          this._bugZapperXLs.push(bz);
          break;
        }
        case 'car_battery_grid': {
          const cbg = new CarBatteryGrid(this, structure);
          if (Math.random() < cbg.malfunctionChance) cbg.malfunctioned = true;
          this._carBatteryGrids.push(cbg);
          break;
        }
        case 'electric_fence': {
          const ef = new ElectricFence(this, structure);
          if (Math.random() < ef.malfunctionChance) ef.malfunctioned = true;
          if (!ef.malfunctioned && ef.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: ef.fuelPerNight })) {
              this.resourceManager.spend('food', ef.fuelPerNight);
            } else {
              ef.malfunctioned = true;
              noFuelTraps.push('Electric Fence');
            }
          }
          this._electricFences.push(ef);
          // Add physics body so zombies are blocked (same pattern as ChainWall)
          const efBody = this.wallBodies.create(
            structure.x + TILE_SIZE / 2,
            structure.y + TILE_SIZE / 2,
            '',
          ) as Phaser.Physics.Arcade.Sprite;
          efBody.setDisplaySize(TILE_SIZE, TILE_SIZE);
          efBody.setVisible(false);
          efBody.refreshBody();
          efBody.setData('electricFenceRef', ef);
          break;
        }
        case 'net_launcher': {
          const nl = new NetLauncher(this, structure);
          if (Math.random() < nl.malfunctionChance) nl.malfunctioned = true;
          this._netLaunchers.push(nl);
          break;
        }
        // -----------------------------------------------------------------------
        // Tier 3: Slaughter Machines
        // -----------------------------------------------------------------------
        case 'meat_grinder': {
          const mg = new MeatGrinder(this, structure);
          if (Math.random() < mg.malfunctionChance) {
            mg.malfunctioned = true;
          }
          if (!mg.malfunctioned && mg.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: mg.fuelPerNight })) {
              this.resourceManager.spend('food', mg.fuelPerNight);
            } else {
              mg.malfunctioned = true;
              noFuelTraps.push('Meat Grinder');
            }
          }
          this._meatGrinders.push(mg);
          break;
        }
        case 'belt_sander_gauntlet': {
          const bsg = new BeltSanderGauntlet(this, structure);
          if (Math.random() < bsg.malfunctionChance) {
            bsg.malfunctioned = true;
          }
          this._beltSanderGauntlets.push(bsg);
          break;
        }
        case 'power_drill_press': {
          const pdp = new PowerDrillPress(this, structure);
          if (Math.random() < pdp.malfunctionChance) {
            pdp.malfunctioned = true;
          }
          this._powerDrillPresses.push(pdp);
          break;
        }
        case 'piano_wire_web': {
          const pww = new PianoWireWeb(this, structure);
          if (Math.random() < pww.malfunctionChance) {
            pww.malfunctioned = true;
          }
          this._pianoWireWebs.push(pww);
          break;
        }
        case 'combine_harvester': {
          const ch = new CombineHarvester(this, structure);
          if (Math.random() < ch.malfunctionChance) {
            ch.malfunctioned = true;
          }
          if (!ch.malfunctioned && ch.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: ch.fuelPerNight })) {
              this.resourceManager.spend('food', ch.fuelPerNight);
            } else {
              ch.malfunctioned = true;
              noFuelTraps.push('Combine Harvester');
            }
          }
          this._combineHarvesters.push(ch);
          break;
        }
        // -----------------------------------------------------------------------
        // Tier 3: Explosive Traps
        // -----------------------------------------------------------------------
        case 'car_bomb': {
          const cb = new CarBomb(this, structure);
          if (Math.random() < cb.malfunctionChance) {
            cb.malfunctioned = true;
          }
          this._carBombs.push(cb);
          break;
        }
        case 'napalm_sprinkler': {
          const ns = new NapalmSprinkler(this, structure);
          if (Math.random() < ns.malfunctionChance) {
            ns.malfunctioned = true;
          }
          if (!ns.malfunctioned && ns.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: ns.fuelPerNight })) {
              this.resourceManager.spend('food', ns.fuelPerNight);
            } else {
              ns.malfunctioned = true;
              noFuelTraps.push('Napalm Sprinkler');
            }
          }
          this._napalmSprinklers.push(ns);
          break;
        }
        case 'gas_main_igniter': {
          const gmi = new GasMainIgniter(this, structure);
          if (Math.random() < gmi.malfunctionChance) {
            gmi.malfunctioned = true;
          }
          this._gasMainIgniters.push(gmi);
          break;
        }
        case 'flamethrower_post': {
          const fp = new FlamethrowerPost(this, structure);
          if (Math.random() < fp.malfunctionChance) {
            fp.malfunctioned = true;
          }
          if (!fp.malfunctioned && fp.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: fp.fuelPerNight })) {
              this.resourceManager.spend('food', fp.fuelPerNight);
            } else {
              fp.malfunctioned = true;
              noFuelTraps.push('Flamethrower Post');
            }
          }
          this._flamethrowerPosts.push(fp);
          break;
        }
        // --- Tier 2-3 passive blockers ---
        case 'glue_floor': {
          const glueDef = structuresData.structures.find(s => s.id === 'glue_floor');
          const slowFactor = (glueDef as { slowFactor?: number } | undefined)?.slowFactor ?? 0.10;
          const widthTiles = (glueDef as { widthTiles?: number } | undefined)?.widthTiles ?? 3;
          const gf = new GlueFloor(this, structure, slowFactor, widthTiles);
          this._glueFloors.push(gf);
          break;
        }
        case 'shopping_cart_wall': {
          const scw = new ShoppingCartWall(this, structure);
          this._shoppingCartWalls.push(scw);
          const scwBody = this.wallBodies.create(
            structure.x + TILE_SIZE / 2,
            structure.y + TILE_SIZE / 2,
            '',
          ) as Phaser.Physics.Arcade.Sprite;
          scwBody.setDisplaySize(TILE_SIZE, TILE_SIZE);
          scwBody.setVisible(false);
          scwBody.refreshBody();
          scwBody.setData('shoppingCartWallRef', scw);
          break;
        }
        case 'car_wreck_barrier': {
          const cwb = new CarWreckBarrier(this, structure);
          this._carWreckBarriers.push(cwb);
          const cwbBody = this.wallBodies.create(
            structure.x + TILE_SIZE / 2,
            structure.y + TILE_SIZE / 2,
            '',
          ) as Phaser.Physics.Arcade.Sprite;
          cwbBody.setDisplaySize(TILE_SIZE, TILE_SIZE);
          cwbBody.setVisible(false);
          cwbBody.refreshBody();
          cwbBody.setData('carWreckBarrierRef', cwb);
          break;
        }
        case 'dumpster_fortress': {
          const df = new DumpsterFortress(this, structure);
          this._dumpsterFortresses.push(df);
          const dfBody = this.wallBodies.create(
            structure.x + TILE_SIZE / 2,
            structure.y + TILE_SIZE / 2,
            '',
          ) as Phaser.Physics.Arcade.Sprite;
          dfBody.setDisplaySize(TILE_SIZE, TILE_SIZE);
          dfBody.setVisible(false);
          dfBody.refreshBody();
          dfBody.setData('dumpsterFortressRef', df);
          break;
        }
        // --- Tier 3 heavy/gravity traps ---
        case 'tractor_wheel_roller': {
          const twr = new TractorWheelRoller(this, structure);
          if (Math.random() < twr.malfunctionChance) twr.malfunctioned = true;
          this._tractorWheelRollers.push(twr);
          break;
        }
        case 'wrecking_ball': {
          const wb = new WreckingBall(this, structure);
          if (Math.random() < wb.malfunctionChance) wb.malfunctioned = true;
          this._wreckingBalls.push(wb);
          break;
        }
        case 'log_avalanche': {
          const la = new LogAvalanche(this, structure);
          if (Math.random() < la.malfunctionChance) la.malfunctioned = true;
          this._logAvalanches.push(la);
          break;
        }
        case 'falling_car': {
          const fc = new FallingCar(this, structure);
          if (Math.random() < fc.malfunctionChance) fc.malfunctioned = true;
          this._fallingCars.push(fc);
          break;
        }
        // --- Tier 3 combo traps ---
        case 'treadmill_blades': {
          const tb = new TreadmillBlades(this, structure);
          if (Math.random() < tb.malfunctionChance) tb.malfunctioned = true;
          if (!tb.malfunctioned && tb.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: tb.fuelPerNight })) {
              this.resourceManager.spend('food', tb.fuelPerNight);
            } else {
              tb.malfunctioned = true;
              noFuelTraps.push('Treadmill Blades');
            }
          }
          this._treadmillBlades.push(tb);
          break;
        }
        case 'fan_glass': {
          const fg = new FanGlass(this, structure);
          if (Math.random() < fg.malfunctionChance) fg.malfunctioned = true;
          this._fanGlasses.push(fg);
          break;
        }
        case 'elevator_shaft': {
          const es = new ElevatorShaft(this, structure);
          if (Math.random() < es.malfunctionChance) es.malfunctioned = true;
          this._elevatorShafts.push(es);
          break;
        }
        case 'rube_goldberg': {
          const rg = new RubeGoldberg(this, structure);
          if (Math.random() < rg.malfunctionChance) rg.malfunctioned = true;
          if (!rg.malfunctioned && rg.fuelPerNight > 0) {
            if (this.resourceManager.canAfford({ food: rg.fuelPerNight })) {
              this.resourceManager.spend('food', rg.fuelPerNight);
            } else {
              rg.malfunctioned = true;
              noFuelTraps.push('Rube Goldberg');
            }
          }
          // Wire up chain-step callback: each step deals AOE damage to nearby zombies
          rg.onChainStep = (stepIndex: number, radius: number, damage: number) => {
            const cx = rg.structureInstance.x + TILE_SIZE / 2;
            const cy = rg.structureInstance.y + TILE_SIZE / 2;
            const rSq = radius * radius;
            this.zombieGroup.getChildren().forEach(child => {
              const z = child as import('../entities/Zombie').Zombie;
              if (!z.active) return;
              const dx = z.x - cx;
              const dy = z.y - cy;
              if (dx * dx + dy * dy <= rSq) {
                z.takeDamage(damage);
              }
            });
            // Visual: emit particles at each step with escalating intensity
            this.trapEmitter.emitParticleAt(cx, cy, (stepIndex + 1) * 6);
          };
          this._rubeGoldbergs.push(rg);
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
      } catch (err) {
        console.error(`[NightScene] Failed to create structure ${structure.structureId}:`, err);
      }
    }

    // Warn player about traps that couldn't start due to lack of fuel (food)
    if (noFuelTraps.length > 0) {
      const unique = [...new Set(noFuelTraps)];
      this.time.delayedCall(500, () => {
        if (this.hud) this.hud.showMessage(`No fuel: ${unique.join(', ')} offline!`);
        if (this.gameLog) this.gameLog.addMessage(`No fuel: ${unique.join(', ')} offline!`, '#FF8C00');
      });
    }

    // Build the spatial grid once all structures are placed.
    this._rebuildStructureGrid();
  }

  /**
   * Rebuild the spatial hash grid from all currently active structure arrays.
   * Called once at the end of createStructures() and again when a structure is
   * destroyed mid-night so the grid stays consistent.
   * Stores lightweight StructureGridEntry data (type + position) -- NOT Phaser
   * object references -- so the grid remains type-safe and avoids retaining
   * destroyed objects.
   */
  private _rebuildStructureGrid(): void {
    this.structureGrid.clear();

    // Helper: insert tile-based structures as StructureGridEntry data objects.
    const insertTile = <S extends { structureInstance: StructureInstance; active: boolean }>(
      arr: S[],
      structureType: string,
    ): void => {
      for (const s of arr) {
        if (!s.active) continue;
        const si = s.structureInstance;
        this.structureGrid.insert(si.x + TILE_SIZE / 2, si.y + TILE_SIZE / 2, {
          structureType,
          x: si.x,
          y: si.y,
          active: true,
        });
      }
    };

    // Tile-based passive structures (structureInstance.x/y = top-left of tile)
    insertTile(this.barricades, 'barricade');
    insertTile(this._sandbags, 'sandbags');
    insertTile(this.traps, 'trap');
    insertTile(this._spikeStrips, 'spike_strip');
    insertTile(this._bearTraps, 'bear_trap');
    insertTile(this._landmines, 'landmine');
    insertTile(this._nailBoards, 'nail_board');
    insertTile(this._tripWires, 'trip_wire');

    // Zone-based structures (GlassShards, TarPit, OilSlick, GlueFloor): their
    // interaction zone extends beyond one tile. We insert at the tile centre;
    // the 96px query radius in checkZombieStructureInteractions() covers the zone.
    for (const s of this._glassShards) {
      if (!s.isAlive()) continue;
      const si = s.structureInstance;
      this.structureGrid.insert(si.x + TILE_SIZE / 2, si.y + TILE_SIZE / 2,
        { structureType: 'glass_shards', x: si.x, y: si.y, active: true });
    }
    for (const s of this._tarPits) {
      if (!s.isAlive()) continue;
      const si = s.structureInstance;
      this.structureGrid.insert(si.x + TILE_SIZE / 2, si.y + TILE_SIZE / 2,
        { structureType: 'tar_pit', x: si.x, y: si.y, active: true });
    }
    for (const s of this._oilSlicks) {
      if (!s.active) continue;
      const si = s.structureInstance;
      this.structureGrid.insert(si.x + TILE_SIZE / 2, si.y + TILE_SIZE / 2,
        { structureType: 'oil_slick', x: si.x, y: si.y, active: true });
    }
    for (const s of this._glueFloors) {
      if (!s.isAlive()) continue;
      const si = s.structureInstance;
      this.structureGrid.insert(si.x + TILE_SIZE / 2, si.y + TILE_SIZE / 2,
        { structureType: 'glue_floor', x: si.x, y: si.y, active: true });
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
    // Endless mode always uses 5 waves (difficulty comes from per-night HP/speed scaling).
    // gameState.progress.currentWave is the night number (1-indexed)
    const nightNumber = this.gameState.progress.currentWave;
    const totalWaves = this.gameState.zone === 'endless'
      ? 5
      : Math.min(Math.max(nightNumber, 1), 5);
    this.waveManager.setMaxWaves(totalWaves);

    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;

    // Zombies walk toward base by default, only aggro player via sound
    this.waveManager.setBasePosition(mapPixelWidth / 2, mapPixelHeight / 2);

    // Pass map dimensions to waveManager for wanderer boundary calculations
    this.waveManager.setMapSize(mapPixelWidth, mapPixelHeight);

    // Provide PathGrid so spawned zombies can steer around walls
    this.waveManager.setPathGrid(this.pathGrid);

    // Pass the current zone so spawned zombies receive zone tints
    this.waveManager.setZone(this.gameState.zone);

    // Endless mode: scale enemies per night number (+15% count, +10% HP, +5% speed per night)
    if (this.gameState.zone === 'endless') {
      const endlessNight = this.gameState.endlessNight ?? 0;
      const countScale = 1.0 + endlessNight * 0.15;
      const hpScale = 1.0 + endlessNight * 0.10;
      const speedScale = 1.0 + endlessNight * 0.05;
      this.waveManager.setHordeMultiplier(countScale);
      this.waveManager.setEndlessScaling(hpScale, speedScale);
    }

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

        // Piercing Shot ultimate: projectile passes through ONE zombie then deactivates
        // Also handles the legacy specialEffect piercing type (silenced_pistol etc.)
        const isSpecialPiercing = proj.specialEffect?.type === 'piercing';
        const isUltimatePiercing = proj.piercing;

        if (isUltimatePiercing) {
          // Allow pass-through once; deactivate after the second hit
          proj.piercingHitCount++;
          if (proj.piercingHitCount > 1) {
            proj.deactivate();
          }
          // Do not deactivate on first hit
        } else if (!isSpecialPiercing) {
          proj.deactivate();
        }

        // Apply on-hit ranged effects that require a zombie target (knockback, incendiary)
        if (proj.specialEffect && zombie.active) {
          this.applyRangedSpecialEffect(zombie, proj, proj.specialEffect);
        }

        // Apply ultimate on-hit effects (phosphor burn, explosive_impact handled via specialEffect tag)
        if (proj.ultimateType && zombie.active) {
          this.applyRangedUltimateEffect(zombie, proj.ultimateType);
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
              // Debrief: record structure destruction
              this.destroyedStructures.push({
                structureId: wallRef.structureInstance.structureId,
                x: wallRef.structureInstance.x,
                y: wallRef.structureInstance.y,
              });
              wallBody.destroy();
            } else {
              // F4: Structure creak/crack on damage
              AudioManager.play('structure_damage');
            }
          }

          // Chain Wall: deal contact damage and play chain rattle sound
          const chainWallData = wallBody.getData('chainWallRef');
          const chainWallRef = chainWallData instanceof ChainWall ? chainWallData : undefined;
          if (chainWallRef) {
            chainWallRef.onZombieContact(zombie);
            // Chain rattle on contact (throttled by 300ms cooldown in AudioManager)
            AudioManager.play('trap_chain_wall');
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

  /**
   * Wire up gameplay effects driven by NightEventManager.
   *
   * Blood Moon:  each spawned zombie gets +25% speed and +25% HP.
   * Power Outage: electric traps are disabled (checked in updateMechanicalTraps via hasEvent).
   * Bombardment: damage zombies and structures in the explosion radius.
   * Storm:       structure damage is applied once at night start (see applyStormDamage).
   */
  private setupNightEventHandlers(): void {
    // Blood Moon -- apply stat multipliers to every zombie as it spawns
    if (this.nightEventManager.hasEvent('blood_moon')) {
      this.events.on('zombie-spawned', (zombie: Zombie) => {
        if (!zombie.active) return;
        zombie.hp = Math.round(zombie.hp * BLOOD_MOON_HP_MULTIPLIER);
        zombie.maxHp = Math.round(zombie.maxHp * BLOOD_MOON_HP_MULTIPLIER);
        zombie.moveSpeed = zombie.moveSpeed * BLOOD_MOON_SPEED_MULTIPLIER;
      });
    }

    // Rain -- increase malfunction chance for all mechanical traps and tag fire-trap damage reduction
    if (this.nightEventManager.hasEvent('rain')) {
      this.applyRainEffectsToTraps();
    }

    // Storm -- deal damage to random structures once at the very start of the night
    if (this.nightEventManager.hasEvent('storm')) {
      this.applyStormDamage();
    }

    // Bombardment -- apply explosion damage to zombies and structures in radius
    this.events.on('bombardment-explosion', (payload: { x: number; y: number; radius: number; damage: number }) => {
      this.applyBombardmentDamage(payload.x, payload.y, payload.radius, payload.damage);
    });
  }

  /**
   * Rain effect on traps: increase malfunction chance for ALL mechanical traps,
   * and reduce fire-based trap effectiveness.
   * Called once at night start when rain is active.
   */
  private applyRainEffectsToTraps(): void {
    // All TrapBase-derived mechanical traps get +10% malfunction chance (RAIN_MALFUNCTION_BONUS).
    // CartWall, ShoppingCartWall, CarWreckBarrier, DumpsterFortress extend Graphics (not TrapBase)
    // and have no malfunctionChance -- they are intentionally excluded.
    const allMechanical = [
      ...this._bladeSpinners, ...this._firePits, ...this._propaneGeysers,
      ...this._washingCannons, ...this._pitTraps,
      ...this._shockWires, ...this._springLaunchers, ...this._chainWalls,
      ...this._circleSawTraps, ...this._razorWireCarousels, ...this._lawnmowerLanes,
      ...this._treadmillsOfDoom, ...this._pendulumAxes, ...this._garageDoorSmashers,
      ...this._bugZapperXLs, ...this._carBatteryGrids, ...this._electricFences,
      ...this._netLaunchers, ...this._meatGrinders, ...this._beltSanderGauntlets,
      ...this._powerDrillPresses, ...this._pianoWireWebs, ...this._combineHarvesters,
      ...this._carBombs, ...this._napalmSprinklers, ...this._gasMainIgniters,
      ...this._flamethrowerPosts, ...this._treadmillBlades, ...this._fanGlasses,
      ...this._elevatorShafts, ...this._rubeGoldbergs,
    ];

    for (const trap of allMechanical) {
      trap.malfunctionChance = Math.min(1, trap.malfunctionChance + RAIN_MALFUNCTION_BONUS);
      // Roll malfunction for traps that haven't malfunctioned yet (wet start)
      if (!trap.malfunctioned && Math.random() < RAIN_MALFUNCTION_BONUS) {
        trap.malfunctioned = true;
      }
    }

    // Mark fire-trap damage as reduced for this night.
    // _rainFireDamageMultiplier is read in the fire-trap damage sections of updateMechanicalTraps.
    this._rainFireDamageMultiplier = RAIN_FIRE_DAMAGE_MULTIPLIER;
  }

  /**
   * Storm start effect: 2 random structures take damage.
   * Called once when storm event is active.
   */
  private applyStormDamage(): void {
    const STORM_COUNT = 2;
    const STORM_DAMAGE = 15;

    const structs = this.gameState.base.structures.filter(s => s.hp > 0);
    if (structs.length === 0) return;

    // Shuffle and take first STORM_COUNT
    const shuffled = [...structs].sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, Math.min(STORM_COUNT, shuffled.length));

    for (const s of targets) {
      s.hp = Math.max(0, s.hp - STORM_DAMAGE);
    }

    // Notify the game log after a short delay (so the banner is already shown)
    this.time.delayedCall(3500, () => {
      this.gameLog?.addMessage('Storm damaged structures!', '#FFAA44');
    });
  }

  /**
   * Bombardment explosion: damages all active zombies and structures within radius.
   * @param worldX  World X position of the explosion center.
   * @param worldY  World Y position of the explosion center.
   * @param radius  Damage radius in pixels.
   * @param damage  HP damage to apply.
   */
  private applyBombardmentDamage(worldX: number, worldY: number, radius: number, damage: number): void {
    const r2 = radius * radius;

    // Damage active zombies in radius
    this.zombieGroup.getChildren().forEach(child => {
      const zombie = child as Zombie;
      if (!zombie.active) return;
      const dx = zombie.x - worldX;
      const dy = zombie.y - worldY;
      if (dx * dx + dy * dy <= r2) {
        zombie.takeDamage(damage);
      }
    });

    // Damage structures in radius
    for (const s of this.gameState.base.structures) {
      const dx = s.x - worldX;
      const dy = s.y - worldY;
      if (dx * dx + dy * dy <= r2) {
        s.hp = Math.max(0, s.hp - damage);
      }
    }
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

      // Debrief: attribute kill to source (trap or weapon)
      if (this._currentKillSource === 'trap') {
        this.trapKills++;
        if (this._currentKillTrapName) {
          // Key by trap TYPE name so all instances of the same trap aggregate together
          // e.g. 3x "Glass Shards" traps produce one "Glass Shards -- 10 kills" entry
          const typeKey = this._currentKillTrapName;
          const existingEntry = this.trapKillMap.get(typeKey);
          if (existingEntry) {
            existingEntry.kills++;
          } else {
            this.trapKillMap.set(typeKey, { name: this._currentKillTrapName, kills: 1 });
          }
        }
      } else if (this._currentKillSource === null) {
        // Kill source was not set -- default to weapon attribution
        console.warn('[NightScene] zombie-killed fired with null _currentKillSource, defaulting to weapon kill');
        this.weaponKills++;
      } else {
        this.weaponKills++;
      }
      this._currentKillSource = null;
      this._currentKillTrapName = null;

      // Track boss kills for LP rewards
      if (zombie.behavior === 'boss') {
        this.bossKillsThisNight++;
      }

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
      // Reset per-wave breach guard so the next wave can register a new breakthrough
      this.waveBreachCounted = false;
      this.hud.updateWave(wave, this.waveManager.getMaxWaves());
      const maxWaves = this.waveManager.getMaxWaves();
      // Final night: wave 5 in a 5-wave night gets a special banner
      if (wave === 5 && maxWaves === 5) {
        this.showFinalNightBanner();
        this.gameLog.addMessage('FINAL WAVE -- survive!', '#FF4444');
      } else {
        this.hud.showWaveAnnouncement(wave);
        this.gameLog.addMessage(`Wave ${wave} started`, '#FFD700');
      }
      AudioManager.play('wave_start');
    });

    this.events.on('wave-complete', (wave: number) => {
      this.hud.showMessage('WAVE CLEAR!');
      this.gameLog.addMessage(`Wave ${wave} cleared!`, '#44FF88');
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
      // Return unused loaded ammo back to the inventory stockpile before saving
      this.gameState.inventory.resources.ammo += Math.max(0, this.loadedAmmo);
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

      // Check if the player just completed the final wave (wave 5) in the current zone.
      // Night number before increment was currentWave - 1. The final night is night 5.
      const completedNight = this.gameState.progress.currentWave - 1;
      const currentZone = this.gameState.zone;

      // --- Endless mode: award 100 LP per endless night, update high score ---
      if (currentZone === 'endless') {
        this.gameState.endlessNight++;
        if (this.gameState.endlessNight > this.gameState.endlessHighScore) {
          this.gameState.endlessHighScore = this.gameState.endlessNight;
        }
        // Award Legacy Points: 100 LP per endless night + 25 LP per boss kill
        const lpEarned = 100 + this.bossKillsThisNight * 25;
        this.gameState.meta.legacyPoints += lpEarned;
        const nightStats = this.buildNightStats(true);
        SaveManager.save(this.gameState);
        AudioManager.stopAmbient();
        this.scene.start('ResultScene', nightStats);
        return;
      }

      // --- Award Legacy Points for normal nights: 10 LP per survived night, 25 per boss kill ---
      const lpNight = 10 + this.bossKillsThisNight * 25;
      this.gameState.meta.legacyPoints += lpNight;

      if (completedNight >= 5) {
        // Record zone clear in zoneProgress
        const existing = this.gameState.zoneProgress[currentZone];
        if (!existing || existing.highestWaveCleared < 5) {
          this.gameState.zoneProgress[currentZone] = { highestWaveCleared: 5 };
        }
        // Award extra 50 LP for clearing a full zone
        this.gameState.meta.legacyPoints += 50;

        // --- Challenge completion: award bonus LP and record the completion ---
        let challengeBonus = 0;
        let challengeId: string | null = null;
        const activeChallenge = this.gameState.activeChallenge;
        if (activeChallenge) {
          // Speed Run bonus is tier-based on total time
          if (activeChallenge === 'speed_run') {
            const totalMin = this.gameState.speedRunTimer / 60000;
            if (totalMin < 10) {
              challengeBonus = 500;
            } else if (totalMin < 15) {
              challengeBonus = 300;
            } else if (totalMin < 20) {
              challengeBonus = 100;
            }
          } else if (activeChallenge === 'no_build') {
            challengeBonus = 200;
          } else if (activeChallenge === 'pacifist') {
            challengeBonus = 300;
          }

          if (challengeBonus > 0) {
            this.gameState.meta.legacyPoints += challengeBonus;
          }

          // Record challenge as completed (once per challenge id, no duplicates)
          if (!this.gameState.challengeCompletions.includes(activeChallenge)) {
            this.gameState.challengeCompletions.push(activeChallenge);
          }
          challengeId = activeChallenge;

          // Clear the active challenge so the next run starts normally
          this.gameState.activeChallenge = null;
          this.gameState.speedRunTimer = 0;
        }

        // Unlock next zone if applicable and advance the active zone
        this.unlockNextZone(currentZone);
        // Advance the active zone so CONTINUE in the menu starts the next zone
        if (currentZone === 'forest') {
          this.gameState.zone = 'city';
        } else if (currentZone === 'city') {
          this.gameState.zone = 'military';
        } else if (currentZone === 'military') {
          // Unlock and enter Endless mode
          this.gameState.zone = 'endless';
          this.gameState.endlessNight = 0;
        }
        // Reset wave counter to 1 so next run in next zone starts fresh
        this.gameState.progress.currentWave = 1;

        SaveManager.save(this.gameState);
        AudioManager.stopAmbient();
        // Show zone complete screen instead of the normal result screen
        this.scene.start('ZoneCompleteScene', {
          zone: currentZone,
          kills: this.kills,
          challengeId,
          challengeBonus,
        });
      } else {
        SaveManager.save(this.gameState);
        AudioManager.stopAmbient();
        this.scene.start('ResultScene', this.buildNightStats(false));
      }
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
      // On death: reset to night 1 of the SAME zone (roguelite restart, not zone reset).
      // Gear, refugees, skills, and zone unlocks are all preserved.
      this.gameState.progress.currentWave = 1;
      // Randomize map seed so the layout feels fresh on the retry
      this.gameState.mapSeed = Math.floor(Math.random() * 100000);
      // Return unused loaded ammo back to the inventory stockpile before saving
      this.gameState.inventory.resources.ammo += Math.max(0, this.loadedAmmo);
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
    // Play boss roar when a boss zombie is about to spawn
    let bossAnnouncedThisNight = false;
    this.events.on('boss-spawning', () => {
      if (!bossAnnouncedThisNight) {
        bossAnnouncedThisNight = true;
        this.gameLog.addMessage('BOSS INCOMING!', '#FF2222');
        AudioManager.play('boss_roar');
      }
    });

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
          existing.setPathGrid(this.pathGrid);
          existing.applyZoneTint(this.gameState.zone);
        } else {
          const zombie = new Zombie(this, boss.x + offsetX, boss.y + offsetY, spawnConfig);
          if (target) zombie.setTarget(target);
          zombie.setPathGrid(this.pathGrid);
          zombie.applyZoneTint(this.gameState.zone);
          this.zombieGroup.add(zombie);
        }
        // Count the spawned enemy for wave tracking
        this.waveManager.addExtraEnemy();
      }
    });

    // Forest boss phase 2: Brute Alpha enrages when below 50% HP
    this.events.on('forest-boss-phase2', (boss: Zombie) => {
      if (!boss.active) return;
      this.gameLog.addMessage('BRUTE ALPHA ENRAGED!', '#FF4400');
      AudioManager.play('boss_roar');
    });

    // Forest boss charge end: spawn walkers at the impact point
    this.events.on('forest-boss-charge-end', (boss: Zombie) => {
      if (!boss.active) return;
      const rawCfg = enemiesData.enemies.find(e => e.id === 'walker');
      if (!rawCfg) return;
      const spawnCfg = rawCfg as ZombieConfig;
      const spawnCount = boss.spawnCount > 0 ? boss.spawnCount : 3;
      const tgt = boss.getTarget();
      for (let i = 0; i < spawnCount; i++) {
        const ang = (i / spawnCount) * Math.PI * 2;
        const rr = 48 + Math.random() * 32;
        const sx = boss.x + Math.cos(ang) * rr;
        const sy = boss.y + Math.sin(ang) * rr;
        const ex = this.zombieGroup.getFirstDead(false) as Zombie | null;
        if (ex) {
          ex.reset(sx, sy, spawnCfg);
          if (tgt) ex.setTarget(tgt);
          ex.setBasePosition(this.baseCenterX, this.baseCenterY);
          ex.setPathGrid(this.pathGrid);
          ex.applyZoneTint(this.gameState.zone);
        } else {
          const z = new Zombie(this, sx, sy, spawnCfg);
          if (tgt) z.setTarget(tgt);
          z.setBasePosition(this.baseCenterX, this.baseCenterY);
          z.setPathGrid(this.pathGrid);
          z.applyZoneTint(this.gameState.zone);
          this.zombieGroup.add(z);
        }
        this.waveManager.addExtraEnemy();
      }
    });

    // Forest boss rock throw: fires a high-damage projectile at the player
    this.events.on('forest-boss-rock-throw', (boss: Zombie, tgtSprite: Phaser.GameObjects.Sprite) => {
      if (!boss.active || !tgtSprite.active) return;
      const ang = angleBetween(boss.x, boss.y, tgtSprite.x, tgtSprite.y);
      const rockDmg = Math.round(boss.damage * 0.6);
      const exProj = this.spitterProjectileGroup.getFirstDead(false) as Projectile | null;
      if (exProj) {
        exProj.fire(boss.x, boss.y, ang, rockDmg);
        exProj.setTint(0x886644);
      } else {
        const proj = new Projectile(this, boss.x, boss.y);
        this.spitterProjectileGroup.add(proj);
        proj.fire(boss.x, boss.y, ang, rockDmg);
        proj.setTint(0x886644);
      }
    });

    // City boss: spawn minions (spitters) nearby
    this.events.on('city-boss-spawn-minions', (boss: Zombie, minionType: string, count: number) => {
      if (!boss.active) return;
      const rawCfg = enemiesData.enemies.find(e => e.id === minionType);
      if (!rawCfg) return;
      const spawnCfg = rawCfg as ZombieConfig;
      const tgt = boss.getTarget();
      this.gameLog.addMessage('SPITTER QUEEN spawns minions!', '#44FF44');
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rr = 60 + Math.random() * 40;
        const sx = boss.x + Math.cos(ang) * rr;
        const sy = boss.y + Math.sin(ang) * rr;
        const ex = this.zombieGroup.getFirstDead(false) as Zombie | null;
        if (ex) {
          ex.reset(sx, sy, spawnCfg);
          if (tgt) ex.setTarget(tgt);
          ex.setBasePosition(this.baseCenterX, this.baseCenterY);
          ex.setPathGrid(this.pathGrid);
          ex.applyZoneTint(this.gameState.zone);
        } else {
          const z = new Zombie(this, sx, sy, spawnCfg);
          if (tgt) z.setTarget(tgt);
          z.setBasePosition(this.baseCenterX, this.baseCenterY);
          z.setPathGrid(this.pathGrid);
          z.applyZoneTint(this.gameState.zone);
          this.zombieGroup.add(z);
        }
        this.waveManager.addExtraEnemy();
      }
    });

    // City boss: acid pool DOT zone -- damages the player while standing in it
    this.events.on('city-boss-acid-pool', (x: number, y: number, duration: number, dps: number) => {
      const pool = this.add.graphics();
      pool.fillStyle(0x22CC22, 0.45);
      pool.fillEllipse(0, 0, 48, 32);
      pool.setPosition(x, y);
      pool.setDepth(2);
      const intervalMs = 500;
      const totalTicks = Math.ceil(duration / intervalMs);
      let ticksLeft = totalTicks;
      const damagePerTick = dps * (intervalMs / 1000);
      const acidTimer = this.time.addEvent({
        delay: intervalMs,
        repeat: totalTicks - 1,
        callback: () => {
          ticksLeft--;
          if (this.player.active) {
            const d = distanceBetween(x, y, this.player.x, this.player.y);
            if (d < 28) this.player.takeDamage(Math.round(damagePerTick));
          }
          if (ticksLeft <= 0) {
            acidTimer.destroy();
            this.tweens.add({
              targets: pool,
              alpha: 0,
              duration: 400,
              onComplete: () => pool.destroy(),
            });
          }
        },
      });
    });

    // City boss desperate scream: pulls ALL zombies toward the queen at 25% HP
    this.events.on('city-boss-desperate-scream', (boss: Zombie, _radius: number) => {
      if (!boss.active) return;
      this.gameLog.addMessage('SPITTER QUEEN DESPERATE SCREAM!', '#FF0044');
      AudioManager.play('boss_roar');
      const screamRing = this.add.graphics();
      screamRing.lineStyle(3, 0xFF0088, 0.9);
      screamRing.strokeCircle(boss.x, boss.y, 15);
      screamRing.setDepth(10);
      this.tweens.add({
        targets: screamRing,
        scaleX: 50,
        scaleY: 50,
        alpha: 0,
        duration: 800,
        ease: 'Power2',
        onComplete: () => screamRing.destroy(),
      });
      this.zombieGroup.getChildren().forEach(child => {
        const z = child as Zombie;
        if (!z.active || z === boss) return;
        z.attractTo(boss.x, boss.y);
      });
    });

    // Military tank: instantly crushes barricades and walls in its path
    this.events.on('tank-crushing', (tank: Zombie) => {
      if (!tank.active) return;
      const crushRadius = 28 * tank.scaleX;
      this.barricades.forEach(b => {
        if (!b.active) return;
        if (distanceBetween(tank.x, tank.y, b.x, b.y) < crushRadius) b.takeDamage(999);
      });
      this.walls.forEach(w => {
        if (!w.active) return;
        if (distanceBetween(tank.x, tank.y, w.x, w.y) < crushRadius) w.takeDamage(999);
      });
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

  /**
   * Map gameState.equipped primary/secondary ids to the actual inventory index
   * and tell WeaponManager which index is active. Falls back to index 0.
   */
  private syncEquippedSlotToWeaponManager(): void {
    const weapons = this.gameState.inventory.weapons;
    const primaryId = this.gameState.equipped.primaryWeaponId;
    const primaryIdx = primaryId ? weapons.findIndex(w => w.id === primaryId) : -1;
    // Start with primary (slot 0). If not found fall back to 0.
    this.weaponManager.switchWeapon(primaryIdx >= 0 ? primaryIdx : 0);
  }

  /**
   * Resolve which inventory index corresponds to an equipped slot (1 or 2).
   * Returns -1 when the slot is empty or the weapon no longer exists.
   */
  private getEquippedIndexForSlot(slotNumber: 1 | 2): number {
    const weapons = this.gameState.inventory.weapons;
    const id = slotNumber === 1
      ? this.gameState.equipped.primaryWeaponId
      : this.gameState.equipped.secondaryWeaponId;
    if (!id) return -1;
    return weapons.findIndex(w => w.id === id);
  }

  private setupWeaponKeys(): void {
    if (!this.input.keyboard) return;

    // Key 1 = primary equipped weapon, key 2 = secondary equipped weapon.
    // If no equipped set exists (fallback), keys 1-5 map to all inventory weapons.
    const { primaryWeaponId, secondaryWeaponId } = this.gameState.equipped;
    const hasEquipped = primaryWeaponId !== null || secondaryWeaponId !== null;

    if (hasEquipped) {
      // Slot 1: primary
      const key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
      key1.on('down', () => {
        const idx = this.getEquippedIndexForSlot(1);
        if (idx >= 0) {
          this.weaponManager.switchWeapon(idx);
          this.updateWeaponHUD();
          this.checkAmmoWarning();
        }
      });

      // Slot 2: secondary
      const key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
      key2.on('down', () => {
        const idx = this.getEquippedIndexForSlot(2);
        if (idx >= 0) {
          this.weaponManager.switchWeapon(idx);
          this.updateWeaponHUD();
          this.checkAmmoWarning();
        }
      });
    } else {
      // Backward-compatible fallback: all inventory weapons on keys 1-5
      for (let i = 1; i <= 5; i++) {
        const key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + (i - 1));
        key.on('down', () => {
          this.weaponManager.switchWeapon(i - 1);
          this.updateWeaponHUD();
          this.checkAmmoWarning();
        });
      }
    }

    // E key for repair mechanic (hold near malfunctioned trap)
    this._repairKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // ESC to pause/unpause (flag-based so input still works while paused)
    const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.on('down', () => {
      if (this.gamePaused) {
        this.gamePaused = false;
        this.physics.resume();
        this.pauseOverlay?.setVisible(false);
      } else {
        this.gamePaused = true;
        this.physics.pause();
        this.showPauseOverlay();
      }
    });

    // Shoot input: Space key or mouse click = shoot nearest enemy
    // Hold = auto-fire (respects cooldown)
    const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.on('down', () => { this.isShooting = true; });
    spaceKey.on('up', () => { this.isShooting = false; });

    this.input.on('pointerdown', () => { this.isShooting = true; });
    this.input.on('pointerup', () => { this.isShooting = false; });

    // M key: toggle minimap visibility
    const mKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    mKey.on('down', () => {
      this.minimap.toggle();
    });
  }

  /**
   * Load all available ammo from stockpile at night start.
   * Player controls fire rate manually (click/space to shoot).
   * Returns total loaded ammo.
   */
  private autoLoadAmmo(): number {
    const weapons = this.gameState.inventory.weapons;
    const { primaryWeaponId, secondaryWeaponId } = this.gameState.equipped;
    const equippedIds = [primaryWeaponId, secondaryWeaponId].filter((id): id is string => id !== null);

    // Check if any equipped weapon uses ammo
    let hasRanged = false;
    for (const id of equippedIds) {
      const instance = weapons.find(w => w.id === id);
      if (!instance) continue;
      const data = WeaponManager.getWeaponData(instance.weaponId);
      if (data && data.ammoPerNight > 0) hasRanged = true;
    }

    if (!hasRanged) return 0;

    const available = this.gameState.inventory.resources.ammo;
    if (available <= 0) {
      this.time.delayedCall(200, () => {
        if (this.hud) this.hud.showMessage('NO AMMO!');
        if (this.gameLog) this.gameLog.addMessage('No ammo!', '#FF4444');
      });
      return 0;
    }

    // Load all available ammo
    this.gameState.inventory.resources.ammo = 0;
    SaveManager.save(this.gameState);

    return available;
  }

  /** Show NO AMMO warning if the currently equipped weapon is ranged and out of ammo. */
  private checkAmmoWarning(): void {
    const w = this.weaponManager.getEquipped();
    if (w) {
      const s = this.weaponManager.getWeaponStats(w);
      if (s.weaponClass !== 'melee' && this.loadedAmmo <= 0) {
        this.hud.showMessage('NO AMMO -- switch to melee!');
        this.gameLog.addMessage('No ammo! Switch to melee!', '#FF4444');
        AudioManager.play('ui_error');
      }
    }
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
      this.gamePaused = false;
      this.physics.resume();
      this.pauseOverlay?.setVisible(false);
    });
  }

  /**
   * Refresh the bottom HUD weapon display.
   * Slot [1] always shows primaryWeaponId, slot [2] always shows secondaryWeaponId.
   * The active slot label is highlighted gold.
   */
  private updateWeaponHUD(): void {
    const weapons = this.gameState.inventory.weapons;
    const { primaryWeaponId, secondaryWeaponId } = this.gameState.equipped;

    const primaryWeapon = primaryWeaponId ? weapons.find(w => w.id === primaryWeaponId) ?? null : null;
    const secondaryWeapon = secondaryWeaponId ? weapons.find(w => w.id === secondaryWeaponId) ?? null : null;

    // Slot 1: primary
    if (primaryWeapon) {
      const stats = this.weaponManager.getWeaponStats(primaryWeapon);
      this.hud.updateWeapon(stats.name, primaryWeapon.durability, primaryWeapon.maxDurability, stats.specialEffect, primaryWeapon.level);
    } else {
      this.hud.updateWeapon('--', 0, 1);
    }

    // Slot 2: secondary
    if (secondaryWeapon) {
      const stats = this.weaponManager.getWeaponStats(secondaryWeapon);
      this.hud.updateSecondaryWeapon(stats.name, secondaryWeapon.durability, secondaryWeapon.maxDurability);
    } else {
      this.hud.updateSecondaryWeapon(null);
    }

    // Determine active slot number for highlighting
    const activeWeapon = this.weaponManager.getEquipped();
    if (activeWeapon) {
      const isPrimary = activeWeapon.id === primaryWeaponId;
      this.hud.setActiveSlot(isPrimary ? 1 : 2);
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

  /**
   * Resolve the active ultimate type for the currently equipped weapon.
   * Returns null if weapon is not level 5 or has no ultimate defined.
   */
  private getActiveUltimate(): WeaponUltimateType | null {
    const weapon = this.weaponManager.getEquipped();
    if (!weapon || weapon.level < 5) return null;
    const data = WeaponManager.getWeaponData(weapon.weaponId);
    return data?.ultimate?.type ?? null;
  }

  private shootAt(target: Zombie): void {
    if (!target.active) return;
    const weapon = this.weaponManager.getEquipped();
    if (!weapon) return;

    // Play player attack animation
    this.player.playAttackAnim();

    const stats = this.weaponManager.getWeaponStats(weapon);
    const isMelee = stats.weaponClass === 'melee';

    // Resolve ultimate type before consuming ammo (may redirect firing logic entirely)
    const ultimateType = this.getActiveUltimate();

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
      // --- ULTIMATE: Spin Attack ---
      // Hits ALL enemies within 48px radius instead of just the nearest target.
      if (ultimateType === 'spin_attack') {
        const SPIN_RADIUS = 48;
        let hitCount = 0;
        this.zombieGroup.getChildren().forEach(child => {
          const z = child as Zombie;
          if (!z.active) return;
          const dist = distanceBetween(this.player.x, this.player.y, z.x, z.y);
          if (dist <= SPIN_RADIUS && hitCount < 10) { // cap at 10 for performance
            hitCount++;
            z.takeDamage(stats.damage);
            AudioManager.play('melee_hit');
            this.bloodEmitter.emitParticleAt(z.x, z.y, 5);
            if (stats.specialEffect && z.active) {
              this.applyMeleeSpecialEffect(z, stats.specialEffect);
            }
          }
        });
        // Visual: full circle arc showing spin radius
        const arc = this.add.graphics();
        arc.setDepth(9);
        arc.setPosition(this.player.x, this.player.y);
        arc.lineStyle(3, 0xFFD700, 0.8);
        arc.strokeCircle(0, 0, SPIN_RADIUS);
        this.tweens.add({
          targets: arc,
          alpha: 0,
          scale: 1.3,
          duration: 250,
          onComplete: () => arc.destroy(),
        });
        return;
      }

      // --- ULTIMATE: Cleave Pierce ---
      // Hits the primary target and the zombie directly behind it (75% damage).
      if (ultimateType === 'cleave_pierce') {
        target.takeDamage(stats.damage);
        AudioManager.play('melee_hit');
        this.bloodEmitter.emitParticleAt(target.x, target.y, 6);
        if (stats.specialEffect && target.active) {
          this.applyMeleeSpecialEffect(target, stats.specialEffect);
        }
        // Find zombie directly behind target (same direction from player)
        const hitAngle = angleBetween(this.player.x, this.player.y, target.x, target.y);
        let bestBehind: Zombie | null = null;
        let bestDist = Infinity;
        this.zombieGroup.getChildren().forEach(child => {
          const z = child as Zombie;
          if (!z.active || z === target) return;
          // Check if zombie is in the same direction (within 30 degrees) and further
          const zAngle = angleBetween(this.player.x, this.player.y, z.x, z.y);
          const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(zAngle - hitAngle));
          if (angleDiff < 0.52 /* ~30 degrees */) {
            const dist = distanceBetween(this.player.x, this.player.y, z.x, z.y);
            if (dist > distanceBetween(this.player.x, this.player.y, target.x, target.y) && dist < bestDist) {
              bestDist = dist;
              bestBehind = z;
            }
          }
        });
        if (bestBehind) {
          const pierceDamage = Math.round(stats.damage * 0.75);
          (bestBehind as Zombie).takeDamage(pierceDamage);
          if ((bestBehind as Zombie).active) this.bloodEmitter.emitParticleAt((bestBehind as Zombie).x, (bestBehind as Zombie).y, 4);
        }
        // Visual: elongated double-arc
        const arc = this.add.graphics();
        arc.setDepth(9);
        arc.lineStyle(2, 0xFFAA00, 0.8);
        arc.beginPath();
        arc.arc(this.player.x, this.player.y, stats.range, hitAngle - 0.6, hitAngle + 0.6, false);
        arc.strokePath();
        arc.lineStyle(1, 0xFFAA00, 0.4);
        arc.beginPath();
        arc.arc(this.player.x, this.player.y, stats.range * 1.8, hitAngle - 0.4, hitAngle + 0.4, false);
        arc.strokePath();
        this.tweens.add({
          targets: arc,
          alpha: 0,
          duration: 220,
          onComplete: () => arc.destroy(),
        });
        return;
      }

      // Default melee: single target hit
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

    // --- ULTIMATE: Buckshot -- 5 pellets in 30 degree spread ---
    if (ultimateType === 'buckshot') {
      const SPREAD = Math.PI / 6; // 30 degrees total
      const pelletCount = 5;
      for (let i = 0; i < pelletCount; i++) {
        const spreadOffset = -SPREAD / 2 + (SPREAD / (pelletCount - 1)) * i;
        this.fireProjectile(angle + spreadOffset, Math.round(stats.damage / 3), stats.specialEffect);
      }
      return;
    }

    // --- ULTIMATE: Explosive Impact -- AOE on projectile impact ---
    if (ultimateType === 'explosive_impact') {
      // Explosive impact handled via special synthetic effect applied post-hit.
      // We fire a single projectile and tag it for explosion handling in the collision callback.
      // Store on projectile as a synthetic specialEffect with type 'cleave' and 60px radius.
      const explosiveEffect: WeaponSpecialEffect = {
        type: 'cleave',
        chance: 1.0,
        value: 60,   // radius in px
        duration: 0,
      };
      this.fireProjectile(angle, stats.damage, explosiveEffect);
      return;
    }

    if (stats.weaponClass === 'shotgun') {
      // Shotgun fires a spread of 3 pellets -- each pellet carries the special effect
      const spreadAngles = [angle - 0.15, angle, angle + 0.15];
      for (const a of spreadAngles) {
        // Phosphor rounds on shotgun: tag each pellet with the ultimate type
        const projUltimate = ultimateType === 'phosphor_rounds' ? 'phosphor_rounds' as WeaponUltimateType : null;
        this.fireProjectile(a, Math.round(stats.damage / 3), stats.specialEffect, false, projUltimate);
      }
    } else if (ultimateType === 'piercing_shot') {
      // Piercing Shot: mark the projectile so it passes through the first zombie
      this.fireProjectile(angle, stats.damage, stats.specialEffect, true, 'piercing_shot');
    } else if (ultimateType === 'phosphor_rounds') {
      // Phosphor Rounds: tag projectile so collision callback applies burn DOT
      this.fireProjectile(angle, stats.damage, stats.specialEffect, false, 'phosphor_rounds');
    } else {
      this.fireProjectile(angle, stats.damage, stats.specialEffect);
    }
  }

  private fireProjectile(angle: number, damage: number, specialEffect: WeaponSpecialEffect | null = null, piercing: boolean = false, ultimateType: WeaponUltimateType | null = null): void {
    const existing = this.projectileGroup.getFirstDead(false) as Projectile | null;
    if (existing) {
      existing.fire(this.player.x, this.player.y, angle, damage, specialEffect, piercing, ultimateType);
    } else {
      const proj = new Projectile(this, this.player.x, this.player.y);
      this.projectileGroup.add(proj);
      proj.fire(this.player.x, this.player.y, angle, damage, specialEffect, piercing, ultimateType);
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

  /**
   * Apply ranged ultimate on-hit effects that are not covered by specialEffect.
   * Currently handles: phosphor_rounds (burn DOT on the hit zombie).
   * piercing_shot, buckshot, explosive_impact are handled in shootAt / specialEffect respectively.
   */
  private applyRangedUltimateEffect(zombie: Zombie, ultimateType: WeaponUltimateType): void {
    switch (ultimateType) {
      case 'phosphor_rounds': {
        // Set zombie on fire: 8 dmg/s for 3 seconds
        // applyBurn refreshes duration if already burning
        zombie.applyBurn(8, 3000);
        break;
      }
      // Other ultimate types handled elsewhere -- no-op here
      case 'spin_attack':
      case 'cleave_pierce':
      case 'buckshot':
      case 'piercing_shot':
      case 'explosive_impact':
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
    this.barricades    = this.barricades.filter(b => b && b.active);
    this.traps         = this.traps.filter(t => t && t.active);
    this._spikeStrips  = this._spikeStrips.filter(s => s && s.active);
    this._bearTraps    = this._bearTraps.filter(b => b && b.active);
    this._landmines    = this._landmines.filter(m => m && m.active);
    this._sandbags     = this._sandbags.filter(s => s && s.active);
    this._oilSlicks    = this._oilSlicks.filter(o => o && o.active);
    this._nailBoards     = this._nailBoards.filter(t => t && t.active);
    this._tripWires      = this._tripWires.filter(t => t && t.active);
    this._glassShards    = this._glassShards.filter(t => t && t.active);
    this._tarPits        = this._tarPits.filter(t => t && t.active);
    this._bladeSpinners  = this._bladeSpinners.filter(t => t && t.active);
    this._firePits       = this._firePits.filter(t => t && t.active);
    this._propaneGeysers = this._propaneGeysers.filter(t => t && t.active);
    this._cartWalls      = this._cartWalls.filter(t => t && t.active);
    this._washingCannons = this._washingCannons.filter(t => t && t.active);
    this._pitTraps       = this._pitTraps.filter(t => t && t.active);
    this._shockWires     = this._shockWires.filter(t => t && t.active);
    this._springLaunchers = this._springLaunchers.filter(t => t && t.active);
    this._chainWalls     = this._chainWalls.filter(t => t && t.active);
    this._glueFloors     = this._glueFloors.filter(t => t && t.active);
    this._shoppingCartWalls = this._shoppingCartWalls.filter(t => t && t.active);
    this._carWreckBarriers  = this._carWreckBarriers.filter(t => t && t.active);
    this._dumpsterFortresses = this._dumpsterFortresses.filter(t => t && t.active);
    this._tractorWheelRollers = this._tractorWheelRollers.filter(t => t && t.active);
    this._wreckingBalls  = this._wreckingBalls.filter(t => t && t.active);
    this._logAvalanches  = this._logAvalanches.filter(t => t && t.active);
    this._fallingCars    = this._fallingCars.filter(t => t && t.active);
    this._treadmillBlades = this._treadmillBlades.filter(t => t && t.active);
    this._fanGlasses     = this._fanGlasses.filter(t => t && t.active);
    this._elevatorShafts = this._elevatorShafts.filter(t => t && t.active);
    this._rubeGoldbergs  = this._rubeGoldbergs.filter(t => t && t.active);

    // Query the spatial grid per zombie rather than checking all structure arrays.
    // Each zombie gets ~3-5 candidates instead of iterating all 12 passive arrays.
    // Query radius 96px: covers the zombie's tile plus immediate neighbours;
    // zone-based traps (oil slick, glass shards, tar pit, glue floor) have radii
    // up to 96px, so this radius guarantees we never miss a live zone.
    let _gridDirty = false;

    this.zombieGroup.getChildren().forEach(child => {
      const zombie = child as Zombie;
      if (!zombie.active) return;

      // Get candidate structures within 96px of the zombie
      const nearby = this.structureGrid.query(zombie.x, zombie.y, 96);

      for (const candidate of nearby) {
        // ----- Barricade -----
        if (candidate instanceof Barricade) {
          const barricade = candidate;
          if (!barricade.active) continue;
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
                this.destroyedStructures.push({
                  structureId: barricade.structureInstance.structureId,
                  x: barricade.structureInstance.x,
                  y: barricade.structureInstance.y,
                });
                this.barricades = this.barricades.filter(b => b !== barricade);
                _gridDirty = true;
              }
            }
          }
          continue;
        }

        // ----- Sandbags -----
        if (candidate instanceof Sandbags) {
          const bags = candidate;
          if (!bags.active) continue;
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
                this._sandbags = this._sandbags.filter(s => s !== bags);
                _gridDirty = true;
              }
            }
          }
          continue;
        }

        // ----- OilSlick (zone-based slow) -----
        if (candidate instanceof OilSlick) {
          const slick = candidate;
          if (!slick.active) continue;
          if (slick.containsPoint(zombie.x, zombie.y)) {
            const factor = slick.getSlowFactor();
            const body = zombie.body;
            if (body) {
              body.velocity.x *= factor;
              body.velocity.y *= factor;
            }
          }
          continue;
        }

        // ----- Trap (single-use damage tile) -----
        if (candidate instanceof Trap) {
          const trap = candidate;
          if (!trap.active) continue;
          const tx = trap.structureInstance.x;
          const ty = trap.structureInstance.y;
          if (
            zombie.x >= tx && zombie.x <= tx + TILE_SIZE &&
            zombie.y >= ty && zombie.y <= ty + TILE_SIZE
          ) {
            this._currentKillSource = 'trap'; this._currentKillTrapName = trap.structureInstance.structureId; zombie.takeDamage(trap.getDamage()); this._currentKillSource = null;
            this.trapEmitter.emitParticleAt(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, 6);
            // Trap is single-use; destroy after triggering
            const destroyed = trap.takeDamage(trap.structureInstance.hp);
            if (destroyed) {
              this.traps = this.traps.filter(t => t !== trap);
              _gridDirty = true;
            }
          }
          continue;
        }

        // ----- SpikeStrip (damage + cripple, multi-use) -----
        if (candidate instanceof SpikeStrip) {
          const strip = candidate;
          if (!strip.active) continue;
          const sx = strip.structureInstance.x;
          const sy = strip.structureInstance.y;
          if (
            zombie.x >= sx && zombie.x <= sx + TILE_SIZE &&
            zombie.y >= sy && zombie.y <= sy + TILE_SIZE
          ) {
            this._currentKillSource = 'trap'; this._currentKillTrapName = 'Spike Strip'; zombie.takeDamage(strip.getDamage()); this._currentKillSource = null;
            zombie.applyCripple(strip.crippleDuration);
            this.trapEmitter.emitParticleAt(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2, 4);
            const destroyed = strip.consumeUse();
            if (destroyed) {
              this._spikeStrips = this._spikeStrips.filter(s => s !== strip);
              _gridDirty = true;
            }
          }
          continue;
        }

        // ----- BearTrap (damage + stun, single use) -----
        if (candidate instanceof BearTrap) {
          const bt = candidate;
          if (!bt.active) continue;
          const bx = bt.structureInstance.x;
          const by = bt.structureInstance.y;
          if (
            zombie.x >= bx && zombie.x <= bx + TILE_SIZE &&
            zombie.y >= by && zombie.y <= by + TILE_SIZE
          ) {
            this._currentKillSource = 'trap'; this._currentKillTrapName = 'Bear Trap'; zombie.takeDamage(bt.getDamage()); this._currentKillSource = null;
            zombie.applyStun(bt.stunDuration);
            this.trapEmitter.emitParticleAt(bx + TILE_SIZE / 2, by + TILE_SIZE / 2, 8);
            bt.trigger();
            this._bearTraps = this._bearTraps.filter(b => b !== bt);
            _gridDirty = true;
          }
          continue;
        }

        // ----- Landmine (AOE explosion, single use) -----
        if (candidate instanceof Landmine) {
          const mine = candidate;
          if (!mine.active) continue;
          const mx = mine.structureInstance.x;
          const my = mine.structureInstance.y;
          if (
            zombie.x >= mx && zombie.x <= mx + TILE_SIZE &&
            zombie.y >= my && zombie.y <= my + TILE_SIZE
          ) {
            // trigger() emits 'landmine-exploded' event that NightScene listens to
            mine.trigger();
            this._landmines = this._landmines.filter(m => m !== mine);
            _gridDirty = true;
            break; // one mine trigger per zombie per frame
          }
          continue;
        }

        // ----- NailBoard (damage + cripple, limited uses) -----
        if (candidate instanceof NailBoard) {
          const nb = candidate;
          if (!nb.isAlive()) continue;
          const nx = nb.structureInstance.x;
          const ny = nb.structureInstance.y;
          if (
            zombie.x >= nx && zombie.x <= nx + TILE_SIZE &&
            zombie.y >= ny && zombie.y <= ny + TILE_SIZE
          ) {
            this._currentKillSource = 'trap'; this._currentKillTrapName = 'Nail Board'; zombie.takeDamage(nb.trapDamage); this._currentKillSource = null;
            zombie.applyCripple(nb.crippleDuration);
            nb.triggerActivationEffect();
            this.nailBloodEmitter.emitParticleAt(nx + TILE_SIZE / 2, ny + TILE_SIZE / 2, 5);
            AudioManager.play('trap_nail_board');
            const destroyed = nb.consumeUse();
            if (destroyed) {
              this._nailBoards = this._nailBoards.filter(n => n !== nb);
              _gridDirty = true;
            }
          }
          continue;
        }

        // ----- TripWire (stun on contact, limited uses) -----
        if (candidate instanceof TripWire) {
          const tw = candidate;
          if (!tw.isAlive()) continue;
          const tx = tw.structureInstance.x;
          const ty = tw.structureInstance.y;
          if (
            zombie.x >= tx && zombie.x <= tx + TILE_SIZE &&
            zombie.y >= ty && zombie.y <= ty + TILE_SIZE
          ) {
            zombie.applyStun(tw.stunDuration);
            tw.triggerActivationEffect();
            this.trapEmitter.emitParticleAt(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, 4);
            AudioManager.play('trap_trip_wire');
            const destroyed = tw.consumeUse();
            if (destroyed) {
              this._tripWires = this._tripWires.filter(t => t !== tw);
              _gridDirty = true;
            }
          }
          continue;
        }

        // ----- GlassShards (continuous damage per second in zone) -----
        if (candidate instanceof GlassShards) {
          const gs = candidate;
          if (!gs.isAlive()) continue;
          if (gs.containsPoint(zombie.x, zombie.y)) {
            this._currentKillSource = 'trap'; this._currentKillTrapName = 'Glass Shards'; zombie.takeDamage(gs.damagePerSecond * this._lastDelta / 1000); this._currentKillSource = null;
            AudioManager.play('trap_glass_shards');
          }
          continue;
        }

        // ----- TarPit (80% slow in zone) -----
        if (candidate instanceof TarPit) {
          const tp = candidate;
          if (!tp.isAlive()) continue;
          if (tp.containsPoint(zombie.x, zombie.y)) {
            const body = zombie.body;
            if (body) {
              body.velocity.x *= tp.slowFactor;
              body.velocity.y *= tp.slowFactor;
            }
            tp.markZombieInZone();
            AudioManager.play('trap_tar_pit');
          }
          continue;
        }

        // ----- GlueFloor (90% slow zone, 3 tiles wide) -----
        if (candidate instanceof GlueFloor) {
          const gf = candidate;
          if (!gf.isAlive()) continue;
          if (gf.containsPoint(zombie.x, zombie.y)) {
            const body = zombie.body;
            if (body) {
              body.velocity.x *= gf.slowFactor;
              body.velocity.y *= gf.slowFactor;
            }
          }
          continue;
        }
      }
    });

    // Rebuild the grid if any structure was destroyed during the zombie loop.
    if (_gridDirty) {
      this._rebuildStructureGrid();
    }

    // Animate tar pits (bubbling effect) -- once per frame, not per zombie
    for (const tp of this._tarPits) {
      if (tp.isAlive()) tp.animUpdate(this._lastDelta);
    }

    // Animate glass shards sparkle -- once per frame, not per zombie
    for (const gs of this._glassShards) {
      if (gs.isAlive()) gs.animUpdate(this._lastDelta);
    }

    // Animate nail boards and trip wires (flash timers) -- once per frame
    for (const nb of this._nailBoards) {
      if (nb.isAlive()) nb.update(this._lastDelta);
    }
    for (const tw of this._tripWires) {
      if (tw.isAlive()) tw.update(this._lastDelta);
    }

    // Animate glue floors (drip effect) -- once per frame
    for (const gf of this._glueFloors) {
      if (gf.isAlive()) gf.animUpdate(this._lastDelta);
    }

    // -----------------------------------------------------------------------
    // TrapBase mechanical traps -- update cooldown/overheat each frame
    // then check zombie proximity for activation.
    // Note: delta is not available here; we store it from update() above.
    // -----------------------------------------------------------------------
    this.updateMechanicalTraps();

    // Pillbox interaction: check once per frame (was incorrectly inside per-zombie loop)
    this.checkPillboxDamage();
  }

  /**
   * Update all TrapBase-derived mechanical traps and handle zombie contacts.
   * Called once per frame from checkZombieStructureInteractions().
   */
  private updateMechanicalTraps(): void {
    const delta = this._lastDelta;
    // Power Outage: electric traps are non-functional while the event is active
    const electricDisabled = this.nightEventManager.hasEvent('power_outage');

    // Update timers for all mechanical traps
    for (const t of this._bladeSpinners)  t.update(delta);
    for (const t of this._firePits)       t.update(delta);
    for (const t of this._propaneGeysers) t.update(delta);
    for (const t of this._washingCannons) t.update(delta);
    for (const t of this._pitTraps)       t.update(delta);

    // --- Blade Spinner: AOE around center ---
    for (const spinner of this._bladeSpinners) {
      if (!spinner.active || !spinner.isReady()) continue;

      let triggered = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;

        const cx = spinner.structureInstance.x + TILE_SIZE / 2;
        const cy = spinner.structureInstance.y + TILE_SIZE / 2;
        const dx = zombie.x - cx;
        const dy = zombie.y - cy;

        if (dx * dx + dy * dy <= spinner.aoeRadius * spinner.aoeRadius) {
          if (!triggered) {
            // First zombie triggers activation (starts cooldown / overheat)
            if (!spinner.tryActivate()) break;
            triggered = true;
            this.trapEmitter.emitParticleAt(cx, cy, 8);
          }
          // All zombies in radius take damage
          zombie.takeDamage(25);
        }
      }
    }

    // --- Fire Pit: continuous damage per second for zombies inside zone ---
    for (const pit of this._firePits) {
      if (!pit.active || pit.malfunctioned) continue;

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;

        if (pit.containsPoint(zombie.x, zombie.y)) {
          // Damage proportional to frame time (15 dmg/s); rain reduces fire damage
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Pit Trap'; zombie.takeDamage(pit.damagePerSecond * delta / 1000 * this._rainFireDamageMultiplier); this._currentKillSource = null;
        }
      }
    }

    // --- Propane Geyser: AOE burst on nearest zombie in range ---
    for (const geyser of this._propaneGeysers) {
      if (!geyser.active || !geyser.isReady()) continue;

      const cx = geyser.structureInstance.x + TILE_SIZE / 2;
      const cy = geyser.structureInstance.y + TILE_SIZE / 2;
      const rSq = geyser.burstRadius * geyser.burstRadius;

      // Check if any zombie is in range
      let anyInRange = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        const dx = zombie.x - cx;
        const dy = zombie.y - cy;
        if (dx * dx + dy * dy <= rSq) { anyInRange = true; break; }
      }

      if (!anyInRange) continue;
      if (!geyser.tryActivate()) continue;

      // Deal AOE damage to all zombies in burst radius
      this.trapEmitter.emitParticleAt(cx, cy, 12);
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        const dx = zombie.x - cx;
        const dy = zombie.y - cy;
        if (dx * dx + dy * dy <= rSq) {
          zombie.takeDamage(geyser.burstDamage);
        }
      }
    }

    // --- Washing Cannon: fire projectile at nearest zombie in range ---
    for (const cannon of this._washingCannons) {
      if (!cannon.active) continue;
      cannon.update(delta); // also updates in-flight projectiles

      if (!cannon.isReady()) continue;

      const cx = cannon.structureInstance.x + TILE_SIZE / 2;
      const cy = cannon.structureInstance.y + TILE_SIZE / 2;
      const rSq = cannon.range * cannon.range;

      // Find nearest zombie in range
      let nearest: Zombie | null = null;
      let nearestDistSq = rSq + 1;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        const dx = zombie.x - cx;
        const dy = zombie.y - cy;
        const dSq = dx * dx + dy * dy;
        if (dSq <= rSq && dSq < nearestDistSq) {
          nearest = zombie;
          nearestDistSq = dSq;
        }
      }

      if (!nearest) continue;
      if (!cannon.tryActivate()) continue;

      cannon.onZombieContact(nearest);
    }

    // --- Washing Cannon: check if any projectile hits a zombie ---
    for (const cannon of this._washingCannons) {
      if (!cannon.active) continue;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        cannon.checkProjectileHit(zombie);
      }
    }

    // --- Pit Trap: capture first zombie that steps on it ---
    for (let i = this._pitTraps.length - 1; i >= 0; i--) {
      const pt = this._pitTraps[i];
      if (!pt || !pt.active) continue;
      if (!pt.isReady()) continue;

      const px = pt.structureInstance.x;
      const py = pt.structureInstance.y;

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;

        if (
          zombie.x >= px && zombie.x <= px + TILE_SIZE &&
          zombie.y >= py && zombie.y <= py + TILE_SIZE
        ) {
          if (!pt.tryActivate()) break;
          pt.onZombieContact(zombie);
          // If pit is full (uses === 0) it destroys itself in onZombieContact
          if (!pt.active) {
            this._pitTraps.splice(i, 1);
          }
          break; // one zombie per frame per pit
        }
      }
    }

    // --- Shock Wire: stun + damage on contact, cooldown 8s, 10 uses ---
    for (const t of this._shockWires) t.update(delta);
    for (let i = this._shockWires.length - 1; i >= 0; i--) {
      const sw = this._shockWires[i];
      // Power Outage: electric trap is disabled
      if (electricDisabled) continue;
      if (!sw || !sw.active || !sw.isReady()) continue;

      const sx = sw.structureInstance.x;
      const sy = sw.structureInstance.y;

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;

        if (
          zombie.x >= sx && zombie.x <= sx + TILE_SIZE &&
          zombie.y >= sy && zombie.y <= sy + TILE_SIZE
        ) {
          if (!sw.tryActivate()) break;
          sw.onZombieContact(zombie);
          // Discharge flash on the wire tile
          sw.triggerActivationEffect();
          // Blue/white spark particles at wire position
          this.shockEmitter.emitParticleAt(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2, 10);
          // Electric zap sound on shock wire activation
          AudioManager.play('trap_shock_wire');
          // If all uses are spent, destroy
          if (sw.uses === 0) {
            this._shockWires.splice(i, 1);
          }
          break; // one trigger per frame per wire
        }
      }
    }

    // --- Spring Launcher: damage + knockback on contact, cooldown 5s ---
    for (const t of this._springLaunchers) t.update(delta);
    for (const sl of this._springLaunchers) {
      if (!sl.active || !sl.isReady()) continue;

      const slx = sl.structureInstance.x;
      const sly = sl.structureInstance.y;

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;

        if (
          zombie.x >= slx && zombie.x <= slx + TILE_SIZE &&
          zombie.y >= sly && zombie.y <= sly + TILE_SIZE
        ) {
          if (!sl.tryActivate()) break;
          sl.onZombieContact(zombie);
          // Orange burst flash on the launcher tile
          sl.triggerActivationEffect();
          // Orange particles burst outward at impact
          this.trapEmitter.emitParticleAt(slx + TILE_SIZE / 2, sly + TILE_SIZE / 2, 10);
          // Metallic THUNK + boing sound on spring launcher activation
          AudioManager.play('trap_spring_launcher');
          break; // one trigger per frame per launcher
        }
      }
    }

    // --- Chain Wall: update malfunction state; contact damage handled by wall collider ---
    for (const t of this._chainWalls) t.update(delta);

    // --- Tractor Wheel Roller: single-use line damage, trigger on contact ---
    for (const t of this._tractorWheelRollers) t.update(delta);
    for (let i = this._tractorWheelRollers.length - 1; i >= 0; i--) {
      const twr = this._tractorWheelRollers[i];
      if (!twr || !twr.active || !twr.isReady()) continue;
      const twrX = twr.structureInstance.x;
      const twrY = twr.structureInstance.y;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (zombie.x >= twrX && zombie.x <= twrX + TILE_SIZE &&
            zombie.y >= twrY && zombie.y <= twrY + TILE_SIZE) {
          if (!twr.tryActivate()) break;
          twr.triggerRoll();
          // Damage all zombies in a line (forward 4 tiles -- downward in Y)
          const lineEndY = twrY + twr.rollDistance;
          for (const c2 of this.zombieGroup.getChildren()) {
            const z2 = c2 as Zombie;
            if (!z2.active) continue;
            if (z2.x >= twrX - TILE_SIZE / 2 && z2.x <= twrX + TILE_SIZE * 1.5 &&
                z2.y >= twrY && z2.y <= lineEndY) {
              z2.takeDamage(twr.damage);
            }
          }
          this.trapEmitter.emitParticleAt(twrX + TILE_SIZE / 2, twrY + TILE_SIZE / 2, 12);
          this._tractorWheelRollers.splice(i, 1);
          break;
        }
      }
    }

    // --- Wrecking Ball: AOE on zombie proximity, cd 10s ---
    for (const t of this._wreckingBalls) t.update(delta);
    for (const wb of this._wreckingBalls) {
      if (!wb.active || !wb.isReady()) continue;
      const cx = wb.structureInstance.x + TILE_SIZE / 2;
      const cy = wb.structureInstance.y + TILE_SIZE / 2;
      const rSq = wb.aoeRadius * wb.aoeRadius;
      let triggered = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        const dx = zombie.x - cx;
        const dy = zombie.y - cy;
        if (dx * dx + dy * dy <= rSq) {
          if (!triggered) {
            if (!wb.tryActivate()) break;
            triggered = true;
            wb.triggerImpact();
            this.trapEmitter.emitParticleAt(cx, cy, 14);
          }
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Wrecking Ball'; zombie.takeDamage(wb.damage); this._currentKillSource = null;
        }
      }
    }

    // --- Log Avalanche: single-use line damage + pushback ---
    for (const t of this._logAvalanches) t.update(delta);
    for (let i = this._logAvalanches.length - 1; i >= 0; i--) {
      const la = this._logAvalanches[i];
      if (!la || !la.active || !la.isReady()) continue;
      const laX = la.structureInstance.x;
      const laY = la.structureInstance.y;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (zombie.x >= laX && zombie.x <= laX + TILE_SIZE &&
            zombie.y >= laY && zombie.y <= laY + TILE_SIZE) {
          if (!la.tryActivate()) break;
          la.triggerRoll();
          // Damage + pushback for all zombies in the line
          const lineEndY = laY + la.lineTiles * TILE_SIZE;
          for (const c2 of this.zombieGroup.getChildren()) {
            const z2 = c2 as Zombie;
            if (!z2.active) continue;
            if (z2.x >= laX - TILE_SIZE / 2 && z2.x <= laX + TILE_SIZE * 1.5 &&
                z2.y >= laY && z2.y <= lineEndY) {
              la.onZombieContact(z2);
            }
          }
          this.trapEmitter.emitParticleAt(laX + TILE_SIZE / 2, laY + TILE_SIZE / 2, 10);
          this._logAvalanches.splice(i, 1);
          break;
        }
      }
    }

    // --- Falling Car: single-use spot damage ---
    for (const t of this._fallingCars) t.update(delta);
    for (let i = this._fallingCars.length - 1; i >= 0; i--) {
      const fc = this._fallingCars[i];
      if (!fc || !fc.active || !fc.isReady()) continue;
      const fcX = fc.structureInstance.x;
      const fcY = fc.structureInstance.y;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (zombie.x >= fcX && zombie.x <= fcX + TILE_SIZE &&
            zombie.y >= fcY && zombie.y <= fcY + TILE_SIZE) {
          if (!fc.tryActivate()) break;
          fc.triggerDrop();
          fc.onZombieContact(zombie);
          this.trapEmitter.emitParticleAt(fcX + TILE_SIZE / 2, fcY + TILE_SIZE / 2, 16);
          this._fallingCars.splice(i, 1);
          break;
        }
      }
    }

    // --- Treadmill Blades: continuous 25 dmg/s + pushback ---
    for (const t of this._treadmillBlades) t.update(delta);
    for (const tb of this._treadmillBlades) {
      if (!tb.active || tb.malfunctioned) continue;
      const tbX = tb.structureInstance.x;
      const tbY = tb.structureInstance.y;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (zombie.x >= tbX && zombie.x <= tbX + TILE_SIZE &&
            zombie.y >= tbY && zombie.y <= tbY + TILE_SIZE) {
          // Continuous delta-scaled damage
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Treadmill Blades'; zombie.takeDamage(tb.damagePerSecond * delta / 1000); this._currentKillSource = null;
          // Pushback: push away from belt center (horizontal)
          if (zombie.body) {
            const cx = tbX + TILE_SIZE / 2;
            const dx = zombie.x - cx;
            const len = Math.abs(dx);
            if (len > 0) {
              zombie.body.velocity.x += (dx / len) * tb.pushbackVel;
            }
          }
          tb.triggerActivationEffect();
        }
      }
    }

    // --- Fan Glass: continuous 15 dmg/s in forward cone ---
    for (const t of this._fanGlasses) t.update(delta);
    for (const fg of this._fanGlasses) {
      if (!fg.active || !fg.isReady() || fg.malfunctioned) continue;
      const cx = fg.structureInstance.x + TILE_SIZE / 2;
      const cy = fg.structureInstance.y + TILE_SIZE / 2;
      let hitAny = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        const dx = zombie.x - cx;
        const dy = zombie.y - cy;
        const distSq = dx * dx + dy * dy;
        if (distSq > fg.coneRange * fg.coneRange) continue;
        // Cone check: forward half-plane (zombies come from outside, so angle ~0)
        const angle = Math.atan2(dy, dx);
        const absAngle = Math.abs(angle);
        if (absAngle < fg.coneHalfAngle || Math.abs(angle - Math.PI) < fg.coneHalfAngle || Math.abs(angle + Math.PI) < fg.coneHalfAngle) {
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Fan Glass'; zombie.takeDamage(fg.damagePerSecond * delta / 1000); this._currentKillSource = null;
          hitAny = true;
        }
      }
      if (hitAny) {
        fg.triggerActivationEffect();
      }
    }

    // --- Elevator Shaft: instant kill on zombie contact, cd 15s ---
    for (const t of this._elevatorShafts) t.update(delta);
    for (const es of this._elevatorShafts) {
      if (!es.active || !es.isReady()) continue;
      const esX = es.structureInstance.x;
      const esY = es.structureInstance.y;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (zombie.x >= esX && zombie.x <= esX + TILE_SIZE &&
            zombie.y >= esY && zombie.y <= esY + TILE_SIZE) {
          if (!es.tryActivate()) break;
          es.triggerDrop();
          es.onZombieContact(zombie);
          this.trapEmitter.emitParticleAt(esX + TILE_SIZE / 2, esY + TILE_SIZE / 2, 8);
          break; // one zombie per activation
        }
      }
    }

    // --- Rube Goldberg: chain reaction on contact, cd 20s ---
    for (const t of this._rubeGoldbergs) t.update(delta);
    for (const rg of this._rubeGoldbergs) {
      if (!rg.active || !rg.isReady()) continue;
      const rgX = rg.structureInstance.x;
      const rgY = rg.structureInstance.y;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (zombie.x >= rgX && zombie.x <= rgX + TILE_SIZE &&
            zombie.y >= rgY && zombie.y <= rgY + TILE_SIZE) {
          if (!rg.tryActivate()) break;
          rg.startChain();
          rg.onZombieContact(zombie); // alarm step damage on trigger zombie
          break; // one zombie triggers the chain
        }
      }
    }

    // -----------------------------------------------------------------------
    // Tier 3: Slaughter Machines
    // -----------------------------------------------------------------------

    // --- Meat Grinder: continuous AOE damage in 2-tile radius ---
    for (const t of this._meatGrinders) t.update(delta);
    for (const mg of this._meatGrinders) {
      if (!mg.active || mg.malfunctioned || mg.overheated) continue;

      const mgCX = mg.structureInstance.x + TILE_SIZE / 2;
      const mgCY = mg.structureInstance.y + TILE_SIZE / 2;
      const mgRSq = mg.zoneRadius * mg.zoneRadius;
      let mgAnyInZone = false;

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        const mgDx = zombie.x - mgCX;
        const mgDy = zombie.y - mgCY;
        if (mgDx * mgDx + mgDy * mgDy <= mgRSq) {
          mgAnyInZone = true;
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Meat Grinder'; zombie.takeDamage(mg.damagePerSecond * delta / 1000); this._currentKillSource = null;
        }
      }

      if (mgAnyInZone && mg.cooldownTimer <= 0) {
        mg.tryActivate();
        mg.triggerGoreEffect();
        this.trapEmitter.emitParticleAt(mgCX, mgCY, 6);
      }
    }

    // --- Belt Sander Gauntlet: continuous corridor damage ---
    for (const t of this._beltSanderGauntlets) t.update(delta);
    for (const bsg of this._beltSanderGauntlets) {
      if (!bsg.active || bsg.malfunctioned || bsg.overheated) continue;

      const bsgX = bsg.structureInstance.x;
      const bsgY = bsg.structureInstance.y;
      let bsgContact = false;

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (
          zombie.x >= bsgX && zombie.x <= bsgX + TILE_SIZE &&
          zombie.y >= bsgY && zombie.y <= bsgY + TILE_SIZE
        ) {
          bsgContact = true;
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Belt Sander Gauntlet'; zombie.takeDamage(bsg.damagePerSecond * delta / 1000); this._currentKillSource = null;
        }
      }

      if (bsgContact && bsg.cooldownTimer <= 0) {
        bsg.tryActivate();
        bsg.triggerSparkEffect();
        this.trapEmitter.emitParticleAt(bsgX + TILE_SIZE / 2, bsgY + TILE_SIZE / 2, 5);
      }
    }

    // --- Power Drill Press: single-target slam on contact, cooldown 4s ---
    for (const t of this._powerDrillPresses) t.update(delta);
    for (const pdp of this._powerDrillPresses) {
      if (!pdp.active || !pdp.isReady()) continue;

      const pdpX = pdp.structureInstance.x;
      const pdpY = pdp.structureInstance.y;

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (
          zombie.x >= pdpX && zombie.x <= pdpX + TILE_SIZE &&
          zombie.y >= pdpY && zombie.y <= pdpY + TILE_SIZE
        ) {
          if (!pdp.tryActivate()) break;
          pdp.onZombieContact(zombie);
          this.trapEmitter.emitParticleAt(pdpX + TILE_SIZE / 2, pdpY + TILE_SIZE / 2, 8);
          break; // one target per press
        }
      }
    }

    // --- Piano Wire Web: slash damage on contact, 20 uses ---
    for (const t of this._pianoWireWebs) t.update(delta);
    for (let i = this._pianoWireWebs.length - 1; i >= 0; i--) {
      const pww = this._pianoWireWebs[i];
      if (!pww || !pww.active || !pww.isReady()) continue;

      const pwwX = pww.structureInstance.x;
      const pwwY = pww.structureInstance.y;

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (
          zombie.x >= pwwX && zombie.x <= pwwX + TILE_SIZE &&
          zombie.y >= pwwY && zombie.y <= pwwY + TILE_SIZE
        ) {
          if (!pww.tryActivate()) break;
          pww.onZombieContact(zombie);
          this.trapEmitter.emitParticleAt(pwwX + TILE_SIZE / 2, pwwY + TILE_SIZE / 2, 5);
          if (pww.uses === 0) {
            this._pianoWireWebs.splice(i, 1);
          }
          break;
        }
      }
    }

    // --- Combine Harvester: continuous wide-zone damage (4-tile wide) ---
    for (const t of this._combineHarvesters) t.update(delta);
    for (const ch of this._combineHarvesters) {
      if (!ch.active || ch.malfunctioned || ch.overheated) continue;

      const chCenterX = ch.structureInstance.x + TILE_SIZE / 2;
      const chY = ch.structureInstance.y;
      const chHalfWidth = ch.zoneWidth / 2;
      let chAnyInZone = false;

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (
          Math.abs(zombie.x - chCenterX) <= chHalfWidth &&
          zombie.y >= chY && zombie.y <= chY + TILE_SIZE
        ) {
          chAnyInZone = true;
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Combine Harvester'; zombie.takeDamage(ch.damagePerSecond * delta / 1000); this._currentKillSource = null;
        }
      }

      if (chAnyInZone && ch.cooldownTimer <= 0) {
        ch.tryActivate();
        ch.triggerCarnageEffect();
        this.trapEmitter.emitParticleAt(chCenterX, chY + TILE_SIZE / 2, 10);
      }
    }

    // -----------------------------------------------------------------------
    // Tier 3: Explosive Traps
    // -----------------------------------------------------------------------

    // --- Car Bomb: AOE explosion on contact, 1 use ---
    for (let i = this._carBombs.length - 1; i >= 0; i--) {
      const cb = this._carBombs[i];
      if (!cb || !cb.active || cb.detonated || cb.malfunctioned || cb.uses === 0) continue;

      cb.update(delta);

      const cbX = cb.structureInstance.x;
      const cbY = cb.structureInstance.y;
      let cbTriggered = false;

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (
          zombie.x >= cbX && zombie.x <= cbX + TILE_SIZE &&
          zombie.y >= cbY && zombie.y <= cbY + TILE_SIZE
        ) {
          cbTriggered = true;
          break;
        }
      }

      if (!cbTriggered) continue;
      if (!cb.tryActivate()) continue;

      cb.triggerDetonation();
      const cbCX = cbX + TILE_SIZE / 2;
      const cbCY = cbY + TILE_SIZE / 2;
      const cbRSq = cb.explosionRadius * cb.explosionRadius;
      this.trapEmitter.emitParticleAt(cbCX, cbCY, 20);

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        const cbDx = zombie.x - cbCX;
        const cbDy = zombie.y - cbCY;
        if (cbDx * cbDx + cbDy * cbDy <= cbRSq) {
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Car Bomb'; zombie.takeDamage(cb.explosionDamage); this._currentKillSource = null;
        }
      }

      this._carBombs.splice(i, 1);
    }

    // --- Napalm Sprinkler: continuous cone damage, cd 8s, fuel 4 ---
    for (const t of this._napalmSprinklers) t.update(delta);
    for (const ns of this._napalmSprinklers) {
      if (!ns.active || ns.malfunctioned || ns.overheated) continue;

      let nsAnyInCone = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (ns.isInCone(zombie.x, zombie.y)) { nsAnyInCone = true; break; }
      }

      if (!nsAnyInCone) continue;

      if (ns.cooldownTimer <= 0) {
        ns.tryActivate();
        ns.triggerSpray();
      }

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (ns.isInCone(zombie.x, zombie.y)) {
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Napalm Sprinkler'; zombie.takeDamage(ns.damagePerSecond * delta / 1000); this._currentKillSource = null;
        }
      }
    }

    // --- Gas Main Igniter: full-map-width line explosion, 1 use ---
    for (let i = this._gasMainIgniters.length - 1; i >= 0; i--) {
      const gmi = this._gasMainIgniters[i];
      if (!gmi || !gmi.active || gmi.detonated || gmi.malfunctioned || gmi.uses === 0) continue;

      gmi.update(delta);

      const gmiCY = gmi.structureInstance.y + TILE_SIZE / 2;
      let gmiTriggered = false;

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (Math.abs(zombie.y - gmiCY) <= gmi.detectionBand / 2) {
          gmiTriggered = true;
          break;
        }
      }

      if (!gmiTriggered) continue;
      if (!gmi.tryActivate()) continue;

      gmi.triggerIgnition();

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (Math.abs(zombie.y - gmiCY) <= gmi.detectionBand / 2) {
          gmi.onZombieContact(zombie);
        }
      }

      this.trapEmitter.emitParticleAt(gmi.structureInstance.x + TILE_SIZE / 2, gmiCY, 15);
      this._gasMainIgniters.splice(i, 1);
    }

    // --- Flamethrower Post: continuous cone damage, cd 5s, fuel 3 ---
    for (const t of this._flamethrowerPosts) t.update(delta);
    for (const fp of this._flamethrowerPosts) {
      if (!fp.active || fp.malfunctioned || fp.overheated) continue;

      let fpAnyInCone = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (fp.isInCone(zombie.x, zombie.y)) { fpAnyInCone = true; break; }
      }

      if (!fpAnyInCone) continue;

      if (fp.cooldownTimer <= 0) {
        fp.tryActivate();
        fp.triggerFlame();
      }

      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (fp.isInCone(zombie.x, zombie.y)) {
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Flamethrower Post'; zombie.takeDamage(fp.damagePerSecond * delta / 1000); this._currentKillSource = null;
        }
      }
    }

    // --- Circle Saw Trap: contact damage on tile, cd 3s ---
    for (const t of this._circleSawTraps) t.update(delta);
    for (const cst of this._circleSawTraps) {
      if (!cst.active || !cst.isReady()) continue;
      const csx0 = cst.structureInstance.x;
      const csy0 = cst.structureInstance.y;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (zombie.x >= csx0 && zombie.x <= csx0 + TILE_SIZE && zombie.y >= csy0 && zombie.y <= csy0 + TILE_SIZE) {
          if (!cst.tryActivate()) break;
          cst.onZombieContact(zombie);
          cst.triggerActivationEffect();
          this.trapEmitter.emitParticleAt(csx0 + TILE_SIZE / 2, csy0 + TILE_SIZE / 2, 6);
          break;
        }
      }
    }

    // --- Razor Wire Carousel: continuous AOE ring damage, always-on (overheat) ---
    for (const rwc of this._razorWireCarousels) {
      rwc.update(delta);
      if (!rwc.active || rwc.malfunctioned || rwc.overheated) continue;
      const rcx = rwc.structureInstance.x + TILE_SIZE / 2;
      const rcy = rwc.structureInstance.y + TILE_SIZE / 2;
      const rwcRSq = rwc.aoeRadius * rwc.aoeRadius;
      let rwcAny = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        const dx = zombie.x - rcx;
        const dy = zombie.y - rcy;
        if (dx * dx + dy * dy <= rwcRSq) { zombie.takeDamage(rwc.damagePerSecond * delta / 1000); rwcAny = true; }
      }
      if (rwcAny && rwc.overheatMax > 0) {
        rwc.overheatCurrent += delta;
        if (rwc.overheatCurrent >= rwc.overheatMax) { rwc.overheated = true; rwc.overheatCurrent = rwc.overheatMax; }
      }
    }

    // --- Lawnmower Lane: continuous corridor damage, always-on (overheat) ---
    for (const ll of this._lawnmowerLanes) {
      ll.update(delta);
      if (!ll.active || ll.malfunctioned || ll.overheated) continue;
      let llAny = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (ll.containsPoint(zombie.x, zombie.y)) { zombie.takeDamage(ll.damagePerSecond * delta / 1000); llAny = true; }
      }
      if (llAny && ll.overheatMax > 0) {
        ll.overheatCurrent += delta;
        if (ll.overheatCurrent >= ll.overheatMax) { ll.overheated = true; ll.overheatCurrent = ll.overheatMax; }
      }
    }

    // --- Treadmill of Doom: pushback + chip damage, always-on (overheat) ---
    for (const tod of this._treadmillsOfDoom) {
      tod.update(delta);
      if (!tod.active || tod.malfunctioned || tod.overheated) continue;
      const todX0 = tod.structureInstance.x;
      const todY0 = tod.structureInstance.y;
      let todAny = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (zombie.x >= todX0 && zombie.x <= todX0 + TILE_SIZE && zombie.y >= todY0 && zombie.y <= todY0 + TILE_SIZE) {
          zombie.takeDamage(tod.damagePerSecond * delta / 1000);
          const tcx = todX0 + TILE_SIZE / 2;
          const tcy = todY0 + TILE_SIZE / 2;
          const dx = zombie.x - tcx;
          const dy = zombie.y - tcy;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0 && zombie.body) {
            zombie.setVelocity((dx / len) * tod.pushbackVelocity * 5, (dy / len) * tod.pushbackVelocity * 5);
          }
          todAny = true;
        }
      }
      if (todAny && tod.overheatMax > 0) {
        tod.overheatCurrent += delta;
        if (tod.overheatCurrent >= tod.overheatMax) { tod.overheated = true; tod.overheatCurrent = tod.overheatMax; }
      }
    }

    // --- Pendulum Axe: swing AOE on zombie proximity, cd 5s ---
    for (const t of this._pendulumAxes) t.update(delta);
    for (const pa of this._pendulumAxes) {
      if (!pa.active || !pa.isReady()) continue;
      const pax = pa.structureInstance.x + TILE_SIZE / 2;
      const pay = pa.structureInstance.y + TILE_SIZE / 2;
      const paSq = pa.swingRadius * pa.swingRadius;
      let paTriggered = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        const dx = zombie.x - pax;
        const dy = zombie.y - pay;
        if (dx * dx + dy * dy <= paSq) {
          if (!paTriggered) {
            if (!pa.tryActivate()) break;
            paTriggered = true;
            pa.triggerActivationEffect();
            this.trapEmitter.emitParticleAt(pax, pay, 8);
          }
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Pendulum Axe'; zombie.takeDamage(pa.trapDamage); this._currentKillSource = null;
        }
      }
    }

    // --- Garage Door Smasher: crush on tile contact, cd 8s ---
    for (const t of this._garageDoorSmashers) t.update(delta);
    for (const gds of this._garageDoorSmashers) {
      if (!gds.active || !gds.isReady()) continue;
      const gdx0 = gds.structureInstance.x;
      const gdy0 = gds.structureInstance.y;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (zombie.x >= gdx0 && zombie.x <= gdx0 + TILE_SIZE && zombie.y >= gdy0 && zombie.y <= gdy0 + TILE_SIZE) {
          if (!gds.tryActivate()) break;
          gds.onZombieContact(zombie);
          gds.triggerActivationEffect();
          this.trapEmitter.emitParticleAt(gdx0 + TILE_SIZE / 2, gdy0 + TILE_SIZE / 2, 10);
          break;
        }
      }
    }

    // --- Bug Zapper XL: attract + continuous AOE damage (overheat) ---
    for (const bz of this._bugZapperXLs) {
      bz.update(delta);
      // Power Outage: electric trap is disabled
      if (electricDisabled) continue;
      if (!bz.active || bz.malfunctioned || bz.overheated) continue;
      const bzx = bz.structureInstance.x + TILE_SIZE / 2;
      const bzy = bz.structureInstance.y + TILE_SIZE / 2;
      const bzRSq = bz.aoeRadius * bz.aoeRadius;
      let bzAny = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        const dx = zombie.x - bzx;
        const dy = zombie.y - bzy;
        const distSq = dx * dx + dy * dy;
        if (distSq <= bzRSq) {
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Bug Zapper XL'; zombie.takeDamage(bz.damagePerSecond * delta / 1000); this._currentKillSource = null;
          const dist = Math.sqrt(distSq);
          if (dist > 4 && zombie.body && !zombie.isStunned()) {
            const nx = -dx / dist;
            const ny = -dy / dist;
            const zBody = zombie.body as Phaser.Physics.Arcade.Body;
            zBody.velocity.x = zBody.velocity.x * 0.8 + nx * 80 * 0.2;
            zBody.velocity.y = zBody.velocity.y * 0.8 + ny * 80 * 0.2;
          }
          bzAny = true;
        }
      }
      if (bzAny) {
        bz.triggerZapEffect();
        if (bz.overheatMax > 0) {
          bz.overheatCurrent += delta;
          if (bz.overheatCurrent >= bz.overheatMax) { bz.overheated = true; bz.overheatCurrent = bz.overheatMax; }
        }
      }
    }

    // --- Car Battery Grid: stun all zombies in 3x3 zone, cd 10s ---
    for (const t of this._carBatteryGrids) t.update(delta);
    for (const cbg of this._carBatteryGrids) {
      // Power Outage: electric trap is disabled
      if (electricDisabled) continue;
      if (!cbg.active || !cbg.isReady()) continue;
      let cbgAny = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (cbg.containsPoint(zombie.x, zombie.y)) { cbgAny = true; break; }
      }
      if (!cbgAny || !cbg.tryActivate()) continue;
      cbg.triggerDischargeEffect();
      this.shockEmitter.emitParticleAt(cbg.structureInstance.x + cbg.zoneSize / 2, cbg.structureInstance.y + TILE_SIZE / 2, 15);
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (cbg.containsPoint(zombie.x, zombie.y)) zombie.applyStun(cbg.stunDuration);
      }
    }

    // --- Electric Fence: continuous damage + physics block via wallBodies ---
    for (const ef of this._electricFences) {
      ef.update(delta);
      // Power Outage: electric trap is disabled
      if (electricDisabled) continue;
      if (!ef.active || ef.malfunctioned || ef.overheated) continue;
      const efx0 = ef.structureInstance.x;
      const efy0 = ef.structureInstance.y;
      let efAny = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (zombie.x >= efx0 - 4 && zombie.x <= efx0 + TILE_SIZE + 4 && zombie.y >= efy0 - 4 && zombie.y <= efy0 + TILE_SIZE + 4) {
          this._currentKillSource = 'trap'; this._currentKillTrapName = 'Electric Fence'; zombie.takeDamage(ef.damagePerSecond * delta / 1000); this._currentKillSource = null;
          efAny = true;
        }
      }
      if (efAny) {
        ef.triggerContactEffect();
        if (ef.overheatMax > 0) {
          ef.overheatCurrent += delta;
          if (ef.overheatCurrent >= ef.overheatMax) { ef.overheated = true; ef.overheatCurrent = ef.overheatMax; }
        }
      }
    }

    // --- Net Launcher: immobilize all zombies in 3x3 AOE, cd 12s ---
    for (const t of this._netLaunchers) t.update(delta);
    for (const nl of this._netLaunchers) {
      if (!nl.active || !nl.isReady()) continue;
      let nlAny = false;
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (nl.containsPoint(zombie.x, zombie.y)) { nlAny = true; break; }
      }
      if (!nlAny || !nl.tryActivate()) continue;
      nl.triggerNetDeployEffect();
      this.trapEmitter.emitParticleAt(nl.structureInstance.x + TILE_SIZE / 2, nl.structureInstance.y + TILE_SIZE / 2, 12);
      for (const child of this.zombieGroup.getChildren()) {
        const zombie = child as Zombie;
        if (!zombie.active) continue;
        if (nl.containsPoint(zombie.x, zombie.y)) zombie.applyStun(nl.immobilizeDuration);
      }
    }

    // --- Repair mechanic: player holds E near a malfunctioned TrapBase trap ---
    this.updateRepairMechanic(delta);
  }

  /**
   * Allow the player to repair a malfunctioned mechanical trap by standing near it
   * and holding the E key for 2 seconds. Costs 1 parts.
   */
  private updateRepairMechanic(delta: number): void {
    if (!this._repairKey) return;

    const allMechanical: TrapBase[] = [
      ...this._bladeSpinners,
      ...this._firePits,
      ...this._propaneGeysers,
      ...this._washingCannons,
      ...this._pitTraps,
      ...this._shockWires,
      ...this._springLaunchers,
      ...this._chainWalls,
      ...this._tractorWheelRollers,
      ...this._wreckingBalls,
      ...this._logAvalanches,
      ...this._fallingCars,
      ...this._treadmillBlades,
      ...this._fanGlasses,
      ...this._elevatorShafts,
      ...this._rubeGoldbergs,
      ...this._circleSawTraps,
      ...this._razorWireCarousels,
      ...this._lawnmowerLanes,
      ...this._treadmillsOfDoom,
      ...this._pendulumAxes,
      ...this._garageDoorSmashers,
      ...this._bugZapperXLs,
      ...this._carBatteryGrids,
      ...this._electricFences,
      ...this._netLaunchers,
      // Tier 3
      ...this._meatGrinders,
      ...this._beltSanderGauntlets,
      ...this._powerDrillPresses,
      ...this._pianoWireWebs,
      ...this._combineHarvesters,
      ...this._carBombs,
      ...this._napalmSprinklers,
      ...this._gasMainIgniters,
      ...this._flamethrowerPosts,
    ];

    const REPAIR_RANGE = 40;
    const REPAIR_TIME  = 2000; // ms
    const REPAIR_COST  = { parts: 1 } as const;

    const eDown = this._repairKey.isDown;

    if (!eDown) {
      // Cancel any in-progress repair
      if (this._repairTarget) {
        this._repairTarget.isBeingRepaired = false;
        this._repairTarget.repairProgress  = 0;
        this._repairTarget = null;
        if (this._repairProgressBar) {
          this._repairProgressBar.destroy();
          this._repairProgressBar = null;
        }
      }
      return;
    }

    // Find the nearest malfunctioned trap within repair range
    let nearest: TrapBase | null = null;
    let nearestDist = REPAIR_RANGE + 1;

    for (const trap of allMechanical) {
      if (!trap.active || !trap.malfunctioned) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        trap.structureInstance.x + TILE_SIZE / 2,
        trap.structureInstance.y + TILE_SIZE / 2,
      );
      if (dist < nearestDist) {
        nearest = trap;
        nearestDist = dist;
      }
    }

    // If player moved away from the previous target, cancel
    if (this._repairTarget && this._repairTarget !== nearest) {
      this._repairTarget.isBeingRepaired = false;
      this._repairTarget.repairProgress  = 0;
      this._repairTarget = null;
      if (this._repairProgressBar) {
        this._repairProgressBar.destroy();
        this._repairProgressBar = null;
      }
    }

    if (!nearest) return;

    // Start or continue repair
    this._repairTarget = nearest;
    nearest.isBeingRepaired = true;
    nearest.repairProgress  = (nearest.repairProgress ?? 0) + delta;

    // Draw progress bar above trap
    if (!this._repairProgressBar) {
      this._repairProgressBar = this.add.graphics().setDepth(60);
    }
    const bar = this._repairProgressBar;
    bar.clear();
    const bx = nearest.structureInstance.x;
    const by = nearest.structureInstance.y - 16;
    const progress = Math.min(nearest.repairProgress / REPAIR_TIME, 1);
    bar.fillStyle(0x333333);
    bar.fillRect(bx, by, TILE_SIZE, 5);
    bar.fillStyle(0x44FF44);
    bar.fillRect(bx, by, Math.round(TILE_SIZE * progress), 5);

    // Check completion
    if (nearest.repairProgress >= REPAIR_TIME) {
      // Check resource availability
      if (!this.resourceManager.canAfford({ parts: REPAIR_COST.parts })) {
        // Can't afford repair -- show message and cancel
        this.hud.showMessage('Need 1 PARTS to repair!');
        this.gameLog.addMessage('Need 1 PARTS to repair!', '#FF8C00');
        this.showFloatingText(this.player.x, this.player.y - 20, 'Need 1 PARTS!');
        nearest.isBeingRepaired = false;
        nearest.repairProgress  = 0;
        this._repairTarget = null;
        bar.destroy();
        this._repairProgressBar = null;
        return;
      }
      this.resourceManager.spend('parts', REPAIR_COST.parts);
      nearest.repair();
      this.showFloatingText(nearest.structureInstance.x + TILE_SIZE / 2, nearest.structureInstance.y - 24, 'Repaired!');
      this._repairTarget = null;
      bar.destroy();
      this._repairProgressBar = null;
    }
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

    // Shock Wire discharge: blue/white sparks emitted on activation
    if (!this.textures.exists('particle_blue')) {
      const bg = this.make.graphics({ x: 0, y: 0 });
      bg.fillStyle(0x66CCFF);
      bg.fillCircle(2, 2, 2);
      bg.generateTexture('particle_blue', 4, 4);
      bg.destroy();
    }
    this.shockEmitter = this.add.particles(0, 0, 'particle_blue', {
      speed: { min: 80, max: 220 },
      angle: { min: 0, max: 360 },
      lifespan: 250,
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: { onEmit: () => (Math.random() > 0.5 ? 0x44AAFF : 0xFFFFCC) },
      emitting: false,
    });
    this.shockEmitter.setDepth(8);

    // Nail Board blood: small red burst on hit
    this.nailBloodEmitter = this.add.particles(0, 0, 'particle_red', {
      speed: { min: 30, max: 90 },
      angle: { min: 160, max: 380 },
      lifespan: 300,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: 0xAA0000,
      emitting: false,
    });
    this.nailBloodEmitter.setDepth(6);
  }

  private setupLighting(): void {
    // Night uses same terrain as day -- no overlays, no glow, no vignette.
    // Darkness comes from a slightly darker background color.
    const nightNumber = this.gameState.progress.currentWave;
    const isBossNight = nightNumber >= 5;

    if (isBossNight) {
      // Boss night: noticeably darker with a reddish-brown tint
      this.cameras.main.setBackgroundColor('#150A0A');

      // Semi-transparent red overlay -- very subtle at first, pulses via updateLighting()
      // Note from LESSONS.md: NEVER use full-canvas RenderTexture. Use a scroll-fixed Graphics.
      this.bossNightOverlay = this.add.graphics();
      this.bossNightOverlay.setDepth(95); // below damage overlay (99) but above terrain
      this.bossNightOverlay.setScrollFactor(0);
      this.bossNightOverlay.setAlpha(0);
      this.bossNightTime = 0;
    } else {
      this.cameras.main.setBackgroundColor('#1E3216');
    }
  }

  private updateLighting(): void {
    // Boss-night red pulse: overlay alpha oscillates between 0 and a growing maximum.
    // Intensity ramps up slowly over the first 60 seconds so it starts subtle.
    if (!this.bossNightOverlay) return;

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Maximum alpha grows from 0 to 0.18 over 90 seconds then holds
    const rampFactor = Math.min(this.bossNightTime / 90000, 1);
    const maxAlpha = 0.04 + rampFactor * 0.14; // 0.04 at start, up to 0.18 at 90s

    // Slow pulse: sin wave at ~0.15 Hz (one full pulse every ~6.5s)
    const pulse = 0.5 + 0.5 * Math.sin(this.bossNightTime * 0.00095);
    const alpha = maxAlpha * pulse;

    this.bossNightOverlay.clear();
    this.bossNightOverlay.fillStyle(0x8B0000, 1); // dark red
    this.bossNightOverlay.fillRect(0, 0, w, h);
    this.bossNightOverlay.setAlpha(alpha);
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
    // Debrief: count only one breakthrough per wave (not once per hit)
    if (!this.waveBreachCounted) {
      this.breakthroughCount++;
      this.waveBreachCounted = true;
    }
    this.hud.updateBaseHpBar(this.baseHp, this.baseMaxHp);
    // Throttled to max once per 5 seconds so the log doesn't spam
    this.gameLog.addBaseDamageMessage();
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

    // Panel dimensions -- extra height to fit restart info block
    const panelW = 340;
    const panelH = 340;
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

    // Parallel universe flavour text
    const flavorText = this.add.text(GAME_WIDTH / 2, py + 130,
      'In a parallel universe,\nyou live to fight another night.', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B8B6B',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5, 0);
    container.add(flavorText);

    // Restart info: day resets but progression is kept
    const restartHeaderText = this.add.text(GAME_WIDTH / 2, py + 170, 'You will restart at Day 1', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#E8B84B',
    }).setOrigin(0.5);
    container.add(restartHeaderText);

    // Three lines listing what is preserved after death
    const keptLines = [
      'All gear & weapons kept',
      'Skills & XP kept',
      'Refugees & base kept',
    ];
    const keptText = this.add.text(
      GAME_WIDTH / 2,
      py + 192,
      keptLines.join('\n'),
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#4CAF50',
        align: 'center',
        lineSpacing: 6,
      }
    ).setOrigin(0.5, 0);
    container.add(keptText);

    // Continue prompt -- hidden until ready
    const continueText = this.add.text(GAME_WIDTH / 2, py + panelH - 22, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    }).setOrigin(0.5);
    container.add(continueText);

    // Make the panel clickable
    panel.setInteractive(
      new Phaser.Geom.Rectangle(px, py, panelW, panelH),
      Phaser.Geom.Rectangle.Contains,
    );

    const goToDay = () => {
      this.scene.start('DayScene');
    };

    // Short delay to prevent accidental skip from shooting
    this.time.delayedCall(800, () => {
      continueText.setText('Click or press any key');
      this.tweens.add({
        targets: continueText,
        alpha: 0.3,
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
      panel.on('pointerdown', goToDay);
      const keyHandler = (_evt: KeyboardEvent) => { goToDay(); };
      this.input.keyboard?.on('keydown', keyHandler);
      container.once('destroy', () => {
        this.input.keyboard?.off('keydown', keyHandler);
      });
    });
  }

  private showTutorialOverlay(): void {
    const steps = [
      { title: 'MOVE', text: 'Use WASD or arrow keys\nto move your character.' },
      { title: 'SHOOT', text: 'Melee: auto-attacks nearby.\nRanged: click/SPACE to fire.' },
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

  /**
   * Show a dramatic "FINAL NIGHT" banner when wave 5 starts.
   * Includes camera shake, darkened full-screen backdrop, and pulsing red text.
   */
  private showFinalNightBanner(): void {
    const cx = GAME_WIDTH / 2;
    const cy = 110;

    const container = this.add.container(0, 0).setDepth(180).setScrollFactor(0);

    // Deep doom sound for final night dread
    AudioManager.play('final_night_start');

    // Camera shake for physical impact on banner display
    this.cameras.main.shake(600, 0.012);

    // Full-screen dark overlay behind the bar -- fades in then out with banner
    const overlay = this.add.graphics().setScrollFactor(0).setDepth(179).setAlpha(0);
    overlay.fillStyle(0x000000, 0.5);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    });

    // Background bar -- thicker and more opaque than before
    const bar = this.add.graphics();
    bar.fillStyle(0x1E0000, 0.96);
    bar.fillRect(0, cy - 44, GAME_WIDTH, 88);
    // Bright red accent lines on top and bottom
    bar.lineStyle(2, 0xFF2200, 0.85);
    bar.lineBetween(0, cy - 44, GAME_WIDTH, cy - 44);
    bar.lineBetween(0, cy + 44, GAME_WIDTH, cy + 44);
    container.add(bar);

    // Sub-text: "WAVE 5 OF 5" -- fades in slightly after bar appears
    const subText = this.add.text(cx, cy - 24, 'WAVE 5 OF 5', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#AA3322',
    }).setOrigin(0.5, 0.5).setAlpha(0);
    container.add(subText);

    this.tweens.add({
      targets: subText,
      alpha: 1,
      duration: 250,
      delay: 150,
      ease: 'Power2',
    });

    // Main "FINAL NIGHT" text -- scale-in with dramatic bounce
    const mainText = this.add.text(cx, cy + 10, 'FINAL NIGHT', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '22px',
      color: '#FF2200',
    }).setOrigin(0.5, 0.5).setScale(0.5);
    container.add(mainText);

    this.tweens.add({
      targets: mainText,
      scaleX: 1,
      scaleY: 1,
      duration: 320,
      ease: 'Back.easeOut',
    });

    // Pulsing red text effect -- starts after scale-in settles
    this.time.delayedCall(370, () => {
      this.tweens.add({
        targets: mainText,
        alpha: { from: 1.0, to: 0.45 },
        duration: 420,
        yoyo: true,
        repeat: 4,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          // Ensure fully visible before final fade-out
          mainText.setAlpha(1);
        },
      });
    });

    // Fade out banner + overlay after 2.8s
    this.tweens.add({
      targets: container,
      alpha: 0,
      delay: 2800,
      duration: 700,
      ease: 'Power2',
      onComplete: () => container.destroy(),
    });

    this.tweens.add({
      targets: overlay,
      alpha: 0,
      delay: 2800,
      duration: 700,
      ease: 'Power2',
      onComplete: () => overlay.destroy(),
    });
  }

  /**
   * Unlock the next zone based on completion of the current one.
   * Forest -> City, City -> Military.
   * Only sets the initial zoneProgress entry; does NOT change the active zone.
   */
  private unlockNextZone(clearedZone: string): void {
    if (clearedZone === 'forest') {
      // City is now playable -- ensure it has an entry so the menu can show it
      if (!this.gameState.zoneProgress['city']) {
        this.gameState.zoneProgress['city'] = { highestWaveCleared: 0 };
      }
    } else if (clearedZone === 'city') {
      if (!this.gameState.zoneProgress['military']) {
        this.gameState.zoneProgress['military'] = { highestWaveCleared: 0 };
      }
    } else if (clearedZone === 'military') {
      // Endless mode unlocked after clearing Military
      if (!this.gameState.zoneProgress['endless']) {
        this.gameState.zoneProgress['endless'] = { highestWaveCleared: 0 };
      }
    }
  }

  /**
   * Build a NightStats object from all tracking variables accumulated this night.
   * Used to populate ResultScene with detailed debrief information.
   */
  private buildNightStats(isEndless: boolean): import('../config/types').NightStats {
    // Sort trap kills map by kills descending, take top 3.
    // Map is now keyed by trap type name so kills from all instances of the same trap type are merged.
    const topTraps = Array.from(this.trapKillMap.entries())
      .map(([trapId, data]) => ({ trapId, trapName: data.name, kills: data.kills }))
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 3);

    return {
      kills: this.kills,
      trapKills: this.trapKills,
      weaponKills: this.weaponKills,
      topTraps,
      breakthroughs: this.breakthroughCount,
      structuresDestroyed: [...this.destroyedStructures],
      ammoUsedStart: this.ammoAtNightStart,
      ammoUsedEnd: this.loadedAmmo,
      baseHpStart: this.baseMaxHp,
      baseHpEnd: this.baseHp,
      baseHpMax: this.baseMaxHp,
      wave: this.waveManager.getMaxWaves(),
      survived: true,
      endlessNight: isEndless ? this.gameState.endlessNight : undefined,
      bossKills: this.bossKillsThisNight,
    };
  }
}
