# Dead Horizon -- Lessons Learned

Kanda problem och losningar. Kolla har innan du debuggar.

---

## Zombie death-animation

### Komplexa death-tweens skapar svarta skuggor
**Problem:** Die()-metoden anvande flerstegs-tweens (vit blixt, skalforraning, vinkel-rotation, morknad corpse som legat kvar 10-15 sekunder). Vid pool-reuse avbryts inte alltid tweens korrekt, och corpses med setTint(0x441111) + setAngle() + setDepth(1) blev svarta skuggor som fortsatte rora sig.
**Losning:** Forenkla die() drastiskt: vit blixt (80ms) sedan setActive(false) + setVisible(false). Inga corpses, inga tweens, inga safety-timers. Blod-splatters och loot hanteras av NightScene via 'zombie-killed'-eventet.

### Wanderer-zombies vandrar planlost
**Problem:** 30% av zombies fick aggroType 'wanderer' som fick dem att vandra langs kartkanterna istallet for att attackera basen. Sag ut som en bugg for spelaren.
**Losning:** Ta bort wanderer-grenen i update(). Alla zombies gar mot basen (eller ljud/spelare). Behal aggroType-propertyn men satt alltid 'base_seeker'.

---

## Projektsetup

### Vite static assets maste ligga i public/
**Problem:** Sprite-PNGs i assets/ (projektroten) serverades korrekt i dev-servern men kopierades INTE till dist/ vid build. Alla sprites saknades i produktion (GitHub Pages), vilket orsakade fallback-texturer overallt -- gra rektangel for basen, gron blob for spelaren, enfargad bakgrund istallet for terrain-tiles.
**Losning:** Flytta assets/ till public/assets/. Vite kopierar allt i public/ till dist/ vid build. Samma relativa sokvagar ('assets/sprites/player.png') fungerar bade i dev och produktion.

### Google Drive och npm
**Problem:** node_modules i Google Drive orsakar synkproblem (tusentals filer).
**Losning:** Projektet ligger i ~/Projects/dead-horizon, INTE i Google Drive. Docs kopierades dit fran Drive.

### Vite och icke-tomma mappar
**Problem:** `npm create vite@latest . -- --template vanilla-ts` kraschar om mappen inte ar tom.
**Losning:** Satt upp Vite manuellt med package.json, tsconfig.json och vite.config.ts.

---

## Scen-livscykel

### Phaser-scener instansieras vid spelstart, inte vid scene.start()
**Problem:** `private gameState = SaveManager.load()` i klasskroppen kor vid instansiering (spelstart), inte nar scenen startas. Sparade andringar fran tidigare scener ignoreras.
**Losning:** Ladda alltid gameState i `create()`, aldrig som property initializer.

### JSON-laddning i Phaser -- anvand ES import, inte this.load.json med src/-sokvag
**Problem:** `this.load.json('key', 'src/data/file.json')` fungerar i dev (Vite serverar root) men misslyckas i prod-build (src/ finns inte i dist/).
**Losning:** Anvand `import data from '../data/file.json'` istallet. Vite bundlar JSON automatiskt.

### setScrollFactor(0) + interaktiva UI-element i scrollad kamera
**Problem:** UI-element med setScrollFactor(0) renderas pa ratt stallning pa skarmen, men deras klickzoner foljer kamerans scroll-position. Resulterar i att knappar och menyer inte gar att klicka nar kameran har scrollat.
**Losning:** Anvand tva kameror: en main camera som scrollar over kartan och en separat UI-kamera fixerad vid (0,0). UI-element laggs till med cameras.main.ignore() sa de bara syns pa UI-kameran. Varldsombjekt laggs till med uiCamera.ignore() sa de inte renderas dubbelt. Ingen setScrollFactor(0) behovs langre for UI.

### Build menu pointerdown propagerar till scene input
**Problem:** Att klicka pa en struktur i build-menyn kallar startPlacement() som satter placementMode = true. Samma pointerdown-event propagerar sedan till scenens generella input.on('pointerdown') handler, som ser placementMode = true och direkt placerar strukturen pa klick-positionen.
**Losning:** Lagg till en placementJustStarted-flagga som satts i startPlacement() och kontrolleras/nollstalls i den generella pointerdown-handlern, sa att det forsta klicket efter val av struktur ignoreras.

### Dubbla event-emits vid wave-completion
**Problem:** WaveManager.onEnemyKilled() emittar bade wave-complete och all-waves-complete for sista waven. Om wave-complete-handlern ocksa startar nasta wave emittas all-waves-complete igen fran startWave().
**Losning:** Kontrollera wave-nummer i wave-complete-handlern och starta inte nasta wave om det var sista.

### Sprite-laddning och programmatiska fallbacks
**Problem:** generateAllTextures() i preload() skapar texturer med samma nycklar som this.load.image() forsoker ladda. Laddade bilder overskriver programmatiska texturer, men om en bild saknas registreras aldrig nagon textur for den nyckeln.
**Losning:** Ladda alla sprites i preload() med this.load.image/spritesheet. Flytta generateAllTextures() till create() -- da har laddningen slutforts. Varje generate-funktion kollar `scene.textures.exists(key)` och hoppar over om texturen redan finns. Misslyckade laddningar ignoreras tyst (loaderror-event), och fallback-texturen skapas istallet.

### CLOSE_ALL_PANELS re-entrancy vid build menu
**Problem:** Build-menyn i DayScene anvander sin egen rendering (inte UIPanel) men behover delta i CLOSE_ALL_PANELS-systemet for omsesidig exklusion med UIPanel-baserade paneler. Nar toggleBuildMenu() emittar CLOSE_ALL_PANELS for att stanga andra paneler, triggas aven den egna lyssnaren som direkt stanger build-menyn igen.
**Losning:** Anvand en buildMenuOpening-flagga som satts innan CLOSE_ALL_PANELS emittas och nollstalls efter. Lyssnaren kollar flaggan och ignorerar eventet om build-menyn haller pa att oppnas.

### ResourceBar.setText kraschar efter scenovergang
**Problem:** ResourceBar lyssnar pa resource-changed events. Nar scenen forstors (t.ex. vid overgang fran NightScene till DayScene) forstors Text-objektens WebGL-texturer, men event-lyssnaren lever kvar. Nasta resource-changed-emit orsakar "Cannot read properties of null (reading 'glTexture')".
**Losning:** Lagg till `!text.active`-check i updateResource() innan setText() anropas.

---

## Rendering

### Natt-overlay (RenderTexture) orsakar gra rektangel
**Problem:** World-space RenderTexture (1280x960) tackte inte hela kartan, skapade en mork rektangel i ovre vanstra hornet. Bytte till screen-space men det var fortfarande buggigt.
**Losning:** Tog bort hela natt-overlayen. Anvand morkare bakgrundsfarg (#0F1A0F) istallet. ALDRIG anvand RenderTexture for helskarms-overlays i Phaser.

### FogOfWar gomde zombies
**Problem:** FogOfWar.updateZombieVisibility() satte zombie.setVisible(false) for zombies i ej avslojad area. Med overlay borttagen blev zombies helt osynliga.
**Losning:** Tog bort zombie visibility-uppdatering helt. Alla zombies alltid synliga.

---

## Save System

### Gamla saves kraschar nya versioner
**Problem:** GameState-formatet andras mellan versioner (nya falt: zone, achievements, stats, zoneProgress, loadedAmmo, nya SkillTypes). Gamla saves saknar dessa falt och orsakar TypeError.
**Losning:** SaveManager.load() mergar sparad data med defaults fran createDefaultState(). Varje nytt falt maste finnas i defaults OCH i merge-logiken. Testa alltid Continue-knappen med en gammal save.

---

## Gameplay

### Zombie target -- bas vs spelare
**Problem:** Zombies gick alltid mot spelaren, bas var irrelevant.
**Losning (v1.6.0):** Zombies far basePosition (kartans centrum) som default-mal. Gar mot basen. SoundMechanic (weapon-fired event) overrider temporart med spelarens position via onSoundHeard(). Tystare vapen = zombies ignorerar spelaren langre.

### Byggmeny stangde efter varje placering
**Problem:** cancelPlacement() anropades efter varje lyckat bygg.
**Losning:** Ta bort cancelPlacement() efter lyckat bygg, bara uppdatera resursdisplay. Spelaren kan placera flera strukturer i rad.

---

## Crashes

### Skjut-krasch (target redan dod)
**Problem:** tryAutoShoot hittade en zombie, men mellan detect och shootAt dog zombien. shootAt forsoke komma at properties pa en inaktiv sprite.
**Losning:** Lagg till `if (!target.active) return;` som forsta rad i shootAt(). Dubbelkolla ocksa att nearestZombie fortfarande ar aktiv direkt INNAN shootAt()-anropet i tryAutoShoot() -- en zombie kan dod under samma frame om en trap-overlap processades tidigare i update-cykeln.

### Continue-krasch -- saknade falt i gamla saves
**Problem:** WeaponManager.getWeaponStats() itererade `weapon.upgrades` (for...of) men faltet saknades i saves fran pre-v1.4. Resulterade i "Cannot read properties of undefined (reading Symbol.iterator)".
**Losning:** SaveManager.load() maste normalisera VARJE weapon-objekt: `upgrades: w.upgrades ?? []`. Samma monster galler StructureInstance.hp/maxHp -- normalisera med fallback 100 om saknas. Regel: nar ett nytt falt laggs till pa en sub-objekt i en array (weapons[], structures[]), maste SaveManager.load() patcha VARJE element i arrayen, inte bara top-level-objektet.

### Migration av upgrades-format (string[] till WeaponUpgrade[])
**Problem:** Saves fran v1.4-v1.9 sparar upgrades som `string[]` (t.ex. `["damage_boost"]`). Fran v2.0 ar formatet `WeaponUpgrade[]` (t.ex. `[{ id: "damage_boost", level: 1 }]`). Utan migration kraschar alla saves som forstoker iterera upgrade.id.
**Losning:** SaveManager.load() anropar `migrateUpgrades(w.upgrades ?? [])` for varje vapen. Funktionen kontrollerar om varje element ar en strang (gammalt format) eller ett objekt (nytt format) och konverterar strings till `{ id, level: 1 }`. Monstret: migrering maste ske INNE i weapons.map() -- samma plats dar upgrades normaliseras.

### Spitter-krasch (spelare redan dod)
**Problem:** Spitter-projektil traffade spelare efter spelarens dod. takeDamage pa forstord sprite kraschade.
**Losning:** Lagg till `!this.player.active` guard i alla overlap-callbacks som anropar player.takeDamage().

### Pillbox skjuter inte -- this.physics.closest() finns inte i Phaser 3
**Problem:** Koden anvande `this.physics.closest()` -- existerar INTE i Phaser 3 Arcade Physics.
**Losning:** Manuell for...of-loop med distanceBetween().

---

## Visuella effekter

### Zombie corpse depth -- aktiva sprites vs lik
**Losning:** I die(): satt `this.setDepth(1)` sa corpses hamnar under levande zombies (depth 5).

### Graphics.setRotation() i Containers
**Losning:** Container.destroy() forstorer alla barn automatiskt -- anvand for blood splatter cleanup.

### Pitch variation pa Web Audio API BufferSource
**Losning:** Satt `source.playbackRate.value = 0.9 + Math.random() * 0.2` pa varje ny BufferSource.

## Zombie aggro

### aggroType maste aterstalas vid reset()
**Losning:** Nollstall `aggroType = 'base_seeker'` och `flankTarget = null` i reset().

### Wanderers v2 -- flanking istallet for planlost vandrande
**Problem:** Forsta implementationen lat wanderers vandra langs kartkanterna. Sag ut som en bugg.
**Losning (v1.9.0):** Wanderers valjer nu en "flank point" 120-320px fran basens centrum i slumpmassig riktning. Nar de nar punkten valjer de en ny. Resultatet ar att de cirklar runt basen och attackerar fran oventade vinklar -- ser intentionellt ut, inte buggigt.

---

## Loot System

### Zone-specifika destinationer -- fallback vid okand zon
**Problem:** Om en gammal save har en zon som inte langre matchar nagot zone-falt i loot-tables.json returneras en tom lista, och spelaren ser inga destinationer att valja.
**Losning:** `LootManager.getDestinations()` kollar om filterresultatet ar tomt och faller tillbaka pa hela listan. Alltid ha ett fallback-steg nar man filtrerar data baserat pa spelstatus.

---

## UI

### Dialog/panel overflow -- berakna hojd dynamiskt
**Problem:** Fasta DIALOG_HEIGHT ger overflow eller tomt utrymme.
**Losning:** Mata text-hojd med temporart Text-objekt. Klamra till MAX_H = GAME_HEIGHT - 60.

### Non-null assertions (!) ger ESLint-fel
**Losning:** Anvand `?? 0` istallet for `!`-assertion.

### Tangentbordsgenvag kolliderar med onKeydown-handler
**Losning:** Spara referens till handler och anropa `keyboard.off('keydown', handler)` vid dismiss.

### Central keyboard router for nested panels/dialogs
**Problem:** Multiple individual keydown-X handlers fire even when a modal dialog or panel is on top, causing unintended actions (e.g., pressing B opens build menu behind an event dialog).
**Losning:** En enda `keyboard.on('keydown')` handler i DayScene som testar dialogs/panels i prioritetsordning. Varje panel/dialog exponerar `handleKey(key: string): boolean` -- returnerar true om tangenten hanterades. Routern testar dialogs forst (EventDialog, EncounterDialog), sedan oppna paneler, sedan byggmeny, sedan globala genvagar. Om nagon nivaa returnerar true avbryts kedjan.

### UIPanel click-outside-to-close med dual camera system
**Problem:** UIPanel backdrop (full-screen invisible Graphics) skapas via scene.add.graphics() och hamnar pa main camera. I DayScenes dual-camera-system (scrollande main + fixerad UI) maste backdrop registreras pa UI-kameran via addToUI().
**Losning:** UIPanel exponerar getBackdrop(). DayScene anropar addToUI(panel.getBackdrop()) for varje UIPanel-baserad panel efter getContainer(). Backdrop ar depth 99, panel container depth 100 -- backdrop fanger klick utanfor panelen.

### Tutorial och EventDialog overlap
**Problem:** `checkRandomEvent()` anropades i `create()` FORE `showDayTutorial()`, sa bada dialogs visades direkt vid dag 1.
**Losning:** Flytta `checkRandomEvent()` EFTER tutorial-kontrollen. Lagg till en `tutorialShowing`-flagga pa scenen. `showDayTutorial()` satts flaggan till true direkt. I `advance()` nar alla steg ar klara: nollstall flaggan och anropa `checkRandomEvent()`. I `create()`: hoppa over `checkRandomEvent()` om `tutorialShowing === true`.

### Per-tile fillRect skapar synliga seams i vag och base-area
**Problem:** Road och base-area i NightScene/DayScene ritades med individuella `fillRect` per tile. Varje rect hade nagra pixels skillnad i farg vilket skapade ett rutmonster av bruna block.
**Losning:** Ersatt med fa breda `fillRect` (ett per lager) som spanner hela kartbredden for vagen. Base-area ersatt med `fillEllipse` for en slat cirkel. Inget per-tile-loopar behovs langre for dessa former.

### physics.world.setBounds MASTE anropas FORE generateTerrain
**Problem:** DayScene anropade generateTerrain() FORE physics.world.setBounds(). TerrainGenerator laser scene.physics.world.bounds for att veta kartans dimensioner. Utan setBounds anvands Phasers default (800x600) istallet for kartans storlek (1280x960). NightScene hade ratt ordning. Resultatet: dekorationer placerades pa helt olika positioner.
**Losning:** Flytta setBounds() FORE generateTerrain() i DayScene.createMap(). Larde oss: ordning spelar roll -- alla beroenden maste vara initialiserade FORE de anvands.

### Deploy failure: tester maste uppdateras vid typandringar
**Problem:** CI/CD deploy failade tyst nar WeaponInstance.upgrades andrades fran string[] till WeaponUpgrade[]. Lokalt passerade testerna (genom att kora npm run test), men pa GitHub Actions anvandes en renare environment dar type-mismatch fangades.
**Losning:** Nar du andrar dataformat (t.ex. string[] -> object[]), sok ALLTID igenom tests/-mappen efter alla tester som anvander gamla formatet. Kor `npm run test` lokalt och verifiera 283/283 INNAN push. Kontrollera GitHub Actions-status efter push.

---

## Placement ghost och multi-tile strukturer

### Ghost preview visade alltid 1x1 tile
**Problem:** startPlacement() ritade alltid en TILE_SIZE x TILE_SIZE ghost, oavsett om strukturen ocksa har widthTiles > 1 (oil_slick, fire_pit, tar_pit, glass_shards ar 3 tiles breda).
**Losning:** Las `widthTiles` fran StructureData i startPlacement(). Om `widthTiles > 1` ritas ghosten som `widthTiles * TILE_SIZE` bred och hog. For zone-baserade strukturer (glass_shards har `zoneRadius` istallet) beraknas storleken som `round(zoneRadius * 2 / TILE_SIZE) * TILE_SIZE`. Alltid addera `widthTiles` till structures.json for strukturer med bredare fotavtryck.

---

## BuildMenu och DayScene

### Ny BuildMenu-klass vs inline build menu i DayScene
**Problem:** DayScene hade ett inline build-menu (createBuildMenu/refreshBuildMenuAffordability/rebuildBuildMenu) med egna container-refs. Nar BuildMenu.ts omskrevs till en klass maste DayScene uppdateras simultant -- annars far man kompileringsfel pa buildMenuContainer/buildMenuEntries som inte langre finns.
**Losning:** Ersatt tre privata metoder + tre privata falt med ett enda `private buildMenu: BuildMenu`. toggleBuildMenu() anropar buildMenu.show()/hide(). rebuildBuildMenu() anropar buildMenu.destroy() + ny createBuildMenu().

### TypeScript -- super() maste vara rot-nivastutement i konstruktor
**Problem:** Forsok att lagga `if (!scene.sys) { super(scene as any); return; }` som guard ger TS2401: "A 'super' call must be a root-level statement within a constructor of a derived class".
**Losning:** Kalla super() alltid forst, sedan lagg guardar EFTER super(). Om scene.sys saknas efter super() logga ett fel och hoppa over allt efterfoljande (statusText, draw, add.existing). NightScenes try/catch runt varje konstruktoranrop fangar andvandra kraschar.

---

## TrapBase och mekaniska fallor

### ResourceManager.spend() tar (type, amount) -- INTE ett objekt
**Problem:** TrapBase-integration behover dra fuel-resurser vid nattstart. Det ar frestande att skriva `resourceManager.spend({ food: 2 })` (som canAfford() accept), men spend() tar tva separata args: `spend(type: ResourceType, amount: number)`.
**Losning:** Anvand `resourceManager.spend('food', amount)`. For batch-avdrag, anropa spend() en gang per resurstyp. canAfford() accepterar objekt men spend() gor det INTE.

### TrapBase.update() maste anropas fran NightScene.update() via _lastDelta
**Problem:** checkZombieStructureInteractions() har inte tillgang till delta (frame-tid). Men TrapBase.update(delta) behovar det for att raekna ned cooldown och overheat.
**Losning:** Lagra delta i `this._lastDelta` i scene.update() och anvand det i updateMechanicalTraps(). Alternativt kan TrapBase lasas delta via scene.game.loop.delta, men explicit passing ar tydligare.

### Phaser Graphics extends och destroy()-override
**Problem:** TrapBase skapar en statusText (Phaser.GameObjects.Text) som ett separat game object. Om TrapBase.destroy() anropas (t.ex. nar HP = 0) forstors Graphics-objektet men statusText lever kvar.
**Losning:** Override destroy() i TrapBase och kalla statusText.destroy() dar. Kolla alltid att statusText.active === true innan destroy() for att undvika double-destroy vid scene-shutdown.

## Auto-load ammo system

### autoLoadAmmo() maste koras EFTER weaponManager skapas
**Problem:** autoLoadAmmo() behovar WeaponManager for att slå upp ammoPerNight per vapen (via WeaponManager.getWeaponData()). Logiken kan inte koras fore weaponManager-instansiering.
**Losning:** Placera autoLoadAmmo()-anropet direkt efter `this.weaponManager = new WeaponManager(...)` och EquipmentPanel.autoEquipIfNeeded(). Returvarde (loaded ammo) tilldelas this.loadedAmmo.

### HUD.updateWeapon kallas fran NightScene med PRIMARY-vakpen
**Problem:** Efter redesignen visar slot [1] alltid primary-vapnet, slot [2] alltid secondary -- oavsett vilket som ar aktivt. setActiveSlot(1|2) lyfter fram aktivt tangent-nummer.
**Losning:** updateWeaponHUD() i NightScene uppdaterar bada slots separat: updateWeapon() for primary, updateSecondaryWeapon() for secondary. jamfor activeWeapon.id mot primaryWeaponId for att avgora vilket slot som ar aktivt.

---

## Vapen och projektiler

### Ranged specialeffekter kräver specialEffect-fält pa Projectile
**Problem:** NightScene's collision-callback for projektil-zombie behover veta vilken specialeffekt projektilen bar (piercing = hoppa over deactivate, incendiary = skapa brannzon). Men Projectile-klassen hade bara `damage`.
**Losning:** Lagg till `specialEffect: WeaponSpecialEffect | null` pa Projectile-klassen. `fire()` tar emot det som valfri parameter. `fireProjectile()` i NightScene skickar med `stats.specialEffect`. Collision-callback laser `proj.specialEffect` och kallar `applyRangedSpecialEffect()`.

### Phaser Graphics -- get active() kan inte overrida property
**Problem:** `get active(): boolean { return super.active && ... }` i en klass som extends `Phaser.GameObjects.Graphics` ger TS2611 (defined as property, not accessor) och TS2855 (not accessible via super).
**Losning:** Byt till en vanlig metod, t.ex. `isAlive(): boolean`. Anropande kod maste uppdateras fran `.active` till `.isAlive()`.

### Dag/Natt visuell layout-diskrepans
**Problem:** DayScene och NightScene anvande identisk seed till generateTerrain() men såg anda olika ut. Orsaken var att DayScene hade EXTRA hardkodad dekorationskod (14 buskar/blommor/stenar langs kartkanterna) som INTE existerade i NightScene.
**Losning:** Ta bort all scen-specifik dekorationskod. ALL dekoration ska komma fran TerrainGenerator.generateTerrain() (samma funktion, samma seed). Lagg till console.log for seed i bada scenerna (`[DayScene] terrain seed = X`, `[NightScene] terrain seed = X`) sa man kan verifiera att de matchar.

### Toolbar null-gap-pattern orsakar array-typ-fel vid toolbar-refactor
**Problem:** Toolbar-arrayen hade typen `(ToolbarButton | null)[]` med null-entries for visuella gap. Nar man refactorar toolbar (tar bort knappar) maste man ocksa ta bort null-entries och uppdatera loopen som hoppade over dem.
**Losning:** Byt till enkel `ToolbarButton[]` utan nulls. Berakna totalWidth med `(n-1) * gap` istallet. Loopen behovar inte langre noll-check.

---

## Natt-events och vädersystem

### Graphics-klasser vs TrapBase -- malfunctionChance-fel
**Problem:** applyRainEffectsToTraps() byggde en lista av alla "mekaniska fällor" for att modifiera malfunctionChance. CartWall, ShoppingCartWall, CarWreckBarrier, DumpsterFortress extends Graphics (inte TrapBase) och saknar malfunctionChance -- detta orsakar TS2339.
**Losning:** Undvik att lagga icke-TrapBase-klasser i allMechanical-listan. Grans: bara klasser som extends TrapBase har malfunctionChance/malfunctioned. Kontrollera arvet med `grep "class.*extends"` innan du bygger lista.

### WaveManager zombie-spawned-event for Blood Moon
**Problem:** Blood Moon behover modifiera alla zombies som spawnas under natten, men NightEventManager har inte direkt access till WaveManager eller zombieGroup.
**Losning:** Lagg till `this.scene.events.emit('zombie-spawned', zombie)` i WaveManager.spawnEnemy() for bade nya och poolade zombies. NightScene lyssnar pa eventet och applicerar multipliers. Monster: kommunicera via events, inte direkta beroenden.

### for-loop arrayaccess med noUncheckedIndexedAccess
**Problem:** TypeScript strict mode flaggar `for (let i = ...; ) { const ev = arr[i]; ev.property }` som "possibly undefined" om tsconfig har noUncheckedIndexedAccess.
**Losning:** Lagg till `if (!ev) continue;` guard direkt efter index-accessen.
