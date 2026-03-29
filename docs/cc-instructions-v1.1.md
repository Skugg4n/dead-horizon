# Instruktioner till Claude Code -- v1.1 Sprint

**Datum:** 2026-03-29
**Fran:** Ola (via Cowork-granskning)
**Syfte:** Kopiera detta till CC som startprompt for nasta session.

---

## Kopiera allt nedan till CC:

---

Hej Lead. Spelet ar pa v1.0.0 och jag har gjort en kodgranskning med Cowork. Det finns tre saker att gora nu, i denna ordning:

### 1. Bugfixar (v1.0.1)

Las docs/v1-fixlist.md -- den innehaller 8 atgarder med kodsnuttar. Prioritetsordning:

1. **Minneslackor** -- NightScene och DayScene saknar shutdown-hantering. Event listeners stadas aldrig vid scenovergang. Fixa detta forst.
2. **Flytta duplicerade konstanter** -- MAP_WIDTH, MAP_HEIGHT finns nu i constants.ts (redan fixat). Uppdatera NightScene.ts och DayScene.ts att importera darifran istallet for lokala definitioner. Gor samma sak med STRUCTURE_COLORS.
3. **Tween-lackor** -- lagg till `this.active`-check i delayedCall-callbacks i Player.ts och Zombie.ts, och `this.tweens.killAll()` i shutdown.

Delegera till @builder. Nar klart, lat @tester verifiera att alla 283 tester fortfarande passerar och att scenovergangar fungerar utan dubbla events.

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

Nar grafiken ar inne, ta itu med prestanda-problemen i NightScene.update():
- Ljus-overlay ritas om varje frame -- lagg till distans-cache
- Pillbox-skytte ar O(n*m) -- anvand physics.closest()
- Zombie pathfinding throttle for on-screen zombies (150ms)

Se docs/v1-fixlist.md punkt 5 for detaljer.

### Regler (paminnelse)

- Bumpa version: 1.0.1 for fixar, 1.1.0 for grafik
- Logga allt i CHANGELOG.md
- Kryssa av i docs/sprite-roadmap.md nar assets skapas
- Alla sprites foljer fargpaletten i docs/art-direction.md EXAKT
- Inga `any`-typer, inga EM dash, all data i JSON

### Nya filer att kanna till

- `.claude/agents/artist.md` -- Artist agent-definition
- `docs/v1-fixlist.md` -- Kodgranskningens atgardslista
- `docs/v1-review-report.md` -- Full granskningsrapport
- `docs/sprite-roadmap.md` -- Komplett asset-plan med prioritet
- `assets/sprites/` -- Befintliga prototyp-sprites (player, walker, runner, brute + walk-sheets)

Klar? Borja med punkt 1 (bugfixar).
