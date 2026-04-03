# Dead Horizon -- Trap Mechanics Deep Dive

**Version:** 2.2.0
**Datum:** 2026-04-03

---

## 1. Fäll-livscykel

Varje fälla har dessa egenskaper:

```
NAIL BOARD
  HP: 30          -- Tar skada av zombies som passerar
  Cooldown: 0s    -- Passiv, alltid aktiv
  Overheat: --    -- Kan inte överhettas
  Malfunction: 5% -- Chans att gå sönder per natt
  Uses: 20        -- Antal gånger den kan triggas
```

```
BLADE SPINNER
  HP: 100         -- Tålig maskin
  Cooldown: 4s    -- Snurrar, stannar, snurrar igen
  Overheat: 30s   -- Efter 30s kontinuerlig drift = overheat
  Recovery: 10s   -- Avkylningstid vid overheat
  Malfunction: 15% -- Chans att SLUTA FUNGERA mitt i natten
  Fuel: 1 food/natt -- Kräver bränsle
```

```
MEAT GRINDER
  HP: 150
  Cooldown: 6s    -- Maler, pausar, maler
  Overheat: 20s   -- Överhettas SNABBT vid hög belastning
  Recovery: 15s   -- Lång avkylning
  Malfunction: 25% -- HÖG chans att gå sönder
  Fuel: 2 food/natt
```

---

## 2. Mekaniker

### Cooldown
Fällan aktiveras, gör sin effekt, sedan PAUSAR den.
- Nail Board: 0s (alltid aktiv -- passiv)
- Blade Spinner: 4s mellan varje snurr-cykel
- Meat Grinder: 6s mellan varje mal-cykel
- Fire Pit: Alltid aktiv men bränslet tar slut

Visuellt: fällan glöder/pulserar när aktiv, dov/grå under cooldown.

### Overheat
Mekaniska fällor (Tier 2-3) ÖVERHETTAS vid kontinuerlig användning.

```
Normal:    [====--------] Overheat meter
Varning:   [========----] Glöder orange
Overheat:  [============] STOPP! Rök, gnistor, stannar
Recovery:  [====--------] Kyls ner, startar igen
```

- Fler zombies = snabbare overheat (fler aktiveringer)
- Spelaren kan PRIORITERA: "vilka fällor ska hantera rush?"
- Skapar taktik: sprida ut zombies över flera fällor

### Malfunction
Varje natt har varje mekanisk fälla en CHANS att gå sönder.

```
MALFUNCTION! Blade Spinner at (340, 480) has broken down!
[Floater-text ovanför fällan: "BROKEN!" i rött]
```

Spelaren måste SPRINGA DIT och reparera (håll ner E i 2s).
Kostar: 1 parts per reparation.
Under tiden: fällan gör INGENTING. Lucka i försvaret!

Skapar spänning: "shit, Meat Grinder gick sönder och wave 4 kommer!"

### Fuel
Tier 2-3 fällor kräver bränsle (food) per natt.

- Blade Spinner: 1 food/natt
- Fire Pit: 2 food/natt
- Meat Grinder: 2 food/natt  
- Flame Thrower Post: 3 food/natt

Ingen fuel = fällan startar inte. Tvingar resursprioritering.

---

## 3. Fäll-leveling

Fällor kan UPPGRADERAS med parts:

| Fälla | Lv 1 | Lv 2 (3 parts) | Lv 3 (8 parts) |
|-------|------|----------------|----------------|
| Nail Board | 10 dmg | 15 dmg, 25 uses | 20 dmg, 35 uses |
| Blade Spinner | 25 dmg, 4s cd | 35 dmg, 3s cd | 50 dmg, 2s cd, -50% overheat |
| Fire Pit | 15 dmg/s | 25 dmg/s | 35 dmg/s, 3 nätter |
| Meat Grinder | 50 dmg/s | 70 dmg/s, -25% overheat | 100 dmg/s, -50% malfunction |

Leveling minskar svagheter:
- Lv 2: Bättre stats
- Lv 3: Bättre stats + reducerad overheat/malfunction

---

## 4. Böcker/Blueprints: Lär dig nya fällor

Fällor LÅSAS UPP via blueprints som hittas på loot runs.

### Start (alltid tillgängliga):
- Nail Board
- Trip Wire
- Glass Shards
- Barricade
- Wall

### Blueprints (hittas på loot):

| Blueprint | Finns på | Chans | Låser upp |
|-----------|----------|-------|-----------|
| "Improvised Electronics" | Ranger Station | 15% | Shock Wire, Noise Maker |
| "Engine Mechanics 101" | Abandoned Store | 10% | Blade Spinner |
| "Fire Safety (Reversed)" | City Ruins | 12% | Fire Pit, Flame Thrower Post |
| "Military Field Manual" | Military Outpost | 8% | Spring Launcher, Chain Wall |
| "Junkyard Engineering" | Nearby Houses | 10% | Meat Grinder, Razor Corridor |
| "Demolition for Dummies" | Armory | 5% | Car Bomb, Landmine |
| "Trapper's Handbook" | Ranger Station | 12% | Bear Trap, Pit Trap |

Blueprints visas som:
```
LOOT RUN RESULT:
  Found: 5 scrap, 2 ammo
  BLUEPRINT: "Engine Mechanics 101"
  NEW TRAP UNLOCKED: Blade Spinner!
```

Blueprints BEHÅLLS mellan zoner (som skills).

---

## 5. Kill Corridor Design

Optimal layout med cooldown i åtanke:

```
Zombies →
  [Trip Wire]     -- Stun 1.5s (inga cd)
  [Glass Shards]  -- DOT (inga cd)
  [Nail Board]    -- Dmg + cripple (inga cd)
  [Shock Wire]    -- Stun 3s (cd 8s)
      GAP         -- Shock Wire cooldown-zon
  [Blade Spinner] -- AOE dmg (cd 4s, overheat 30s)
      GAP         -- Spinner overheat-zon  
  [Fire Pit]      -- Burn zone (alltid aktiv, fuel)
  [Meat Grinder]  -- Massiv dmg (cd 6s, overheat 20s)
      GAP         -- Grinder recovery-zon
  [Chain Wall]    -- Sista barriär
  BASE
```

Gappen finns för att:
- Passiva fällor (Trip Wire, Glass, Nails) har inga cd → placeras tidigt
- Mekaniska (Spinner, Grinder) har cd → behöver GAP så de hinner återhämta sig
- Om allt klumpas ihop: overheat = alla stannar = genombrott

---

## 6. Nattlig repair-mekanik

Under natten kan spelaren:

**Reparera trasiga fällor:**
- Spring till fällan
- Håll E i 2 sekunder
- Kostar 1 parts
- Visuellt: skruvnyckel-ikon, progress-bar

**Manuellt kyla ner overheated fällor:**
- Spring till fällan  
- Håll E i 1 sekund
- Gratis, men tar tid
- Halverar recovery-tiden

**Bygga nya fällor UNDER natten:**
- Kostar dubbelt material (panik-bygge)
- Tar 3 sekunder att placera (sårbar)
- Taktiskt: "wave 3 bryter igenom vänster -- snabbplacera en Wall!"

---

## 7. Visuellt: Fäll-status

Varje fälla visar sin status tydligt:

```
AKTIV:       Grön puls/glöd
COOLDOWN:    Grå, timer-siffra ovanför
OVERHEAT:    Orange glöd, rök-partiklar
MALFUNCTION: Röd blinkande, "!" ikon
DESTROYED:   Brun skräphög
```

---

## 8. Implementation-prioritet

1. Cooldown-system på befintliga fällor
2. Overheat-meter (visuellt + mekaniskt)
3. Malfunction-chans per natt
4. Nattlig repair (E-tangent vid fälla)
5. Blueprint-system (loot run drops)
6. Fäll-leveling (upgrade med parts)
7. Fuel-kostnad per natt
8. Tier 2 + Tier 3 fällor
