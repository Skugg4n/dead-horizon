import Phaser from 'phaser';
import { Zombie } from '../entities/Zombie';
import type { ZombieConfig } from '../entities/Zombie';
import enemiesData from '../data/enemies.json';
import wavesData from '../data/waves.json';

interface WaveEnemyDef {
  type: string;
  count: number;
  spawnDelay: number;
}

interface WaveDef {
  wave: number;
  enemies: WaveEnemyDef[];
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

  constructor(scene: Phaser.Scene, zombieGroup: Phaser.Physics.Arcade.Group) {
    this.scene = scene;
    this.zombieGroup = zombieGroup;
  }

  setTarget(target: Phaser.GameObjects.Sprite): void {
    this.target = target;
  }

  setSpawnZones(zones: { x: number; y: number }[]): void {
    this.spawnZones = zones;
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

    const waveDef = (wavesData.waves as WaveDef[]).find(w => w.wave === waveNumber);
    if (!waveDef) {
      // No more waves defined -- victory
      this.scene.events.emit('all-waves-complete');
      return;
    }

    // Count total enemies
    this.totalEnemiesInWave = waveDef.enemies.reduce((sum, e) => sum + e.count, 0);
    this.enemiesRemaining = this.totalEnemiesInWave;

    this.scene.events.emit('wave-started', waveNumber);

    // Schedule spawns for each enemy type
    for (const enemyDef of waveDef.enemies) {
      const enemyData = enemiesData.enemies.find(e => e.id === enemyDef.type);
      if (!enemyData) continue;

      for (let i = 0; i < enemyDef.count; i++) {
        const timer = this.scene.time.delayedCall(
          enemyDef.spawnDelay * (i + 1),
          () => this.spawnEnemy(enemyData),
        );
        this.spawnTimers.push(timer);
      }
    }
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

    // Try to reuse an inactive zombie from the pool
    const existing = this.zombieGroup.getFirstDead(false) as Zombie | null;
    if (existing) {
      existing.reset(zone.x + offsetX, zone.y + offsetY, config);
      if (this.target) existing.setTarget(this.target);
    } else {
      const zombie = new Zombie(this.scene, zone.x + offsetX, zone.y + offsetY, config);
      if (this.target) zombie.setTarget(this.target);
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
