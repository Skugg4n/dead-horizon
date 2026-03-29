// TerrainGenerator.ts
// Procedurally generates terrain decorations for NightScene.
// Each call produces a unique but deterministic layout based on a seed.
// Supports zone variants: forest, city, military.
//
// Visual overhaul v1.7.0:
//  - Richer trees with multiple overlapping crown ellipses + ground shadow
//  - Mossy stones (green-grey patches)
//  - Detailed bushes (3-4 overlapping ellipses with highlights)
//  - New elements: flowers, mushrooms, fallen logs, crates

import Phaser from 'phaser';
import { SeededRandom } from '../utils/random';
import type { TerrainResult, ZoneId } from '../config/types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate terrain decorations and collision bodies for one night.
 *
 * @param scene        The active Phaser scene.
 * @param zone         Current zone ID ('forest' | 'city' | 'military').
 * @param basePosition Centre of the base in world coordinates.
 * @param seed         Integer seed -- use totalRuns * 31 + currentWave for
 *                     deterministic but nightly-varying results.
 */
export function generateTerrain(
  scene: Phaser.Scene,
  zone: ZoneId,
  basePosition: { x: number; y: number },
  seed: number
): TerrainResult {
  const rng = new SeededRandom(seed);

  // Groups / container that we return
  const colliders = scene.physics.add.staticGroup();
  const waterZones = scene.add.group();
  const decorContainer = scene.add.container(0, 0);

  const mapW = scene.physics.world.bounds.width;
  const mapH = scene.physics.world.bounds.height;

  // How many of each element to place (varies by zone)
  const counts = getElementCounts(zone, rng);

  // Draw paths first (depth 1) so everything else renders on top
  for (let i = 0; i < counts.paths; i++) {
    drawPath(scene, decorContainer, mapW, mapH, basePosition, rng, zone);
  }

  // Water zones (depth 2, slight transparency)
  for (let i = 0; i < counts.water; i++) {
    drawWaterZone(scene, decorContainer, waterZones, mapW, mapH, basePosition, rng);
  }

  // Ground shadow patches (dark ellipses under where trees will be placed -- depth 1)
  // These are drawn early so tree trunks appear on top.

  // Stones -- large ones get physics bodies (depth 2)
  for (let i = 0; i < counts.stones; i++) {
    drawStone(scene, decorContainer, colliders, mapW, mapH, basePosition, rng, zone);
  }

  // Fallen logs (depth 2, visual only)
  for (let i = 0; i < counts.logs; i++) {
    drawLog(scene, decorContainer, mapW, mapH, basePosition, rng);
  }

  // Crates / debris near base (depth 2)
  for (let i = 0; i < counts.crates; i++) {
    drawCrate(scene, decorContainer, mapW, mapH, basePosition, rng);
  }

  // Bushes (depth 3, no physics)
  for (let i = 0; i < counts.bushes; i++) {
    drawBush(scene, decorContainer, mapW, mapH, basePosition, rng);
  }

  // Stumps (depth 3, no physics)
  for (let i = 0; i < counts.stumps; i++) {
    drawStump(scene, decorContainer, mapW, mapH, basePosition, rng);
  }

  // Flowers (depth 2, very small)
  for (let i = 0; i < counts.flowers; i++) {
    drawFlower(scene, decorContainer, mapW, mapH, basePosition, rng);
  }

  // Trees -- trunk at depth 3, crown at depth 8 (over everything for depth feel)
  for (let i = 0; i < counts.trees; i++) {
    drawTree(scene, decorContainer, colliders, mapW, mapH, basePosition, rng, zone);
  }

  // Mushrooms (depth 2, placed near tree base positions -- but just random for now)
  for (let i = 0; i < counts.mushrooms; i++) {
    drawMushroom(scene, decorContainer, mapW, mapH, basePosition, rng);
  }

  return { colliders, waterZones, decorContainer };
}

// ---------------------------------------------------------------------------
// Zone configuration
// ---------------------------------------------------------------------------

interface ElementCounts {
  trees: number;
  stones: number;
  bushes: number;
  stumps: number;
  water: number;
  paths: number;
  flowers: number;
  mushrooms: number;
  logs: number;
  crates: number;
}

function getElementCounts(zone: ZoneId, rng: SeededRandom): ElementCounts {
  switch (zone) {
    case 'forest':
      return {
        trees:     rng.nextInt(10, 15),
        stones:    rng.nextInt(4, 8),
        bushes:    rng.nextInt(8, 14),
        stumps:    rng.nextInt(3, 6),
        water:     rng.nextInt(1, 3),
        paths:     rng.nextInt(1, 2),
        flowers:   rng.nextInt(12, 20),
        mushrooms: rng.nextInt(3, 6),
        logs:      rng.nextInt(2, 4),
        crates:    rng.nextInt(1, 2),
      };
    case 'city':
      return {
        trees:     rng.nextInt(1, 3),
        stones:    rng.nextInt(8, 14),
        bushes:    0,
        stumps:    0,
        water:     0,
        paths:     rng.nextInt(1, 2),
        flowers:   0,
        mushrooms: 0,
        logs:      rng.nextInt(1, 2),
        crates:    rng.nextInt(2, 4),
      };
    case 'military':
      return {
        trees:     rng.nextInt(2, 5),
        stones:    rng.nextInt(6, 10),
        bushes:    rng.nextInt(2, 5),
        stumps:    rng.nextInt(1, 3),
        water:     rng.nextInt(1, 2),
        paths:     rng.nextInt(1, 2),
        flowers:   rng.nextInt(2, 6),
        mushrooms: rng.nextInt(1, 3),
        logs:      rng.nextInt(2, 3),
        crates:    rng.nextInt(2, 4),
      };
  }
}

// ---------------------------------------------------------------------------
// Placement helpers
// ---------------------------------------------------------------------------

const EDGE_MARGIN = 40;
const BASE_CLEAR_RADIUS = 130;
const BASE_DECOR_RADIUS = 100;
// Radius for crates: they appear close to the base (50-180px away)
const CRATE_MIN_DIST = 50;
const CRATE_MAX_DIST = 180;

/**
 * Pick a random world position that avoids the base and map edges.
 * collidable = true uses a larger base clearance (trees/stones near base
 * would completely block zombie paths).
 */
function randomPos(
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  collidable: boolean,
  maxAttempts = 20
): { x: number; y: number } | null {
  const clearRadius = collidable ? BASE_CLEAR_RADIUS : BASE_DECOR_RADIUS;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = rng.nextFloat(EDGE_MARGIN, mapW - EDGE_MARGIN);
    const y = rng.nextFloat(EDGE_MARGIN, mapH - EDGE_MARGIN);
    const dx = x - basePosition.x;
    const dy = y - basePosition.y;
    if (dx * dx + dy * dy > clearRadius * clearRadius) {
      return { x, y };
    }
  }
  return null;
}

/**
 * Pick a position in a ring around the base (for crates / debris near base).
 */
function randomPosNearBase(
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  maxAttempts = 20
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const angle = rng.nextFloat(0, Math.PI * 2);
    const dist = rng.nextFloat(CRATE_MIN_DIST, CRATE_MAX_DIST);
    const x = basePosition.x + Math.cos(angle) * dist;
    const y = basePosition.y + Math.sin(angle) * dist;
    if (x >= EDGE_MARGIN && x <= mapW - EDGE_MARGIN &&
        y >= EDGE_MARGIN && y <= mapH - EDGE_MARGIN) {
      return { x, y };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Drawing functions
// ---------------------------------------------------------------------------

// ---- TREES -----------------------------------------------------------------

function drawTree(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  colliders: Phaser.Physics.Arcade.StaticGroup,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  zone: ZoneId
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, true);
  if (!pos) return;

  const scale = rng.nextFloat(0.8, 1.5);
  const trunkW = Math.round(9 * scale);
  const trunkH = Math.round(20 * scale);
  const crownR  = Math.round(20 * scale);

  // --- Colour palettes by zone ---
  const trunkColors: Record<ZoneId, [number, number]> = {
    forest:   [0x5A3A1E, 0x3A2010],
    city:     [0x4A4030, 0x2A2018],
    military: [0x5A4A30, 0x3A2E18],
  };
  const crownPalette: Record<ZoneId, number[]> = {
    forest:   [0x2A5A18, 0x336B20, 0x1E4410, 0x3A6E26, 0x254E14],
    city:     [0x3A4A22, 0x2A3A18, 0x4A5A2A],
    military: [0x4A5A30, 0x3A4A22, 0x566430],
  };

  const [trunkLight, trunkDark] = trunkColors[zone];
  const palette = crownPalette[zone];

  // Pick 3 crown colours from palette
  const c0 = palette[rng.nextInt(0, palette.length - 1)] ?? 0x2A5A18;
  const c1 = palette[rng.nextInt(0, palette.length - 1)] ?? 0x336B20;
  const c2 = palette[rng.nextInt(0, palette.length - 1)] ?? 0x1E4410;
  const cShadow = 0x0F2808; // very dark green for shadow ellipse

  // --- Ground shadow under crown (depth 1 -- on the ground) ---
  const shadow = scene.add.graphics();
  shadow.fillStyle(cShadow, 0.22);
  shadow.fillEllipse(0, 0, crownR * 2.2, crownR * 0.8);
  shadow.setDepth(1);
  container.add(shadow);
  shadow.x = pos.x + 4;
  shadow.y = pos.y - trunkH * 0.1;

  // --- Trunk (depth 3) ---
  // Textured trunk: main fill + dark side stripe + small knot
  const trunk = scene.add.graphics();
  // Main trunk body
  trunk.fillStyle(trunkLight);
  trunk.fillRect(-trunkW / 2, -trunkH, trunkW, trunkH);
  // Dark right-side shadow stripe (1/3 width)
  trunk.fillStyle(trunkDark, 0.55);
  trunk.fillRect(trunkW / 6, -trunkH, trunkW / 3, trunkH);
  // Small knot/highlight near middle
  trunk.fillStyle(trunkDark, 0.4);
  trunk.fillEllipse(trunkW * 0.1, -trunkH * 0.5, trunkW * 0.45, trunkH * 0.2);
  trunk.setDepth(3);
  container.add(trunk);
  trunk.x = pos.x;
  trunk.y = pos.y;

  // --- Crown (depth 8) -- 3-4 overlapping ellipses for organic look ---
  const crown = scene.add.graphics();

  // Choose a random crown shape variant
  const variant = rng.nextInt(0, 3);

  if (variant === 0) {
    // Wide spreading crown
    crown.fillStyle(c0, 0.95);
    crown.fillEllipse(0, 0, crownR * 2, crownR * 1.6);
    crown.fillStyle(c1, 0.85);
    crown.fillEllipse(-crownR * 0.4, -crownR * 0.3, crownR * 1.4, crownR * 1.2);
    crown.fillStyle(c2, 0.75);
    crown.fillEllipse(crownR * 0.3, crownR * 0.2, crownR * 1.2, crownR * 1.0);
    crown.fillStyle(c1, 0.5);
    crown.fillEllipse(crownR * 0.6, -crownR * 0.5, crownR * 0.9, crownR * 0.8);
  } else if (variant === 1) {
    // Tall dense crown
    crown.fillStyle(c0, 0.95);
    crown.fillEllipse(0, 0, crownR * 1.6, crownR * 2.0);
    crown.fillStyle(c2, 0.8);
    crown.fillEllipse(-crownR * 0.3, -crownR * 0.4, crownR * 1.1, crownR * 1.4);
    crown.fillStyle(c1, 0.7);
    crown.fillEllipse(crownR * 0.4, -crownR * 0.2, crownR * 1.0, crownR * 1.2);
    crown.fillStyle(c0, 0.45);
    crown.fillEllipse(0, crownR * 0.5, crownR * 1.4, crownR * 0.7);
  } else if (variant === 2) {
    // Irregular multi-lobe crown
    crown.fillStyle(c0, 0.92);
    crown.fillCircle(0, 0, crownR);
    crown.fillStyle(c1, 0.8);
    crown.fillCircle(-crownR * 0.6, -crownR * 0.3, crownR * 0.75);
    crown.fillStyle(c2, 0.8);
    crown.fillCircle(crownR * 0.5, -crownR * 0.4, crownR * 0.7);
    crown.fillStyle(c1, 0.65);
    crown.fillCircle(crownR * 0.1, crownR * 0.5, crownR * 0.65);
    // Top highlight
    crown.fillStyle(0x4A8028, 0.35);
    crown.fillEllipse(-crownR * 0.2, -crownR * 0.6, crownR * 0.9, crownR * 0.5);
  } else {
    // Small scrubby tree
    crown.fillStyle(c2, 0.9);
    crown.fillEllipse(0, 0, crownR * 1.4, crownR * 1.2);
    crown.fillStyle(c0, 0.75);
    crown.fillEllipse(-crownR * 0.35, -crownR * 0.2, crownR, crownR * 0.9);
    crown.fillStyle(c1, 0.6);
    crown.fillEllipse(crownR * 0.3, crownR * 0.3, crownR * 0.8, crownR * 0.7);
  }

  crown.setDepth(8);
  container.add(crown);
  crown.x = pos.x;
  crown.y = pos.y - trunkH;

  // --- Physics body on trunk ---
  const body = colliders.create(pos.x, pos.y - trunkH / 2, '') as Phaser.Physics.Arcade.Sprite;
  body.setVisible(false);
  body.setDisplaySize(trunkW + 4, trunkH);
  (body.body as Phaser.Physics.Arcade.StaticBody).setSize(trunkW + 4, trunkH);
  body.refreshBody();
}

// ---- STONES ----------------------------------------------------------------

function drawStone(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  colliders: Phaser.Physics.Arcade.StaticGroup,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  zone: ZoneId
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const large = rng.chance(0.4);
  const rx = rng.nextFloat(large ? 14 : 6, large ? 24 : 13);
  const ry = rng.nextFloat(rx * 0.55, rx * 0.85);

  const baseColor  = zone === 'city'     ? 0x707070 :
                     zone === 'military' ? 0x8B7D5C : 0x888888;
  const darkColor  = zone === 'city'     ? 0x505050 :
                     zone === 'military' ? 0x6B5D3C : 0x606060;
  const lightColor = zone === 'city'     ? 0x909090 :
                     zone === 'military' ? 0xA09070 : 0xAAAAAA;

  const g = scene.add.graphics();
  // Main stone body
  g.fillStyle(baseColor);
  g.fillEllipse(0, 0, rx * 2, ry * 2);
  // Light top-left highlight
  g.fillStyle(lightColor, 0.35);
  g.fillEllipse(-rx * 0.3, -ry * 0.35, rx * 1.0, ry * 0.7);
  // Dark shadow crescent on lower-right
  g.fillStyle(darkColor, 0.6);
  g.fillEllipse(rx * 0.25, ry * 0.3, rx * 1.5, ry * 1.0);

  // 40% chance of moss patches (green-grey, only on forest/military stones)
  if (zone !== 'city' && rng.chance(0.4)) {
    const mossColor = 0x4A6A30;
    g.fillStyle(mossColor, 0.45);
    // A few irregular moss blobs on the top surface
    const mossCount = rng.nextInt(1, 3);
    for (let m = 0; m < mossCount; m++) {
      const mx = rng.nextFloat(-rx * 0.5, rx * 0.4);
      const my = rng.nextFloat(-ry * 0.6, 0);
      g.fillEllipse(mx, my, rx * rng.nextFloat(0.3, 0.6), ry * rng.nextFloat(0.25, 0.5));
    }
  }

  g.setDepth(2);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;

  if (large) {
    const body = colliders.create(pos.x, pos.y, '') as Phaser.Physics.Arcade.Sprite;
    body.setVisible(false);
    body.setDisplaySize(rx * 2, ry * 2);
    (body.body as Phaser.Physics.Arcade.StaticBody).setSize(rx * 2, ry * 2);
    body.refreshBody();
  }
}

// ---- BUSHES ----------------------------------------------------------------

function drawBush(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const size = rng.nextFloat(9, 18);
  const colorPalette = [0x2D5A1E, 0x3B6B28, 0x1E3D12, 0x4A5E2A, 0x355020];
  const base  = colorPalette[rng.nextInt(0, colorPalette.length - 1)] ?? 0x2D5A1E;
  const light = colorPalette[rng.nextInt(0, colorPalette.length - 1)] ?? 0x3B6B28;
  const dark  = colorPalette[rng.nextInt(0, colorPalette.length - 1)] ?? 0x1E3D12;

  const g = scene.add.graphics();

  // Ground shadow
  g.fillStyle(0x0A1E06, 0.2);
  g.fillEllipse(2, size * 0.6, size * 2.2, size * 0.7);

  // Main bush body -- 3-4 overlapping ellipses
  g.fillStyle(base, 0.95);
  g.fillEllipse(0, 0, size * 2, size * 1.5);
  g.fillStyle(dark, 0.7);
  g.fillEllipse(size * 0.5, size * 0.25, size * 1.3, size);
  g.fillStyle(light, 0.75);
  g.fillEllipse(-size * 0.45, -size * 0.2, size * 1.2, size * 0.9);
  g.fillStyle(base, 0.55);
  g.fillEllipse(size * 0.1, -size * 0.4, size * 0.9, size * 0.75);

  // Top highlight (lighter specular)
  g.fillStyle(0x5A8030, 0.3);
  g.fillEllipse(-size * 0.15, -size * 0.5, size * 0.8, size * 0.4);

  g.setDepth(3);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;
}

// ---- STUMPS ----------------------------------------------------------------

function drawStump(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const r = rng.nextFloat(7, 14);

  const g = scene.add.graphics();
  // Drop shadow
  g.fillStyle(0x0A1806, 0.25);
  g.fillEllipse(2, r * 0.6, r * 2.4, r * 0.8);
  // Outer bark ring
  g.fillStyle(0x5A3D22);
  g.fillCircle(0, 0, r);
  // Inner heartwood
  g.fillStyle(0x7A5A38);
  g.fillCircle(0, 0, r * 0.65);
  // Annual rings
  g.lineStyle(1, 0x4A2E14, 0.6);
  g.strokeCircle(0, 0, r * 0.45);
  g.lineStyle(1, 0x4A2E14, 0.35);
  g.strokeCircle(0, 0, r * 0.25);
  // Light spot (top-left reflected light)
  g.fillStyle(0x9A7A54, 0.3);
  g.fillEllipse(-r * 0.25, -r * 0.25, r * 0.5, r * 0.4);

  g.setDepth(3);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;
}

// ---- WATER ZONES -----------------------------------------------------------

function drawWaterZone(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  waterZones: Phaser.GameObjects.Group,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const rx = rng.nextFloat(22, 50);
  const ry = rng.nextFloat(13, 30);

  const g = scene.add.graphics();
  // Muddy shore ring
  g.fillStyle(0x2A1E0A, 0.5);
  g.fillEllipse(0, 0, rx * 2 + 8, ry * 2 + 6);
  // Dark water body
  g.fillStyle(0x0D2B4A, 0.8);
  g.fillEllipse(0, 0, rx * 2, ry * 2);
  // Highlight reflection stripe
  g.fillStyle(0x1F5A8A, 0.35);
  g.fillEllipse(-rx * 0.25, -ry * 0.35, rx * 0.9, ry * 0.45);
  // Second small highlight
  g.fillStyle(0x2A6A9A, 0.2);
  g.fillEllipse(rx * 0.3, -ry * 0.1, rx * 0.4, ry * 0.25);

  g.setDepth(2);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;

  // Invisible zone for overlap detection
  const zone = scene.add.zone(pos.x, pos.y, rx * 2, ry * 2);
  scene.physics.world.enable(zone, Phaser.Physics.Arcade.STATIC_BODY);
  waterZones.add(zone);
  zone.setData('rx', rx);
  zone.setData('ry', ry);
}

// ---- PATHS -----------------------------------------------------------------

function drawPath(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  zone: ZoneId
): void {
  const pathColor = zone === 'city' ? 0x3A3A3A : 0x2A1F0F;
  const pathW = rng.nextInt(8, 15);

  const edge = rng.nextInt(0, 3);
  let startX: number, startY: number;
  switch (edge) {
    case 0: startX = rng.nextFloat(EDGE_MARGIN, mapW - EDGE_MARGIN); startY = EDGE_MARGIN; break;
    case 1: startX = rng.nextFloat(EDGE_MARGIN, mapW - EDGE_MARGIN); startY = mapH - EDGE_MARGIN; break;
    case 2: startX = EDGE_MARGIN; startY = rng.nextFloat(EDGE_MARGIN, mapH - EDGE_MARGIN); break;
    default: startX = mapW - EDGE_MARGIN; startY = rng.nextFloat(EDGE_MARGIN, mapH - EDGE_MARGIN); break;
  }

  const dx = basePosition.x - startX;
  const dy = basePosition.y - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const stopDist = Math.max(0, dist - 160);
  const t = stopDist / dist;
  const endX = startX + dx * t;
  const endY = startY + dy * t;

  const segments = rng.nextInt(7, 14);
  const g = scene.add.graphics();
  g.fillStyle(pathColor, 0.65);
  g.setDepth(1);
  container.add(g);

  for (let i = 0; i < segments; i++) {
    const ft = i / segments;
    const ft2 = (i + 1) / segments;
    const sx = startX + (endX - startX) * ft  + rng.nextFloat(-7, 7);
    const sy = startY + (endY - startY) * ft  + rng.nextFloat(-7, 7);
    const ex = startX + (endX - startX) * ft2 + rng.nextFloat(-7, 7);
    const ey = startY + (endY - startY) * ft2 + rng.nextFloat(-7, 7);
    const angle = Math.atan2(ey - sy, ex - sx);
    const segLen = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
    const cx2 = (sx + ex) / 2 - g.x;
    const cy2 = (sy + ey) / 2 - g.y;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const hw = segLen / 2;
    const hh = pathW / 2;
    const pts = [
      { x: cx2 + cos * hw - sin * hh, y: cy2 + sin * hw + cos * hh },
      { x: cx2 + cos * hw + sin * hh, y: cy2 + sin * hw - cos * hh },
      { x: cx2 - cos * hw + sin * hh, y: cy2 - sin * hw - cos * hh },
      { x: cx2 - cos * hw - sin * hh, y: cy2 - sin * hw + cos * hh },
    ];
    g.fillPoints(pts as Phaser.Geom.Point[], true);
  }
}

// ---- FLOWERS ---------------------------------------------------------------

/**
 * Draw a tiny flower decoration (4-6 px).
 * Colors: yellow, white, red, pink, purple.
 */
function drawFlower(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const petalColors = [0xFFDD44, 0xFFFFBB, 0xFF4444, 0xFF88AA, 0xCC88FF, 0xFF8844];
  const color = petalColors[rng.nextInt(0, petalColors.length - 1)] ?? 0xFFDD44;
  const r = rng.nextFloat(2.5, 4.5);

  const g = scene.add.graphics();
  // 4-5 petals around center
  const petals = rng.nextInt(4, 5);
  for (let p = 0; p < petals; p++) {
    const angle = (p / petals) * Math.PI * 2;
    const px = Math.cos(angle) * r * 1.2;
    const py = Math.sin(angle) * r * 1.2;
    g.fillStyle(color, 0.9);
    g.fillCircle(px, py, r);
  }
  // Yellow center
  g.fillStyle(0xFFEE22);
  g.fillCircle(0, 0, r * 0.6);

  g.setDepth(2);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;
}

// ---- MUSHROOMS -------------------------------------------------------------

/**
 * Small mushroom decoration near tree bases / stumps.
 */
function drawMushroom(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const capR = rng.nextFloat(4, 7);
  const stemH = capR * 0.9;
  const stemW = capR * 0.5;

  // Cap colors: red, brown, pale
  const capColors = [0xCC2222, 0x8B4513, 0xE8D8B0, 0xCC7722];
  const capColor = capColors[rng.nextInt(0, capColors.length - 1)] ?? 0xCC2222;

  const g = scene.add.graphics();
  // Stem
  g.fillStyle(0xE8D8B0);
  g.fillRect(-stemW / 2, -stemH, stemW, stemH);
  // Cap
  g.fillStyle(capColor, 0.9);
  g.fillEllipse(0, -stemH, capR * 2, capR * 1.3);
  // White spots on cap (if red)
  if (capColor === 0xCC2222) {
    g.fillStyle(0xFFFFFF, 0.85);
    const spots = rng.nextInt(2, 4);
    for (let s = 0; s < spots; s++) {
      const sx = rng.nextFloat(-capR * 0.5, capR * 0.5);
      const sy = -stemH + rng.nextFloat(-capR * 0.4, 0);
      g.fillCircle(sx, sy, rng.nextFloat(0.8, 1.6));
    }
  }

  g.setDepth(2);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;
}

// ---- FALLEN LOGS -----------------------------------------------------------

/**
 * Draw a fallen log (horizontal/diagonal brown rectangle with bark details).
 */
function drawLog(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const len = rng.nextFloat(30, 60);
  const thickness = rng.nextFloat(7, 13);
  const angle = rng.nextFloat(-0.6, 0.6); // slight diagonal, never perfectly straight

  const barkColor  = 0x5A3A1E;
  const darkBark   = 0x3A2010;
  const lightBark  = 0x7A5A38;

  const g = scene.add.graphics();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const hw = len / 2;
  const hh = thickness / 2;

  // Build rotated rectangle points (relative to g origin = pos)
  const pts = [
    { x:  cos * hw - sin * hh, y:  sin * hw + cos * hh },
    { x:  cos * hw + sin * hh, y:  sin * hw - cos * hh },
    { x: -cos * hw + sin * hh, y: -sin * hw - cos * hh },
    { x: -cos * hw - sin * hh, y: -sin * hw + cos * hh },
  ];

  // Main log body
  g.fillStyle(barkColor);
  g.fillPoints(pts as Phaser.Geom.Point[], true);

  // Dark underside stripe
  const ptsDark = [
    { x:  cos * hw - sin * (hh * 0.3), y:  sin * hw + cos * (hh * 0.3) },
    { x:  cos * hw + sin * hh,          y:  sin * hw - cos * hh },
    { x: -cos * hw + sin * hh,          y: -sin * hw - cos * hh },
    { x: -cos * hw - sin * (hh * 0.3), y: -sin * hw + cos * (hh * 0.3) },
  ];
  g.fillStyle(darkBark, 0.65);
  g.fillPoints(ptsDark as Phaser.Geom.Point[], true);

  // Light top highlight stripe
  const ptsLight = [
    { x: -cos * hw - sin * hh,          y: -sin * hw + cos * hh },
    { x: -cos * hw - sin * (hh * 0.4), y: -sin * hw + cos * (hh * 0.4) },
    { x:  cos * hw - sin * (hh * 0.4), y:  sin * hw + cos * (hh * 0.4) },
    { x:  cos * hw - sin * hh,          y:  sin * hw + cos * hh },
  ];
  g.fillStyle(lightBark, 0.4);
  g.fillPoints(ptsLight as Phaser.Geom.Point[], true);

  // End caps (circles at both ends)
  g.fillStyle(darkBark, 0.8);
  g.fillCircle(-cos * hw, -sin * hw, hh);
  g.fillStyle(lightBark, 0.4);
  g.fillCircle( cos * hw,  sin * hw, hh);

  g.setDepth(2);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;
}

// ---- CRATES / DEBRIS -------------------------------------------------------

/**
 * Small wooden crate or debris box near the base.
 */
function drawCrate(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom
): void {
  const pos = randomPosNearBase(mapW, mapH, basePosition, rng);
  if (!pos) return;

  const w = rng.nextInt(10, 18);
  const h = rng.nextInt(8, 14);
  const isBroken = rng.chance(0.4);

  const woodColor   = 0x8B6914;
  const darkWood    = 0x5A4010;
  const lightWood   = 0xC89030;

  const g = scene.add.graphics();

  // Drop shadow
  g.fillStyle(0x000000, 0.2);
  g.fillRect(-w / 2 + 2, -h / 2 + h * 0.6, w, h * 0.5);

  // Main crate body
  g.fillStyle(woodColor);
  g.fillRect(-w / 2, -h / 2, w, h);

  // Wood plank lines
  g.lineStyle(1, darkWood, 0.7);
  g.strokeRect(-w / 2, -h / 2, w, h);
  // Horizontal divider
  g.beginPath();
  g.moveTo(-w / 2, 0);
  g.lineTo(w / 2, 0);
  g.strokePath();
  // Vertical divider
  g.beginPath();
  g.moveTo(0, -h / 2);
  g.lineTo(0, h / 2);
  g.strokePath();

  // Top-left highlight
  g.fillStyle(lightWood, 0.4);
  g.fillRect(-w / 2 + 1, -h / 2 + 1, w / 2 - 1, h / 3);

  // If broken: add a diagonal crack
  if (isBroken) {
    g.lineStyle(1, darkWood, 0.9);
    g.beginPath();
    g.moveTo(-w / 4, -h / 3);
    g.lineTo(w / 3, h / 3);
    g.strokePath();
  }

  g.setDepth(2);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;
}
