#!/usr/bin/env python3
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SITE_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = SITE_ROOT / "public" / "assets" / "images" / "titles"

CHUNKY_PIXEL_SCALE = 2
TAGLINE_ON_SCREEN_SIZE = 120
SECTION_TITLE_ON_SCREEN_SIZE = 96
BASELINE_REFERENCE_TEXT = "Hpy"

TAGLINES = ["The Community Top-Down Shooter"]

SECTION_TITLES = [
    "Weapons",
    "Leaderboards",
    "Ranked matches",
    "Arenas",
    "Server list",
    "Privacy",
    "Profile",
    "Player",
    "Not Found",
    "Credits",
]


def slug_same_as_section_title_logo_ejs(text):
    return "".join(character if character.isalnum() else "_" for character in text.lower())


def render_chunky_rgba(logo_text, text, on_screen_size):
    glyph_size = round(on_screen_size / CHUNKY_PIXEL_SCALE)
    return logo_text.compose_logo_style(logo_text.render_fill_mask(text, glyph_size), glyph_size)


def ink_rows(rgba):
    return np.nonzero(rgba[..., 3].any(axis=1))[0]


def ink_columns(rgba):
    return np.nonzero(rgba[..., 3].any(axis=0))[0]


def save_scaled_up(rgba, rows, columns, name):
    cropped = Image.fromarray(rgba[rows.min():rows.max() + 1, columns.min():columns.max() + 1], "RGBA")
    scaled = cropped.resize((cropped.width * CHUNKY_PIXEL_SCALE, cropped.height * CHUNKY_PIXEL_SCALE), Image.NEAREST)
    output = OUTPUT_DIR / f"{name}.png"
    scaled.save(output, optimize=True)
    print(f"{output.relative_to(SITE_ROOT)}: {scaled.width}x{scaled.height}")


def main():
    sys.path.insert(0, str(Path(sys.argv[1]).resolve()))
    import logo_text

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for text in TAGLINES:
        rgba = render_chunky_rgba(logo_text, text, TAGLINE_ON_SCREEN_SIZE)
        save_scaled_up(rgba, ink_rows(rgba), ink_columns(rgba), slug_same_as_section_title_logo_ejs(text))

    section_rgbas = {text: render_chunky_rgba(logo_text, text, SECTION_TITLE_ON_SCREEN_SIZE) for text in SECTION_TITLES}
    reference_rows = ink_rows(render_chunky_rgba(logo_text, BASELINE_REFERENCE_TEXT, SECTION_TITLE_ON_SCREEN_SIZE))
    shared_rows = np.concatenate([reference_rows] + [ink_rows(rgba) for rgba in section_rgbas.values()])

    for text, rgba in section_rgbas.items():
        save_scaled_up(rgba, shared_rows, ink_columns(rgba), slug_same_as_section_title_logo_ejs(text))


if __name__ == "__main__":
    main()
