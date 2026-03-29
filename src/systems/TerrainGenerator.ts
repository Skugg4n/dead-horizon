// TerrainGenerator.ts
// Procedurally generates terrain decorations for NightScene.
// Each call produces a unique but deterministic layout based on a seed.
// Supports zone variants: forest, city, military.

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

  // Draw paths first (depth 2) so stammar render on top
  for (let i = 0; i < counts.paths; i++) {
    drawPath(scene, decorContainer, mapW, mapH, basePosition, rng, zone);
  }

  // Water zones (depth 2, slight transparency)
  for (let i = 0; i < counts.water; i++) {
    drawWaterZone(scene, decorContainer, waterZones, mapW, mapH, basePosition, rng);
  }

  // Stones -- large ones get physics bodies (depth 2)
  for (let i = 0; i < counts.stones; i++) {
    drawStone(scene, decorContainer, colliders, mapW, mapH, basePosition, rng, zone);
  }

  // Bushes (depth 3, no physics)
  for (let i = 0; i < counts.bushes; i++) {
    drawBush(scene, decorContainer, mapW, mapH, basePosition, rng);
  }

  // Stumps (depth 3, no physics -- stumps are small, not an obstacle)
  for (let i = 0; i < counts.stumps; i++) {
    drawStump(scene, decorContainer, mapW, mapH, basePosition, rng);
  }

  // Trees -- trunk at depth 3, crown at depth 8 (over everything for depth feel)
  for (let i = 0; i < counts.trees; i++) {
    drawTree(scene, decorContainer, colliders, mapW, mapH, basePosition, rng, zone);
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
  water: number;  // 0 for city; craters for military
  paths: number;
}

function getElementCounts(zone: ZoneId, rng: SeededRandom): ElementCounts {
  switch (zone) {
    case 'forest':
      return {
        trees:  rng.nextInt(5, 8),
        stones: rng.nextInt(4, 8),
        bushes: rng.nextInt(6, 10),
        stumps: rng.nextInt(2, 5),
        water:  rng.nextInt(1, 3),
        paths:  rng.nextInt(1, 2),
      };
    case 'city':
      return {
        trees:  rng.nextInt(1, 3),
        stones: rng.nextInt(7, 12), // concrete rubble
        bushes: 0,
        stumps: 0,
        water:  0,                  // no water, only craters treated as stones
        paths:  rng.nextInt(1, 2),  // asphalt remnants
      };
    case 'military':
      return {
        trees:  rng.nextInt(2, 4),
        stones: rng.nextInt(5, 9),  // sandbag piles / craters
        bushes: 0,
        stumps: rng.nextInt(1, 3),
        water:  rng.nextInt(1, 2),  // craters (drawn differently)
        paths:  rng.nextInt(1, 2),
      };
  }
}

// ---------------------------------------------------------------------------
// Placement helpers
// ---------------------------------------------------------------------------

// Margin from map edge
const EDGE_MARGIN = 40;
// Radius around base that must remain clear of collidables
const BASE_CLEAR_RADIUS = 130;
// Radius around base centre used for all decorations (slightly tighter = 100)
const BASE_DECOR_RADIUS = 100;

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
  return null; // Could not place after maxAttempts -- skip element
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

  // Vary tree size
  const scale = rng.nextFloat(0.7, 1.4);
  const trunkW = Math.round(8 * scale);
  const trunkH = Math.round(18 * scale);
  const crownR  = Math.round(16 * scale);

  // Choose colours by zone
  const trunkColor  = zone === 'military' ? 0x5A4A30 : 0x4A3728;
  const crownColor  = zone === 'military' ? 0x4A5A30 : 0x2A4A1A;
  const crownColor2 = zone === 'military' ? 0x3A4A22 : 0x1E3812; // slightly darker shadow

  // --- Trunk (depth 3) ---
  const trunk = scene.add.graphics();
  trunk.fillStyle(trunkColor);
  trunk.fillRect(-trunkW / 2, -trunkH, trunkW, trunkH);
  trunk.setDepth(3);
  container.add(trunk);
  trunk.x = pos.x;
  trunk.y = pos.y;

  // --- Crown shadow (slightly offset, depth 8) ---
  const crownShadow = scene.add.graphics();
  crownShadow.fillStyle(crownColor2, 0.5);
  // Ellipse slightly wider than tall for natural look
  const crownVariant = rng.nextInt(0, 2);
  if (crownVariant === 0) {
    crownShadow.fillEllipse(4, 4, crownR * 2 + 4, crownR * 2);
  } else {
    crownShadow.fillCircle(4, 4, crownR);
  }
  crownShadow.setDepth(8);
  container.add(crownShadow);
  crownShadow.x = pos.x;
  crownShadow.y = pos.y - trunkH;

  // --- Crown (depth 8, over zombies/player for depth feel) ---
  const crown = scene.add.graphics();
  crown.fillStyle(crownColor);
  if (crownVariant === 0) {
    crown.fillEllipse(0, 0, crownR * 2, crownR * 2 - 4);
  } else if (crownVariant === 1) {
    crown.fillCircle(0, 0, crownR);
  } else {
    // Irregular blob: draw two overlapping circles
    crown.fillCircle(0, 0, crownR);
    crown.fillCircle(crownR * 0.4, -crownR * 0.3, crownR * 0.7);
  }
  crown.setDepth(8);
  container.add(crown);
  crown.x = pos.x;
  crown.y = pos.y - trunkH;

  // --- Physics body (invisible circle/rect on trunk) ---
  // Phaser staticGroup.create() needs a texture key -- use a blank rectangle trick.
  // We create a transparent sprite and give it a circular physics body.
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

  const large = rng.chance(0.4); // 40% chance of a large stone with physics
  const rx = rng.nextFloat(large ? 14 : 6, large ? 22 : 12);
  const ry = rng.nextFloat(rx * 0.6, rx * 0.9);

  // City uses grey concrete colours; military uses sand/crater colours
  const baseColor  = zone === 'city'     ? 0x707070 :
                     zone === 'military' ? 0x8B7D5C : 0x888888;
  const darkColor  = zone === 'city'     ? 0x505050 :
                     zone === 'military' ? 0x6B5D3C : 0x606060;

  const g = scene.add.graphics();
  // Main stone body
  g.fillStyle(baseColor);
  g.fillEllipse(0, 0, rx * 2, ry * 2);
  // Shadow crescent on lower-right
  g.fillStyle(darkColor, 0.55);
  g.fillEllipse(rx * 0.2, ry * 0.25, rx * 1.6, ry * 1.2);
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

  const size = rng.nextFloat(8, 16);
  // Dark green-brown palette
  const colors = [0x2D5A1E, 0x3B6B28, 0x1E3D12, 0x4A5E2A];
  const color = colors[rng.nextInt(0, colors.length - 1)] ?? 0x2D5A1E;

  const g = scene.add.graphics();
  // Two or three overlapping circles for organic look
  g.fillStyle(color, 0.9);
  g.fillCircle(0, 0, size);
  g.fillStyle(color, 0.7);
  g.fillCircle(size * 0.5, -size * 0.3, size * 0.65);
  g.fillCircle(-size * 0.4, size * 0.2, size * 0.55);
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

  const r = rng.nextFloat(7, 13);

  const g = scene.add.graphics();
  // Outer wood ring
  g.fillStyle(0x5A3D22);
  g.fillCircle(0, 0, r);
  // Inner heartwood
  g.fillStyle(0x7A5A38);
  g.fillCircle(0, 0, r * 0.65);
  // Annual ring
  g.lineStyle(1, 0x4A2E14, 0.6);
  g.strokeCircle(0, 0, r * 0.35);
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

  const rx = rng.nextFloat(20, 45);
  const ry = rng.nextFloat(12, 28);

  const g = scene.add.graphics();
  // Dark water body
  g.fillStyle(0x0D2B4A, 0.75);
  g.fillEllipse(0, 0, rx * 2, ry * 2);
  // Highlight reflection stripe (lighter edge)
  g.fillStyle(0x1F5A8A, 0.3);
  g.fillEllipse(-rx * 0.25, -ry * 0.35, rx * 1.0, ry * 0.5);
  g.setDepth(2);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;

  // We need a plain game object at the same position so overlap can be detected.
  // Use a Zone (invisible rectangle) stored in waterZones group.
  const zone = scene.add.zone(pos.x, pos.y, rx * 2, ry * 2);
  scene.physics.world.enable(zone, Phaser.Physics.Arcade.STATIC_BODY);
  waterZones.add(zone);
  // Store the ellipse radii on the zone so the overlap callback can do a
  // more accurate ellipse-point check if desired.
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
  // Paths run from a random edge point toward (but not into) the base.
  // We draw them as a series of slightly randomised rectangles.
  const pathColor = zone === 'city' ? 0x3A3A3A : 0x2A1F0F; // asphalt or dirt
  const pathW = rng.nextInt(10, 18);

  // Pick a starting edge
  const edge = rng.nextInt(0, 3);
  let startX: number, startY: number;
  switch (edge) {
    case 0: startX = rng.nextFloat(EDGE_MARGIN, mapW - EDGE_MARGIN); startY = EDGE_MARGIN; break;
    case 1: startX = rng.nextFloat(EDGE_MARGIN, mapW - EDGE_MARGIN); startY = mapH - EDGE_MARGIN; break;
    case 2: startX = EDGE_MARGIN; startY = rng.nextFloat(EDGE_MARGIN, mapH - EDGE_MARGIN); break;
    default: startX = mapW - EDGE_MARGIN; startY = rng.nextFloat(EDGE_MARGIN, mapH - EDGE_MARGIN); break;
  }

  // End point: stop ~160px away from base center to avoid cluttering the base
  const dx = basePosition.x - startX;
  const dy = basePosition.y - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const stopDist = Math.max(0, dist - 160);
  const t = stopDist / dist;
  const endX = startX + dx * t;
  const endY = startY + dy * t;

  // Draw segments along the path with slight random offsets for a worn look
  const segments = rng.nextInt(6, 12);
  const g = scene.add.graphics();
  g.fillStyle(pathColor, 0.7);
  g.setDepth(2);
  container.add(g);

  for (let i = 0; i < segments; i++) {
    const ft = i / segments;
    const ft2 = (i + 1) / segments;
    const sx = startX + (endX - startX) * ft  + rng.nextFloat(-6, 6);
    const sy = startY + (endY - startY) * ft  + rng.nextFloat(-6, 6);
    const ex = startX + (endX - startX) * ft2 + rng.nextFloat(-6, 6);
    const ey = startY + (endY - startY) * ft2 + rng.nextFloat(-6, 6);
    // Draw a quad (thick line segment as a rotated rectangle)
    const angle = Math.atan2(ey - sy, ex - sx);
    const segLen = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
    const cx2 = (sx + ex) / 2 - g.x;
    const cy2 = (sy + ey) / 2 - g.y;
    // Save / restore transform via matrix
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Approximate the rotated rect by drawing a polygon
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
