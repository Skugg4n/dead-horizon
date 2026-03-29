# Dead Horizon v1.0.0 -- Fixlista for Claude Code

**Datum:** 2026-03-29
**Fran:** Kodgranskning av v1.0.0
**Syfte:** Atgarder att utfora innan nasta utvecklingsfas. Folj ordningen nedan.

---

## Regler (paminnelse)

- Uppdatera versionsnummer vid andringar (nasta version: 1.0.1)
- Logga alla andringar i CHANGELOG.md
- All speldata i JSON-filer, inte hardkodad
- TypeScript strict mode, inga `any`
- Aldrig EM dash
- Behall svenska tecken

---

## 1. KRITISKT: Minneslackor -- event listeners stadas aldrig

### Problem

NightScene.ts och DayScene.ts registrerar event listeners i `create()` men tar aldrig bort dem vid scenovergang. Varje gang scenen startas om laggs nya lyssnare till ovanpa de gamla, vilket orsakar:
- Dubbla event-hanterare (zombie-killed raknas tva ganger, etc)
- Okande minnesanvandning
- Svarhittade buggar efter manga scenoverganger

### Atgard

Lagg till shutdown-hantering i **bade NightScene.ts och DayScene.ts**. Placera detta i slutet av `create()`:

```typescript
this.events.once('shutdown', () => {
  // Ta bort alla registrerade lyssnare
  this.events.off('zombie-killed');
  this.events.off('wave-started');
  this.events.off('wave-complete');
  this.events.off('all-waves-complete');
  this.events.off('base-damaged');
  this.events.off('sound-fired');
  // ... alla andra registrerade events

  // Stada tweens
  this.tweens.killAll();

  // Ta bort keyboard-lyssnare
  this.input.keyboard?.removeAllListeners();
  this.input.off('pointerdown');
});
```

Gor detta for varje `this.events.on()` och `this.input.on()` som finns i respektive scen. Granska metoderna `setupEvents()` och `setupInput()` for att hitta alla.

Kontrollera ocksa att `delayedCall`-callbacks i Player.ts och Zombie.ts kollar `this.active` innan de gor nagot:

```typescript
this.scene.time.delayedCall(100, () => {
  if (!this.active) return; // lagg till denna rad
  this.setTint(0xffffff);
});
```

### Verifiering

Starta spelet, spela en natt, do, starta en ny natt. Oppna webbkonsolen och kontrollera att det inte loggas dubbla events. Kolla ocksa att `Phaser.Game.scene.scenes` inte har gamla lyssnare kvar.

---

## 2. KRITISKT: Applicera saknad handoff-andring

### Problem

Section 7 ("Verktyg for asset-generering") saknas i docs/art-direction.md.

### Atgard

Lagg till foljande i slutet av docs/art-direction.md (efter Section 6):

```markdown
---

## 7. Verktyg for asset-generering (Fas 5+)

Nar vi gar fran placeholders till riktiga sprites finns dessa verktyg att utforska:

### 7.1 Claude Code Skills (installeras i .claude/skills/)
- **Game Art & Visual Design** (mcpmarket.com/tools/skills/game-art-visual-design) -- art style-guide, asset pipeline, visuell konsistens
- **Pixel Art Professional** (mcpmarket.com/tools/skills/pixel-art-professional) -- sprite-skapande och optimering
- **Pixel Art Generator** (mcpmarket.com/tools/skills/pixel-art-generator) -- AI-driven sprite creation

### 7.2 MCP-servrar for asset-generering
- **game-asset-mcp** (github.com/MubarakHAlketbi/game-asset-mcp) -- genererar 2D/3D game assets via Hugging Face AI-modeller
- **mcp-game-asset-gen** (github.com/Flux159/mcp-game-asset-gen) -- asset generation for Three.js och spelmotor

### 7.3 Installationsplan
Installera dessa verktyg i Claude Code-projektet innan Fas 5 (Polish) paborjas. Builder-agenten kan da anvanda dem direkt for att generera sprites enligt denna art direction.
```

---

## 3. Duplicerade konstanter mellan scener

### Problem

`MAP_WIDTH`, `MAP_HEIGHT`, och `STRUCTURE_COLORS` definieras identiskt i bade NightScene.ts (rad 28-37) och DayScene.ts (rad 26-38). Andrar man i en fil men inte den andra far man inkonsekvenser.

### Atgard

1. Flytta `MAP_WIDTH` och `MAP_HEIGHT` till `src/config/constants.ts`:
```typescript
export const MAP_WIDTH = 40;  // tiles
export const MAP_HEIGHT = 30; // tiles
```

2. Flytta `STRUCTURE_COLORS` till `src/data/structures.json` -- lagg till ett `color`-falt pa varje struktur. Alternativt skapa en ny fil `src/data/visual-config.json`:
```json
{
  "structureColors": {
    "barricade": "0x8B7355",
    "wall": "0x666666",
    "trap": "0xCC4444",
    "pillbox": "0x4A6741",
    "storage": "0x7B6B3A",
    "shelter": "0x5A4A3A",
    "farm": "0x3A6B3A"
  }
}
```

3. Importera fran den nya platsen i bade NightScene.ts och DayScene.ts.

4. Ta bort de lokala definitionerna fran bada scenerna.

---

## 4. Hardkodade varden som ska externaliseras

### Problem

Projektregeln sager all speldata i JSON, men manga varden ar inbakade i koden.

### Atgard

Skapa `src/data/visual-config.json` (om den inte redan skapades i punkt 3) och flytta foljande:

```json
{
  "lighting": {
    "playerLightRadius": 120,
    "pillboxLightRadius": 60,
    "lightSteps": 8,
    "nightOverlayAlpha": 0.65
  },
  "structureColors": { ... },
  "damageFlash": {
    "color": "0xff0000",
    "duration": 100
  },
  "tutorial": {
    "text": "WASD to move | Enemies auto-targeted | Shift to sprint | Survive the night!",
    "duration": 6000
  }
}
```

Flytta zombie-specifika varden till `src/data/enemies.json` -- lagg till per fiendetyp:
```json
{
  "soundTargetDuration": 5000,
  "attackCooldown": 1000,
  "structureAttackCooldown": 1000
}
```

Och for spitter/screamer specifikt:
```json
{
  "id": "spitter",
  "spitterRange": 250,
  "spitterCooldown": 3000
}
```

Flytta projektil-varden till `src/data/weapons.json` eller en ny `src/data/projectile-config.json`:
```json
{
  "projectileSpeed": 400,
  "projectileLifespan": 2000
}
```

Uppdatera Projectile.ts, Zombie.ts, NightScene.ts och Player.ts att importera fran dessa JSON-filer istallet for att anvanda lokala konstanter.

---

## 5. NightScene prestanda-optimering

### Problem

`update()` i NightScene kor flera tunga operationer varje enda frame, aven nar det inte behovs.

### Atgard A: Ljus-cache

Ljusoverlaget behover bara ritas om nar spelaren ror sig mer an ett visst avstand:

```typescript
private lastLightX = 0;
private lastLightY = 0;

private updateLighting(): void {
  const dx = this.player.x - this.lastLightX;
  const dy = this.player.y - this.lastLightY;
  if (dx * dx + dy * dy < 16) return; // 4px threshold
  this.lastLightX = this.player.x;
  this.lastLightY = this.player.y;

  // befintlig ljus-rendering...
}
```

### Atgard B: Pillbox-skytte med spatial partitioning

Byt ut den nastade loopen (for varje pillbox, iterera alla zombies) mot Phasers inbyggda `physics.closest()`:

```typescript
private updatePillboxShooting(time: number): void {
  for (const pillbox of this.pillboxes) {
    if (time - pillbox.lastShot < pillbox.cooldown) continue;

    const nearest = this.physics.closest(pillbox, this.zombieGroup.getChildren()) as Zombie | null;
    if (!nearest) continue;

    const dist = Phaser.Math.Distance.Between(pillbox.x, pillbox.y, nearest.x, nearest.y);
    if (dist > pillbox.range) continue;

    // skjut pa nearest...
  }
}
```

### Atgard C: Pathfinding-throttle for alla zombies

Ge aven on-screen zombies en kort throttle (150ms):

```typescript
// I Zombie.ts update()
const now = Date.now();
const isOnScreen = this.scene.cameras.main.worldView.contains(this.x, this.y);
const interval = isOnScreen ? 150 : 500;

if (now - this.lastPathfind < interval) return;
this.lastPathfind = now;
```

### Atgard D: Zombie-struktur-kollisioner

Ersatt manuell AABB-check i `checkZombieStructureInteractions()` med Phasers `this.physics.overlap()`:

```typescript
this.physics.overlap(this.zombieGroup, this.wallGroup, (zombie, wall) => {
  // hantera kollision
});
```

---

## 6. Typ-sakerhet -- ta bort osaker casting

### Problem

Tre stallen anvander `as`-casts som kringgar TypeScript:

### Atgard

**DayScene.ts rad 91** -- `as unknown as StructureData[]`:
Fixa genom att typa JSON-importen korrekt:
```typescript
import structuresJson from '../data/structures.json';

interface StructuresFile {
  structures: StructureData[];
}

const typedStructures = structuresJson as StructuresFile;
const structureList = typedStructures.structures;
```

**NightScene.ts** -- `as ZombieConfig` vid boss spawn:
Lagg till validering:
```typescript
const spawnConfig = enemiesData.enemies.find(e => e.id === boss.spawnOnDeath);
if (!spawnConfig) {
  console.warn(`Missing enemy config for spawn-on-death: ${boss.spawnOnDeath}`);
  return;
}
// Nu ar spawnConfig korrekt typad via .find()
```

**NightScene.ts rad 448** -- `as Wall | undefined`:
Anvand en type guard:
```typescript
function isWall(obj: unknown): obj is Wall {
  return obj !== null && typeof obj === 'object' && 'hp' in (obj as Wall);
}
```

---

## 7. WeaponManager -- cachning av JSON-lookups

### Problem

`WeaponManager` anvander `.find()` pa arrayer varje gang vapendata behovs. Med manga vapen och uppgraderingar per frame blir detta onodigt.

### Atgard

Bygg en Map vid modul-laddning:

```typescript
import weaponsData from '../data/weapons.json';

const weaponMap = new Map<string, WeaponData>();
for (const w of weaponsData.weapons) {
  weaponMap.set(w.id, w as WeaponData);
}

export function getWeaponData(id: string): WeaponData | undefined {
  return weaponMap.get(id);
}
```

Ersatt alla `weaponsData.weapons.find(w => w.id === id)` med `getWeaponData(id)`.

---

## 8. DayScene -- undvik full menu-rebuild

### Problem

`refreshBuildMenu()` forstror och aterbygger hela build-menyn varje gang en resurs andras.

### Atgard

Istallet for att rebuilda, uppdatera bara visuella tillstandet (alpha/tint) pa befintliga meny-element:

```typescript
private refreshBuildMenuAffordability(): void {
  for (const entry of this.buildMenuEntries) {
    const canAfford = this.resourceManager.canAfford(entry.cost);
    entry.text.setAlpha(canAfford ? 1.0 : 0.4);
  }
}
```

Bygg bara om helt nar nya strukturtyper lases upp (vid basuppgradering).

---

## Checklista

- [x] 1. Shutdown-hantering i NightScene och DayScene
- [x] 2. Section 7 i art-direction.md
- [x] 3. Flytta duplicerade konstanter
- [x] 4. Externalisera hardkodade varden till JSON
- [x] 5. NightScene prestanda (ljus-cache, pillbox, pathfinding, kollisioner)
- [x] 6. Fixa typ-casts
- [x] 7. WeaponManager Map-cachning
- [x] 8. DayScene menu-rebuild optimering
- [x] 9. Uppdatera CHANGELOG.md med alla andringar
- [x] 10. Uppdatera version till 1.0.1
