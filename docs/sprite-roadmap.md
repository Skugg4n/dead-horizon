# Dead Horizon -- Sprite Roadmap

**Version:** 1.0.0
**Datum:** 2026-03-29
**Status:** Redo for Artist-agenten

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
| Player attack | 32x32 | 3 | player_attack.png | |
| Player death | 32x32 | 4 | player_death.png | |
| Walker (statisk) | 32x32 | 1 | walker.png | KLAR |
| Walker walk | 32x32 | 4 | walker_walk.png | KLAR |
| Walker attack | 32x32 | 3 | walker_attack.png | |
| Walker death | 32x32 | 4 | walker_death.png | |
| Runner (statisk) | 32x32 | 1 | runner.png | KLAR |
| Runner walk | 32x32 | 4 | runner_walk.png | |
| Runner death | 32x32 | 4 | runner_death.png | |
| Brute (statisk) | 48x48 | 1 | brute.png | KLAR |
| Brute walk | 48x48 | 4 | brute_walk.png | |
| Brute death | 48x48 | 4 | brute_death.png | |
| Spitter (statisk) | 32x32 | 1 | spitter.png | |
| Spitter attack | 32x32 | 3 | spitter_attack.png | |
| Screamer (statisk) | 32x32 | 1 | screamer.png | |
| Screamer scream | 32x32 | 3 | screamer_scream.png | |

### Prio 2: Strukturer

| Asset | Storlek | Fil | Beskrivning |
|-------|---------|-----|-------------|
| Barricade | 32x32 | struct_barricade.png | Hopsatta plankor, rostigt plat |
| Wall | 32x32 | struct_wall.png | Solid sten/betong, tegelmonstrer |
| Trap | 32x32 | struct_trap.png | Taggtrad/spikmatta, nastan osynlig |
| Pillbox | 32x32 | struct_pillbox.png | Forstarkt position med oppning |
| Storage | 32x32 | struct_storage.png | Tralada/container |
| Shelter | 32x32 | struct_shelter.png | Talt-form |
| Farm | 64x64 | struct_farm.png | Odling med grona plantor |
| Base Tent | 32x32 | base_tent.png | Start-bas |
| Base Camp | 64x64 | base_camp.png | Niva 2 |
| Base Outpost | 64x64 | base_outpost.png | Niva 3 |
| Base Settlement | 96x96 | base_settlement.png | Niva 4 |

### Prio 3: Terrain tiles

| Asset | Storlek | Fil | Varianter |
|-------|---------|-----|-----------|
| Grass | 32x32 | terrain_grass_1-3.png | 3 varianter for variation |
| Dirt | 32x32 | terrain_dirt.png | 1 |
| Road | 32x32 | terrain_road.png | Sprucken asfalt |
| Road overgrown | 32x32 | terrain_road_overgrown.png | Gras genom sprickor |
| Concrete | 32x32 | terrain_concrete.png | Golv/ruiner |

### Prio 4: UI och effekter

| Asset | Storlek | Fil | Beskrivning |
|-------|---------|-----|-------------|
| Bullet | 8x8 | bullet.png | Projektil |
| Spitter projectile | 8x8 | spitter_projectile.png | Gron spottprojectil |
| Loot drop | 16x16 | loot_drop.png | Resurs-ikon pa marken |
| Resource icons | 16x16 | icon_scrap/food/ammo/parts/meds.png | UI-ikoner |

### Prio 5: Refugees

| Asset | Storlek | Fil | Beskrivning |
|-------|---------|-----|-------------|
| Refugee base | 32x32 | refugee_1-5.png | 5 varianter (olika klader/har) |
| Refugee injured | 32x32 | refugee_injured.png | Bandage-overlay |

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
