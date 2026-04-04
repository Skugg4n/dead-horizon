# Dead Horizon -- Known Bugs & Issues

Denna fil trackar alla kända buggar och uppgifter. Stryks INTE förrän verifierade som fixade.
Uppdaterad: 2026-04-04, v2.4.4

---

## FIXADE OCH VERIFIERADE

- KB1: Projectile crash på wave 3 -- instanceof-check (v2.0.4) ✅
- VB1: Dag/natt olika terräng -- setBounds före generateTerrain (v2.0.5) ✅
- VB2: ">" pil otydlig -- bytt till [EQUIPPED] (v2.0.3) ✅
- VB3: BASE-text trunkerad -- 9px + stroke (v2.0.6) ✅
- GB1: Tangenter under tutorial -- tutorialShowing-check (v1.9.1) ✅
- UB1: ESC/Enter/Space resultatskärm (v2.0.0) ✅
- UB2: Game Over keyboard (v2.0.3) ✅
- Strength alltid 0 -- equipped vapen skickas nu (v2.1.2) ✅
- Resultat/death försvann för fort -- 3s delay (v2.0.8) ✅
- Raven 0HP visas som companion -- hp>0 filter (v2.0.8) ✅
- Storm raderar alla strukturer -- max 2 skadas nu (v2.4.0) ✅
- Nya fällor saknades i build-menyn -- base-levels.json uppdaterad (v2.3.1) ✅

---

## BUGGAR (ej fixade)

### BG1: Nattstart-krasch vid strukturer
- `Cannot read 'sys'` i TrapBase constructor
- Guard tillagd (v2.4.0) men root cause ej löst
- try/catch runt createStructures fångar felet istället för krasch
- Status: DELVIS FIXAD (kraschar inte men fällan skapas inte)

### BG2: Continue fungerar inte efter krasch
- SaveManager.load() har try/catch men kan fortfarande hänga
- Status: VÄNTAR PÅ VERIFIERING

### BG3: Gråade items förklaras inte varför
- Build-menyn har "Not enough X" text nu (v2.4.0) men behöver verifieras live
- Status: VÄNTAR PÅ VERIFIERING

---

## UI/MENYER (pågående)

### UM1: Build-menyn text/font
- "Press Start 2P" i 800x600 canvas skalas upp och blir luddig
- Försökt: monospace, resolution:2 -- blev sämre
- Nu: "Press Start 2P" minst 9px (v2.4.4)
- Kvarstår: behöver kanske högre canvas-upplösning eller bitmap font
- Status: PÅGÅENDE

### UM2: Equipment-panel för liten
- Trång med många vapen, ingen scrollning
- Status: EJ FIXAD

### UM3: Alla paneler behöver samma font/storlek-standard
- Olika paneler har olika fontstorlekar och stilar
- Status: EJ FIXAD

---

## VISUELLA

### VB4: Karaktärsporträtt ser dåligt ut
- 32x32 pixligt utan kontext
- Behöver bättre/större porträtt eller siluett
- Status: EJ FIXAD

### VB5: Spelsprite idle skiljer sig från walk
- Ser ut som olika karaktärer
- Status: EJ FIXAD

---

## GAMEPLAY (designat, ej implementerat)

### GP1: Zon-progression
- Forest→City→Military→Endless
- docs/zone-progression.md
- Status: DESIGN KLAR

### GP2: Pack Your Bag (mellan-zon-val)
- Välj vapen (max 4) och resurser (max 50) att ta med
- docs/zone-progression.md
- Status: DESIGN KLAR

### GP3: Blueprint-system
- Böcker som låser upp nya fällor
- docs/trap-mechanics.md
- Status: DESIGN KLAR

### GP4: Fäll-leveling
- Uppgradera fällor med parts (Lv 1→3)
- docs/trap-mechanics.md
- Status: DESIGN KLAR

### GP5: ~44 fällor kvar att implementera
- docs/trap-catalog.md har 50 fällor, 6 implementerade
- Status: DESIGN KLAR

### GP6: Refugees förenkling till passiv "Camp Crew"
- Passiva bonusar istället för jobb-system
- docs/defense-redesign.md
- Status: DESIGN KLAR

### GP7: Kill corridors / pathing
- Gropar, kanaler, tvinga zombies genom fällor
- docs/defense-redesign.md
- Status: DESIGN KLAR

---

## UX/POLISH

### UX1: Ammo-mekanik förvirrande
- Auto-load finns men kommuniceras dåligt
- docs/inventory-redesign.md
- Status: DELVIS FIXAD

### UX2: Meds-syfte otydligt
- Behöver visas i refugee-panel
- Status: EJ FIXAD

### UX3: Resurs-tooltips
- Hovra = förklaring av vad resursen gör
- docs/inventory-redesign.md
- Status: EJ FIXAD
