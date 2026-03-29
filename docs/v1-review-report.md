# Dead Horizon v1.0.0 -- Kodgranskning och statusrapport

**Datum:** 2026-03-29
**Granskare:** Claude (pa uppdrag av Ola)
**Scope:** Full kodkvalitetsgranskning, handoff-verifiering, bygge, tester

---

## Sammanfattning

Dead Horizon v1.0.0 ar imponerande i omfang: 8 123 rader produktionskod, 3 700 rader tester, 15 managers/systems, 6 scener, 14 JSON-datafiler, 283 tester som alla passerar. Allt fran Fas 0 till Fas 6 ar implementerat i en enda session. TypeScript strict mode halls, inga `any`-typer hittades, ESLint passerar utan varningar, och typechecken ar ren.

Det finns dock ett antal problem som bor atagas innan nasta utvecklingsfas -- framfor allt minneslackor (event listeners som inte stadas), prestanda i NightScene, och hardkodade varden som bryter mot projektregeln om JSON-data.

---

## 1. Bygge och tester

| Kontroll | Resultat |
|----------|----------|
| TypeScript typecheck (`tsc --noEmit`) | PASS -- inga fel |
| ESLint (`eslint src/`) | PASS -- inga varningar |
| Vitest (283 tester, 12 filer) | PASS -- alla grona (1.11s) |
| Vite build | PASS -- 1 328 kB bundle (351 kB gzip) |

Bundlestorleken ar nagonting att halla ogat pa. Vite varnar for chunks over 500 kB. Overvagg code-splitting nar spelet vaxer.

---

## 2. Handoff-andringar -- verifiering

Fran planeringssessionen 2026-03-28 fanns fem andringar att applicera:

| Andring | Status |
|---------|--------|
| 1E.2 i projectplan.md: "Wave 1-5 ... krava flera runs" | APPLICERAD |
| game-design.md 8.2 Morale: "(post-MVP: ...)" | APPLICERAD |
| art-direction.md 3.2 Brute: "48x48 ... undantag" | APPLICERAD |
| technical-spec.md: PROJECTPLAN.md borttagen ur root tree | APPLICERAD |
| art-direction.md Section 7: Verktyg for asset-generering | **EJ APPLICERAD** |

**Atgard:** Section 7 (verktyg for asset-generering) maste laggas till i slutet av docs/art-direction.md. Texten finns i handoff-dokumentet.

Agent-setup.md finns och beskriver sub-agent-arbetsflode (Lead/Builder/Tester). Den planerade omskrivningen till agent teams ar annu inte genomford -- handoff-dokumentet markerade detta som "PENDING DECISION".

---

## 3. Kritiska problem (fix innan nasta fas)

### 3.1 Minneslackor -- event listeners stadas aldrig

**Bade NightScene och DayScene saknar shutdown-hantering.** Event listeners registreras i `create()` men tas aldrig bort vid scenovergang. Varje gang scenen startas om laggs nya lyssnare till ovanpa de gamla.

Drabbade filer:
- `NightScene.ts`: `zombie-killed`, `wave-started`, `wave-complete`, `all-waves-complete`, keyboard listeners (1-5), och fler
- `DayScene.ts`: `award-looting-xp`, `refugee-rescued`, `loot-run-complete`, `update`-event, `pointerdown`

**Losning:** Lagg till i bada scenerna:
```typescript
this.events.once('shutdown', () => {
  this.events.off('zombie-killed');
  this.events.off('wave-started');
  // ... alla registrerade events
});
```
Alternativt: anvand `this.events.once()` istallet for `this.events.on()` dar det passar.

### 3.2 NightScene -- prestanda

NightScene kor flera tunga operationer varje frame i `update()`:

1. **Ljusoverlaget ritas om helt varje frame** (radial gradient med 8 steg). Bor bara uppdateras nar spelaren ror sig en viss distans.
2. **Pillbox-skytte** itererar alla zombies for varje pillbox -- O(pillboxes * zombies) varje frame. Anvand spatial hashing eller Phaser physics overlap istallet.
3. **Zombie-struktur-kollisioner** kollar AABB manuellt i en nastad loop varje frame. Phaser har inbyggda overlap-metoder.
4. **Alla zombies pa skarmen raknar om pathfinding varje frame.** Off-screen throttlas till 500ms, men on-screen-zombies borde ocksa ha en kort throttle (100-200ms).

### 3.3 Hardkodade varden som ska ligga i JSON

Projektregeln sager: "All speldata i JSON-filer (src/data/), inte hardkodad i kod." Flera stallen bryter mot detta:

| Fil | Varde | Bor ligga i |
|-----|-------|-------------|
| NightScene.ts | `MAP_WIDTH=40`, `MAP_HEIGHT=30` | map-config.json eller constants.ts |
| NightScene.ts | `STRUCTURE_COLORS` (6 farger) | structures.json |
| NightScene.ts | `lightRadius=120`, pillbox light=60 | visual-config.json |
| DayScene.ts | Samma MAP_WIDTH/HEIGHT duplicerat | map-config.json |
| DayScene.ts | STRUCTURE_COLORS duplicerat | structures.json |
| Zombie.ts | `SOUND_TARGET_DURATION=5000`, `spitterRange=250`, `screamRadius=500`, etc | enemies.json |
| Projectile.ts | `PROJECTILE_SPEED=400`, `LIFESPAN=2000` | weapons.json eller projectile-config.json |
| Player.ts | Flash-farg `0xff0000`, bob-animation varden | player-config.json |
| WaveManager.ts | Victory threshold `>=5` | waves.json |

---

## 4. Medelprioriterade problem

### 4.1 Typ-sakerhet

Inga `any`-typer hittades -- bra! Men det finns `as`-casts som kringgar typsakerheten:
- `DayScene.ts:91`: `as unknown as StructureData[]` -- dubbel cast
- `NightScene.ts`: `as ZombieConfig` utan validering
- `NightScene.ts:448`: `as Wall | undefined` pa `getData()`

### 4.2 Tween-lackor

Tweens och `delayedCall` i NightScene, Player.ts och Zombie.ts kan fortsatta kora efter att scenen forstorts. Lagg till `this.active`-check i callbacks, eller anvand `this.tweens.killAll()` vid shutdown.

### 4.3 DayScene -- full UI-rebuild vid varje andring

`refreshBuildMenu()` forstror och aterskapar hela menyn varje gang nagot andras (resurser, AP). Overvagg att bara uppdatera tillganglighet/farg pa befintliga element.

### 4.4 Duplicerad kod

`MAP_WIDTH`, `MAP_HEIGHT`, och `STRUCTURE_COLORS` ar definierade identiskt i bade NightScene.ts och DayScene.ts. Flytta till en delad modul.

---

## 5. Positiva observationer

- **Typmodellen ar solid.** `config/types.ts` ar valsrukturerad med 158 rader av tydliga typer for hela spelet.
- **constants.ts ar valorganiserad** med namngivna konstanter for refugee-systemet, fog of war, loot runs.
- **Alla managers (15 st) foljer konsekvent monster** med event-baserad kommunikation via Phaser.
- **Object pooling anvands for zombies och projektiler** -- bra for prestanda.
- **283 tester tackar alla managers/systems.** Testtackningen ar bra for ett v1-projekt.
- **Alla JSON-datafiler finns och anvands.** De flesta speldata ligger ratt -- det ar framst visuella/animations-varden som laggs in direkt.
- **ESLint och typecheck ar helt rena.**
- **LESSONS.md ar valunderhallen** med 6 dokumenterade problem och losningar.
- **Ingen EM dash hittades nagonstan.**

---

## 6. Rekommenderad prioritetsordning

### Gor innan nasta utvecklingsfas:
1. **Fixa minneslackorna** -- lagg till shutdown-hantering i NightScene och DayScene
2. **Applicera saknad handoff-andring** -- Section 7 i art-direction.md
3. **Flytta duplicerade konstanter** (MAP_WIDTH, STRUCTURE_COLORS) till delad modul

### Gor under nasta sprint:
4. **Optimera NightScene.update()** -- ljus-cache, spatial hashing, pathfinding-throttle
5. **Externalisera hardkodade varden** till JSON-filer (se tabell i 3.3)
6. **Losa tween-lackor** -- shutdown-cleanup for aktiva tweens

### Framtida forbattringar:
7. **Code-splitting** for att minska bundlestorleken (1.3 MB)
8. **Sakna agent-team-omskrivning** av docs/agent-setup.md (pending decision)
9. **Ljud-assets** (Fas 5E) -- enda ofardiga uppgiften i projektplanen
10. **Cachning av JSON-lookups** i WeaponManager (`.find()` pa arrayer borde anvanda Map)

---

## 7. Projektstatistik

| Matetal | Varde |
|---------|-------|
| Produktionskod | 8 123 rader (38 filer) |
| Testkod | 3 700 rader (12 filer) |
| Tester | 283 (alla passerar) |
| JSON-datafiler | 14 |
| Managers/Systems | 15 |
| Scener | 6 |
| Bundlestorlek | 1 328 kB (351 kB gzip) |
| Version | 1.0.0 |
