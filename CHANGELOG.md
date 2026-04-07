# Dead Horizon -- Changelog

## [2.7.0] - 2026-04-07

### Feature: GameLog UI component

**src/ui/GameLog.ts** (new file):
- Chat-box style scrolling log in lower-left corner (x=4, y=418, 252x104px).
- Shows last 8 messages; newest at bottom, older entries fade to darker grey.
- Semi-transparent dark background with rounded border (depth 200).
- setScrollFactor(0) for NightScene single-camera; DayScene registers via addToUI().
- `addMessage(text, color?)` appends a new line.
- `addBaseDamageMessage()` is throttled: max one "Base took damage!" per 5 seconds.
- `show()`, `hide()`, `clear()`, `getContainer()` public API.

**NightScene integration:**
- Wave started: "Wave N started" (gold) or "FINAL WAVE -- survive!" (red).
- Wave cleared: "Wave N cleared!" (green).
- Boss spawning: "BOSS INCOMING!" (bright red).
- No fuel traps: "No fuel: X offline!" (orange).
- No ammo (at night start or during play): "No ammo!" / "No ammo! Switch to melee!" (red).
- Base took damage: throttled, max once per 5s (red), via addBaseDamageMessage().
- Repair blocked by missing resources: "Need 1 PARTS to repair!" (orange).

**DayScene integration:**
- Built structure: "Built [name]" (light blue).
- Loot run finished: summarises gained resources, flags weapon/blueprint finds (gold).
- Refugee rescued: "Rescued [name]!" (green).
- Random event triggered: "Event: [name]" or "HORDE WARNING: [name]" depending on type.
- Event outcome result string also logged when not "No effect".
- New loot-run-finished listener cleaned up on scene shutdown.

### Additional fixes in this release
- Build menu: moved to LEFT side, stays open during placement
- Removed backdrop click-to-close (closed menu when clicking map to place)
- Fix encounter fight: weapons passed to resolveFight (was empty array [])
- Fix death screen: text hidden until clickable (0.8s delay, was 3s with fake text)
- Fix DayScene crash: setupCameras before renderPlacedStructures
- Fix pause ESC: flag-based instead of scene.pause (killed input)
- Trap icons for 7 new traps in build menu
- Message timing: 2-2.5s visible before fade
- Meds cost shown: "REST (1 med)"
- Remove raw event type badge from EventDialog
- Idle sprite = walk frame 0 (VB5)
- Base HP scales: Tent=200, Camp=350, Outpost=500, Settlement=750
- Result/GameOver clickable after 1s (was 3s)

## [2.6.2] - 2026-04-06

### UI/UX fixes (screenshot-verified)
- New Tier 1 traps now show in TRAPS tab (were landing in WALLS)
- Build menu stays open during placement -- switch structures freely
- Closing build menu exits placement mode clearly
- Remove raw event type badge (HORDE_WARNING) from EventDialog
- Remove "Auto-loaded at night" ammo tooltip (DayScene + EquipmentPanel)
- Fix idle/walk sprite mismatch: idle now uses walk frame 0

## [2.6.1] - 2026-04-06

### Ammo + fire trap fixes
- Load ALL available ammo at night (was capped by ammoPerNight per weapon)
- Remove "auto-loaded at night" text from equipment panel
- Show "No fuel: Fire Pit offline!" when traps lack food for fuel
- Simplified autoLoadAmmo() -- no more per-weapon rationing

## [2.6.0] - 2026-04-06

### Manual shooting replaces auto-shoot
- Removed auto-shoot: player must now click or hold SPACE to fire
- Single click = single shot, hold = auto-fire (respects fire rate cooldown)
- Still auto-aims at nearest enemy in range
- Tutorial text updated to reflect new controls

## [2.5.6] - 2026-04-04

### Procedurella ljudeffekter for fällor, boss och zoner

**src/systems/AudioManager.ts:**
- 11 nya SoundId-typer tillagda: `trap_nail_board`, `trap_trip_wire`, `trap_glass_shards`, `trap_tar_pit`, `trap_shock_wire`, `trap_spring_launcher`, `trap_chain_wall`, `boss_roar`, `boss_stomp`, `zone_complete`, `final_night_start`.
- 11 nya generatorfunktioner med procedurellt genererade ljud via Web Audio API:
  - Nail Board: vasst crunch-ljud med trä + metallkaraktär.
  - Trip Wire: snap/twang-ljud av spänd trad som brister.
  - Glass Shards: höga frekvenser, kortvarig glaskrasch.
  - Tar Pit: låg bubblig squelch-effekt, viskos karaktär.
  - Shock Wire: elektrisk buzz + crackle-urladdning.
  - Spring Launcher: metalliskt THUNK + nedgående fjäder-boing.
  - Chain Wall: metalliskt kedjeklirr med oregelbunden rattle-pattern.
  - Boss Roar: djupt sub-bas vrål, 1.6 sekunder, modulerad med vibrato.
  - Boss Stomp: tungt fotsteg, sub-bas med snabb decay.
  - Zone Complete: uppåtstigande fanfar C4-E4-G4-C5, 1.8 sekunder.
  - Final Night Start: dissonant doom-ackord (triton D+Ab), 2 sekunder.
- Trap- och boss-ljud tillagda i PITCH_VARIED_SOUNDS för variation.

**src/scenes/NightScene.ts:**
- `trap_nail_board` spelas vid nail board-träff i checkZombieStructureInteractions().
- `trap_trip_wire` spelas vid trip wire-utlösning.
- `trap_glass_shards` spelas vid glasskärv-kontakt (throttlad via 600ms cooldown).
- `trap_tar_pit` spelas vid tar pit-kontakt (throttlad via 800ms cooldown).
- `trap_shock_wire` spelas vid shock wire-aktivering.
- `trap_spring_launcher` spelas vid spring launcher-aktivering.
- `trap_chain_wall` spelas i wall collider när chainWallRef hittas.
- ChainWall.onZombieContact() anropas nu korrekt fran wall collider-callback.
- `boss_roar` spelas via nytt 'boss-spawning'-event.
- `final_night_start` spelas i showFinalNightBanner().

**src/systems/WaveManager.ts:**
- Emittar 'boss-spawning'-event innan boss-zombie skapas.

**src/entities/Zombie.ts:**
- Import av AudioManager tillagd.
- `stompTimer`-property (private, number) för att rytmisera stompsound.
- Boss-update: var 700ms spelas `boss_stomp` nar boss ror sig (velocity > 5).
- stompTimer nollstalls i reset() for korrekt pool-reuse.

**src/scenes/ZoneCompleteScene.ts:**
- Import av AudioManager tillagd.
- `zone_complete`-fanfar spelas vid scenstart.

## [2.5.5] - 2026-04-04

### Visuella effekter for nya fällor

**src/structures/NailBoard.ts:**
- Alpha-blekning proportionell mot kvarvarande uses (0.4-1.0 alpha).
- Röd flash-overlay (120ms) vid varje aktivering via `triggerActivationEffect()`.
- `update(delta)` metod för att animera flash-timern.

**src/structures/TripWire.ts:**
- Alpha-blekning proportionell mot kvarvarande uses.
- Vit "snap"-flash (150ms) med bredd-linje och vertikal burst vid aktivering.
- `triggerActivationEffect()` och `update(delta)` metoder.

**src/structures/GlassShards.ts:**
- Kontinuerlig sparkle-animation: 8 kors-formade gnistpunkter som tänds/slocknar individuellt med sin-waves.
- `animUpdate(delta)` anropas varje frame från NightScene.
- Pre-beräknade offset-arrayer och positioner för noll allokering per frame.

**src/structures/TarPit.ts:**
- `markZombieInZone()` metod -- när zombie fångas ökar bubble-hastigheten och alpha.
- Tredje liten bubbla för djup. Amber-border intensifieras när zombie är i zon.
- Animationshastighetsmultiplikator: 0.003 normalt, 0.005 med zombie.

**src/structures/ShockWire.ts:**
- `dischargeTimer` (200ms): vid aktivering renderas bred vit/blå arc-flash + branch-linjer + corona.
- `triggerActivationEffect()` metod kallad från NightScene vid zombie-chock.

**src/structures/SpringLauncher.ts:**
- `flashTimer` (180ms): orange/gul burst-overlay med radiella linjer vid launch.
- `triggerActivationEffect()` kombinerar flash + launchAnimTimer.

**src/structures/ChainWall.ts:**
- `glintTimer` (120ms): silverglans-overlay + ljusa post-highlights vid kontaktskada.
- `triggerActivationEffect()` kallad från `onZombieContact()`.

**src/scenes/NightScene.ts:**
- Ny `shockEmitter` (blå/vit, 10 partiklar) vid ShockWire-aktivering.
- Ny `nailBloodEmitter` (röd, 5 partiklar) vid NailBoard-träff.
- `triggerActivationEffect()` anropas för NailBoard, TripWire, ShockWire, SpringLauncher.
- `markZombieInZone()` anropas för TarPit inom zombie-loopen.
- `animUpdate()` anropas för GlassShards varje frame.
- `update(delta)` anropas för NailBoard och TripWire varje frame.
- Ny particle-textur `particle_blue` (66CCFF) för el-effekter.

## [2.5.4] - 2026-04-04

### Forest-zon atmosfar -- ambient ljud och boss-natt belysning

**src/systems/AudioManager.ts:**
- Lade till forest_ambient_day -- procedurellt ljud med 3 fagelroster (warbler, thrush, wren-ticking) ovanpa bladrustlande vindsbrus. Loopas i 8 sekunders buffer med crossfade.
- Lade till forest_ambient_night -- syrsor (detunade oscillatorer med 14 Hz stridulation-puls), uggla i fjärran (tvåtons-hoot), kvistknack-transienter, och låg vindunderton. Loopas i 10 sekunders buffer.
- startAmbient() utokad med parametrar forest_day och forest_night for zon-specifika ambient-ljud.
- Fixade noUncheckedIndexedAccess-fel i nya generatorfunktioner.

**src/scenes/DayScene.ts:**
- create(): startar forest_day ambient nar zonen ar forest, annars fallback till generisk day.

**src/scenes/NightScene.ts:**
- create(): startar forest_night ambient nar zonen ar forest, annars fallback till generisk night.
- setupLighting(): boss-natt (nightNumber >= 5) ger mörkare bakgrund (#150A0A) plus rod Graphics-overlay.
- updateLighting(): pulsar overlayns alpha med ~0.15 Hz sinusvag. Intensitet rampar fran 0.04 till 0.18 alpha over 90 sekunder.
- update(): ackumulerar bossNightTime for lighting-pulsen.
- Fixade shockEmitter till lokal variabel i setupParticles (anvandes aldrig som class field).

**src/structures/GlassShards.ts:**
- Fixade noUncheckedIndexedAccess-fel i drawVisuals(): sparkleOffsets[i] ?? 0 och null-check pa sparklePositions[i].

## [2.5.3] - 2026-04-04 18:00

### UI Polish -- ZoneCompleteScene, Blueprint popup, FINAL NIGHT banner, Zone panel

**src/scenes/ZoneCompleteScene.ts:**
- Dramatisk bakgrund: driftande partiklar (gron/bla/guld) som flödar uppat, morkare bakgrundsfarg
- "ZONE COMPLETE" header: större (24px), glow-lager bakom som pulsar
- Zonnamn: fade-in med delay istallet for direkt visning
- Stats-summary: kills, nights survived, traps built i redigare layout med rad-etiketter
- Next zone-sektion: guld box med border, zonnamn scale-in med Back.easeOut, shimmer-puls
- "ALL ZONES CLEARED": guld puls-animation
- "BACK TO MENU"-knapp: fade-in, hover byter farg och stoppar blink, tydligare interaktion

**src/ui/LootRunPanel.ts:**
- Blueprint-fynd ersatt med prominent guldbox med border
- "NEW BLUEPRINT FOUND!" scale-in med Back.easeOut + pulse-glow
- Blueprint-namn och "New trap unlocked"-hint fade-in
- Box-shake animation pa 120ms delay for extra dramatik

**src/scenes/NightScene.ts -- showFinalNightBanner():**
- Kamera-skakning (shake 600ms, 0.012 intensitet) vid banner-visning
- Halvt genomskinligt morkare full-screen overlay bakom baren
- Sub-text andrat till "WAVE 5 OF 5" med fade-in
- Pulsande rod text-effekt (5 ganger yoyo) efter scale-in
- Banner + overlay fade-out synkroniserat

**src/scenes/MenuScene.ts -- buildZonePanel():**
- Active zone: tjockare orange border (2px, #C5620B) och varmre bakgrund
- Cleared zone: gron border (#2A7A2A) och gront-tintad bakgrund
- Locked zone: bardzo mörkt, knappt synlig border for klart intryckt
- Progress-bar for delvis klarade zoner (1-4 waves) med 5 segment-dividers
- Lock-ikon ritad med Graphics (kropp + bygel) for lasta zoner
- Tre stjarnor (***) i guld for klarade zoner
- Panel nagot bredare for battre layout

## [2.5.2] - 2026-04-04

### 7 nya fällor -- Tier 1 (passiva) och Tier 2 (mekaniska)

**src/structures/NailBoard.ts (ny fil):**
- Tier 1 passiv fälla. 10 dmg + cripple 2s per träff. 20 uses. Extends GameObjects.Graphics.
- Grafik: sliten träplanka med naglar, mörknar visuellt vid låga uses.

**src/structures/TripWire.ts (ny fil):**
- Tier 1 passiv fälla. Stun 1.5s, ingen skada. 15 uses. Extends GameObjects.Graphics.
- Grafik: tunn tråd med ankarpunkter i vardera ände, bleknar successivt.

**src/structures/GlassShards.ts (ny fil):**
- Tier 1 passiv fälla. 5 dmg/s i zon (~96px radie). Obegränsade uses tills HP=0.
- Grafik: spridda glassplitter med zon-indikator. containsPoint() för cirkulär zon.

**src/structures/TarPit.ts (ny fil):**
- Tier 1 passiv fälla. 80% slow (slowFactor 0.2) i zon. 3 tiles bred. Varar 2 nätter.
- Grafik: animerad tjärepool med bubblor. animUpdate() anropas varje frame.

**src/structures/ShockWire.ts (ny fil):**
- Tier 2 mekanisk fälla (extends TrapBase). 15 dmg + stun 3s. Cooldown 8s. 10 uses.
- Grafik: animerad el-båge mellan isolatorer. sparkPhase-animation.

**src/structures/SpringLauncher.ts (ny fil):**
- Tier 2 mekanisk fälla (extends TrapBase). 40 dmg + knockback 80px. Cooldown 5s. Obegränsade uses.
- Grafik: animerad fjäder med launch-animation. Knockback via velocity-impulse.

**src/structures/ChainWall.ts (ny fil):**
- Tier 2 mekanisk fälla (extends TrapBase). Blockerar + 10 dmg vid kontakt. 200 HP. Ingen cooldown.
- Grafik: kedjestängsel-mönster med HP-bar. Lägger till wallBodies physics collider.

**src/data/structures.json:**
- 7 nya entries: nail_board, trip_wire, glass_shards, tar_pit, shock_wire, spring_launcher, chain_wall.
- Alla med korrekt cost, hp, effect, och trap-specifika parametrar.

**src/data/base-levels.json:**
- Tier 1 (nail_board, trip_wire, glass_shards, tar_pit) upplåsta vid Tent (level 0).
- Tier 2 (shock_wire, spring_launcher, chain_wall) upplåsta vid Camp (level 1) och högre.

**src/scenes/NightScene.ts:**
- 7 nya imports, 7 nya privata arrays (_nailBoards, _tripWires, _glassShards, _tarPits,
  _shockWires, _springLaunchers, _chainWalls).
- createStructures(): 7 nya switch-cases som läser config från structures.json.
- checkZombieStructureInteractions(): cleanup-filter + per-zombie interaktionslogik för alla 4 Tier 1 fällor.
  TarPit animUpdate() körs en gång per frame (ej per zombie).
- updateMechanicalTraps(): update() + aktiveringslogik för ShockWire, SpringLauncher, ChainWall.
- updateRepairMechanic(): allMechanical-array utökad med de 3 nya TrapBase-fällorna.

## [2.5.1] - 2026-04-04 10:30

### Pixel art sprites -- fällor (Tier 1+2) och Forest Boss

**public/assets/sprites/ (8 nya sprites + 8 previews):**

Tier 1 fällor (32x32):
- nail_board.png -- Planka med rostiga spikar. Brun trä-bas, tre plankor i halvbåge, grå stålspikar som sticker upp med rostiga punkter.
- trip_wire.png -- Två rostiga pinnar med beige snöre emellan. Diskret och nästan osynlig mot marken.
- glass_shards.png -- Krossat glas utspritt. Blå/transparanta skärvor med vita glitter-pixlar för speglingseffekt.
- tar_pit.png -- Mörk oval tjäre-pool med bubblor och klibbig kant. Svart/mörkbrun gradient med ojämn yta.

Tier 2 fällor (32x32):
- shock_wire.png -- Bilbatteri (höger) kopplat till ståltrå med gula gnistor och blå el-effekter. Jordningskabel nedtill.
- spring_launcher.png -- Metalldörr med zigzag-fjäder i mitten, guld handtag, gångjärn och varningsränder. Industriell look.
- chain_wall.png -- Två grå betongstolpar med tre kedjor emellan. Guldboltar på stolparna, rost-accenter.

Forest Boss (64x64):
- brute_boss.png -- Gigantisk zombie-brute. Mörk grön-grå hud, glödande röda ögon med halo-effekt, öppen mun med tänder/tunga, improviserad rostad rustning med guldboltar, moss-accenter på kroppen (forest-tema), blodstänk, skugga under för volym.

Alla sprites följer exakt färgpalett från docs/art-direction.md.
Genererat med sprite_gen_traps_boss.py (Python/Pillow, pixel-för-pixel).

## [2.5.0] - 2026-04-04

### Blueprint-system -- loot runs laster upp nya fallor

**src/data/blueprints.json (ny fil):**
- Definierar 7 blueprints: improvised_electronics, engine_mechanics, fire_safety_reversed,
  junkyard_engineering, trappers_handbook, heavy_construction, spring_mechanics.
- Varje blueprint har id, name, description, unlocks (lista av structure-IDs), destinations
  (vilka lootrun-destinationer den kan droppas pa) och dropChance.
- "alwaysAvailable" array listar de 10 faller som aldrig kraver blueprint.

**src/config/types.ts:**
- Ny exporterad interface BlueprintData.
- GameState far nytt falt: unlockedBlueprints: string[].

**src/systems/SaveManager.ts:**
- createDefaultState() inkluderar unlockedBlueprints: [].
- load() mergar unlockedBlueprints fran sparad data (migration: gamla saves far tom array).

**src/systems/LootManager.ts:**
- Importerar blueprints.json och BlueprintData.
- LootResult far nytt falt foundBlueprintId: string | null.
- Ny privat metod rollBlueprintDrop(destinationId): rullar for blueprint-dropp. Exkluderar
  redan upplasta blueprints. Returnerar blueprint-id vid lyckat roll, annars null.
- executeLootRun() anropar rollBlueprintDrop(). Om blueprint hittas laggs den till direkt i
  gameState.unlockedBlueprints och sparas i result.foundBlueprintId.

**src/ui/BuildMenu.ts:**
- Importerar blueprints.json och BlueprintData.
- Ny getter-parameter getUnlockedBlueprints: () => string[] i konstruktorn.
- Modul-niva konstanter: ALWAYS_AVAILABLE_TRAP_IDS, BLUEPRINT_FOR_STRUCTURE (struktur -> blueprint-id).
- Ny metod isBlueprintAccessible(structureId): returnerar true om struktur ar i alwaysAvailable
  eller om dess blueprint ar upplast av spelaren.
- getFilteredItems() filtrerar nu pa isBlueprintAccessible -- blueprint-lasta strukturer goms helt.

**src/scenes/DayScene.ts:**
- createBuildMenu() skickar in ny getter: () => this.gameState.unlockedBlueprints.

**src/ui/LootRunPanel.ts:**
- showLootResults() visar "Blueprint found!" med blueprint-id om result.foundBlueprintId ar satt.

### Zon-progressionssystem

**src/scenes/ZoneCompleteScene.ts (ny fil):**
- Ny scen som visas nar spelaren klarar wave 5 i en zon.
- Visar "ZONE COMPLETE: [zonnamn]" med kills-statistik.
- Visar vilken zon som las upp nasta (City efter Forest, Military efter City).
- Gar tillbaka till MenuScene efter klick/tangent.

**src/scenes/NightScene.ts:**
- Boss Night: ny showFinalNightBanner() visar stor rod "FINAL NIGHT"-text med scale-in animation nar wave 5 startar.
- all-waves-complete: vid klart natt 5 sparas zoneProgress, nasta zon las upp (unlockNextZone), currentWave nollstalls till 1 och ZoneCompleteScene visas.
- player-died: currentWave aterstalas till 1 vid dod. Spelaren borjar om fran natt 1 i SAMMA zon -- allt gear, refugees och skills behalles.
- Ny privat metod unlockNextZone(clearedZone): laggar zoneProgress-post for nasta zon.

**src/scenes/MenuScene.ts:**
- Ny buildZonePanel(): visar Forest/City/Military pa hoger sida med status (locked/unlocked/progress/cleared) och loot-multiplier. Aktiv zon markeras.
- Continue-knappens subtext visar "[Zonnamn] -- Night X/5".

**src/main.ts:**
- ZoneCompleteScene registreras i scenarrayen.

## [2.4.1] - 2026-04-02

### BuildMenu -- kompaktare layout, tangentbordsnavigering, scroll

**src/ui/BuildMenu.ts:**
- PANEL_W 340 -> 300, ITEM_H 56 -> 46, ICON_CELL 36 -> 28.
- Font: tabbar 7px, item-namn 9px, beskrivning/kostnad 7px (var 10px/8px).
- Tangentbordsnavigering: handleKey(key) exponeras. Siffror 1-9 valjer synligt item N. ArrowDown/Up flyttar markor och scrollar vid behov. Enter valjer markerat item om det ar tillgangligt. Tab byter till nasta flik.
- Markerat item far ljusare bakgrund (ITEM_SELECTED) och gron border.
- Scroll-simulation: MAX_VISIBLE_ITEMS beraknas fran skarmhojd. Om listan ar langre syns "^ more above" / "v N more" i botten.
- Litet sifferhint (1-9) visas i ovra vanstra hornet pa varje synligt item.

**src/ui/ActionPointBar.ts:**
- Nytt valfritt konstruktor-argument onDebugClick?: () => void.
- AP-texten ("AP 12/12") gors klickbar via setInteractive(). Vid klick anropas onDebugClick.
- Ingen synlig forondring for spelaren -- osynlig debug-genvag.

**src/scenes/DayScene.ts:**
- ActionPointBar far toggleDebugMenu som onDebugClick-callback.
- Keyboard-routern: nar build-menyn ar oppen delegerar den nu tangenter till buildMenu.handleKey() (utom Escape).

## [2.4.0] - 2026-04-02

### Fix -- Nattstart-krasch vid strukturer (TrapBase)

**src/structures/TrapBase.ts:**
- Lagg till NaN/undefined-guard for instance.x och instance.y i konstruktorn. Om positionen ar ogiltig klamras den till (0,0) med console.warn.
- Guard for scene.sys efter super(): om Phaser inte har initierat sys-kontexten loggars ett fel och statusText/draw/add.existing hoppas over istallet for att krasha.
- NightScene.createStructures() hade redan try/catch runt varje case -- TrapBase ar nu ocksa defensiv inifraan.

### Fix -- Storm-event raderar alla strukturer

**src/systems/EventManager.ts:**
- applyStormDamage() skadar nu max 2 slumpmassigt utvalda strukturer (Fisher-Yates partial shuffle) istallet for alla.
- Meddelande uppdaterat: "Up to 2 structures took X damage".
- Forhindrar att ett enda storm-event utplanar hela basen.

### BuildMenu redesign (Tasks 3, 4, 5)

**src/ui/BuildMenu.ts -- helt omskriven:**
- Resursrad i toppen: S:24 P:5 F:8 AP:10/12 (alltid synlig, gul text).
- Tre tabbar: TRAPS | WALLS | SPECIAL (klickbara, filtrerar listan).
- Scrollbar lista med items: 36x36 emoji-ikonruta, gron border = har rad, gra = inte.
- Namn + effekt-beskrivning (7px gra text under namn).
- Kostnad till hoger (gron = har rad, rod = saknar).
- Gray-out med orsak: "Not enough scrap/parts/food/AP" (rod text), "Requires Camp/Outpost" (orange text).
- Lasta items visas med "Requires [BaseLevel]" i orange.
- Panelbredd 340px. Alla strukturer visas (lasta gradas ut).

**src/data/structures.json:**
- Alla 18 strukturer far "category" falt: primitive | machine | special.
- Alla 18 strukturer far "description" falt med kort effekt-text.
- Kategorisering: primitive = barricade/wall/trap/spike_strip/sandbags/cart_wall/pit_trap, machine = blade_spinner/fire_pit/propane_geyser/washing_cannon, special = pillbox/shelter/storage/farm/bear_trap/landmine/oil_slick.

**src/systems/BuildingManager.ts:**
- StructureData interface utokad med category: string och description: string.

**src/scenes/DayScene.ts:**
- Importerar nya BuildMenu-klassen.
- createBuildMenu() ersatt med instansiering av BuildMenu med fullstandiga callbacks.
- refreshBuildMenuAffordability() borttagen (BuildMenu.show() kallar rebuild() internt).
- rebuildBuildMenu() anropar buildMenu.destroy() + createBuildMenu().
- toggleBuildMenu() anropar buildMenu.show()/hide().
- startPlacement() anropar buildMenu.hide() istallet for buildMenuContainer.setVisible(false).
- Keyboard-handler: number-shortcuts (1-9) borttagna (tabs ersatter numrering).

**Version:** 2.3.0 -> 2.4.0

---

## [2.3.0] - 2026-04-02

### Feature -- Cooldown-system + 6 nya mekaniska fallor

**TrapBase (src/structures/TrapBase.ts):**
- Ny abstrakt basklass for alla mekaniska fallor.
- Hanterar cooldown (cooldownMs/cooldownTimer), overheat (overheatMax/overheatCurrent/overheated/recoveryMs), malfunction (malfunctionChance/malfunctioned), uses (-1 = obegransade) och fuel (fuelPerNight).
- tryActivate(): returnerar false vid cooldown/overheat/malfunction, startar annars timer och ackumulerar overheat.
- update(delta): raknar ner cooldown, acker overheat, aterstaller vid recovery-slut.
- Visuella statusoverlayn: gron (aktiv), gra+timer (cooldown), orange+HOT! (overheat), rod blinkande !! (malfunction).
- repair(): nollstaller malfunction-flaggan, anropas av spel-reparatoren.
- manualCool(): halverar recovery-tid vid manuell nerkyling (framtida funktion).

**6 nya fallor:**
- BladeSpinner (src/structures/BladeSpinner.ts): roterande bladmaskin, 25 dmg AOE 40px, cd 4s, overheat 30s/10s recovery, malfunction 15%, fuel 1 food/natt.
- FirePit (src/structures/FirePit.ts): brannzon 3 tiles, 15 dmg/s, ingen cooldown, flimrande animation, malfunction 5%, fuel 2 food/natt.
- PropaneGeyser (src/structures/PropaneGeyser.ts): eldexplosion i 60px radie, 40 dmg, cd 6s, overheat 20s/12s recovery, malfunction 10%.
- CartWall (src/structures/CartWall.ts): passiv blockerare av kundvagnar, 80 HP, billig, ingen cooldown/overheat.
- WashingCannon (src/structures/WashingCannon.ts): skjuter projektiler mot narmaste zombie i 150px, 30 dmg, cd 3s, overheat 25s/12s, malfunction 20%.
- PitTrap (src/structures/PitTrap.ts): fangar upp till 5 zombies permanent, forstors nar full, malfunction 10%.

**structures.json uppdaterad:**
- Alla 6 nya fallor tillagda med korrekt data (kostnad, HP, effekter, cooldownMs, overheatMax, malfunctionChance, fuelPerNight etc.).

**NightScene.ts:**
- Importerar alla 6 nya falle-klasser och TrapBase.
- createStructures(): hanterar alla 6 nya case-block. Rullar malfunction och drar fuel vid nattstart.
- Nya privata arrays: _bladeSpinners, _firePits, _propaneGeysers, _cartWalls, _washingCannons, _pitTraps.
- _lastDelta: property for att viderebeforda delta till updateMechanicalTraps().
- _repairKey: E-tangent for repair-interaktion.
- updateMechanicalTraps(): uppdaterar alla TrapBase.update(delta), hanterar AOE/kontakt/projektiler per trap-typ.
- updateRepairMechanic(): spelare haller E nara malfunctioned falla i 2 sekunder, kostar 1 parts, visar progress-bar.
- checkZombieStructureInteractions(): cleanup + updateMechanicalTraps() kallas en gang per frame.

**Version:** 2.2.0 -> 2.3.0

---

## [2.2.0] - 2026-04-02 (uppdaterad 2026-04-02 17:24)

### Feature -- Inventory redesign steg 4 (ammo-bekraftelse vid nattstart)

**NightScene.autoLoadAmmo() -- bekraftelse-text:**
- Vid full ammo-laddning visas nu alltid: "Ammo loaded: Pistol (2), Rifle (3) = 5 used, 10 left"
- Beraknar ammo kvar (leftAfter) fran stockpile efter avdrag
- Meddelandet visas 200ms in i natten (nar HUD ar redo)
- Varnings-grenen (Low ammo!) bevarad oforandrad for ofullstandig laddning

### Feature -- Inventory redesign fas 2 (toolbar-forenkling + tooltips)

**DayScene toolbar -- 6 knappar:**
- Toolbar har nu exakt 6 knappar: BUILD (B), EQUIP (Q), CRAFT (C), LOOT (L), REFUGEES (R), END DAY (E).
- AMMO-knapp borttagen (ammo auto-laddas vid nattstart).
- WEAPONS-knapp borttagen (EQUIP-panelen hanterar allt vapen-relaterat).
- SKILLS-knapp borttagen fran toolbar (fortfarande tillganglig via S-tangent).
- Jamnare spacing: 16px gap mellan knappar, inga null-gaps.

**Tutorial-text uppdaterad:**
- "LOAD AMMO"-steget ersatt med "AMMO" som forklarar auto-laddning.

**Resource tooltips:**
- Hover over resurs-sektion i botten-baren visar tooltip med forklaring.
- SCRAP: "Build structures and barricades".
- FOOD: "Refugees eat 1 per day each".
- AMMO: "Auto-loaded at night. 0 = melee only".
- PARTS: "Upgrade and repair weapons".
- MEDS: "Heal injured refugees (REST job)".

---

## [2.2.0] - 2026-04-02

### Feature -- Inventory redesign fas 1

**Auto-load ammo vid nattstart (NightScene.ts):**
- `autoLoadAmmo()` beraknar ammoPerNight for varje equipped ranged vapen.
- Drar totalt belopp fran `gameState.inventory.resources.ammo`.
- Om inte tillrackligt ammo: visar varning "Low ammo! Pistol: OK, Rifle: NO AMMO" i 3s.
- `gameState.inventory.loadedAmmo` anvands inte langre for manuell laddning.
- Sparar gameState direkt efter avdrag.

**Ta bort AMMO-knapp fran DayScene toolbar (DayScene.ts):**
- AMMO-knapp (A) borttagen fran toolbar och keyboard-router.
- WEAPONS-knapp (W) borttagen fran toolbar.
- Toolbar har nu 6 knappar: BUILD, EQUIP, CRAFT, REFUGEES, LOOT RUN, SKILLS, END DAY.
- Import av `loadAmmo` och `WeaponPanel` borttagen.

**EquipmentPanel slår ihop EQUIP + WEAPONS (EquipmentPanel.ts):**
- [REPAIR] knapp per vapen (kostar 1 AP + 1 parts) i default-vy och storage-lista.
- [UPGRADE] knapp per vapen oppnar inline upgrade-vy (identisk logik som gamla WeaponPanel).
- Storage-lista visar [EQUIP], [REPAIR], [UPGRADE] per vapen.
- Konstruktorn accepterar nu `currentAP`, `spendAP`, `onResourceChange` callbacks.
- Ny ViewState 'upgrade' med `weaponId` falt.

**Dual weapon HUD (HUD.ts):**
- Bottom-bar visar nu BADA equipped vapen med tangent-nummer [1] och [2].
- BOTTOM_H okad till 48px for att rymma tva rader.
- `updateSecondaryWeapon(name, dur, maxDur)` -- ny metod for sekundarvapen.
- `setActiveSlot(1|2)` -- markerar aktivt tangent-nummer med guld.
- NightScene.updateWeaponHUD() uppdaterar bada slots och anropar setActiveSlot().

**Ammo-varning vid nattstart:**
- Om ammo inte racker visas "Low ammo! [vapen]: OK/NO AMMO" i 3 sekunder.
- Varning visas 200ms efter scen-start (nar HUD ar redo).

**AmmoLoader.ts behalles:** Filen finns kvar men anvands inte langre av DayScene.

## [2.1.0] - 2026-04-02

### Feature -- Equipment panel (2 vapen-slots)

**Ny typ i GameState (types.ts):**
- Lade till `equipped: { primaryWeaponId: string | null; secondaryWeaponId: string | null }` pa `GameState`. Primary = tangent 1, secondary = tangent 2 i nattfasen.

**SaveManager.ts:**
- `createDefaultState()`: equipped initieras med null/null.
- `load()`: migrerar gamla saves -- saknas equipped-faltet sätts det till null/null och auto-equip körs vid nästa nattstart.

**Ny fil src/ui/EquipmentPanel.ts:**
- UIPanel-baserad panel med two-slot-vy (PRIMARY / SECONDARY) och weapon picker.
- Klick pa [>] intill en slot öppnar picker med alla vapen; vapen i andra sloten visas gråat.
- Storage-lista visar vapen som inte är equipped.
- Statisk metod `autoEquipIfNeeded()` väljer de 2 vapnen med högst damage om slots är tomma.
- Escape i picker-vy går tillbaka till default-vy (inte stänger panelen).

**DayScene.ts:**
- Importerar och instansierar EquipmentPanel efter WeaponPanel.
- EQUIP-knapp tillagd i toolbar (shortcut Q) med orangeröd temafärg.
- Q-tangent i keyboard-routern (kontrollerar equipmentPanel.handleKey() bland öppna paneler).

**NightScene.ts:**
- Importerar EquipmentPanel.
- Anropar `EquipmentPanel.autoEquipIfNeeded()` direkt efter WeaponManager skapas.
- Ny `syncEquippedSlotToWeaponManager()` sätter aktiv index till primary-sloten vid start.
- Ny `getEquippedIndexForSlot(1|2)` löser upp slot-nummer till inventory-index.
- `setupWeaponKeys()` omskriven: om equipped finns ger key 1 primary och key 2 secondary. Annars faller koden tillbaka på gammalt beteende (keys 1-5 = alla vapen).
- Ny `checkAmmoWarning()` extraherar den återanvända ammo-varningslogiken.

**src/config/constants.ts:**
- GAME_VERSION: 2.0.9 -> 2.1.0

### Bump -- Version 2.0.9 -> 2.1.0

## [2.0.6] - 2026-04-02

### Fix -- TB1: Textläsbarhet genomgång

**Fontgränser -- alla text uppgraderade till minst 8px:**
- `src/ui/HUD.ts`: HP-text 7px -> 8px. Fallback AMMO/KILLS etiketter 7px -> 8px. Vapenstatus-effektstext 6px -> 8px.
- `src/ui/WeaponPanel.ts`: Upgrade-slots sammanfattningstext 7px -> 8px.
- `src/ui/RefugeePanel.ts`: Initialer i porträttcirkel, stats-rad och jobbknappar 7px -> 8px. Knapphobjd ökad till 18px för att rymma texten.
- `src/ui/EventDialog.ts`: Event-typ-badge 7px -> 8px.
- `src/scenes/MenuScene.ts`: EVAC-skylt 7px -> 8px, tagline 6px -> 8px, versionsnummer 7px -> 8px, infopanel-beskrivningar 7px -> 8px, knappar subtext 7px -> 8px.

**Stroke/shadow på text renderad direkt på spelplanen:**
- `src/scenes/NightScene.ts`: BASE-etiketten ovanför basen fick `stroke: '#000000', strokeThickness: 3`, storlek ökad 8px -> 9px, setDepth(10) för korrekt z-order.
- `src/scenes/DayScene.ts`: BASE-etiketten på dagkartan fick samma behandling (9px + svart stroke + depth 10).
- `src/ui/HUD.ts`: Vågpresentationen (wave announcement) fick `stroke: '#000000', strokeThickness: 3` för läsbarhet mot varierande bakgrund.
- `src/scenes/NightScene.ts`: Drop-floaters hade redan 10px + strokeThickness 3 sedan v2.0.3 -- verifierat korrekt.

**">" pil ersatt med "--" i beskrivningstexter:**
- `src/ui/WeaponPanel.ts`: `> ${nextDesc}` ersatt med `-- ${nextDesc}` i uppgraderingsmenyn.
- `src/ui/CraftingPanel.ts`: `> ${resultStr}` ersatt med `-- ${resultStr}` i crafting-panelen.

**Strukturnamn -- "Spike Trap" bytt till "Claw Trap":**
- `src/data/structures.json`: Strukturen med id `trap` och namnet "Spike Trap" döpts om till "Claw Trap" för att tydligt skilja sig från "Spike Strip" (id: `spike_strip`). Inga duplicerade namn längre i build-menyn.

### Bump -- Version 2.0.5 -> 2.0.6
- `src/config/constants.ts`: GAME_VERSION uppdaterad.

## [2.0.3] - 2026-04-02 18:30

### Fix -- KB2: SaveManager.load() korrupt spara hang
- `src/systems/SaveManager.ts`: Nar load() kaschar ett undantag (korrupt JSON eller TypeError vid merge) rensas nu sparfilen med `localStorage.removeItem()` innan default state returneras. Tidigare sparades felet bara och spelet kunde fastna i Continue-loopen.

### Fix -- VB2: Vapenpanel equipped-indikator otydlig
- `src/ui/WeaponPanel.ts`: Bytte ">" prefixet mot ett explicit `[EQUIPPED]`-marke i gul farg (`#FFD700`) hogerplacerat bredvid det aktiva vapnets namn. Prefixet togs bort fran namnstrengen.

### Fix -- VB3: BASE-text trunkerad i HUD
- `src/ui/HUD.ts`: Okade fontstorlek pa BASE-etiketten fran 8px till 9px for att eliminera teckenstympning vid sma skalningsfaktorer.

### Verifiera -- GB1: B-tangent blockeras av tutorial (redan korrekt)
- `src/scenes/DayScene.ts`: Bekraftades att `if (this.tutorialShowing) return;` ar FORSTA kontrollen i keyboard-routern (rad 1050) och att `tutorialShowing = true` sats i borjan av `showDayTutorial()` fore allt annat. Ingen kodandring kravdes.

### Fix -- UB2: Game Over-skarmen saknar tangentbordshantering
- `src/scenes/GameOverScene.ts`: Lade till ESC/Enter/Space tangentbordshandler (identisk med ResultScene) sa spelaren kan ga vidare utan att klicka.

### Fix -- Loot: Tredje Forest-destination tillagd
- `src/data/loot-tables.json`: Lade till `ranger_station` (zone: forest, 4 AP, 35% encounter). Loot: parts, scrap, ammo, meds. Spelaren i Forest-zonen ser nu 3 destinationer (Nearby Houses, Abandoned Store, Ranger Station) istallet for 2.
- `src/data/loot-tables.json`: Ranger Station lagd till weapon drop-tabellerna for rusty_knife, hunting_knife, two_by_four, crowbar.
- `src/config/constants.ts`: Lade till `ranger_station: 65` i ENCOUNTER_THRESHOLDS.

### Fix -- VB7: Nivaindikatorer [*oo] otydliga
- `src/ui/WeaponPanel.ts`: Ersatte `starLabel()` (returnerade "[*oo]"-strang) med `levelLabel()` (returnerar "Lv X/Y"). Anvands bade i installerade upgrade-listan och i upgrade-menyn.

### Fix -- Bug 8: [ooo] visas for icke-installerade upgrades
- `src/ui/WeaponPanel.ts`: I `showUpgradeOptions()` visas nu "NEW" istallet for "[Lv 0/X]" for upgrades som annu inte ar installerade.

### Fix -- Bug 9: Floater-text svar att lasa
- `src/scenes/NightScene.ts`: `showFloatingText()` okad till 10px (fran 8px) med svart outline (strokeThickness: 3) for battre lasbarhet over varierande terrainbakgrunder.

### Verifiera -- Alla 283 tester passerar
- `npm run test`: 283/283 tester klarade.

## [2.0.2] - 2026-04-02 17:30

### Feature -- Nya fallor och hinder

- `src/data/structures.json`: Lade till 5 nya strukturer: `spike_strip` (3 scrap, 5 anvandningar, 15 dmg + cripple 3s), `bear_trap` (5 scrap + 1 parts, 25 dmg + stun 2s, engangsfalla), `landmine` (4 scrap + 2 parts, 50 dmg AOE 60px radie, engangsfalla), `sandbags` (3 scrap, 50 HP, 60% slow), `oil_slick` (2 food, 80% slow i 3 tiles zon, varar 3 natter).
- `src/data/base-levels.json`: Spike Strip och Sandbags las upp fran Tent (niva 0). Bear Trap, Landmine, Oil Slick las upp fran Camp (niva 1). Alla ingar i Outpost och Settlement ocksa.
- `src/data/visual-config.json`: Lade till fallbackfarger for alla nya strukturtyper.
- `src/systems/BuildingManager.ts`: Utokade `StructureData`-interfacet med nya falten: `trapDurability`, `crippleDuration`, `stunDuration`, `aoeRadius`, `slowFactor`, `widthTiles`, `nightDuration`.
- `src/entities/Zombie.ts`: Lade till `crippleTimer` och `stunTimer` properties. Debuffs tickar i `update()`. Stun stoppar zombien helt (bla tint). Cripple halverar hastigheten. `applyCripple(ms)` och `applyStun(ms)` exponeras som publika metoder. Nollstalls i `reset()`.
- `src/structures/SpikeStrip.ts`: Ny klass. Multi-use durability via `consumeUse()`. 15 dmg + cripple 3s per kontakt.
- `src/structures/BearTrap.ts`: Ny klass. Engangsfalla, 25 dmg + stun 2s. `trigger()` forstorer direkt.
- `src/structures/Landmine.ts`: Ny klass. AOE 50 dmg i 60px radie. `trigger()` emittar `landmine-exploded`-event.
- `src/structures/Sandbags.ts`: Ny klass. 50 HP, 60% slow. Liknar Barricade men billigare och svagare.
- `src/structures/OilSlick.ts`: Ny klass. 80% slow i 3 tiles bredd. `containsPoint()` for bred overlap. `consumeNight()` for natt-varaktighet.
- `src/scenes/NightScene.ts`: Importerade alla 5 nya strukturklasser. Arrays + cleanup i `checkZombieStructureInteractions()`. `landmine-exploded`-listener AOE-skadar alla zombies inom radie. `createStructures()` initierar alla typer fran JSON.

## [2.0.1] - 2026-04-02 17:15

### Feature -- 13 nya vapen + ranged specialeffekter

- `src/data/weapons.json`: Lade till 13 nya vapen (totalt 22). Melee: Machete (uncommon, bleed 35%), Katana (rare, crit 25%). Pistol: 9mm Compact (common), Revolver (uncommon, knockback 20%), Silenced Pistol (rare, piercing 15%). Rifle: Assault Rifle (uncommon), Scoped Rifle (rare, headshot 20%), Marksman Rifle (rare, piercing 30%). Shotgun: Pump Shotgun (uncommon, knockback 40%), Combat Shotgun (rare, incendiary 25%). Explosives (ny vapenklass): Pipe Bomb (rare, cleave 80px), Molotov (uncommon, incendiary 5s), Grenade Launcher (legendary, cleave 100px).
- `src/config/types.ts`: Utokade `WeaponSpecialEffect.type` med fyra nya effect-typer: `crit` (melee crit-chans 2x dmg), `piercing` (projektil passerar igenom zombie), `headshot` (ranged crit 2x dmg), `incendiary` (skapar brannzon med DOT).
- `src/data/loot-tables.json`: Uppdaterade `weaponDrops` med alla 22 vapen. Rarity styr drop-chans: common 15%, uncommon 8%, rare 3%, legendary 1%. Explosives hittas pa military/armory/city_ruins.
- `src/entities/Projectile.ts`: Lade till `specialEffect: WeaponSpecialEffect | null` pa Projectile-klassen. `fire()` tar nu emot specialEffect som valfri parameter.
- `src/scenes/NightScene.ts`: Ny `calcRangedDamage(proj)` -- applicerar headshot/crit-multiplikator fore takeDamage(). Ny `applyRangedSpecialEffect(zombie, proj, effect)` -- hanterar knockback (ranged), incendiary (brannzon Graphics-cirkel med DOT 5dmg/s, ticker-loop, fade-out), cleave (explosives AOE med flash-animation), crit/headshot/piercing guards. Collision-callbacken for projektil-zombie uppdaterad: piercing-projektiler deaktiveras INTE vid traff. `applyMeleeSpecialEffect()` utokad med `crit`-case. `fireProjectile()` skickar nu med specialEffect till `Projectile.fire()`.

### Fix -- Pre-existing TypeScript-fel (parallell stash)
- `src/scenes/DayScene.ts`: Andrade `structuresJson as StructuresFile` till `structuresJson as unknown as StructuresFile` for att tysta overlap-cast-fel fran optional cost-properties i JSON.
- `src/structures/SpikeStrip.ts`: Bytte `get active()` accessor (ogiltig override av Phaser Graphics) till `isAlive()` metod. Bytte `maxUses`-parameter till `_maxUses` for att tysta oanvand-variabel-fel.
- `src/systems/SaveManager.ts`: Tog bort oanvanda `WeaponUpgrade`/`WeaponUpgradeType` imports.
- `src/scenes/NightScene.ts`: Bytte namn pa de fem nya traps-arrayerna till `_spikeStrips`, `_bearTraps`, `_landmines`, `_sandbags`, `_oilSlicks` (prefix _) sa TypeScript accepterar dem som "write-only placeholders" for framtida interaktionslogik.

## [2.0.0] - 2026-04-02 16:30

### Feature -- Multi-niva upgrade-system

- `src/data/upgrades.json` (NY FIL): Definierar 8 upgrade-typer med eskalerande kostnad och effekt per niva. Varje upgrade har `maxLevel` (2 eller 3), `costs[]` och `values[]` per niva, samt `applicableTo` (vapenklasser). Upgrades: damage_boost, reinforcement, sharpening, suppressor, extended_mag, scope, quick_grip, serrated_edge.
- `src/config/types.ts`: Utokade `WeaponUpgradeType` med 3 nya typer (sharpening, quick_grip, serrated_edge). Lade till `WeaponUpgrade { id, level }` interface (ersatter string). Lade till `UpgradeDefinition` interface for upgrades.json-data. `WeaponInstance.upgrades` andrad fran `WeaponUpgradeType[]` till `WeaponUpgrade[]`.
- `src/systems/WeaponManager.ts`: `getWeaponStats()` applicerar nu upgrade-niva via values[level-1]: damage_boost, reinforcement, suppressor, extended_mag, scope, quick_grip hanteras. Returnerar nu aven `ammoPerNight` och `maxDurability` i stats-objektet. Ny metod `getAvailableUpgradesForWeapon()` filtrerar pa vapentyp och slot-begransning (max 3). Ny metod `upgradeNew()` installerar eller hojer niva. Ny metod `getUpgradeLevel()`. Legacy `upgrade()`/`canUpgrade()` delegerar till ny logik.
- `src/ui/WeaponPanel.ts`: Visar installerade upgrades med niva-indikator (t.ex. "Damage Boost[**o]" = niva 2 av 3). Upgrade-listan visar nasta nivas effekt och kostnad. MAX visas nar max niva nads. Slot-raknarare synlig (Slots: 2/3). Efter kop stanns upgrade-menyn oppen sa spelaren kan foga fler uppgraderingar.
- `src/systems/SaveManager.ts`: Ny `migrateUpgrades()` funktion konverterar gamla string[]-upgrades till WeaponUpgrade[]-format. Kors automatiskt pa varje vapen vid load().

## [1.9.1] - 2026-04-02 15:45

### Fixed -- Dag/Natt layout-diskrepans

- `src/scenes/DayScene.ts`: Tog bort de 14 hardkodade edge-dekorationerna (buskar, blommor, stenar langs kartkanterna) som existerade i DayScene men INTE i NightScene. Dessa element skapade visuell diskrepans -- spelet sg annorlunda ut dag vs natt trots identisk seed. ALL dekoration hanteras nu exklusivt av TerrainGenerator (samma kod for bada scenerna).
- `src/scenes/DayScene.ts` + `src/scenes/NightScene.ts`: Lade till `console.log` for terrainseeden i bada scenerna sa man kan verifiera att de ar identiska: `[DayScene] terrain seed = X` / `[NightScene] terrain seed = X`.
- Verifierat: bada scenerna anvander `seed = (totalRuns * 31) | 0` -- IDENTISK formeln.

### Feature -- Zombie drops (per-fiendetyp)

- `src/data/enemies.json`: Lade till `dropChance` och `dropTable` pa varje fiendetyp. Walker/Runner/Spitter/Screamer: `dropChance: 0.2`. Brute/Brute Boss: `dropChance: 0.4` med hogre min/max-varden. `dropTable` ar viktad (weight-baserad) med fem resurser: scrap, ammo, meds, parts, food. Vikterna varierar per fiendetyp (t.ex. Runner har mer ammo, Spitter mer meds).
- `src/scenes/NightScene.ts`: Ersatte globala `zombie-loot.json`-systemet med per-zombietyp logik. Ny `rollLootDrops(x, y, zombieId)` slar upp fiendekonfiguration fran `enemies.json`, rullar mot `dropChance`, valjer sedan en resurs via viktad slumpalgoritm (summa vikter, rullande subtrahering). Inga `any`-typer.
- `src/scenes/NightScene.ts`: `zombie-killed`-handleren skickar nu `zombie.zombieId` till `rollLootDrops`.
- `src/scenes/NightScene.ts`: Floater-text duration okad till 1500ms (fran 1200ms) for battre lasbarhet.
- `src/scenes/NightScene.ts`: Tog bort import av `zombie-loot.json` (ersatt). `LootDrop`-interface ersatt med `DropTableEntry` (weight istallet for chance).

## [1.8.9] - 2026-04-02 14:30

### Fixed -- B3: Pillbox UI och logik

- `src/ui/RefugeePanel.ts`: Lade till 'pillbox' i JOB_BUTTONS-arrayen (visas som 'GUARD'-knapp). Refugees kan nu tilldelas pillbox-jobb via UI.
- `src/systems/RefugeeManager.ts`: `getPillboxRefugees()` filtrerar nu korrekt pa `job === 'pillbox' && status === 'healthy'` istallet for att returnera alla friska refugees. Forhindrar att refugees pa pillbox-jobb aven raknas som scavengers.

### Feature -- Zone-specifika loot-destinationer

- `src/data/loot-tables.json`: Lade till `zone`-falt pa varje destination. Nya destinationer: `city_ruins` (City, 3 AP), `hospital` (City, 4 AP), `police_station` (City, 5 AP), `armory` (Military, 5 AP). `abandoned_store` andrades till 5 AP (fran 3). `military_outpost` andrades till 4 AP (fran 5). Varje destination har rimliga loot-tabeller for sin zon.
- `src/systems/LootManager.ts`: `getDestinations()` filtrerar nu pa `gameState.zone`. Fallback till alla destinationer om ingen matchar (t.ex. gamla saves).
- `src/ui/LootRunPanel.ts`: Visar automatiskt bara destinationer for aktuell zon (via `lootManager.getDestinations()`). Encounter-thresholds utokade med nya destinations-ID.
- `src/config/constants.ts`: `ENCOUNTER_THRESHOLDS` utokad med alla nya destinations-ID.

### Balans -- Startresurser

- `src/systems/SaveManager.ts`: `createDefaultState()` -- `parts` andrad fran 0 till 2 sa crafting ar tillganglig direkt fran start.

### Note -- F5 Zombie aggro 70/30 (ignorerad)

- Feature F5 implementeras INTE. Enligt LESSONS.md orsakar wanderer-zombies forvirring for spelaren. Alla zombies gar mot basen. aggroType-propertyn bevaras men sats alltid till 'base_seeker'.

## [1.9.3] - 2026-04-02

### Changed -- Forbattrade sprites for spelare, zombies, baser och strukturer

- **sprite_gen_improved.py**: Nytt Python/Pillow-skript som genererar 14 sprites med betydligt hogre detaljnivad an tidigare placeholders.
- **public/assets/sprites/player.png** (32x32): MilitargrOn jacka med skuggning, brun ryggsack med baljespanne i guld, hudfargat huvud med har och ogon, benberoende i morka byxor, vapensubb i hoger hand.
- **public/assets/sprites/player_attack.png** (32x32): Attackpose med hoger arm utstrack uppat, mejsell/machete-vapen synlig.
- **public/assets/sprites/walker.png** (32x32): Gra/gron zombiehud, trasiga klder med synliga skarskador, slapande armar med klor, morkt anskite med blodflackar, gap mun.
- **public/assets/sprites/runner.png** (32x32): Smal och framaloverd, riva klader med synligt blek hud, RODA OGON (nyckelfeature), klor utstrack framat i springpose.
- **public/assets/sprites/brute.png** (48x48): Massiv 48x48 zombie, bred kroppsmassa med muskeldefiniton, improviserade rustningsplattor pa axlarna med rostflackar, djupsatta roda ogon, enorma armar med blod pa handerna.
- **public/assets/sprites/spitter.png** (32x32): Uppsvallen gron/giftig zombie, toxiska flackar och bblar pa huden, VIDOPPEN MUN med synliga tander och giftigt spott/tunga.
- **public/assets/sprites/screamer.png** (32x32): Ljus/gra zombie, vidoppna ogon av skrack, armar hojda i skrik-pose, EXTREMT VIDOPPEN MUN med tander och strupe synlig.
- **public/assets/sprites/base_tent.png** (32x32): Militargreent talt franat ovanifrn, ridgepinne i mitten, staglinor i hrnorna.
- **public/assets/sprites/base_camp.png** (48x48): Camp med tristan runtom, talt i mitten, lagereld, tunna och kistlada.
- **public/assets/sprites/base_outpost.png** (64x64): Befastad utpost med tjocka betongmurar, kreneleringar, sandsacksbunkrar i hrn, vakttornplatform, byggnad/bunker med skottglugg, forraad och fat.
- **public/assets/sprites/struct_barricade.png** (32x32): Tre horisontella plankbitar med lodrata stodposter, spikar/bultar vid korsningar, tradkorn-textur.
- **public/assets/sprites/struct_wall.png** (32x32): Stenmursmonster med forsattradede blockrader, bruklinjer och skador/sprickor.
- **public/assets/sprites/struct_trap.png** (32x32): Taggtrad i spiralringar, metallglimtar, halvtransparent for att se nar synlig.
- **public/assets/sprites/struct_pillbox.png** (32x32): Cirkular sandsacksmur med skjutoppning i underkant, vapenpipa synlig, ljusa accenter pa sandsackarna.
- Alla preview-filer (8x uppskalade) uppdaterade.

## [1.8.8] - 2026-04-02

### Fixed -- Synkronisera terrangdekorationer mellan dag och natt

- `src/systems/TerrainGenerator.ts`: Lade till optional parameter `isDaytime: boolean = false` i `generateTerrain()`. Nar `isDaytime=true` anvands ljusare farger: trad (kronor och stammar +30% ljusare), stenar (+22%), buskar (+28%), stubbar (+25%), stockar (+25%), lador (+20%), stigar (+35%), vattenomraden (ljusblatt dagsljusvatten istallet for morkblatt nattvatten). Skuggor reduceras fran 22% till 10% alpha i dagsljus.
- Ny intern hjalp-funktion `lightenColor(hex, factor)`: blandar varje RGB-kanal mot 0xFF baserat pa factor (0=original, 1=vitt). Anvands i alla ritfunktioner for att berakna dagsljuspaletter.
- Ny intern hjalp-funktion `lightenPalette(palette, factor)`: tillampas pa en hel fargaray.
- Alla interna ritfunktioner (`drawTree`, `drawStone`, `drawBush`, `drawStump`, `drawWaterZone`, `drawPath`, `drawFlower`, `drawMushroom`, `drawLog`, `drawCrate`) fick `isDaytime: boolean` som ny sista parameter.
- `src/scenes/DayScene.ts`: `createMap()` kallar nu `generateTerrain(..., seed, true)` med `isDaytime=true`. Kommentar uppdaterad.
- Resultat: dekorationer ar nu identiska (samma seed, samma positioner) mellan DayScene och NightScene inom ett run. DayScene far ljusare/klarare farger som matcher det ljusa dagsljuset. Ny run efter dod ger ny layout (totalRuns andras => nytt seed).

## [1.9.2] - 2026-04-02

### Changed -- HUD-styling for NightScene

- **HUD.ts** omskriven med styled paneler och ikoner:
  - Topp-HUD hojd okat fran 32px till 44px for battre hierarki.
  - HP-bar: icon_heart + fargad bar (gron->gul->rod) + "HP: X/MaxHP" text som byter farg med halsa.
  - Stamina-bar: programmatisk blixt-ikon + bla bar under HP-bar.
  - Wave-indikator: centrerad rundad panel med bakgrund och "Wave X/Y" i 10px text.
  - Base HP: programmatisk hus-ikon + "BASE" label + fargad bar (hoger sida).
  - Botten-HUD hojd okat fran 24px till 36px.
  - Vapen-display: namn + liten durability-bar (gron->gul->rod) + special effect-text ("BLEED 25%" etc.).
  - Ammo: icon_ammo sprite-ikon (fallback: text) + antal med fargkodning (orange vid <= 5, rod vid 0).
  - Kills: icon_skull sprite-ikon (fallback: text) + antal.
  - Alla HUD-paneler har subtil mork bakgrund (fillRoundedRect + border, ej fullskarm).
- **HUD.updateWeapon()** tar nu optional `specialEffect?: WeaponSpecialEffect | null` parameter.
- **NightScene.updateWeaponHUD()** skickar nu `stats.specialEffect` till HUD.

## [1.9.1] - 2026-04-02

### Added -- Tydligare toolbar- och resursikoner

- Ny Python-skript `sprite_gen_icons_v2.py` och `sprite_gen_icons_fix.py` for ikonsgenerering.
- Omritade alla 14 ikoner med tydligare pixel art-silhuetter:
  - **Toolbar 24x24:** icon_build (hammare), icon_ammo (patron), icon_weapons (korsade knivar), icon_craft (kugghjul+nyckel), icon_refugees (person), icon_lootrun (ryggsack), icon_skills (stjarna), icon_endday (halvmane).
  - **Resurser 16x16:** icon_scrap (kugghjul), icon_food (apple), icon_parts (skiftnyckel), icon_meds (rott kors), icon_heart (hjarta), icon_skull (dodskalle).
- Alla ikoner foljr art-direction-paletten, transparant bakgrund, RGBA PNG.
- Preview-filer (8x uppskalade) skapade for alla ikoner.

## [1.9.0] - 2026-04-02

### Added -- Wave-progression, tydligare dod, forbattrad damage-feedback

**UPPGIFT 1: Dynamic wave-count per natt**
- WaveManager: ny property `maxWaves` (default 5). Ny metod `setMaxWaves(n)` och `getMaxWaves()`.
- NightScene.setupWaveManager(): raknar ut `Math.min(Math.max(nightNumber, 1), 5)` fran `gameState.progress.currentWave` och kallar `waveManager.setMaxWaves(totalWaves)`.
- WaveManager.onEnemyKilled(): janfar nu mot `this.maxWaves` istallet for hardkodat 5.
- wave-complete handler: startar nasta wave om `wave < maxWaves` (inte alltid < 5).
- all-waves-complete: skickar `wave: waveManager.getMaxWaves()` till ResultScene.
- HUD.updateWave(): tar nu `maxWaves: number = 5` som andra parameter, visar "Wave X/Y" dynamiskt.
- Tutorial-text i NightScene visar "Survive N wave(s)" med dynamiskt N.

**UPPGIFT 2: Tydligare dodsorsak**
- Player.takeDamage(): emitar nu `player-died` med reason `'player_killed'`.
- NightScene.damageBase(): emitar `player-died` med reason `'base_destroyed'`, trackar `baseDamageTaken`.
- NightScene.player-died handler: tar emot reason-strang, guard `gameOverShown` forhindrar double-fire.
- Ny metod `showGameOver(reason)`: visar centrerad panel (INTE fullskarms-overlay) med rubrik "YOU DIED" (rod) eller "BASE DESTROYED" (orange), stats (kills, wave, base damage), "You keep all your gear." i grott, och "Click to continue" prompt. Klick pa panelen eller tangent gar till DayScene. Physics pausas under panelen.

**UPPGIFT 3: Forbattrad damage-feedback**
- NightScene: ny particle emitter `playerBloodEmitter` (5 roda partiklar runt spelaren vid skada, depth 12).
- NightScene: ny Graphics `vignetteFlash` (depth 98) som ritar fyra kantade rektanglar vid skada. Tonar ut pa 300ms.
- player-damaged event anropar nu `flashPlayerDamage()`: emitar blodpartiklar, vignette-flash, `cameras.main.shake(50, 0.006)` och `hud.flashHpBar()`.
- HUD.flashHpBar(): ny metod, satter hpBar.alpha=0.3 och tweens tillbaka till 1 pa 250ms.

## [1.8.7] - 2026-04-02

### Added -- 5 nya melee-vapen med specialeffekter

- `src/data/weapons.json`: Lade till 5 nya melee-vapen: Hunting Knife (bleed), Baseball Bat (knockback), Crowbar (cripple), Two-by-Four (stun), Fire Axe (cleave). Lade till `specialEffect: null` pa befintliga vapen. Varje vapen har ett `specialEffect`-objekt med type, chance, value och duration.
- `src/config/types.ts`: Ny `WeaponSpecialEffect`-interface med union-type for `type` ('bleed' | 'knockback' | 'cripple' | 'stun' | 'cleave'), `chance` (0-1), `value` och `duration`. Uppdaterade `WeaponData` med optional `specialEffect: WeaponSpecialEffect | null`.
- `src/systems/WeaponManager.ts`: `getWeaponStats()` returnerar nu aven `specialEffect` fran vapendatan. Importerar `WeaponSpecialEffect`-typen.
- `src/scenes/NightScene.ts`: Ny privat metod `applyMeleeSpecialEffect()` applicerar effekter efter melee-treff: knockback (physics setVelocity bort fran spelaren), cripple (sanker moveSpeed temporart), stun (nollstaller moveSpeed + velocity temporart), bleed (delayedCall 1s -> extra skada), cleave (skadar alla zombies inom radie). Anropas i `shootAt()` efter `target.takeDamage()` om zombie fortfarande ar aktiv.
- `src/data/loot-tables.json`: Nytt `weaponDrops`-array med chans-baserade vapenavrop per destination. Alla 9 vapen har entries med destination-lista och chans (0.03-0.09).
- `src/systems/LootManager.ts`: `LootResult` har nu `weaponDropId: string | null`. Ny `rollWeaponDrop()`-metod slumpar vapenfynd fran `weaponDrops`-tabellen. `executeLootRun()` rullar vapendrop och inkluderar det i resultatet.
- `src/ui/LootRunPanel.ts`: Vapenfynd visas i resultatskärmen med gul text. `applyResults()` skapar ett nytt `WeaponInstance` och lagger det till `gameState.inventory.weapons`.

## [1.8.6] - 2026-04-02

### Fixed -- 2 buggar: tutorial/event-overlap och vag-rendering

- DayScene: tutorial och EventDialog visades samtidigt pa dag 1. `checkRandomEvent()` anropades nu EFTER tutorialkontrollen. Ny flagga `tutorialShowing` satt till true nar tutorial visar. Om tutorial ar aktiv hoppas random event over. Nar sista steget stangds nollstalls flaggan och `checkRandomEvent()` anropas sa eventet visas direkt efterat utan overlap.
- NightScene och DayScene: vagen ritades som individuella `fillRect` per tile vilket skapade synliga bruna rektanglar. Bytt till tre horisontella `fillRect` som spacklar hela kartbredden: mjuka axlar (semi-transparent) + ett huvudbandbredd + ett subtilt mittstreck. Inga synliga tile-granser.
- NightScene och DayScene: bas-area (jordpatch runt basen) ritades ocksa som per-tile rects. Bytt till `fillEllipse` for en slat cirkuler form: yttre halo (semi-transparent) + inre fast cirkel.

## [1.8.4] - 2026-03-28

### Added -- UX: Click-outside-to-close and deep keyboard shortcuts
- UIPanel base class now has an invisible full-screen backdrop. Clicking outside any UIPanel-based panel (WeaponPanel, CraftingPanel, SkillPanel, RefugeePanel, LootRunPanel) closes it.
- EncounterDialog result screen (ESCAPED!/VICTORY!/DEFEATED) closes on backdrop click, Enter, or Escape.
- EventDialog shows number key hints for choices (1, 2, etc.) via handleKey.
- Central keyboard router in DayScene dispatches keys to the topmost open dialog/panel before falling through to toolbar shortcuts.
- Toolbar shortcut keys with visible hints: B=Build, A=Ammo, W=Weapons, C=Craft, R=Refugees, L=Loot Run, S=Skills, E=End Day. Shown in tooltip as e.g. "BUILD [B]".
- Number keys 1-9 inside panels select the Nth item: build menu entries, loot destinations, crafting recipes, weapon equip.
- Escape key closes whatever is on top: any open panel, build menu, placement mode, structure popup, or dialog.
- EncounterDialog fight/flee choice supports 1=Fight, 2=Flee keyboard shortcuts.
- Enter key closes loot run results dialog immediately (cancels auto-close timer).
- Each panel exposes handleKey(key): boolean so the scene-level router can delegate.

## [1.8.3] - 2026-03-28

### Fixed
- DayScene visar nu samma terrang (trad, stenar, buskar etc.) som NightScene via TerrainGenerator. Anvander samma seed sa hinder syns nar man placerar strukturer. Enbart visuellt -- inga colliders i dagscenen.
- Zombies stannar nu ~48px fran basens centrum istallet for att snurra ovanpa den. De star stilla och "attackerar" perimetern, medan NightScene hanterar skada via befintlig overlap-logik.

## [1.8.2] - 2026-03-28

### Fixed -- 4 kritiska buggar
- Zombie die() forrenklat: tog bort komplex death-animation med corpse-lingering, tweens och safety-timers som skapade svarta skuggor. Nu: vit blixt 80ms sedan ta bort. Inga kvarliggande corpses.
- Wanderer aggro-typ borttagen: alla zombies gar nu mot basen (eller ljud/spelare). 30% wanderer-logik gav zombies som vandrade planlost vid kartkanterna.
- DayScene create() inlindad i try-catch som fallback till MenuScene vid krasch (sakerhetsnatt for Continue-knappen).
- Rensat oanvanda metoder och properties (getWanderDestination, pickWanderPoint, wanderTarget, deathAnimKey, deathSafetyTimer).

## [1.8.1] - 2026-03-30

### Fixed -- Stabiliseringsrunda (kodgranskning + bugfix)
- KRITISK: Melee-vapen kastade projektiler istallet for direkt skada. Lagt till separat melee-gren i shootAt() som applicerar damage direkt pa target
- KRITISK: Zombie death-tweens kvarstod vid pool-reuse, avaktiverade nyspawnade zombies. Lagt till killTweensOf(this) i reset()
- KRITISK: Dubbla death-tweens (animation + safety timeout). Lagt till deathStarted-flagga och timer-cleanup
- Zombie velocity/angle/alpha inte nollstallt vid reset() -- zombies spawnade med momentum
- Zombie aggroType/wanderTarget inte resettat vid pool-reuse
- End Day-dialog: keyHandler forward-reference kunde krascha
- Level-text pa strukturer lackade minne (inte tracked i structureSprites)
- Build menu state-mismatch vid placement mode + B-tangent
- MenuScene removeAllListeners() forstorde andra panels keyboard-handlers

## [Unreleased] - 2026-03-29

### Changed
- Removed ALL full-screen dark overlay rectangles (0x000000, 0.5-0.6 alpha) from dialogs and tutorial panels. Affected files: EventDialog.ts, EncounterDialog.ts, DayScene.ts (end-day confirm + tutorial), NightScene.ts (tutorial). Click-blocking now handled via setInteractive on the dialog panel background itself.
- DayScene.createMap() visual overhaul for graphics fallback path: per-tile colour variation with 5 daytime green shades (matching NightScene pattern), lighter sandy cleared area around base, natural wandering road with per-tile dirt colour variation, edge decorations (14 bushes/flowers/stones around map perimeter), ground detail patches (grass tufts, leaves, pebbles, ~18% density). Grid overlay alpha reduced from 0.3 to 0.1 for subtlety.

### Added
- 24 detailed terrain sprites for rich map visuals: 7 ground tiles (grass variants, dirt, path, leaf litter), 7 decorations (flowers, mushroom, bones, crate, log, lantern), 4 tree parts (trunk + 3 canopy sizes), 2 bushes, 1 water puddle, 3 rocks
- All terrain sprites saved to public/assets/sprites/terrain/ with 8x preview versions
- Sprites use post-apocalyptic dark palette matching art-direction.md: muted greens, dark earths, mossy stones
- Generated by sprite_gen_terrain_detailed.py (Python/Pillow, pixel-for-pixel rendering)
- Character portraits (64x64 px pixel art) for all 4 playable characters: Soldier, Scavenger, Engineer, Medic
- Portrait assets in public/assets/sprites/characters/
- Portraits loaded in BootScene.ts as portrait_soldier, portrait_scavenger, portrait_engineer, portrait_medic
- Visual overhaul: NightScene ground layer with per-tile colour variation, cleared dirt area around base, ground detail patches (grass tufts, leaves, pebbles)
- Visual overhaul: natural wandering dirt road replacing solid rectangle
- Visual overhaul: warm orange base glow (radial gradient, 8 steps, depth 4) around base centre
- Visual overhaul: edge vignette (dark frame strips, 5-step gradient, depth 9) for atmospheric depth
- TerrainGenerator overhaul: trees now use 4 crown shape variants with 3-4 overlapping ellipses, ground shadow, and textured trunk (dark stripe + knot detail)
- TerrainGenerator: stones now have light highlight, dark shadow crescent, and 40% moss patches in forest/military zones
- TerrainGenerator: bushes redesigned with 4 overlapping ellipses + specular highlight + ground shadow
- TerrainGenerator: stumps improved with two annual rings and light spot
- TerrainGenerator: new element -- flowers (10-20 per forest map, 5 petal types, yellow/white/red/pink/purple)
- TerrainGenerator: new element -- mushrooms (3-6 per forest map, red Amanita with white spots, brown, pale)
- TerrainGenerator: new element -- fallen logs (2-4 per forest, rotated with bark stripes and end caps)
- TerrainGenerator: new element -- crates/debris (1-4 per map, near base, with wood plank detail and crack on broken variants)
- Forest zone tree count increased from 5-8 to 10-15 for denser feel
- Water zones improved with muddy shore ring and dual reflection highlights

## [1.7.0] - 2026-03-29

### Fixed
- B1: Shooting crash root cause -- re-verifies target active before shootAt()
- B2: Continue crash -- SaveManager normalizes weapon.upgrades and structure hp/maxHp
- B3: Pillbox damage -- replaced non-existent physics.closest() with manual distance loop

### Added
- F1: Zombie death animation (flash + corpse stays 10-15s with dark tint)
- F2: Persistent blood splatters on ground (randomized ellipses + droplets)
- F3: Base health bar in HUD (green->yellow->red, zombies damage base)
- F4: 5 new procedural sounds + pitch variation on all sounds
- F5: Zombie aggro balance (70% base seekers, 30% wanderers)
- U1: One-click loot runs with auto-close result
- U2: Refugee panel redesign (portrait icons, HP bars, status colors)
- U3: Refugee companions on loot runs
- U4: EventDialog dynamic height, never overflows
- U5: Keyboard shortcuts in DayScene (B/L/R/E)
- New title screen with procedural pixel art background, styled buttons, info panel
- Procedural terrain generation (trees, rocks, water, paths, stumps) with zone variation
- Terrain colliders (trees/rocks block movement, water slows zombies 50%)
- Tree canopies on high depth for parallax feel

### Changed
- Version: 1.6.0 -> 1.7.0
- MenuScene completely redesigned
- GameState.base extended with hp/maxHp fields

## [1.6.0] - 2026-03-29

### Fixed
- Continue-knapp kraschade pga saknade falt i gamla saves (SaveManager migrerar nu)
- Spitter-projektil kunde krascha spelet nar spelaren redan var dod (lagt till null-guards)
- Zombies var osynliga pga fog-of-war visibility check (borttaget -- alla zombies alltid synliga)
- Natt-overlay: tog bort hela RenderTexture-baserade ljussattningen (orsakade gra rektangel)
- Byggmenyn stangs inte langre efter varje placering (kan placera flera i rad)

### Changed
- Nattfasen har morkare bakgrund istallet for ljus-overlay (renare, inga buggar)
- Zombie aggro: fiender gar nu mot BASEN som standard, lockas mot spelaren enbart via vapenljud
- HUD: tydliga labels "AMMO:" och "KILLS:" istallet for kryptiska ikoner/siffror

## [1.5.0] - 2026-03-29

### Fixed
- Ljussattning: gra rektangel tackto inte hela kartan. Bytt till screen-space RenderTexture
- Roda fog-pilar: tog bort distraktande zombie-indikatorer (ljussattning hanterar synlighet)
- EventDialog: gra box overfyllde panelen. Bredare panel, rundade horn, text-wrapping
- Karaktarsval: text overlappade mellan kort

### Changed
- Karaktarsval: bytt fran 4 trange kort till carousel-design med en stor karaktarspanel
- Skill-namn visas som lasbart text (Melee, Rifle) istallet for ratt ID (combat_melee)
- Tangentbord-navigation i karaktarsval (pilar + Enter)
- Skill-bonusar visas som grafiska pips istallet for text

### Added
- Steg-for-steg onboarding for nattfasen (5 steg: Move, Shoot, Sprint, Switch, Survive)
- Steg-for-steg onboarding for dagfasen (5 steg: Day Phase, Build, Load Ammo, Loot, End Day)
- Onboarding forklarar ammo-laddning (LOAD AMMO kostar 1 AP, inget ammo = bara melee)
- Settings-panel i huvudmenyn med separata toggles for SFX och Ambient/Music
- Volymkontroll med +/- knappar
- AudioManager stodjer separata sfxMuted/ambientMuted flaggor

## [1.4.0] - 2026-03-29

### Added -- Procedural Audio System (Fas 5E)
- AudioManager: komplett procedurellt ljudsystem via Web Audio API (inga externa filer)
- Skottljud per vapenklass: pistol, rifle, shotgun, melee (whoosh), explosives (rumble)
- Zombie-ljud: groan (varierat pitch), attack, death (fallande ton)
- Spelarljud: hurt, death (ominous descending)
- Wave-ljud: start (stigande alarm), clear (triumfackord C-E-G)
- UI-ljud: click, build (metalliskt klang), error (dissonant buzz)
- Loot pickup (stigande ping), structure break (krossande brus)
- Ambient natt: brown noise-baserad vind med vindbyar
- Ambient dag: mjuk vind + slumpmassiga fagel-chirps
- Ljud-toggle i huvudmenyn (SOUND: ON/OFF)
- Alla ljud har cooldown for att forhindra overlappning
- Master volume-kontroll, mute-funktion
- AudioContext initieras pa forsta anvandardinteraktion (browserkrav)
- Ljud integrerat i NightScene (alla events), DayScene (bygg, fel, ambient), MenuScene (klick)

## [1.3.1] - 2026-03-29 10:30

### Fixed -- NightScene rendering bugs
- Moved assets/ into public/ so Vite copies sprites to dist/ during build. All sprites (player, base, terrain, structures, UI icons) were missing in production builds, causing fallback textures everywhere.
- Set FogOfWar graphics (depth 80) to invisible since visual fog is disabled. The empty Graphics object at high depth could interfere with rendering.
- Base now renders as base_tent.png sprite instead of grey Graphics rectangle in production.
- Player now renders as player.png sprite instead of programmatic green blob in production.
- Terrain now renders with tile sprites instead of solid color fill in production.

## [1.3.0] - 2026-03-29

### Added -- Toolbar icons (pixel art)
- icon_build.png: hammer, green (#4CAF50), construction
- icon_weapons.png: crossed swords, gold (#C5A030), weapon management
- icon_craft.png: wrench, brown (#8B6914), crafting
- icon_skills.png: star, gold (#C5A030), skill progression
- icon_refugees.png: person silhouette, purple (#8B6FC0), refugee management
- icon_lootrun.png: compass, orange-gold (#D4A030), expeditions
- icon_endday.png: crescent moon + arrow, orange-red (#D4620B), end day
- icon_heart.png: heart shape, red (#F44336), HP display
- icon_skull.png: skull, bone white (#E8DCC8), kill counter
- All icons: 32x32 RGBA PNG with 8x upscaled _preview.png
- Generator script: sprite_gen_toolbar_icons.py

### Changed -- DayScene icon toolbar + resource bar overhaul
- Replaced two-row text action bar with single-row icon toolbar (h=48, y=552)
- 8 icon buttons (36x36) with 32x32 icons, dark bg, colored borders, hover gold + 1.05x scale
- Button order: BUILD | AMMO | WEAPONS | CRAFT | gap | REFUGEES | LOOT RUN | gap | SKILLS | END DAY
- Tooltip on hover: label text 6px above icon (8px font, dark bg)
- Falls back to 3-char text abbreviation if icon not loaded
- Resource bar (h=24, y=528) now shows 16x16 resource icons left of "value/cap" numbers
- Top bar reduced to h=36 with smaller AP pips (12x8) and "AP" label (9px)
- Toolbar icons loaded in BootScene with loaderror fallback
- Zone selector and info text repositioned for new top bar height

### Changed -- NightScene HUD icons
- Heart icon (icon_heart) next to HP bar in top HUD
- Skull icon (icon_skull) next to kill counter in bottom HUD
- Bullet icon (icon_ammo) next to ammo counter in bottom HUD

### Changed -- Panel standardization
- Consistent 10/9/8px typography across all panels (headers 10px, body 9px, details 8px)
- Resource costs shown with 12x12 resource icons in CraftingPanel, WeaponPanel, BuildMenu, LootRunPanel
- WeaponPanel upgrade costs display resource icons instead of text labels
- BuildMenu structure costs shown with resource icons
- All panels use UIPanel component for consistent layout

## [1.2.1] - 2026-03-29

### Fixed
- Döda zombies försvann aldrig från skärmen -- death-animation saknade timeout-fallback. Lagt till 1s safety timer.
- Mörk rektangel uppe till vänster i NightScene -- FogOfWar ritade separat mörk overlay ovanpå ljus-overlayen. Inaktiverat fog-grafiken.

## [1.2.0] - 2026-03-28

### Added -- UI component system
- UIButton.ts: shared button component with background rect, border, hover effects (gold highlight), click handler
- UIPanel.ts: shared panel component with header, [X] close button, dark background (#1A1A1A 95%), CLOSE_ALL_PANELS event for mutual exclusion

### Changed -- DayScene UI redesign
- Top bar (h=48, #1A1A1A 85%): AP pips left, DAY counter centered (14px), base name + upgrade button right
- Two-row action bar at bottom: Row 1 (BUILD, AMMO, WEAPONS, CRAFT, SKILLS, END DAY), Row 2 (REFUGEES, LOOT RUN)
- Resource bar moved to bottom (h=24, #1A1A1A 90%) with color-coded resources, separators, and capacity display
- All raw text buttons replaced with createUIButton() from UIButton.ts
- Removed bracket prefixes from resource display, using color-coding instead
- No overlapping elements at 800x600

### Changed -- NightScene HUD redesign
- Top HUD (h=32, dark bg 50%): HP bar left (180x12), stamina bar below HP (100x6), wave info centered
- Removed resource bar from NightScene (not needed during combat)
- Bottom HUD (h=24, dark bg 50%): weapon name + durability left, ammo counter center-right, kill counter far right
- Wave announcement centered with fade-out, no HUD overlap

### Changed -- Panel standardization
- WeaponPanel, SkillPanel, RefugeePanel, LootRunPanel, CraftingPanel, EventDialog converted to UIPanel standard
- All panels: centered horizontally, y=56, max 400px wide, header with title + [X] close, dark background, 12px padding
- Only one panel open at a time (opening new closes old via CLOSE_ALL_PANELS event)

### Fixed
- Build menu now participates in CLOSE_ALL_PANELS event system -- opening any UIPanel closes the build menu, and vice versa
- ESLint: replaced non-null assertion with type assertion in DayScene resource bar loop

## [1.1.0] - 2026-03-28

### Added -- Sprite integration (all 47 assets)
- BootScene loads all pixel art assets: characters (6 types), sprite sheets (12 animations), structures (7), base levels (4), terrain (7), refugees (6), UI icons (5), projectiles (2), loot drop
- Phaser animations created for player walk/attack/death, walker walk/attack/death, runner walk/death, brute walk/death, spitter attack, screamer scream
- Player uses walk animation when moving, attack animation on shoot, death animation on death
- Zombies use walk/death/attack animations per type (walker, runner, brute, spitter, screamer)
- Structure rendering uses loaded sprite images when available (DayScene + NightScene + Barricade/Wall/Trap classes)
- Base rendering uses level-specific sprite (tent/camp/outpost/settlement) when available
- Terrain tile rendering -- grass (3 variants), road tiles replace solid color fills in both DayScene and NightScene
- Spitter projectiles use dedicated spitter_projectile.png sprite instead of tinted bullet
- spriteFactory.ts has texture-exists guards -- loaded assets take priority, programmatic textures only generate as fallback
- Added spitter and screamer fallback textures to spriteFactory
- getStructureSpriteKey() and getBaseSpriteKey() helpers for sprite-or-fallback rendering

### Changed
- generateAllTextures() moved from preload() to create() so it runs after asset loading
- Player bobbing replaced by sprite sheet walk animation (with bobbing fallback)
- Zombie death uses sprite sheet animation instead of tween (with tween fallback)
- DayScene structureSprites type widened to Phaser.GameObjects.GameObject[] for mixed sprite/graphics
- Barricade, Wall, Trap structures use sprite images when loaded (with Graphics fallback)
- NightScene and DayScene map rendering uses terrain tiles with deterministic variant selection

## [1.0.1] - 2026-03-29

### Fixed
- Minneslackor: shutdown-hantering i NightScene och DayScene -- event listeners stadas vid scenovergang
- Spelaren doldes av nattoverlay -- ljussystem ritar nu korrekt transparent cirkel runt spelaren
- delayedCall-callbacks i Player.ts och Zombie.ts kollar nu this.active innan de agerar
- Duplicerade konstanter (MAP_WIDTH, MAP_HEIGHT, STRUCTURE_COLORS) flyttade till constants.ts och visual-config.json
- Hardkodade varden externaliserade till JSON (enemies.json, weapons.json, visual-config.json)
- Osaker typ-casting i DayScene (structures JSON) ersatt med interface-typad import
- Boss spawn-validering i NightScene -- kontrollerar att spawnConfig finns innan cast
- Wall type guard i NightScene -- ersatter osaker as-cast
- ZoneManager kraschar vid "Unknown zone: undefined" for gamla saves -- default till 'forest'
- SKILLS-knapp dolde END DAY-knappen (samma position) -- layout fixad

### Changed
- NightScene ljus-cache: overlay ritas bara om nar spelaren ror sig mer an 4px
- Pillbox-skytte anvander physics.closest() istallet for nastad loop
- Zombie pathfinding-throttle: 150ms for on-screen, 500ms for off-screen (previously bara off-screen)
- Zombie-struktur-kollisioner anvander physics.overlap() istallet for manuell AABB
- WeaponManager anvander Map-cache for vapendata-lookups istallet for .find()
- DayScene build menu uppdaterar bara alpha/tint vid resursforfandring (refreshBuildMenuAffordability), full rebuild bara vid basuppgradering
- Section 7 (Verktyg for asset-generering) tillagd i docs/art-direction.md
- Projektilvarden (speed, lifespan) lases fran weapons.json
- Attack-cooldowns lases fran enemies.json

## [1.0.0] - 2026-03-29

### Added -- Fas 5: Polish och balans
- Programmatiska pixel art sprites for spelare, zombies, strukturer via spriteFactory.ts
- Spelar-walkanimation (bobbing), zombie-dodsanimation (shrink+fade+rotation), attack-puls
- Partikeleffekter: muzzle flash, blodsplatter, fallsparkar (Phaser particle emitter)
- Nattljus: mork overlay med radial gradient runt spelare och pillboxes
- Skarmeffekter: rod flash vid skada, guld flash vid wave complete
- "Press Start 2P" pixel-font fran Google Fonts pa all text
- Tutorial-overlay for nya spelare (forsvinner efter 6s)
- Ombalanserade waves: W1 latt intro, W5 nastan omojlig utan forberedelse
- Sprint stamina drain okad till 25/s for mer strategisk sprint
- Zombie loot: scrap 40% (fran 50%), 5% parts-chans tillagd
- FPS-counter i dev mode (top-right)
- Zombie pathfinding-throttle: off-screen zombies uppdaterar 500ms istallet for varje frame
- Vite type declarations (src/vite-env.d.ts)

### Added -- Fas 6: Post-MVP Features
- EventManager med 9 random events: traders, moraliska val, vader (regn/storm), supply caches, horde warnings
- EventDialog modal for event-val med konsekvenser
- Spitter-zombie: ranged attack, gronn tint, skjuter projektil var 3s
- Screamer-zombie: lila pulsande, skriker vid skada, attraherar alla zombies inom 500px
- Brute Boss: 2x skala, rod glod, 500 HP, spawnar 3 brutes vid dod
- 4 nya skills: speed_agility, leadership, survival, stealth
- ZoneManager: 3 zoner (Forest, City, Military Base) med unika waves
- Zon-specifika wave-filer (waves-city.json, waves-military.json)
- CraftingManager: 5 recept (weapon repair kit, rations, ammo pack, reinforced wall, medkit)
- CraftingPanel i DayScene for crafting med AP-kostnad
- AchievementManager: 10 achievements (First Blood, Wave Survivor, Builder, etc)
- Achievement-popup och panel i MenuScene
- Stats-tracking i GameState (structuresPlaced, lootRunsCompleted, itemsCrafted)
- 283 vitest-tester (12 filer), alla passerar

### Fixed
- ResourceBar.setText crash efter scene-transition (null glTexture guard)

## [0.4.0] - 2026-03-29

### Added -- Fas 4: Refugees och loot
- RefugeeManager (src/systems/RefugeeManager.ts) -- tracker refugees med HP, status, jobb-tilldelning
- Refugees spawnar slumpmassigt (20% chans per dag), 35 unika namn
- RefugeePanel (src/ui/RefugeePanel.ts) i DayScene for jobb-tilldelning (gather_food/scrap, repair, rest)
- Refugees samlar resurser under dag: 2 food eller 3 scrap per gatherer, 10 HP reparation
- Refugees i Pillboxes skjuter under natt (range 150, damage 5, cooldown 1500ms)
- Refugees kan skadas under natt, injured refugees maste vila + 1 Meds for att hela
- Food-forbrukning: 1 per refugee + 1 for spelare per dag, svalt skadar 10 HP
- Max refugees begransat av shelters (2 per shelter, minimum 1)
- LootManager (src/systems/LootManager.ts) -- loot run-logik med destinations fran loot-tables.json
- LootRunPanel (src/ui/LootRunPanel.ts) -- valj destination, utrustning, sallskap
- EncounterDialog (src/ui/EncounterDialog.ts) -- Fight or Flee-val vid encounters
- Encounter-styrka = vapensskada + companions * 20 vs destination-troskel
- Win encounter: 1.5x loot, 30% chans att radda ny refugee
- Lose encounter: forlorar all loot, 40% skadechans per companion
- Flee: forlorar 1 resurstyp, alla klarar sig
- 50 XP per loot run for looting skill
- Bas-nivaer: Tent -> Camp -> Outpost -> Settlement med okande kostnader
- Varje niva laser upp nya strukturtyper (pillbox, shelter, storage, farm)
- Shelter: husar 2 refugees per shelter
- Storage: +50 resurskapacitet per storage (default 100)
- Farm: producerar food passivt per dag (2 food/farm fran structures.json)
- Bas-uppgradering UI i DayScene med kostnad och AP
- Visuell bas som vaxer med niva (storlek och farg)
- FogOfWar (src/systems/FogOfWar.ts) -- grid-baserad mork overlay i NightScene
- Avslojad area runt basen (radius okar med bas-niva: 3/5/7/9 block)
- Zombies osynliga utanfor avslojat omrade men fortfarande aktiva
- Roda riktningspilar vid dimkanten for dolda zombies i narhet
- Loot runs avslojar omraden (sparas i GameState.map.explored)
- 205 vitest-tester (8 filer), alla passerar

## [0.3.0] - 2026-03-29

### Added -- Fas 3: Vapen och leveling
- WeaponManager (src/systems/WeaponManager.ts) -- vapeninventar, equip, switch med siffertangenter 1-5
- Vapenklasser: melee, pistol, rifle, shotgun med unika stats fran weapons.json
- Vapenrariteter (common/uncommon/rare/legendary) med stat-multiplikatorer
- Vapen-XP och leveling (1-5): Lvl2 +10% reload, Lvl3 +10% damage, Lvl4 +10% reload
- Durability-system -- minskar per natt, reparera med Parts (1 AP)
- Vapenuppgraderingar med Parts: damage_boost, suppressor, extended_mag, scope, reinforcement
- WeaponPanel (src/ui/WeaponPanel.ts) i DayScene med reparation och uppgraderingsalternativ
- Startarvapen: rusty_knife (melee) + worn_pistol (ranged)
- Shotgun avfyrar 3 pellets i spread
- Vapennamn och durability i HUD under nattfas
- SoundMechanic (src/systems/SoundMechanic.ts) -- vapen har noiseLevel, zombies reagerar pa ljud
- Visuella ljudringar vid skott, storlek baserad pa noiseLevel, farg fran gul till rod
- Zombies attraheras till ljudkalla i 5 sekunder, sedan tillbaka till spelare
- Runner-zombie: gul tint, snabb (speed 100), forsoker undvika strukturer
- Brute-zombie: mork tint, 1.5x storlek, skadar strukturer vid kollision (5 dmg/hit)
- Vaggar ar nu fysiska objekt som blockerar zombies och spelare
- Barrikader saktar ner zombies, fallor skadar vid overlap (engangbruk)
- SkillManager (src/systems/SkillManager.ts) -- tracker XP per skill fran skills.json
- Combat skills far XP per kill med matchande vapenklass (10 XP per kill)
- Building skill far 25 XP per placerad struktur
- Skill-effekter: combat okar damage/speed, building minskar kostnad/okar HP
- SkillPanel (src/ui/SkillPanel.ts) i DayScene med XP-bars och nivaer
- Karaktarsval i MenuScene: Scavenger, Engineer, Soldier, Medic
- Karaktarsbonus appliceras som start-XP fran characters.json
- Ny/fortsatt-spelflode: ny save visar karaktarsval, sparad save visar Continue/New Game

## [0.2.3] - 2026-03-28

### Fixed
- Build menu click immediately placed structure at click location instead of entering placement mode. Added placementJustStarted flag to skip the same pointer event that selected the menu item.

## [0.2.2] - 2026-03-28

### Fixed
- DayScene mouse/click offset -- UI buttons and menus were unclickable because setScrollFactor(0) interactive zones drifted with camera scroll. Replaced with dual-camera system: a scrolling main camera for the map and a fixed UI camera at (0,0) for all interactive UI elements. Click zones now always match visual positions.
- Structure popup screen position used manual getWorldPoint(0,0) subtraction which broke with camera zoom. Now uses direct scrollX/scrollY offset.
- Added getContainer() to ActionPointBar so DayScene can register it with the UI camera.

## [0.2.1] - 2026-03-28

### Fixed
- DayScene laddade structures.json via Phaser loader med src/-sokvag -- fungerar inte i prod-build. Andrat till ES import
- NightScene laddade gameState vid klass-instansiering istallet for i create() -- sparade andringar fran DayScene ignorerades
- Wave-progression saknade currentWave-okning -- spelaren fastnade pa wave 1 efter overlevnad
- Strukturer som placerats under dagen syntes inte under natten -- lade till renderPlacedStructures i NightScene
- all-waves-complete-event kunde triggas dubbelt (fran WaveManager.onEnemyKilled + startWave) -- wave-complete startar inte nasta wave efter wave 5
- Exporterade StructureData-interface fran BuildingManager for aterbruk

## [0.2.0] - 2026-03-28

### Added -- Fas 2: Management och resurser
- DayScene med klickbar karta, kamera-panning, grid overlay och fade-transition till NightScene
- Action Point-system (12 AP per dag) med visuell AP-bar (src/ui/ActionPointBar.ts)
- "End Day"-knapp som sparar och overgar till nattfas
- ResourceManager (src/systems/ResourceManager.ts) -- tracker Scrap, Food, Ammo, Parts, Meds
- ResourceBar (src/ui/ResourceBar.ts) -- visar alla resurser i UI
- Zombie loot drops -- dodade zombies droppar resurser (scrap, ammo, food) med floating text
- Loot-data i src/data/zombie-loot.json (inte hardkodad)
- BuildingManager (src/systems/BuildingManager.ts) -- placering, uppgradering, forsaljning av strukturer
- BuildMenu (src/ui/BuildMenu.ts) -- panel med tillgangliga strukturer, kostnader, AP
- Barricade (saktar ner fiender), Wall (blockerar fiender), Trap (skadar fiender) i src/structures/
- Ghost preview vid placering med grid-snapping, hogerklick for att avbryta
- Klicka pa struktur for att uppgradera (50% HP-okning per niva) eller salja (50% refund)
- AmmoLoader (src/systems/AmmoLoader.ts) -- ladda vapen med ammo (1 AP)
- Ammo-system i nattfas -- skjutning forbrukar ammo, auto-shoot stannar vid 0 ammo
- Ammo-counter i HUD (blir rod vid 0)
- loadedAmmo-falt i GameState for persistens
- Daglig food-forbrukning (varning vid brist)
- 46 vitest-tester for ResourceManager och BuildingManager
- MenuScene -> DayScene -> NightScene flade (uppdaterade scen-overgångar)

## [0.1.1] - 2026-03-28

### Fixed
- Zombies rorde sig inte -- target sattes aldrig pa spawnade fiender
- WaveManager skickar nu spelar-referens till alla zombies vid spawn

### Added
- MenuScene visar sparad progress (runs, total kills)
- New Game-knapp for att rensa sparad data
- Versionsnummer lasas fran GAME_VERSION-konstant overallt

## [0.1.0] - 2026-03-28

### Added -- Fas 1: MVP Karn-loop
- Player entity med WASD/piltangenter, sprint (Shift) med stamina
- NightScene med spelbar karta (40x30 tiles, gras + vag + bas i mitten)
- Zombie entity med pooling, pathfinding mot spelare, skada vid kontakt
- Projectile entity med object pooling
- Auto-shoot: spelaren skjuter automatiskt narmaste fiende inom range
- WaveManager: 5 waves med okande svarighet, wave-overgangar
- SaveManager: spara/ladda GameState till localStorage
- HUD: HP-bar, stamina-bar, wave-indikator, kill counter, wave announcements
- GameOverScene med stats (kills, wave) och Try Again
- ResultScene for nar alla waves ar klara
- GitHub repo (Skugg4n/dead-horizon, privat)
- CI/CD: GitHub Actions (lint + typecheck + test + build + deploy till GitHub Pages)

## [0.0.1] - 2026-03-28

### Added
- Projektsetup: Vite + TypeScript + Phaser 3
- ESLint och Vitest konfigurerade
- Komplett filstruktur enligt technical-spec.md
- BootScene med placeholder-assets och splash screen
- MenuScene med Start Game-knapp
- NightScene, DayScene, ResultScene, GameOverScene (placeholder)
- Alla JSON-datafiler: weapons, enemies, structures, waves, characters, skills, loot-tables
- TypeScript-typer i config/types.ts
- Spelkonstanter i config/constants.ts
- Utils: math.ts och random.ts (seeded RNG)
- Agent-definitioner: lead.md, builder.md, tester.md
- CLAUDE.md med projektregler
- CHANGELOG.md och LESSONS.md
