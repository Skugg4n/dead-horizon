# Dead Horizon -- Lessons Learned

Kanda problem och losningar. Kolla har innan du debuggar.

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
