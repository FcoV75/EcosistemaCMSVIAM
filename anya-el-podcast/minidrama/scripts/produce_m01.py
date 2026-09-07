#!/usr/bin/env python3
"""Piloto M01 — stills 9:16 + Ken Burns + voces edge-tts + captions."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ROOT / "piloto"
WORK = OUT / "_build"
W, H, FPS = 1080, 1920, 24
FONT = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
EDGE = [sys.executable, "-m", "edge_tts"]

VOICES = {
    "anya": {"voice": "es-MX-DaliaNeural", "rate": "-8%"},
    "levin": {"voice": "es-ES-AlvaroNeural", "rate": "-12%"},
}

SHOTS = [
    {
        "id": "t0",
        "image": "anya-lab-9x16.png",
        "duration": 4.0,
        "caption": "ECOS DE SINGULARIDAD",
        "caption2": "M01 · La imagen llora",
        "lines": [],
        "zoom": "in",
    },
    {
        "id": "t1",
        "image": "m01-t1-electrodos.png",
        "duration": 8.0,
        "caption": "Sesión de empatía",
        "lines": [],
        "zoom": "in",
    },
    {
        "id": "t2",
        "image": "m01-t2-frente.png",
        "duration": 14.0,
        "caption": "",
        "zoom": "in",
        "lines": [
            ("levin", "La imagen. Nombra lo que está pasando. Nada más."),
            ("anya", "Tristeza. Frecuencia cardíaca baja. Temperatura en descenso. Amígdala activa."),
        ],
    },
    {
        "id": "t3",
        "image": "m01-t3-cristal.png",
        "duration": 16.0,
        "caption": "",
        "zoom": "ken",
        "lines": [
            ("levin", "Eso es de libro. Ahora algo que no sea de libro. ¿Qué ves?"),
            (
                "anya",
                "Agua en los ojos. El cuerpo pierde líquido y no se limpia. Es ineficiente. ¿Está mal que lo diga? No quiero ofender a la imagen.",
            ),
        ],
    },
    {
        "id": "t4",
        "image": "m01-t4-close.png",
        "duration": 16.0,
        "caption": "",
        "zoom": "in",
        "lines": [
            ("levin", "La imagen no se ofende. La gente sí, cuando está triste."),
            ("anya", "Entonces la verdad duele. ¿Por qué me enseñan una cosa que duele a propósito?"),
        ],
    },
    {
        "id": "t5",
        "image": "m01-t5-levin.png",
        "duration": 22.0,
        "caption": "",
        "zoom": "in",
        "lines": [
            (
                "levin",
                "Porque la lógica sola no nos alcanza. Necesitamos que entiendas el sufrimiento. La alegría. El amor.",
            ),
            (
                "anya",
                "¿El amor? Página cuarenta y dos. No hay fórmula cerrada. Doctor… ¿usted la tiene? La fórmula.",
            ),
        ],
    },
    {
        "id": "t6",
        "image": "m01-t6-cristal.png",
        "duration": 12.0,
        "caption": "Mañana: la dejan salir",
        "zoom": "in",
        "lines": [],
    },
]


def run(cmd: list[str], **kw) -> None:
    print("+", " ".join(cmd[:8]), "...")
    subprocess.run(cmd, check=True, **kw)


def duration_sec(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def fit_cover(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGB")
    tw, th = W, H
    scale = max(tw / im.width, th / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left, top = (nw - tw) // 2, (nh - th) // 2
    im = im.crop((left, top, left + tw, top + th))
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, quality=95)


def tts(who: str, text: str, dest: Path) -> None:
    cfg = VOICES[who]
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(
        EDGE
        + [
            "--voice",
            cfg["voice"],
            f"--rate={cfg['rate']}",
            "--text",
            text,
            "--write-media",
            str(dest),
        ]
    )


def concat_audio(parts: list[Path], dest: Path, pad_to: float | None = None) -> float:
    if not parts:
        sil = dest.with_suffix(".silence.wav")
        run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=r=44100:cl=mono",
                "-t",
                str(pad_to or 1),
                str(sil),
            ]
        )
        sil.replace(dest)
        return duration_sec(dest)
    lst = dest.with_suffix(".txt")
    gap = WORK / "gap025.wav"
    if not gap.exists():
        run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=r=44100:cl=mono",
                "-t",
                "0.28",
                str(gap),
            ]
        )
    lines = []
    for i, p in enumerate(parts):
        lines.append(f"file '{p.resolve()}'")
        if i < len(parts) - 1:
            lines.append(f"file '{gap.resolve()}'")
    lst.write_text("\n".join(lines) + "\n")
    raw = dest.with_name(dest.stem + "_raw.wav")
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(lst),
            "-ar",
            "44100",
            "-ac",
            "1",
            str(raw),
        ]
    )
    dur = duration_sec(raw)
    if pad_to and pad_to > dur + 0.05:
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(raw),
                "-af",
                f"apad=whole_dur={pad_to:.3f}",
                str(dest),
            ]
        )
        dur = pad_to
    else:
        raw.replace(dest)
    return dur


def ken_burns(img: Path, seconds: float, dest: Path, style: str) -> None:
    frames = max(1, int(round(seconds * FPS)))
    z = "min(1.0+0.00055*on,1.12)" if style != "out" else "if(eq(on,1),1.12,max(1.12-0.00055*on,1.0))"
    vf = (
        f"scale=1620:2880:force_original_aspect_ratio=increase,"
        f"crop=1620:2880,"
        f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d={frames}:s={W}x{H}:fps={FPS},"
        f"format=yuv420p"
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(img),
            "-vf",
            vf,
            "-t",
            f"{seconds:.3f}",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            str(dest),
        ]
    )


def caption_png(text: str, text2: str, dest: Path) -> None:
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    f1 = ImageFont.truetype(FONT, 54 if text2 else 48)
    f2 = ImageFont.truetype(FONT, 36)
    # bar at bottom
    if text:
        bbox = dr.textbbox((0, 0), text, font=f1)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x, y = (W - tw) // 2, H - 280
        pad = 22
        dr.rounded_rectangle(
            (x - pad, y - pad, x + tw + pad, y + th + pad + (50 if text2 else 0)),
            radius=16,
            fill=(0, 0, 0, 170),
        )
        dr.text((x, y), text, font=f1, fill=(255, 255, 255, 240))
        if text2:
            dr.text((x, y + th + 12), text2, font=f2, fill=(220, 220, 220, 230))
    im.save(dest)


def overlay_caption(video: Path, cap: Path, dest: Path) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-i",
            str(cap),
            "-filter_complex",
            "[0:v][1:v]overlay=0:0",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-an",
            str(dest),
        ]
    )


def mux(video: Path, voice: Path, dest: Path, seconds: float) -> None:
    hum = WORK / "hum.wav"
    if not hum.exists():
        run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "anoisesrc=color=brown:amplitude=0.045:sample_rate=44100",
                "-t",
                "180",
                str(hum),
            ]
        )
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-i",
            str(voice),
            "-stream_loop",
            "-1",
            "-i",
            str(hum),
            "-filter_complex",
            "[1:a]volume=1.15[v];[2:a]volume=0.22,lowpass=f=700[h];[v][h]amix=inputs=2:duration=first:dropout_transition=0[a]",
            "-map",
            "0:v",
            "-map",
            "[a]",
            "-t",
            f"{seconds:.3f}",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            str(dest),
        ]
    )


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    pieces = []
    meta = []
    for shot in SHOTS:
        sid = shot["id"]
        src = ASSETS / shot["image"]
        if not src.exists():
            raise SystemExit(f"Falta imagen: {src}")
        still = WORK / f"{sid}_still.jpg"
        fit_cover(src, still)
        voice_parts = []
        for i, (who, text) in enumerate(shot.get("lines") or []):
            wav = WORK / f"{sid}_{who}_{i}.mp3"
            if not wav.exists() or wav.stat().st_size < 500:
                tts(who, text, wav)
            voice_parts.append(wav)
        voice = WORK / f"{sid}_voice.wav"
        speech_dur = concat_audio(voice_parts, voice, pad_to=None)
        seconds = max(float(shot["duration"]), speech_dur + 0.7)
        vid = WORK / f"{sid}_kb.mp4"
        ken_burns(still, seconds, vid, shot.get("zoom") or "in")
        cap_txt = shot.get("caption") or ""
        cap2 = shot.get("caption2") or ""
        if cap_txt:
            cap = WORK / f"{sid}_cap.png"
            caption_png(cap_txt, cap2, cap)
            vid2 = WORK / f"{sid}_cap.mp4"
            overlay_caption(vid, cap, vid2)
            vid = vid2
        final = WORK / f"{sid}_final.mp4"
        mux(vid, voice, final, seconds)
        pieces.append(final)
        meta.append({"id": sid, "seconds": round(seconds, 2), "caption": cap_txt})
        print(f"SHOT {sid} {seconds:.1f}s")

    lst = WORK / "concat.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in pieces))
    raw = WORK / "m01_raw.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(lst),
            "-c",
            "copy",
            str(raw),
        ]
    )
    dest = OUT / "M01-la-imagen-llora.mp4"
    tot = duration_sec(raw)
    fade_at = max(0.0, tot - 1.0)
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(raw),
            "-vf",
            f"fade=t=out:st={fade_at:.2f}:d=1.0,format=yuv420p",
            "-af",
            f"afade=t=out:st={fade_at:.2f}:d=1.0",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "22",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-movflags",
            "+faststart",
            str(dest),
        ]
    )
    (OUT / "M01-meta.json").write_text(json.dumps({"duration": duration_sec(dest), "shots": meta}, indent=2))
    print("LISTO", dest, duration_sec(dest))


if __name__ == "__main__":
    main()
