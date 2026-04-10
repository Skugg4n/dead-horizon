# Dead Horizon -- Changelog

## [v6.20.0] - 2026-04-10 00:05 -- Persistent game log med prioritet

### Varfor
User-feedback: "Text som fladdrar forbi och forsvinner innan man hinner lasa.
Tex saker som 'inte funkar' pa banor och maste lagas." Viktiga varningar
(starvation, no ammo, boss incoming) drunknar i spam fran pickups och combos.

### Andringar
- `src/ui/GameLog.ts`: prioritetssystem med tre nivaer
  - `critical`: kritiska meddelanden (base damage, no ammo, boss, final wave,
    no fuel, starvation) behaller full farg oavsett alder och prefixas med '!'
  - `normal`: standard aldersbaserad dimning (som innan)
  - `spam`: pickups och combos dimmas dubbelt sa fort
- History-buffert okas fran 16 till 60 meddelanden
- T-tangent togglar expanderad vy (22 rader istallet for 8) sa man kan lasa
  allt som hant senaste stunden
- Liten `[T] log` hint i ovre hogra hornet av loggen
- NightScene och DayScene: T-key wire-up + kritiska call sites taggade med
  ratt prioritet (FINAL WAVE, BOSS INCOMING, No fuel, No ammo, starvation)

### Tekniskt
- `addMessage(text, color, priority?)`: bakat-kompatibel default 'normal'
- Critical entries ignorerar COLORS_BY_AGE helt
- Spam entries anvander `ageFromBottom * 2` som dim-index
- Expand/collapse gors genom att flytta bg-rectangel uppat och visa/dolja
  pre-skapade text-objekt (inga nya allocations vid toggle)

## [v6.6.0] - 2026-04-09 14:45 -- Tilemap rewrite: one source of truth for fysik och AI

### Varfor
Efter 15+ iterationer av AI-patchar sa insag vi att problemet var arkitekturellt:
det fanns TVA oberoende datastrukturer som beskrev samma varld -- `wallBodies`
(Phaser StaticGroup for fysik) och `PathGrid` (A* grid). Varje "fix" forsokte
halla dem synkade hand-rolled, men de kunde inte matcha perfekt. Varje patch
loste en symptom men avslojade en ny driftbug.

Losningen: EN Phaser Tilemap-layer som ar sanning for bade Arcade Physics
*och* A*. Kan inte drifta for det finns bara en datastruktur.

### Arkitekturandring
- **`collisionLayer`:** ny Phaser.Tilemaps.TilemapLayer, 40x30 tiles, osynlig.
  Tile-index 1 = blockerande, allt annat walkable. `setCollision(1)` gor att
  Arcade Physics automatiskt blockerar vid dessa tiles.
- **`tileToWall: Map<string, Wall | ...>`:** map fran "tx,ty" till Wall/ChainWall/
  ElectricFence/... instanser. Ersatter tidigare `wallBody.getData('wallRef')`.
- **`setBlockingTile(tx, ty, wall)` / `clearBlockingTile(tx, ty)`:** hjalpfunktioner
  i NightScene som stampar/tar bort tiles och synkar tileToWall.
- **`PathGrid.rebuildFromTilemap(layer)`:** lases fran layer.getTileAt().collides.
  Enda API:t som anvands nu -- rebuildFromPhysics + addColliderGroup ar legacy.

### Andrat
- **NightScene:**
  - `wallBodies` fielden borttagen. Ersatt av `collisionLayer`.
  - `createGroups()` skapar inte langre en static group -- istallet anropas
    `createCollisionTilemap()` som skapar tilemap-layern.
  - Alla 7 `case '<wall_type>'` i createStructures: `wallBodies.create(...) + getData()`
    ersatt av `setBlockingTile(tx, ty, wallInstance)`.
  - `naturalBlockerRects` (city ruins, bunkers) stampas in i tilemapen direkt
    efter createTerrain(). Gameplay-andring: ruins blockerar nu ocksa fysiskt
    (tidigare var de bara markerade i PathGrid, vilket gjorde att spelare kunde
    ga igenom dem men AI trodde de var blockerade -- en mismatch).
  - Physics colliders: `(zombieGroup, wallBodies)` och `(player, wallBodies)`
    ersatt av `(zombieGroup, collisionLayer)` och `(player, collisionLayer)`.
  - Collider callback laser upp Wall-instansen via `tileToWall.get(...)` istallet
    for `wallBody.getData('wallRef')`. Exakt samma beteende for brute-damage,
    ChainWall contact-damage, destruction + path rebuild.
  - Vid wall-destroy: `clearBlockingTile(tx, ty)` + `pathGrid.rebuildFromTilemap(layer)`.
- **PathGrid:**
  - `rebuildFromTilemap(layer)`: ny och preferred API.
  - `rebuildFromPhysics`, `addColliderGroup`, `addNaturalBlockers` och `BLOCKING_STRUCTURE_IDS`
    behalls som legacy/unused -- kan rensas bort i framtida commit om inget anvander dem.
- **Trees/stones:** forblir overlap-only (slow-zones via terrainResult.colliders).
  De stampas INTE in i tilemapen eftersom de inte blockerar fysiken. A* vet inte
  heller om dem; zombies plowar igenom trad saktare men fastnar inte pa dem
  (ingen permanent blockering).

### Checklist som kordes
1. Recon av alla wallBodies + PathGrid call sites: DONE
2. Design av tilemap-datamodel: DONE
3. Tilemap-infrastruktur (createCollisionTilemap, setBlockingTile, clearBlockingTile): DONE
4. Stampa naturalBlockerRects i tilemapen: DONE
5. Ersatta alla 7 wallBodies.create i createStructures: DONE
6. Physics colliders wiradte om till tilemapen: DONE
7. PathGrid.rebuildFromTilemap + anvandning i NightScene: DONE
8. Brute-damage-wall logik flyttad till tileToWall lookup: DONE
9. wallBodies-feltet + alla referenser borttagna: DONE
10. npx tsc --noEmit: 0 fel
11. npm run lint: 0 warnings
12. npx vitest run: 1127/1127 pass
13. Version bump + changelog + commit: DONE

### Testplan for anvandaren
1. Klicka [GRID]-knappen nere till vanster: alla walls + naturalBlockers ska vara rooda,
   INGET annat. Interior av fort ska vara walkable (inte rod).
2. Zombies ska kunna folja korridoren in i fortet utan att fastna.
3. Spelaren ska blockeras av egna murar. Kan ga ut genom oppningar.
4. Brutes ska kunna slo sonder vaggar (HP minskar, sedan destroyed).
5. Nar en vagg forstors mitt i natten ska tilen direkt bli walkable for zombies.

## [v6.5.0] - 2026-04-09 13:55 -- AI: single source of truth fran physics world

### Varfor
Hand-rollad sync mellan wallBodies, terrain-colliders och PathGrid ledde till
upprepade buggar dar AI-griden hade andra block an fysiken. GRID-overlay
visade att hela fortets interior var rod i griden trots att strukturerna dar
inte blockerade fysiken. Orsak: (1) off-by-one i addColliderGroup dar en body
pa exakt tile-grans markerade BADE tilen och nasta, (2) tva separata kodvagar
for att bygga griden (updateFromStructures + addColliderGroup) med olika
hardkodade regler.

### Andrat
- **PathGrid.rebuildFromPhysics(groups):** ny metod som scannar valfritt antal
  Phaser StaticGroups och markerar alla tiles som overlappas. Ingen hardkodad
  BLOCKING_STRUCTURE_IDS -- fysiken ar sanning.
- **Off-by-one fix:** bodies som slutar pa exakt tile-grans (t.ex. 32x32-vagg
  vid x=640, slutar pa 672) markerade tidigare BADE tile 20 och 21. Nu
  subtraheras EPS fran right/bottom innan floor.
- **NightScene:** bade init och wall-destroyed-handlern anropar
  `rebuildFromPhysics([wallBodies, terrainResult.colliders])`.
- **docs/ai-architecture-notes.md:** ny fil med anteckningar om framtida
  alternativ (Phaser Tilemap, Yuka.js). Designregel: aldrig tva oberoende
  datastrukturer for samma varld.

### Verifiering
- npx tsc --noEmit: 0 fel
- npm run lint: 0 varningar
- npx vitest run: 1127/1127 pass

## [v6.4.0] - 2026-04-09 09:30 -- AI: Tre verkliga rotorsaker till "stuck mot mur"

### Varfor
Trots body-shrink i v6.3.0/6.3.2 fastnade zombies fortfarande vid muren och nuddade
den i evighet. Tre faktiska bugar i PathGrid:

1. **Target-tilen kunde vara blockerad.** Om base center landade pa en wall/shelter-tile
   hittade A* aldrig nagon path till den. Resultat: fallback "ga rakt" som matar zombien
   in i narmaste vagg.
2. **Fallbacks cachades.** Nar A* misslyckades cachades den raka linjen i directionCache.
   Alla zombies pa den tilen fick samma trasiga riktning for evigt -- aven efter att
   griden andrats. Stuck-zombies forblev stuck eftersom de aldrig fragade om igen.
3. **Cache-key inkluderade inte target.** Om olika zombies hade olika targets (base vs
   player) blandades deras paths.

### Andrat
- **PathGrid.nearestWalkableTile():** ny spiral-search som hittar narmaste walkable
  tile till en blockerad target. Om base center sitter pa en wall, omdirigerar A*
  till narmaste oppning istallet.
- **getSteeringDirection():** anropar `nearestWalkableTile` om target ar blockerad.
- **Fallbacks cachas inte langre.** Endast lyckade A*-paths sparas. Misslyckade
  forsok aterforsoks varje frame -- om griden andras (vagg forstord) lar zombien
  sig direkt.
- **Cache-key inkluderar target-tile:** `${fx},${fy}->${tx},${ty}` istallet for bara
  start. Multipla targets stor inte varandra.
- **DayScene debug button: CLEANUP FAR STRUCTURES.** Tar bort alla structures som ar
  > 250px fran map center. Anvands for att rensa gamla save-contamination (BG7) dar
  spelaren har structures kvar fran en tidigare bug-version.

### Verifiering
- npx tsc --noEmit: 0 fel
- npm run lint: 0 varningar
- npx vitest run: 1127/1127 pass

## [v6.3.2] - 2026-04-09 09:18 -- AI: ytterligare body-shrink + duplikerings-debug

### Varfor
Efter v6.3.1 ser zombies smarta ut pa langt hall (rundar hornen, soker ingang) men
fastnar fortfarande pa kant-edges nar de ska in i en 1-tile-bred korridor. Med 20x20
body fanns bara 12px slack i en 32px-korridor -- inte tillrackligt for diagonal
inkomning utan att skrubba en horn-pixel.

### Andrat
- **Player + Zombie body: 20x20 -> 16x16.** 16px slack pa varje sida i en
  tile-bred korridor. Generost nog att spelare/zombie kan komma in fran nagon
  vinkel utan att snaga.
- **NightScene debug-dump:** vid varje night-start dumpas alla structures
  (totalt antal, dubletter pa exakt samma position, och structures med samma id
  pa flera positioner). Hjalper diagnostisera duplikerings-buggen anvandaren
  rapporterar (BG7-uppdatering).

### Verifiering
- npx tsc --noEmit: 0 fel
- npm run lint: 0 varningar
- npx vitest run: 1127/1127 pass

## [v6.3.1] - 2026-04-09 09:10 -- AI del 2: PathGrid kände inte till träd

### Varfor
v6.3.0 fixade vagg-gap men zombies fastnade fortfarande bakom trad och stenar.
Rotorsak: PathGrid (A*) registrerade BARA structures (vaggar) och naturalBlockerRects
(building ruins / bunkers i City/Military). Forest-trad och stora stenar har Phaser
physics colliders men finns INTE i pathfinding-griden. Resultat: A* plottar en rak
vag mot basen, zombien gar in i trad, fastnar, springer i cirkel.

### Andrat
- **PathGrid.addColliderGroup():** ny metod som scannar en Phaser StaticGroup och
  markerar varje physics body's tile-cells som unwalkable.
- **NightScene.create():** kallar `pathGrid.addColliderGroup(terrainResult.colliders)`
  efter `addNaturalBlockers()`. Nu vet A* om alla trad, stenar och andra terrain-blockers.

### Verifiering
- npx tsc --noEmit: 0 fel
- npm run lint: 0 varningar
- npx vitest run: 1127/1127 pass

## [v6.3.0] - 2026-04-09 08:55 -- ROTORSAK till AI-buggen: collision-box = tile-storlek

### Varfor
Efter manga iterationer av A*/BFS/PathFinding.js var AI:n fortfarande traslig. Spelaren
kunde inte heller ga ut genom hal i sin egen mur. Efter ordentlig undersokning visade det
sig att DET ALDRIG VAR ETT PATHFINDING-PROBLEM.

**Rotorsak:** bade Player och Zombie saknade `setSize()` pa sin fysik-body. Default-body
= sprite-storlek = **32x32**, exakt samma som en vagg-tile. Ett 1-tile-gap i en mur ar
32 pixlar. Spelarens/zombiens kropp ar 32 pixlar. Dom ar exakt lika breda som hal.
Minsta osynk pa subpixel-niva = kollision = fast. A* kunde inte losa det -- den raknade
ut korrekta vagar, men fysiken forbjod dom att foljas.

### Andrat
- **src/entities/Player.ts:** `body.setSize(20, 20)` + `setOffset(6, 6)` centrerat.
  Ger 6px slack pa varje sida nar spelaren gar igenom en 1-tile-oppning.
- **src/entities/Zombie.ts:** samma -- 20x20 kropp centrerat i 32x32 sprite.
  Detta ar fixen som **faktiskt** far zombies att foljja A*-paths genom smala oppningar.
  Bossar med scale=2 far effektivt 40x40 -- kan fortfarande inte ga igenom 1-tile-gap,
  vilket ar bade ratt och balancemessigt bra.

### Verifiering
- npx tsc --noEmit: 0 fel
- npm run lint: 0 varningar
- npx vitest run: 1127/1127 pass

## [v6.2.0] - 2026-04-09 08:50 -- Robust dual-slot save system + nya buggar loggade

### Varfor
Save-systemet har wipat spelarens progress flera ganger (rapporterat upprepat). Istallet for
att jaga en specifik rotorsak har vi nu ett defensivt dubbelspars-system som skyddar spelaren
aven om en framtida bug skulle forsoka skriva over en bra save med default-liknande data.

### Andrat
- **SaveManager.ts:** Dubbelspars-system med tre slots:
  - `dead-horizon-save` (primary)
  - `dead-horizon-save-backup` (foregaende primary, roteras vid varje save)
  - `dead-horizon-save-safe` (senaste "known-good" snapshot, uppdateras endast nar det ser
    ut som riktig progress -- byggda structures, refugees, extra vapen, wave > 1 etc.)
- **Skydd mot wipe:** `save()` vagrar skriva over en befintlig save som ser ut som riktig
  progress med en state som ser "default-lik" ut. Sista forsvarslinjen.
- **Robust load:** `load()` provar primary -> backup -> safe i ordning. Varje slot parsas
  och hydrereras separat. Forsta slot med riktig progress vinner, och den "laker" primary
  om den behovde fallback. Om ingen slot har progress, returneras forsta parsebara slotten
  som-ar. Endast om allt failer returneras defaults.
- **Version:** bumpad till 6.2.0.

### Buggar som loggats till docs/known-bugs.md
- **BG4:** Spelaren kan inte ga ut genom ett hal i muren -- osynlig vagg i hal. Troligt
  collider-mismatch eller orensad collision-shape nar structure rivs. EJ FIXAD.
- **BG5:** Nunchucks-XP-progression oklar. UI visar inte weapon.xp/needed sa spelaren vet
  inte att Lv3->Lv4 kraver 50 kills och Lv4->Lv5 kraver manuell ULT-unlock. EJ FIXAD.

## [v6.1.0] - 2026-04-04 00:20 -- Bug fixes + polish: kill attribution, pickup spam, blueprint unlocks, combo hint, settings, crafting armor/shields

### Varfor
7 bugs och polish-items: DOT-kills utan kill source gav console.warn-spam, pickup-log overfloedade,
pickup-etiketter var for stora, blueprints visade inte vilka fallor de laser upp, combo-tutorial
saknades, settings-panelen hade inga volymsreglage, och ingen kunde crafta armor/shields.

### Andrat

- **Bug 1 (NightScene.ts):** zombie-killed med null _currentKillSource attributeras nu korrekt.
  Ny hjalp-metod `findDotTrapAtPosition()` kollar om zombien stod i en DOT-zon (Glass Shards,
  Fire Pit, Tar Pit) och attributerar till trap om sa ar fallet. Annars weapon. Ingen console.warn.
- **Bug 2 (NightScene.ts):** pickup-spawned loggar max 3 meddelanden per natt. Kamera-flash och ljud
  spelar fortfarande for varje pickup (obegransat). Raknar i `_pickupLogCount`, nollstalls i create().
- **Bug 3 (NightPickupManager.ts):** Pickup-etikett fontSize 6px -> 7px, color #FFFFFF -> #888888,
  strokeThickness 2 -> 1. Mindre, nedtonad etikett som inte tar fokus fran spelet.
- **Polish 4 (LootRunPanel.ts):** Blueprint-fynd visar nu blueprint-namn fran blueprints.json samt
  "Unlocks: [trap1], [trap2]" fran `unlocks`-faeltet. Blueprintbox hoejd oekad till 72px.
  blueprintsJson importerat och indexerat i blueprintMap vid modulinitiering.
- **Polish 5 (NightScene.ts):** Forsta gangen en combo triggar (per session) visas en GameLog-hint:
  "TRAP COMBO! Place different traps near each other for +50% damage!". Flagga lagras i static
  `_comboTutorialShown` (nollstalls bara vid page reload, inte per natt).
- **Polish 6 (AudioManager.ts, MenuScene.ts):** Settings-panelen har nu Master Volume, SFX Volume
  och Music Volume med [-]/[+]-knappar, samt SFX Enabled, Music Enabled och Mute All-toggles.
  Instaellningar sparas automatiskt till localStorage (nyckel: dead-horizon-audio-settings) och
  laddas vid initOnInteraction(). Nya AudioManager-funktioner: setMasterVolume, getMasterVolume,
  setSfxVolume, getSfxVolume, setMusicVolume, getMusicVolume, loadSettings, saveSettings.
- **Polish 7 (recipes.json, CraftingManager.ts, CraftingPanel.ts, types.ts):** Tva nya recept:
  "Improvised Plate" (5 scrap + 2 parts + 2 AP) -> armor improvised_plate,
  "Trash Can Lid" (3 scrap + 1 AP) -> shield trash_can_lid.
  CraftingManager hanterar craft_armor och craft_shield result-typer.
  RecipeData.result far valfritt faelt `itemId?: string`.
  CraftingPanel visar "Craft: Improvised Plate" resp. "Craft: Trash Can Lid" som result-beskrivning.
- **constants.ts:** GAME_VERSION 6.0.0 -> 6.1.0

### Versioner
- `src/config/constants.ts`: GAME_VERSION 6.0.0 -> 6.1.0

## [v5.8.0] - 2026-04-04 14:40 -- Redesigned toolbar icons + upgrade path visualization in EquipmentPanel

### Varfor
Toolbar-ikonerna var abstrakta och svara att tolka. EquipmentPanel visade tier-info som ren text
utan att ge spelaren en tydlig bild av hela uppgraderingskedjan. Bada delarna behavde visual polish.

### Andrat

- **Fix 1 (public/assets/sprites):** 6 nya 32x32 RGBA pixel art-ikoner genererade med Pillow:
  - `icon_build.png` -- hammare + spik (gron accent)
  - `icon_weapons.png` -- skoeld + svaerd korsade (orange accent)
  - `icon_craft.png` -- kugghjul + skiftnyckel (gul accent)
  - `icon_lootrun.png` -- ryggsack med karta-X (brun/gul accent)
  - `icon_refugees.png` -- personsilhuett med hjarta (lila accent)
  - `icon_endday.png` -- maane + stjarnor + rod END-strip (morkbla bakgrund)
- **Fix 2 (EquipmentPanel.ts):** Upgrade path ersatter gammal "Tier: Enhanced (Lv3/5)"-text.
  Visar 5 rutor i en rad: grona bockar for avklarade niver, gul highlight-ram for nuvarande,
  gra text for framtida, guld ★ ULT for niva 5. Bojr under vapennamnet i hogerpanelen.
- **Fix 2 (EquipmentPanel.ts):** Om vapnet ar Lv4: blinkande gul text "ULTIMATE available! (XP YS)"
  visas under upgrade path med tweened alpha-blink (600ms yoyo).
- **Cleanup (EquipmentPanel.ts):** Borttagna oanvanda symboler `TIER_NAMES`, `weaponTierLabel`
  (funktionaliteten ar nu inbyggd i buildUpgradePath()).
- **constants.ts:** GAME_VERSION 5.7.0 -> 5.8.0

### Versioner
- `src/config/constants.ts`: GAME_VERSION 5.7.0 -> 5.8.0

## [v5.7.0] - 2026-04-04 14:22 -- 8 UX improvements: scrap buttons, weapon tiers, hover comparison, toolbar labels, shelter/refugee clarity

### Varfor
Feedback-driven UX-polish: armor och shields saknade [S]-knappar, vapenniver visades inte i listan,
upgradenamn var generiska, armor/shield-hover saknade jamforelse, toolbar-knappar hade inga labels,
shelter-beskrivningen var oklar, rescue failure visades inte, och hogerpanelen trunkerade text.

### Andrat

- **Fix 1 (EquipmentPanel):** [S] scrap button lagd till armor- och shield-rader i ARMOR/SHIELDS-tabbar (samma varden som vapen: common +2S+1P, uncommon +3S+2P, rare +5S+3P).
- **Fix 2 (EquipmentPanel):** Vapenniva visas nu i inventarielistan: "Name [R] Lv3 D:25". Lv1-2 vit, Lv3-4 gul, Lv5 guldstjarnan.
- **Fix 3 (EquipmentPanel):** Tier-namn i hogerpanelen: Stock/Modified/Enhanced/Superior/ULTIMATE. Visar aven "Next: Enhanced (needs 25 XP)" eller "ULTIMATE available! (15P 5S)" vid Lv4.
- **Fix 4 (EquipmentPanel):** Hover-jamforelse for armor (Reduction %, Speed %) och shield (Block hits, Cooldown, Speed). Gront = battre, rott = samre.
- **Fix 5 (DayScene):** Textlabels under toolbar-ikoner: "BUILD", "EQUIP" osv. 5px font, muted farg (#555555), depth 100.
- **Fix 6 (structures.json, RefugeePanel):** Shelter-beskrivning uppdaterad: "Houses 2 refugees. Build to rescue more." Camp Crew-panel visar nu kapacitetskalla: "Capacity: 2 shelters x2 = 4 max".
- **Fix 7 (DayScene):** Nar rescue-event sker men lager ar fullt: "No room! Build more shelters." i GameLog (rod farg).
- **Fix 8 (EquipmentPanel):** All text i hogerpanelens vapendisplay anvander wordWrap eller fixedWidth for att undvika trunkering.

### Versioner
- `src/config/constants.ts`: GAME_VERSION 5.6.2 -> 5.7.0

## [v5.6.0] - 2026-04-04 -- Sprites for all 43 missing structures

### Varfor
DayScene renderade fargar+initaler for alla strukturer som saknade sprites. Nu har samtliga
43 strukturer/fallor i structures.json egna 32x32 pixel art-sprites i post-apokalyptisk stil.

### Andrat

**Nya sprite-filer (public/assets/sprites/)**
Primitive: struct_cart_wall, struct_nail_board, struct_trip_wire, struct_glass_shards,
struct_tar_pit, struct_glue_floor, struct_shopping_cart_wall, struct_car_wreck_barrier,
struct_dumpster_fortress.
Machine: struct_blade_spinner, struct_fire_pit, struct_propane_geyser, struct_washing_cannon,
struct_shock_wire, struct_spring_launcher, struct_chain_wall, struct_circle_saw_trap,
struct_razor_wire_carousel, struct_lawnmower_lane, struct_treadmill_of_doom, struct_pendulum_axe,
struct_garage_door_smasher, struct_bug_zapper_xl, struct_car_battery_grid, struct_electric_fence,
struct_net_launcher, struct_meat_grinder, struct_belt_sander_gauntlet, struct_power_drill_press,
struct_piano_wire_web, struct_combine_harvester, struct_car_bomb, struct_napalm_sprinkler,
struct_gas_main_igniter, struct_flamethrower_post.
Heavy/Combo: struct_tractor_wheel_roller, struct_wrecking_ball, struct_log_avalanche,
struct_falling_car, struct_treadmill_blades, struct_fan_glass, struct_elevator_shaft,
struct_rube_goldberg.

**src/scenes/BootScene.ts**
- Rattade 6 befintliga trap-laddningar (fel stig nail_board.png -> struct_nail_board.png etc)
- Lade till 43 nya this.load.image()-anrop for alla nygenererade sprites

**src/config/constants.ts**
- GAME_VERSION bumpad till 5.6.0

---

## [v5.5.0] - 2026-04-04 16:00 -- BFS flowfield zombie-navigation + glass_shards zone nerf

### Varfor
Zombies fastnade mot vaggar eftersom den lokala probe-algoritmen bara sag 2-3 tiles bort
och missade oppningar langre bort. Ersatt med BFS flowfield som ger varje cell en
exakt riktning mot basen langs kortaste vagen.

### Andrat

**BFS flowfield (src/systems/PathGrid.ts)**
- Ny metod `computeFlowfield(targetX, targetY)`: BFS fran basens centrum utåt
- Varje cell i gridet (40x30 = 1200 celler) far en riktningsvektor (dx, dy) mot narmaste vag till basen
- Blockerade celler (vaggar) hoppas over -- BFS gar naturligt runt hinder
- Resultat: `Float32Array` med 2 floats per cell, O(1200) per BFS-kor, ca 0.1ms
- Ny metod `rebuildFlowfield(baseCenterX, baseCenterY)`: anropas fran NightScene vid strukturandring
- `getSteeringDirection()` slar nu upp zombiens cell i flowfieldet (O(1)) istallet for att proba 9 riktningar
- Fallback till lokal probe-algoritm om flowfield saknar data for cellen (zombie inuti vagg, omringad)
- Gamla `getSteeringDirection()` API behollet -- Zombie.ts andrades inte

**NightScene.ts -- flowfield rebuild triggers**
- Anropar `pathGrid.rebuildFlowfield()` direkt efter `updateFromStructures()` + `addNaturalBlockers()` i create()
- Anropar `updateFromStructures()` + `addNaturalBlockers()` + `rebuildFlowfield()` nar en vagg forstors
  (i wall-collider callback, direkt efter `wallBody.destroy()`)

**Glass Shards nerf (src/data/structures.json)**
- `zoneRadius`: 96 -> 64 (ca 2 tiles istallet for 3)
- Description uppdaterad: "5 dmg/s in zone (~96px)" -> "5 dmg/s in zone (~64px)"

### Version
- GAME_VERSION: 5.4.0 -> 5.5.0 (src/config/constants.ts)

---

## [v5.4.0] - 2026-04-04 -- Bugfixar: boss/wall collision, top-bar overlap, inventory refresh, scrap, tooltip, right panel

### Varfor
11 buggar fixade i NightScene (boss vagger), DayScene (top-bar overlap, base-upgrade popup),
EquipmentPanel (inventory stale data, per-weapon scrap-knapp, tooltip over row-overlap, right panel texttruncation).

### Andrat

**Bug 5 -- Boss vs walls: cap structure damage per hit (src/scenes/NightScene.ts)**
- Lade till `cappedDamage = Math.min(zombie.structureDamage, 15)` i wall-collision callback
- Lade till `wallRef.active`-guard innan takeDamage() for att undvika double-destroy
- Militar-tank (20 dmg) och forest_boss (12 dmg) behovde nu minst 10 resp. 15 sekunders konstant tryck for att forstaraga en ny vagg (150 HP)

**Bug 7+8+10 -- DayScene top-right text overlap (src/scenes/DayScene.ts)**
- `createBaseUpgradeUI()`: tog bort UPGRADE-knapp fran top bar (Bug 9)
- `createZoneSelector()`: ZONE-label flyttad till y=22, zon-lista borjar vid y=36 (fran y=42/54)
- Dubbel base-level-text i top bar borttagen (knappen visades som text bredvid basnamnet)

**Bug 9 -- UPGRADE via base click (src/scenes/DayScene.ts)**
- Lade till `showBaseUpgradePopup()` -- visar upgrade-cost och confirm-knapp i popup-container
- `setupInput()`: detekterar klick pa bas-omradet (basHalfSize + 8px hotspot) och anropar showBaseUpgradePopup()
- Samma monster som showStructurePopup() -- anvander structurePopup-containern

**Bug 11+12 -- Inventory stale data (src/ui/LootRunPanel.ts + src/ui/EquipmentPanel.ts)**
- LootRunPanel emittar `inventory-changed` event efter loot run avslutas
- EquipmentPanel lyssnar pa `inventory-changed` och anropar rebuild() nar panelen ar synlig
- Cleanup av event-lyssnaren registreras i shutdown-handlern

**Bug 13 -- Per-weapon [S] scrap-knapp (src/ui/EquipmentPanel.ts)**
- Varje icke-utrustad vapen-rad har nu en [S]-knapp langst till hoger
- Klick skrotar vapnet och ger scrap/parts baserat pa raritet (SCRAP_VALUES)
- rowBg interactive-area minskas med scrapBtnW (20px) sa klick pa [S] ej triggar equip

**Bug 14 -- Hover comparison ovanfor raden (src/ui/EquipmentPanel.ts)**
- `showWeaponComparison()` beraknar nu `ty = rowPanelY - ttH` (ovanfor) istallet for nedanfor
- Klamras till HEADER_H + 4 sa tooltip aldrig hamnar ovanfor panelen

**Bug 15 -- Right panel text truncation (src/ui/EquipmentPanel.ts)**
- Vapennamn + raritet: lade till `wordWrap: { width: w }` i buildEquippedWeaponSlot()
- DUR-text: `fixedWidth: w / 2` for att begranasa hoger-alignerad text

**Test -- RefugeeManager.test.ts**
- Uppdaterade `getPillboxRefugees`-testet for att matcha v5.3+ Camp Crew-beteende
  (alla friska refugees kan bema pillboxar, inte bara de med job='pillbox')

---

## [v5.3.0] - 2026-04-04 -- Bugfixar: armor/shield drops, secondary weapon equip, HUD layout

### Varfor
Fyra buggar fixade: LootManager saknade armor/shield-drops trots att data fanns i loot-tables.json,
EquipmentPanel equipade alltid till primary-slot, HUD hade overlappande element och minimap satt for hogt,
barricade slow verifierades som korrekt implementerad.

### Andrat

**Bug 1 -- LootManager: armor/shield drops (src/systems/LootManager.ts)**
- Lade till `foundArmorId: string | null` och `foundShieldId: string | null` i `LootResult` interface
- Lade till `ArmorDropEntry` och `ShieldDropEntry` interface-typer
- Importerade armor.json och laddade `armorDataList` / `shieldDataList`
- Implementerade `rollArmorDrop(destinationId)` och `rollShieldDrop(destinationId)` -- samma monster som `rollWeaponDrop`
- I `executeLootRun()`: anropar bada roll-metoderna, skapar `ArmorInstance` / `ShieldInstance` och laggar till i `gameState.inventory.armorInventory` / `shieldInventory`
- `LootRunPanel.ts`: visar "Armor found:" och "Shield found:" i resultatskarm

**Bug 2 -- EquipmentPanel: secondary weapon equip (src/ui/EquipmentPanel.ts)**
- Lade till `selectedSlot: Slot = 'primary'` state pa klassen
- Vapenslot-labels i hoger panel ar nu klickbara -- klick valjer vilken slot som ar aktiv
- Aktiv slot markeras med orange farg och "[ACTIVE]" indikator
- Vapenklick i vanster lista equipar nu till `selectedSlot` (primary eller secondary)
- "Equipping to: PRIMARY [1]" / "SECONDARY [2]" text visas ovanfor vapenlistan

**Bug 3 -- HUD layout (src/ui/HUD.ts, src/ui/MiniMap.ts)**
- Stamina-bar: gjord smalare (70px istallet for 100px), `STAMINA_H` reducerad till 6px
- Wave panel: breddad till 160px (fran 140px) och positionerad striktare centralt
- BASE-sektion: marginal okad till 16px fran kartanten (fran 8px), bar-bredd 110px
- Minimap: flyttad till y=48 (fran y=40) sa den hamnar under top bar utan overlap

**Bug 4 -- Barricade slow (verifierad, ingen andring behovdes)**
- `checkZombieStructureInteractions()` tillampjar `body.velocity.x *= factor` varje frame
- Fungerar korrekt eftersom zombie-AI satter sin velocity varje frame, och barricade-faktorn (0.5) sedan appliceras -- effektiv hastighet halveras medan zombien ar inuti en barricade

## [v5.2.0] - 2026-04-04 -- EquipmentPanel fullstandig omskrivning: dual-panel inventory

### Varfor
EquipmentPanel var en smal (360px) enkelpanelslista som inte utnyttjade skarmutrymmet och saknade armor/shield-tabs. Uppgiften var att skriva om den till ett brett dual-panel-system med tabbat inventory till vanster och utrustningsoversikt till hoger.

### Andrat
- **EquipmentPanel.ts fullstandig omskrivning**:
  - Bredden okad till 700px (Math.min(GAME_WIDTH - 16, 720)) -- egen bakgrund, ej UIPanel
  - Depth 250+ (ovanpa GameLog), centrerad pa skarm
  - LEFT panel (320px): tabbat inventory WEAPONS | ARMOR | SHIELDS
    - Varje tab visar kompakt lista (EN rad per item med rarity-farg)
    - 8 items per sida med [<] [>] pagination
    - Klick pa item = EQUIP direkt (ersatter nuvarande primary/secondary)
    - Klick pa redan equipped item = oppnar upgrade-vy
    - [SCRAP ALL COMMON] knapp nar common-vapen finns
  - RIGHT panel: utrustningsoversikt
    - Karaktarsportrait + namn
    - PRIMARY / SECONDARY slot med fulla stats, DUR-fargar (rod/gul/gron)
    - Special-effekt-rad och mod-sammanfattning per vapen
    - ARMOR / SHIELD slot med unequip-knappar
    - Stats-sektion: total DMG reduction, speed penalty, ammo
    - UNEQUIP / REPAIR / UPGRADE / SCRAP knappar per slot
  - Hover comparison: DMG/RNG/DUR jamfort mot equipped primary, gront = battre, rott = samre
  - Upgrade-vy: hel bredd (kvar fran gamla panelen), [ BACK ] returnerar till dual view
  - Backward compatibility: getContainer(), toggle(), getPanel().getBackdrop(), rebuild(), isVisible(), handleKey(), autoEquipIfNeeded() -- alla bevarade
  - PanelShim-klass: DayScene.addToUI(panel.getPanel().getBackdrop()) fungerar utan andring
- GAME_VERSION: 5.2.0

## [v5.1.0] - 2026-04-04 -- Armor/Shield system + Floating damage numbers

### Varfor
Spelet saknade ett utrustningssystem for skydd utover vapen. Spelaren hade ingen visuell feedback pa skada i realtid. Bada systemen laggs till nu.

### Andrat
- **DEL 1: Armor System**
  - Ny datafil: src/data/armor.json med 10 armor + 5 shields (common/uncommon/rare/legendary)
  - GameState.inventory.armorInventory + shieldInventory lagts till (ArmorInstance[], ShieldInstance[])
  - GameState.equipped.equippedArmor + equippedShield lagts till (string | null)
  - Player.ts: nya fields armorReduction, armorSpeedPenalty, shieldBlocksLeft, shieldCooldown
  - Player.takeDamage(): armor reduction appliceras forst, sedan shield block (blatt blixt-flash)
  - Player.equip(): NightScene anropar denna vid nattstart for att applicera utrustningens stats
  - Player.update(): shield cooldown tickar ner, laddar om block-charge nar cooldown noll
  - Speed: multipliceras med (1 + armorSpeedPenalty) som stackar armor + shield
  - NightScene: applyArmorEquipment() laser equippedArmor/equippedShield fran gameState
  - NightScene: decreaseArmorDurability() minskar nightsRemaining pa equipped armor vid nattslut
  - EquipmentPanel: ny ARMOR & SHIELD-sektion under storage-listan med equip/unequip-knappar
  - loot-tables.json: armor och shield drops tillagda med destinations per destination-id
  - SaveManager: migration for armorInventory, shieldInventory, equippedArmor, equippedShield
  - PackYourBagScene: equipped-objektet uppdaterat med armor/shield falt

- **DEL 2: Floating Damage Numbers**
  - NightScene.showDamageNumber(): liten 8px text som flyr uppat och tonar ut (600ms, Power2)
  - Max 20 aktiva damage numbers samtidigt (_activeDamageNumbers counter + MAX_DAMAGE_NUMBERS=20)
  - Rod text (-N) for trap-treffar (applyTrapDamage)
  - Orange text (-N) for melee-treffar (shootAt default melee)
  - Vit text (-N) for ranged-treffar (projectil-zombie overlap)
  - Rod text (-N) for zombie-attack pa spelaren (zombieGroup overlap)
  - Guld "COMBO -N!" floater ersatter det gamla enkla "COMBO!"-floatern (showComboFloater)
  - Combo-flagga isCombo forebygger dubbla floaters per combo-treff

- GAME_VERSION: 5.1.0

## [v4.9.1] - 2026-04-04 -- Kod-audit runda 2: tab-sortering, endless-HUD, kod-rensning

### Varfor
Andra audit-rundan identifierade misplacerade strukturer i BuildMenu-flikar, forvirrande "Night N / N" i Endless mode, och onodiga console.log-anrop i hot path.

### Andrat
- **BuildMenu tab-fix**: getTabForStructure() kontrollerar nu BASIC_TRAP_IDS FORE category='special'. bear_trap, landmine, oil_slick hamnar nu korrekt i BASIC-fliken (de hade category='special' men ar primitiva fallor).
- **BuildMenu tab-fix 2**: heavy- och combo-kategorier (tractor_wheel_roller, wrecking_ball, log_avalanche, falling_car, treadmill_blades, fan_glass, elevator_shaft, rube_goldberg) hamnar nu i MACHINES-fliken istallet for WALLS.
- **HUD Endless mode**: Nytt setEndlessNight(n) visas "Endless -- N1" istallet for forvirrande "Night N / N".
- **NightScene**: Borttagen verbose console.log per struktur i createStructures() -- loggade varje placering i hot path vid nattstart.
- **ZoneCompleteScene**: Borttagen console.log pa zoneProgress vid zone completion.
- GAME_VERSION: 4.9.1

## [v4.9.0] - 2026-04-04 -- 8-fix audit: UI, visuals, balans och UX

### Varfor
Audit identifierade 8 konkreta problem: overbelagd TRAPS-flik, CraftingPanel utan scroll, avsaknad av post-apokalyptisk fargstil, inkonsekvent trap-grafik, saknad pickup-notifiering, otydlig refugee-panel, for dyr Combine Harvester och for ljust Glass Shards.

### Andrat
- **Fix 1 (BuildMenu)**: TRAPS-fliken delad i 4 flikar: BASIC, MACHINES, WALLS, SPECIAL. TabName-typ och getTabForStructure() uppdaterade.
- **Fix 2 (CraftingPanel)**: Pagination med MAX_VISIBLE_RECIPES=5 och scroll-knappar, scrollOffset per toggle.
- **Fix 3 (Fargstil)**: NightScene: blagron overlay (alpha 0.04). DayScene: sepia overlay (alpha 0.03).
- **Fix 4 (Trap-grafik)**: Barricade, Wall, SpikeStrip, Sandbags, Landmine, BearTrap, OilSlick far idle alpha-pulse tweens.
- **Fix 5 (Pickup-ping)**: pickup-spawned event i NightPickupManager. NightScene: GameLog, kamera-flash, ui_click-ljud.
- **Fix 6 (Refugee-panel)**: Dagliga bonusar visas, hjalp-rad lagd langst ned.
- **Fix 7 (Combine Harvester)**: Kostnad 15S 6P (fran 20S 8P) i structures.json.
- **Fix 8 (Glass Shards)**: Sparkle dimmare: alpha 0.5, farg 0x4488AA.
- GAME_VERSION: 4.9.0

## [Unreleased] - 2026-04-04 -- Trap combo-system + balansering av fallor

### Varfor
Fallor med olika effekter (stun+damage, slow+zone) bor belona strategisk placering. Combo-systemet uppmuntrar spelaren att kombinera falltyper. Balansandringar gor overstarkt laga-kostnadsfallor rimligare och minskar underhallskostnaden for Meat Grinder.

### Tillagt
- **Trap Combo System**: Nar en zombie traffas av en falla och sedan av en ANNAN falltyp inom 2 sekunder utloses COMBO -- 1.5x damage + "COMBO!" floater-text vid zombiepositionen (gul, fader pa 500ms)
- `lastTrapHitTime`, `lastTrapType`, `comboActive` lagda till Zombie.ts for O(1) combo-detektering
- `applyTrapDamage(zombie, trapType, damage)` -- central hjalp-metod i NightScene hanterar combo-logik och kill-source-taggning for alla falltyper (18+ anropsplatser)
- `showComboFloater(x, y)` -- tweened text vid zombiepositionen
- `comboCount` i NightStats och ResultScene: "Combos triggered: N"
- BuildMenu sortering: `getFilteredItems()` sorterar nu billigast forst (totalvarde av resurskostnad)

### Balanserat
- **Combine Harvester**: kostnad 20S 8P -> 15S 5P (legendary ska kanna vard det)
- **Propane Geyser**: damage 40 -> 30 (for starkt for 4S kostnad)
- **Spring Launcher**: damage 40 -> 30 (for starkt for 4S kostnad)
- **Car Bomb**: kostnad 15S 5P -> 12S 4P (engangsfalla, bor vara billigare)
- **Meat Grinder**: fuel 2 -> 1 food/natt (for dyrt att underhalla)

### Tekniskt
- Alla inline `_currentKillSource = 'trap'` / `zombie.takeDamage()` / `_currentKillSource = null` monstren ersatta med `applyTrapDamage()` -- cleaner och korrekt kill-tracking
- TypeScript strict: inga `any`-typer
- 1127 tester: alla grona

## [v4.8.0] - 2026-04-04 -- 14 nya melee-vapen i weapons.json och loot-tables.json

### Varfor
Utoka vapensortimentet med fler melee-alternativ fordelade pa common, uncommon, rare och legendary. Ger spelaren mer taktisk variation tidigt och sent i spelet.

### Tillagt
- **Common melee** (5 vapen): Frying Pan, Garden Spade, Lead Pipe, Kitchen Cleaver, Door Frame
- **Uncommon melee** (5 vapen): Katana (uncommon, id katana_uncommon), Fire Poker, Nunchucks, Sledgehammer, Sai x2 (dual_sai)
- **Rare melee** (3 vapen): Fire Axe (Sharpened), Whip, Chainsaw (noiseLevel 3 -- attraherar zombies)
- **Legendary melee** (1 vapen): Katana (Legendary)
- Alla 14 vapen inlagda i loot-tables.json med ratt destinations och chanser per raritet
- GAME_VERSION bumpad till 4.8.0

### Noteringar
- Chainsaw har noiseLevel: 3 for att attrahera zombies som i game-design.md
- Befintlig "katana" (rare, id: katana) bevarad oforandrad -- ny uncommon katana far id katana_uncommon for att undvika kollision
- Sledgehammer-specialEffect kodar bade knockback och stun via value/duration-falten

## [v4.6.0] - 2026-04-04 23:36 -- Utokat ljudsystem: zon-ambient, footsteps, pickups, zombie-variation

### Varfor
AudioManager hade en god grund med ~30 procedurella ljud men saknade variation, zon-specifika ljud och pickup-feedback. Den har uppdateringen laggar till 30+ nya ljud och kopplar in dem i ratt kontext.

### Nya ljud i AudioManager.ts (alla procedurellt genererade med Web Audio API)

#### Zon-ambient (8s-10s loopar)
- `city_ambient_day` -- stadshum, avlagsna sirener, vind, glaskross
- `city_ambient_night` -- morkt sus, metallknirk, avlagsen skrik
- `military_ambient_day` -- oppet vindfall, flagga, radio-statik
- `military_ambient_night` -- djupt sus, motordrum, metallklank

#### Footstep-varianter
- `footstep_grass` -- mjukt dampat (forest/default)
- `footstep_concrete` -- hart med ekosvans (city)
- `footstep_metal` -- ringande klang (military)

#### Vader-ljud
- `rain_loop` -- regn (LP-filtrat vitt brus, loopbar)
- `thunder` -- askknall (brusbrott + laglager + langa svans)
- `wind_gust` -- vindpust (brusljud med sweep-filter)

#### Pickup-ljud
- `pickup_supply` -- metallisk oppning + myntjingel
- `pickup_medkit` -- uppgaende healing-chime (3 toner: C5 E5 G5)
- `pickup_ammo` -- militart klick-klack (magasininsattning)
- `pickup_adrenaline` -- tre accelererande basslag
- `pickup_survivor` -- varm vokalliknande ton (220 Hz + overtoner)

#### Zombie-varianter
- `zombie_scream` -- genomtrankande skrik (screamer-typ)
- `zombie_spit` -- vatt spottljud (spitter)
- `zombie_charge` -- stigande rusning (brute)
- `zombie_tunnel` -- jordigt gravande + framtradandeknall (tunnel zombie)

#### UI / Feedback
- `weapon_break` -- metalliskt knak + ringsvans
- `weapon_upgrade` -- shimmer + ding
- `blueprint_found` -- pappersrassel + fanfar
- `achievement_unlock` -- triumferande 5-notersfanfar (C4 D4 E4 G4 C5)
- `night_warning` -- djup gonggong (inharmoniska deltoner)

#### Boss-specifika
- `boss_charge` -- stigande rusning med brus
- `boss_acid` -- bubblande syra med amplitudmodulering
- `boss_tank_stomp` -- jordskakning (tyngre an boss_stomp)

### Andrade filer

#### src/systems/AudioManager.ts
- 30+ nya SoundId-entries
- 30+ nya gen*()-funktioner
- SOUND_DEFS utokad med alla nya ljud
- PITCH_VARIED_SOUNDS utokad: footstep-varianter, zombie-varianter, pickup-ljud, weather, boss
- startAmbient() accepterar nu 8 typer: 'city_day', 'city_night', 'military_day', 'military_night' utover befintliga

#### src/scenes/DayScene.ts
- Ambient-val utokat: city -> city_day, military -> military_day

#### src/scenes/NightScene.ts
- Ambient-val utokat: city -> city_night, military/endless -> military_night
- player.zone satt fran gameState.zone efter spelarskap
- Brute/military_heavy attack mot spelare spelar 'zombie_charge'

#### src/entities/Player.ts
- Import AudioManager och ZoneId
- Ny publik field `zone: ZoneId` (satt av NightScene)
- Ny privat field `footstepTimer: number`
- update(): spelar zon-specifik footstep-ljud var 350ms (walking) / 220ms (sprinting)

#### src/entities/Zombie.ts
- Screamer: spelar 'zombie_scream' vid skrik-event
- Spitter: spelar 'zombie_spit' vid skott
- City boss: spelar 'zombie_spit' + 'boss_acid' vid skott
- Forest boss charge: spelar 'boss_charge' vid charge-start
- Military tank: anvander 'boss_tank_stomp' istallet for 'boss_stomp'

#### src/systems/WaveManager.ts
- Import AudioManager
- Spelar 'zombie_tunnel' nar tunnel_zombie spawnar

#### src/systems/NightPickupManager.ts
- collectPickup() anropar ny playPickupSound() istallet for generisk 'ui_click'
- playPickupSound() mappar varje pickup-typ till ratt ljud

#### src/config/constants.ts
- GAME_VERSION bumpad till 4.6.0

## [v4.5.0] - 2026-04-04 23:00 -- Night map pickups (risk/reward system)

### Varfor
Spelaren saknar anledning att lamna basen under natten. Night pickups ger risk/reward-mekanik -- pickups spawnar pa kartan och lockar spelaren att utforska farliga omraden.

### Nya filer
- `src/systems/NightPickupManager.ts` -- hanterar spawn, timer, proximity-kollektion och effekter for alla pickups
- `src/data/pickups.json` -- all pickup-data (typ, timer, chans, spawn-lage, effekt) i JSON

### Andrade filer

#### src/config/constants.ts
- `GAME_VERSION` bumpad till 4.5.0

#### src/entities/Player.ts
- Ny publik field `speedBuff: number = 1` -- multipliceras med rorelsehastigheten
- Ny publik field `damageBuff: number = 1` -- multipliceras med vapenskada vid shootAt()
- `update()`: speed beraknas nu som `baseSpeed * speedBuff`

#### src/systems/NightPickupManager.ts (ny)
- 6 pickup-typer: supply_crate, ammo_cache, medkit, hidden_stash, wounded_survivor, adrenaline_shot
- Max 3 aktiva pickups samtidigt
- Spawn-logik: viktad slump, separationscheck (80px min), spawn-lage per typ (nara bas / kant / far / random)
- Varje pickup: Graphics med pulserande glow-tween, floating label, timer-bar (gron/gul/rod)
- Collection: distance check 32px, ljud (ui_click), popp-animation
- Expiry: fade-out vid timeout
- Effekter via scene.events.emit: pickup-heal, pickup-ammo, pickup-resource, pickup-refugee, pickup-stash, pickup-adrenaline

#### src/scenes/NightScene.ts
- Import `NightPickupManager`
- Nya privata fields: `nightPickupManager`, `_adrenalineTimer`, `_adrenalineGlow`
- `create()`: skapar NightPickupManager efter minimap
- `setupEvents()`: lyssnar pa wave-started och anropar `onWaveStart()` med 1.5s forsening; lyssnar pa alla pickup-events
- `pickup-heal`: healar spelaren, uppdaterar HP-bar
- `pickup-ammo`: lagg till loadedAmmo, uppdaterar HUD
- `pickup-resource`: lagg till resurs via ResourceManager
- `pickup-refugee`: addRefugee() via RefugeeManager
- `pickup-stash`: +5 scrap +3 ammo (nattpriset, enkelt)
- `pickup-adrenaline`: satter speedBuff=1.5, damageBuff=1.5, startar adrenalinTimer
- `update()`: kallar `nightPickupManager.update()`, tickar `_adrenalineTimer`, ritar gul glow runt spelaren
- `shootAt()`: multiplcerar `stats.damage * player.damageBuff` nar buff ar aktiv
- `updateMinimap()`: passar `pickups` till `minimap.update()`
- `shutdown`: rensar pickup-events + `nightPickupManager.destroy()`

#### src/ui/Minimap.ts
- Ny constant `COLOR_PICKUP = 0xFFDD00` (gul)
- Ny privat field `lastPickups: Array<{x,y}>[]`
- `update()`: tar nu valfri parameter `pickups?`; lagrar i `lastPickups`
- `render()`: ritar gula 2x2 prickar for varje aktiv pickup (ritade fore zombies sa de inte overlappar)

### Spelmekanik
- 1-2 pickups spawnar per wave (50% chans att fa 2)
- Chans: Supply 40%, Ammo 20%, Medkit 15%, Stash 10%, Survivor 10%, Adrenaline 5%
- Wounded Survivor: max 1 per natt
- Adrenaline: 15s buff (1.5x speed + 1.5x skada), gul pulsande glow runt spelaren
- Gula prickar pa minimap visar pickup-positioner

## [v4.3.2] - 2026-04-04 22:28 -- Day-cycle visuals och tydligare death-restart

### Varfor
Spelaren behover tydligare feedback om vad som hander vid dod (progression bevaras) och en bättre kansla av dag-progression med ljus och atmosfar.

### Andrade filer

#### src/scenes/NightScene.ts
- `showGameOver()`: panelhojd okad fran 290 till 340px for att rymma ny text
- Ny text "You will restart at Day 1" i guld (#E8B84B) vid py+170
- Ny text (tre rader) "All gear & weapons kept", "Skills & XP kept", "Refugees & base kept" i gront (#4CAF50)
- Ersatter den tidigare enrads "You keep all your gear." med mer specifik och tydlig information

#### src/scenes/DayScene.ts
- Ny privat field `dayLightOverlay: Phaser.GameObjects.Graphics` -- lighting-overlay for dag-cykel
- Ny privat field `_lastLightingAP: number` -- change-detection for att undvika onodiga omritningar
- Ny privat field `nightWarningText: Phaser.GameObjects.Text | null` -- "Night is approaching..." text
- Ny metod `showDawnAnimation()` -- fade-in-overlay fran morkt (#0A0505) med "A new dawn rises." och "Day N" text
- Ny metod `updateDayLighting()` -- ritar orange/klart/rod overlay baserat pa aktuell AP
- Ny metod `updateNightWarning(hoursLeft)` -- skapar/tar bort varningstext vid 1 AP kvar
- `create()`: skapar dayLightOverlay och anropar showDawnAnimation() och updateDayLighting()
- `update()`: detekterar AP-forandringar och kallar updateDayLighting() vid behov

#### src/config/constants.ts
- GAME_VERSION: 4.3.1 -> 4.3.2

## [perf] - 2026-04-04 22:09 -- SpatialBucketGrid: zombie-trap collision optimization

### Varfor
NightScene.checkZombieStructureInteractions() itererade ALLA zombies mot ALLA 12 passiva struktur-arrayer varje frame. Med 100+ zombies och 50+ strukturer = 5000+ checks per frame. Nu checkar varje zombie bara ~3-5 narliggande strukturer via ett spatial hash grid.

### Tillagda filer
- `src/systems/SpatialGrid.ts` -- generisk SpatialBucketGrid<T> med clear(), insert(x,y,item), query(x,y,radius)

### Andrade filer

#### src/config/types.ts
- Nytt interface `InteractableStructure` -- dokumenterar kontraktet for strukturer som interagerar med zombies (exporteras men anvands inte direkt av gridden, som istallet anvander union-typen PassiveStructure i NightScene)

#### src/scenes/NightScene.ts
- Ny typ `PassiveStructure` (union av Barricade | Sandbags | Trap | SpikeStrip | BearTrap | Landmine | NailBoard | TripWire | GlassShards | TarPit | OilSlick | GlueFloor) -- lagras direkt i gridden for att undvika sekundara uppslagningar
- Nytt falt `structureGrid: SpatialBucketGrid<PassiveStructure>` (128px cell = 2 tiles)
- Ny metod `_rebuildStructureGrid()` -- populerar gridden fran aktiva struktur-arrayer. Kallad en gang fran `createStructures()` och igen nar en passiv struktur forstors under natten
- `checkZombieStructureInteractions()`: per-zombie forEach-loop ersatt med `structureGrid.query(zombie.x, zombie.y, 96)` foljt av instanceof-grenar per strukturtyp. Grid byggs om om `_gridDirty` satts under loopen

### Performance-forandring
- Fore: O(zombies * structures) = ~5000+ checks/frame vid 100 zombies + 50 strukturer
- Efter: O(zombies * ~4) = ~400 checks/frame (grid query tackerkring aktuell cell + grannceller)
- Mekaniska fallor (TrapBase-subklasser) ror sig inte pa samma satt och hanteras fortfarande i updateMechanicalTraps() som itererar zombies per falltyp

## [challenges] - 2026-04-04 22:05 -- Challenge Modes

### Tillagda filer
- `src/data/challenges.json` -- definitioner for No Build, Pacifist, Speed Run (id, name, desc, lpReward)

### Andrade filer

#### src/config/types.ts
- Ny typ `ChallengeId = 'no_build' | 'pacifist' | 'speed_run'`
- Nytt interface `ChallengeData` (id, name, description, icon, lpReward, unlockCondition)
- Tre nya falt pa `GameState`: `activeChallenge: ChallengeId | null`, `challengeCompletions: string[]`, `speedRunTimer: number`

#### src/systems/SaveManager.ts
- `createDefaultState()`: defaults for activeChallenge (null), challengeCompletions ([]), speedRunTimer (0)
- `load()`: migration -- saknade falt faller tillbaka pa defaults

#### src/scenes/MenuScene.ts
- Import av ChallengeData, ChallengeId, challengesJson
- Ny privat property `challengeContainer`
- Ny knapp "CHALLENGES" i buildMenuButtons (under LEGACY)
- Ny metod `toggleChallengePanel()`: panel med lista av alla challenges (locked/available/completed), START-knapp per tillganglig challenge
- Ny metod `startChallenge(id)`: rensar save, skriver challenge-id och startar DayScene

#### src/scenes/DayScene.ts
- `create()`: Speed Run challenge ger 8 AP istallet for 12
- `createTopBar()`: challenge-badge visas under dag-raknaren nar challenge ar aktiv
- `toggleBuildMenu()`: No Build challenge blockerar byggmenyn med info-meddelande
- `update()`: Speed Run ackumulerar tid i `gameState.speedRunTimer`

#### src/scenes/NightScene.ts
- `update()`: Pacifist challenge blockerar skjutning (auto-shoot + melee deaktiverat)
- `update()`: Speed Run ackumulerar tid i `gameState.speedRunTimer`
- `create()`: challenge-badge och (for speed_run) en lopande MM:SS-timer visas i HUD
- `setupEvents()` all-waves-complete: ger bonus LP vid zone clear med aktiv challenge, markerar challenge som completed, nollstaller activeChallenge/speedRunTimer

#### src/scenes/ZoneCompleteScene.ts
- Interface `ZoneCompleteData` utokad med `challengeId?` och `challengeBonus?`
- Visar "CHALLENGE COMPLETE: [Namn]! +NNN LP" banner nar challenge klarades

## [minimap] - 2026-04-04 -- Minimap for nattfasen

### Tillagda filer
- `src/ui/Minimap.ts` -- ny UI-komponent, klass `Minimap`

### Minimap.ts
- 120x90px minimap i ovre hogra hornet (GAME_WIDTH-130, y=40)
- Halv-transparent mork bakgrund (0x111111, alpha 0.7) med gra border
- Renderar: rod prick = zombie (1x1px), gron rect = struktur (2x2px), vit cirkel = bas (r=3), ljusblA cirkel = spelare (r=2)
- Uppdaterar var 500ms via intern tidsr aknare -- INTE varje frame
- `show()`, `hide()`, `toggle()` metoder
- `getContainer()` returnerar Phaser.GameObjects.Container

### NightScene.ts
- Import av `Minimap` och `MinimapStructurePoint`
- `private minimap!: Minimap` falt
- Skapar `Minimap` i `create()` efter HUD -- storlek MAP_WIDTH*TILE_SIZE x MAP_HEIGHT*TILE_SIZE
- Ny privat metod `updateMinimap(delta)` -- samlar strukturpositioner fran game state, anropar minimap.update()
- Anrop till `updateMinimap(delta)` i slutet av `update()`
- M-tangent i `setupWeaponKeys()` togglar minimap

## [v4.2.0] - 2026-04-04 22:00 -- Weapon Ultimates: unika abilities vid Lv5

### Nya typer i types.ts
- `WeaponUltimateType`: union type for alle 6 ultimate-typer
- `WeaponUltimateCost`, `WeaponUltimate`: strukturer for ultimate-data per vapen
- `WeaponData` utokad med `maxLevel?` och `ultimate?` faelt

### Uppdatering av weapons.json
- 10 vapen far `ultimate`-faelt och `maxLevel: 5`:
  - crowbar, baseball_bat, two_by_four: Spin Attack (48px radius mot ALLA)
  - rusty_knife, hunting_knife, fire_axe: Cleave (genomstick + 75% skada bakre)
  - worn_pistol, 9mm_compact: Piercing Shot (projektil gar igenom forsta zombie)
  - hunting_rifle, assault_rifle: Phosphor Rounds (8 dmg/s i 3s, orange glow)
  - pump_shotgun, sawed_off: Buckshot (5 projektiler i 30 graders kon)
  - molotov: Explosive Impact (AOE 60px, 50% skada, via cleave-specialEffect)

### Projectile.ts
- Ny `piercing: boolean` -- sant om Piercing Shot ultimate ar aktivt
- Ny `piercingHitCount: number` -- raknar antal zombie-traffar (genomstick stoppas efter 1)
- Ny `ultimateType: WeaponUltimateType | null` -- taggad vid avlosning
- `fire()` tar emot `piercing` och `ultimateType` som valfria parametrar

### Zombie.ts
- Ny `burnDamage: number` och `burnTimer: number` -- publik state for phosphor DOT
- Ny `private burnTickAccum: number` -- ackumulator for 1-sekunders tick
- `applyBurn(dmgPerSec, durationMs)` -- publika metod; uppdaterar/forlangar brand
- `update()`: hanterar phosphor burn DOT, orange tint (0xFF6600) medan zombie brinner

### NightScene.ts
- `getActiveUltimate()` -- hjalpmetod; returnerar WeaponUltimateType | null for equippat vapen
- `shootAt()`: branchar pa ultimate-typ fore normal skjutlogik:
  - spin_attack: skadar upp till 10 fiender inom 48px, visuell gul cirkel-arc
  - cleave_pierce: traff + genomstick (bakre zombie), visuell dubbel-arc
  - buckshot: 5 projektiler i 30 graders spread
  - explosive_impact: skjuter med syntetisk cleave-effekt (60px, chance 1.0)
  - piercing_shot: markerar projektilen som `piercing=true`
  - phosphor_rounds: taggad `ultimateType` pa projektilen
- `fireProjectile()` tar emot `piercing` och `ultimateType`
- Overlap-callback: hanterar `isUltimatePiercing` (genomstick) och anropar `applyRangedUltimateEffect`
- `applyRangedUltimateEffect()`: ny metod; anropar `zombie.applyBurn(8, 3000)` vid phosphor_rounds

### WeaponManager.ts
- `canUnlockUltimate(weaponInstanceId)` -- kollar niva 4, ultimate definierat, resurser racker
- `unlockUltimate(weaponInstanceId)` -- kostnad 15 parts + 5 scrap, satter niva 5

### EquipmentPanel.ts
- Import av `WeaponUltimate` fran types
- `buildUpgradeView()`: visar ultimate-sektion vid niva 4 med kostnad + klickbart kop
- Visar "ULTIMATE ACTIVE" om vapnet redan ar Lv5

### HUD.ts
- `weapon1UltiGlow: Phaser.GameObjects.Graphics` -- gul border runt vapenrad 1
- `updateWeapon()` tar emot `weaponLevel?` -- visar/doljer gul glow vid Lv5

## [v4.1.0] - 2026-04-04 19:00 -- Bug fixes: 7 utvarderingsproblem atgardade

### NightScene.ts -- Fix 1: Top Traps aggregerar per trap-typ, inte per instans
- `trapKillMap` nyckel andrad fran instans-ID till `structureId` (trap-typnamn)
- Tre "Glass Shards"-traps med 4+3+3 kills ger nu ett korrekt "Glass Shards -- 10 kills"

### NightScene.ts -- Fix 2: Breakthroughs raknar nu bara en gang per wave
- Lade till `waveBreachCounted: boolean` som nollstalls i wave-started-handler
- `damageBase()` okar breakthroughCount max en gang per wave, inte per hit-event

### NightScene.ts -- Fix 3: Kill attribution fallback till 'weapon' om kallor ar null
- Om `_currentKillSource` ar null vid zombie-killed: defaultar till weapon-kill med console.warn

### NightScene.ts -- Fix 5: Oanvand ammo returneras till lagret vid natt-slut
- `all-waves-complete`: `inventory.resources.ammo += Math.max(0, loadedAmmo)` laggt till innan save
- `player-died`: samma retur-logik innan save, sa ammo inte forsvinner vid death

### EquipmentPanel.ts -- Fix 6: Trasiga vapen visar [BROKEN] i rott, equip-knapp dold
- `renderStorageEntry()`: om `weaponManager.isBroken(w)` visas en rod [BROKEN]-text utan interaktion
- [EQUIP]-knappen visas inte for trasiga vapen

### DayScene.ts -- Fix 7: Svaltningsvarning i HUD och GameLog
- `processDayStart()`: om `foodResult.missing > 0` visas "Refugees starving! Need more food!" i info-bannern
- Logg-meddelande i GameLog med rod farg med antalet svaltande refugees

### NightScene.ts -- Fix 10: Verifierade weather gameplay-effekter (inga andingar nodvandiga)
- `applyRainEffectsToTraps()`, `electricDisabled` via hasEvent, `applyBombardmentDamage` ar alla redan kopplade
- Veriferade att NightEventManager driver alla tre effekter korrekt

### constants.ts
- GAME_VERSION: '4.0.3' -> '4.1.0'

## [v4.0.1] - 2026-04-04 -- UX-fixes: PackYourBag layout, shortcut hints i paneler, HUD-cleanup

### PackYourBagScene.ts -- komplett omskrivning av layout och UX
- Tydliga vertikala sektioner med separatorer: Weapons -> divider -> Resources -> divider -> Refugees/Skills
- Weapons visas max 6 st (med hint om overflow); allt i scrollContainer
- Resources: hold-click pa [-]/[+] med auto-repeat (3/s, accelererar till 10/s efter 1s)
- Nytt [MAX]-knapp per resurs-rad: fyller till min(available, remaining_budget)
- Skills visar nu korrekt niva (e.g. "Melee Lv3") istallet for ratt XP-varde ("Lv3650")
  -- xpToLevel() konverterar ackumulerad XP till niva via skills.json-trosklarna
- Scroll-stod med mushjul (innehall klipps med geometry mask)
- Font: 10px headers, 9px items, 8px knappar, 7px hints (enligt spec)

### LootRunPanel.ts -- tangentbordsgenvagar synliga i UI
- Destinations-lista: "[1] Nearby Houses", "[2] Ranger Station" etc (8px hint till vanster om namn)
- Companion-lista: "[1] Wren  (Tough)..." etc

### EncounterDialog.ts -- shortcut-hints pa Fight/Flee-knappar
- FIGHT-knappen visar nu "[1] FIGHT", FLEE-knappen visar "[2] FLEE"

### RefugeePanel.ts -- shortcut-hints pa Heal-knappar + forbattrad handleKey
- Heal-knappar visar "[1] Heal (1 med)", "[2] Heal (1 med)" etc per skadad refugee
- handleKey() stodjer nu 1-9 for att hela skadade refugees direkt via tangentbord

### EventDialog.ts -- shortcut-prefix pa alla valknapparna
- Valknappar visar "[1] Accept", "[2] Decline" etc
- Hojdberakning uppdaterad for att inkludera prefixet i matningstexten

### HUD.ts -- rensar oanvanda privata falt
- Tog bort `_currentNight` och `_maxNights` (sattes i setNight() men lasters aldrig)

### constants.ts
- GAME_VERSION: '4.0.0' -> '4.0.1'

## [v3.3.1] - 2026-04-04 -- Zon-specifik terranggenering: City och Military

### TerrainGenerator.ts -- fullstandig zon-specifik terrang
- `drawZoneBackground()`: Ny exporterad funktion som ersatter inline-bakgrundsritning i NightScene och DayScene
  - Forest: oforandrad organisk bakgrund (gron mark + brun stig + rensad basyta)
  - City: asfalt (#3A3A3A) + korsande gator (horisontell + vertikal) + faded gul mittlinje + gatukanter + oljeflackar, sprickor
  - Military: olivgron mark (#4A5A3A) + grusad access-vag + stangsel langs ovre kanten + ren insatsyta kring basen
- City-specifika dekorationer:
  - `drawBuildingRuin()`: Rektangulara byggnadsskal med trasiga vaggar, rubbel och fonsteropp. Physics body + PathGrid-blocker
  - `drawAbandonedCar()`: Fargade bilar med rost och hjul. Dekorativa
  - `drawStreetlight()`: Lyktstolpar med nattglon-halo
  - `drawUrbanDebris()`: Betongbitar och tegelstensbitar
- Military-specifika dekorationer:
  - `drawBunker()`: Tjockvaggiga betongbunkrar med 3D-skuggning och camo. Physics body + PathGrid-blocker
  - `drawBarbedWire()`: Sicksack-taggtrad med taggpiggar. Dekorativ
  - `drawSandbagCluster()`: Sandsacksvallar i ring kring basen
  - `drawHelipad()`: Helikopterlandningsplatta med H-markering. En per karta
- `generateForestDecor()`: Befintlig logik extraherad till separat intern funktion
- Endless-zon: anvander forest-utseende som fallback

### types.ts
- `NaturalBlockerRect`: Ny typ for AABB hos naturliga terrangblockerare
- `TerrainResult`: Nytt falt `naturalBlockerRects: NaturalBlockerRect[]`

### PathGrid.ts
- `addNaturalBlockers(blockers)`: Ny metod -- markerar tiles overlappande NaturalBlockerRect som blockerade. Anropas efter updateFromStructures()

### NightScene.ts
- `createMap()`: Ersatt hardkodad forest-bakgrund med `drawZoneBackground()`
- `create()`: Anropar `pathGrid.addNaturalBlockers()` sa zombies navigerar runt ruiner/bunkrar

### DayScene.ts
- `createMap()`: Ersatt hardkodad forest-bakgrund med `drawZoneBackground()` + laggs till mapContainer

## [v3.3.0] - 2026-04-04 -- Post-Night Debrief + Endless Mode + Legacy Progression

### Post-Night Debrief (ResultScene.ts full rewrite)
- `ResultScene.ts`: Ersatt enkel "ALL WAVES SURVIVED! Kills: N" med detaljerad nattrapport
  - Visar total kills, trap kills (%), weapon kills (%)
  - Top 3 traps med killcount (guld/silver/brons)
  - Breakthroughs (antal ganger zombies natt basen)
  - Structures lost med strukturnamn och position
  - Ammo anvant denna natt (X/Y)
  - Base HP kvar (fargkodad gron/gul/rod)
  - Legacy Points tjanade denna natt
  - Scrollbart innehall via drag + scroll hjul
  - Forsenad CONTINUE-knapp (1.2s) for att undvika oavsiktlig skip

### Kill-kallsparing (NightScene.ts)
- `NightScene.ts`: 18 fallor far nu sin dodsstatus trackad (trapKills, weaponKills, trapKillMap)
- Barricade och wall-forstoring registreras i destroyedStructures
- breakthroughCount okar varje gang en zombie skadar basen
- bossKillsThisNight tracker (for LP-beloning)
- buildNightStats() hjalpermetod aggregerar all data till NightStats

### Endless Mode
- `src/data/zones.json`: Lagt till Endless-zon (id: "endless", waveFile: "waves-military")
  - Lacser upp nar Military Wave 5 klaras
  - Auto-scaling per natt: +15% fiender, +10% HP, +5% speed
  - Alltid 5 vagor per natt
- `WaveManager.ts`: Nya falt hpScaleMultiplier + speedScaleMultiplier + setEndlessScaling()
- `NightScene.ts`: Endless-loop: efter all-waves-complete i endless-zon -> ResultScene -> NightScene
  - endlessNight-raknar okar per klarad natt
  - endlessHighScore sparas i GameState
- `MenuScene.ts`: CONTINUE-text visar "Endless -- Night N" for endlesslaget

### Meta-Progression (Legacy Points)
- `src/config/types.ts`: NightStats, TrapKillEntry, PerkData interfacen tillagda
  - GameState: endlessHighScore, endlessNight, meta.legacyPoints, meta.unlockedPerks
- `src/data/perks.json`: 6 perks definerade (Scrap Stash, Armed and Ready, Camp Fire, Scholar, Tough Base, Lucky Looter)
- `src/systems/SaveManager.ts`: Migration for nya falt (endlessHighScore, endlessNight, meta)
- `src/scenes/MenuScene.ts`: Ny LEGACY-knapp och panel
  - Visar LP-saldo, alla perks med kostnad och status
  - BUY-knapp for oppen perks (kraver tillrackliga LP)
- `src/scenes/DayScene.ts`: applyLegacyPerks() applicerar perks pa ny run (totalRuns == 0, wave == 1)
  - scrap_stash: +10 scrap
  - armed_and_ready: slumpas ett Uncommon-vapen
  - camp_fire: en extra refugee laggs till
  - tough_base: tillampas i NightScene (+50 max base HP)
  - lucky_looter: tillampas i LootRunPanel (+25% loot)
- Legacy Points belonas: 10 LP/natt, 50 LP/zon, 100 LP/endless-natt, 25 LP/boss-kill

## [v3.2.0] - 2026-04-04 18:00 -- Zon-specifika zombie-varianter och boss-mekaniker

### Zon-specifika zombie-skins
- `Zombie.ts`: Ny metod `applyZoneTint(zone)` -- lägger ett zon-specifikt färgfilter på alla zombies
  - Forest: mörkt mossgrönt (0x3A6B22-blend)
  - City: grått urbant filter (0x787878-blend)
  - Military: oliv/kamouflagefärg (0x6B6B3A-blend)
  - Zone-boss-typer påverkas INTE (har egna distinkta tints)
- `WaveManager.ts`: Anropar `applyZoneTint()` direkt efter spawn/reset av varje zombie

### Nya enemy-typer
- `src/data/enemies.json`: 3 nya zon-specifika typer
  - `city_crawler`: Kryper (snabb runner, litet, ignorerar låga väggar). HP 18, speed 110, scale 0.75. Bara i City.
  - `military_heavy`: Bepansrad (50% damage reduction). HP 200, speed 22, scale 1.3. Bara i Military.
  - `tunnel_zombie`: Spawnar INUTI bas-radien istället för vid kartkanten. HP 40, speed 55. Alla zoner natt 4+.
- `Zombie.ts`: Nya ZombieBehavior-typer: `city_crawler`, `military_heavy`, `tunnel_zombie`, `forest_boss`, `city_boss`, `military_tank`
- `Zombie.ts`: Nya config-fält: `ignoresLowWalls`, `armorDamageReduction`, `weakSpotMultiplier`, `crushStructuresOnPath`, boss-fas-konfigurationer
- `Zombie.ts`: `armorDamageReduction` reducerar inkommande damage i `takeDamage()`
- `WaveManager.ts`: `tunnel_zombie` spawnar inom `baseSpawnRadius` (120px) istallet for vid kartkanter

### 3 nya bossar med fas-mekaniker (implementerade i Zombie.ts state machine)

**Forest Boss -- Brute Alpha** (`forest_boss`)
- Fas 1: Laddningar mot basen (200px rush, 4s cooldown, 600ms varaktighet)
- Fas 2 (<=50% HP): Kastar stenar pa spelaren (ranged 300px, 3s cooldown) + ENRAGED-announcement
- Spawnar 3 walkers vid varje charge-end
- Tint: morkgron (0x228822)

**City Boss -- Spitter Queen** (`city_boss`)
- Ranged attacker (spitter-beteende, 350px range, 2.5s cooldown)
- Spawnar 2 spitters var 10s via `city-boss-spawn-minions`-event
- Lämnar syrabassänger på marken (DOT-zon, 5s, 15 dmg/s) via `city-boss-acid-pool`-event
- Vid 25% HP: desperate scream drar ALLA zombies mot drottningen
- Tint: giftigron (0x44AA00), scale 1.8

**Military Boss -- Tank** (`military_tank`)
- 2000 HP, speed 12, scale 3.0 (enorm)
- 75% armor damage reduction på alla träffar
- Svag punkt (baksida): `getTankDamageMultiplier()` returnerar 3x vid flankning
- Krossar barrikader och väggar i sin väg (`tank-crushing`-event)
- Ignorerar PathGrid (rak linje mot basen)
- Tint: mörkbrun (0x1A1A1A-blend), scale 3.0

### Boss-events i NightScene
- `forest-boss-phase2`: Log-meddelande + boss_roar
- `forest-boss-charge-end`: Spawnar walkers runt impakt-punkten
- `forest-boss-rock-throw`: Skapar brun projektil via spitter-projekti-pool
- `city-boss-spawn-minions`: Spawnar spitters runt drottningen
- `city-boss-acid-pool`: Ritar gron ellips + skapar DOT-timer
- `city-boss-desperate-scream`: Rosa ring-animation + attracts ALL zombies
- `tank-crushing`: Instant-destroy barrikader och vaggar inom crush-radius

### Uppdaterade wave-filer
- `waves.json`: Wave 5 anvander `forest_boss` istallet for `brute_boss`
- `waves-city.json`: Wave 3-5: `city_crawler` tillagd (5/10/12 count). Wave 5: `city_boss`
- `waves-military.json`: Wave 2-5: `military_heavy` (2/4/6/8). Wave 4-5: `tunnel_zombie` (3/5). Wave 5: `military_tank`

### Tekniska detaljer
- `ZoneId` importeras nu fran `config/types.ts` och re-exporteras fran `Zombie.ts`
- `WaveManager.ts`: Nya metoder `setZone()`, `setBaseSpawnRadius()`
- `NightScene.ts`: Anropar `waveManager.setZone()` i `setupWaveManager()`

## [v3.2.0] - 2026-04-04 17:00 -- Natt-events och vädersystem

### Nyheter
- `src/systems/NightEventManager.ts` -- ny manager-klass for vaderhändelser och speciella natt-events
- `src/data/night-events.json` -- JSON-konfiguration for events (zone, night, chans)

### Väderhändelser
- **Fog** (Forest natt 3-4, 80% chans): grå overlay (alpha 0.22), reducerar synfält via fogPenalty
- **Rain** (City natt 3-5, 70% chans): animerade regndroppar (Graphics-baserade), +10% malfunction-chans för alla mekaniska fällor, brandbaserade fällor -50% skada
- **Storm** (alla zoner natt 4, 35% chans): blixt-flash + persistent mörkare overlay, 2 slumpmässiga strukturer tar 15 skada vid nattstart
- **Bombardment** (Military natt 4, 80% chans): explosioner var 4s på slumpmässiga positioner, skadar zombies och strukturer inom 80px radius

### Speciella natt-events
- **Blood Moon** (alla zoner natt 4-5, 10% chans): röd pulsande overlay, alla zombies +25% speed +25% HP via zombie-spawned-event
- **Power Outage** (City natt 2, 65% chans): mörk overlay 30 sekunder, elektriska fällor (ShockWire, BugZapperXL, CarBatteryGrid, ElectricFence) inaktiveras

### Integration
- NightScene.ts: import + instansiering i create(), update() i game loop, setupNightEventHandlers(), cleanup i shutdown
- WaveManager.ts: emit('zombie-spawned', zombie) för Blood Moon-applicering
- Bannrar visas vid nattstart: "NIGHT 3 -- FOGGY", "BLOOD MOON RISES" etc.

## [Unreleased] - 2026-04-04 -- Tier 2 Trap Batch: 10 Nya Falllor

### 10 nya Tier 2 fallor implementerade (blad, kraft, elektricitet, fangst)

**Blad och skar:**
- `src/structures/CircleSawTrap.ts` -- 35 dmg, cd 3s, poppar upp fran golvet, fuel 1
- `src/structures/RazorWireCarousel.ts` -- 15 dmg/s AOE ring, overheat 25s, fuel 1
- `src/structures/LawnmowerLane.ts` -- 20 dmg/s korridor 4 tiles, overheat 30s, fuel 2

**Kraft och rorelse:**
- `src/structures/TreadmillOfDoom.ts` -- pushback + 10 dmg/s, alltid aktiv, overheat 40s, fuel 2
- `src/structures/PendulumAxe.ts` -- 45 dmg swing AOE 48px, cd 5s
- `src/structures/GarageDoorSmasher.ts` -- 60 dmg crush, cd 8s, fuel 1

**Elektricitet:**
- `src/structures/BugZapperXL.ts` -- 20 dmg/s AOE + attraherar zombies, overheat 20s, fuel 1
- `src/structures/CarBatteryGrid.ts` -- stun 2s i 3x3 zon, cd 10s
- `src/structures/ElectricFence.ts` -- 10 dmg/s + blockerar, 200 HP, overheat 60s, fuel 2

**Fangst:**
- `src/structures/NetLauncher.ts` -- immobilize 4s i 3x3 AOE, cd 12s

**src/data/structures.json:** 10 nya entries laggda till
**src/data/base-levels.json:** Camp/Outpost/Settlement: alla 10 laggda till unlockedStructures
**src/data/blueprints.json:** 5 nya blueprints: auto_shop_manual, farm_equipment_guide,
  electricians_handbook, trappers_handbook_advanced
**src/scenes/NightScene.ts:** Imports, arrays, createStructures switch-cases, update-loopar,
  allMechanical-lista

## [Unreleased] - 2026-04-04 -- Tier 3 Trap Batch: Slaktmaskiner + Explosivt

### 9 nya Tier 3 fallor implementerade (slaktmaskiner + explosivt)

**Slaktmaskiner (extends TrapBase):**
- `src/structures/MeatGrinder.ts` -- 50 dmg/s AOE 2 tiles, cd 6s, overheat 20s, fuel 2, malfunction 25%
- `src/structures/BeltSanderGauntlet.ts` -- 30 dmg/s korridor, cd 4s, overheat 25s
- `src/structures/PowerDrillPress.ts` -- 80 dmg single target + stun 0.5s, cd 4s
- `src/structures/PianoWireWeb.ts` -- 40 dmg pa passage, 20 uses (skars ner)
- `src/structures/CombineHarvester.ts` -- 60 dmg/s 4 tiles bred, cd 8s, fuel 3, LEGENDARY

**Explosivt (extends TrapBase):**
- `src/structures/CarBomb.ts` -- 200 dmg AOE 120px, engangstrap (uses=1)
- `src/structures/NapalmSprinkler.ts` -- 40 dmg/s kon 100px, cd 8s, fuel 4
- `src/structures/GasMainIgniter.ts` -- 150 dmg hel kartbredd linje, engangstrap (uses=1)
- `src/structures/FlamethrowerPost.ts` -- 30 dmg/s kon 80px, cd 5s, fuel 3

**src/data/structures.json:**
- 9 nya entries: meat_grinder, belt_sander_gauntlet, power_drill_press, piano_wire_web,
  combine_harvester, car_bomb, napalm_sprinkler, gas_main_igniter, flamethrower_post

**src/data/base-levels.json:**
- Outpost (level 2): 8 nya fallor laggda till unlockedStructures
- Settlement (level 3): 9 nya fallor laggda till (inkl. combine_harvester)

**src/data/blueprints.json:**
- 4 nya blueprints: industrial_slaughter, legendary_harvester, explosive_ordinance, napalm_tactics

**src/scenes/NightScene.ts:**
- Importerar alla 9 nya klasser
- 9 nya privata arrays for Tier 3 fallor
- createStructures(): 9 nya switch-case med fuel-logik for MeatGrinder, CombineHarvester,
  NapalmSprinkler, FlamethrowerPost
- updateMechanicalTraps(): update + zombie-interaktionslogik for alla 9 fallor
- updateRepairMechanic(): allMechanical utokad med Tier 3-array

**Bugfix:**
- GarageDoorSmasher.ts: tog bort oanvand `smashState`-property (TS6133)

## [Unreleased] - 2026-04-04 -- Tier 3 Trap Batch: Heavy + Combo

### 9 nya Tier 2-3 fallor implementerade

**Passiva blockerare (extends Graphics + physics body):**
- `src/structures/GlueFloor.ts` -- 90% slow zon, 3 tiles, passiv (extends Graphics)
- `src/structures/ShoppingCartWall.ts` -- 80 HP blockerare, billig (4 scrap)
- `src/structures/CarWreckBarrier.ts` -- 300 HP blockerare, tuffaste passiva barrikaden
- `src/structures/DumpsterFortress.ts` -- 150 HP, shooting holes for refugees

**Tyngd och kraft (extends TrapBase, uses=1):**
- `src/structures/TractorWheelRoller.ts` -- 100 dmg linje 4 tiles, engangstrap
- `src/structures/LogAvalanche.ts` -- 50 dmg linje + pushback, engangstrap
- `src/structures/FallingCar.ts` -- 150 dmg spot, engangstrap

**TrapBase med cooldown:**
- `src/structures/WreckingBall.ts` -- 70 dmg AOE 64px, cd 10s
- `src/structures/TreadmillBlades.ts` -- 25 dmg/s + pushback, fuel 1 food/natt
- `src/structures/FanGlass.ts` -- 15 dmg/s kon, cd 2s
- `src/structures/ElevatorShaft.ts` -- instant kill 1 zombie, cd 15s
- `src/structures/RubeGoldberg.ts` -- kedjereaktionen: alarm->eld->boom->blad, cd 20s

**src/data/structures.json:**
- 13 nya entries: glue_floor, shopping_cart_wall, car_wreck_barrier, dumpster_fortress,
  tractor_wheel_roller, wrecking_ball, log_avalanche, falling_car, treadmill_blades,
  fan_glass, elevator_shaft, rube_goldberg (kategori heavy/combo)

**src/data/blueprints.json:**
- 5 nya blueprints: redneck_engineering, gravity_traps, junkyard_genius, combo_machines, mad_scientists_notes

**src/data/base-levels.json:**
- Level 2 (Outpost): lagt till wall/barrier + heavy traps
- Level 3 (Settlement): lagt till alla 13 nya strukturer inkl combo-traps

**src/scenes/NightScene.ts:**
- 13 nya imports, 16 nya privata arrays
- createStructures(): 13 nya switch-cases med physics bodies for blockerare
- checkZombieStructureInteractions(): filter + glue floor slow loop
- updateMechanicalTraps(): 8 nya trap-update sektioner med AOE/linje/instant-kill logik
- RubeGoldberg chain callback: varje steg gor AOE-skada och emittar particles
- updateRepairMechanic(): alla nya TrapBase-traps tillagda i allMechanical

## [Unreleased] - 2026-04-04 -- Fall-leveling Lv1-3

### Fall-leveling: Nail Board, Blade Spinner, Fire Pit kan uppgraderas till Lv3

**src/data/structures.json:**
- nail_board: maxLevel 1 -> 3, lagt till "upgrades": { "2": {parts:3, dmg:15, uses:25}, "3": {parts:8, dmg:20, uses:35} }
- blade_spinner: maxLevel 1 -> 3, lagt till "upgrades": { "2": {parts:3, dmg:35, cd:3s}, "3": {parts:8, dmg:50, cd:2s, overheat:15s} }
- fire_pit: maxLevel 1 -> 3, lagt till "upgrades": { "2": {parts:3, dmg:25/s}, "3": {parts:8, dmg:35/s} }

**src/systems/BuildingManager.ts:**
- Ny interface StructureUpgradeLevel -- typdef for per-niva upgrade data
- Ny metod getNextUpgrade(instance) -- returnerar nasta nivans StructureUpgradeLevel eller null
- Ny metod canAffordUpgrade(instance) -- kontrollerar upgrade-kostnad (ej bygg-kostnad)
- Ny metod hasEnoughAPForUpgrade(instance, ap) -- kontrollerar AP mot upgrade-kostnad
- upgrade() omskriven: anvander nu per-niva kostnad fran upgrades-faltet, faller tillbaka pa bygg-kostnad om upgrades saknas (bakatkompat)

**src/scenes/DayScene.ts:**
- showStructurePopup() anvander nu canAffordUpgrade/hasEnoughAPForUpgrade
- Visar "Lv2: 3 parts, 1 AP" ovanfor upgrade-knappen
- Popup hogre (110px) nar upgrade finns

**src/structures/BladeSpinner.ts:**
- Ny interface BladeSpinnerOverrides {trapDamage, cooldownMs, overheatMax}
- Konstruktorn tar optional overrides -- injiceras av NightScene vid Lv>1
- trapDamage ar nu en public mutabel property (ej hardkodad 25)

**src/structures/FirePit.ts:**
- Ny interface FirePitOverrides {damagePerSecond}
- Konstruktorn tar optional overrides -- injiceras av NightScene vid Lv>1
- damagePerSecond ar nu satt fran overrides (default 15)

**src/scenes/NightScene.ts:**
- Importerar BladeSpinnerOverrides, FirePitOverrides
- Laddar bladeSpinnerDef, firePitDef fran structuresData
- Ny inner-funktion getLeveledStat<T>() -- slår upp upgrades[level] faltet i def, faller tillbaka pa bas-varde
- blade_spinner case: bygger bsOverrides med getLeveledStat for damage/cooldown/overheat
- fire_pit case: bygger fpOverrides med getLeveledStat for damagePerSecond
- nail_board case: anvander getLeveledStat for dmg och uses

## [Unreleased] - 2026-04-04 -- Grid-baserad zombie-steering runt vaggar

### PathGrid: lokal steering for zombies runt vaggar och barrikader

**src/systems/PathGrid.ts (ny fil):**
- Skapar en 2D Uint8Array-grid (MAP_WIDTH x MAP_HEIGHT tiles)
- `updateFromStructures(structures)` -- markerar wall, barricade, cart_wall, chain_wall som blocked
- `getSteeringDirection(fromX, fromY, targetX, targetY)` -- returnerar normaliserad riktningsvektor
- Steering-algoritm: provar idealriktning, sedan +/-45, +/-90, +/-135 grader tills fri cell hittas
- Fallback till rak riktning om alla riktningar blockeras (zombie instaingd av vaggar)
- Ingen full A* -- kors per zombie-pathfind-tick (150ms/500ms), inte varje frame

**src/entities/Zombie.ts:**
- Ny privat field `pathGrid: PathGrid | null = null`
- Ny metod `setPathGrid(grid: PathGrid): void`
- `update()`: om pathGrid finns, anva nder `getSteeringDirection()` istallet for direkt vinkel
- Fallback till befintlig rak-mot-target-logik om ingen grid finns (bakart-kompatibelt)

**src/systems/WaveManager.ts:**
- Ny privat field `pathGrid: PathGrid | null = null`
- Ny metod `setPathGrid(grid: PathGrid): void`
- `spawnEnemy()`: skickar pathGrid-referens till varje zombie vid spawn och pool-reuse

**src/scenes/NightScene.ts:**
- Ny privat field `pathGrid: PathGrid`
- I `create()`: skapar PathGrid och populerar den med strukturer direkt efter `createStructures()`
- I `setupWaveManager()`: skickar pathGrid till waveManager via `setPathGrid()`
- Boss-death spawns: skickar pathGrid till boss-spawnade zombies

**Varfor:** Zombies gick rakt igenom vaggar via physics-pushback utan att navigera runt dem.
Nu styr de runt blockerande strukturer med minimal CPU-kostnad.

## [Unreleased] - 2026-04-04 -- Camp Crew: passivt refugee-system

### Forenklat refugee-system (Camp Crew)

Refugees tilldelas inte langre jobb. Varje refugee ger en passiv bonus automatiskt.

**src/config/types.ts:**
- Lade till `RefugeeBonusType = 'food' | 'scrap' | 'repair'`
- Lade till `bonusType: RefugeeBonusType` pa `RefugeeInstance`

**src/systems/RefugeeManager.ts:**
- Tog bort jobb-tilldelnings-logik fran gathering-flode
- Varje ny refugee far `bonusType` tilldelad vid rescue (cyklar food/scrap/repair jamnt)
- `ensureBonusTypes()`: backward compat -- tilldelar bonusType till gamla saves utan det faltet
- `applyDailyBonuses()`: ger food/scrap till inventory, returnerar repairBonus-antal
- `getDailyFoodBonus()`, `getDailyScrapBonus()`, `getRepairBonus()`: raknar friska refugees per typ
- `healRefugee(id)`: manuell heala en skadad refugee (kostar 1 med), anropas fran panel
- `hasMedsForHeal()`: returnerar om meds finns for healing
- `processHealing()`: auto-healar alla skadade refugees vid dagstart om meds finns (krav pa 'rest'-jobb borttaget)
- `processGathering()`: stub (returnerar nollor) -- gathering sker nu passivt vid dagstart

**src/ui/RefugeePanel.ts:**
- Komplett omskrivning: byt ut jobb-knappar mot enkel Camp Crew-lista
- Visar: portratt | namn | bonustyp (+1 Food/day etc) | status (healthy/injured)
- Enda knapp: "Heal (1 med)" for skadade refugees
- Panel-titel andrad till "CAMP CREW"

**src/scenes/DayScene.ts:**
- `processDayStart()`: anropar `applyDailyBonuses()` och visar Camp Crew-info
- `processDayStart()`: anropar `ensureBonusTypes()` direkt efter RefugeeManager-konstruktion
- `endDay()`: tog bort `processGathering()`-anropet (bonusar appliceras nu vid dagstart)
- Debug-knapp ADD REFUGEE: fick `bonusType: 'food'` pa hardkodat objekt

Anledning: Foljde design fran docs/defense-redesign.md sektion 4 -- forenklat system,
ingen jobb-tilldelning, refugees hjalper automatiskt.

## [Unreleased] - 2026-04-04 -- PackYourBag zone-transition screen

### Ny skärm: PackYourBagScene

**src/scenes/PackYourBagScene.ts (ny fil):**
- Ny Phaser-scen som visas mellan ZoneCompleteScene och DayScene vid zon-byte
- Vapensektionen: visar alla vapen spelaren äger, max 4 kan väljas via klick eller tangent 1-9
- Resurssektionen: +/- knappar och visualiserad bar per resurs, totalt budget 50 enheter
- Budget-display uppdateras live och byter färg (grön/gul/röd) beroende på återstående utrymme
- Refugee-sektionen: visar alla refugees, alla följer med (ingen val)
- Skills-sektionen: visar aktiva skills med nivå, alla behålls
- MOVE OUT-knapp (Enter eller klick): applicerar val och startar DayScene
- Tangentbord: 1-9 vapen, piltangenter Up/Down för resurs-fokus, Left/Right/+/- justering, Enter bekräftar
- applyZoneTransition(): sätter nextZone, ny mapSeed, nollställer bas och equipped, behåller refugees/skills/blueprints

**src/scenes/ZoneCompleteScene.ts (modifierad):**
- Knappen "[ BACK TO MENU ]" byts mot "[ CONTINUE >> ]" om det finns en nästa zon
- Navigerar till PackYourBagScene (med fromZone-data) istället för direkt till MenuScene
- Sista zonen (military cleared) behåller "[ BACK TO MENU ]"-beteendet

**src/main.ts (modifierad):**
- PackYourBagScene importerad och registrerad i scene-arrayen

## [2.7.7] - 2026-04-04

### Forbattrade karaktarsportrait och nya struktur-sprites

**public/assets/sprites/characters/ -- 4 forstarkta 64x64 portraits:**
- `portrait_soldier.png` -- Militarhjälm (HELMET_GREEN), bestämd blick, olivgrön uniform, axelinmarkning
- `portrait_scavenger.png` -- Mork huva, smutsigt ansikte (smuts-pixels), sliten grå jacka, skarf
- `portrait_engineer.png` -- Metallbagade glasogon med linsglimt, verktygsväst med fickor, rufsigt hår
- `portrait_medic.png` -- Vit/rod medicinband i pannan, stetoskop antytt, vit labbrock med rott kors pa bröstet

**public/assets/sprites/ -- 6 nya 32x32 struktur-sprites:**
- `struct_spike_strip.png` -- Metallist med 7 uppåtpekande spikar, blodflackar pa nagra
- `struct_sandbags.png` -- Pyramidhog (3+2+1) sandsakkar i tan med ropbindning
- `struct_bear_trap.png` -- Oppna metallkäftar med taggar, fjader-spole, blodfläckar
- `struct_landmine.png` -- Rund halvbegravd mina, irisregande kupolyta, detonatorknapp
- `struct_oil_slick.png` -- Oregelbunden oljeblobb med regnbagsskimmer (lila/teal/amber)
- `struct_pit_trap.png` -- Morkt oval grop med kamouflage-kvistar, synliga palspetsar inne i gropen

**src/scenes/BootScene.ts:**
- Lade till load.image for alla 6 nya struktur-sprites

**src/config/constants.ts:**
- Versionsnummer uppgraderaat till 2.7.7

**sprite_gen_v277.py** -- generatorskript i projektroten

## [2.5.8] - 2026-04-04

### Multi-tile ghost preview + keyboard nav improvements

**src/data/structures.json:**
- Added `widthTiles: 3` to `glass_shards` (was missing; oil_slick, fire_pit, tar_pit already had it).

**src/systems/BuildingManager.ts:**
- Added `zoneRadius` and `damagePerSecond` optional fields to `StructureData` interface so TypeScript accepts the glass_shards values without errors.

**src/scenes/DayScene.ts -- startPlacement():**
- Ghost preview now reads `widthTiles` from structure data and draws a rectangle that covers the full tile footprint (widthTiles * TILE_SIZE wide and tall).
- Fallback for zone-based structures (e.g. glass_shards): computes tile count from `zoneRadius * 2 / TILE_SIZE`.
- Default remains 1x1 tile for structures with no size fields.
- Ghost stroke width raised from 1 to 2px, alpha 0.9 for better visibility.

**src/ui/LootRunPanel.ts -- handleKey():**
- Added keyboard support for companion selection screen:
  - 1-9 toggles companions by index (same as clicking the entry).
  - Enter starts the run immediately (GO).
  - Backspace returns to destinations list (same as clicking BACK).

**src/ui/EncounterDialog.ts:**
- Already had full keyboard support (1=Fight, 2=Flee, ESC=flee, Enter dismisses result). No changes needed.

**src/ui/BuildMenu.ts:**
- Already had full keyboard nav (1-9, arrows, Enter, Tab). No changes needed.

## [2.5.7] - 2026-04-04

### Polish: Font standardization, tooltip and timing verification

**src/ui/ResourceBar.ts:**
- Fixed fontSize from 11px to 8px for resource number texts (body text standard).

**src/ui/RefugeePanel.ts:**
- Fixed "No survivors yet." from 10px to 8px (body text, not a header).

**src/ui/EquipmentPanel.ts:**
- No changes needed -- font sizes already follow the hierarchy.

**src/scenes/DayScene.ts (tooltips verified):**
- RESOURCE_TOOLTIPS hover system confirmed working: hover over resource bar shows tooltip above.
- Tooltip texts confirmed up to date (scrap/food/ammo/parts/meds descriptions).
- Tooltip positioned at RES_BAR_Y - 2 with setOrigin(0.5, 1) -- stays on screen.

**src/ui/HUD.ts (timing verified):**
- showWaveAnnouncement: delay=2000ms before fade (OK).
- showMessage: delay=2500ms before fade (OK).

**src/scenes/NightScene.ts (timing verified):**
- NO AMMO message: delayedCall(200ms) delay + 2500ms visibility (OK).
- No-fuel trap warning: delayedCall(500ms) delay + 2500ms visibility (OK).

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
