"""
Dead Horizon -- Structure sprite generator
Generates 32x32 RGBA PNG sprites for all structures missing from public/assets/sprites/
"""
from PIL import Image

# --- Fargpalett (art-direction.md) ---
DARK_GREEN   = (45, 74, 34)
MOSS_GREEN   = (74, 107, 58)
DIRT_BROWN   = (92, 64, 51)
RUST_BROWN   = (139, 69, 19)
CONCRETE     = (107, 107, 107)
DARK_GREY    = (58, 58, 58)
NIGHT_BLACK  = (26, 26, 46)
BLOOD_RED    = (139, 0, 0)
FIRE_ORANGE  = (212, 98, 11)
BANDAGE_WHT  = (232, 220, 200)
FLANNEL_RED  = (178, 34, 34)
AMMO_GOLD    = (197, 160, 48)
MED_BLUE     = (74, 144, 217)
STEEL        = (140, 140, 150)
DARK_STEEL   = (80, 80, 90)
WOOD_LIGHT   = (120, 90, 60)
WOOD_DARK    = (80, 55, 35)
CHAIN_GREY   = (100, 100, 110)
ELEC_YELLOW  = (220, 200, 40)
ELEC_BLUE    = (100, 180, 255)
TRANSPARENT  = (0, 0, 0, 0)
OIL_BLACK    = (20, 18, 15)
TAR_DARK     = (35, 28, 20)
GLASS_BLUE   = (140, 170, 200)
GLUE_BEIGE   = (200, 185, 140)

SPRITES_DIR = '/Users/olabelin/Projects/dead-horizon/public/assets/sprites'


def create_sprite(size=32):
    return Image.new('RGBA', (size, size), TRANSPARENT)


def px(img, x, y, color):
    if 0 <= x < img.width and 0 <= y < img.height:
        if len(color) == 3:
            color = color + (255,)
        img.putpixel((x, y), color)


def rect(img, x, y, w, h, color):
    for dy in range(h):
        for dx in range(w):
            px(img, x + dx, y + dy, color)


def line_h(img, x, y, length, color):
    for i in range(length):
        px(img, x + i, y, color)


def line_v(img, x, y, length, color):
    for i in range(length):
        px(img, x, y + i, color)


def save_sprite(img, name):
    img.save(f'{SPRITES_DIR}/{name}.png')
    print(f'  Saved {name}.png')


# =========================================================
# PRIMITIVE TRAPS
# =========================================================

def make_cart_wall():
    img = create_sprite()
    # Two shopping carts side by side, top-down view
    # Cart 1 (left)
    rect(img, 2, 8, 12, 16, DARK_GREY)
    rect(img, 3, 9, 10, 14, RUST_BROWN)
    # Cart frame lines
    line_h(img, 3, 9, 10, DARK_STEEL)
    line_h(img, 3, 22, 10, DARK_STEEL)
    line_v(img, 3, 9, 14, DARK_STEEL)
    line_v(img, 12, 9, 14, DARK_STEEL)
    # Wheels
    px(img, 2, 8, DARK_STEEL)
    px(img, 13, 8, DARK_STEEL)
    px(img, 2, 23, DARK_STEEL)
    px(img, 13, 23, DARK_STEEL)
    # Cart 2 (right)
    rect(img, 18, 8, 12, 16, DARK_GREY)
    rect(img, 19, 9, 10, 14, RUST_BROWN)
    line_h(img, 19, 9, 10, DARK_STEEL)
    line_h(img, 19, 22, 10, DARK_STEEL)
    line_v(img, 19, 9, 14, DARK_STEEL)
    line_v(img, 28, 9, 14, DARK_STEEL)
    px(img, 18, 8, DARK_STEEL)
    px(img, 29, 8, DARK_STEEL)
    px(img, 18, 23, DARK_STEEL)
    px(img, 29, 23, DARK_STEEL)
    # Gap/connection
    line_h(img, 14, 15, 4, DARK_STEEL)
    line_h(img, 14, 16, 4, DARK_STEEL)
    save_sprite(img, 'struct_cart_wall')


def make_nail_board():
    img = create_sprite()
    # Two wooden planks horizontal with nails sticking up
    rect(img, 1, 10, 30, 5, WOOD_DARK)
    rect(img, 1, 17, 30, 5, WOOD_DARK)
    # Wood grain
    for x in range(2, 30, 4):
        line_v(img, x, 10, 5, WOOD_LIGHT)
        line_v(img, x, 17, 5, WOOD_LIGHT)
    # Nails (grey dots on planks)
    nail_positions = [3, 7, 11, 15, 19, 23, 27]
    for nx in nail_positions:
        px(img, nx, 10, STEEL)
        px(img, nx, 11, BANDAGE_WHT)
        px(img, nx, 17, STEEL)
        px(img, nx, 18, BANDAGE_WHT)
    save_sprite(img, 'struct_nail_board')


def make_trip_wire():
    img = create_sprite()
    # Two wooden stakes with wire between them
    # Left stake
    rect(img, 3, 6, 3, 20, WOOD_DARK)
    px(img, 4, 5, WOOD_DARK)
    px(img, 4, 4, WOOD_LIGHT)
    # Right stake
    rect(img, 26, 6, 3, 20, WOOD_DARK)
    px(img, 27, 5, WOOD_DARK)
    px(img, 27, 4, WOOD_LIGHT)
    # Wire -- thin horizontal lines
    for y in [12, 13, 20, 21]:
        line_h(img, 6, y, 20, STEEL)
    # Small knots at stake connection
    px(img, 6, 12, BANDAGE_WHT)
    px(img, 6, 20, BANDAGE_WHT)
    px(img, 25, 12, BANDAGE_WHT)
    px(img, 25, 20, BANDAGE_WHT)
    save_sprite(img, 'struct_trip_wire')


def make_glass_shards():
    img = create_sprite()
    # Scattered glass shards on dark ground
    rect(img, 4, 4, 24, 24, (30, 28, 26, 180))
    # Glass shards -- irregular blue-white pieces
    shards = [
        (6, 6), (10, 8), (15, 5), (20, 7), (24, 9),
        (8, 14), (13, 12), (18, 15), (23, 13),
        (7, 20), (12, 22), (17, 19), (22, 21), (26, 18),
        (5, 26), (14, 27), (21, 25), (27, 23),
    ]
    for sx, sy in shards:
        px(img, sx, sy, GLASS_BLUE)
        px(img, sx + 1, sy, (180, 210, 240, 200))
        px(img, sx, sy + 1, (160, 190, 220, 180))
    # Some bright white reflections
    bright = [(11, 9), (19, 16), (8, 21), (24, 7)]
    for bx, by in bright:
        px(img, bx, by, BANDAGE_WHT)
    save_sprite(img, 'struct_glass_shards')


def make_tar_pit():
    img = create_sprite()
    # Dark oval pool of tar
    cx, cy, rx, ry = 16, 16, 12, 9
    for y in range(32):
        for x in range(32):
            dx = (x - cx) / rx
            dy = (y - cy) / ry
            dist = dx*dx + dy*dy
            if dist < 1.0:
                alpha = int(230 * (1 - dist * 0.3))
                img.putpixel((x, y), TAR_DARK + (alpha,))
            elif dist < 1.2:
                img.putpixel((x, y), (50, 40, 28, 120))
    # Tar highlight/bubble spots
    for bx, by in [(14, 14), (18, 17), (12, 18)]:
        px(img, bx, by, (55, 45, 30, 200))
        px(img, bx + 1, by, (45, 38, 25, 180))
    save_sprite(img, 'struct_tar_pit')


def make_glue_floor():
    img = create_sprite()
    # Sticky beige/yellowish puddle
    cx, cy, rx, ry = 16, 16, 11, 8
    for y in range(32):
        for x in range(32):
            dx = (x - cx) / rx
            dy = (y - cy) / ry
            dist = dx*dx + dy*dy
            if dist < 1.0:
                alpha = int(200 * (1 - dist * 0.4))
                img.putpixel((x, y), GLUE_BEIGE + (alpha,))
            elif dist < 1.2:
                img.putpixel((x, y), (190, 175, 130, 80))
    # Strands/strings of glue
    for gx in range(8, 24, 3):
        px(img, gx, 14, (210, 200, 160, 220))
        px(img, gx + 1, 15, (210, 200, 160, 200))
    save_sprite(img, 'struct_glue_floor')


def make_shopping_cart_wall():
    img = create_sprite()
    # Three tipped carts crammed together
    for cx in [2, 12, 22]:
        rect(img, cx, 7, 8, 18, DARK_GREY)
        rect(img, cx + 1, 8, 6, 16, RUST_BROWN)
        line_h(img, cx + 1, 8, 6, DARK_STEEL)
        line_h(img, cx + 1, 23, 6, DARK_STEEL)
        line_v(img, cx + 1, 8, 16, DARK_STEEL)
        line_v(img, cx + 6, 8, 16, DARK_STEEL)
        # Wheel dots
        px(img, cx, 7, STEEL)
        px(img, cx + 7, 7, STEEL)
        px(img, cx, 24, STEEL)
        px(img, cx + 7, 24, STEEL)
    save_sprite(img, 'struct_shopping_cart_wall')


def make_car_wreck_barrier():
    img = create_sprite()
    # Top-down view of a crushed car blocking the way
    # Car body
    rect(img, 3, 6, 26, 20, RUST_BROWN)
    rect(img, 5, 8, 22, 16, DARK_GREY)
    # Windshield/windows
    rect(img, 7, 9, 8, 6, (70, 80, 90, 200))
    rect(img, 17, 9, 8, 6, (70, 80, 90, 200))
    # Crumple/damage marks
    for dx, dy in [(6, 7), (10, 8), (14, 12), (20, 10), (24, 14)]:
        px(img, dx, dy, DARK_STEEL)
        px(img, dx + 1, dy, DARK_STEEL)
    # Wheels (corners)
    for wx, wy in [(3, 6), (25, 6), (3, 22), (25, 22)]:
        rect(img, wx, wy, 4, 4, NIGHT_BLACK)
    save_sprite(img, 'struct_car_wreck_barrier')


def make_dumpster_fortress():
    img = create_sprite()
    # Large green/grey dumpster container, top-down
    rect(img, 2, 4, 28, 24, DARK_GREY)
    rect(img, 4, 6, 24, 20, (55, 65, 55, 255))
    # Lid panels
    rect(img, 4, 6, 11, 9, DARK_GREY)
    rect(img, 17, 6, 11, 9, DARK_GREY)
    line_v(img, 15, 6, 9, DARK_STEEL)
    line_v(img, 16, 6, 9, DARK_STEEL)
    # Rust streaks
    for rx in [6, 12, 20, 26]:
        line_v(img, rx, 10, 12, RUST_BROWN)
    # Handle
    rect(img, 13, 17, 6, 3, STEEL)
    save_sprite(img, 'struct_dumpster_fortress')


# =========================================================
# MACHINE TRAPS
# =========================================================

def make_blade_spinner():
    img = create_sprite()
    # Central hub with spinning blades (top-down)
    cx, cy = 16, 16
    # Hub
    rect(img, cx - 3, cy - 3, 6, 6, DARK_STEEL)
    px(img, cx, cy, STEEL)
    # Four blades
    # North blade
    rect(img, cx - 1, cy - 10, 3, 8, STEEL)
    px(img, cx - 2, cy - 10, DARK_STEEL)
    px(img, cx + 2, cy - 10, DARK_STEEL)
    # South blade
    rect(img, cx - 1, cy + 3, 3, 8, STEEL)
    px(img, cx - 2, cy + 10, DARK_STEEL)
    px(img, cx + 2, cy + 10, DARK_STEEL)
    # West blade
    rect(img, cx - 10, cy - 1, 8, 3, STEEL)
    px(img, cx - 10, cy - 2, DARK_STEEL)
    px(img, cx - 10, cy + 2, DARK_STEEL)
    # East blade
    rect(img, cx + 3, cy - 1, 8, 3, STEEL)
    px(img, cx + 10, cy - 2, DARK_STEEL)
    px(img, cx + 10, cy + 2, DARK_STEEL)
    # Blood stain hint
    px(img, cx + 8, cy - 3, BLOOD_RED)
    px(img, cx - 7, cy + 4, BLOOD_RED)
    save_sprite(img, 'struct_blade_spinner')


def make_fire_pit():
    img = create_sprite()
    # Stone ring with fire/embers inside, top-down
    for y in range(32):
        for x in range(32):
            cx, cy = 16, 16
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            if 9 <= dist <= 12:
                img.putpixel((x, y), CONCRETE + (255,))
            elif dist < 9:
                img.putpixel((x, y), (40, 30, 20, 255))
    # Ember/fire spots inside
    for fx, fy, col in [
        (14, 14, FIRE_ORANGE), (17, 13, FIRE_ORANGE),
        (15, 17, FIRE_ORANGE), (18, 16, (180, 60, 0, 255)),
        (13, 18, (160, 50, 0, 255)), (16, 15, AMMO_GOLD),
        (19, 18, AMMO_GOLD),
    ]:
        px(img, fx, fy, col)
    # Stone highlights
    for sx, sy in [(10, 10), (22, 10), (10, 22), (22, 22)]:
        px(img, sx, sy, BANDAGE_WHT)
    save_sprite(img, 'struct_fire_pit')


def make_propane_geyser():
    img = create_sprite()
    # Propane tank with nozzle, top-down
    for y in range(32):
        for x in range(32):
            cx, cy = 16, 17
            dx = (x - cx) / 7
            dy = (y - cy) / 10
            dist = dx*dx + dy*dy
            if dist < 1.0:
                img.putpixel((x, y), RUST_BROWN + (255,))
            elif dist < 1.15:
                img.putpixel((x, y), DARK_GREY + (255,))
    # Label stripes
    line_h(img, 11, 14, 10, AMMO_GOLD)
    line_h(img, 11, 20, 10, AMMO_GOLD)
    # Nozzle pointing up
    rect(img, 14, 3, 4, 5, DARK_STEEL)
    rect(img, 15, 2, 2, 2, STEEL)
    # Flame tip hint
    px(img, 15, 1, FIRE_ORANGE)
    px(img, 16, 1, AMMO_GOLD)
    # Valve wheel
    rect(img, 13, 13, 6, 2, STEEL)
    rect(img, 15, 11, 2, 6, STEEL)
    save_sprite(img, 'struct_propane_geyser')


def make_washing_cannon():
    img = create_sprite()
    # Old washing machine body with barrel/cannon extension
    # Machine body
    rect(img, 4, 6, 18, 20, DARK_GREY)
    rect(img, 6, 8, 14, 16, DARK_STEEL)
    # Drum (circular porthole)
    for y in range(32):
        for x in range(32):
            cx, cy = 13, 16
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            if dist < 5:
                img.putpixel((x, y), (50, 55, 65, 255))
            elif dist < 6:
                img.putpixel((x, y), STEEL + (255,))
    # Cannon barrel
    rect(img, 22, 14, 8, 4, DARK_STEEL)
    rect(img, 28, 13, 3, 6, STEEL)
    # Bolts
    for bx, by in [(5, 7), (20, 7), (5, 23), (20, 23)]:
        px(img, bx, by, STEEL)
    save_sprite(img, 'struct_washing_cannon')


def make_shock_wire():
    img = create_sprite()
    # Two posts with electric wire between them, sparks
    # Posts
    rect(img, 4, 8, 4, 16, DARK_STEEL)
    rect(img, 24, 8, 4, 16, DARK_STEEL)
    # Post caps
    rect(img, 3, 7, 6, 3, STEEL)
    rect(img, 23, 7, 6, 3, STEEL)
    # Wire lines
    for wy in [12, 16, 20]:
        line_h(img, 8, wy, 16, DARK_STEEL)
    # Electric sparks
    spark_positions = [(11, 11), (16, 15), (20, 19), (14, 12)]
    for spx, spy in spark_positions:
        px(img, spx, spy, ELEC_YELLOW)
        px(img, spx + 1, spy - 1, ELEC_BLUE)
        px(img, spx - 1, spy + 1, ELEC_YELLOW)
    save_sprite(img, 'struct_shock_wire')


def make_spring_launcher():
    img = create_sprite()
    # Coiled spring with launch plate on top
    # Base plate
    rect(img, 6, 22, 20, 4, DARK_STEEL)
    # Spring coils
    for coil_y in range(10, 22, 3):
        rect(img, 10, coil_y, 12, 2, STEEL)
        if coil_y < 21:
            rect(img, 10, coil_y + 2, 12, 1, DARK_STEEL)
    # Launch plate (top)
    rect(img, 8, 6, 16, 4, STEEL)
    rect(img, 9, 7, 14, 2, BANDAGE_WHT)
    # Bolts on base
    for bx in [7, 13, 19, 24]:
        px(img, bx, 23, AMMO_GOLD)
    save_sprite(img, 'struct_spring_launcher')


def make_chain_wall():
    img = create_sprite()
    # Two thick posts with chain loops between
    # Posts
    rect(img, 3, 4, 5, 24, RUST_BROWN)
    rect(img, 24, 4, 5, 24, RUST_BROWN)
    # Chain links
    for cy in range(8, 24, 4):
        for link_x in range(8, 24, 3):
            rect(img, link_x, cy, 2, 3, CHAIN_GREY)
            rect(img, link_x + 1, cy + 1, 2, 1, DARK_GREY)
    # Anchor bolts
    for py in [6, 14, 22]:
        px(img, 5, py, AMMO_GOLD)
        px(img, 24, py, AMMO_GOLD)
    save_sprite(img, 'struct_chain_wall')


def make_circle_saw_trap():
    img = create_sprite()
    # Circular saw blade partially emerging from floor hatch
    # Floor hatch (dark rectangle)
    rect(img, 6, 6, 20, 20, DARK_GREY)
    rect(img, 7, 7, 18, 18, DARK_STEEL)
    # Hatch seam
    line_h(img, 6, 16, 20, DARK_GREY)
    line_v(img, 16, 6, 20, DARK_GREY)
    # Saw blade (circular, serrated)
    cx, cy = 16, 16
    for y in range(32):
        for x in range(32):
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            if 5 < dist < 8:
                img.putpixel((x, y), STEEL + (255,))
            elif dist <= 5:
                img.putpixel((x, y), DARK_STEEL + (255,))
    # Teeth
    for tx, ty in [(16, 7), (23, 12), (23, 20), (16, 25), (9, 20), (9, 12)]:
        px(img, tx, ty, BANDAGE_WHT)
    # Center bolt
    px(img, 16, 16, AMMO_GOLD)
    # Blood hint
    px(img, 21, 11, BLOOD_RED)
    save_sprite(img, 'struct_circle_saw_trap')


def make_razor_wire_carousel():
    img = create_sprite()
    # Central pole with rotating arms bearing razor wire
    # Center pole
    rect(img, 14, 14, 4, 4, DARK_STEEL)
    px(img, 15, 15, STEEL)
    # Arms (4 directions)
    line_h(img, 4, 15, 10, DARK_STEEL)
    line_h(img, 18, 15, 10, DARK_STEEL)
    line_v(img, 15, 4, 10, DARK_STEEL)
    line_v(img, 15, 18, 10, DARK_STEEL)
    # Razor wire along arms (small ticks)
    for i in range(4, 14, 2):
        px(img, i, 14, STEEL)
        px(img, i, 16, STEEL)
        px(img, 18 + i - 4, 14, STEEL)
        px(img, 18 + i - 4, 16, STEEL)
        px(img, 14, i, STEEL)
        px(img, 16, i, STEEL)
        px(img, 14, 18 + i - 4, STEEL)
        px(img, 16, 18 + i - 4, STEEL)
    # Blood spots
    px(img, 5, 13, BLOOD_RED)
    px(img, 26, 17, BLOOD_RED)
    save_sprite(img, 'struct_razor_wire_carousel')


def make_lawnmower_lane():
    img = create_sprite()
    # Upside-down lawnmower showing blades underneath, top-down
    # Body (wide rectangular)
    rect(img, 3, 8, 26, 16, DARK_GREY)
    rect(img, 4, 9, 24, 14, RUST_BROWN)
    # Blade housing (bottom)
    rect(img, 4, 18, 24, 4, DARK_STEEL)
    # Blades poking out
    for bx in range(5, 27, 4):
        line_h(img, bx, 22, 3, STEEL)
        px(img, bx + 1, 23, BANDAGE_WHT)
    # Handle bars (top)
    line_h(img, 7, 6, 18, DARK_STEEL)
    line_v(img, 7, 4, 4, DARK_STEEL)
    line_v(img, 24, 4, 4, DARK_STEEL)
    # Wheels (corners)
    for wx, wy in [(3, 8), (25, 8), (3, 20), (25, 20)]:
        rect(img, wx, wy, 3, 3, NIGHT_BLACK)
    # Grass clippings hint
    for gx, gy in [(8, 15), (14, 13), (20, 16)]:
        px(img, gx, gy, MOSS_GREEN)
    save_sprite(img, 'struct_lawnmower_lane')


def make_treadmill_of_doom():
    img = create_sprite()
    # Conveyor belt with spike rollers, top-down
    # Belt surface
    rect(img, 3, 8, 26, 16, DARK_GREY)
    # Belt slats
    for bx in range(4, 28, 3):
        line_v(img, bx, 8, 16, DARK_STEEL)
    # End rollers
    rect(img, 3, 8, 4, 16, STEEL)
    rect(img, 25, 8, 4, 16, STEEL)
    # Knives/blades on belt surface
    for kx in range(7, 25, 5):
        rect(img, kx, 11, 2, 10, STEEL)
        px(img, kx, 10, BANDAGE_WHT)
        px(img, kx + 1, 10, BANDAGE_WHT)
    # Arrow indicating direction
    for ax in [14, 15, 16]:
        px(img, ax, 9, AMMO_GOLD)
    px(img, 15, 8, AMMO_GOLD)
    px(img, 15, 10, AMMO_GOLD)
    save_sprite(img, 'struct_treadmill_of_doom')


def make_pendulum_axe():
    img = create_sprite()
    # Overhead view of pendulum axe on ceiling mount
    # Ceiling mount bar
    rect(img, 8, 3, 16, 4, DARK_STEEL)
    # Chain/rope
    line_v(img, 16, 7, 8, CHAIN_GREY)
    line_v(img, 15, 7, 8, CHAIN_GREY)
    # Axe head (large, angled blade)
    for y in range(15, 28):
        width = max(1, (28 - y) // 2)
        rect(img, 16 - width, y, width * 2, 1, STEEL)
    # Axe edge (sharper side)
    for y in range(15, 28):
        px(img, 16 - (28 - y) // 2, y, BANDAGE_WHT)
    # Blood on blade
    for bx, by in [(12, 22), (14, 25), (18, 20)]:
        px(img, bx, by, BLOOD_RED)
    # Handle
    rect(img, 15, 14, 2, 2, WOOD_DARK)
    save_sprite(img, 'struct_pendulum_axe')


def make_garage_door_smasher():
    img = create_sprite()
    # Garage door half-open (panels visible), crushing mechanism
    # Frame
    rect(img, 2, 2, 28, 4, DARK_STEEL)
    # Door panels (horizontal corrugated panels)
    for py in range(6, 24, 4):
        rect(img, 2, py, 28, 3, DARK_GREY)
        rect(img, 3, py + 1, 26, 1, CONCRETE)
    # Door tracks (side rails)
    rect(img, 2, 2, 2, 26, DARK_STEEL)
    rect(img, 28, 2, 2, 26, DARK_STEEL)
    # Crushing weight/springs at top
    rect(img, 8, 2, 16, 2, STEEL)
    # Bolts
    for bx in [4, 10, 16, 22, 28]:
        px(img, bx, 3, AMMO_GOLD)
    # Gap at bottom showing it can smash down
    rect(img, 4, 26, 24, 3, NIGHT_BLACK)
    save_sprite(img, 'struct_garage_door_smasher')


def make_bug_zapper_xl():
    img = create_sprite()
    # Large UV tube with electric grid, top-down view
    # Housing box
    rect(img, 4, 4, 24, 24, DARK_GREY)
    rect(img, 6, 6, 20, 20, DARK_STEEL)
    # UV tube (bright blue-purple rectangle in center)
    rect(img, 10, 8, 12, 16, (80, 60, 150, 255))
    rect(img, 11, 9, 10, 14, (120, 90, 200, 230))
    # Electric grid wires
    for gx in range(6, 26, 3):
        line_v(img, gx, 6, 20, (100, 80, 160, 180))
    for gy in range(6, 26, 3):
        line_h(img, 6, gy, 20, (100, 80, 160, 180))
    # Spark effects
    for sx, sy in [(7, 7), (25, 8), (7, 25), (25, 24), (16, 5), (16, 27)]:
        px(img, sx, sy, ELEC_YELLOW)
        px(img, sx + 1, sy, ELEC_BLUE)
    save_sprite(img, 'struct_bug_zapper_xl')


def make_car_battery_grid():
    img = create_sprite()
    # 2x2 grid of car batteries with cables between
    battery_positions = [(3, 3), (17, 3), (3, 17), (17, 17)]
    for bx, by in battery_positions:
        # Battery body
        rect(img, bx, by, 12, 10, DARK_GREY)
        rect(img, bx + 1, by + 1, 10, 8, (30, 35, 28, 255))
        # Terminals (+ and -)
        px(img, bx + 3, by, BANDAGE_WHT)
        px(img, bx + 8, by, BLOOD_RED)
        # Label
        rect(img, bx + 2, by + 3, 8, 3, (40, 50, 40, 255))
    # Cables connecting them
    line_h(img, 15, 8, 4, AMMO_GOLD)
    line_v(img, 8, 13, 4, AMMO_GOLD)
    line_v(img, 22, 13, 4, AMMO_GOLD)
    line_h(img, 15, 22, 4, AMMO_GOLD)
    # Center connection
    rect(img, 13, 13, 6, 6, DARK_STEEL)
    px(img, 15, 15, ELEC_YELLOW)
    px(img, 16, 16, ELEC_BLUE)
    save_sprite(img, 'struct_car_battery_grid')


def make_electric_fence():
    img = create_sprite()
    # Fence posts with electrified wire, top-down
    # Posts
    for px_pos in [3, 14, 25]:
        rect(img, px_pos, 4, 4, 24, DARK_STEEL)
        px(img, px_pos + 2, 3, CONCRETE)
        px(img, px_pos + 2, 28, CONCRETE)
    # Three horizontal wires
    for wy in [9, 16, 23]:
        line_h(img, 7, wy, 8, DARK_STEEL)
        line_h(img, 18, wy, 8, DARK_STEEL)
        # Spark on each wire
        px(img, 10, wy - 1, ELEC_YELLOW)
        px(img, 11, wy, ELEC_BLUE)
        px(img, 21, wy - 1, ELEC_YELLOW)
        px(img, 22, wy, ELEC_BLUE)
    # Insulators (white dots at post-wire junctions)
    for pxp in [7, 18]:
        for wy in [9, 16, 23]:
            px(img, pxp, wy, BANDAGE_WHT)
    save_sprite(img, 'struct_electric_fence')


def make_net_launcher():
    img = create_sprite()
    # Cannon/tube mounted on base, net coiled on top
    # Base
    rect(img, 8, 20, 16, 8, DARK_STEEL)
    rect(img, 10, 22, 12, 6, DARK_GREY)
    # Barrel
    rect(img, 12, 8, 8, 14, DARK_GREY)
    rect(img, 13, 9, 6, 12, DARK_STEEL)
    # Muzzle
    rect(img, 11, 5, 10, 4, STEEL)
    # Net coil (on sides)
    for ny in range(20, 27, 2):
        line_h(img, 4, ny, 6, DIRT_BROWN)
    for ny in range(20, 27, 2):
        line_h(img, 22, ny, 6, DIRT_BROWN)
    # Net mesh pattern on coil
    for nx in range(4, 9):
        for ny in range(20, 28):
            if (nx + ny) % 2 == 0:
                px(img, nx, ny, BANDAGE_WHT)
    save_sprite(img, 'struct_net_launcher')


def make_meat_grinder():
    img = create_sprite()
    # Industrial meat grinder with large funnel top, blades visible
    # Motor body
    rect(img, 8, 14, 16, 14, DARK_GREY)
    rect(img, 9, 15, 14, 12, RUST_BROWN)
    # Funnel (top)
    for y in range(4, 14):
        width = max(2, 14 - (y - 4))
        cx = 16
        rect(img, cx - width, y, width * 2, 1, DARK_STEEL)
    # Output spout (right side)
    rect(img, 24, 20, 5, 5, RUST_BROWN)
    px(img, 29, 22, BLOOD_RED)
    px(img, 29, 23, BLOOD_RED)
    # Blades visible in funnel
    line_h(img, 11, 11, 10, STEEL)
    line_v(img, 16, 7, 8, STEEL)
    px(img, 15, 9, BLOOD_RED)
    px(img, 17, 13, BLOOD_RED)
    # Crank handle
    rect(img, 3, 18, 6, 2, DARK_STEEL)
    rect(img, 2, 16, 2, 6, DARK_STEEL)
    save_sprite(img, 'struct_meat_grinder')


def make_belt_sander_gauntlet():
    img = create_sprite()
    # Long belt sander lying flat, top-down
    # Sander body
    rect(img, 2, 8, 28, 16, DARK_GREY)
    rect(img, 4, 10, 24, 12, RUST_BROWN)
    # Sanding belt (rough texture)
    for bx in range(4, 28, 2):
        line_v(img, bx, 10, 12, (100, 75, 55, 255))
        if bx % 4 == 0:
            line_v(img, bx + 1, 10, 12, DIRT_BROWN)
    # Front/rear rollers
    rect(img, 2, 8, 4, 16, STEEL)
    rect(img, 26, 8, 4, 16, STEEL)
    # Motor housing
    rect(img, 12, 5, 8, 4, DARK_STEEL)
    px(img, 15, 4, AMMO_GOLD)
    px(img, 16, 4, AMMO_GOLD)
    # Safety warning strip
    for wx in range(4, 28, 4):
        px(img, wx, 10, AMMO_GOLD)
        px(img, wx + 1, 21, AMMO_GOLD)
    save_sprite(img, 'struct_belt_sander_gauntlet')


def make_power_drill_press():
    img = create_sprite()
    # Drill press column top-down, drill bit pointing down
    # Column base
    rect(img, 10, 20, 12, 8, DARK_STEEL)
    # Column
    rect(img, 13, 8, 6, 14, DARK_GREY)
    # Head (motor housing)
    rect(img, 8, 5, 16, 8, DARK_STEEL)
    rect(img, 9, 6, 14, 6, DARK_GREY)
    # Drill chuck
    rect(img, 13, 13, 6, 4, STEEL)
    # Drill bit
    for dy in range(17, 26):
        width = max(1, 3 - (dy - 17) // 3)
        rect(img, 16 - width, dy, width * 2, 1, STEEL)
    px(img, 16, 25, BANDAGE_WHT)
    # Control arm
    rect(img, 24, 8, 4, 2, DARK_STEEL)
    rect(img, 26, 8, 2, 8, DARK_STEEL)
    px(img, 27, 16, BLOOD_RED)
    # Bolts
    for bx, by in [(10, 20), (20, 20), (10, 27), (20, 27)]:
        px(img, bx, by, AMMO_GOLD)
    save_sprite(img, 'struct_power_drill_press')


def make_piano_wire_web():
    img = create_sprite()
    # Thin criss-crossing wires forming a deadly web
    # Corner anchor points
    for cx, cy in [(2, 2), (29, 2), (2, 29), (29, 29)]:
        rect(img, cx, cy, 2, 2, DARK_STEEL)
    # Diagonal wires (simplified criss-cross pattern)
    for i in range(0, 32, 4):
        for t in range(32):
            x1 = int(t * 29 / 31)
            y1 = int((t + i) % 32)
            px(img, x1, y1, STEEL)
    # Horizontal wires
    for wy in [8, 16, 24]:
        line_h(img, 2, wy, 28, (180, 180, 190, 200))
    # Vertical wires
    for wx in [8, 16, 24]:
        line_v(img, wx, 2, 28, (180, 180, 190, 200))
    # Blood droplets where wires cross
    for bx, by in [(8, 8), (16, 24), (24, 16)]:
        px(img, bx, by, BLOOD_RED)
    save_sprite(img, 'struct_piano_wire_web')


def make_combine_harvester():
    img = create_sprite()
    # Large combine harvester top-down, wide cutting head
    # Cutting header (front, wide)
    rect(img, 1, 3, 30, 8, DARK_GREY)
    rect(img, 2, 4, 28, 6, RUST_BROWN)
    # Cutting teeth
    for tx in range(2, 29, 3):
        rect(img, tx, 2, 2, 3, STEEL)
        px(img, tx, 1, BANDAGE_WHT)
    # Main body
    rect(img, 4, 11, 24, 18, DARK_GREY)
    rect(img, 5, 12, 22, 16, RUST_BROWN)
    # Cabin
    rect(img, 9, 13, 14, 10, (55, 60, 50, 255))
    rect(img, 10, 14, 12, 8, (70, 80, 70, 255))
    # Exhaust pipe
    rect(img, 26, 12, 3, 6, DARK_STEEL)
    px(img, 27, 11, (50, 50, 50, 200))
    # Wheels
    for wx, wy in [(3, 11), (25, 11), (3, 25), (25, 25)]:
        rect(img, wx, wy, 4, 4, NIGHT_BLACK)
    # Blood on cutter
    for bx in [5, 11, 17, 23]:
        px(img, bx, 3, BLOOD_RED)
    save_sprite(img, 'struct_combine_harvester')


def make_car_bomb():
    img = create_sprite()
    # Ruined car wreck rigged with explosives, top-down
    # Car body
    rect(img, 4, 7, 24, 18, RUST_BROWN)
    rect(img, 5, 8, 22, 16, DARK_GREY)
    # Windows (cracked)
    rect(img, 7, 9, 8, 5, (50, 55, 60, 200))
    rect(img, 17, 9, 8, 5, (50, 55, 60, 200))
    # Crack in window
    for ci in range(4):
        px(img, 9 + ci, 9 + ci, BANDAGE_WHT)
    # Explosives strapped to car
    rect(img, 8, 17, 16, 5, FIRE_ORANGE)
    # Sticks of dynamite
    for dx in [9, 13, 17, 21]:
        rect(img, dx, 17, 3, 5, BLOOD_RED)
        px(img, dx + 1, 16, AMMO_GOLD)
    # Wires
    line_h(img, 8, 16, 16, AMMO_GOLD)
    # Detonator
    rect(img, 14, 12, 4, 4, DARK_STEEL)
    px(img, 15, 13, BLOOD_RED)
    # Wheels
    for wx, wy in [(3, 7), (25, 7), (3, 21), (25, 21)]:
        rect(img, wx, wy, 3, 3, NIGHT_BLACK)
    save_sprite(img, 'struct_car_bomb')


def make_napalm_sprinkler():
    img = create_sprite()
    # Rotating sprinkler head with fire jets, top-down
    # Center mounting
    rect(img, 13, 13, 6, 6, DARK_STEEL)
    px(img, 15, 15, STEEL)
    px(img, 16, 16, STEEL)
    # Sprinkler arms
    line_h(img, 3, 15, 10, RUST_BROWN)
    line_h(img, 19, 15, 10, RUST_BROWN)
    line_v(img, 15, 3, 10, RUST_BROWN)
    line_v(img, 15, 19, 10, RUST_BROWN)
    # Fire jets at arm tips
    for fx, fy in [(3, 14), (3, 16), (28, 14), (28, 16)]:
        px(img, fx, fy, FIRE_ORANGE)
        px(img, fx - 1, fy, (180, 70, 5, 200))
    for fx, fy in [(14, 3), (16, 3), (14, 28), (16, 28)]:
        px(img, fx, fy, FIRE_ORANGE)
        px(img, fx, fy - 1, (180, 70, 5, 200))
    # Flame glow
    for gx, gy in [(2, 15), (29, 15), (15, 2), (15, 29)]:
        px(img, gx, gy, AMMO_GOLD)
    # Fuel tube
    rect(img, 14, 6, 4, 7, (100, 80, 40, 200))
    save_sprite(img, 'struct_napalm_sprinkler')


def make_gas_main_igniter():
    img = create_sprite()
    # Gas pipe section with igniter/sparker on top
    # Main pipe (horizontal)
    rect(img, 1, 13, 30, 6, RUST_BROWN)
    rect(img, 2, 14, 28, 4, (110, 80, 40, 255))
    # Pipe segments
    for sx in range(4, 29, 6):
        line_v(img, sx, 13, 6, DARK_GREY)
    # Bolted flanges
    for fx in [4, 16, 26]:
        rect(img, fx, 12, 2, 8, DARK_STEEL)
    # Pressure valve on top
    rect(img, 13, 7, 6, 6, DARK_STEEL)
    rect(img, 14, 8, 4, 4, RUST_BROWN)
    line_h(img, 11, 10, 10, DARK_STEEL)
    # Igniter spark
    px(img, 16, 6, ELEC_YELLOW)
    px(img, 15, 5, FIRE_ORANGE)
    px(img, 17, 5, AMMO_GOLD)
    # Gas leak wisps
    for gx, gy in [(8, 11), (20, 11), (24, 12)]:
        px(img, gx, gy, (200, 200, 150, 150))
    save_sprite(img, 'struct_gas_main_igniter')


def make_flamethrower_post():
    img = create_sprite()
    # Post/pole with flamethrower nozzle, top-down
    # Post base
    rect(img, 13, 18, 6, 10, DARK_STEEL)
    # Body/tank (oval)
    for y in range(32):
        for x in range(32):
            cx, cy = 16, 20
            dx2 = (x - cx) / 5
            dy2 = (y - cy) / 7
            dist = dx2*dx2 + dy2*dy2
            if dist < 1.0:
                img.putpixel((x, y), RUST_BROWN + (255,))
    # Nozzle (pointing up/north)
    rect(img, 14, 7, 4, 11, DARK_GREY)
    rect(img, 15, 6, 2, 2, STEEL)
    # Flame
    for fy in range(1, 6):
        width = max(1, 3 - fy // 2)
        rect(img, 16 - width, fy, width * 2, 1, FIRE_ORANGE)
    px(img, 16, 1, AMMO_GOLD)
    # Fuel hose
    rect(img, 11, 14, 5, 2, (80, 60, 30, 220))
    save_sprite(img, 'struct_flamethrower_post')


# =========================================================
# HEAVY / COMBO TRAPS
# =========================================================

def make_tractor_wheel_roller():
    img = create_sprite()
    # Large tractor tire on a ramp, top-down
    # Ramp structure
    rect(img, 2, 24, 28, 6, WOOD_DARK)
    rect(img, 4, 25, 24, 4, WOOD_LIGHT)
    # Tractor tire (large circle from above)
    for y in range(32):
        for x in range(32):
            cx, cy = 16, 14
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            if 8 < dist < 12:
                img.putpixel((x, y), NIGHT_BLACK + (255,))
            elif 6 < dist <= 8:
                img.putpixel((x, y), DARK_GREY + (255,))
            elif dist <= 6:
                img.putpixel((x, y), RUST_BROWN + (255,))
    # Tread pattern
    for ty in range(32):
        for tx in range(32):
            cx, cy = 16, 14
            dist = ((tx-cx)**2 + (ty-cy)**2) ** 0.5
            if 9 <= dist <= 11:
                angle = int((tx + ty) * 3) % 6
                if angle < 2:
                    img.putpixel((tx, ty), CONCRETE + (255,))
    # Center hub
    px(img, 16, 14, STEEL)
    save_sprite(img, 'struct_tractor_wheel_roller')


def make_wrecking_ball():
    img = create_sprite()
    # Wrecking ball hanging from crane arm, top-down
    # Crane arm
    rect(img, 3, 3, 20, 4, DARK_STEEL)
    rect(img, 3, 3, 4, 16, DARK_STEEL)
    # Chain
    for cy in range(7, 16, 2):
        line_h(img, 14, cy, 4, CHAIN_GREY)
        if cy < 15:
            px(img, 15, cy + 1, DARK_GREY)
            px(img, 16, cy + 1, DARK_GREY)
    # Ball (large, heavy sphere -- shaded)
    for y in range(32):
        for x in range(32):
            cx, cy = 19, 22
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            if dist < 9:
                shade = int(80 + dist * 6)
                img.putpixel((x, y), (shade, shade, shade, 255))
            elif dist < 10:
                img.putpixel((x, y), DARK_GREY + (255,))
    # Ball highlight
    px(img, 16, 18, BANDAGE_WHT)
    px(img, 17, 18, (200, 200, 200, 200))
    save_sprite(img, 'struct_wrecking_ball')


def make_log_avalanche():
    img = create_sprite()
    # Stack of logs (cylindrical, top-down = circles in a row)
    # Support frame at back
    rect(img, 2, 2, 28, 4, WOOD_DARK)
    # Log circles stacked
    log_positions = [
        [(4, 8), (12, 8), (20, 8), (28, 8)],
        [(8, 14), (16, 14), (24, 14)],
        [(12, 20), (20, 20)],
    ]
    for row in log_positions:
        for lx, ly in row:
            for y in range(32):
                for x in range(32):
                    dist = ((x - lx)**2 + (y - ly)**2) ** 0.5
                    if dist < 4:
                        img.putpixel((x, y), RUST_BROWN + (255,))
                    elif dist < 5:
                        img.putpixel((x, y), WOOD_DARK + (255,))
            # Tree ring detail
            for y in range(ly - 2, ly + 3):
                for x in range(lx - 2, lx + 3):
                    dist = ((x - lx)**2 + (y - ly)**2) ** 0.5
                    if 1.5 < dist < 2.5:
                        px(img, x, y, WOOD_LIGHT)
    save_sprite(img, 'struct_log_avalanche')


def make_falling_car():
    img = create_sprite()
    # Car suspended on ropes above, about to drop
    # Rope/chain connections at corners
    for rx, ry in [(4, 2), (27, 2), (4, 28), (27, 28)]:
        rect(img, rx, ry, 2, 4, DIRT_BROWN)
    # Car body (top-down, compressed)
    rect(img, 5, 6, 22, 18, RUST_BROWN)
    rect(img, 6, 7, 20, 16, DARK_GREY)
    # Windscreen
    rect(img, 8, 8, 7, 6, (55, 60, 65, 200))
    rect(img, 17, 8, 7, 6, (55, 60, 65, 200))
    # Danger marking
    line_h(img, 7, 19, 18, AMMO_GOLD)
    line_h(img, 7, 20, 18, BLOOD_RED)
    # Shadow below car (indicates it will drop)
    rect(img, 5, 25, 22, 3, (0, 0, 0, 80))
    save_sprite(img, 'struct_falling_car')


def make_treadmill_blades():
    img = create_sprite()
    # Treadmill with blade strips
    # Belt
    rect(img, 4, 10, 24, 12, DARK_GREY)
    # Belt texture (chevron pattern)
    for bx in range(5, 27, 4):
        for by in range(10, 22, 2):
            px(img, bx, by, DARK_STEEL)
            px(img, bx + 1, by + 1, DARK_STEEL)
    # Rollers
    rect(img, 3, 9, 3, 14, STEEL)
    rect(img, 26, 9, 3, 14, STEEL)
    # Blade rows
    for bx in range(7, 26, 5):
        rect(img, bx, 8, 3, 16, STEEL)
        px(img, bx, 7, BANDAGE_WHT)
        px(img, bx + 1, 7, BANDAGE_WHT)
        px(img, bx + 2, 7, BANDAGE_WHT)
        px(img, bx, 24, BANDAGE_WHT)
        px(img, bx + 1, 24, BANDAGE_WHT)
        px(img, bx + 2, 24, BANDAGE_WHT)
    # Blood trace
    px(img, 12, 9, BLOOD_RED)
    px(img, 20, 23, BLOOD_RED)
    save_sprite(img, 'struct_treadmill_blades')


def make_fan_glass():
    img = create_sprite()
    # Fan blade assembly + broken glass shards around it
    # Fan housing ring
    for y in range(32):
        for x in range(32):
            cx, cy = 16, 16
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            if 10 < dist < 13:
                img.putpixel((x, y), DARK_STEEL + (255,))
    # Fan blades (3 blades offset)
    blade_angles = [(0, 0, 10, 4), (6, 10, 4, 10), (14, 6, 10, 4)]
    for bx, by, bw, bh in blade_angles:
        rect(img, bx, by, bw, bh, STEEL)
    # Center hub
    rect(img, 13, 13, 6, 6, DARK_STEEL)
    px(img, 16, 16, AMMO_GOLD)
    # Glass shards scattered around
    shard_pts = [(3, 8), (8, 3), (24, 4), (28, 9), (27, 22), (22, 28), (5, 26), (3, 20)]
    for sx, sy in shard_pts:
        px(img, sx, sy, GLASS_BLUE)
        px(img, sx + 1, sy, (160, 190, 220, 180))
    save_sprite(img, 'struct_fan_glass')


def make_elevator_shaft():
    img = create_sprite()
    # Hatch/opening in floor with dark pit below
    # Floor surround
    rect(img, 1, 1, 30, 30, CONCRETE)
    rect(img, 2, 2, 28, 28, DARK_GREY)
    # Hatch opening (dark pit)
    rect(img, 5, 5, 22, 22, NIGHT_BLACK)
    # Hatch door (half open, hanging)
    rect(img, 5, 5, 22, 10, DARK_STEEL)
    rect(img, 5, 5, 22, 1, STEEL)
    # Hinge details
    for hx in [6, 15, 24]:
        rect(img, hx, 5, 2, 3, AMMO_GOLD)
    # Warning markings around edge
    for wx in range(4, 27, 4):
        px(img, wx, 4, AMMO_GOLD)
        px(img, wx, 27, AMMO_GOLD)
    for wy in range(4, 27, 4):
        px(img, 4, wy, AMMO_GOLD)
        px(img, 27, wy, AMMO_GOLD)
    # Darkness in pit
    for y in range(15, 27):
        for x in range(5, 27):
            px(img, x, y, (0, 0, 0, 255))
    save_sprite(img, 'struct_elevator_shaft')


def make_rube_goldberg():
    img = create_sprite()
    # Complex contraption with gears, levers, tubes
    # Background plate
    rect(img, 1, 1, 30, 30, DARK_GREY)
    rect(img, 2, 2, 28, 28, NIGHT_BLACK)
    # Gear 1 (top-left)
    for y in range(32):
        for x in range(32):
            cx, cy = 8, 8
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            if 3 < dist < 6:
                img.putpixel((x, y), STEEL + (255,))
            elif dist <= 3:
                img.putpixel((x, y), DARK_STEEL + (255,))
    # Gear teeth (top-left gear)
    for tx, ty in [(8, 2), (14, 4), (2, 4), (3, 12), (13, 12), (8, 14)]:
        px(img, tx, ty, STEEL)
    # Gear 2 (right side)
    for y in range(32):
        for x in range(32):
            cx, cy = 22, 10
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            if 3 < dist < 5:
                img.putpixel((x, y), (140, 130, 90, 255))
            elif dist <= 3:
                img.putpixel((x, y), (100, 90, 60, 255))
    # Lever/rod
    line_h(img, 4, 16, 24, RUST_BROWN)
    rect(img, 13, 14, 4, 5, DARK_STEEL)
    # Pipe sections at bottom
    rect(img, 4, 22, 10, 3, RUST_BROWN)
    rect(img, 18, 22, 10, 3, RUST_BROWN)
    # Fire/explosion output hint
    px(img, 25, 24, FIRE_ORANGE)
    px(img, 26, 23, AMMO_GOLD)
    px(img, 27, 24, FIRE_ORANGE)
    # Alarm bell
    for y in range(32):
        for x in range(32):
            cx, cy = 8, 24
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            if 2 < dist < 4:
                img.putpixel((x, y), AMMO_GOLD + (255,))
    px(img, 8, 28, DARK_STEEL)
    save_sprite(img, 'struct_rube_goldberg')


# =========================================================
# RUN ALL
# =========================================================

if __name__ == '__main__':
    import os
    os.makedirs(SPRITES_DIR, exist_ok=True)
    print('Generating structure sprites...')

    # Primitive
    make_cart_wall()
    make_nail_board()
    make_trip_wire()
    make_glass_shards()
    make_tar_pit()
    make_glue_floor()
    make_shopping_cart_wall()
    make_car_wreck_barrier()
    make_dumpster_fortress()

    # Machine
    make_blade_spinner()
    make_fire_pit()
    make_propane_geyser()
    make_washing_cannon()
    make_shock_wire()
    make_spring_launcher()
    make_chain_wall()
    make_circle_saw_trap()
    make_razor_wire_carousel()
    make_lawnmower_lane()
    make_treadmill_of_doom()
    make_pendulum_axe()
    make_garage_door_smasher()
    make_bug_zapper_xl()
    make_car_battery_grid()
    make_electric_fence()
    make_net_launcher()
    make_meat_grinder()
    make_belt_sander_gauntlet()
    make_power_drill_press()
    make_piano_wire_web()
    make_combine_harvester()
    make_car_bomb()
    make_napalm_sprinkler()
    make_gas_main_igniter()
    make_flamethrower_post()

    # Heavy / Combo
    make_tractor_wheel_roller()
    make_wrecking_ball()
    make_log_avalanche()
    make_falling_car()
    make_treadmill_blades()
    make_fan_glass()
    make_elevator_shaft()
    make_rube_goldberg()

    print('Done. All structure sprites saved.')
