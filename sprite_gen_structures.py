"""
Dead Horizon -- Structure sprite generator
Creates all structure sprites from sprite-roadmap.md Prio 2.
Colors from art-direction.md section 2.1.
"""

from PIL import Image, ImageDraw
import os

OUTPUT_DIR = "assets/sprites"
os.makedirs(OUTPUT_DIR, exist_ok=True)

TRANSPARENT = (0, 0, 0, 0)

# Environment palette from art-direction.md section 2.1
DARK_GREEN    = (45, 74, 34, 255)    # #2D4A22 trees/bushes
MOSS_GREEN    = (74, 107, 58, 255)   # #4A6B3A overgrown
EARTH_BROWN   = (92, 64, 51, 255)    # #5C4033 dirt/mud
RUST_BROWN    = (139, 69, 19, 255)   # #8B4513 rust
CONCRETE_GREY = (107, 107, 107, 255) # #6B6B6B concrete
DARK_GREY     = (58, 58, 58, 255)    # #3A3A3A shadow
NIGHT_BLACK   = (26, 26, 46, 255)    # #1A1A2E

# Accent
BLOOD_RED     = (139, 0, 0, 255)     # #8B0000
FIRE_ORANGE   = (212, 98, 11, 255)   # #D4620B
BANDAGE_WHITE = (232, 220, 200, 255) # #E8DCC8
FLANEL_RED    = (178, 34, 34, 255)   # #B22222
AMMO_GOLD     = (197, 160, 48, 255)  # #C5A030

# Wood / planks
WOOD_LIGHT    = (160, 120, 70, 255)
WOOD_MID      = (130, 95, 55, 255)
WOOD_DARK     = (100, 72, 40, 255)

# Stone / concrete
STONE_LIGHT   = (140, 138, 130, 255)
STONE_MID     = (107, 107, 107, 255)
STONE_DARK    = (80, 78, 72, 255)

# Metal/rust
METAL_LIGHT   = (160, 140, 120, 255)
METAL_MID     = (120, 100, 80, 255)
METAL_DARK    = (80, 65, 50, 255)
RUST          = (139, 69, 19, 255)

# Plant/farm
LEAF_GREEN    = (60, 140, 40, 255)
LEAF_DARK     = (40, 100, 28, 255)
SOIL          = (80, 55, 35, 255)


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
# Barricade (32x32) -- hopsatta plankor, rostigt plat
# ---------------------------------------------------------------------------
def make_barricade() -> None:
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    # Base shadow
    rect(d, 2, 24, 28, 6, DARK_GREY)

    # Main plank structure (X-cross bracing pattern)
    # Horizontal planks
    rect(d, 2, 10, 28, 5, WOOD_MID)
    rect(d, 2, 17, 28, 5, WOOD_MID)
    # Plank edges / shadow
    hline(d, 2, 10, 28, WOOD_LIGHT)
    hline(d, 2, 14, 28, WOOD_DARK)
    hline(d, 2, 17, 28, WOOD_LIGHT)
    hline(d, 2, 21, 28, WOOD_DARK)

    # Vertical support posts
    rect(d, 4, 8, 4, 16, WOOD_DARK)
    rect(d, 24, 8, 4, 16, WOOD_DARK)
    px(d, 4, 8, WOOD_LIGHT)
    px(d, 27, 8, WOOD_LIGHT)

    # Rusty metal reinforcement strips
    rect(d, 2, 12, 28, 2, RUST)
    rect(d, 2, 19, 28, 2, RUST)
    # Rust spots
    px(d, 8, 13, METAL_DARK)
    px(d, 15, 12, METAL_DARK)
    px(d, 22, 13, METAL_DARK)

    # Nails/bolts
    for bx in [6, 14, 22]:
        px(d, bx, 11, METAL_LIGHT)
        px(d, bx, 18, METAL_LIGHT)

    # Ground base
    rect(d, 3, 24, 26, 4, WOOD_DARK)
    hline(d, 3, 24, 26, WOOD_MID)

    save(img, "struct_barricade.png")
    save_preview(img, "struct_barricade.png")


# ---------------------------------------------------------------------------
# Wall (32x32) -- solid stone/concrete with brick pattern
# ---------------------------------------------------------------------------
def make_wall() -> None:
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    # Base fill
    rect(d, 0, 4, 32, 24, STONE_MID)

    # Brick pattern (offset rows)
    # Row 1: offset 0
    for bx in range(0, 32, 10):
        rect(d, bx+1, 5, 8, 5, STONE_LIGHT)
        px(d, bx+1, 5, STONE_MID)
    # Row 2: offset 5
    for bx in range(-5, 32, 10):
        if bx + 1 >= 0:
            rect(d, bx+1, 12, 8, 5, STONE_LIGHT)
            px(d, bx+1, 12, STONE_MID)
    # Row 3: offset 0
    for bx in range(0, 32, 10):
        rect(d, bx+1, 19, 8, 5, STONE_LIGHT)
        px(d, bx+1, 19, STONE_MID)

    # Mortar lines (dark)
    hline(d, 0, 4, 32, STONE_DARK)
    hline(d, 0, 11, 32, STONE_DARK)
    hline(d, 0, 18, 32, STONE_DARK)
    hline(d, 0, 27, 32, STONE_DARK)
    # Vertical mortar
    for mx in range(0, 32, 10):
        vline(d, mx, 5, 6, STONE_DARK)
        vline(d, mx+5, 12, 6, STONE_DARK)
        vline(d, mx, 19, 8, STONE_DARK)

    # Top edge (slightly lighter, 3D effect)
    rect(d, 0, 0, 32, 4, STONE_LIGHT)
    hline(d, 0, 3, 32, STONE_MID)

    # Bottom shadow
    rect(d, 0, 28, 32, 4, STONE_DARK)

    save(img, "struct_wall.png")
    save_preview(img, "struct_wall.png")


# ---------------------------------------------------------------------------
# Trap (32x32) -- taggtrad/spikmatta, nastan osynlig
# ---------------------------------------------------------------------------
def make_trap() -> None:
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    # Ground base -- barely visible (slightly different from terrain)
    rect(d, 2, 8, 28, 18, (85, 65, 42, 60))  # near-transparent dirt

    # Barbed wire -- horizontal strands (subtle)
    for y in [12, 17, 22]:
        hline(d, 3, y, 26, (130, 130, 120, 180))  # wire strand
        # Barbs
        for bx in range(5, 28, 5):
            px(d, bx, y-1, (150, 150, 140, 200))
            px(d, bx+2, y+1, (150, 150, 140, 200))

    # Wooden stakes (more visible, give it away slightly)
    for sx in [6, 16, 26]:
        rect(d, sx, 9, 2, 14, WOOD_DARK)
        px(d, sx, 8, WOOD_LIGHT)  # tip
        px(d, sx+1, 8, WOOD_LIGHT)

    # Metal wire glint
    px(d, 10, 12, METAL_LIGHT)
    px(d, 20, 17, METAL_LIGHT)
    px(d, 15, 22, METAL_LIGHT)

    save(img, "struct_trap.png")
    save_preview(img, "struct_trap.png")


# ---------------------------------------------------------------------------
# Pillbox (32x32) -- forstarkt position med oppning
# ---------------------------------------------------------------------------
def make_pillbox() -> None:
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    # Base concrete bunker shape
    rect(d, 2, 6, 28, 22, STONE_DARK)

    # Front face
    rect(d, 4, 8, 24, 18, STONE_MID)

    # Concrete texture
    for y in range(9, 25, 4):
        hline(d, 4, y, 24, STONE_LIGHT)
    px(d, 6, 12, STONE_DARK)
    px(d, 20, 15, STONE_DARK)
    px(d, 12, 20, STONE_DARK)

    # Gun slit / embrasure (opening) -- center
    rect(d, 12, 14, 8, 4, NIGHT_BLACK)
    # Slit surround -- reinforced
    hline(d, 11, 13, 10, STONE_LIGHT)
    hline(d, 11, 18, 10, STONE_DARK)
    px(d, 11, 14, STONE_DARK)
    px(d, 20, 14, STONE_DARK)

    # Sandbags at front (bottom)
    rect(d, 4, 24, 7, 4, EARTH_BROWN)
    rect(d, 13, 24, 7, 4, EARTH_BROWN)
    rect(d, 22, 24, 6, 4, EARTH_BROWN)
    px(d, 5, 24, (110, 80, 60, 255))
    px(d, 14, 24, (110, 80, 60, 255))

    # Top edge
    rect(d, 2, 4, 28, 4, STONE_LIGHT)
    hline(d, 2, 3, 28, STONE_MID)
    hline(d, 2, 7, 28, STONE_DARK)

    # Shadow sides
    vline(d, 2, 6, 22, STONE_DARK)
    vline(d, 29, 6, 22, STONE_DARK)

    save(img, "struct_pillbox.png")
    save_preview(img, "struct_pillbox.png")


# ---------------------------------------------------------------------------
# Storage (32x32) -- tralada/container
# ---------------------------------------------------------------------------
def make_storage() -> None:
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    # Main crate body
    rect(d, 3, 5, 26, 24, WOOD_MID)

    # Wood plank lines
    hline(d, 3, 12, 26, WOOD_DARK)
    hline(d, 3, 19, 26, WOOD_DARK)

    # Corner reinforcement metal bands
    rect(d, 3, 5, 3, 24, METAL_DARK)   # left
    rect(d, 26, 5, 3, 24, METAL_DARK)  # right
    hline(d, 3, 5, 26, METAL_DARK)     # top
    hline(d, 3, 28, 26, METAL_DARK)    # bottom
    # Cross bands
    vline(d, 15, 5, 24, METAL_DARK)

    # Lid top edge
    rect(d, 3, 5, 26, 4, WOOD_LIGHT)
    hline(d, 3, 8, 26, WOOD_DARK)

    # Latch/lock
    rect(d, 13, 10, 6, 4, METAL_LIGHT)
    px(d, 15, 11, METAL_DARK)
    px(d, 16, 11, METAL_DARK)

    # Highlight top-left
    px(d, 4, 6, WOOD_LIGHT)
    hline(d, 4, 6, 5, WOOD_LIGHT)
    vline(d, 4, 6, 5, WOOD_LIGHT)

    # Shadow bottom-right
    vline(d, 28, 6, 22, WOOD_DARK)
    hline(d, 4, 28, 24, WOOD_DARK)

    # Ammo stencil hint (gold star)
    px(d, 15, 16, AMMO_GOLD)
    px(d, 14, 15, AMMO_GOLD)
    px(d, 16, 15, AMMO_GOLD)
    px(d, 14, 17, AMMO_GOLD)
    px(d, 16, 17, AMMO_GOLD)

    save(img, "struct_storage.png")
    save_preview(img, "struct_storage.png")


# ---------------------------------------------------------------------------
# Shelter (32x32) -- talt-form
# ---------------------------------------------------------------------------
def make_shelter() -> None:
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    TENT_MAIN = (80, 95, 72, 255)    # olive green canvas
    TENT_DARK = (58, 70, 52, 255)
    TENT_LIGHT = (100, 118, 90, 255)
    TENT_POLE = (120, 100, 70, 255)
    TENT_ROPE = (160, 140, 100, 200)
    GROUND    = (70, 55, 38, 255)

    # Ground shadow
    rect(d, 4, 26, 24, 4, GROUND)

    # Tent body -- triangular ridge shape from top-down
    # Main canvas (oval footprint)
    rect(d, 5, 12, 22, 14, TENT_MAIN)
    # Rounded corners
    px(d, 5, 12, TENT_DARK)
    px(d, 26, 12, TENT_DARK)
    px(d, 5, 25, TENT_DARK)
    px(d, 26, 25, TENT_DARK)

    # Ridge pole running down center
    vline(d, 16, 8, 18, TENT_POLE)
    # Peak of tent (top)
    rect(d, 14, 6, 4, 6, TENT_LIGHT)
    px(d, 15, 5, TENT_POLE)
    px(d, 16, 4, TENT_POLE)

    # Canvas folds / seams
    vline(d, 10, 13, 12, TENT_DARK)
    vline(d, 22, 13, 12, TENT_DARK)
    hline(d, 5, 18, 22, TENT_DARK)

    # Entrance (front opening)
    rect(d, 13, 22, 7, 4, TENT_DARK)
    # Flap line
    vline(d, 16, 22, 4, TENT_MAIN)

    # Guy ropes
    px(d, 3, 10, TENT_ROPE)
    px(d, 4, 11, TENT_ROPE)
    px(d, 29, 10, TENT_ROPE)
    px(d, 28, 11, TENT_ROPE)
    px(d, 3, 26, TENT_ROPE)
    px(d, 4, 25, TENT_ROPE)
    px(d, 29, 26, TENT_ROPE)
    px(d, 28, 25, TENT_ROPE)

    # Highlight top
    hline(d, 6, 12, 20, TENT_LIGHT)

    save(img, "struct_shelter.png")
    save_preview(img, "struct_shelter.png")


# ---------------------------------------------------------------------------
# Farm (64x64) -- odling med grona plantor
# ---------------------------------------------------------------------------
def make_farm() -> None:
    img = Image.new("RGBA", (64, 64), TRANSPARENT)
    d = ImageDraw.Draw(img)

    SOIL_DARK = (60, 42, 28, 255)
    SOIL_MID  = (85, 60, 38, 255)
    SOIL_LIGHT = (110, 80, 50, 255)
    CROP_GREEN = (65, 150, 40, 255)
    CROP_DARK  = (42, 105, 28, 255)
    CROP_LIGHT = (85, 185, 55, 255)
    FENCE      = (130, 95, 55, 255)
    FENCE_DARK = (95, 70, 40, 255)

    # Soil base
    rect(d, 4, 4, 56, 56, SOIL_MID)

    # Soil texture rows (plowed furrows)
    for y in range(8, 60, 6):
        hline(d, 4, y, 56, SOIL_DARK)
    for y in range(5, 60, 6):
        hline(d, 4, y, 56, SOIL_LIGHT)

    # Crop plants in a 3x4 grid
    crop_positions = [
        (10, 10), (22, 10), (34, 10), (46, 10),
        (10, 22), (22, 22), (34, 22), (46, 22),
        (10, 34), (22, 34), (34, 34), (46, 34),
        (10, 46), (22, 46), (34, 46), (46, 46),
    ]
    for (cx, cy) in crop_positions:
        # Stem
        vline(d, cx+2, cy+2, 6, CROP_DARK)
        # Leaves
        rect(d, cx, cy, 6, 5, CROP_GREEN)
        px(d, cx, cy, CROP_DARK)
        px(d, cx+5, cy, CROP_DARK)
        px(d, cx+2, cy, CROP_LIGHT)
        px(d, cx+3, cy, CROP_LIGHT)
        # Second leaf level
        px(d, cx+1, cy+3, CROP_GREEN)
        px(d, cx+4, cy+3, CROP_GREEN)

    # Fence perimeter
    # Top/bottom
    for fx in range(2, 62, 4):
        rect(d, fx, 1, 2, 3, FENCE)
        rect(d, fx, 60, 2, 3, FENCE)
    # Left/right
    for fy in range(2, 62, 4):
        rect(d, 1, fy, 3, 2, FENCE)
        rect(d, 60, fy, 3, 2, FENCE)
    # Corner posts
    rect(d, 1, 1, 3, 3, FENCE_DARK)
    rect(d, 60, 1, 3, 3, FENCE_DARK)
    rect(d, 1, 60, 3, 3, FENCE_DARK)
    rect(d, 60, 60, 3, 3, FENCE_DARK)

    save(img, "struct_farm.png")
    save_preview(img, "struct_farm.png")


# ---------------------------------------------------------------------------
# Base Tent (32x32) -- start-bas, larger military tent
# ---------------------------------------------------------------------------
def make_base_tent() -> None:
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)

    TENT_C   = (65, 80, 58, 255)   # military olive
    TENT_D   = (48, 60, 42, 255)
    TENT_L   = (85, 100, 75, 255)
    POLE_C   = (100, 85, 60, 255)
    ROPE_C   = (140, 120, 85, 200)

    # Ground shadow
    rect(d, 3, 27, 26, 3, (50, 40, 28, 120))

    # Tent body
    rect(d, 3, 10, 26, 18, TENT_C)

    # Canvas sections (divided by poles)
    rect(d, 3, 10, 8, 18, TENT_D)   # left panel
    rect(d, 21, 10, 8, 18, TENT_D)  # right panel

    # Center ridge (main pole)
    vline(d, 16, 5, 22, POLE_C)
    # Side poles
    vline(d, 5, 9, 19, POLE_C)
    vline(d, 27, 9, 19, POLE_C)

    # Peak
    rect(d, 14, 3, 4, 7, TENT_L)
    px(d, 15, 2, POLE_C)
    px(d, 16, 1, POLE_C)

    # Canvas highlight
    hline(d, 3, 10, 26, TENT_L)
    hline(d, 4, 11, 5, TENT_L)

    # Entrance
    rect(d, 12, 20, 8, 7, TENT_D)
    vline(d, 16, 20, 7, TENT_C)

    # Guy ropes
    px(d, 1, 8, ROPE_C)
    px(d, 2, 9, ROPE_C)
    px(d, 31, 8, ROPE_C)
    px(d, 30, 9, ROPE_C)
    px(d, 1, 27, ROPE_C)
    px(d, 2, 26, ROPE_C)
    px(d, 31, 27, ROPE_C)
    px(d, 30, 26, ROPE_C)

    # Flag -- small red marker
    rect(d, 17, 1, 5, 3, FLANEL_RED)
    px(d, 17, 1, (220, 50, 50, 255))

    save(img, "base_tent.png")
    save_preview(img, "base_tent.png")


# ---------------------------------------------------------------------------
# Base Camp (64x64) -- niva 2
# ---------------------------------------------------------------------------
def make_base_camp() -> None:
    img = Image.new("RGBA", (64, 64), TRANSPARENT)
    d = ImageDraw.Draw(img)

    TENT_C  = (65, 80, 58, 255)
    TENT_D  = (48, 60, 42, 255)
    TENT_L  = (85, 100, 75, 255)
    POLE_C  = (100, 85, 60, 255)
    FENCE   = (100, 78, 50, 255)
    GROUND  = (75, 58, 42, 255)

    # Ground area
    rect(d, 2, 2, 60, 60, GROUND)

    # Fence perimeter
    for fx in range(2, 62, 5):
        rect(d, fx, 2, 2, 4, FENCE)
        rect(d, fx, 58, 2, 4, FENCE)
    for fy in range(2, 62, 5):
        rect(d, 2, fy, 4, 2, FENCE)
        rect(d, 58, fy, 4, 2, FENCE)

    # Main tent (large)
    rect(d, 10, 12, 30, 22, TENT_C)
    vline(d, 25, 8, 26, POLE_C)
    rect(d, 23, 6, 4, 6, TENT_L)
    hline(d, 10, 12, 30, TENT_L)
    rect(d, 18, 26, 10, 8, TENT_D)   # entrance

    # Secondary tent
    rect(d, 40, 14, 18, 14, TENT_D)
    vline(d, 49, 12, 16, POLE_C)
    rect(d, 47, 10, 4, 4, TENT_L)
    hline(d, 40, 14, 18, TENT_L)

    # Supply boxes near fence
    rect(d, 10, 40, 7, 6, WOOD_DARK)
    rect(d, 10, 40, 7, 2, WOOD_MID)
    rect(d, 20, 42, 7, 6, WOOD_DARK)
    rect(d, 20, 42, 7, 2, WOOD_MID)

    # Fire pit
    rect(d, 44, 40, 8, 8, (60, 50, 38, 255))
    rect(d, 45, 41, 6, 6, (80, 30, 10, 200))
    px(d, 47, 42, FIRE_ORANGE)
    px(d, 48, 41, (255, 200, 50, 230))
    px(d, 49, 42, FIRE_ORANGE)

    # Flag
    rect(d, 26, 6, 7, 4, FLANEL_RED)
    px(d, 26, 6, (220, 50, 50, 255))

    save(img, "base_camp.png")
    save_preview(img, "base_camp.png")


# ---------------------------------------------------------------------------
# Base Outpost (64x64) -- niva 3
# ---------------------------------------------------------------------------
def make_base_outpost() -> None:
    img = Image.new("RGBA", (64, 64), TRANSPARENT)
    d = ImageDraw.Draw(img)

    WALL_C  = (95, 95, 88, 255)
    WALL_D  = (68, 68, 62, 255)
    WALL_L  = (120, 120, 112, 255)
    ROOF_C  = (75, 65, 50, 255)
    GROUND  = (78, 62, 46, 255)
    TOWER_C = (85, 85, 78, 255)

    # Ground
    rect(d, 2, 2, 60, 60, GROUND)

    # Perimeter wall (stone/concrete)
    # Top wall
    rect(d, 2, 2, 60, 6, WALL_C)
    # Bottom wall
    rect(d, 2, 56, 60, 6, WALL_C)
    # Left wall
    rect(d, 2, 2, 6, 60, WALL_C)
    # Right wall
    rect(d, 56, 2, 6, 60, WALL_C)
    # Wall highlight/shadow
    hline(d, 2, 2, 60, WALL_L)
    hline(d, 2, 61, 60, WALL_D)
    vline(d, 2, 2, 60, WALL_L)
    vline(d, 61, 2, 60, WALL_D)

    # Corner towers
    for (tx, ty) in [(2, 2), (54, 2), (2, 54), (54, 54)]:
        rect(d, tx, ty, 8, 8, TOWER_C)
        px(d, tx, ty, WALL_L)

    # Gate (south -- bottom)
    rect(d, 24, 56, 16, 6, WALL_D)

    # Main building (central)
    rect(d, 16, 16, 32, 28, WALL_D)
    rect(d, 18, 18, 28, 24, ROOF_C)
    # Roof detail
    hline(d, 18, 18, 28, METAL_LIGHT)
    vline(d, 32, 18, 24, METAL_DARK)
    # Door
    rect(d, 27, 36, 10, 8, WALL_D)
    px(d, 31, 39, METAL_LIGHT)  # handle

    # Barracks (right side)
    rect(d, 42, 18, 12, 20, WALL_D)
    hline(d, 42, 18, 12, WALL_L)

    # Flag on roof
    vline(d, 32, 12, 6, METAL_MID)
    rect(d, 33, 12, 8, 4, FLANEL_RED)

    save(img, "base_outpost.png")
    save_preview(img, "base_outpost.png")


# ---------------------------------------------------------------------------
# Base Settlement (96x96) -- niva 4
# ---------------------------------------------------------------------------
def make_base_settlement() -> None:
    img = Image.new("RGBA", (96, 96), TRANSPARENT)
    d = ImageDraw.Draw(img)

    WALL_C   = (100, 98, 90, 255)
    WALL_D   = (72, 70, 64, 255)
    WALL_L   = (128, 126, 116, 255)
    ROOF_C   = (80, 70, 54, 255)
    GROUND   = (82, 66, 50, 255)
    ROAD_C   = (90, 88, 80, 255)
    TOWER_C  = (90, 88, 80, 255)

    # Ground
    rect(d, 2, 2, 92, 92, GROUND)

    # Internal roads (cross pattern)
    rect(d, 42, 2, 12, 92, ROAD_C)
    rect(d, 2, 42, 92, 12, ROAD_C)
    # Road texture
    for y in range(4, 92, 6):
        px(d, 47, y, WALL_C)
    for x in range(4, 92, 6):
        px(d, x, 47, WALL_C)

    # Outer walls (thick)
    rect(d, 2, 2, 92, 8, WALL_C)
    rect(d, 2, 86, 92, 8, WALL_C)
    rect(d, 2, 2, 8, 92, WALL_C)
    rect(d, 86, 2, 8, 92, WALL_C)
    hline(d, 2, 2, 92, WALL_L)
    hline(d, 2, 93, 92, WALL_D)
    vline(d, 2, 2, 92, WALL_L)
    vline(d, 93, 2, 92, WALL_D)

    # Corner towers (larger)
    for (tx, ty) in [(2, 2), (82, 2), (2, 82), (82, 82)]:
        rect(d, tx, ty, 12, 12, TOWER_C)
        px(d, tx, ty, WALL_L)
        px(d, tx+10, ty+10, WALL_D)

    # Gates (all 4 sides)
    rect(d, 42, 2, 12, 8, WALL_D)   # north
    rect(d, 42, 86, 12, 8, WALL_D)  # south
    rect(d, 2, 42, 8, 12, WALL_D)   # west
    rect(d, 86, 42, 8, 12, WALL_D)  # east

    # NW quadrant: Main hall
    rect(d, 12, 12, 28, 26, WALL_D)
    rect(d, 14, 14, 24, 22, ROOF_C)
    hline(d, 14, 14, 24, WALL_L)
    vline(d, 26, 14, 22, WALL_D)
    rect(d, 22, 32, 12, 6, WALL_D)  # south door
    vline(d, 28, 10, 4, METAL_MID)  # flagpole
    rect(d, 29, 10, 8, 4, FLANEL_RED)

    # NE quadrant: Barracks
    rect(d, 56, 12, 28, 14, WALL_D)
    hline(d, 56, 12, 28, WALL_L)
    rect(d, 56, 28, 28, 12, WALL_D)
    hline(d, 56, 28, 28, WALL_L)

    # SW quadrant: Farm/supply
    rect(d, 12, 56, 26, 26, (82, 66, 50, 255))
    for fy in range(58, 80, 5):
        hline(d, 13, fy, 24, (68, 50, 34, 200))
    for (px2, py2) in [(15,59),(20,59),(25,59),(30,59),
                       (15,64),(20,64),(25,64),(30,64),
                       (15,69),(20,69),(25,69),(30,69),
                       (15,74),(20,74),(25,74),(30,74)]:
        rect(d, px2, py2, 4, 4, LEAF_GREEN)
        px(d, px2+1, py2, LEAF_DARK)

    # SE quadrant: Workshop/storage
    rect(d, 56, 56, 28, 26, WALL_D)
    hline(d, 56, 56, 28, WALL_L)
    # Storage boxes
    for bx in range(58, 82, 7):
        rect(d, bx, 66, 5, 5, WOOD_DARK)
        px(d, bx, 66, WOOD_MID)

    save(img, "base_settlement.png")
    save_preview(img, "base_settlement.png")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Generating Dead Horizon structure sprites...")

    print("\n--- Defensive structures ---")
    make_barricade()
    make_wall()
    make_trap()
    make_pillbox()

    print("\n--- Storage and shelter ---")
    make_storage()
    make_shelter()
    make_farm()

    print("\n--- Base levels ---")
    make_base_tent()
    make_base_camp()
    make_base_outpost()
    make_base_settlement()

    print("\nDone! All structure sprites generated.")
