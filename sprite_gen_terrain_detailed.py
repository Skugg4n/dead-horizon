"""
Dead Horizon -- Detailed Terrain Sprite Generator
Creates rich terrain tiles, decorations, trees, bushes, water, rocks.
All sprites saved to public/assets/sprites/terrain/
"""

import os
import random
from PIL import Image

# ---- Output directory ----
OUT = '/Users/olabelin/Projects/dead-horizon/public/assets/sprites/terrain'
os.makedirs(OUT, exist_ok=True)

# ---- Helpers ----

def create_sprite(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))

def px(img, x, y, color):
    if 0 <= x < img.width and 0 <= y < img.height:
        if len(color) == 3:
            color = color + (255,)
        img.putpixel((x, y), color)

def rect(img, x, y, w, h, color):
    for dy in range(h):
        for dx in range(w):
            px(img, x + dx, y + dy, color)

def save_sprite(img, name, scale=8):
    img.save(f'{OUT}/{name}.png')
    preview = img.resize(
        (img.width * scale, img.height * scale),
        Image.NEAREST
    )
    preview.save(f'{OUT}/{name}_preview.png')
    print(f'  Saved {name}.png ({img.width}x{img.height})')

# ---- Color palettes ----

# Grass
G_DARK     = (26,  58,  26)   # #1A3A1A
G_MID      = (42,  74,  32)   # #2A4A20
G_LIGHT    = (58,  90,  42)   # #3A5A2A
G_SHADOW   = (30,  46,  26)   # #1E2E1A
G_PALE     = (68, 102,  50)   # lighter highlight
G_YELLOW   = (80, 100,  30)   # dry/yellow-green tinge

# Dirt
D_DARK     = (42,  31,  15)   # #2A1F0F
D_MID      = (58,  42,  20)   # #3A2A14
D_LIGHT    = (74,  58,  30)   # #4A3A1E
D_DEEP     = (26,  18,   8)   # #1A1208
D_STONE    = (82,  72,  55)   # pebble color

# Stone
S_DARK     = (58,  58,  58)   # #3A3A3A
S_MID      = (74,  74,  74)   # #4A4A4A
S_LIGHT    = (90,  90,  74)   # #6A6A5A (slightly warm)
S_BRIGHT   = (106,106, 106)   # #6A6A6A

# Wood / bark
W_DARK     = (38,  24,  10)
W_MID      = (58,  36,  14)
W_LIGHT    = (80,  54,  24)
W_GRAIN    = (46,  30,  12)

# Foliage accent
F_DARK     = (30,  54,  20)
F_BRIGHT   = (64, 108,  44)
F_YELLOW   = (88, 104,  20)
F_AUTUMN   = (110, 72,  20)

# Leaf litter
L_TAN      = (96,  80,  30)
L_BROWN    = (76,  56,  20)
L_OLIVE    = (74,  80,  24)
L_DARK     = (50,  38,  12)

# Water
WAT_DEEP   = (18,  28,  52, 210)
WAT_MID    = (28,  44,  80, 200)
WAT_SHINE  = (60,  90, 140, 180)
WAT_FOAM   = (80, 110, 160, 140)

# Flower colors
FL_YELLOW  = (220, 190,  30)
FL_WHITE   = (230, 224, 200)
FL_ORANGE  = (200,  90,  20)
FL_CENTER  = (180, 120,  10)
FL_STEM    = (40,  70,  20)

# Mushroom
MUSH_CAP   = (140,  72,  24)
MUSH_SPOT  = (200, 180, 140)
MUSH_STEM  = (200, 180, 140)
MUSH_DARK  = (90,  44,  14)

# Bone
BONE_LIGHT = (210, 200, 170)
BONE_DARK  = (160, 148, 118)
BONE_SHAD  = (100,  90,  68)

# Crate
CR_WOOD    = (72,  50,  22)
CR_DARK    = (44,  30,  10)
CR_METAL   = (80,  70,  58)
CR_NAIL    = (50,  44,  36)

# Lantern
LAN_BODY   = (60,  50,  30)
LAN_GLASS  = (220, 180,  60, 200)
LAN_GLOW   = (255, 210,  80, 180)
LAN_METAL  = (80,  70,  50)
LAN_FLAME  = (255, 150,  30)


# ========================================================
#  1. terrain_grass_1  -- dark grass, 3-4 green shades
# ========================================================
def make_terrain_grass_1():
    rng = random.Random(1)
    img = create_sprite(16, 16)
    base_colors = [G_DARK, G_MID, G_SHADOW, G_MID, G_DARK, G_MID]
    for y in range(16):
        for x in range(16):
            c = rng.choice(base_colors)
            img.putpixel((x, y), c + (255,))
    # Add small blade highlights
    for _ in range(18):
        bx = rng.randint(0, 14)
        by = rng.randint(0, 14)
        col = rng.choice([G_LIGHT, G_PALE, G_MID])
        px(img, bx, by, col)
        if rng.random() > 0.5:
            px(img, bx, by - 1, G_SHADOW)
    # Occasional dark shadow clumps
    for _ in range(6):
        sx = rng.randint(0, 13)
        sy = rng.randint(0, 13)
        px(img, sx, sy, G_SHADOW)
        px(img, sx + 1, sy, G_SHADOW)
    save_sprite(img, 'terrain_grass_1')


# ========================================================
#  2. terrain_grass_2  -- lighter grass with small blade patterns
# ========================================================
def make_terrain_grass_2():
    rng = random.Random(2)
    img = create_sprite(16, 16)
    for y in range(16):
        for x in range(16):
            c = rng.choice([G_MID, G_LIGHT, G_PALE, G_LIGHT, G_MID])
            img.putpixel((x, y), c + (255,))
    # Tiny V-shaped blades
    positions = [(rng.randint(0, 14), rng.randint(1, 14)) for _ in range(14)]
    for bx, by in positions:
        px(img, bx, by,     G_PALE)
        px(img, bx - 1, by - 1, G_LIGHT)
        px(img, bx + 1, by - 1, G_LIGHT)
        px(img, bx, by - 1, G_SHADOW)
    # Subtle dark dots for depth
    for _ in range(10):
        px(img, rng.randint(0, 15), rng.randint(0, 15), G_DARK)
    save_sprite(img, 'terrain_grass_2')


# ========================================================
#  3. terrain_grass_3  -- grass with dirt patches
# ========================================================
def make_terrain_grass_3():
    rng = random.Random(3)
    img = create_sprite(16, 16)
    for y in range(16):
        for x in range(16):
            c = rng.choice([G_DARK, G_MID, G_SHADOW, D_MID, D_DARK, G_DARK])
            img.putpixel((x, y), c + (255,))
    # Dirt patches - small clusters
    for _ in range(3):
        px = img.putpixel
        cx = rng.randint(2, 12)
        cy = rng.randint(2, 12)
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                if 0 <= cx+dx < 16 and 0 <= cy+dy < 16:
                    if rng.random() > 0.3:
                        col = rng.choice([D_MID, D_DARK, D_LIGHT])
                        img.putpixel((cx+dx, cy+dy), col + (255,))
    # Grass blades over the top
    rng2 = random.Random(31)
    for _ in range(12):
        bx = rng2.randint(0, 14)
        by = rng2.randint(1, 15)
        img.putpixel((bx, by), G_LIGHT + (255,))
    save_sprite(img, 'terrain_grass_3')


# ========================================================
#  4. terrain_dirt_1  -- dirt with small stone pebbles
# ========================================================
def make_terrain_dirt_1():
    rng = random.Random(4)
    img = create_sprite(16, 16)
    for y in range(16):
        for x in range(16):
            c = rng.choice([D_MID, D_DARK, D_LIGHT, D_MID, D_DARK])
            img.putpixel((x, y), c + (255,))
    # Small pebbles
    for _ in range(8):
        px_x = rng.randint(0, 14)
        px_y = rng.randint(0, 14)
        col = rng.choice([S_DARK, S_MID, D_STONE])
        img.putpixel((px_x, px_y), col + (255,))
        if rng.random() > 0.4:
            img.putpixel((px_x+1, px_y), S_DARK + (255,))
    # Fine texture variation
    for _ in range(20):
        img.putpixel(
            (rng.randint(0,15), rng.randint(0,15)),
            rng.choice([D_DEEP, D_MID, D_DARK]) + (255,)
        )
    save_sprite(img, 'terrain_dirt_1')


# ========================================================
#  5. terrain_dirt_2  -- darker muddy dirt
# ========================================================
def make_terrain_dirt_2():
    rng = random.Random(5)
    img = create_sprite(16, 16)
    for y in range(16):
        for x in range(16):
            c = rng.choice([D_DARK, D_DEEP, D_MID, D_DEEP, D_DARK])
            img.putpixel((x, y), c + (255,))
    # Mud tracks - slightly shinier streaks
    for row in [3, 7, 11]:
        for col in range(rng.randint(2, 6), rng.randint(8, 14)):
            img.putpixel((col, row), D_LIGHT + (255,))
    # Dark cracks
    for _ in range(5):
        cx = rng.randint(1, 14)
        cy = rng.randint(1, 14)
        img.putpixel((cx, cy), D_DEEP + (255,))
        if rng.random() > 0.5:
            img.putpixel((cx, cy+1), D_DEEP + (255,))
    save_sprite(img, 'terrain_dirt_2')


# ========================================================
#  6. terrain_path_1  -- worn path, compact light-brown dirt
# ========================================================
def make_terrain_path_1():
    rng = random.Random(6)
    img = create_sprite(16, 16)
    # Base: lighter packed dirt
    PATH_BASE  = (108, 88, 54)
    PATH_DARK  = (82,  64, 36)
    PATH_LIGHT = (128, 108, 72)
    PATH_STONE = (100, 96, 80)
    for y in range(16):
        for x in range(16):
            c = rng.choice([PATH_BASE, PATH_DARK, PATH_LIGHT, PATH_BASE])
            img.putpixel((x, y), c + (255,))
    # Footprint indentations (darker ovals)
    for cx, cy in [(4, 4), (10, 10), (3, 12), (11, 3)]:
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                if 0 <= cx+dx < 16 and 0 <= cy+dy < 16:
                    if rng.random() > 0.4:
                        img.putpixel((cx+dx, cy+dy), PATH_DARK + (255,))
    # Small stones embedded in path
    for _ in range(5):
        sx = rng.randint(0, 14)
        sy = rng.randint(0, 14)
        img.putpixel((sx, sy), PATH_STONE + (255,))
    save_sprite(img, 'terrain_path_1')


# ========================================================
#  7. terrain_leaves  -- fallen leaf litter
# ========================================================
def make_terrain_leaves():
    rng = random.Random(7)
    img = create_sprite(16, 16)
    for y in range(16):
        for x in range(16):
            c = rng.choice([L_TAN, L_BROWN, L_OLIVE, L_DARK, L_BROWN])
            img.putpixel((x, y), c + (255,))
    # Individual leaf shapes (tiny L-shapes or dots)
    leaf_cols = [L_TAN, (110, 80, 24), (90, 68, 18), (130, 96, 34)]
    for _ in range(20):
        lx = rng.randint(0, 13)
        ly = rng.randint(0, 13)
        col = rng.choice(leaf_cols)
        img.putpixel((lx, ly), col + (255,))
        if rng.random() > 0.5:
            img.putpixel((lx+1, ly), L_DARK + (255,))
        if rng.random() > 0.6:
            img.putpixel((lx, ly+1), (rng.choice(leaf_cols)) + (255,))
    # Dark gaps (leaf shadows)
    for _ in range(8):
        img.putpixel((rng.randint(0,15), rng.randint(0,15)), L_DARK + (255,))
    save_sprite(img, 'terrain_leaves')


# ========================================================
#  8. decor_flower_1  -- 8x8 small yellow flower
# ========================================================
def make_decor_flower_1():
    img = create_sprite(8, 8)
    # Stem/leaves at bottom
    for y in range(4, 8):
        px(img, 3, y, FL_STEM)
        px(img, 4, y, FL_STEM)
    px(img, 2, 5, (50, 80, 25))
    px(img, 5, 6, (50, 80, 25))
    # Petals (yellow cross + diagonals)
    petals = [(3,1),(4,1),(2,2),(5,2),(1,3),(6,3),(2,4),(5,4),(3,2),(4,2)]
    for bx, by in petals:
        px(img, bx, by, FL_YELLOW)
    # Center
    px(img, 3, 3, FL_CENTER)
    px(img, 4, 3, FL_CENTER)
    px(img, 3, 4, FL_CENTER)
    px(img, 4, 4, (160, 100, 10))
    save_sprite(img, 'decor_flower_1')


# ========================================================
#  9. decor_flower_2  -- 8x8 small white flower
# ========================================================
def make_decor_flower_2():
    img = create_sprite(8, 8)
    # Stem
    for y in range(5, 8):
        px(img, 3, y, FL_STEM)
        px(img, 4, y, FL_STEM)
    px(img, 2, 6, (50, 80, 25))
    # Petals (white, 5 petals arranged)
    white_petals = [(3,1),(4,1),(2,2),(5,2),(1,3),(6,3),(2,4),(5,4)]
    for bx, by in white_petals:
        px(img, bx, by, FL_WHITE)
    # Add subtle shadow on lower petals
    for bx, by in [(2,4),(5,4)]:
        px(img, bx, by, (200, 192, 172))
    # Yellow center
    px(img, 3, 3, (220, 190, 50))
    px(img, 4, 3, (220, 190, 50))
    px(img, 3, 4, (200, 170, 40))
    px(img, 4, 4, (200, 170, 40))
    save_sprite(img, 'decor_flower_2')


# ========================================================
# 10. decor_mushroom  -- 8x10 brown mushroom
# ========================================================
def make_decor_mushroom():
    img = create_sprite(8, 10)
    # Stem
    for y in range(6, 10):
        for x in range(2, 6):
            c = MUSH_STEM if x in (2,5) else (220, 200, 160)
            px(img, x, y, c)
    # Cap outline (dome shape)
    cap_rows = [
        (3, 4, MUSH_CAP),       # top row 1px
        (2, 5, MUSH_CAP),       # row 2
        (1, 6, MUSH_CAP),       # row 3 (widest)
        (1, 7, MUSH_DARK),      # underside
    ]
    for x_start, x_end, col in cap_rows:
        for x in range(x_start, x_end):
            px(img, x, cap_rows.index((x_start,x_end,col))+1, col)
    # Draw cap manually (dome)
    # Row 0: nothing (transparent)
    # Row 1: center 3 pixels
    for x in range(2, 6):
        px(img, x, 1, MUSH_CAP)
    # Row 2: wider
    for x in range(1, 7):
        px(img, x, 2, MUSH_CAP)
    # Row 3: widest
    for x in range(0, 8):
        px(img, x, 3, MUSH_CAP)
    # Row 4: underside (dark)
    for x in range(0, 8):
        px(img, x, 4, MUSH_DARK)
    # Row 5: underside continuation
    for x in range(1, 7):
        px(img, x, 5, MUSH_DARK)
    # White spots on cap
    for sx, sy in [(2,2),(5,2),(1,3),(6,3),(3,1),(4,3)]:
        px(img, sx, sy, MUSH_SPOT)
    save_sprite(img, 'decor_mushroom')


# ========================================================
# 11. decor_bones  -- 12x8 scattered bones
# ========================================================
def make_decor_bones():
    img = create_sprite(12, 8)
    # Bone 1: horizontal long bone
    for x in range(1, 8):
        px(img, x, 2, BONE_LIGHT)
        px(img, x, 3, BONE_DARK)
    # End knobs
    px(img, 0, 1, BONE_LIGHT); px(img, 0, 2, BONE_LIGHT); px(img, 0, 3, BONE_LIGHT)
    px(img, 8, 1, BONE_LIGHT); px(img, 8, 2, BONE_LIGHT); px(img, 8, 3, BONE_LIGHT)
    # Bone 2: shorter diagonal bone
    for i in range(4):
        px(img, 8+i, 4+i, BONE_LIGHT)
        if i > 0:
            px(img, 8+i, 3+i, BONE_DARK)
    # Small skull fragment
    px(img, 2, 5, BONE_LIGHT); px(img, 3, 5, BONE_LIGHT)
    px(img, 2, 6, BONE_DARK);  px(img, 3, 6, BONE_DARK)
    # Eye socket hint
    px(img, 2, 5, BONE_SHAD)
    save_sprite(img, 'decor_bones')


# ========================================================
# 12. decor_crate  -- 14x14 broken wooden crate
# ========================================================
def make_decor_crate():
    img = create_sprite(14, 14)
    # Fill base wood
    rect(img, 1, 1, 12, 12, CR_WOOD)
    # Dark border/shadow
    for x in range(1, 13):
        px(img, x,  1, CR_DARK)
        px(img, x, 12, CR_DARK)
    for y in range(1, 13):
        px(img, 1, y,  CR_DARK)
        px(img, 12, y, CR_DARK)
    # Wood grain lines (horizontal)
    for y in [4, 7, 10]:
        for x in range(2, 12):
            px(img, x, y, CR_DARK)
    # Cross brace (vertical center)
    for y in range(2, 12):
        px(img, 7, y, CR_DARK)
    # Metal corner nails
    for cx, cy in [(2,2),(11,2),(2,11),(11,11)]:
        px(img, cx, cy, CR_NAIL)
    # Broken corner - top-right
    px(img, 11, 1, (0,0,0,0))
    px(img, 12, 1, (0,0,0,0))
    px(img, 12, 2, (0,0,0,0))
    px(img, 13, 0, (0,0,0,0))
    # Splinter shards (lighter wood fragments)
    px(img, 10, 2, W_LIGHT)
    px(img, 11, 3, W_LIGHT)
    save_sprite(img, 'decor_crate')


# ========================================================
# 13. decor_log  -- 24x10 fallen tree log
# ========================================================
def make_decor_log():
    img = create_sprite(24, 10)
    # Main log body
    for y in range(2, 8):
        for x in range(2, 22):
            c = W_MID if (x + y) % 3 == 0 else W_DARK
            img.putpixel((x, y), c + (255,))
    # Top highlight (lighter)
    for x in range(2, 22):
        px(img, x, 2, W_LIGHT)
        px(img, x, 3, W_MID)
    # Bottom shadow
    for x in range(2, 22):
        px(img, x, 7, (28, 16, 6))
    # Left end (cross-section)
    rect(img, 0, 2, 3, 6, (60, 40, 18))
    rect(img, 1, 3, 1, 4, (80, 56, 24))
    px(img, 1, 4, (40, 26, 10))
    # Right end (cross-section)
    rect(img, 21, 2, 3, 6, (60, 40, 18))
    rect(img, 22, 3, 1, 4, (80, 56, 24))
    # Bark texture - dark vertical streaks
    for x in [5, 9, 13, 17]:
        for y in range(3, 7):
            if y % 2 == 0:
                px(img, x, y, W_GRAIN)
    # Moss patches on top
    moss_spots = [(4,2),(8,2),(12,3),(16,2),(19,2)]
    for mx, my in moss_spots:
        px(img, mx, my, (40, 80, 30))
        if mx + 1 < 22:
            px(img, mx+1, my, (50, 90, 35))
    save_sprite(img, 'decor_log')


# ========================================================
# 14. decor_lantern  -- 8x12 oil lantern (warm glow)
# ========================================================
def make_decor_lantern():
    img = create_sprite(8, 12)
    # Hook/hanging top
    px(img, 3, 0, LAN_METAL)
    px(img, 4, 0, LAN_METAL)
    px(img, 2, 1, LAN_METAL)
    px(img, 5, 1, LAN_METAL)
    # Body top cap
    for x in range(2, 6):
        px(img, x, 2, LAN_METAL)
    px(img, 1, 3, LAN_METAL); px(img, 6, 3, LAN_METAL)
    # Glass body (warm glow)
    for y in range(3, 9):
        for x in range(2, 6):
            alpha = 200 if y in (4,5,6) else 160
            px(img, x, y, (220, 180, 60, alpha))
    # Flame inside
    px(img, 3, 5, LAN_FLAME)
    px(img, 4, 5, LAN_FLAME)
    px(img, 3, 4, (255, 200, 60))
    px(img, 4, 4, (255, 200, 60))
    px(img, 3, 6, (200, 120, 20))
    px(img, 4, 6, (200, 120, 20))
    # Metal frame lines
    for y in range(3, 9):
        px(img, 1, y, LAN_BODY)
        px(img, 6, y, LAN_BODY)
    # Bottom cap
    for x in range(1, 7):
        px(img, x, 9, LAN_METAL)
    # Base
    for x in range(2, 6):
        px(img, x, 10, LAN_BODY)
    for x in range(1, 7):
        px(img, x, 11, LAN_BODY)
    save_sprite(img, 'decor_lantern')


# ========================================================
# 15. tree_trunk  -- 12x20 tree trunk with bark texture
# ========================================================
def make_tree_trunk():
    img = create_sprite(12, 20)
    BARK_BASE  = (50, 32, 14)
    BARK_DARK  = (34, 20,  8)
    BARK_LIGHT = (72, 50, 22)
    BARK_RIDGE = (60, 40, 16)
    ROOT       = (40, 26, 10)
    # Main trunk (oval-ish)
    for y in range(0, 18):
        # Vary width slightly
        margin = 0 if y > 14 else (1 if y < 3 or y > 11 else 0)
        for x in range(margin, 12 - margin):
            px(img, x, y, BARK_BASE)
    # Left edge darker (shadow)
    for y in range(0, 18):
        px(img, 0, y, BARK_DARK)
        px(img, 1, y, BARK_DARK)
    # Right edge lighter (highlight)
    for y in range(0, 18):
        px(img, 10, y, BARK_LIGHT)
        px(img, 11, y, BARK_RIDGE)
    # Vertical bark ridges
    for x in [3, 6, 9]:
        for y in range(1, 17, 2):
            px(img, x, y, BARK_DARK)
    # Horizontal ring marks
    for y in [5, 10, 15]:
        for x in range(2, 10):
            if x % 2 == 0:
                px(img, x, y, BARK_DARK)
    # Roots at base (spread out)
    for x in range(0, 12):
        px(img, x, 17, ROOT)
    px(img, 0, 18,  ROOT); px(img, 1, 18,  ROOT)
    px(img, 10, 18, ROOT); px(img, 11, 18, ROOT)
    px(img, 0, 19,  (30, 18, 6))
    px(img, 11, 19, (30, 18, 6))
    # Moss on upper-left
    for mx, my in [(2,2),(3,3),(2,4),(3,2)]:
        px(img, mx, my, (40, 76, 28))
    save_sprite(img, 'tree_trunk')


# ========================================================
# 16. tree_canopy_1  -- 48x48 large canopy top-down
# ========================================================
def make_tree_canopy_1():
    rng = random.Random(16)
    img = create_sprite(48, 48)
    cx, cy = 24, 24
    r = 22
    # Draw circular canopy base
    for y in range(48):
        for x in range(48):
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if dist < r:
                if dist > r - 3:
                    c = F_DARK
                elif dist > r - 7:
                    c = rng.choice([G_DARK, F_DARK, G_MID])
                else:
                    c = rng.choice([G_MID, G_DARK, F_BRIGHT, G_MID, G_DARK])
                img.putpixel((x, y), c + (255,))
    # Canopy clusters (brighter lobes)
    lobe_centers = [(18,18),(30,16),(36,26),(30,34),(18,34),(12,26),(24,22)]
    for lx, ly in lobe_centers:
        lr = rng.randint(6, 10)
        for y in range(max(0,ly-lr), min(48,ly+lr)):
            for x in range(max(0,lx-lr), min(48,lx+lr)):
                dist = ((x-lx)**2 + (y-ly)**2)**0.5
                if dist < lr:
                    col = rng.choice([G_MID, F_BRIGHT, G_LIGHT, G_MID])
                    img.putpixel((x, y), col + (255,))
    # Dark shadows between lobes
    for _ in range(80):
        sx = rng.randint(8, 40)
        sy = rng.randint(8, 40)
        dist = ((sx-cx)**2 + (sy-cy)**2)**0.5
        if dist < r - 2:
            if rng.random() > 0.7:
                img.putpixel((sx, sy), F_DARK + (255,))
    # Highlight dots (sun dapple)
    for _ in range(30):
        hx = rng.randint(10, 38)
        hy = rng.randint(10, 38)
        dist = ((hx-cx)**2 + (hy-cy)**2)**0.5
        if dist < r - 5 and rng.random() > 0.5:
            img.putpixel((hx, hy), (80, 120, 52, 255))
    save_sprite(img, 'tree_canopy_1')


# ========================================================
# 17. tree_canopy_2  -- 40x40 smaller canopy, different shape
# ========================================================
def make_tree_canopy_2():
    rng = random.Random(17)
    img = create_sprite(40, 40)
    cx, cy = 20, 22
    # Irregular shape -- more elongated
    for y in range(40):
        for x in range(40):
            rx = (x - cx) / 16.0
            ry = (y - cy) / 18.0
            dist = (rx**2 + ry**2) ** 0.5
            if dist < 1.0:
                edge = dist > 0.85
                c = F_DARK if edge else rng.choice([G_DARK, G_MID, F_DARK, G_MID])
                img.putpixel((x, y), c + (255,))
    # Sub-lobes
    for lx, ly, lr in [(14,14,7),(26,13,6),(30,24,7),(20,30,6),(11,25,5)]:
        for y in range(max(0,ly-lr), min(40,ly+lr)):
            for x in range(max(0,lx-lr), min(40,lx+lr)):
                if ((x-lx)**2+(y-ly)**2)**0.5 < lr:
                    col = rng.choice([G_MID, G_LIGHT, F_BRIGHT])
                    img.putpixel((x,y), col + (255,))
    # Autumn touches (a few yellow-green pixels)
    for _ in range(20):
        ax, ay = rng.randint(8,32), rng.randint(8,32)
        if img.getpixel((ax, ay))[3] > 0:
            img.putpixel((ax, ay), F_YELLOW + (255,))
    save_sprite(img, 'tree_canopy_2')


# ========================================================
# 18. tree_canopy_3  -- 56x56 extra large dense canopy
# ========================================================
def make_tree_canopy_3():
    rng = random.Random(18)
    img = create_sprite(56, 56)
    cx, cy = 28, 28
    r = 26
    # Base fill
    for y in range(56):
        for x in range(56):
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            if dist < r:
                if dist > r - 4:
                    c = F_DARK
                elif dist > r - 9:
                    c = rng.choice([G_DARK, F_DARK])
                else:
                    c = rng.choice([G_DARK, G_MID, G_DARK, F_DARK, G_MID])
                img.putpixel((x, y), c + (255,))
    # Dense overlapping lobes
    lobes = [(22,20,10),(34,20,9),(38,30,10),(34,38,9),(22,38,9),(14,30,10),(28,28,12)]
    for lx, ly, lr in lobes:
        for y in range(max(0,ly-lr), min(56,ly+lr)):
            for x in range(max(0,lx-lr), min(56,lx+lr)):
                if ((x-lx)**2+(y-ly)**2)**0.5 < lr:
                    col = rng.choice([G_MID, G_DARK, G_MID, F_BRIGHT, G_LIGHT])
                    img.putpixel((x,y), col + (255,))
    # Deep shadow patches
    for _ in range(120):
        sx, sy = rng.randint(8,48), rng.randint(8,48)
        if ((sx-cx)**2+(sy-cy)**2)**0.5 < r - 2:
            if rng.random() > 0.65:
                img.putpixel((sx,sy), (20, 42, 14, 255))
    # Sun dapple highlights
    for _ in range(45):
        hx, hy = rng.randint(12,44), rng.randint(12,44)
        if ((hx-cx)**2+(hy-cy)**2)**0.5 < r - 6:
            img.putpixel((hx,hy), (78, 126, 52, 255))
    save_sprite(img, 'tree_canopy_3')


# ========================================================
# 19. bush_1  -- 16x12 small dark green bush
# ========================================================
def make_bush_1():
    rng = random.Random(19)
    img = create_sprite(16, 12)
    # Three circular sub-bushes
    centers = [(5, 6, 4), (10, 5, 4), (8, 8, 3)]
    for bx, by, br in centers:
        for y in range(max(0,by-br), min(12,by+br+1)):
            for x in range(max(0,bx-br), min(16,bx+br+1)):
                if ((x-bx)**2+(y-by)**2)**0.5 < br:
                    col = rng.choice([G_DARK, F_DARK, G_MID, G_DARK])
                    img.putpixel((x, y), col + (255,))
    # Highlight top edges
    for hx, hy in [(4,3),(5,3),(9,2),(10,2),(8,5),(9,5)]:
        if 0 <= hx < 16 and 0 <= hy < 12:
            px(img, hx, hy, G_LIGHT)
    # Shadow bottom
    for x in range(16):
        if img.getpixel((x, 10))[3] > 0:
            px(img, x, 10, F_DARK)
        if img.getpixel((x, 11))[3] > 0:
            px(img, x, 11, (22, 42, 14))
    save_sprite(img, 'bush_1')


# ========================================================
# 20. bush_2  -- 20x14 larger bush with berries/flowers
# ========================================================
def make_bush_2():
    rng = random.Random(20)
    img = create_sprite(20, 14)
    centers = [(5,8,4),(10,6,5),(15,8,4),(8,10,3),(13,10,3)]
    for bx, by, br in centers:
        for y in range(max(0,by-br), min(14,by+br+1)):
            for x in range(max(0,bx-br), min(20,bx+br+1)):
                if ((x-bx)**2+(y-by)**2)**0.5 < br:
                    col = rng.choice([G_DARK, F_DARK, G_MID, G_DARK, F_DARK])
                    img.putpixel((x, y), col + (255,))
    # Highlights
    for hx, hy in [(4,5),(9,3),(14,5),(7,7),(12,6)]:
        if 0 <= hx < 20 and 0 <= hy < 14:
            px(img, hx, hy, G_LIGHT)
    # Small red berries
    berry_pos = [(6,7),(11,5),(15,7),(9,9),(14,9),(3,9)]
    for bx, by in berry_pos:
        if 0 <= bx < 20 and 0 <= by < 14 and img.getpixel((bx,by))[3] > 0:
            px(img, bx, by, (180, 30, 20))
    # White flower dots
    flower_pos = [(7,5),(13,4),(16,8),(5,10)]
    for fx, fy in flower_pos:
        if 0 <= fx < 20 and 0 <= fy < 14 and img.getpixel((fx,fy))[3] > 0:
            px(img, fx, fy, (220, 210, 190))
    save_sprite(img, 'bush_2')


# ========================================================
# 21. water_puddle  -- 24x16 water puddle, semi-transparent
# ========================================================
def make_water_puddle():
    rng = random.Random(21)
    img = create_sprite(24, 16)
    cx, cy = 12, 8
    # Oval puddle
    for y in range(16):
        for x in range(24):
            rx = (x - cx) / 10.5
            ry = (y - cy) / 6.5
            dist = (rx**2 + ry**2) ** 0.5
            if dist < 1.0:
                if dist > 0.85:
                    c = WAT_MID
                elif dist > 0.7:
                    c = WAT_DEEP
                else:
                    c = rng.choice([WAT_DEEP, WAT_MID, WAT_DEEP, WAT_MID])
                img.putpixel((x, y), c)
    # Reflection highlights
    shine_pos = [(10,7),(11,6),(13,7),(14,8),(9,9)]
    for sx, sy in shine_pos:
        if 0 <= sx < 24 and 0 <= sy < 16 and img.getpixel((sx,sy))[3] > 0:
            img.putpixel((sx, sy), WAT_SHINE)
    # Foam/edge highlights
    for _ in range(8):
        fx, fy = rng.randint(3,21), rng.randint(2,14)
        rx2 = (fx-cx)/10.5; ry2 = (fy-cy)/6.5
        d = (rx2**2+ry2**2)**0.5
        if 0.8 < d < 0.98:
            img.putpixel((fx, fy), WAT_FOAM)
    save_sprite(img, 'water_puddle')


# ========================================================
# 22. rock_1  -- 12x10 small rock with moss
# ========================================================
def make_rock_1():
    img = create_sprite(12, 10)
    # Rock shape (irregular oval)
    rock_pixels = [
        (2,1),(3,1),(4,1),(5,1),(6,1),(7,1),(8,1),(9,1),
        (1,2),(2,2),(3,2),(4,2),(5,2),(6,2),(7,2),(8,2),(9,2),(10,2),
        (0,3),(1,3),(2,3),(3,3),(4,3),(5,3),(6,3),(7,3),(8,3),(9,3),(10,3),(11,3),
        (0,4),(1,4),(2,4),(3,4),(4,4),(5,4),(6,4),(7,4),(8,4),(9,4),(10,4),(11,4),
        (0,5),(1,5),(2,5),(3,5),(4,5),(5,5),(6,5),(7,5),(8,5),(9,5),(10,5),(11,5),
        (1,6),(2,6),(3,6),(4,6),(5,6),(6,6),(7,6),(8,6),(9,6),(10,6),
        (2,7),(3,7),(4,7),(5,7),(6,7),(7,7),(8,7),(9,7),
        (3,8),(4,8),(5,8),(6,8),(7,8),(8,8),
    ]
    for rx, ry in rock_pixels:
        # Base color
        c = S_DARK
        img.putpixel((rx, ry), c + (255,))
    # Top highlight
    for rx, ry in [(3,2),(4,2),(5,2),(6,2),(7,2),(4,1),(5,1)]:
        px(img, rx, ry, S_LIGHT)
    # Mid tone
    for rx, ry in [(2,3),(3,3),(8,4),(9,4),(10,5)]:
        px(img, rx, ry, S_MID)
    # Shadow bottom-right
    for rx, ry in [(8,6),(9,6),(10,5),(9,5),(7,7),(8,7)]:
        px(img, rx, ry, (30, 30, 30))
    # Moss patches (top-left)
    for rx, ry in [(2,3),(3,2),(4,2),(2,4),(3,3)]:
        px(img, rx, ry, (50, 80, 36))
    px(img, 4, 1, (60, 90, 40))
    save_sprite(img, 'rock_1')


# ========================================================
# 23. rock_2  -- 18x14 larger rock
# ========================================================
def make_rock_2():
    rng = random.Random(23)
    img = create_sprite(18, 14)
    cx, cy = 9, 7
    # Irregular rock blob
    for y in range(14):
        for x in range(18):
            rx = (x - cx) / 7.5
            ry = (y - cy) / 5.5
            dist = (rx**2 + ry**2) ** 0.5
            if dist < 1.0:
                if dist > 0.85:
                    c = S_DARK
                elif dist > 0.55:
                    c = rng.choice([S_DARK, S_MID, S_DARK])
                else:
                    c = S_MID
                img.putpixel((x, y), c + (255,))
    # Top highlight arc
    for x in range(5, 14):
        if img.getpixel((x, 2))[3] > 0:
            px(img, x, 2, S_LIGHT)
    for x in range(4, 15):
        if img.getpixel((x, 3))[3] > 0:
            px(img, x, 3, S_MID)
    # Shadow bottom
    for x in range(18):
        if img.getpixel((x, 12))[3] > 0:
            px(img, x, 12, (28, 28, 28))
        if img.getpixel((x, 11))[3] > 0:
            px(img, x, 11, (34, 34, 34))
    # Cracks
    for y in range(4, 10):
        if rng.random() > 0.4:
            px(img, 10, y, (30, 30, 28))
    # Moss
    for mx, my in [(4,3),(5,3),(3,4),(4,4),(5,4),(6,3)]:
        if img.getpixel((mx,my))[3] > 0:
            px(img, mx, my, (44, 76, 30))
    save_sprite(img, 'rock_2')


# ========================================================
# 24. rock_cluster  -- 20x16 group of 2-3 rocks
# ========================================================
def make_rock_cluster():
    rng = random.Random(24)
    img = create_sprite(20, 16)

    def draw_rock(img, cx, cy, rx_r, ry_r, highlight_top=True):
        for y in range(max(0, cy-ry_r-1), min(16, cy+ry_r+1)):
            for x in range(max(0, cx-rx_r-1), min(20, cx+rx_r+1)):
                rx2 = (x - cx) / rx_r
                ry2 = (y - cy) / ry_r
                dist = (rx2**2 + ry2**2) ** 0.5
                if dist < 1.0:
                    c = S_DARK if dist > 0.75 else rng.choice([S_DARK, S_MID])
                    img.putpixel((x, y), c + (255,))
        if highlight_top:
            for x in range(max(0,cx-rx_r+1), min(20,cx+rx_r-1)):
                if 0 <= cy-ry_r+1 < 16 and img.getpixel((x, cy-ry_r+1))[3] > 0:
                    px(img, x, cy-ry_r+1, S_LIGHT)

    # Rock 1: large, left
    draw_rock(img, 6, 9, 5, 5)
    # Rock 2: medium, right
    draw_rock(img, 14, 8, 4, 4)
    # Rock 3: small, back-center
    draw_rock(img, 10, 5, 3, 3)

    # Moss on biggest rock
    for mx, my in [(3,7),(4,6),(5,6),(3,8)]:
        if img.getpixel((mx,my))[3] > 0:
            px(img, mx, my, (44, 76, 30))
    # Shadow under cluster
    for x in range(2, 18):
        if img.getpixel((x, 13))[3] > 0:
            px(img, x, 13, (26, 26, 26))
    save_sprite(img, 'rock_cluster')


# ========================================================
#  Run all generators
# ========================================================
if __name__ == '__main__':
    print('Generating terrain sprites...')
    print()
    print('--- Terrain tiles (16x16) ---')
    make_terrain_grass_1()
    make_terrain_grass_2()
    make_terrain_grass_3()
    make_terrain_dirt_1()
    make_terrain_dirt_2()
    make_terrain_path_1()
    make_terrain_leaves()
    print()
    print('--- Decorations ---')
    make_decor_flower_1()
    make_decor_flower_2()
    make_decor_mushroom()
    make_decor_bones()
    make_decor_crate()
    make_decor_log()
    make_decor_lantern()
    print()
    print('--- Trees ---')
    make_tree_trunk()
    make_tree_canopy_1()
    make_tree_canopy_2()
    make_tree_canopy_3()
    print()
    print('--- Bushes ---')
    make_bush_1()
    make_bush_2()
    print()
    print('--- Water ---')
    make_water_puddle()
    print()
    print('--- Rocks ---')
    make_rock_1()
    make_rock_2()
    make_rock_cluster()
    print()
    print('Done! All sprites saved to:', '/Users/olabelin/Projects/dead-horizon/public/assets/sprites/terrain/')
