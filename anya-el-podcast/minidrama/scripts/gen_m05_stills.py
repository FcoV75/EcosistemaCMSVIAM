#!/usr/bin/env python3
"""Stills extra de M05 vía Flux Kontext. Keys en /tmp/anya_secrets.env."""

from __future__ import annotations

import os
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"


def load_secrets() -> None:
    p = Path("/tmp/anya_secrets.env")
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    if not os.environ.get("FAL_KEY"):
        raise SystemExit("Falta FAL_KEY")


def kontext(src: Path, dest: Path, prompt: str) -> None:
    import fal_client

    if dest.exists() and dest.stat().st_size > 20_000:
        print("skip", dest.name)
        return
    url = fal_client.upload_file(str(src))
    print("kontext", dest.name)
    result = fal_client.subscribe(
        "fal-ai/flux-pro/kontext",
        arguments={
            "prompt": prompt,
            "image_url": url,
            "aspect_ratio": "9:16",
            "output_format": "png",
            "safety_tolerance": "4",
        },
        with_logs=True,
    )
    images = result.get("images") if isinstance(result, dict) else None
    img_url = (images[0].get("url") if images else None) or (result.get("image") or {}).get("url")
    if not img_url:
        raise SystemExit(f"Sin imagen: {result!r}"[:400])
    dest.write_bytes(urllib.request.urlopen(img_url, timeout=120).read())
    print("saved", dest, dest.stat().st_size)


def main() -> None:
    load_secrets()
    jobs = [
        (
            ASSETS / "m04-cerca.png",
            ASSETS / "m05-tenedor.png",
            "Keep the same two people, same faces, same dusty blue pleated dress and dark knit sweater, "
            "same night cafe. The young woman holds a silver fork awkwardly above the cheesecake slice, "
            "uncertain, not eating yet. Photoreal vertical 9:16. Do not change identities.",
        ),
        (
            ASSETS / "m03-anya-taza.png",
            ASSETS / "m05-taza-vacia.png",
            "Same young woman, same face, chestnut bob, dusty blue pleated dress, night cafe. "
            "She sits alone now. The man is gone. She holds an empty white mug. Raindrops on the window. "
            "Quiet, clinical, a little lost. Photoreal vertical 9:16. Keep her identity.",
        ),
        (
            ASSETS / "m04-cerca.png",
            ASSETS / "m05-lluvia-ventana.png",
            "Same night cafe table, same two white mugs, but the window behind is now covered in fine rain streaks. "
            "The man is gone; only the young woman in the dusty blue dress remains, small in the frame, looking at the rain. "
            "Photoreal vertical 9:16. Keep her identity.",
        ),
        (
            ASSETS / "m01-t3-cristal.png",
            ASSETS / "m05-lab-lluvia.png",
            "Same laboratory glass partition, same cool teal lighting. Fine rain streaks on the glass in the foreground. "
            "The man in the lab coat is gone. Empty observation glass, night, melancholy. Photoreal vertical 9:16.",
        ),
        (
            ASSETS / "m04-anya-mira.png",
            ASSETS / "m05-anya-pecho.png",
            "Same young woman, same face and dusty blue dress. Medium close-up, she looks slightly down toward her own chest "
            "with a puzzled clinical expression, as if noticing a sound that should not be there. Night cafe bokeh. "
            "Photoreal vertical 9:16. Keep identity. No smile.",
        ),
    ]
    for src, dest, prompt in jobs:
        kontext(src, dest, prompt)


if __name__ == "__main__":
    main()
