#!/usr/bin/env python3
"""Stills extra de M04 vía Flux Kontext. Keys en /tmp/anya_secrets.env."""

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
    base = ASSETS / "m03-anya-sienta.png"
    jobs = [
        (
            "m04-anya-mira.png",
            "Reframe as a vertical 9:16 medium close-up of ONLY the young woman on the left. "
            "Same face, same shoulder-length chestnut hair, same dusty blue pleated dress, same pale blue eyes. "
            "She looks slightly to the right toward someone off-camera, earnest naive expression, not smiling. "
            "Night cafe, bokeh lights, photoreal cinematic. Do not change her identity.",
        ),
        (
            "m04-pastel.png",
            "Keep the same two people, same faces, same clothes, same night cafe. "
            "A waiter or the man is placing a small white plate with a slice of New York cheesecake "
            "on the wooden table next to the two white mugs. Photoreal, vertical 9:16. Do not change faces.",
        ),
        (
            "m04-cerca.png",
            "Same two people at the night cafe table, same faces and clothes. "
            "He has sat slightly closer. A cheesecake plate sits between the mugs. "
            "The young woman glances briefly toward his chest, clinical not romantic, serious face. "
            "He looks down, shy. Photoreal vertical 9:16. Keep identities.",
        ),
        (
            "m04-mano-plato.png",
            "Close-up vertical 9:16 of a man's hand in a dark knit sweater sleeve setting a white plate "
            "with cheesecake onto a dark wooden cafe table beside two white mugs. Night cafe bokeh. "
            "Photoreal cinematic. No faces needed. Same table as the reference.",
        ),
    ]
    for name, prompt in jobs:
        kontext(base, ASSETS / name, prompt)


if __name__ == "__main__":
    main()
