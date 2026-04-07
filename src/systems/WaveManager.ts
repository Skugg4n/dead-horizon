import Phaser from 'phaser';
import { Zombie } from '../entities/Zombie';
import type { ZombieConfig, ZoneId } from '../entities/Zombie';
import type { PathGrid } from './PathGrid';
import enemiesData from '../data/enemies.json';
import defaultWavesData from '../data/waves.json';
import { AudioManager } from './AudioManager';

interface WaveEnemyDef {
  type: string;
  count: number;
  spawnDelay: number;
}

interface WaveDef {
  wave: number;
  enemies: WaveEnemyDef[];
}

export interface WaveDataSource {
  waves: WaveDef[];
}

export class WaveManager {
  private scene: Phaser.Scene;
  private zombieGroup: Phaser.Physics.Arcade.Group;
  private currentWave: number = 1;
  private enemiesRemaining: number = 0;
  private enemiesSpawned: number = 0;
  private totalEnemiesInWave: number = 0;
  private spawnTimers: Phaser.Time.TimerEvent[] = [];
  private waveActive: boolean = false;
  private spawnZones: { x: number; y: number }[] = [];
  private target: Phaser.GameObjects.Sprite | null = null;
  private basePosition: { x: number; y: number } | null = null;
  private wavesData: WaveDataSource;
  private hordeMultiplier: number = 1.0;
  // Endless mode scaling: applied per-zombie on spawn
  private hpScaleMultiplier: number = 1.0;
  private speedScaleMultiplier: number = 1.0;
  private mapWidth: number = 0;
  private mapHeight: number = 0;
  // Optional shared PathGrid for zombie steering around walls
  private pathGrid: PathGrid | null = null;
  // Max waves for this night (dynamically set from NightScene based on night number)
  private maxWaves: number = 5;
  // Current zone -- used for zone tints and tunnel_zombie spawn logic
  private zone: ZoneId = 'forest';
  // Radius around base center used for tunnel_zombie inside-base spawning
  private baseSpawnRadius: number = 120;

  constructor(scene: Phaser.Scene, zombieGroup: Phaser.Physics.Arcade.Group, wavesData?: WaveDataSource) {
    this.scene = scene;
    this.zombieGroup = zombieGroup;
    this.wavesData = wavesData ?? defaultWavesData;
  }

  /** Set the current zone so spawned zombies receive zone tints and tunnel spawn positions */
  setZone(zone: ZoneId): void {
    this.zone = zone;
  }

  /** Set the radius used when spawning tunnel_zombies inside the base perimeter */
  setBaseSpawnRadius(radius: number): void {
    this.baseSpawnRadius = radius;
  }

  setHordeMultiplier(multiplier: number): void {
    this.hordeMultiplier = multiplier;
  }

  /** Apply HP and speed scaling for Endless mode (accumulates per endless night) */
  setEndlessScaling(hpScale: number, speedScale: number): void {
    this.hpScaleMultiplier = hpScale;
    this.speedScaleMultiplier = speedScale;
  }

  setTarget(target: Phaser.GameObjects.Sprite): void {
    this.target = target;
  }

  setBasePosition(x: number, y: number): void {
    this.basePosition = { x, y };
  }

  setSpawnZones(zones: { x: number; y: number }[]): void {
    this.spawnZones = zones;
  }

  /** Set map pixel dimensions for wanderer boundary calculations */
  setMapSize(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
  }

  /** Provide the shared PathGrid so newly spawned zombies receive it */
  setPathGrid(grid: PathGrid): void {
    this.pathGrid = grid;
  }

  getCurrentWave(): number {
    return this.currentWave;
  }

  isWaveActive(): boolean {
    return this.waveActive;
  }

  startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.waveActive = true;
    this.enemiesSpawned = 0;

    const waveDef = (this.wavesData.waves as WaveDef[]).find(w => w.wave === waveNumber);
    if (!waveDef) {
      // No more waves defined -- victory
      this.scene.events.emit('all-waves-complete');
      return;
    }

    // Count total enemies (apply horde multiplier)
    this.totalEnemiesInWave = waveDef.enemies.reduce((sum, e) => {
      return sum + Math.round(e.count * this.hordeMultiplier);
    }, 0);
    this.enemiesRemaining = this.totalEnemiesInWave;

    this.scene.events.emit('wave-started', waveNumber);

    // Schedule spawns for each enemy type
    for (const enemyDef of waveDef.enemies) {
      const enemyData = enemiesData.enemies.find(e => e.id === enemyDef.type);
      if (!enemyData) continue;

      const adjustedCount = Math.round(enemyDef.count * this.hordeMultiplier);
      for (let i = 0; i < adjustedCount; i++) {
        const timer = this.scene.time.delayedCall(
          enemyDef.spawnDelay * (i + 1),
          () => this.spawnEnemy(enemyData as ZombieConfig),
        );
        this.spawnTimers.push(timer);
      }
    }
  }

  /** Add an extra enemy to the wave tracking (e.g. from screamer spawns) */
  addExtraEnemy(): void {
    this.enemiesRemaining++;
    this.totalEnemiesInWave++;
  }

  /** Set the maximum number of waves for this night (dynamic per night number) */
  setMaxWaves(max: number): void {
    this.maxWaves = max;
  }

  getMaxWaves(): number {
    return this.maxWaves;
  }

  onEnemyKilled(): void {
    this.enemiesRemaining--;

    if (this.enemiesRemaining <= 0 && this.waveActive) {
      this.waveActive = false;
      this.scene.events.emit('wave-complete', this.currentWave);

      // Trigger all-waves-complete after a short pause so player sees the last kill
      if (this.currentWave >= this.maxWaves) {
        this.scene.time.delayedCall(1500, () => {
          this.scene.events.emit('all-waves-complete');
        });
      }
    }
  }

  private spawnEnemy(config: ZombieConfig): void {
    // Apply endless mode scaling to HP and speed (only when scaling > 1.0)
    if (this.hpScaleMultiplier !== 1.0 || this.speedScaleMultiplier !== 1.0) {
      config = {
        ...config,
        hp: Math.round(config.hp * this.hpScaleMultiplier),
        speed: config.speed * this.speedScaleMultiplier,
      };
    }

    // Determine spawn position
    // tunnel_zombie spawns INSIDE the base perimeter (not from map edges)
    let spawnX: number;
    let spawnY: number;

    const isTunnelZombie = config.behavior === 'tunnel_zombie';

    if (isTunnelZombie && this.basePosition) {
      // Spawn at a random angle inside the base spawn radius
      const angle = Math.random() * Math.PI * 2;
      const radius = this.baseSpawnRadius * (0.3 + Math.random() * 0.7);
      spawnX = this.basePosition.x + Math.cos(angle) * radius;
      spawnY = this.basePosition.y + Math.sin(angle) * radius;
    } else {
      if (this.spawnZones.length === 0) return;
      // Pick random spawn zone at map edge
      const zone = this.spawnZones[Math.floor(Math.random() * this.spawnZones.length)];
      if (!zone) return;
      const offsetX = (Math.random() - 0.5) * 100;
      const offsetY = (Math.random() - 0.5) * 100;
      spawnX = zone.x + offsetX;
      spawnY = zone.y + offsetY;
    }

    // 70% base seekers, 30% flanking wanderers. Brutes/bosses/tunnel always seek base.
    const isBruteOrBoss =
      config.behavior === 'brute' ||
      config.behavior === 'boss' ||
      config.behavior === 'forest_boss' ||
      config.behavior === 'city_boss' ||
      config.behavior === 'military_tank' ||
      config.behavior === 'tunnel_zombie';
    const aggroType: 'base_seeker' | 'wanderer' =
      isBruteOrBoss ? 'base_seeker' : (Math.random() < 0.3 ? 'wanderer' : 'base_seeker');

    // Play tunnel zombie emergence sound before the zombie surfaces
    if (isTunnelZombie) {
      AudioManager.play('zombie_tunnel');
    }

    // Notify the scene when a boss is about to spawn so it can play boss-spawn sounds
    const isBossType =
      config.behavior === 'boss' ||
      config.behavior === 'forest_boss' ||
      config.behavior === 'city_boss' ||
      config.behavior === 'military_tank';
    if (isBossType) {
      this.scene.events.emit('boss-spawning');
    }

    // Try to reuse an inactive zombie from the pool
    const existing = this.zombieGroup.getFirstDead(false) as Zombie | null;
    if (existing) {
      existing.reset(spawnX, spawnY, config);
      if (this.target) existing.setTarget(this.target);
      if (this.basePosition) existing.setBasePosition(this.basePosition.x, this.basePosition.y);
      existing.aggroType = aggroType;
      if (this.mapWidth && this.mapHeight) existing.setMapSize(this.mapWidth, this.mapHeight);
      if (this.pathGrid) existing.setPathGrid(this.pathGrid);
      // Apply zone-specific visual tint
      existing.applyZoneTint(this.zone);
      // Emit so external systems (e.g. NightEventManager Blood Moon) can modify the zombie
      this.scene.events.emit('zombie-spawned', existing);
    } else {
      const zombie = new Zombie(this.scene, spawnX, spawnY, config);
      if (this.target) zombie.setTarget(this.target);
      if (this.basePosition) zombie.setBasePosition(this.basePosition.x, this.basePosition.y);
      zombie.aggroType = aggroType;
      if (this.mapWidth && this.mapHeight) zombie.setMapSize(this.mapWidth, this.mapHeight);
      if (this.pathGrid) zombie.setPathGrid(this.pathGrid);
      // Apply zone-specific visual tint
      zombie.applyZoneTint(this.zone);
      this.zombieGroup.add(zombie);
      // Emit so external systems (e.g. NightEventManager Blood Moon) can modify the zombie
      this.scene.events.emit('zombie-spawned', zombie);
    }

    this.enemiesSpawned++;
  }

  destroy(): void {
    for (const timer of this.spawnTimers) {
      timer.destroy();
    }
    this.spawnTimers = [];
  }
}
