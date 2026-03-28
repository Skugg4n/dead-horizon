import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { Projectile } from '../entities/Projectile';
import { WaveManager } from '../systems/WaveManager';
import { SaveManager } from '../systems/SaveManager';
import { HUD } from '../ui/HUD';
import { TILE_SIZE } from '../config/constants';
import { distanceBetween, angleBetween } from '../utils/math';

const MAP_WIDTH = 40;  // tiles
const MAP_HEIGHT = 30; // tiles
const AUTO_SHOOT_RANGE = 200;
const AUTO_SHOOT_COOLDOWN = 400; // ms
const PROJECTILE_DAMAGE = 10;

export class NightScene extends Phaser.Scene {
  private player!: Player;
  private zombieGroup!: Phaser.Physics.Arcade.Group;
  private projectileGroup!: Phaser.Physics.Arcade.Group;
  private waveManager!: WaveManager;
  private hud!: HUD;
  private shootCooldown: number = 0;
  private kills: number = 0;
  private gameState = SaveManager.load();

  constructor() {
    super({ key: 'NightScene' });
  }

  create(): void {
    this.kills = 0;
    this.shootCooldown = 0;

    this.createMap();
    this.createPlayer();
    this.createGroups();
    this.setupWaveManager();
    this.setupCollisions();
    this.setupCamera();
    this.setupEvents();

    this.hud = new HUD(this);

    // Start wave 1 after a brief delay
    this.time.delayedCall(1500, () => {
      this.waveManager.startWave(this.gameState.progress.currentWave);
    });
  }

  update(_time: number, delta: number): void {
    this.player.update(delta);
    this.hud.updateStaminaBar(this.player.stamina, this.player.maxStamina);

    // Update zombies
    this.zombieGroup.getChildren().forEach(child => {
      const zombie = child as Zombie;
      if (zombie.active) {
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

    // Auto-shoot
    this.shootCooldown = Math.max(0, this.shootCooldown - delta);
    if (this.shootCooldown <= 0) {
      this.tryAutoShoot();
    }
  }

  private createMap(): void {
    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;

    // Ground (dark green grass)
    const ground = this.add.graphics();
    ground.fillStyle(0x2D4A22);
    ground.fillRect(0, 0, mapPixelWidth, mapPixelHeight);

    // Horizontal road through the middle
    const roadY = Math.floor(MAP_HEIGHT / 2) * TILE_SIZE;
    const road = this.add.graphics();
    road.fillStyle(0x5C4033);
    road.fillRect(0, roadY - TILE_SIZE, mapPixelWidth, TILE_SIZE * 2);

    // Road markings
    const markings = this.add.graphics();
    markings.fillStyle(0x6B6B6B);
    for (let x = 0; x < mapPixelWidth; x += TILE_SIZE * 2) {
      markings.fillRect(x + 8, roadY - 2, TILE_SIZE - 8, 4);
    }

    // Base tent in center
    const centerX = mapPixelWidth / 2;
    const centerY = mapPixelHeight / 2;
    const tent = this.add.graphics();
    tent.fillStyle(0x6B6B6B);
    tent.fillRect(centerX - 24, centerY - 24, 48, 48);
    tent.lineStyle(2, 0xE8DCC8);
    tent.strokeRect(centerX - 24, centerY - 24, 48, 48);

    // Label
    this.add.text(centerX, centerY - 32, 'BASE', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#E8DCC8',
    }).setOrigin(0.5);

    // Set world bounds
    this.physics.world.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
  }

  private createPlayer(): void {
    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;
    this.player = new Player(this, mapPixelWidth / 2, mapPixelHeight / 2);
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
  }

  private setupWaveManager(): void {
    this.waveManager = new WaveManager(this, this.zombieGroup);

    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;

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
    this.physics.add.overlap(
      this.projectileGroup,
      this.zombieGroup,
      (_proj, _zombie) => {
        const proj = _proj as Projectile;
        const zombie = _zombie as Zombie;
        if (!proj.active || !zombie.active) return;

        zombie.takeDamage(proj.damage);
        proj.deactivate();
      },
    );

    // Zombie hits player
    this.physics.add.overlap(
      this.player,
      this.zombieGroup,
      (_player, _zombie) => {
        const zombie = _zombie as Zombie;
        if (!zombie.active || !zombie.canAttack()) return;

        this.player.takeDamage(zombie.damage);
        zombie.resetAttackCooldown();
      },
    );
  }

  private setupCamera(): void {
    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;

    this.cameras.main.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBackgroundColor('#1A1A2E');
  }

  private setupEvents(): void {
    this.events.on('zombie-killed', () => {
      this.kills++;
      this.player.kills = this.kills;
      this.hud.updateKills(this.kills);
      this.waveManager.onEnemyKilled();
    });

    this.events.on('wave-started', (wave: number) => {
      this.hud.updateWave(wave);
      this.hud.showWaveAnnouncement(wave);
    });

    this.events.on('wave-complete', (wave: number) => {
      this.hud.showMessage('WAVE CLEAR!');

      // Start next wave after delay
      this.time.delayedCall(3000, () => {
        this.waveManager.startWave(wave + 1);
      });
    });

    this.events.on('all-waves-complete', () => {
      this.gameState.progress.totalKills += this.kills;
      this.gameState.progress.totalRuns++;
      SaveManager.save(this.gameState);
      this.scene.start('ResultScene', { kills: this.kills, wave: 5, survived: true });
    });

    this.events.on('player-damaged', (hp: number, maxHp: number) => {
      this.hud.updateHpBar(hp, maxHp);
    });

    this.events.on('player-died', () => {
      this.gameState.progress.totalKills += this.kills;
      this.gameState.progress.totalRuns++;
      SaveManager.save(this.gameState);

      this.time.delayedCall(500, () => {
        this.scene.start('GameOverScene', {
          kills: this.kills,
          wave: this.waveManager.getCurrentWave(),
        });
      });
    });
  }

  private tryAutoShoot(): void {
    let nearestZombie: Zombie | null = null;
    let nearestDist = AUTO_SHOOT_RANGE;

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

    if (nearestZombie) {
      this.shootAt(nearestZombie);
      this.shootCooldown = AUTO_SHOOT_COOLDOWN;
    }
  }

  private shootAt(target: Zombie): void {
    const angle = angleBetween(
      this.player.x, this.player.y,
      target.x, target.y
    );

    // Reuse or create projectile
    const existing = this.projectileGroup.getFirstDead(false) as Projectile | null;
    if (existing) {
      existing.fire(this.player.x, this.player.y, angle, PROJECTILE_DAMAGE);
    } else {
      const proj = new Projectile(this, this.player.x, this.player.y);
      this.projectileGroup.add(proj);
      proj.fire(this.player.x, this.player.y, angle, PROJECTILE_DAMAGE);
    }
  }
}
