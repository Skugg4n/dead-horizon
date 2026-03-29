# Dead Horizon -- Sprite Roadmap

**Version:** 1.1.0
**Datum:** 2026-03-28
**Status:** KLAR -- alla sprites skapade och integrerade

---

## Oversikt

Alla sprites skapas med Python/Pillow som 32x32 pixel art (RGBA PNG med transparens).
Fargpaletten fran docs/art-direction.md ar lag -- avvik aldrig.
Befintliga prototyper finns i assets/sprites/ (player, walker, runner, brute + walk-animationer).

---

## Prioritetsordning

### Prio 1: Karaktarer (ersatter spriteFactory.ts)

| Asset | Storlek | Frames | Fil | Status |
|-------|---------|--------|-----|--------|
| Player (statisk) | 32x32 | 1 | player.png | KLAR |
| Player walk | 32x32 | 4 | player_walk.png | KLAR |
| Player attack | 32x32 | 3 | player_attack.png | KLAR |
| Player death | 32x32 | 4 | player_death.png | KLAR |
| Walker (statisk) | 32x32 | 1 | walker.png | KLAR |
| Walker walk | 32x32 | 4 | walker_walk.png | KLAR |
| Walker attack | 32x32 | 3 | walker_attack.png | KLAR |
| Walker death | 32x32 | 4 | walker_death.png | KLAR |
| Runner (statisk) | 32x32 | 1 | runner.png | KLAR |
| Runner walk | 32x32 | 4 | runner_walk.png | KLAR |
| Runner death | 32x32 | 4 | runner_death.png | KLAR |
| Brute (statisk) | 48x48 | 1 | brute.png | KLAR |
| Brute walk | 48x48 | 4 | brute_walk.png | KLAR |
| Brute death | 48x48 | 4 | brute_death.png | KLAR |
| Spitter (statisk) | 32x32 | 1 | spitter.png | KLAR |
| Spitter attack | 32x32 | 3 | spitter_attack.png | KLAR |
| Screamer (statisk) | 32x32 | 1 | screamer.png | KLAR |
| Screamer scream | 32x32 | 3 | screamer_scream.png | KLAR |

### Prio 2: Strukturer

| Asset | Storlek | Fil | Status |
|-------|---------|-----|--------|
| Barricade | 32x32 | struct_barricade.png | KLAR |
| Wall | 32x32 | struct_wall.png | KLAR |
| Trap | 32x32 | struct_trap.png | KLAR |
| Pillbox | 32x32 | struct_pillbox.png | KLAR |
| Storage | 32x32 | struct_storage.png | KLAR |
| Shelter | 32x32 | struct_shelter.png | KLAR |
| Farm | 64x64 | struct_farm.png | KLAR |
| Base Tent | 32x32 | base_tent.png | KLAR |
| Base Camp | 64x64 | base_camp.png | KLAR |
| Base Outpost | 64x64 | base_outpost.png | KLAR |
| Base Settlement | 96x96 | base_settlement.png | KLAR |

### Prio 3: Terrain tiles

| Asset | Storlek | Fil | Status |
|-------|---------|-----|--------|
| Grass | 32x32 | terrain_grass_1-3.png | KLAR |
| Dirt | 32x32 | terrain_dirt.png | KLAR |
| Road | 32x32 | terrain_road.png | KLAR |
| Road overgrown | 32x32 | terrain_road_overgrown.png | KLAR |
| Concrete | 32x32 | terrain_concrete.png | KLAR |

### Prio 4: UI och effekter

| Asset | Storlek | Fil | Status |
|-------|---------|-----|--------|
| Bullet | 8x8 | bullet.png | KLAR |
| Spitter projectile | 8x8 | spitter_projectile.png | KLAR |
| Loot drop | 16x16 | loot_drop.png | KLAR |
| Resource icons | 16x16 | icon_scrap/food/ammo/parts/meds.png | KLAR |

### Prio 5: Refugees

| Asset | Storlek | Fil | Status |
|-------|---------|-----|--------|
| Refugee base | 32x32 | refugee_1-5.png | KLAR |
| Refugee injured | 32x32 | refugee_injured.png | KLAR |

---

## Tekniska krav

### Sprite sheets
- Horisontell layout: varje frame sida vid sida
- Alla frames samma storlek
- Transparent bakgrund
- Filnamn: `{entity}_{animation}.png`

### Previews
- Varje asset far en `_preview.png` uppskalad 8x med nearest-neighbor
- Syftar till mansklig granskning, anvands inte i spelet

### Fargkonsistens
- Player: gron jacka (#3E5A34 kropp, #B22222 bandana, #5C4033 ryggsack)
- Walker: murk (#6E6450 hud, #464137 klader, #64140F blod)
- Runner: gulaktig (#786E41 hud, #373228 trasor)
- Brute: mork (#504B41 hud, #554C48 rustning, #B42820 ogon)
- Strukturer: fran art-direction.md section 2.1

---

## Integration

Nar nya assets skapas, uppdatera:

1. **BootScene.ts** -- lagg till `this.load.image()` eller `this.load.spritesheet()`
2. **spriteFactory.ts** -- ersatt programmatisk textur med laddad asset (behall fallback)
3. **Relevanta scener** -- anvand `this.add.sprite()` istallet for `this.add.graphics()`

Mal for gradvis migration i spriteFactory.ts:
```typescript
export function generatePlayerTexture(scene: Phaser.Scene): void {
  // Anvand laddad asset om den finns, annars programmatisk fallback
  if (scene.textures.exists('player')) return;
  // ... befintlig programmatisk kod som fallback
}
```
