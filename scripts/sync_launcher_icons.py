#!/usr/bin/env python3
"""Sync launcher icons from assets/ folders into Android mipmap resources.

Source of truth (per project convention):
  assets/mipmap-{density}/ic_launcher.png        -> legacy launcher icon
  assets/mipmap-{density}/ic_launcher_round.png  -> round launcher icon
  assets/adaptive/ic_launcher_foreground.png     -> adaptive foreground (108dp box)
  assets/adaptive/ic_launcher_background.png     -> adaptive background

Targets (WebP, overwritten in place):
  android/app/src/main/res/mipmap-{density}/ic_launcher.webp
  android/app/src/main/res/mipmap-{density}/ic_launcher_round.webp
  android/app/src/main/res/mipmap-{density}/ic_launcher_foreground.webp
  android/app/src/main/res/mipmap-{density}/ic_launcher_background.webp

Density buckets (px):
  launcher : mdpi=48  hdpi=72  xhdpi=96   xxhdpi=144  xxxhdpi=192
  adaptive : mdpi=108 hdpi=162 xhdpi=216 xxhdpi=324  xxxhdpi=432
"""

import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']
LAUNCHER_PX = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
ADAPTIVE_PX = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}


def to_webp(src: Image.Image, size: int, dst: str) -> None:
    img = src.convert('RGBA') if src.mode != 'RGBA' else src
    if img.size != (size, size):
        img = img.resize((size, size), Image.LANCZOS)
    img.save(dst, 'WEBP', quality=92, method=6)
    print(f'  {os.path.relpath(dst, ROOT)}  {size}x{size}')


def main() -> int:
    ok = True
    for d in DENSITIES:
        out_dir = os.path.join(RES, f'mipmap-{d}')
        os.makedirs(out_dir, exist_ok=True)

        # Legacy + round launcher icons come from the matching density folder.
        for name in ('ic_launcher', 'ic_launcher_round'):
            src_path = os.path.join(ASSETS, f'mipmap-{d}', f'{name}.png')
            if not os.path.exists(src_path):
                print(f'MISSING source: {src_path}')
                ok = False
                continue
            with Image.open(src_path) as im:
                to_webp(im, LAUNCHER_PX[d], os.path.join(out_dir, f'{name}.webp'))

        # Adaptive layers are single master PNGs scaled per density.
        for name, master in (
            ('ic_launcher_foreground', os.path.join(ASSETS, 'adaptive', 'ic_launcher_foreground.png')),
            ('ic_launcher_background', os.path.join(ASSETS, 'adaptive', 'ic_launcher_background.png')),
        ):
            if not os.path.exists(master):
                print(f'MISSING source: {master}')
                ok = False
                continue
            with Image.open(master) as im:
                to_webp(im, ADAPTIVE_PX[d], os.path.join(out_dir, f'{name}.webp'))

    print('DONE' if ok else 'COMPLETED WITH MISSING SOURCES')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
