// Dead Horizon -- Sprite factory for generating programmatic textures
// All entity textures are created here and registered with Phaser's texture manager.

import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';

const SIZE = TILE_SIZE; // 32

/**
 * Generate programmatic fallback textures for any assets that were not loaded.
 * Call in BootScene create() after asset loading completes.
 */
export function generateAllTextures(scene: Phaser.Scene): void {
  generatePlayerTexture(scene);
  generateWalkerTexture(scene);
  generateRunnerTexture(scene);
  generateBruteTexture(scene);
  generateBulletTexture(scene);
  generateSpitterTexture(scene);
  generateScreamerTexture(scene);
}

function generatePlayerTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('player')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Body (military green)
  g.fillStyle(0x4A6B3A);
  g.fillRect(6, 8, 20, 18);

  // Head (lighter green circle)
  g.fillStyle(0x6B8B5A);
  g.fillCircle(16, 8, 6);

  // Direction indicator (small triangle pointing up)
  g.fillStyle(0xE8DCC8);
  g.fillTriangle(16, 0, 13, 5, 19, 5);

  // Weapon (small rectangle to the right)
  g.fillStyle(0x8B7355);
  g.fillRect(24, 10, 4, 12);

  // Outline
  g.lineStyle(1, 0x2D4A22);
  g.strokeRect(6, 8, 20, 18);

  g.generateTexture('player', SIZE, SIZE);
  g.destroy();
}

function generateWalkerTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('walker')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Irregular dark red body
  g.fillStyle(0x6B1010);
  g.fillRect(7, 6, 18, 22);

  // Slightly uneven edges for shambling look
  g.fillStyle(0x5A0808);
  g.fillRect(5, 10, 3, 14);
  g.fillRect(24, 8, 3, 16);

  // Head
  g.fillStyle(0x4A0808);
  g.fillCircle(16, 7, 5);

  // Dark clothing rags
  g.lineStyle(1, 0x3A0505);
  g.lineBetween(10, 14, 22, 14);
  g.lineBetween(9, 20, 23, 20);

  g.generateTexture('walker', SIZE, SIZE);
  g.destroy();
}

function generateRunnerTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('runner')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Lean/thin yellow-green body, bent forward
  g.fillStyle(0x8B8B20);
  g.fillRect(10, 4, 14, 24);

  // Thin limbs
  g.fillStyle(0x7A7A18);
  g.fillRect(8, 8, 3, 16);
  g.fillRect(23, 6, 3, 18);

  // Small head (bent forward)
  g.fillStyle(0x6B6B10);
  g.fillCircle(18, 4, 4);

  // Torn clothing lines
  g.lineStyle(1, 0x5A5A08);
  g.lineBetween(12, 12, 20, 10);
  g.lineBetween(11, 20, 22, 22);

  g.generateTexture('runner', SIZE, SIZE);
  g.destroy();
}

function generateBruteTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('brute')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Large dark grey body
  g.fillStyle(0x3A3A3A);
  g.fillRect(4, 6, 24, 22);

  // Shoulder bulk
  g.fillStyle(0x4A4A4A);
  g.fillRect(2, 6, 6, 10);
  g.fillRect(24, 6, 6, 10);

  // Head
  g.fillStyle(0x2A2A2A);
  g.fillCircle(16, 6, 6);

  // Armor lines
  g.lineStyle(1, 0x555555);
  g.lineBetween(6, 12, 26, 12);
  g.lineBetween(6, 18, 26, 18);

  // Heavy outline
  g.lineStyle(1, 0x1A1A1A);
  g.strokeRect(4, 6, 24, 22);

  g.generateTexture('brute', SIZE, SIZE);
  g.destroy();
}

function generateBulletTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('bullet')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  // Brighter bullet with glow
  g.fillStyle(0xFFDD44);
  g.fillCircle(4, 4, 4);
  g.fillStyle(0xFFFFFF, 0.6);
  g.fillCircle(4, 4, 2);
  g.generateTexture('bullet', 8, 8);
  g.destroy();
}

function generateSpitterTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('spitter')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Hunched green-tinted body
  g.fillStyle(0x4A6B20);
  g.fillRect(8, 8, 16, 20);

  // Bloated cheeks/throat
  g.fillStyle(0x5A8B30);
  g.fillCircle(16, 6, 5);
  g.fillCircle(10, 14, 4);
  g.fillCircle(22, 14, 4);

  // Dripping slime details
  g.lineStyle(1, 0x7BFF30);
  g.lineBetween(12, 26, 14, 30);
  g.lineBetween(18, 26, 20, 30);

  g.generateTexture('spitter', SIZE, SIZE);
  g.destroy();
}

function generateScreamerTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('screamer')) return;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Pale emaciated body
  g.fillStyle(0x8B8B7A);
  g.fillRect(9, 8, 14, 20);

  // Wide open mouth head
  g.fillStyle(0x9B9B8A);
  g.fillCircle(16, 7, 5);
  g.fillStyle(0x1A1A1A);
  g.fillRect(13, 5, 6, 5);

  // Sound wave lines
  g.lineStyle(1, 0xCCCCBB, 0.5);
  g.strokeCircle(16, 7, 10);
  g.strokeCircle(16, 7, 14);

  g.generateTexture('screamer', SIZE, SIZE);
  g.destroy();
}

/**
 * Get a color accent for a refugee based on their skill bonus.
 */
export function getRefugeeColor(skillBonus: string): number {
  const colorMap: Record<string, number> = {
    'Good shot': 0xB22222,     // Flannel red
    'Fast gatherer': 0x4A90D9, // Medicine blue
    'Mechanic': 0xC5A030,      // Gold
    'Tough': 0x6B6B6B,         // Steel grey
    'Medic': 0x4CAF50,         // Green
  };
  return colorMap[skillBonus] ?? 0xE8DCC8;
}

/**
 * Get the sprite key for a structure, or null if no sprite loaded.
 */
export function getStructureSpriteKey(scene: Phaser.Scene, structureId: string): string | null {
  const key = `struct_${structureId}`;
  return scene.textures.exists(key) ? key : null;
}

/**
 * Get the sprite key for a base level, or null if no sprite loaded.
 */
export function getBaseSpriteKey(scene: Phaser.Scene, level: number): string | null {
  const keys = ['base_tent', 'base_camp', 'base_outpost', 'base_settlement'];
  const key = keys[level] ?? 'base_tent';
  return scene.textures.exists(key) ? key : null;
}

/**
 * Draw a detailed structure graphic with patterns.
 */
export function drawDetailedStructure(
  g: Phaser.GameObjects.Graphics,
  structureId: string,
  x: number,
  y: number,
  size: number = SIZE,
): void {
  switch (structureId) {
    case 'barricade':
      // Brown base with plank lines
      g.fillStyle(0x8B6914);
      g.fillRect(x, y, size, size);
      g.lineStyle(2, 0xA07820);
      g.lineBetween(x + 2, y + 8, x + size - 2, y + 8);
      g.lineBetween(x + 2, y + size / 2, x + size - 2, y + size / 2);
      g.lineBetween(x + 2, y + size - 8, x + size - 2, y + size - 8);
      // Diagonal plank
      g.lineStyle(1, 0x7A5510);
      g.lineBetween(x + 4, y + 4, x + size - 4, y + size - 4);
      break;

    case 'wall':
      // Grey with brick pattern
      g.fillStyle(0x6B6B6B);
      g.fillRect(x, y, size, size);
      g.lineStyle(1, 0x555555);
      g.lineBetween(x, y + size / 3, x + size, y + size / 3);
      g.lineBetween(x, y + (size * 2) / 3, x + size, y + (size * 2) / 3);
      g.lineBetween(x + size / 2, y, x + size / 2, y + size / 3);
      g.lineBetween(x + size / 4, y + size / 3, x + size / 4, y + (size * 2) / 3);
      g.lineBetween(x + (size * 3) / 4, y + (size * 2) / 3, x + (size * 3) / 4, y + size);
      break;

    case 'trap':
      // Dark base with X marks
      g.fillStyle(0x2D1A1A);
      g.fillRect(x, y, size, size);
      g.lineStyle(2, 0xCC3333);
      g.lineBetween(x + 6, y + 6, x + size - 6, y + size - 6);
      g.lineBetween(x + size - 6, y + 6, x + 6, y + size - 6);
      // Smaller X marks in corners
      g.lineStyle(1, 0xCC3333, 0.5);
      g.lineBetween(x + 4, y + 4, x + 10, y + 10);
      g.lineBetween(x + size - 4, y + 4, x + size - 10, y + 10);
      break;

    case 'pillbox':
      // Fortified position
      g.fillStyle(0x4A6741);
      g.fillRect(x, y, size, size);
      g.lineStyle(1, 0x3A5731);
      g.strokeRect(x + 4, y + 4, size - 8, size - 8);
      // Gun slit
      g.fillStyle(0x1A1A2E);
      g.fillRect(x + 12, y + 2, 8, 4);
      break;

    case 'storage':
      // Wooden crate
      g.fillStyle(0x7B6B3A);
      g.fillRect(x, y, size, size);
      g.lineStyle(1, 0x5A4A2A);
      g.lineBetween(x + size / 2, y, x + size / 2, y + size);
      g.lineBetween(x, y + size / 2, x + size, y + size / 2);
      // Corner reinforcements
      g.lineStyle(1, 0x8B7B4A);
      g.strokeRect(x + 2, y + 2, size - 4, size - 4);
      break;

    case 'shelter':
      // Tent shape
      g.fillStyle(0x5A4A3A);
      g.fillRect(x, y, size, size);
      // Tent peak lines
      g.lineStyle(1, 0x4A3A2A);
      g.lineBetween(x + size / 2, y + 2, x + 2, y + size - 2);
      g.lineBetween(x + size / 2, y + 2, x + size - 2, y + size - 2);
      break;

    case 'farm':
      // Green plot with rows
      g.fillStyle(0x3A6B3A);
      g.fillRect(x, y, size, size);
      g.lineStyle(1, 0x2D5A22);
      for (let row = 0; row < 4; row++) {
        const ry = y + 4 + row * 7;
        g.lineBetween(x + 4, ry, x + size - 4, ry);
      }
      // Small plant dots
      g.fillStyle(0x5A8B4A);
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          g.fillCircle(x + 8 + col * 9, y + 7 + row * 7, 2);
        }
      }
      break;

    default:
      g.fillStyle(0x888888);
      g.fillRect(x, y, size, size);
      break;
  }

  // Outline for all
  g.lineStyle(1, 0xE8DCC8, 0.4);
  g.strokeRect(x, y, size, size);
}
