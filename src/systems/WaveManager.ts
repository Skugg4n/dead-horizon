import Phaser from 'phaser';
import { Zombie } from '../entities/Zombie';
import type { ZombieConfig } from '../entities/Zombie';
import enemiesData from '../data/enemies.json';
import defaultWavesData from '../data/waves.json';

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
  private mapWidth: number = 0;
  private mapHeight: number = 0;

  constructor(scene: Phaser.Scene, zombieGroup: Phaser.Physics.Arcade.Group, wavesData?: WaveDataSource) {
    this.scene = scene;
    this.zombieGroup = zombieGroup;
    this.wavesData = wavesData ?? defaultWavesData;
  }

  setHordeMultiplier(multiplier: number): void {
    this.hordeMultiplier = multiplier;
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

  onEnemyKilled(): void {
    this.enemiesRemaining--;

    if (this.enemiesRemaining <= 0 && this.waveActive) {
      this.waveActive = false;
      this.scene.events.emit('wave-complete', this.currentWave);

      if (this.currentWave >= 5) {
        this.scene.events.emit('all-waves-complete');
      }
    }
  }

  private spawnEnemy(config: ZombieConfig): void {
    if (this.spawnZones.length === 0) return;

    // Pick random spawn zone
    const zone = this.spawnZones[Math.floor(Math.random() * this.spawnZones.length)];
    if (!zone) return;

    // Add some randomness to spawn position
    const offsetX = (Math.random() - 0.5) * 100;
    const offsetY = (Math.random() - 0.5) * 100;

    // F5: 70% base seekers, 30% wanderers -- determined at spawn time
    // Brutes and bosses always go for the base (structural damage focus)
    const forceBaseSeeking = config.behavior === 'brute' || config.behavior === 'boss';
    const aggroType: 'base_seeker' | 'wanderer' =
      (!forceBaseSeeking && Math.random() < 0.3) ? 'wanderer' : 'base_seeker';

    // Map size for wanderer boundary calculations
    const mapWidth = this.mapWidth;
    const mapHeight = this.mapHeight;

    // Try to reuse an inactive zombie from the pool
    const existing = this.zombieGroup.getFirstDead(false) as Zombie | null;
    if (existing) {
      existing.reset(zone.x + offsetX, zone.y + offsetY, config);
      if (this.target) existing.setTarget(this.target);
      if (this.basePosition) existing.setBasePosition(this.basePosition.x, this.basePosition.y);
      existing.aggroType = aggroType;
      if (mapWidth && mapHeight) existing.setMapSize(mapWidth, mapHeight);
    } else {
      const zombie = new Zombie(this.scene, zone.x + offsetX, zone.y + offsetY, config);
      if (this.target) zombie.setTarget(this.target);
      if (this.basePosition) zombie.setBasePosition(this.basePosition.x, this.basePosition.y);
      zombie.aggroType = aggroType;
      if (mapWidth && mapHeight) zombie.setMapSize(mapWidth, mapHeight);
      this.zombieGroup.add(zombie);
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
