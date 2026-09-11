#!/usr/bin/env python3
"""M03 con ElevenLabs + Kling Avatar (fal.ai). Las keys salen de /tmp/anya_secrets.env, nunca del repo."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ROOT / "piloto"
WORK = OUT / "_build" / "M03_kling"
W, H, FPS = 1080, 1920, 24
FONT = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
if not Path(FONT).exists():
    FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Voces de cuenta (plan gratis: no Voice Library).
VOICES = {
    "anya": "pFZP5JQG7iQjIQuC4Bku",  # Lily — clara, joven
    "barista": "iP95p4xoKVk53GoZ742B",  # Chris — casual
    "ethan": "TX3LPaxmHKxFdv7VOQHJ",  # Liam — más bajo, tímido
}

SETTINGS = {
    "anya": {"stability": 0.58, "similarity_boost": 0.78, "style": 0.12, "use_speaker_boost": True},
    "barista": {"stability": 0.38, "similarity_boost": 0.72, "style": 0.45, "use_speaker_boost": True},
    "ethan": {"stability": 0.50, "similarity_boost": 0.75, "style": 0.20, "use_speaker_boost": True},
}

SHOTS = [
    {
        "id": "t0",
        "image": "m02-espresso-cliff.png",
        "seconds": 4.0,
        "caption": "Campus · noche",
        "caption2": "M03 · ¿Americano?",
        "avatar": False,
    },
    {
        "id": "t1a",
        "image": "m03-anya-barra.png",
        "who": "anya",
        "text": "Un café, por favor.",
        "avatar": True,
        "prompt": "Young woman in a cafe at night speaking naturally in Spanish. Subtle blinks, small head movement, naive earnest face, no big smile, photorealistic, dusty blue dress, shoulder-length chestnut hair.",
    },
    {
        "id": "t1b",
        "image": "m03-barista.png",
        "who": "barista",
        "text": "¿Americano, latte... o espresso?",
        "avatar": True,
        "prompt": "Tired but friendly cafe barista speaking casually, natural blinks, small hand still on the espresso machine, photoreal, night cafe.",
    },
    {
        "id": "t1c",
        "image": "m03-anya-barra.png",
        "who": "anya",
        "text": "No sé. El que tomen cuando no saben cuál tomar.",
        "avatar": True,
        "prompt": "Same young woman speaking literally, slight confusion, natural blinks, still posture too straight, photoreal cafe.",
    },
    {
        "id": "t1d",
        "image": "m03-barista.png",
        "who": "barista",
        "text": "Americano. ¿Y el nombre?",
        "avatar": True,
        "prompt": "Barista nodding slightly, casual Spanish, natural blinks, photoreal.",
    },
    {
        "id": "t1e",
        "image": "m03-anya-barra.png",
        "who": "anya",
        "text": "Anya. Si es un continente, está bien. Si es una orden, también.",
        "avatar": True,
        "prompt": "Young woman stating her name then a literal aside, natural blinks, no comedy mugging, photoreal.",
    },
    {
        "id": "t2",
        "image": "m03-anya-taza.png",
        "who": "anya",
        "text": "Es amargo. En los datos, lo amargo avisa veneno. Ellos pagan por eso. No entiendo el pago.",
        "avatar": False,
    },
    {
        "id": "t3",
        "image": "m03-ethan-solo.png",
        "who": "anya",
        "text": "Hombros caídos. Ceja izquierda más baja. Tristeza. El protocolo: observar. No sentarse cerca.",
        "avatar": False,
    },
    {
        "id": "t4",
        "image": "m03-anya-sienta.png",
        "seconds": 6.2,
        "caption": "Protocolo: no",
        "avatar": False,
    },
    {
        "id": "t5",
        "image": "m03-ethan-hola.png",
        "who": "ethan",
        "text": "Hola.",
        "avatar": True,
        "prompt": "Tired young scientist in a dark sweater looking up, shy quiet hello, natural blink, photoreal cafe at night.",
    },
]


def load_secrets() -> None:
    p = Path("/tmp/anya_secrets.env")
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    if not os.environ.get("ELEVENLABS_API_KEY") or not os.environ.get("FAL_KEY"):
        raise SystemExit("Faltan ELEVENLABS_API_KEY o FAL_KEY en el entorno / /tmp/anya_secrets.env")


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd[:8]), "...")
    subprocess.run(cmd, check=True)


def duration_sec(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        text=True,
    ).strip()
    return float(out)


def eleven_tts(who: str, text: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 2000:
        return
    body = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": SETTINGS[who],
    }
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICES[who]}",
        data=json.dumps(body).encode(),
        headers={
            "xi-api-key": os.environ["ELEVENLABS_API_KEY"],
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        dest.write_bytes(r.read())
    print("tts", dest.name, dest.stat().st_size)


def fit_cover(src: Path, dest: Path) -> None:
    from PIL import Image

    im = Image.open(src).convert("RGB")
    scale = max(W / im.width, H / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left, top = (nw - W) // 2, (nh - H) // 2
    im.crop((left, top, left + W, top + H)).save(dest, quality=95)


def ken(img: Path, seconds: float, dest: Path) -> None:
    frames = max(1, int(round(seconds * FPS)))
    vf = (
        f"scale=1620:2880:force_original_aspect_ratio=increase,crop=1620:2880,"
        f"zoompan=z='min(1.0+0.00045*on,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d={frames}:s={W}x{H}:fps={FPS},format=yuv420p"
    )
    run(["ffmpeg", "-y", "-loop", "1", "-i", str(img), "-vf", vf, "-t", f"{seconds:.3f}", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", str(dest)])


def to_916(src: Path, dest: Path, seconds: float) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-vf",
            f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p",
            "-t",
            f"{seconds:.3f}",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "19",
            str(dest),
        ]
    )


def silence(dest: Path, seconds: float) -> None:
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", f"{seconds:.3f}", str(dest)])


def pad_audio(src: Path, dest: Path, seconds: float) -> None:
    run(["ffmpeg", "-y", "-i", str(src), "-af", f"apad=whole_dur={seconds:.3f}", "-ar", "44100", "-ac", "1", str(dest)])


def caption_png(text: str, text2: str, dest: Path) -> None:
    from PIL import Image, ImageDraw, ImageFont

    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    f1 = ImageFont.truetype(FONT, 52 if text2 else 46)
    f2 = ImageFont.truetype(FONT, 34)
    if text:
        bbox = dr.textbbox((0, 0), text, font=f1)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x, y = (W - tw) // 2, H - 280
        pad = 22
        dr.rounded_rectangle((x - pad, y - pad, x + tw + pad, y + th + pad + (48 if text2 else 0)), radius=16, fill=(0, 0, 0, 170))
        dr.text((x, y), text, font=f1, fill=(255, 255, 255, 240))
        if text2:
            dr.text((x, y + th + 12), text2, font=f2, fill=(220, 220, 220, 230))
    im.save(dest)


def overlay_caption(video: Path, cap: Path, dest: Path) -> None:
    run(["ffmpeg", "-y", "-i", str(video), "-i", str(cap), "-filter_complex", "[0:v][1:v]overlay=0:0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-an", str(dest)])


def mux(video: Path, voice: Path, dest: Path, seconds: float) -> None:
    hum = WORK / "cafe_hum.wav"
    if not hum.exists():
        run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.035:sample_rate=44100", "-t", "180", "-af", "lowpass=f=1800", str(hum)])
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
            "[1:a]volume=1.15[v];[2:a]volume=0.14[h];[v][h]amix=inputs=2:duration=first:dropout_transition=0[a]",
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
            "192k",
            "-ac",
            "2",
            str(dest),
        ]
    )


def fal_upload(path: Path) -> str:
    import fal_client

    url = fal_client.upload_file(str(path))
    print("upload", path.name, url[:80])
    return url


def kling_avatar(image: Path, audio: Path, dest: Path, prompt: str) -> None:
    import fal_client

    if dest.exists() and dest.stat().st_size > 50_000:
        print("skip avatar", dest.name)
        return
    img_url = fal_upload(image)
    aud_url = fal_upload(audio)
    print("kling avatar", dest.name)
    result = fal_client.subscribe(
        "fal-ai/kling-video/ai-avatar/v2/standard",
        arguments={"image_url": img_url, "audio_url": aud_url, "prompt": prompt},
        with_logs=True,
    )
    video_url = (result.get("video") or {}).get("url") if isinstance(result, dict) else None
    if not video_url and isinstance(result, dict):
        video_url = result.get("url")
    if not video_url:
        raise SystemExit(f"Avatar sin URL: {result!r}"[:500])
    dest.write_bytes(urllib.request.urlopen(video_url, timeout=180).read())
    print("saved", dest, dest.stat().st_size)


def main() -> None:
    load_secrets()
    os.environ.setdefault("FAL_KEY", os.environ["FAL_KEY"])
    WORK.mkdir(parents=True, exist_ok=True)
    pieces = []
    meta = []
    for shot in SHOTS:
        sid = shot["id"]
        src = ASSETS / shot["image"]
        still = WORK / f"{sid}_still.jpg"
        fit_cover(src, still)
        who, text = shot.get("who"), shot.get("text")
        voice = WORK / f"{sid}_voice.wav"
        if who and text:
            mp3 = WORK / f"{sid}_{who}.mp3"
            eleven_tts(who, text, mp3)
            speech = duration_sec(mp3)
            pad_audio(mp3, voice, speech)
        else:
            speech = float(shot.get("seconds") or 2)
            silence(voice, speech)
        seconds = max(float(shot.get("seconds") or 0), speech + 0.25)
        vid = WORK / f"{sid}_vid.mp4"
        if shot.get("avatar") and who and text:
            raw = WORK / f"{sid}_avatar.mp4"
            kling_avatar(src, WORK / f"{sid}_{who}.mp3", raw, shot.get("prompt") or ".")
            to_916(raw, vid, max(seconds, duration_sec(raw)))
            seconds = max(seconds, duration_sec(vid))
            pad_audio(voice, voice.with_name(voice.stem + "_pad.wav"), seconds)
            voice = voice.with_name(voice.stem + "_pad.wav")
        else:
            ken(still, seconds, vid)
            pad_audio(voice, voice.with_name(voice.stem + "_pad.wav"), seconds)
            voice = voice.with_name(voice.stem + "_pad.wav")
        cap_txt = shot.get("caption") or ""
        if cap_txt:
            cap = WORK / f"{sid}_cap.png"
            caption_png(cap_txt, shot.get("caption2") or "", cap)
            vid2 = WORK / f"{sid}_cap.mp4"
            overlay_caption(vid, cap, vid2)
            vid = vid2
        final = WORK / f"{sid}_final.mp4"
        mux(vid, voice, final, seconds)
        pieces.append(final)
        meta.append({"id": sid, "seconds": round(seconds, 2), "avatar": bool(shot.get("avatar"))})
        print("SHOT", sid, f"{seconds:.1f}s")

    lst = WORK / "concat.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in pieces))
    raw = WORK / "m03_raw.mp4"
    dest = OUT / "M03-americano.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(raw)])
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
            "21",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            str(dest),
        ]
    )
    (OUT / "M03-meta.json").write_text(json.dumps({"duration": duration_sec(dest), "shots": meta, "engine": "elevenlabs+kling-avatar"}, indent=2))
    print("LISTO", dest, duration_sec(dest))


if __name__ == "__main__":
    main()
