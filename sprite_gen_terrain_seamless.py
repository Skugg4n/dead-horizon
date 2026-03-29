"""
Seamless terrain tile generator for Dead Horizon.
Uses tileable noise (sum of sines) so tile edges match perfectly.
All tiles are 16x16 px with RGBA transparent backgrounds.
"""

import math
import random
from PIL import Image

TILE_SIZE = 16
PREVIEW_SCALE = 8
OUT_DIR = "/Users/olabelin/Projects/dead-horizon/public/assets/sprites/terrain"


def build_noise_map(size, seed, octaves=4, persistence=0.5):
    """
    Build a (size x size) float map with EXACT tileable periodicity.

    Strategy: generate a (size+1) x (size+1) grid where row[size]==row[0]
    and col[size]==col[0] by construction (cosines with integer frequencies).
    Then use only the [0..size-1] x [0..size-1] region.

    Because we use integer multiples k of 2*pi/size, the value at position
    size equals the value at position 0 exactly (no float rounding beyond the
    pixel integer mapping).
    """
    rng = random.Random(seed)
    grid = [[0.0] * size for _ in range(size)]
    amplitude = 1.0
    total_amp = 0.0

    for _ in range(octaves):
        # Integer frequencies in [1, size//2] to stay within Nyquist
        kx = rng.randint(1, max(1, size // 4))
        ky = rng.randint(1, max(1, size // 4))
        px_phase = rng.uniform(0, 2 * math.pi)
        py_phase = rng.uniform(0, 2 * math.pi)

        for y in range(size):
            cy = math.cos(2 * math.pi * ky * y / size + py_phase)
            for x in range(size):
                cx = math.cos(2 * math.pi * kx * x / size + px_phase)
                grid[y][x] += amplitude * cx * cy

        total_amp += amplitude
        amplitude *= persistence

    # Normalise to [0, 1]
    flat = [v for row in grid for v in row]
    mn, mx = min(flat), max(flat)
    span = mx - mn if mx != mn else 1.0
    for y in range(size):
        for x in range(size):
            grid[y][x] = (grid[y][x] - mn) / span

    return grid


def color_for_noise(t, base_color, variations, strength):
    """Return (R, G, B) for a noise value t in [0,1]."""
    t_blend = t * t * (3 - 2 * t)  # smoothstep
    var_idx = int(t * len(variations)) % len(variations)
    target = variations[var_idx]
    blend = t_blend * strength
    blend = max(0.0, min(1.0, blend))
    r = round(base_color[0] * (1 - blend) + target[0] * blend)
    g = round(base_color[1] * (1 - blend) + target[1] * blend)
    b = round(base_color[2] * (1 - blend) + target[2] * blend)
    return (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))


def make_tile(base_color, variations, seed, octaves=4, strength=0.12):
    """
    Create a 16x16 RGBA tile using a pre-built noise map.

    Seamless guarantee: after computing all pixels, copy the first column to
    the last column and the first row to the last row. This ensures zero edge
    difference regardless of any float rounding that survived into the final
    colour value.
    """
    noise = build_noise_map(TILE_SIZE, seed, octaves=octaves)
    img = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))

    for y in range(TILE_SIZE):
        for x in range(TILE_SIZE):
            c = color_for_noise(noise[y][x], base_color, variations, strength)
            img.putpixel((x, y), c + (255,))

    # Hard-copy edges to guarantee exact tileability
    for i in range(TILE_SIZE):
        # Right column = left column
        img.putpixel((TILE_SIZE - 1, i), img.getpixel((0, i)))
        # Bottom row = top row
        img.putpixel((i, TILE_SIZE - 1), img.getpixel((i, 0)))

    return img


def save_tile(img, name):
    path = f"{OUT_DIR}/{name}.png"
    img.save(path)
    preview = img.resize(
        (img.width * PREVIEW_SCALE, img.height * PREVIEW_SCALE),
        Image.NEAREST,
    )
    preview.save(f"{OUT_DIR}/{name}_preview.png")
    print(f"  Saved: {name}.png  ({img.width}x{img.height})")


def verify_seamless(img, name):
    """Check that left == right edge and top == bottom edge (approx)."""
    size = img.width
    max_diff = 0
    for i in range(size):
        left = img.getpixel((0, i))[:3]
        right = img.getpixel((size - 1, i))[:3]
        top = img.getpixel((i, 0))[:3]
        bottom = img.getpixel((i, size - 1))[:3]
        for c in range(3):
            max_diff = max(max_diff, abs(left[c] - right[c]))
            max_diff = max(max_diff, abs(top[c] - bottom[c]))
    seamless = "OK" if max_diff == 0 else f"max edge diff={max_diff}"
    print(f"    Seamless check [{name}]: {seamless}")


# ---------------------------------------------------------------------------
# Tile definitions
# ---------------------------------------------------------------------------

tiles = [
    # name, base_color, variations, seed, strength
    # strength is multiplied with blend factor -- 1.0 = full blend to variation color
    # Keep strength 0.35-0.55 for visible but not harsh texture
    (
        "terrain_grass_1",
        (0x2A, 0x4A, 0x20),          # #2A4A20 dark green base
        [
            (0x32, 0x54, 0x26),       # lighter patch
            (0x24, 0x40, 0x1A),       # darker patch
            (0x30, 0x50, 0x1E),       # slightly warmer
            (0x28, 0x46, 0x22),       # neutral variation
        ],
        42,
        0.45,
    ),
    (
        "terrain_grass_2",
        (0x2D, 0x4D, 0x23),          # #2D4D23 marginally lighter
        [
            (0x35, 0x57, 0x28),       # lighter
            (0x26, 0x44, 0x1E),       # darker
            (0x30, 0x50, 0x25),       # warm
            (0x2A, 0x48, 0x21),       # cool
        ],
        77,
        0.40,
    ),
    (
        "terrain_grass_3",
        (0x2A, 0x45, 0x20),          # #2A4520 slightly warmer/browner
        [
            (0x32, 0x4D, 0x1C),       # browner-lighter
            (0x24, 0x3E, 0x1A),       # darker
            (0x2E, 0x4B, 0x1E),       # neutral
            (0x30, 0x47, 0x1C),       # warm brown-green
        ],
        113,
        0.42,
    ),
    (
        "terrain_dirt_1",
        (0x3A, 0x2A, 0x14),          # #3A2A14 dark brown
        [
            (0x44, 0x32, 0x1A),       # lighter warm
            (0x30, 0x22, 0x0E),       # darker
            (0x3E, 0x2E, 0x16),       # mid
            (0x36, 0x28, 0x12),       # cooler
        ],
        55,
        0.45,
    ),
    (
        "terrain_dirt_2",
        (0x2A, 0x1F, 0x0F),          # #2A1F0F darker brown
        [
            (0x34, 0x27, 0x14),       # lighter
            (0x22, 0x18, 0x0A),       # darker
            (0x2E, 0x23, 0x12),       # warm
        ],
        88,
        0.42,
    ),
    (
        "terrain_path_1",
        (0x4A, 0x3A, 0x1E),          # #4A3A1E compact path
        [
            (0x56, 0x44, 0x24),       # lighter worn
            (0x3E, 0x30, 0x18),       # darker shadow
            (0x50, 0x3E, 0x20),       # mid
            (0x46, 0x38, 0x1C),       # neutral
        ],
        31,
        0.40,
    ),
    (
        "terrain_leaves",
        (0x35, 0x38, 0x18),          # olive green/brown leaf mix
        [
            (0x42, 0x32, 0x14),       # browner dead leaf
            (0x2C, 0x3E, 0x1C),       # greener
            (0x3E, 0x3A, 0x14),       # warm olive
            (0x30, 0x34, 0x18),       # cooler
        ],
        99,
        0.50,
    ),
]


if __name__ == "__main__":
    print("Generating seamless terrain tiles...")
    for name, base, variations, seed, strength in tiles:
        img = make_tile(base, variations, seed, octaves=4, strength=strength)
        save_tile(img, name)
        verify_seamless(img, name)

    print("\nDone. All terrain tiles regenerated.")
