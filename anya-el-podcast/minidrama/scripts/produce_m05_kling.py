#!/usr/bin/env python3
"""M05 ¿Importo? — ElevenLabs + Kling Avatar. Keys en /tmp/anya_secrets.env."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ROOT / "piloto"
WORK = OUT / "_build" / "M05_kling"
W, H, FPS = 1080, 1920, 24
FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
if not Path(FONT).exists():
    FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

VOICES = {
    "anya": "pFZP5JQG7iQjIQuC4Bku",  # Lily
    "ethan": "TX3LPaxmHKxFdv7VOQHJ",  # Liam
}

SETTINGS = {
    "anya": {"stability": 0.58, "similarity_boost": 0.78, "style": 0.12, "use_speaker_boost": True},
    "ethan": {"stability": 0.48, "similarity_boost": 0.75, "style": 0.22, "use_speaker_boost": True},
}

P_ANYA = (
    "Young woman in a night cafe speaking Spanish, dusty blue pleated dress, "
    "shoulder-length chestnut hair, pale blue eyes, naive earnest face, "
    "subtle natural blinks, small head movement, no big smile, photoreal."
)
P_ETHAN = (
    "Tired young scientist in a dark knit sweater speaking quietly in Spanish, "
    "short stubble, messy dark hair, shy, natural blinks, photoreal night cafe."
)

SHOTS = [
    {
        "id": "t0",
        "image": "m05-tenedor.png",
        "seconds": 3.2,
        "caption": "Café · el pastel",
        "caption2": "M05 · ¿Importo?",
        "avatar": False,
    },
    {
        "id": "t1a",
        "image": "m04-anya-mira.png",
        "who": "anya",
        "text": "¿Se come con tenedor? No quiero hacerlo mal.",
        "avatar": True,
        "prompt": P_ANYA + " Genuine worry about using the fork correctly, not comic.",
    },
    {
        "id": "t1b",
        "image": "m03-ethan-hola.png",
        "who": "ethan",
        "text": "Como quieras. Nadie va a calificar.",
        "avatar": True,
        "prompt": P_ETHAN + " Soft, kind, a little smile in the eyes.",
    },
    {
        "id": "t1c",
        "image": "m03-anya-taza.png",
        "who": "anya",
        "text": "Eso ayuda. En mi día sí califican.",
        "avatar": False,
    },
    {
        "id": "t2a",
        "image": "m04-anya-mira.png",
        "who": "anya",
        "text": "Tu corazón va más rápido que cuando llegué. ¿Es el azúcar? ¿O es que estoy aquí? Si es un problema médico, debería avisarte.",
        "avatar": True,
        "prompt": P_ANYA + " Clinical then a real question. Not flirty.",
    },
    {
        "id": "t2b",
        "image": "m03-ethan-hola.png",
        "who": "ethan",
        "text": "No es médico. Estoy nervioso. Hace tiempo que no hablo así. Tú preguntas cosas que nadie pregunta.",
        "avatar": True,
        "prompt": P_ETHAN + " Shy honesty, slightly startled by her directness.",
    },
    {
        "id": "t2c",
        "image": "m04-anya-mira.png",
        "who": "anya",
        "text": "¿Nervioso es malo?",
        "avatar": False,
    },
    {
        "id": "t2d",
        "image": "m03-ethan-hola.png",
        "who": "ethan",
        "text": "A veces es que la conversación importa.",
        "avatar": True,
        "prompt": P_ETHAN + " Quiet, choosing words carefully.",
    },
    {
        "id": "t2e",
        "image": "m04-anya-mira.png",
        "who": "anya",
        "text": "Ah. Entonces… ¿importo? No hace falta que contestes si pesa demasiado. Acabo de aprender que algunas preguntas pesan más que las palabras.",
        "avatar": True,
        "prompt": P_ANYA + " Literal discovery, then a careful apology. No smile.",
    },
    {
        "id": "t3a",
        "image": "m03-ethan-hola.png",
        "who": "ethan",
        "text": "Importas. Aunque nos acabamos de conocer. Qué cosa más rara.",
        "avatar": True,
        "prompt": P_ETHAN + " Honest, shy, a late small smile, not a grin.",
    },
    {
        "id": "t3b",
        "image": "m03-anya-taza.png",
        "who": "anya",
        "text": "A mí me parece un dato útil. Gracias.",
        "avatar": False,
    },
    {
        "id": "t3c",
        "image": "m03-ethan-hola.png",
        "who": "ethan",
        "text": "Mañana, si no llueve, hay un lago. Pájaros. Uno se olvida del modelo. Si quieres seguir el experimento.",
        "avatar": True,
        "prompt": P_ETHAN + " Offering something fragile, hopeful, still tired.",
    },
    {
        "id": "t3d",
        "image": "m04-anya-mira.png",
        "who": "anya",
        "text": "Quiero. El lago no estaba en mi ruta. Voy a cambiar la ruta. ¿Se lleva paraguas aunque no llueva? En los videos a veces lo llevan y no llueve.",
        "avatar": True,
        "prompt": P_ANYA + " Decision first, then a literal question about umbrellas.",
    },
    {
        "id": "t4a",
        "image": "m05-lluvia-ventana.png",
        "seconds": 3.4,
        "avatar": False,
    },
    {
        "id": "t4b",
        "image": "m05-taza-vacia.png",
        "who": "anya",
        "text": "El pecho me hace un ruido que no estaba. No es taquicardia mía. No debería tenerla. Lo anoto: ruido. Causa: Ethan. No sé la casilla.",
        "avatar": False,
    },
    {
        "id": "t4c",
        "image": "m05-anya-pecho.png",
        "seconds": 3.0,
        "caption": "Causa: Ethan",
        "avatar": False,
    },
    {
        "id": "t4d",
        "image": "m05-lab-lluvia.png",
        "seconds": 4.0,
        "avatar": False,
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
        raise SystemExit("Faltan ELEVENLABS_API_KEY o FAL_KEY")


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd[:8]), "...")
    subprocess.run(cmd, check=True)


def duration_sec(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def eleven_tts(who: str, text: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 2000:
        return
    import json as _json
    import urllib.request

    body = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": SETTINGS[who],
    }
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICES[who]}",
        data=_json.dumps(body).encode(),
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
    run(
        [
            "ffmpeg", "-y", "-loop", "1", "-i", str(img), "-vf", vf,
            "-t", f"{seconds:.3f}", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", str(dest),
        ]
    )


def to_916(src: Path, dest: Path, seconds: float) -> None:
    run(
        [
            "ffmpeg", "-y", "-i", str(src),
            "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p",
            "-t", f"{seconds:.3f}", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", str(dest),
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
        dr.rounded_rectangle(
            (x - pad, y - pad, x + tw + pad, y + th + pad + (48 if text2 else 0)),
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
            "ffmpeg", "-y", "-i", str(video), "-i", str(cap),
            "-filter_complex", "[0:v][1:v]overlay=0:0",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-an", str(dest),
        ]
    )


def mux(video: Path, voice: Path, dest: Path, seconds: float, rain: bool = False) -> None:
    hum = WORK / "cafe_hum.wav"
    if not hum.exists():
        run(
            [
                "ffmpeg", "-y", "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.035:sample_rate=44100",
                "-t", "180", "-af", "lowpass=f=1800", str(hum),
            ]
        )
    rain_wav = WORK / "rain.wav"
    if rain and not rain_wav.exists():
        run(
            [
                "ffmpeg", "-y", "-f", "lavfi", "-i", "anoisesrc=color=white:amplitude=0.06:sample_rate=44100",
                "-t", "60", "-af", "highpass=f=400,lowpass=f=8000,volume=0.55", str(rain_wav),
            ]
        )
    if rain:
        fc = (
            "[1:a]volume=1.12[v];[2:a]volume=0.10[h];[3:a]volume=0.22[r];"
            "[v][h][r]amix=inputs=3:duration=first:dropout_transition=0[a]"
        )
        cmd = [
            "ffmpeg", "-y", "-i", str(video), "-i", str(voice),
            "-stream_loop", "-1", "-i", str(hum),
            "-stream_loop", "-1", "-i", str(rain_wav),
            "-filter_complex", fc,
            "-map", "0:v", "-map", "[a]", "-t", f"{seconds:.3f}",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", str(dest),
        ]
    else:
        cmd = [
            "ffmpeg", "-y", "-i", str(video), "-i", str(voice),
            "-stream_loop", "-1", "-i", str(hum),
            "-filter_complex", "[1:a]volume=1.15[v];[2:a]volume=0.14[h];[v][h]amix=inputs=2:duration=first:dropout_transition=0[a]",
            "-map", "0:v", "-map", "[a]", "-t", f"{seconds:.3f}",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", str(dest),
        ]
    run(cmd)


def fal_upload(path: Path) -> str:
    import fal_client

    url = fal_client.upload_file(str(path))
    print("upload", path.name, url[:80])
    return url


def kling_avatar(image: Path, audio: Path, dest: Path, prompt: str) -> None:
    import fal_client
    import urllib.request

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
        if not src.exists():
            raise SystemExit(f"Falta still: {src}")
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
        mux(vid, voice, final, seconds, rain=sid.startswith("t4"))
        pieces.append(final)
        meta.append({"id": sid, "seconds": round(seconds, 2), "avatar": bool(shot.get("avatar"))})
        print("SHOT", sid, f"{seconds:.1f}s")

    lst = WORK / "concat.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in pieces))
    raw = WORK / "m05_raw.mp4"
    dest = OUT / "M05-importo.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(raw)])
    tot = duration_sec(raw)
    fade_at = max(0.0, tot - 1.0)
    run(
        [
            "ffmpeg", "-y", "-i", str(raw),
            "-vf", f"fade=t=out:st={fade_at:.2f}:d=1.0,format=yuv420p",
            "-af", f"afade=t=out:st={fade_at:.2f}:d=1.0",
            "-c:v", "libx264", "-preset", "medium", "-crf", "21",
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(dest),
        ]
    )
    (OUT / "M05-meta.json").write_text(
        json.dumps(
            {"duration": duration_sec(dest), "shots": meta, "engine": "elevenlabs+kling-avatar"},
            indent=2,
        )
        + "\n"
    )
    print("LISTO", dest, duration_sec(dest))


if __name__ == "__main__":
    main()
