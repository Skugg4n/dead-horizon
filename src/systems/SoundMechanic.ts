import Phaser from 'phaser';
import { Zombie } from '../entities/Zombie';

// noiseLevel * NOISE_RANGE_MULTIPLIER = range in pixels
const NOISE_RANGE_MULTIPLIER = 100;
const RING_DURATION = 600; // ms for noise ring to expand and fade

interface NoiseRing {
  graphic: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  maxRadius: number;
  elapsed: number;
  duration: number;
}

export class SoundMechanic {
  private scene: Phaser.Scene;
  private zombieGroup: Phaser.Physics.Arcade.Group;
  private activeRings: NoiseRing[] = [];

  constructor(scene: Phaser.Scene, zombieGroup: Phaser.Physics.Arcade.Group) {
    this.scene = scene;
    this.zombieGroup = zombieGroup;

    // Listen for weapon-fired events
    this.scene.events.on('weapon-fired', this.onWeaponFired, this);
  }

  private onWeaponFired(data: { x: number; y: number; noiseLevel: number }): void {
    if (data.noiseLevel <= 0) return;

    const range = data.noiseLevel * NOISE_RANGE_MULTIPLIER;

    // Notify zombies within range
    this.zombieGroup.getChildren().forEach(child => {
      const zombie = child as Zombie;
      if (!zombie.active) return;

      const dist = Phaser.Math.Distance.Between(
        data.x, data.y, zombie.x, zombie.y
      );

      if (dist <= range) {
        zombie.onSoundHeard(data.x, data.y);
      }
    });

    // Create visual noise ring
    this.createNoiseRing(data.x, data.y, range, data.noiseLevel);
  }

  private createNoiseRing(x: number, y: number, maxRadius: number, noiseLevel: number): void {
    const graphic = this.scene.add.graphics();
    graphic.setDepth(3);

    // Color based on noise level: low = yellow, high = red
    const colorLerp = Phaser.Math.Clamp((noiseLevel - 1) / 4, 0, 1);
    const r = Math.floor(Phaser.Math.Linear(0xFF, 0xFF, colorLerp));
    const g = Math.floor(Phaser.Math.Linear(0xCC, 0x44, colorLerp));
    const b = Math.floor(Phaser.Math.Linear(0x00, 0x00, colorLerp));
    const color = (r << 16) | (g << 8) | b;

    const ring: NoiseRing = {
      graphic,
      x,
      y,
      maxRadius,
      elapsed: 0,
      duration: RING_DURATION,
    };

    // Store color on the ring for drawing
    (ring as NoiseRing & { color: number }).color = color;

    this.activeRings.push(ring);
  }

  update(delta: number): void {
    for (let i = this.activeRings.length - 1; i >= 0; i--) {
      const ring = this.activeRings[i] as NoiseRing & { color: number };
      if (!ring) continue;

      ring.elapsed += delta;
      const progress = ring.elapsed / ring.duration;

      if (progress >= 1) {
        ring.graphic.destroy();
        this.activeRings.splice(i, 1);
        continue;
      }

      const currentRadius = ring.maxRadius * progress;
      const alpha = 0.4 * (1 - progress);

      ring.graphic.clear();
      ring.graphic.lineStyle(2, ring.color, alpha);
      ring.graphic.strokeCircle(ring.x, ring.y, currentRadius);
    }
  }

  destroy(): void {
    this.scene.events.off('weapon-fired', this.onWeaponFired, this);
    for (const ring of this.activeRings) {
      ring.graphic.destroy();
    }
    this.activeRings = [];
  }
}
