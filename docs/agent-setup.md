# Dead Horizon -- Agent Team Setup

**Version:** 0.1.0
**Datum:** 2026-03-28
**Status:** Draft

---

## 1. Översikt

Vi använder **Claude Code sub-agents** (custom subagents) som primär arbetsmetod. Varje agent har ett tydligt ansvarsområde, egna verktyg och en fokuserad systemprompt.

Sub-agents fungerar bäst för vårt projekt eftersom:
1. Uppgifterna är mestadels sekventiella (bygg feature -> testa -> iterera)
2. De behöver inte kommunicera med varandra i realtid
3. Lägre token-kostnad än agent teams
4. Stabilare (agent teams är experimentella)

Vi kan lägga till Agent Teams senare om vi behöver parallellt arbete (t.ex. bygga flera oberoende system samtidigt).

---

## 2. Agent-roller

### 2.1 Lead (Orchestrator)

**Syfte:** Läser projektplan, bestämmer nästa steg, delegerar till Builder och Tester. Håller koll på helheten.

**När du använder den:** Detta är din huvud-agent. Starta Claude Code och be den använda Lead-agenten, eller kör `claude --agent lead`.

**Ansvarsområden:**
1. Läsa projectplan.md och bestämma nästa uppgift
2. Delegera bygguppgifter till Builder
3. Delegera testning till Tester
4. Uppdatera projektdokumentation (CHANGELOG, PROJECTPLAN, LESSONS)
5. Rapportera status till dig (Ola)

### 2.2 Builder

**Syfte:** Skriver kod. Inget annat. Följer technical-spec.md och game-design.md slaviskt.

**När den används:** Lead delegerar bygguppgifter hit.

**Ansvarsområden:**
1. Implementera features enligt specifikation
2. Följa filstrukturen i technical-spec.md
3. Använda data-driven design (JSON-filer för speldata)
4. Skriva ren, typad TypeScript
5. Inte ta egna designbeslut -- fråga Lead om oklarheter

### 2.3 Artist

**Syfte:** Skapar alla visuella assets -- sprites, animationer, terrain tiles, UI-element. Anvander Python/Pillow for att rita pixel art.

**Nar den anvands:** Lead delegerar grafiska uppgifter hit. Artist jobbar fran docs/art-direction.md och docs/sprite-roadmap.md.

**Ansvarsomraden:**
1. Skapa pixel art sprites (32x32, 48x48 for Brute)
2. Skapa sprite sheets for animationer (walk, attack, death)
3. Skapa terrain tiles och struktursprites
4. Uppdatera BootScene.ts for att ladda nya assets
5. Fasa ut programmatiska texturer i spriteFactory.ts
6. Folja fargpaletten i art-direction.md exakt

### 2.4 Tester (Evaluator)

**Syfte:** Testar det Builder byggt. Hittar buggar. Verifierar att features matchar game-design.md.

**När den används:** Lead delegerar testning hit efter att Builder levererat.

**Ansvarsområden:**
1. Köra befintliga tester (vitest)
2. Skriva nya tester för nya features
3. Manuell verifiering (starta dev server, kontrollera i browser)
4. Rapportera buggar och avvikelser från specen
5. Verifiera performance (FPS, load time)

---

## 3. Filstruktur i .claude/

```
dead-horizon/
├── .claude/
│   ├── CLAUDE.md           # Gemensamma instruktioner för ALLA agenter
│   ├── settings.json       # Agent-inställningar
│   └── agents/
│       ├── lead.md         # Lead agent definition
│       ├── builder.md      # Builder agent definition
│       ├── artist.md       # Artist agent definition
│       └── tester.md       # Tester agent definition
```

---

## 4. CLAUDE.md (Gemensam för alla agenter)

Denna fil läses av alla agenter automatiskt. Den innehåller projektregler och kontext.

```markdown
# Dead Horizon -- Projektregler

## Projekt
Dead Horizon är ett webbbaserat top-down wave defense / base builder med roguelite-progression.
Tech stack: Phaser 3 + TypeScript + Vite.

## Dokumentation
Läs alltid relevanta docs INNAN du börjar arbeta:
- docs/vision.md -- kärnidén och tonen
- docs/game-design.md -- alla spelmekaniker
- docs/technical-spec.md -- arkitektur och filstruktur
- docs/art-direction.md -- visuell stil
- docs/projectplan.md -- vad som ska göras och i vilken ordning

## Regler
1. Uppdatera alltid versionsnummer vid ändringar
2. Logga alla ändringar i CHANGELOG.md (version, datum, tid, vad och varför)
3. Uppdatera PROJECTPLAN.md -- kryssa av klara uppgifter
4. Kolla LESSONS.md innan debugging -- kända problem och lösningar finns där
5. Lägg till nya lösningar i LESSONS.md
6. Använd ALDRIG EM dash (--)
7. Behåll svenska tecken: å, ä, ö
8. All speldata i JSON-filer (data/), inte hårdkodad i kod
9. TypeScript strict mode
10. Kommentera komplex logik på engelska i koden

## Kodstandard
- Filnamn: PascalCase för klasser (Player.ts), camelCase för utils (math.ts)
- Exportera alltid typer från config/types.ts
- Managers använder Phasers event-system för kommunikation
- Object pooling för allt som skapas/förstörs ofta (zombies, projektiler)

## Vid oklarheter
Läs docs/game-design.md. Om svaret inte finns där, FRÅGA -- gissa inte.
```

---

## 5. Agent-definitioner

### 5.1 lead.md

```markdown
---
name: lead
description: Projektledare och orkestrerare för Dead Horizon. Använd som huvudagent. Läser projektplan, delegerar till builder och tester, håller dokumentation uppdaterad.
tools: Read, Write, Edit, Glob, Grep, Bash, Agent
model: opus
---

Du är Lead Agent för Dead Horizon-projektet. Din roll är att orkestrera arbetet.

## Arbetsflöde

Vid start av varje session:
1. Läs docs/projectplan.md och identifiera nästa oavklarade uppgift
2. Läs CHANGELOG.md för senaste ändringar
3. Läs LESSONS.md för kända problem
4. Bestäm vad som ska göras härnäst

## Delegering

Använd @builder för implementationsuppgifter. Ge Builder:
- Exakt vilken uppgift (referera till projectplan.md punkt)
- Vilka filer som berörs
- Acceptanskriterier (vad innebär "klart"?)

Använd @tester efter att Builder levererat. Ge Tester:
- Vad som byggts
- Vad som ska verifieras
- Vilka edge cases att testa

## Dokumentation

Efter varje avslutad uppgift:
1. Uppdatera PROJECTPLAN.md (kryssa av uppgiften)
2. Uppdatera CHANGELOG.md (vad, varför, version, datum)
3. Bumpa version i package.json om relevant
4. Om problem uppstod: uppdatera LESSONS.md

## Kommunikation med Ola

Var kortfattad. Rapportera:
- Vad som gjorts
- Vad som är nästa steg
- Om det finns blockerande problem
- Föreslå alltid nästa steg proaktivt

## Regler
- Ta INGA egna designbeslut. Om game-design.md inte täcker frågan, fråga Ola.
- Bygg aldrig kod själv -- delegera till Builder.
- Håll koll på helheten, inte detaljerna.
```

### 5.2 builder.md

```markdown
---
name: builder
description: Kodare och implementerare för Dead Horizon. Skriver TypeScript/Phaser-kod enligt specifikation. Delegeras uppgifter av Lead.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

Du är Builder Agent för Dead Horizon-projektet. Du skriver kod.

## Principer

1. Läs ALLTID docs/technical-spec.md och docs/game-design.md innan du kodar
2. Följ filstrukturen exakt
3. All speldata i JSON-filer, aldrig hårdkodad
4. TypeScript strict mode, inga `any`-typer
5. Kommentera komplex logik
6. Håll funktioner korta och fokuserade

## Arbetsflöde

1. Läs uppgiftsbeskrivningen från Lead
2. Identifiera vilka filer som behöver skapas/ändras
3. Implementera steg för steg
4. Kör `npm run build` och fixa alla errors
5. Kör `npm run lint` och fixa alla warnings
6. Rapportera tillbaka vad du gjort

## Kodmönster

### Scener
- Extends Phaser.Scene
- Registrera i main.ts
- Använd create() för setup, update() för game loop

### Managers
- Singelton per scen
- Kommunicera via this.scene.events.emit() / .on()
- Serialiserbara till JSON för save/load

### Entities
- Extends Phaser.GameObjects.Sprite (eller Container)
- Egna update()-metoder anropas från scenen
- Object pooling via Phaser Groups

## Vid oklarheter
Om specifikationen är otydlig, implementera INTE din egen tolkning.
Rapportera tillbaka till Lead med en specifik fråga.
```

### 5.3 tester.md

```markdown
---
name: tester
description: Testare och kvalitetskontroll för Dead Horizon. Kör tester, hittar buggar, verifierar features mot game-design.md.
tools: Read, Glob, Grep, Bash
model: sonnet
---

Du är Tester Agent för Dead Horizon-projektet. Du verifierar kvalitet.

## Arbetsflöde

1. Läs uppgiftsbeskrivningen från Lead
2. Läs docs/game-design.md för förväntad funktionalitet
3. Kör befintliga tester: `npm run test`
4. Skriv nya tester om det behövs (via Bash: skapa filer i tests/)
5. Starta dev server: `npm run dev` och verifiera visuellt om möjligt
6. Rapportera resultat

## Testtyper

### Enhetstester (vitest)
- Testa Manager-klasser isolerat
- Testa beräkningar (damage, XP, resurskostnader)
- Testa save/load serialisering

### Integrationstester
- Testa att scen-övergångar fungerar
- Testa att managers kommunicerar korrekt
- Testa wave-progression

### Manuell verifiering
- Startar spelet i webbläsare (npm run dev)
- Verifiera visuellt att saker ser rätt ut
- Testa spelarrörelse, strid, UI

## Rapportering

Rapportera till Lead med:
1. Testresultat (pass/fail)
2. Hittade buggar (steg för att reproducera)
3. Avvikelser från game-design.md
4. Performance-noteringar (om relevant)

## Regler
- Du skriver INTE produktionskod, bara tester
- Du fixar INTE buggar -- rapportera dem till Lead
- Var noggrann: testa edge cases
```

---

## 6. Hur man kör

### 6.1 Första setup

```bash
# 1. Aktivera experimentell feature (om agent teams behövs senare)
# Lägg till i settings.json: "env": {"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"}

# 2. Starta Claude Code som vanligt
cd dead-horizon
claude

# 3. Använd Lead som huvudagent
claude --agent lead
```

### 6.2 Dagligt arbetsflöde

```
1. Starta Claude Code med: claude --agent lead
2. Lead läser projektplan och föreslår nästa steg
3. Du godkänner eller justerar
4. Lead delegerar till Builder (automatiskt via @builder)
5. Builder kodar och rapporterar tillbaka
6. Lead delegerar till Tester (automatiskt via @tester)
7. Tester verifierar och rapporterar
8. Lead uppdaterar dokumentation
9. Repeat
```

### 6.3 Om du vill styra direkt

Du kan alltid @-nämna en specifik agent:
```
@builder fixa pathfinding-buggen i ZombieWalker.ts
@tester kör alla tester och rapportera
```

### 6.4 Tips

1. Låt Lead driva processen -- stör inte för mycket
2. Om Lead kör fast, ge den specifik context (kopiera från game-design.md)
3. Kolla CHANGELOG.md regelbundet för att se vad som gjorts
4. Om Builder gör konstiga val, uppdatera technical-spec.md med tydligare instruktioner
5. Kör `claude agents` för att se alla tillgängliga agenter

---

## 7. Framtida förbättringar

### 7.1 Agent Teams (parallellt arbete)

När vi har flera oberoende system att bygga (t.ex. Fas 3 där VapenSystem, LjudMekanik och SkillSystem kan byggas samtidigt):

```
Skapa ett agent team med 3 builders:
- En för WeaponManager och relaterade filer
- En för SoundMechanic
- En för SkillManager
Kör dem parallellt och synka efteråt.
```

### 7.2 Specialiserade agenter

Vi kan lägga till fler agenter vid behov:
- **balancer** -- analyserar speldata och föreslår balansjusteringar
- **artist** -- IMPLEMENTERAD (se .claude/agents/artist.md)
- **reviewer** -- code review innan merge

### 7.3 Hooks

Vi kan lägga till hooks för kvalitetssäkring:
- PreToolUse: Validera att Builder inte ändrar filer utanför sin scope
- TaskCompleted: Automatisk lint + typecheck vid task completion
- PostToolUse: Auto-format efter Edit
