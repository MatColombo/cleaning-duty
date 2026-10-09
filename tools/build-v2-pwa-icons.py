#!/usr/bin/env python3
"""Optional reproducible renderer for the committed Phase 14 launcher PNGs.

Prerequisites: python3 -m pip install cairosvg pillow
Run from repository root: python3 tools/build-v2-pwa-icons.py
No runtime PWA/build dependency on this script or CairoSVG.
"""
from pathlib import Path
import shutil
import xml.etree.ElementTree as ET
import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
BRAND = PUBLIC / 'brand' / 'v2'
BASE = BRAND / 'house-care-app-mark.svg'
MASKABLE = BRAND / 'house-care-maskable-mark.svg'


def render(svg: Path, output: Path, size: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(url=str(svg), write_to=str(output), output_width=size, output_height=size)
    with Image.open(output) as image:
        assert image.size == (size, size)
        assert image.getbbox() is not None


def main() -> None:
    assert BASE.exists()
    # A solid full-bleed base with the motif fully inside the maskable safe area.
    tree = ET.parse(BASE)
    root = tree.getroot()
    ns = '{http://www.w3.org/2000/svg}'
    shapes = [child for child in root if child.tag in (ns + 'path', ns + 'circle')]
    mask = ET.Element(ns + 'svg', {'viewBox': '0 0 512 512'})
    ET.SubElement(mask, ns + 'title').text = 'House Care maskable app mark'
    ET.SubElement(mask, ns + 'rect', {'width': '512', 'height': '512', 'fill': '#F4E8D0'})
    g = ET.SubElement(mask, ns + 'g', {'transform': 'translate(61.44 61.44) scale(.76)'})
    for shape in shapes:
        g.append(shape)
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    ET.ElementTree(mask).write(MASKABLE, encoding='unicode', xml_declaration=False)
    for size in (192, 512):
        render(BASE, BRAND / f'app-icon-{size}.png', size)
        render(MASKABLE, BRAND / f'app-icon-maskable-{size}.png', size)
        shutil.copyfile(BRAND / f'app-icon-{size}.png', PUBLIC / f'icon-{size}.png')
        shutil.copyfile(BRAND / f'app-icon-maskable-{size}.png', PUBLIC / f'icon-maskable-{size}.png')
    render(BASE, BRAND / 'apple-touch-icon.png', 180)
    render(BASE, BRAND / 'favicon-32.png', 32)
    shutil.copyfile(BRAND / 'apple-touch-icon.png', PUBLIC / 'apple-touch-icon.png')
    shutil.copyfile(BRAND / 'favicon-32.png', PUBLIC / 'favicon-32.png')
    shutil.copyfile(BASE, PUBLIC / 'icon.svg')
    print('Created V2 any/maskable 192/512, 180 touch, 32 favicon, and SVG launcher')

if __name__ == '__main__':
    main()
