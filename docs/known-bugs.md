# Dead Horizon -- Known Bugs & Issues

Denna fil trackar alla kända buggar och uppgifter. Stryks INTE förrän verifierade som fixade.
Uppdaterad: 2026-04-09, v6.1.2

---

## AKTIVA (2026-04-09)

### BG4: Collider matchar inte visuella hål i muren ✅ FIXAD v6.3.0
- Rotorsak: Player och Zombie hade default physics body = 32x32 = exakt lika stort som en
  vägg-tile (32px). Ett 1-tile-gap var exakt lika brett som spelarens/zombiens kropp, så
  vilken som helst subpixel-osynk gav kollision. Inte ett pathfinding-problem.
- Fix: body.setSize(20, 20) + setOffset(6, 6) på båda entities. Ger 6px slack per sida.
- Samma fix löser BG/Ai: zombies kan nu faktiskt följa A*-paths genom smala gap.

### BG7: Terrängdekor ser ut som duplicerade byggnader
- Användaren bygger strukturer i mitten av kartan, men när natten börjar tycks "samma
  saker" ha spawnats på vänster sida av kartan (Forest, Night 5/5).
- Sannolik orsak: Forest terrain-decor (drawCrate, drawStone, drawStump) har visuell
  stil som överlappar med built structures (barricade, sandbags, wooden crate-like walls).
  Det är alltså INTE ett spawn-bug -- det är en visuell förväxling där terrängdekor
  ser ut som byggda strukturer.
- Verifiering: mini-mappen i screenshotet visar structures BARA runt basen, inte på
  vänster sida. Alltså är left-side-sakerna inte i `gameState.base.structures`.
- Fix: differentiera terrängdekor visuellt -- mörkare färger, mer "natural" shapes,
  eller annan outline-style. Alternativt lägg till en subtil glow/aura kring riktiga
  byggda strukturer så spelaren ser vad som är "deras".
- Status: EJ FIXAD -- visuell polish, men viktig för att inte förvirra spelaren.

### BG6: Hittade items syns aldrig i Inventory
- Användaren rapporterar att en massa saker som hittas (loot runs / nattens pickups)
  aldrig dyker upp i inventory. Senaste exemplet: "Improvised plate" -- hittades men
  finns inte i inventory efteråt.
- Möjliga orsaker: (a) LootManager matchar inte item-id mot ett inventory-slot (armor
  läggs i armorInventory, inte weapons), (b) crafting-result hamnar i fel array, (c)
  pickup-spawned-items får visuellt feedback men sparas inte till gameState, (d) sync
  till gameState missar vissa fält så items försvinner vid scene-byte.
- Reproduktion: kör loot run tills Improvised Plate dyker upp, verifiera att den inte
  syns i Equipment Panel > Armor tab efteråt.
- Startpunkter för debug:
  - src/systems/LootManager.ts (hur loot skrivs till gameState.inventory.armorInventory)
  - src/systems/CraftingManager.ts (crafting-resultat -- Improvised Plate är ett recipe)
  - src/ui/EquipmentPanel.ts (renderar den armor-tab:en från rätt array?)
  - DayScene vs NightScene pickup-handlers (sync till gameState innan scene-byte?)
- Status: EJ FIXAD -- prioritera efter AI-fixen landat.

### BG5: Nunchucks fastnar på Lv3 Enhanced trots många kills
- Användaren rapporterar att weapon-XP inte känns som att den leds hela vägen till Supr/Ult.
- Designintention: xpPerLevel = [0, 10, 25, 50, 100]; Lv3→Lv4 kräver 50 weapon-XP (1 XP per kill).
  Lv4→Lv5 (ULT) är manuell unlock med parts+scrap, INTE XP-baserat.
- UI-problem: EquipmentPanel visar inte weapon.xp eller "X/Y till nästa tier", så spelaren ser
  inte progressionen. Add UI: visa `xp/needed` under tier-raden för nuvarande nivå.
- Status: EJ FIXAD (UX clarity)

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
- BG2: Continue efter krasch -- SaveManager rensar korrupt data + returnerar defaults (v2.0.3) ✅
- BG3: Gråade items -- Build-menyn visar "Not enough X" i röd text under disabled items (v2.4.0) ✅
- BG1: TrapBase scene.sys guard -- borttagen (v2.5.1). Guard var defensiv kod för omöjligt scenario i Phaser lifecycle. Skapade trasiga fällor som kraschade vid update(). Nu kraschar tydligt om scene.sys saknas (vilket aldrig händer). ✅

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
- Forest→City→Military med zone panel, FINAL NIGHT, ZoneCompleteScene
- Status: IMPLEMENTERAD (v2.5.0) -- kvar: Pack Your Bag, Endless Mode

### GP2: Pack Your Bag (mellan-zon-val)
- Välj vapen (max 4) och resurser (max 50) att ta med
- docs/zone-progression.md
- Status: DESIGN KLAR

### GP3: Blueprint-system
- Blueprints hittas på loot runs, filtrerar build-menyn
- Status: IMPLEMENTERAD (v2.5.0)

### GP4: Fäll-leveling
- Uppgradera fällor med parts (Lv 1→3)
- docs/trap-mechanics.md
- Status: DESIGN KLAR

### GP5: ~37 fällor kvar att implementera
- docs/trap-catalog.md har 50 fällor, 13 implementerade
- Status: PÅGÅENDE

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

### UX1: Ammo-mekanik
- Manuell shooting (v2.6.0) + laddar allt ammo (v2.6.1)
- Status: FIXAD

### UX2: Meds-syfte otydligt
- Behöver visas i refugee-panel
- Status: EJ FIXAD

### UX3: Resurs-tooltips
- Hovra = förklaring av vad resursen gör
- docs/inventory-redesign.md
- Status: EJ FIXAD
