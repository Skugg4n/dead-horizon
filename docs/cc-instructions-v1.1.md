# Instruktioner till Claude Code -- v1.1 Sprint

**Datum:** 2026-03-29
**Fran:** Ola (via Cowork-granskning)
**Syfte:** Kopiera detta till CC som startprompt for nasta session.

---

## Kopiera allt nedan till CC:

---

Hej Lead. Spelet ar pa v1.0.1 (bugfixar redan klara -- bra jobbat). Jag har gjort en kodgranskning och UI-audit med Cowork. Det finns tre saker att gora nu, i denna ordning:

### 1. UI-redesign (v1.1.0) -- HOGSTA PRIORITET

Las docs/ui-redesign.md -- den innehaller komplett spec med layout, positioner och kodexempel.

Nuvarande UI ar obrukbar: knappar overlappar, text staplas pa varandra, inga visuella ramar. Sammanfattning av vad som ska goras:

1. **Skapa UIButton.ts och UIPanel.ts** -- delade komponenter med bakgrunder, ramar, hover-effekter
2. **DayScene**: tva-rads action bar (8 knappar pa TVA rader, inte en), top bar med AP/DAY/base-info, resource bar langst ner med separatorer
3. **NightScene**: forenkla HUD -- top bar (HP, stamina, wave), bottom bar (weapon, ammo, kills). TA BORT resursbaren fran nattscenen
4. **Alla paneler** (Build, Weapons, Skills, Refugees, LootRun, Crafting) -- konvertera till UIPanel med header, stangknapp, konsekvent storlek

Delegera till @builder. Folj steg 1-6 i docs/ui-redesign.md. Lat @tester verifiera att inget overlappar och alla knappar ar klickbara.

### 2. Grafik-sprint (v1.1.0)

Ny agent: @artist (se .claude/agents/artist.md). Hela asset-planen finns i docs/sprite-roadmap.md.

Arbetsflode:
1. Delegera Prio 1 (karaktarer) till @artist
2. @artist skriver Python/Pillow-skript, kor dem, skapar PNG-sprites i assets/sprites/
3. @builder integrerar assets i Phaser (uppdaterar BootScene.ts, ersatter spriteFactory.ts gradvis)
4. @tester verifierar att spelet laddar och visar nya sprites korrekt

Borja med att lata @artist skapa alla sprites for Prio 1 (karaktarer + animationer). Prototyper for player, walker, runner och brute finns redan i assets/sprites/ -- anvand dem som referens for stil och fargval.

Nar Prio 1 ar klart, fortsatt med Prio 2 (strukturer) och Prio 3 (terrain).

### 3. Prestanda (v1.1.1)

Om v1-fixlist.md punkt 5 inte redan ar fixad (kolla CHANGELOG), ta itu med prestanda-problemen i NightScene.update():
- Ljus-overlay ritas om varje frame -- lagg till distans-cache
- Pillbox-skytte ar O(n*m) -- anvand physics.closest()
- Zombie pathfinding throttle for on-screen zombies (150ms)

Se docs/v1-fixlist.md punkt 5 for detaljer.

### Regler (paminnelse)

- Bumpa version: 1.1.0 for UI+grafik, 1.1.1 for prestanda
- Logga allt i CHANGELOG.md
- Kryssa av i docs/sprite-roadmap.md nar assets skapas
- Alla sprites foljer fargpaletten i docs/art-direction.md EXAKT
- Inga `any`-typer, inga EM dash, all data i JSON

### Nya filer att kanna till

- `.claude/agents/artist.md` -- Artist agent-definition
- `docs/v1-fixlist.md` -- Kodgranskningens atgardslista (bugfixar redan klara i 1.0.1)
- `docs/v1-review-report.md` -- Full granskningsrapport
- `docs/ui-redesign.md` -- KOMPLETT UI-spec med layout, positioner, kodexempel
- `docs/sprite-roadmap.md` -- Komplett asset-plan med prioritet
- `assets/sprites/` -- Befintliga prototyp-sprites (player, walker, runner, brute + walk-sheets)

Bugfixar (v1.0.1) ar redan klara. Borja med punkt 1 (UI-redesign).
