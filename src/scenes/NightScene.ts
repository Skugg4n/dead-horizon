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
import { HUD } from '../ui/HUD';
import { ResourceBar } from '../ui/ResourceBar';
import { WeaponManager } from '../systems/WeaponManager';
import { SkillManager } from '../systems/SkillManager';
import { TILE_SIZE, XP_PER_KILL, REFUGEE_PILLBOX_RANGE, REFUGEE_PILLBOX_DAMAGE, REFUGEE_PILLBOX_COOLDOWN } from '../config/constants';
import { RefugeeManager } from '../systems/RefugeeManager';
import { FogOfWar } from '../systems/FogOfWar';
import { distanceBetween, angleBetween } from '../utils/math';
import type { ResourceType, SkillType, WeaponClass, StructureInstance, RefugeeInstance } from '../config/types';
import zombieLootData from '../data/zombie-loot.json';
import structuresData from '../data/structures.json';
import baseLevelsJson from '../data/base-levels.json';

const MAP_WIDTH = 40;  // tiles
const MAP_HEIGHT = 30; // tiles

interface LootDrop {
  resource: ResourceType;
  min: number;
  max: number;
  chance: number;
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
  private refugeeManager!: RefugeeManager;
  private hud!: HUD;
  // ResourceBar is constructed for its side effects (listens to events, renders UI)
  private shootCooldown: number = 0;
  private pillboxAssignments: { structure: StructureInstance; refugee: RefugeeInstance; cooldown: number }[] = [];
  private kills: number = 0;
  private loadedAmmo: number = 0;
  private weaponUsedThisNight: Set<string> = new Set();
  private gameState!: ReturnType<typeof SaveManager.load>;
  private barricades: Barricade[] = [];
  private walls: Wall[] = [];
  private traps: Trap[] = [];
  private wallBodies!: Phaser.Physics.Arcade.StaticGroup;
  private fogOfWar!: FogOfWar;
  private fogIndicatorGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'NightScene' });
  }

  create(): void {
    this.gameState = SaveManager.load();
    this.kills = 0;
    this.shootCooldown = 0;
    this.loadedAmmo = this.gameState.inventory.loadedAmmo;
    this.weaponUsedThisNight = new Set();

    this.createMap();
    this.createStructures();
    this.createFogOfWar();
    this.createPlayer();
    this.createGroups();
    this.setupWaveManager();
    this.setupCollisions();
    this.setupCamera();
    this.setupEvents();

    this.resourceManager = new ResourceManager(this, this.gameState);
    this.weaponManager = new WeaponManager(this, this.gameState);
    this.soundMechanic = new SoundMechanic(this, this.zombieGroup);
    this.skillManager = new SkillManager(this, this.gameState);
    this.refugeeManager = new RefugeeManager(this, this.gameState);
    this.setupPillboxRefugees();
    this.hud = new HUD(this);
    this.hud.updateAmmo(this.loadedAmmo);
    this.updateWeaponHUD();
    new ResourceBar(this, this.resourceManager.getAll());

    this.setupWeaponKeys();

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

    // Update sound mechanic (noise ring animation)
    this.soundMechanic.update(delta);

    // Check zombie-structure interactions
    this.checkZombieStructureInteractions();

    // Update fog of war and zombie visibility
    this.fogOfWar.update();
    this.fogOfWar.updateZombieVisibility(this.zombieGroup, this.fogIndicatorGraphics);

    // Pillbox refugee shooting
    this.updatePillboxShooting(delta);

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

    // Base in center -- visual depends on base level
    const centerX = mapPixelWidth / 2;
    const centerY = mapPixelHeight / 2;
    const baseLevelIdx = Math.min(this.gameState.base.level, baseLevelsJson.baseLevels.length - 1);
    const baseLevelData = baseLevelsJson.baseLevels[baseLevelIdx];
    if (!baseLevelData) throw new Error('No base levels defined');
    const baseSize = baseLevelData.visual.size;
    const halfSize = baseSize / 2;
    const baseFillColor = parseInt(baseLevelData.visual.color.replace('0x', ''), 16);
    const baseStrokeColor = parseInt(baseLevelData.visual.strokeColor.replace('0x', ''), 16);

    const tent = this.add.graphics();
    tent.fillStyle(baseFillColor);
    tent.fillRect(centerX - halfSize, centerY - halfSize, baseSize, baseSize);
    tent.lineStyle(baseLevelData.visual.strokeWidth, baseStrokeColor);
    tent.strokeRect(centerX - halfSize, centerY - halfSize, baseSize, baseSize);

    // Inner wall detail for Camp and above
    if (this.gameState.base.level >= 1) {
      const inset = 4;
      tent.lineStyle(1, baseStrokeColor, 0.4);
      tent.strokeRect(centerX - halfSize + inset, centerY - halfSize + inset, baseSize - inset * 2, baseSize - inset * 2);
    }

    // Label
    this.add.text(centerX, centerY - halfSize - 8, 'BASE', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#E8DCC8',
    }).setOrigin(0.5);

    // Set world bounds
    this.physics.world.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
  }

  private createStructures(): void {
    this.barricades = [];
    this.walls = [];
    this.traps = [];

    const trapDef = structuresData.structures.find(s => s.id === 'trap');
    const defaultTrapDamage = trapDef && 'trapDamage' in trapDef ? (trapDef as { trapDamage: number }).trapDamage : 20;

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
        default: {
          // Render non-interactive structures visually
          const STRUCTURE_COLORS: Record<string, number> = {
            pillbox: 0x4A6741,
            storage: 0x7B6B3A,
            shelter: 0x5A4A3A,
            farm: 0x3A6B3A,
          };
          const color = STRUCTURE_COLORS[structure.structureId] ?? 0x888888;
          const g = this.add.graphics();
          g.fillStyle(color);
          g.fillRect(structure.x, structure.y, TILE_SIZE, TILE_SIZE);
          g.lineStyle(1, 0xE8DCC8, 0.6);
          g.strokeRect(structure.x, structure.y, TILE_SIZE, TILE_SIZE);
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
    const fogRadius = fogLevelData.fogRadius;

    this.fogOfWar = new FogOfWar(
      this,
      this.gameState,
      mapPixelWidth,
      mapPixelHeight,
      fogRadius
    );

    // Graphics for directional indicators at fog boundary
    this.fogIndicatorGraphics = this.add.graphics();
    this.fogIndicatorGraphics.setDepth(81);
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

    this.wallBodies = this.physics.add.staticGroup();
  }

  private setupWaveManager(): void {
    this.waveManager = new WaveManager(this, this.zombieGroup);
    this.waveManager.setTarget(this.player);

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
          const wallRef = wallBody.getData('wallRef') as Wall | undefined;
          if (wallRef) {
            const destroyed = wallRef.takeDamage(zombie.structureDamage);
            zombie.resetStructureAttackCooldown();
            if (destroyed) {
              wallBody.destroy();
            }
          }
        }
      },
    );

    // Walls also block player
    this.physics.add.collider(this.player, this.wallBodies);
  }

  private setupCamera(): void {
    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;

    this.cameras.main.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBackgroundColor('#1A1A2E');
  }

  private setupEvents(): void {
    this.events.on('zombie-killed', (zombie: Zombie) => {
      this.kills++;
      this.player.kills = this.kills;
      this.hud.updateKills(this.kills);
      this.waveManager.onEnemyKilled();
      this.rollLootDrops(zombie.x, zombie.y);

      // Add weapon XP and combat skill XP based on equipped weapon class
      const equipped = this.weaponManager.getEquipped();
      if (equipped) {
        this.weaponManager.addXP(equipped.id, 1);
        const stats = this.weaponManager.getWeaponStats(equipped);
        const skillType = this.weaponClassToSkill(stats.weaponClass);
        if (skillType) {
          this.skillManager.addXP(skillType, XP_PER_KILL);
        }
      }
    });

    this.events.on('wave-started', (wave: number) => {
      this.hud.updateWave(wave);
      this.hud.showWaveAnnouncement(wave);
    });

    this.events.on('wave-complete', (wave: number) => {
      this.hud.showMessage('WAVE CLEAR!');

      // Only start next wave if there are more waves (5 total)
      if (wave < 5) {
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
      SaveManager.save(this.gameState);
      this.scene.start('ResultScene', { kills: this.kills, wave: 5, survived: true });
    });

    this.events.on('player-damaged', (hp: number, maxHp: number) => {
      this.hud.updateHpBar(hp, maxHp);
    });

    this.events.on('player-died', () => {
      this.gameState.progress.totalKills += this.kills;
      this.gameState.progress.totalRuns++;
      this.gameState.inventory.loadedAmmo = this.loadedAmmo;
      this.decreaseUsedWeaponDurability();
      this.skillManager.syncToState(this.gameState);
      this.resourceManager.syncToState(this.gameState);
      this.refugeeManager.syncToState();
      this.fogOfWar.syncToState();
      SaveManager.save(this.gameState);

      this.time.delayedCall(500, () => {
        this.scene.start('GameOverScene', {
          kills: this.kills,
          wave: this.waveManager.getCurrentWave(),
        });
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
      });
    }
  }

  private updateWeaponHUD(): void {
    const weapon = this.weaponManager.getEquipped();
    if (weapon) {
      const stats = this.weaponManager.getWeaponStats(weapon);
      this.hud.updateWeapon(stats.name, weapon.durability, weapon.maxDurability);
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
    const weapon = this.weaponManager.getEquipped();
    if (!weapon) return;

    const stats = this.weaponManager.getWeaponStats(weapon);
    const isMelee = stats.weaponClass === 'melee';

    // Consume ammo for ranged weapons
    if (!isMelee) {
      this.loadedAmmo--;
      this.hud.updateAmmo(this.loadedAmmo);
    }

    // Track weapon usage for durability decrease at end of night
    this.weaponUsedThisNight.add(weapon.id);

    // Emit weapon-fired event for SoundMechanic
    this.events.emit('weapon-fired', {
      x: this.player.x,
      y: this.player.y,
      noiseLevel: stats.noiseLevel,
    });

    const angle = angleBetween(
      this.player.x, this.player.y,
      target.x, target.y
    );

    if (stats.weaponClass === 'shotgun') {
      // Shotgun fires a spread of 3 pellets
      const spreadAngles = [angle - 0.15, angle, angle + 0.15];
      for (const a of spreadAngles) {
        this.fireProjectile(a, Math.round(stats.damage / 3));
      }
    } else {
      this.fireProjectile(angle, stats.damage);
    }
  }

  private fireProjectile(angle: number, damage: number): void {
    const existing = this.projectileGroup.getFirstDead(false) as Projectile | null;
    if (existing) {
      existing.fire(this.player.x, this.player.y, angle, damage);
    } else {
      const proj = new Projectile(this, this.player.x, this.player.y);
      this.projectileGroup.add(proj);
      proj.fire(this.player.x, this.player.y, angle, damage);
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

  // Decrease durability by 1 for each weapon used during this night
  private decreaseUsedWeaponDurability(): void {
    for (const weaponId of this.weaponUsedThisNight) {
      this.weaponManager.decreaseDurability(weaponId);
    }
  }

  // Check zombie overlap with barricades and traps each frame
  private checkZombieStructureInteractions(): void {
    this.zombieGroup.getChildren().forEach(child => {
      const zombie = child as Zombie;
      if (!zombie.active) return;

      // Barricade interaction: slow zombies, brutes damage barricades
      for (let i = this.barricades.length - 1; i >= 0; i--) {
        const barricade = this.barricades[i];
        if (!barricade || !barricade.active) {
          this.barricades.splice(i, 1);
          continue;
        }

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

      // Pillbox interaction: zombies damage refugees in pillboxes
      this.checkPillboxDamage();

      // Trap interaction: damage zombies walking over traps
      for (let i = this.traps.length - 1; i >= 0; i--) {
        const trap = this.traps[i];
        if (!trap || !trap.active) {
          this.traps.splice(i, 1);
          continue;
        }

        const tx = trap.structureInstance.x;
        const ty = trap.structureInstance.y;

        if (
          zombie.x >= tx && zombie.x <= tx + TILE_SIZE &&
          zombie.y >= ty && zombie.y <= ty + TILE_SIZE
        ) {
          zombie.takeDamage(trap.getDamage());
          // Trap is single-use (hp=1), destroy after triggering
          const destroyed = trap.takeDamage(trap.structureInstance.hp);
          if (destroyed) {
            this.traps.splice(i, 1);
          }
        }
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

      let nearestZombie: Zombie | null = null;
      let nearestDist = range;

      this.zombieGroup.getChildren().forEach(child => {
        const zombie = child as Zombie;
        if (!zombie.active) return;
        const dist = distanceBetween(px, py, zombie.x, zombie.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestZombie = zombie;
        }
      });

      if (nearestZombie) {
        const zx = (nearestZombie as Zombie).x;
        const zy = (nearestZombie as Zombie).y;
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

  // Roll loot from zombie-loot.json and add to resources
  private rollLootDrops(x: number, y: number): void {
    const drops = zombieLootData.drops as LootDrop[];
    let yOffset = 0;

    for (const drop of drops) {
      if (Math.random() < drop.chance) {
        const amount = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
        this.resourceManager.add(drop.resource, amount);
        this.showFloatingText(x, y + yOffset, `+${amount} ${drop.resource}`);
        yOffset -= 16;
      }
    }
  }

  private showFloatingText(x: number, y: number, message: string): void {
    const text = this.add.text(x, y, message, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#FFD700',
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }
}
