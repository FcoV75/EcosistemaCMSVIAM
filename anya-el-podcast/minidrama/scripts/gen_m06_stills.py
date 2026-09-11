#!/usr/bin/env python3
"""Stills de M06 vía Flux Kontext. Keys en /tmp/anya_secrets.env."""

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

    if dest.exists() and dest.stat().st_size > 80_000:
        print("skip", dest.name)
        return
    if not src.exists():
        raise SystemExit(f"Falta referencia: {src}")
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
            ASSETS / "anya-lab-9x16.png",
            ASSETS / "m06-anya-habla.png",
            "Same young woman, same face, same chestnut shoulder-length bob, same pale blue eyes, "
            "same slate-blue short-sleeve laboratory dress with V-neck. Medium close-up of her face "
            "and shoulders. No electrodes, no wires, no sensors on skin or hair. Neutral naive expression, "
            "late-night teal laboratory. Photoreal vertical 9:16. Keep identity exactly. "
            "No text, no letters, no captions, no watermark.",
        ),
        (
            ASSETS / "anya-lab-9x16.png",
            ASSETS / "m06-anya-silla.png",
            "Same young woman, same face and slate-blue pleated laboratory dress. Medium shot, face clearly visible. "
            "She sits in the white medical chair; no electrode cables attached to her. Her right hand rests "
            "awkwardly on her own chest as if checking for a sound that should not be there. Late-night teal lab. "
            "Photoreal vertical 9:16. Keep identity. No electrodes, no text, no watermark.",
        ),
        (
            ASSETS / "anya-lab-9x16.png",
            ASSETS / "m06-anya-monitor.png",
            "Same young woman, same face, chestnut bob, slate-blue dress, NO electrodes. Close-up of her face "
            "lit from the side by an ugly cyan-green computer monitor glow. She looks at a screen off-camera, "
            "childlike and worried, not smiling. Late-night laboratory. Photoreal vertical 9:16. Keep identity. "
            "No text, no letters, no captions, no watermark.",
        ),
        (
            ASSETS / "m02-anya-alice.png",
            ASSETS / "m06-anya-alice.png",
            "Same young woman looking up at the circular ceiling speaker. REMOVE the white electrode disc and wire "
            "from her face and neck completely; bare skin, no sensors. Same chestnut hair, same slate-blue dress, "
            "same pale blue eyes. Late-night lab. Photoreal vertical 9:16. Keep identity. "
            "No electrodes, no text, no watermark.",
        ),
        (
            ASSETS / "refs/set-servidores.png",
            ASSETS / "m06-servidores.png",
            "Same empty server room reframed vertical, late night, lights dimmed to cool teal. No people. "
            "Remove any watermark, logo, or brand name. The wall screen shows only abstract glowing network nodes "
            "and a simple rising curve made of light. NO readable letters, NO numbers, NO words. "
            "Photoreal vertical 9:16.",
        ),
        (
            ASSETS / "m02-anya-electrodo.png",
            ASSETS / "m06-monitor-glow.png",
            "Empty laboratory workstation at night. A single computer monitor fills most of the frame with an ugly "
            "cyan glow and an abstract downward chart of glowing lines only. No people, no faces. "
            "NO readable text, NO letters, NO numbers, NO watermark. Photoreal vertical 9:16.",
        ),
    ]
    for src, dest, prompt in jobs:
        kontext(src, dest, prompt)


if __name__ == "__main__":
    main()
