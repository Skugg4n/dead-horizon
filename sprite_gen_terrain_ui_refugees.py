"""
Dead Horizon -- Terrain, UI effects, and refugee sprite generator
Prio 3+4+5 from sprite-roadmap.md
Colors from art-direction.md.
"""

from PIL import Image, ImageDraw
import os
import random

random.seed(42)  # Deterministic noise

OUTPUT_DIR = "assets/sprites"
os.makedirs(OUTPUT_DIR, exist_ok=True)

TRANSPARENT = (0, 0, 0, 0)

# Environment palette
DARK_GREEN    = (45, 74, 34, 255)
MOSS_GREEN    = (74, 107, 58, 255)
EARTH_BROWN   = (92, 64, 51, 255)
RUST_BROWN    = (139, 69, 19, 255)
CONCRETE_GREY = (107, 107, 107, 255)
DARK_GREY     = (58, 58, 58, 255)
NIGHT_BLACK   = (26, 26, 46, 255)

BLOOD_RED     = (139, 0, 0, 255)
FIRE_ORANGE   = (212, 98, 11, 255)
BANDAGE_WHITE = (232, 220, 200, 255)
FLANEL_RED    = (178, 34, 34, 255)
AMMO_GOLD     = (197, 160, 48, 255)
MED_BLUE      = (74, 144, 217, 255)

# Accent
HP_GREEN      = (76, 175, 80, 255)
HP_RED        = (244, 67, 54, 255)
AP_YELLOW     = (255, 215, 0, 255)
UI_BG         = (26, 26, 26, 230)
UI_TEXT       = (232, 220, 200, 255)
UI_HIGHLIGHT  = (212, 98, 11, 255)

# Grass shades
GRASS_BASE    = (62, 98, 44, 255)
GRASS_DARK    = (45, 74, 34, 255)
GRASS_LIGHT   = (82, 125, 58, 255)
GRASS_DRY     = (95, 110, 58, 255)

# Dirt
DIRT_BASE     = (110, 80, 55, 255)
DIRT_DARK     = (85, 60, 38, 255)
DIRT_LIGHT    = (135, 100, 70, 255)

# Road/asphalt
ROAD_BASE     = (68, 66, 60, 255)
ROAD_CRACK    = (48, 46, 42, 255)
ROAD_LINE     = (180, 170, 140, 180)

# Concrete
CONC_BASE     = (110, 108, 100, 255)
CONC_DARK     = (85, 84, 78, 255)
CONC_LIGHT    = (130, 128, 120, 255)

# Water
WATER_DEEP    = (30, 60, 90, 255)
WATER_MID     = (42, 80, 115, 255)
WATER_LIGHT   = (60, 100, 140, 255)
WATER_FOAM    = (140, 180, 210, 255)

# Overgrown road
OVG_CRACK     = (48, 46, 42, 255)
OVG_GRASS     = (62, 98, 44, 255)


def save(img: Image.Image, name: str) -> None:
    path = os.path.join(OUTPUT_DIR, name)
    img.save(path)
    print(f"  Saved: {path}")


def save_preview(img: Image.Image, name: str) -> None:
    w, h = img.size
    preview = img.resize((w * 8, h * 8), Image.NEAREST)
    base = name.replace(".png", "_preview.png")
    path = os.path.join(OUTPUT_DIR, base)
    preview.save(path)
    print(f"  Preview: {path}")


def px(draw: ImageDraw.Draw, x: int, y: int, color: tuple) -> None:
    draw.point((x, y), fill=color)


def rect(draw: ImageDraw.Draw, x: int, y: int, w: int, h: int, color: tuple) -> None:
    draw.rectangle([x, y, x + w - 1, y + h - 1], fill=color)


def hline(draw: ImageDraw.Draw, x: int, y: int, w: int, color: tuple) -> None:
    draw.line([(x, y), (x + w - 1, y)], fill=color)


def vline(draw: ImageDraw.Draw, x: int, y: int, h: int, color: tuple) -> None:
    draw.line([(x, y), (x, y + h - 1)], fill=color)


# ---------------------------------------------------------------------------
# TERRAIN TILES (32x32)
# ---------------------------------------------------------------------------

def make_grass(variant: int) -> None:
    """3 grass variants with different detail."""
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    # Base fill
    rect(d, 0, 0, 32, 32, GRASS_BASE)

    if variant == 1:
        # Sparse details
        detail_positions = [(3,5),(7,2),(12,8),(18,3),(25,6),(28,12),
                            (5,18),(10,14),(20,20),(28,25),(3,28),(15,26)]
    elif variant == 2:
        # Medium -- more tufts
        detail_positions = [(2,3),(6,1),(9,7),(14,4),(19,8),(23,2),(27,5),
                            (1,12),(8,15),(13,11),(18,14),(24,10),(29,13),
                            (4,20),(11,22),(17,19),(22,24),(26,21),(3,27),(19,29)]
    else:
        # Dense -- many details + dry patches
        detail_positions = [(1,1),(5,3),(9,1),(13,5),(17,2),(21,4),(25,1),(29,3),
                            (3,9),(7,7),(11,10),(15,8),(19,11),(23,8),(27,10),
                            (1,16),(6,14),(10,17),(14,15),(18,18),(22,16),(28,15),
                            (4,23),(8,21),(13,25),(17,22),(21,26),(25,24),(30,22),
                            (2,29),(7,28),(12,30),(20,28),(27,30)]

    for (dx, dy) in detail_positions:
        if 0 <= dx < 32 and 0 <= dy < 32:
            col = GRASS_LIGHT if (dx + dy) % 3 == 0 else GRASS_DARK
            px(d, dx, dy, col)
            if dx + 1 < 32:
                px(d, dx+1, dy, GRASS_DARK if col == GRASS_LIGHT else GRASS_BASE)

    if variant == 3:
        # Dry patch
        for dy in range(10, 16):
            for dx in range(18, 26):
                px(d, dx, dy, GRASS_DRY)

    # Subtle noise
    for _ in range(20):
        nx, ny = random.randint(0, 31), random.randint(0, 31)
        px(d, nx, ny, GRASS_DARK)

    fname = f"terrain_grass_{variant}.png"
    save(img, fname)
    save_preview(img, fname)


def make_dirt() -> None:
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    rect(d, 0, 0, 32, 32, DIRT_BASE)

    # Texture -- pebbles and cracks
    pebble_spots = [(4,4),(10,8),(18,5),(25,10),(7,16),(14,20),(22,16),(29,22),
                    (3,26),(12,28),(20,25),(28,29)]
    for (px_, py_) in pebble_spots:
        rect(d, px_, py_, 2, 2, DIRT_DARK)
        px(d, px_, py_, DIRT_LIGHT)

    # Crack lines
    for y in [9, 19, 27]:
        noise_offset = random.randint(-1, 1)
        hline(d, 5, y + noise_offset, 8, DIRT_DARK)

    # Noise
    for _ in range(25):
        nx, ny = random.randint(0, 31), random.randint(0, 31)
        col = DIRT_DARK if random.random() < 0.6 else DIRT_LIGHT
        px(d, nx, ny, col)

    save(img, "terrain_dirt.png")
    save_preview(img, "terrain_dirt.png")


def make_road() -> None:
    """Cracked asphalt road tile."""
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    rect(d, 0, 0, 32, 32, ROAD_BASE)

    # Crack network
    # Main diagonal crack
    for i in range(10):
        px(d, 5+i, 8+i, ROAD_CRACK)
        if i % 3 == 0 and 5+i+1 < 32:
            px(d, 5+i+1, 8+i, ROAD_CRACK)

    # Secondary cracks
    for i in range(6):
        px(d, 20+i, 4+i, ROAD_CRACK)
    for i in range(5):
        px(d, 15+i, 20, ROAD_CRACK)
    for i in range(4):
        px(d, 8, 22+i, ROAD_CRACK)
        px(d, 24, 15+i, ROAD_CRACK)

    # Road line (faded center marking)
    hline(d, 4, 16, 24, ROAD_LINE)

    # Subtle texture
    for _ in range(30):
        nx, ny = random.randint(0, 31), random.randint(0, 31)
        px(d, nx, ny, ROAD_CRACK if random.random() < 0.5 else (75, 73, 67, 255))

    save(img, "terrain_road.png")
    save_preview(img, "terrain_road.png")


def make_road_overgrown() -> None:
    """Cracked asphalt with grass growing through."""
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    rect(d, 0, 0, 32, 32, ROAD_BASE)

    # Cracks
    for i in range(8):
        px(d, 4+i, 6+i, OVG_CRACK)
        px(d, 20+i, 18+i, OVG_CRACK)
        px(d, 12, 10+i, OVG_CRACK)

    # Grass growing in cracks
    grass_spots = [(5,8),(7,10),(9,12),(13,11),(13,14),(13,17),
                   (21,19),(23,21),(25,23),(16,6),(22,12)]
    for (gx, gy) in grass_spots:
        if 0 <= gx < 32 and 0 <= gy < 32:
            px(d, gx, gy, OVG_GRASS)
            if gy-1 >= 0:
                px(d, gx, gy-1, GRASS_DARK)

    # Moss patches at edges
    rect(d, 0, 0, 4, 32, (55, 85, 40, 180))
    rect(d, 28, 0, 4, 32, (55, 85, 40, 160))

    # Texture
    for _ in range(20):
        nx, ny = random.randint(0, 31), random.randint(0, 31)
        px(d, nx, ny, OVG_CRACK)

    save(img, "terrain_road_overgrown.png")
    save_preview(img, "terrain_road_overgrown.png")


def make_concrete() -> None:
    """Concrete floor/ruin tile."""
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    rect(d, 0, 0, 32, 32, CONC_BASE)

    # Panel joints (concrete slab lines)
    hline(d, 0, 15, 32, CONC_DARK)
    vline(d, 15, 0, 32, CONC_DARK)
    # Joint highlight
    hline(d, 0, 16, 32, CONC_LIGHT)
    vline(d, 16, 0, 32, CONC_LIGHT)

    # Stain/damage spots
    rect(d, 3, 3, 5, 4, CONC_DARK)
    rect(d, 20, 5, 3, 3, CONC_DARK)
    rect(d, 18, 20, 6, 5, CONC_DARK)
    rect(d, 4, 22, 4, 4, CONC_DARK)

    # Rubble bits
    for (rx, ry) in [(7,8),(24,12),(10,25),(27,20)]:
        px(d, rx, ry, CONC_LIGHT)
        px(d, rx+1, ry, CONC_DARK)

    # Subtle noise
    for _ in range(20):
        nx, ny = random.randint(0, 31), random.randint(0, 31)
        col = CONC_DARK if random.random() < 0.5 else CONC_LIGHT
        px(d, nx, ny, col)

    save(img, "terrain_concrete.png")
    save_preview(img, "terrain_concrete.png")


# ---------------------------------------------------------------------------
# UI / PROJECTILE SPRITES (Prio 4)
# ---------------------------------------------------------------------------

def make_bullet() -> None:
    """8x8 bullet projectile."""
    img = Image.new("RGBA", (8, 8), TRANSPARENT)
    d = ImageDraw.Draw(img)
    # Brass casing color
    BRASS = (210, 170, 60, 255)
    BRASS_DARK = (160, 125, 40, 255)
    LEAD = (80, 78, 75, 255)

    # Small elongated bullet (horizontal travel)
    rect(d, 1, 3, 5, 2, BRASS)
    px(d, 6, 3, LEAD)
    px(d, 6, 4, LEAD)
    px(d, 0, 3, BRASS_DARK)
    px(d, 0, 4, BRASS_DARK)
    px(d, 2, 2, BRASS_DARK)
    px(d, 2, 5, BRASS_DARK)

    save(img, "bullet.png")
    save_preview(img, "bullet.png")


def make_spitter_projectile() -> None:
    """8x8 green spitter projectile."""
    img = Image.new("RGBA", (8, 8), TRANSPARENT)
    d = ImageDraw.Draw(img)

    DROOL_BRIGHT = (68, 255, 68, 255)
    DROOL_MID    = (48, 200, 48, 255)
    DROOL_DARK   = (28, 140, 28, 255)
    DROOL_GLOW   = (150, 255, 150, 180)

    # Blob shape
    rect(d, 2, 2, 4, 4, DROOL_MID)
    px(d, 3, 1, DROOL_MID)
    px(d, 4, 1, DROOL_MID)
    px(d, 1, 3, DROOL_MID)
    px(d, 6, 3, DROOL_MID)
    px(d, 3, 6, DROOL_MID)
    px(d, 4, 6, DROOL_MID)
    # Highlight
    px(d, 3, 2, DROOL_BRIGHT)
    px(d, 3, 3, DROOL_BRIGHT)
    # Dark edge
    px(d, 5, 5, DROOL_DARK)
    px(d, 4, 5, DROOL_DARK)
    # Glow hint
    px(d, 2, 1, DROOL_GLOW)

    save(img, "spitter_projectile.png")
    save_preview(img, "spitter_projectile.png")


def make_loot_drop() -> None:
    """16x16 generic loot drop icon (glowing crate)."""
    img = Image.new("RGBA", (16, 16), TRANSPARENT)
    d = ImageDraw.Draw(img)

    CRATE_MID  = (130, 100, 60, 255)
    CRATE_DARK = (100, 75, 45, 255)
    CRATE_LIGHT = (165, 130, 80, 255)
    GLOW       = (255, 215, 0, 120)

    # Glow behind
    rect(d, 1, 1, 14, 14, GLOW)

    # Crate body
    rect(d, 2, 3, 12, 10, CRATE_MID)
    # Lid
    rect(d, 2, 3, 12, 3, CRATE_LIGHT)
    hline(d, 2, 5, 12, CRATE_DARK)
    # Metal corners
    px(d, 2, 3, CRATE_DARK)
    px(d, 13, 3, CRATE_DARK)
    px(d, 2, 12, CRATE_DARK)
    px(d, 13, 12, CRATE_DARK)
    # Latch
    rect(d, 6, 7, 4, 3, (180, 150, 80, 255))
    px(d, 7, 8, CRATE_DARK)
    # Shadow
    hline(d, 3, 13, 11, CRATE_DARK)

    save(img, "loot_drop.png")
    save_preview(img, "loot_drop.png")


def make_resource_icon(name: str, color: tuple, symbol: str) -> None:
    """16x16 resource icon."""
    img = Image.new("RGBA", (16, 16), TRANSPARENT)
    d = ImageDraw.Draw(img)

    BG     = (26, 26, 26, 200)
    BORDER = color
    dark_color = tuple(max(0, c - 60) if i < 3 else c for i, c in enumerate(color))

    # Background circle-ish
    rect(d, 1, 1, 14, 14, BG)
    # Border
    hline(d, 2, 1, 12, BORDER)
    hline(d, 2, 14, 12, BORDER)
    vline(d, 1, 2, 12, BORDER)
    vline(d, 14, 2, 12, BORDER)

    # Symbol drawing
    if symbol == "scrap":
        # Gear/cog shape
        rect(d, 5, 5, 6, 6, color)
        px(d, 6, 3, color)
        px(d, 9, 3, color)
        px(d, 6, 12, color)
        px(d, 9, 12, color)
        px(d, 3, 6, color)
        px(d, 3, 9, color)
        px(d, 12, 6, color)
        px(d, 12, 9, color)
        rect(d, 6, 6, 4, 4, BG)  # center hole
        px(d, 7, 7, color)

    elif symbol == "food":
        # Apple/crop
        rect(d, 6, 5, 4, 6, color)
        px(d, 5, 6, color)
        px(d, 10, 6, color)
        px(d, 5, 9, color)
        px(d, 10, 9, color)
        px(d, 6, 11, color)
        px(d, 9, 11, color)
        # Stem
        px(d, 8, 4, (74, 107, 58, 255))
        px(d, 8, 3, (74, 107, 58, 255))

    elif symbol == "ammo":
        # Bullet shape
        rect(d, 6, 4, 4, 8, color)
        px(d, 7, 3, color)
        px(d, 8, 3, color)
        px(d, 5, 5, color)
        px(d, 10, 5, color)
        rect(d, 7, 10, 2, 3, dark_color)

    elif symbol == "parts":
        # Wrench
        rect(d, 7, 4, 2, 8, color)
        rect(d, 5, 4, 6, 2, color)
        rect(d, 5, 10, 6, 2, color)
        px(d, 5, 5, BG)
        px(d, 10, 5, BG)
        px(d, 5, 11, BG)
        px(d, 10, 11, BG)

    elif symbol == "meds":
        # Red cross
        rect(d, 7, 4, 2, 8, color)
        rect(d, 4, 7, 8, 2, color)

    save(img, f"icon_{name}.png")
    save_preview(img, f"icon_{name}.png")


# ---------------------------------------------------------------------------
# REFUGEES (Prio 5) -- 5 variants + injured
# ---------------------------------------------------------------------------

# Refugee color sets: (skin, hair, shirt, pants, shoes)
REFUGEE_CONFIGS = [
    {  # 1: Woman in pink skirt
        "skin":   (220, 190, 160, 255),
        "hair":   (80, 55, 35, 255),
        "top":    (210, 140, 160, 255),   # pink/rose shirt
        "bottom": (200, 120, 150, 255),   # pink skirt
        "shoes":  (100, 80, 60, 255),
        "detail": (230, 100, 120, 255),
    },
    {  # 2: Man in flannel shirt
        "skin":   (200, 165, 130, 255),
        "hair":   (50, 40, 30, 255),
        "top":    (140, 70, 50, 255),     # red flannel
        "bottom": (55, 65, 80, 255),      # dark jeans
        "shoes":  (70, 55, 40, 255),
        "detail": (160, 80, 60, 255),
    },
    {  # 3: Older man with grey jacket
        "skin":   (210, 180, 150, 255),
        "hair":   (160, 155, 150, 255),   # grey hair
        "top":    (110, 108, 100, 255),   # grey jacket
        "bottom": (75, 72, 65, 255),      # dark grey pants
        "shoes":  (60, 50, 40, 255),
        "detail": (130, 128, 120, 255),
    },
    {  # 4: Young woman in blue
        "skin":   (240, 210, 180, 255),
        "hair":   (40, 28, 20, 255),      # dark hair
        "top":    (60, 110, 160, 255),    # blue jacket
        "bottom": (45, 55, 75, 255),      # dark pants
        "shoes":  (55, 42, 32, 255),
        "detail": (80, 135, 185, 255),
    },
    {  # 5: Child with yellow raincoat
        "skin":   (235, 205, 170, 255),
        "hair":   (165, 130, 75, 255),    # sandy blonde
        "top":    (200, 185, 40, 255),    # yellow raincoat
        "bottom": (180, 168, 35, 255),
        "shoes":  (80, 65, 50, 255),
        "detail": (225, 210, 55, 255),
    },
]


def draw_refugee(draw: ImageDraw.Draw, cfg: dict, ox: int = 0, oy: int = 0,
                 leg_l: int = 0, leg_r: int = 0,
                 body_bob: int = 0) -> None:
    """Draw a civilian refugee from top-down."""
    b = body_bob
    skin   = cfg["skin"]
    hair   = cfg["hair"]
    top    = cfg["top"]
    bottom = cfg["bottom"]
    shoes  = cfg["shoes"]
    detail = cfg["detail"]

    # Dark edge versions
    def darken(c: tuple) -> tuple:
        return tuple(max(0, v - 40) if i < 3 else v for i, v in enumerate(c))

    # Body
    rect(draw, ox+11, oy+13+b, 10, 10, top)
    px(draw, ox+11, oy+13+b, darken(top))
    px(draw, ox+20, oy+13+b, darken(top))
    # Detail stripe
    px(draw, ox+14, oy+15+b, detail)
    px(draw, ox+17, oy+15+b, detail)

    # Head
    rect(draw, ox+12, oy+6+b, 8, 7, skin)
    # Hair
    hline(draw, ox+12, oy+6+b, 8, hair)
    px(draw, ox+12, oy+7+b, hair)
    px(draw, ox+19, oy+7+b, hair)
    # Eyes (no red glow -- civilian)
    px(draw, ox+14, oy+9+b, darken(skin))
    px(draw, ox+17, oy+9+b, darken(skin))
    # Mouth (small, neutral)
    px(draw, ox+15, oy+11+b, darken(skin))
    px(draw, ox+16, oy+11+b, darken(skin))

    # Arms
    rect(draw, ox+8, oy+14+b, 3, 5, top)
    rect(draw, ox+21, oy+14+b, 3, 5, top)
    # Hands
    px(draw, ox+9, oy+19+b, skin)
    px(draw, ox+22, oy+19+b, skin)

    # Legs
    rect(draw, ox+12, oy+23+b, 3, 6, bottom)
    rect(draw, ox+12, oy+28+b+leg_l, 3, 2, shoes)
    rect(draw, ox+17, oy+23+b, 3, 6, bottom)
    rect(draw, ox+17, oy+28+b+leg_r, 3, 2, shoes)


def make_refugee(n: int) -> None:
    cfg = REFUGEE_CONFIGS[n - 1]
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)
    draw_refugee(d, cfg)
    save(img, f"refugee_{n}.png")
    save_preview(img, f"refugee_{n}.png")


def make_refugee_injured() -> None:
    """Refugee with bandage overlay (uses refugee 1 as base)."""
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    # Use refugee config 2 as base
    cfg = REFUGEE_CONFIGS[1]
    draw_refugee(d, cfg)

    # Bandage on head
    BANDAGE = (232, 220, 200, 220)
    BANDAGE_BLOOD = (180, 60, 60, 200)
    hline(d, 12, 6, 8, BANDAGE)
    hline(d, 12, 7, 8, BANDAGE)
    # Blood stain on bandage
    px(d, 15, 6, BANDAGE_BLOOD)
    px(d, 16, 7, BANDAGE_BLOOD)

    # Bandage on arm
    rect(d, 8, 15, 3, 3, BANDAGE)
    px(d, 9, 16, BANDAGE_BLOOD)

    # Torn/dirty clothes
    px(d, 12, 20, (60, 20, 10, 255))  # blood on shirt
    px(d, 17, 18, (60, 20, 10, 255))

    save(img, "refugee_injured.png")
    save_preview(img, "refugee_injured.png")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Generating Dead Horizon terrain, UI, and refugee sprites...")

    print("\n--- Terrain tiles ---")
    make_grass(1)
    make_grass(2)
    make_grass(3)
    make_dirt()
    make_road()
    make_road_overgrown()
    make_concrete()

    print("\n--- Projectiles and loot (Prio 4) ---")
    make_bullet()
    make_spitter_projectile()
    make_loot_drop()

    print("\n--- Resource icons ---")
    SCRAP_COLOR = (130, 130, 120, 255)
    FOOD_COLOR  = (76, 175, 80, 255)
    AMMO_COLOR  = (197, 160, 48, 255)
    PARTS_COLOR = (100, 140, 180, 255)
    MEDS_COLOR  = (244, 67, 54, 255)
    make_resource_icon("scrap", SCRAP_COLOR, "scrap")
    make_resource_icon("food", FOOD_COLOR, "food")
    make_resource_icon("ammo", AMMO_COLOR, "ammo")
    make_resource_icon("parts", PARTS_COLOR, "parts")
    make_resource_icon("meds", MEDS_COLOR, "meds")

    print("\n--- Refugees (Prio 5) ---")
    for i in range(1, 6):
        make_refugee(i)
    make_refugee_injured()

    print("\nDone! All terrain, UI, and refugee sprites generated.")
