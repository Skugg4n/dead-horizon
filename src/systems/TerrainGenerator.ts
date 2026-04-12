// TerrainGenerator.ts
// Procedurally generates terrain decorations for both DayScene and NightScene.
// Each call produces a unique but deterministic layout based on a seed.
// Supports zone variants: forest, city, military, endless.
//
// Visual overhaul v1.7.0:
//  - Richer trees with multiple overlapping crown ellipses + ground shadow
//  - Mossy stones (green-grey patches)
//  - Detailed bushes (3-4 overlapping ellipses with highlights)
//  - New elements: flowers, mushrooms, fallen logs, crates
//
// v1.8.8:
//  - Added isDaytime parameter: brighter color palettes for daytime rendering.
//    Both DayScene and NightScene now call generateTerrain with the same seed
//    so decorations are identical within a run. Pass isDaytime=true from DayScene.
//
// v2.5.0:
//  - Zone-specific terrain generation: city and military get distinct visuals.
//  - drawZoneBackground(): extracted background rendering so NightScene and DayScene
//    get zone-aware ground without duplicating code.
//  - City: asphalt ground, intersecting streets, building ruins (blockers), abandoned cars, streetlights.
//  - Military: olive ground, open fields, bunkers (blockers), barbed wire, sandbags, helipad.
//  - generateTerrain() now returns naturalBlockerRects for PathGrid registration.

import Phaser from 'phaser';
import { SeededRandom } from '../utils/random';
import type { NaturalBlockerRect, TerrainResult, ZoneId } from '../config/types';
import { TILE_SIZE } from '../config/constants';

// ---------------------------------------------------------------------------
// Color utility
// ---------------------------------------------------------------------------

/**
 * Brighten a packed RGB hex color by blending each channel toward 0xFF.
 * factor=0 returns original, factor=1 returns white.
 * Used to produce daytime-bright variants of night-tuned palettes.
 */
function lightenColor(hex: number, factor: number): number {
  const r = (hex >> 16) & 0xFF;
  const g = (hex >>  8) & 0xFF;
  const b =  hex        & 0xFF;
  const lr = Math.min(255, Math.round(r + (255 - r) * factor));
  const lg = Math.min(255, Math.round(g + (255 - g) * factor));
  const lb = Math.min(255, Math.round(b + (255 - b) * factor));
  return (lr << 16) | (lg << 8) | lb;
}

/**
 * Apply lightenColor to every element of a colour array.
 * Returns a new array -- originals are not modified.
 */
function lightenPalette(palette: number[], factor: number): number[] {
  return palette.map(c => lightenColor(c, factor));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate terrain decorations and collision bodies for one scene.
 *
 * @param scene        The active Phaser scene.
 * @param zone         Current zone ID ('forest' | 'city' | 'military').
 * @param basePosition Centre of the base in world coordinates.
 * @param seed         Integer seed -- use totalRuns * 31 for a deterministic
 *                     layout that stays consistent between day and night within
 *                     the same run. A new run gets a new seed (totalRuns changes).
 * @param isDaytime    When true, use brighter colour palettes for the daytime
 *                     DayScene. Defaults to false (original night palette).
 */
export function generateTerrain(
  scene: Phaser.Scene,
  zone: ZoneId,
  basePosition: { x: number; y: number },
  seed: number,
  isDaytime: boolean = false
): TerrainResult {
  const rng = new SeededRandom(seed);

  // Groups / container that we return
  const colliders = scene.physics.add.staticGroup();
  const waterZones = scene.add.group();
  const decorContainer = scene.add.container(0, 0);
  // Collected natural blocker positions for PathGrid (building ruins, bunkers)
  const naturalBlockerRects: NaturalBlockerRect[] = [];

  const mapW = scene.physics.world.bounds.width;
  const mapH = scene.physics.world.bounds.height;

  if (zone === 'city') {
    // City: building ruins (blockers), abandoned cars, streetlights, scattered debris
    generateCityDecor(scene, decorContainer, colliders, naturalBlockerRects, mapW, mapH, basePosition, rng, isDaytime);
  } else if (zone === 'military') {
    // Military: bunkers (blockers), barbed wire, sandbags, helipad, sparse vegetation
    generateMilitaryDecor(scene, decorContainer, colliders, naturalBlockerRects, mapW, mapH, basePosition, rng, isDaytime);
  } else {
    // Forest (and endless fallback): original organic element set
    generateForestDecor(scene, decorContainer, colliders, waterZones, mapW, mapH, basePosition, rng, zone, isDaytime);
  }

  return { colliders, waterZones, decorContainer, naturalBlockerRects };
}

// ---------------------------------------------------------------------------
// Forest decoration generator (original element set)
// ---------------------------------------------------------------------------

function generateForestDecor(
  scene: Phaser.Scene,
  decorContainer: Phaser.GameObjects.Container,
  colliders: Phaser.Physics.Arcade.StaticGroup,
  waterZones: Phaser.GameObjects.Group,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  zone: ZoneId,
  isDaytime: boolean
): void {
  const counts = getElementCounts(zone, rng);

  // Draw paths first (depth 1) so everything else renders on top
  for (let i = 0; i < counts.paths; i++) {
    drawPath(scene, decorContainer, mapW, mapH, basePosition, rng, zone, isDaytime);
  }

  // Water zones (depth 2, slight transparency)
  for (let i = 0; i < counts.water; i++) {
    drawWaterZone(scene, decorContainer, waterZones, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Stones -- large ones get physics bodies (depth 2)
  for (let i = 0; i < counts.stones; i++) {
    drawStone(scene, decorContainer, colliders, mapW, mapH, basePosition, rng, zone, isDaytime);
  }

  // Fallen logs (depth 2, visual only)
  for (let i = 0; i < counts.logs; i++) {
    drawLog(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Crates / debris near base (depth 2)
  for (let i = 0; i < counts.crates; i++) {
    drawCrate(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Bushes (depth 3, no physics)
  for (let i = 0; i < counts.bushes; i++) {
    drawBush(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Stumps (depth 3, no physics)
  for (let i = 0; i < counts.stumps; i++) {
    drawStump(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Flowers (depth 2, very small)
  for (let i = 0; i < counts.flowers; i++) {
    drawFlower(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Trees -- trunk at depth 3, crown at depth 8 (over everything for depth feel)
  for (let i = 0; i < counts.trees; i++) {
    drawTree(scene, decorContainer, colliders, mapW, mapH, basePosition, rng, zone, isDaytime);
  }

  // Mushrooms (depth 2, placed near tree base positions -- but just random for now)
  for (let i = 0; i < counts.mushrooms; i++) {
    drawMushroom(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }
}

// ---------------------------------------------------------------------------
// City decoration generator
// ---------------------------------------------------------------------------

function generateCityDecor(
  scene: Phaser.Scene,
  decorContainer: Phaser.GameObjects.Container,
  colliders: Phaser.Physics.Arcade.StaticGroup,
  naturalBlockerRects: NaturalBlockerRect[],
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  isDaytime: boolean
): void {
  // Building ruins: 4-7 per map, each a partial shell that blocks movement
  const ruinCount = rng.nextInt(4, 7);
  for (let i = 0; i < ruinCount; i++) {
    drawBuildingRuin(scene, decorContainer, colliders, naturalBlockerRects, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Abandoned cars: 5-9 per map (visual only, no physics -- small enough to step past)
  const carCount = rng.nextInt(5, 9);
  for (let i = 0; i < carCount; i++) {
    drawAbandonedCar(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Streetlights: 4-8, scattered along the streets
  const lightCount = rng.nextInt(4, 8);
  for (let i = 0; i < lightCount; i++) {
    drawStreetlight(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Debris piles / rubble (visual, no physics)
  const debrisCount = rng.nextInt(6, 12);
  for (let i = 0; i < debrisCount; i++) {
    drawUrbanDebris(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }

  // A few scraggly trees
  for (let i = 0; i < rng.nextInt(1, 3); i++) {
    drawTree(scene, decorContainer, colliders, mapW, mapH, basePosition, rng, 'city', isDaytime);
  }
}

// ---------------------------------------------------------------------------
// Military decoration generator
// ---------------------------------------------------------------------------

function generateMilitaryDecor(
  scene: Phaser.Scene,
  decorContainer: Phaser.GameObjects.Container,
  colliders: Phaser.Physics.Arcade.StaticGroup,
  naturalBlockerRects: NaturalBlockerRect[],
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  isDaytime: boolean
): void {
  // Helipad: one per map, placed off-center but not too close to base
  drawHelipad(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);

  // Bunkers: 3-5, act as hard cover that blocks movement
  const bunkerCount = rng.nextInt(3, 5);
  for (let i = 0; i < bunkerCount; i++) {
    drawBunker(scene, decorContainer, colliders, naturalBlockerRects, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Barbed wire sections: 5-9, visual only (decorative lines)
  const wireCount = rng.nextInt(5, 9);
  for (let i = 0; i < wireCount; i++) {
    drawBarbedWire(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Pre-placed sandbag walls near the base perimeter
  const sandbagCount = rng.nextInt(3, 6);
  for (let i = 0; i < sandbagCount; i++) {
    drawSandbagCluster(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }

  // Sparse vegetation: a few bushes and short grass
  for (let i = 0; i < rng.nextInt(4, 8); i++) {
    drawBush(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }

  // A few trees
  for (let i = 0; i < rng.nextInt(2, 5); i++) {
    drawTree(scene, decorContainer, colliders, mapW, mapH, basePosition, rng, 'military', isDaytime);
  }

  // Crates / supply boxes
  for (let i = 0; i < rng.nextInt(3, 5); i++) {
    drawCrate(scene, decorContainer, mapW, mapH, basePosition, rng, isDaytime);
  }
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
    case 'endless': // Endless uses forest visuals as fallback
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
      // City uses dedicated generateCityDecor() -- these counts are unused
      return {
        trees: 0, stones: 0, bushes: 0, stumps: 0, water: 0,
        paths: 0, flowers: 0, mushrooms: 0, logs: 0, crates: 0,
      };
    case 'military':
      // Military uses dedicated generateMilitaryDecor() -- these counts are unused
      return {
        trees: 0, stones: 0, bushes: 0, stumps: 0, water: 0,
        paths: 0, flowers: 0, mushrooms: 0, logs: 0, crates: 0,
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
  zone: ZoneId,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, true);
  if (!pos) return;

  const scale = rng.nextFloat(0.8, 1.5);
  const trunkW = Math.round(9 * scale);
  const trunkH = Math.round(20 * scale);
  const crownR  = Math.round(20 * scale);

  // Daytime uses brighter trunk/crown colours; night uses darker muted tones.
  const dayBright = isDaytime ? 0.10 : 0;

  // --- Colour palettes by zone (endless uses forest palette as fallback) ---
  const trunkColorsBase: Record<ZoneId, [number, number]> = {
    forest:   [0x5A3A1E, 0x3A2010],
    city:     [0x4A4030, 0x2A2018],
    military: [0x5A4A30, 0x3A2E18],
    endless:  [0x5A3A1E, 0x3A2010],
  };
  const crownPaletteBase: Record<ZoneId, number[]> = {
    forest:   [0x2A5A18, 0x336B20, 0x1E4410, 0x3A6E26, 0x254E14],
    city:     [0x3A4A22, 0x2A3A18, 0x4A5A2A],
    military: [0x4A5A30, 0x3A4A22, 0x566430],
    endless:  [0x2A5A18, 0x336B20, 0x1E4410, 0x3A6E26, 0x254E14],
  };

  const trunkColors: Record<ZoneId, [number, number]> = {
    forest:   [lightenColor(trunkColorsBase.forest[0],   dayBright), lightenColor(trunkColorsBase.forest[1],   dayBright)],
    city:     [lightenColor(trunkColorsBase.city[0],     dayBright), lightenColor(trunkColorsBase.city[1],     dayBright)],
    military: [lightenColor(trunkColorsBase.military[0], dayBright), lightenColor(trunkColorsBase.military[1], dayBright)],
    endless:  [lightenColor(trunkColorsBase.endless[0],  dayBright), lightenColor(trunkColorsBase.endless[1],  dayBright)],
  };
  const crownPalette: Record<ZoneId, number[]> = {
    forest:   lightenPalette(crownPaletteBase.forest,   dayBright),
    city:     lightenPalette(crownPaletteBase.city,     dayBright),
    military: lightenPalette(crownPaletteBase.military, dayBright),
    endless:  lightenPalette(crownPaletteBase.endless,  dayBright),
  };

  const [trunkLight, trunkDark] = trunkColors[zone];
  const palette = crownPalette[zone];

  // Pick 3 crown colours from palette
  const c0 = palette[rng.nextInt(0, palette.length - 1)] ?? 0x2A5A18;
  const c1 = palette[rng.nextInt(0, palette.length - 1)] ?? 0x336B20;
  const c2 = palette[rng.nextInt(0, palette.length - 1)] ?? 0x1E4410;
  const cShadow = 0x0F2808; // very dark green for shadow ellipse
  // Daytime shadows are softer (more ambient light, less pronounced shadow)
  const shadowAlpha = isDaytime ? 0.10 : 0.22;

  // --- Ground shadow under crown (depth 1 -- on the ground) ---
  const shadow = scene.add.graphics();
  shadow.fillStyle(cShadow, shadowAlpha);
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
  zone: ZoneId,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const large = rng.chance(0.4);
  const rx = rng.nextFloat(large ? 14 : 6, large ? 24 : 13);
  const ry = rng.nextFloat(rx * 0.55, rx * 0.85);

  // Daytime stones are lighter/warmer; night stones are darker/cooler.
  const dayFactor = isDaytime ? 0.10 : 0;
  const baseColor  = lightenColor(zone === 'city'     ? 0x707070 :
                                  zone === 'military' ? 0x8B7D5C : 0x888888, dayFactor);
  const darkColor  = lightenColor(zone === 'city'     ? 0x505050 :
                                  zone === 'military' ? 0x6B5D3C : 0x606060, dayFactor);
  const lightColor = lightenColor(zone === 'city'     ? 0x909090 :
                                  zone === 'military' ? 0xA09070 : 0xAAAAAA, dayFactor);

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
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const size = rng.nextFloat(9, 18);
  // Daytime bushes use a brighter green palette
  const dayFactor = isDaytime ? 0.10 : 0;
  const colorPaletteBase = [0x2D5A1E, 0x3B6B28, 0x1E3D12, 0x4A5E2A, 0x355020];
  const colorPalette = lightenPalette(colorPaletteBase, dayFactor);
  const base  = colorPalette[rng.nextInt(0, colorPalette.length - 1)] ?? 0x2D5A1E;
  const light = colorPalette[rng.nextInt(0, colorPalette.length - 1)] ?? 0x3B6B28;
  const dark  = colorPalette[rng.nextInt(0, colorPalette.length - 1)] ?? 0x1E3D12;

  const g = scene.add.graphics();

  // Ground shadow (softer in daytime)
  g.fillStyle(0x0A1E06, isDaytime ? 0.10 : 0.20);
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

  // Top highlight (lighter specular -- brighter in daytime)
  g.fillStyle(isDaytime ? 0x7AAA45 : 0x5A8030, isDaytime ? 0.45 : 0.30);
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
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const r = rng.nextFloat(7, 14);
  const dayFactor = isDaytime ? 0.10 : 0;

  const g = scene.add.graphics();
  // Drop shadow (softer in daylight)
  g.fillStyle(0x0A1806, isDaytime ? 0.12 : 0.25);
  g.fillEllipse(2, r * 0.6, r * 2.4, r * 0.8);
  // Outer bark ring
  g.fillStyle(lightenColor(0x5A3D22, dayFactor));
  g.fillCircle(0, 0, r);
  // Inner heartwood
  g.fillStyle(lightenColor(0x7A5A38, dayFactor));
  g.fillCircle(0, 0, r * 0.65);
  // Annual rings
  g.lineStyle(1, lightenColor(0x4A2E14, dayFactor), 0.6);
  g.strokeCircle(0, 0, r * 0.45);
  g.lineStyle(1, lightenColor(0x4A2E14, dayFactor), 0.35);
  g.strokeCircle(0, 0, r * 0.25);
  // Light spot (top-left reflected light)
  g.fillStyle(lightenColor(0x9A7A54, dayFactor), isDaytime ? 0.5 : 0.3);
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
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const rx = rng.nextFloat(22, 50);
  const ry = rng.nextFloat(13, 30);

  const g = scene.add.graphics();
  // Daytime water is a brighter blue; night water is dark and murky.
  const shoreColor = isDaytime ? 0x6A5A30 : 0x2A1E0A;
  const waterColor = isDaytime ? 0x3A8ABF : 0x0D2B4A;
  const reflectA   = isDaytime ? 0x70C0F0 : 0x1F5A8A;
  const reflectB   = isDaytime ? 0x90D0FF : 0x2A6A9A;

  // Muddy/sandy shore ring
  g.fillStyle(shoreColor, 0.5);
  g.fillEllipse(0, 0, rx * 2 + 8, ry * 2 + 6);
  // Water body
  g.fillStyle(waterColor, isDaytime ? 0.75 : 0.80);
  g.fillEllipse(0, 0, rx * 2, ry * 2);
  // Highlight reflection stripe
  g.fillStyle(reflectA, isDaytime ? 0.45 : 0.35);
  g.fillEllipse(-rx * 0.25, -ry * 0.35, rx * 0.9, ry * 0.45);
  // Second small highlight
  g.fillStyle(reflectB, isDaytime ? 0.30 : 0.20);
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
  zone: ZoneId,
  isDaytime: boolean
): void {
  // Daytime paths are lighter/dustier; night paths are very dark.
  const nightColor = zone === 'city' ? 0x3A3A3A : 0x2A1F0F;
  const pathColor  = isDaytime ? lightenColor(nightColor, 0.35) : nightColor;
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
  rng: SeededRandom,
  isDaytime: boolean
): void {
  // Flowers are already bright; in daytime just boost opacity slightly.
  void isDaytime; // no color change needed -- flowers look fine day or night
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
  rng: SeededRandom,
  isDaytime: boolean
): void {
  void isDaytime; // mushroom colours are acceptable in both lighting conditions
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
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const len = rng.nextFloat(30, 60);
  const thickness = rng.nextFloat(7, 13);
  const angle = rng.nextFloat(-0.6, 0.6); // slight diagonal, never perfectly straight

  const dayFactor = isDaytime ? 0.10 : 0;
  const barkColor  = lightenColor(0x5A3A1E, dayFactor);
  const darkBark   = lightenColor(0x3A2010, dayFactor);
  const lightBark  = lightenColor(0x7A5A38, dayFactor);

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
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPosNearBase(mapW, mapH, basePosition, rng);
  if (!pos) return;

  const w = rng.nextInt(10, 18);
  const h = rng.nextInt(8, 14);
  const isBroken = rng.chance(0.4);

  const dayFactor = isDaytime ? 0.10 : 0;
  const woodColor  = lightenColor(0x8B6914, dayFactor);
  const darkWood   = lightenColor(0x5A4010, dayFactor);
  const lightWood  = lightenColor(0xC89030, dayFactor);

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

// ===========================================================================
// CITY DRAWING FUNCTIONS
// ===========================================================================

/**
 * Draw a building ruin shell: a rectangular frame with broken walls and
 * rubble fill. Adds a physics body so zombies and the player collide with it.
 * Records the AABB in naturalBlockerRects for PathGrid.
 */
function drawBuildingRuin(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  colliders: Phaser.Physics.Arcade.StaticGroup,
  naturalBlockerRects: NaturalBlockerRect[],
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, true);
  if (!pos) return;

  const bw = rng.nextInt(48, 90);
  const bh = rng.nextInt(36, 70);
  const wallThick = rng.nextInt(5, 9);

  const dayFactor = isDaytime ? 0.10 : 0;
  const wallColor   = lightenColor(0x5A5248, dayFactor);
  const darkWall    = lightenColor(0x3A3230, dayFactor);
  const lightWall   = lightenColor(0x7A7068, dayFactor);
  const rubbleColor = lightenColor(0x6A5A48, dayFactor);

  const g = scene.add.graphics();

  // Floor / rubble interior
  g.fillStyle(rubbleColor, 0.55);
  g.fillRect(-bw / 2 + wallThick, -bh / 2 + wallThick, bw - wallThick * 2, bh - wallThick * 2);

  // Small debris chunks inside
  const debrisCount = rng.nextInt(3, 7);
  for (let d = 0; d < debrisCount; d++) {
    const dx = rng.nextFloat(-bw / 2 + wallThick + 4, bw / 2 - wallThick - 4);
    const dy = rng.nextFloat(-bh / 2 + wallThick + 4, bh / 2 - wallThick - 4);
    const dr = rng.nextFloat(2, 6);
    g.fillStyle(darkWall, 0.6);
    g.fillRect(dx, dy, dr * 2, dr);
  }

  // Wall segments (each with 20% chance of a gap -- broken section)
  const drawWallSegment = (wx: number, wy: number, ww: number, wh: number): void => {
    g.fillStyle(wallColor);
    g.fillRect(wx, wy, ww, wh);
    g.fillStyle(darkWall, 0.5);
    g.fillRect(wx + ww * 0.6, wy, ww * 0.4, wh);
    g.fillStyle(lightWall, 0.3);
    g.fillRect(wx, wy, ww * 0.35, wh * 0.4);
  };

  if (!rng.chance(0.2)) drawWallSegment(-bw / 2, -bh / 2, bw, wallThick);
  if (!rng.chance(0.2)) drawWallSegment(-bw / 2, bh / 2 - wallThick, bw, wallThick);
  if (!rng.chance(0.2)) drawWallSegment(-bw / 2, -bh / 2, wallThick, bh);
  if (!rng.chance(0.2)) drawWallSegment(bw / 2 - wallThick, -bh / 2, wallThick, bh);

  // Window openings (dark rectangles on intact walls)
  const winW = rng.nextInt(8, 14);
  const winH = rng.nextInt(6, 10);
  g.fillStyle(0x111111, 0.85);
  g.fillRect(-bw / 4 - winW / 2, -bh / 2, winW, winH);
  g.fillRect(bw / 4 - winW / 2,  -bh / 2, winW, winH);

  g.setDepth(2);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;

  // Physics body for the full ruin footprint
  const body = colliders.create(pos.x, pos.y, '') as Phaser.Physics.Arcade.Sprite;
  body.setVisible(false);
  body.setDisplaySize(bw, bh);
  (body.body as Phaser.Physics.Arcade.StaticBody).setSize(bw, bh);
  body.refreshBody();

  // Register in PathGrid natural blockers
  naturalBlockerRects.push({ x: pos.x, y: pos.y, w: bw, h: bh });
}

/**
 * Draw an abandoned car. No physics body -- small enough not to block paths.
 */
function drawAbandonedCar(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const carW = rng.nextInt(20, 28);
  const carH = rng.nextInt(12, 16);

  const dayFactor = isDaytime ? 0.10 : 0;
  const carBases = [0x7A3A2A, 0x2A3A5A, 0x6A6A6A, 0x4A5A2A, 0x8A7A2A];
  const carBase   = lightenColor(carBases[rng.nextInt(0, carBases.length - 1)] ?? 0x6A6A6A, dayFactor);
  const carDark   = lightenColor(0x1A1A1A, dayFactor);
  const rustColor = lightenColor(0x7A3A18, dayFactor);

  const g = scene.add.graphics();
  g.setRotation(rng.nextFloat(-0.4, 0.4));

  // Drop shadow
  g.fillStyle(0x000000, 0.25);
  g.fillRect(-carW / 2 + 2, -carH / 2 + carH * 0.6, carW, carH * 0.5);

  // Car body
  g.fillStyle(carBase);
  g.fillRect(-carW / 2, -carH / 2, carW, carH);

  // Windshields (dark glass)
  g.fillStyle(carDark, 0.8);
  g.fillRect(-carW / 2 + 3, -carH / 2, carW / 4, carH * 0.6);
  g.fillRect(carW / 4, -carH / 2, carW / 4, carH * 0.6);

  // Rust patch
  if (rng.chance(0.6)) {
    g.fillStyle(rustColor, 0.55);
    g.fillEllipse(rng.nextFloat(-carW / 3, carW / 3), rng.nextFloat(-carH / 3, carH / 3),
                  rng.nextFloat(4, 8), rng.nextFloat(3, 5));
  }

  // Wheels
  g.fillStyle(0x1A1A1A);
  g.fillCircle(-carW / 2 + 4, -carH / 2 + 2, 3);
  g.fillCircle( carW / 2 - 4, -carH / 2 + 2, 3);
  g.fillCircle(-carW / 2 + 4,  carH / 2 - 2, 3);
  g.fillCircle( carW / 2 - 4,  carH / 2 - 2, 3);

  g.setDepth(3);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;
}

/**
 * Draw a streetlight pole with lamp head. Decorative only.
 */
function drawStreetlight(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const dayFactor = isDaytime ? 0.10 : 0;
  const poleColor = lightenColor(0x484848, dayFactor);
  const lampColor = isDaytime ? 0xE8D88A : 0xFFEE88;
  const poleH = rng.nextInt(22, 32);

  const g = scene.add.graphics();

  // Shadow
  g.fillStyle(0x000000, isDaytime ? 0.12 : 0.25);
  g.fillRect(1, -poleH, 2, poleH + 3);

  // Pole
  g.fillStyle(poleColor);
  g.fillRect(-2, -poleH, 4, poleH);

  // Arm
  const armLen = rng.nextInt(10, 18);
  const armDir = rng.chance(0.5) ? 1 : -1;
  g.fillRect(armDir > 0 ? 2 : -2 - armLen, -poleH + 3, armLen, 2);

  // Lamp head
  g.fillStyle(lampColor, isDaytime ? 0.8 : 1.0);
  g.fillRect((armDir > 0 ? 2 + armLen - 5 : -2 - armLen), -poleH + 1, 6, 4);

  // Night glow halo
  if (!isDaytime) {
    g.fillStyle(lampColor, 0.15);
    g.fillCircle((armDir > 0 ? 2 + armLen - 2 : -2 - armLen + 3), -poleH + 3, 10);
  }

  g.setDepth(4);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;
}

/**
 * Urban debris: broken concrete chunks, scattered bricks. Decorative only.
 */
function drawUrbanDebris(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const dayFactor = isDaytime ? 0.10 : 0;
  const baseCol = lightenColor(0x5A5248, dayFactor);
  const darkCol = lightenColor(0x3A3028, dayFactor);

  const g = scene.add.graphics();
  const pieceCount = rng.nextInt(3, 7);
  for (let p = 0; p < pieceCount; p++) {
    const px2 = rng.nextFloat(-12, 12);
    const py2 = rng.nextFloat(-8, 8);
    const pw = rng.nextFloat(4, 10);
    const ph = rng.nextFloat(3, 7);
    const pieceAngle = rng.nextFloat(0, Math.PI);
    const cos = Math.cos(pieceAngle);
    const sin = Math.sin(pieceAngle);
    const hw = pw / 2;
    const hh = ph / 2;
    const pts = [
      { x: px2 + cos * hw - sin * hh, y: py2 + sin * hw + cos * hh },
      { x: px2 + cos * hw + sin * hh, y: py2 + sin * hw - cos * hh },
      { x: px2 - cos * hw + sin * hh, y: py2 - sin * hw - cos * hh },
      { x: px2 - cos * hw - sin * hh, y: py2 - sin * hw + cos * hh },
    ];
    g.fillStyle(p % 2 === 0 ? baseCol : darkCol, 0.75);
    g.fillPoints(pts as Phaser.Geom.Point[], true);
  }

  g.setDepth(2);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;
}

// ===========================================================================
// MILITARY DRAWING FUNCTIONS
// ===========================================================================

/**
 * Draw a concrete bunker. Adds physics body + records AABB for PathGrid.
 */
function drawBunker(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  colliders: Phaser.Physics.Arcade.StaticGroup,
  naturalBlockerRects: NaturalBlockerRect[],
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, true);
  if (!pos) return;

  const bw = rng.nextInt(32, 56);
  const bh = rng.nextInt(24, 40);

  const dayFactor = isDaytime ? 0.10 : 0;
  const concreteBase  = lightenColor(0x6A6E58, dayFactor);
  const concreteDark  = lightenColor(0x3A3E28, dayFactor);
  const concreteLight = lightenColor(0x8A8E78, dayFactor);

  const g = scene.add.graphics();

  // Drop shadow
  g.fillStyle(0x000000, isDaytime ? 0.18 : 0.35);
  g.fillRect(-bw / 2 + 4, bh / 2 - 2, bw, 6);

  // Main body
  g.fillStyle(concreteBase);
  g.fillRect(-bw / 2, -bh / 2, bw, bh);

  // Dark right/bottom (3D effect)
  g.fillStyle(concreteDark, 0.55);
  g.fillRect(bw / 2 - bw * 0.25, -bh / 2, bw * 0.25, bh);
  g.fillRect(-bw / 2, bh / 2 - bh * 0.2, bw, bh * 0.2);

  // Light top-left highlight
  g.fillStyle(concreteLight, 0.3);
  g.fillRect(-bw / 2, -bh / 2, bw, bh * 0.18);
  g.fillRect(-bw / 2, -bh / 2, bw * 0.18, bh);

  // Gun slits
  const slitW = Math.round(bw * 0.22);
  g.fillStyle(0x080A05, 0.9);
  g.fillRect(-slitW / 2, -1, slitW, 3);
  g.fillRect(-bw / 2 + 4, -1, slitW * 0.6, 3);

  // Camo blotches
  const camoBases = [0x4A5438, 0x3A4228, 0x5A6045];
  for (let c = 0; c < 3; c++) {
    const cx2 = rng.nextFloat(-bw / 2 + 4, bw / 2 - 4);
    const cy2 = rng.nextFloat(-bh / 2 + 4, bh / 2 - 4);
    g.fillStyle(camoBases[c % camoBases.length] ?? 0x4A5438, 0.35);
    g.fillEllipse(cx2, cy2, rng.nextFloat(6, 14), rng.nextFloat(4, 9));
  }

  g.setDepth(3);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;

  // Physics body
  const body = colliders.create(pos.x, pos.y, '') as Phaser.Physics.Arcade.Sprite;
  body.setVisible(false);
  body.setDisplaySize(bw, bh);
  (body.body as Phaser.Physics.Arcade.StaticBody).setSize(bw, bh);
  body.refreshBody();

  // Register natural blocker
  naturalBlockerRects.push({ x: pos.x, y: pos.y, w: bw, h: bh });
}

/**
 * Draw a barbed wire section: zig-zag line with spike tines. Decorative only.
 */
function drawBarbedWire(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const len = rng.nextFloat(30, 70);
  const wireAngle = rng.nextFloat(0, Math.PI);
  const segments = rng.nextInt(5, 10);

  const dayFactor = isDaytime ? 0.10 : 0;
  const wireColor  = lightenColor(0x8A8070, dayFactor);
  const spikeColor = lightenColor(0xB0A890, dayFactor);

  const g = scene.add.graphics();
  const segLen = len / segments;

  // Zig-zag wire path
  g.lineStyle(1, wireColor, 0.85);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  for (let s = 0; s <= segments; s++) {
    g.lineTo(-len / 2 + s * segLen, s % 2 === 0 ? -3 : 3);
  }
  g.strokePath();

  // Spike tines
  for (let s = 0; s < segments; s++) {
    const sx = -len / 2 + (s + 0.5) * segLen;
    const sy = s % 2 === 0 ? -3 : 3;
    g.lineStyle(1, spikeColor, 0.75);
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - 2, sy - 4); g.strokePath();
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 2, sy - 4); g.strokePath();
  }

  g.setRotation(wireAngle);
  g.setDepth(2);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;
}

/**
 * Draw a sandbag cluster placed near the base perimeter. Visual only.
 */
function drawSandbagCluster(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const clusterAngle = rng.nextFloat(0, Math.PI * 2);
  const dist = rng.nextFloat(110, 180);
  const px = basePosition.x + Math.cos(clusterAngle) * dist;
  const py = basePosition.y + Math.sin(clusterAngle) * dist;
  if (px < EDGE_MARGIN || px > mapW - EDGE_MARGIN ||
      py < EDGE_MARGIN || py > mapH - EDGE_MARGIN) return;

  const dayFactor = isDaytime ? 0.10 : 0;
  const bagColor  = lightenColor(0xB0924A, dayFactor);
  const bagDark   = lightenColor(0x7A6430, dayFactor);
  const bagLight  = lightenColor(0xD0B468, dayFactor);

  const g = scene.add.graphics();
  const bagCount = rng.nextInt(3, 6);
  const rowW = rng.nextInt(16, 26);
  const bagW = rowW / Math.ceil(bagCount / 2);
  const bagH = 6;

  // Bottom row
  for (let b = 0; b < Math.ceil(bagCount / 2); b++) {
    const bx = -rowW / 2 + b * bagW;
    g.fillStyle(bagColor);
    g.fillEllipse(bx + bagW / 2, bagH / 2, bagW - 2, bagH);
    g.fillStyle(bagDark, 0.4);
    g.fillEllipse(bx + bagW / 2, bagH * 0.65, bagW - 3, bagH * 0.5);
    g.fillStyle(bagLight, 0.25);
    g.fillEllipse(bx + bagW / 2 - 1, bagH * 0.25, bagW * 0.5, bagH * 0.35);
  }
  // Top row (offset)
  for (let b = 0; b < Math.floor(bagCount / 2); b++) {
    const bx = -rowW / 2 + bagW / 2 + b * bagW;
    g.fillStyle(bagColor);
    g.fillEllipse(bx + bagW / 2, -bagH / 2, bagW - 2, bagH);
    g.fillStyle(bagDark, 0.4);
    g.fillEllipse(bx + bagW / 2, -bagH * 0.15, bagW - 3, bagH * 0.5);
  }

  g.setDepth(3);
  container.add(g);
  g.x = px;
  g.y = py;
}

/**
 * Draw a helicopter landing pad. One per military map. Decorative only.
 */
function drawHelipad(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  mapW: number,
  mapH: number,
  basePosition: { x: number; y: number },
  rng: SeededRandom,
  isDaytime: boolean
): void {
  const pos = randomPos(mapW, mapH, basePosition, rng, false);
  if (!pos) return;

  const r = 28;
  const dayFactor = isDaytime ? 0.10 : 0;
  const padColor     = lightenColor(0x5A5E4A, dayFactor);
  const markingColor = lightenColor(0xC8C0A0, dayFactor);

  const g = scene.add.graphics();

  g.fillStyle(padColor);
  g.fillCircle(0, 0, r);

  g.lineStyle(2, markingColor, 0.65);
  g.strokeCircle(0, 0, r - 3);
  g.lineStyle(1, markingColor, 0.5);
  g.strokeCircle(0, 0, r * 0.5);

  // H marking
  const hW = r * 0.45;
  const hH = r * 0.6;
  g.lineStyle(3, markingColor, 0.70);
  g.beginPath(); g.moveTo(-hW, -hH / 2); g.lineTo(-hW, hH / 2); g.strokePath();
  g.beginPath(); g.moveTo( hW, -hH / 2); g.lineTo( hW, hH / 2); g.strokePath();
  g.beginPath(); g.moveTo(-hW, 0);       g.lineTo( hW, 0);       g.strokePath();

  g.setDepth(1);
  container.add(g);
  g.x = pos.x;
  g.y = pos.y;
}

// ===========================================================================
// ZONE BACKGROUND DRAWING (exported -- called by NightScene and DayScene)
// ===========================================================================

/**
 * Draw zone-specific background layers: ground fill, streets/roads,
 * base clearing, and ground detail patches.
 *
 * Returns an array of Graphics objects. DayScene adds them to its mapContainer.
 * NightScene ignores the return value (graphics are added to the scene root).
 *
 * @param scene       Active Phaser scene.
 * @param zone        Current zone ID.
 * @param mapW        Map pixel width.
 * @param mapH        Map pixel height.
 * @param centerX     World X of the map/base centre.
 * @param centerY     World Y of the map/base centre.
 * @param roadRow     Tile row index of the central road/street (forest only).
 * @param isDaytime   When true, use brighter palette (DayScene). Default false.
 */
export function drawZoneBackground(
  scene: Phaser.Scene,
  zone: ZoneId,
  mapW: number,
  mapH: number,
  centerX: number,
  centerY: number,
  roadRow: number,
  isDaytime: boolean = false
): Phaser.GameObjects.Graphics[] {
  switch (zone) {
    case 'city':
      return drawCityBackground(scene, mapW, mapH, centerX, centerY, isDaytime);
    case 'military':
      return drawMilitaryBackground(scene, mapW, mapH, centerX, centerY, isDaytime);
    default:
      // Forest, endless, and future zones use the organic ground style
      return drawForestBackground(scene, mapW, mapH, centerX, centerY, roadRow, isDaytime);
  }
}

// ---------------------------------------------------------------------------
// Forest background
// ---------------------------------------------------------------------------

function drawForestBackground(
  scene: Phaser.Scene,
  mapW: number,
  mapH: number,
  centerX: number,
  centerY: number,
  roadRow: number,
  isDaytime: boolean
): Phaser.GameObjects.Graphics[] {
  const result: Phaser.GameObjects.Graphics[] = [];
  const dayFactor = isDaytime ? 0.10 : 0;

  const ground = scene.add.graphics();
  ground.setDepth(0);
  ground.fillStyle(lightenColor(0x2A4A22, dayFactor));
  ground.fillRect(0, 0, mapW, mapH);
  result.push(ground);

  const roadCentreY = roadRow * TILE_SIZE + TILE_SIZE / 2;
  const roadHalfH   = TILE_SIZE;

  const road = scene.add.graphics();
  road.setDepth(0);
  road.fillStyle(lightenColor(0x3A2510, dayFactor), 0.55);
  road.fillRect(0, roadCentreY - roadHalfH - 4, mapW, 8);
  road.fillRect(0, roadCentreY + roadHalfH - 4, mapW, 8);
  road.fillStyle(lightenColor(0x4A3218, dayFactor));
  road.fillRect(0, roadCentreY - roadHalfH, mapW, roadHalfH * 2);
  road.fillStyle(lightenColor(0x5A3E20, dayFactor), 0.45);
  road.fillRect(0, roadCentreY - 3, mapW, 6);
  result.push(road);

  const baseArea = scene.add.graphics();
  baseArea.setDepth(0);
  baseArea.fillStyle(lightenColor(0x3E2A12, dayFactor), 0.55);
  baseArea.fillEllipse(centerX, centerY, 256, 256);
  baseArea.fillStyle(lightenColor(0x4A3218, dayFactor));
  baseArea.fillEllipse(centerX, centerY, 200, 200);
  result.push(baseArea);

  const patches = scene.add.graphics();
  patches.setDepth(1);
  const tileW = Math.ceil(mapW / TILE_SIZE);
  const tileH = Math.ceil(mapH / TILE_SIZE);
  for (let ty2 = 0; ty2 < tileH; ty2++) {
    for (let tx2 = 0; tx2 < tileW; tx2++) {
      const hash4 = ((tx2 * 3571 + ty2 * 6173) * 2654435769) >>> 0;
      if ((hash4 % 100) < 15) {
        const patchX = tx2 * TILE_SIZE + (hash4 % TILE_SIZE);
        const patchY = ty2 * TILE_SIZE + ((hash4 >> 5) % TILE_SIZE);
        const pType = (hash4 >> 10) % 3;
        if (pType === 0) {
          patches.fillStyle(lightenColor(0x4A7A2A, dayFactor), 0.55);
          patches.fillEllipse(patchX, patchY, 6, 4);
        } else if (pType === 1) {
          patches.fillStyle(lightenColor(0x6B4A1A, dayFactor), 0.45);
          patches.fillEllipse(patchX, patchY, 5, 3);
        } else {
          patches.fillStyle(lightenColor(0x777060, dayFactor), 0.5);
          patches.fillCircle(patchX, patchY, 1.5);
        }
      }
    }
  }
  result.push(patches);

  return result;
}

// ---------------------------------------------------------------------------
// City background
// ---------------------------------------------------------------------------

function drawCityBackground(
  scene: Phaser.Scene,
  mapW: number,
  mapH: number,
  centerX: number,
  centerY: number,
  isDaytime: boolean
): Phaser.GameObjects.Graphics[] {
  const result: Phaser.GameObjects.Graphics[] = [];
  const dayFactor = isDaytime ? 0.10 : 0;

  // Asphalt base
  const ground = scene.add.graphics();
  ground.setDepth(0);
  ground.fillStyle(lightenColor(0x3A3A3A, dayFactor));
  ground.fillRect(0, 0, mapW, mapH);
  result.push(ground);

  const streets = scene.add.graphics();
  streets.setDepth(0);

  // Main horizontal street
  const hStreetY = mapH / 2;
  const hHalfH = TILE_SIZE * 1.4;
  streets.fillStyle(lightenColor(0x4A4A4A, dayFactor));
  streets.fillRect(0, hStreetY - hHalfH, mapW, hHalfH * 2);
  // Dashed centre line (faded yellow)
  streets.fillStyle(lightenColor(0x9A8840, dayFactor), isDaytime ? 0.55 : 0.35);
  for (let x = 0; x < mapW; x += TILE_SIZE * 2) {
    streets.fillRect(x, hStreetY - 2, TILE_SIZE, 4);
  }
  // Kerb lines
  streets.fillStyle(lightenColor(0x666666, dayFactor), 0.6);
  streets.fillRect(0, hStreetY - hHalfH, mapW, 3);
  streets.fillRect(0, hStreetY + hHalfH - 3, mapW, 3);

  // Cross street (vertical, offset to 65% of map width)
  const vStreetX = mapW * 0.65;
  const vHalfW = TILE_SIZE * 1.2;
  streets.fillStyle(lightenColor(0x4A4A4A, dayFactor));
  streets.fillRect(vStreetX - vHalfW, 0, vHalfW * 2, mapH);
  streets.fillStyle(lightenColor(0x9A8840, dayFactor), isDaytime ? 0.55 : 0.35);
  for (let y = 0; y < mapH; y += TILE_SIZE * 2) {
    streets.fillRect(vStreetX - 2, y, 4, TILE_SIZE);
  }
  streets.fillStyle(lightenColor(0x666666, dayFactor), 0.6);
  streets.fillRect(vStreetX - vHalfW, 0, 3, mapH);
  streets.fillRect(vStreetX + vHalfW - 3, 0, 3, mapH);

  result.push(streets);

  // Cleared base plaza
  const baseArea = scene.add.graphics();
  baseArea.setDepth(0);
  baseArea.fillStyle(lightenColor(0x484848, dayFactor), 0.65);
  baseArea.fillEllipse(centerX, centerY, 220, 220);
  result.push(baseArea);

  // Ground staining: oil, cracks, rubble dust, glass
  const stains = scene.add.graphics();
  stains.setDepth(1);
  const tileW = Math.ceil(mapW / TILE_SIZE);
  const tileH = Math.ceil(mapH / TILE_SIZE);
  for (let ty2 = 0; ty2 < tileH; ty2++) {
    for (let tx2 = 0; tx2 < tileW; tx2++) {
      const hash4 = ((tx2 * 4127 + ty2 * 7919) * 2654435769) >>> 0;
      if ((hash4 % 100) < 18) {
        const px = tx2 * TILE_SIZE + (hash4 % TILE_SIZE);
        const py = ty2 * TILE_SIZE + ((hash4 >> 5) % TILE_SIZE);
        const pType = (hash4 >> 10) % 4;
        if (pType === 0) {
          stains.fillStyle(0x0A0A10, 0.45);
          stains.fillEllipse(px, py, 8, 5);
        } else if (pType === 1) {
          stains.lineStyle(1, lightenColor(0x252525, dayFactor), 0.5);
          stains.beginPath(); stains.moveTo(px, py); stains.lineTo(px + 5, py + 3); stains.strokePath();
        } else if (pType === 2) {
          stains.fillStyle(lightenColor(0x6A5A48, dayFactor), 0.30);
          stains.fillCircle(px, py, 2.5);
        } else {
          stains.fillStyle(lightenColor(0x8888AA, dayFactor), isDaytime ? 0.5 : 0.25);
          stains.fillCircle(px, py, 1.2);
        }
      }
    }
  }
  result.push(stains);

  return result;
}

// ---------------------------------------------------------------------------
// Military background
// ---------------------------------------------------------------------------

function drawMilitaryBackground(
  scene: Phaser.Scene,
  mapW: number,
  mapH: number,
  centerX: number,
  centerY: number,
  isDaytime: boolean
): Phaser.GameObjects.Graphics[] {
  const result: Phaser.GameObjects.Graphics[] = [];
  const dayFactor = isDaytime ? 0.10 : 0;

  // Olive-grey base ground
  const ground = scene.add.graphics();
  ground.setDepth(0);
  ground.fillStyle(lightenColor(0x4A5A3A, dayFactor));
  ground.fillRect(0, 0, mapW, mapH);
  result.push(ground);

  // Gravel access road (horizontal)
  const roadY2 = mapH / 2;
  const roadHalfH = TILE_SIZE * 0.9;
  const road = scene.add.graphics();
  road.setDepth(0);
  road.fillStyle(lightenColor(0x6A6A58, dayFactor));
  road.fillRect(0, roadY2 - roadHalfH, mapW, roadHalfH * 2);
  road.fillStyle(lightenColor(0x4A4A38, dayFactor), 0.5);
  road.fillRect(0, roadY2 - roadHalfH * 0.6, mapW, roadHalfH * 0.25);
  road.fillRect(0, roadY2 + roadHalfH * 0.3,  mapW, roadHalfH * 0.25);
  road.fillStyle(lightenColor(0x5A5A48, dayFactor), 0.4);
  road.fillRect(0, roadY2 - roadHalfH, mapW, 2);
  road.fillRect(0, roadY2 + roadHalfH - 2, mapW, 2);
  result.push(road);

  // Perimeter fence suggestion along the top edge
  const fence = scene.add.graphics();
  fence.setDepth(1);
  fence.lineStyle(2, lightenColor(0x9A9080, dayFactor), 0.55);
  fence.beginPath();
  fence.moveTo(0, TILE_SIZE * 1.5);
  fence.lineTo(mapW, TILE_SIZE * 1.5);
  fence.strokePath();
  fence.fillStyle(lightenColor(0x7A7060, dayFactor), 0.6);
  for (let x = 0; x < mapW; x += TILE_SIZE * 2) {
    fence.fillRect(x, TILE_SIZE, 3, TILE_SIZE);
  }
  result.push(fence);

  // Cleared staging area around base
  const baseArea = scene.add.graphics();
  baseArea.setDepth(0);
  baseArea.fillStyle(lightenColor(0x5A6048, dayFactor), 0.6);
  baseArea.fillEllipse(centerX, centerY, 230, 230);
  baseArea.fillStyle(lightenColor(0x626A50, dayFactor), 0.45);
  baseArea.fillEllipse(centerX, centerY, 150, 150);
  result.push(baseArea);

  // Ground texture: sparse grass, bare dirt, gravel, small stones
  const patches = scene.add.graphics();
  patches.setDepth(1);
  const tileW = Math.ceil(mapW / TILE_SIZE);
  const tileH = Math.ceil(mapH / TILE_SIZE);
  for (let ty2 = 0; ty2 < tileH; ty2++) {
    for (let tx2 = 0; tx2 < tileW; tx2++) {
      const hash4 = ((tx2 * 5003 + ty2 * 8111) * 2654435769) >>> 0;
      if ((hash4 % 100) < 20) {
        const px = tx2 * TILE_SIZE + (hash4 % TILE_SIZE);
        const py = ty2 * TILE_SIZE + ((hash4 >> 5) % TILE_SIZE);
        const pType = (hash4 >> 10) % 4;
        if (pType === 0) {
          patches.fillStyle(lightenColor(0x7A8040, dayFactor), 0.5);
          patches.fillEllipse(px, py, 5, 3);
        } else if (pType === 1) {
          patches.fillStyle(lightenColor(0x8A7A58, dayFactor), 0.4);
          patches.fillEllipse(px, py, 7, 4);
        } else if (pType === 2) {
          patches.fillStyle(lightenColor(0x8A8870, dayFactor), 0.45);
          patches.fillCircle(px, py, 1.8);
        } else {
          patches.fillStyle(lightenColor(0x9A9278, dayFactor), 0.5);
          patches.fillCircle(px, py, 1.2);
        }
      }
    }
  }
  result.push(patches);

  return result;
}
