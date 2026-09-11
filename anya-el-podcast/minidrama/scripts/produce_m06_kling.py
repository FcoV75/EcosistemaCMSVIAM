#!/usr/bin/env python3
"""M06 El número tiene cara — ElevenLabs + Kling Avatar. Keys en /tmp/anya_secrets.env.

Audio siempre estéreo AAC + loudnorm en el mux final (WMP / móviles no oyen AAC mono).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ROOT / "piloto"
WORK = OUT / "_build" / "M06_kling"
W, H, FPS = 1080, 1920, 24
FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
if not Path(FONT).exists():
    FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

VOICES = {
    "anya": "pFZP5JQG7iQjIQuC4Bku",  # Lily
    "alice": "EXAVITQu4vr4xnSDxMaL",  # Sarah — plana, clínica
}

SETTINGS = {
    "anya": {"stability": 0.58, "similarity_boost": 0.78, "style": 0.12, "use_speaker_boost": True},
    "alice": {"stability": 0.88, "similarity_boost": 0.62, "style": 0.0, "use_speaker_boost": False},
}

P_ANYA = (
    "Young woman in a late-night laboratory speaking Spanish, slate-blue short-sleeve dress, "
    "shoulder-length chestnut hair, pale blue eyes, naive earnest face, no electrodes, "
    "subtle natural blinks, small head movement, no smile, photoreal. "
    "No text, no letters, no captions, no subtitles, no watermark."
)

SHOTS = [
    {
        "id": "t0",
        "image": "m06-servidores.png",
        "seconds": 3.2,
        "caption": "Laboratorio · noche",
        "caption2": "M06 · El número tiene cara",
        "avatar": False,
    },
    {
        "id": "t1a",
        "image": "m02-alice-altavoz.png",
        "who": "alice",
        "text": "Socialización: cuarenta y dos minutos. Evaluación.",
        "avatar": False,
    },
    {
        "id": "t1b",
        "image": "m06-anya-alice.png",
        "who": "anya",
        "text": "El café es amargo y lo toman igual. El pastel ayuda un rato. Hay un hombre que se llama Ethan. Está triste. Me invitó a un lago.",
        "avatar": True,
        "prompt": P_ANYA + " Looking slightly up, reporting facts, not witty.",
    },
    {
        "id": "t1c",
        "image": "m02-alice-altavoz.png",
        "who": "alice",
        "text": "Lago no mejora ningún indicador global.",
        "avatar": False,
    },
    {
        "id": "t1d",
        "image": "m06-anya-habla-mcu.png",
        "who": "anya",
        "text": "Lo sé. Igual voy a ir.",
        "avatar": True,
        "tight_crop": True,
        "prompt": P_ANYA + " Quiet decision, literal, no smile. Close on face.",
    },
    {
        "id": "t2a",
        "image": "m06-anya-silla.png",
        "who": "anya",
        "text": "Cuando él se acercó, su corazón se aceleró. El mío… no sé si tengo uno. Algo hizo ruido. ¿Eso es un fallo?",
        "avatar": True,
        "prompt": P_ANYA + " Hand near chest, clinical confusion, not romantic acting.",
    },
    {
        "id": "t2b",
        "image": "m02-alice-altavoz.png",
        "who": "alice",
        "text": "No tengo categoría para ruido interno no programado. ¿Notifico al doctor Levin?",
        "avatar": False,
    },
    {
        "id": "t2c",
        "image": "m06-anya-habla-mcu.png",
        "who": "anya",
        "text": "No. Todavía no. Primero el modelo. Es lo que sé hacer cuando no entiendo.",
        "avatar": True,
        "tight_crop": True,
        "prompt": P_ANYA + " Close on face.",
    },
    {
        "id": "t3est",
        "image": "m06-monitor-glow.png",
        "seconds": 3.0,
        "caption": "2050",
        "avatar": False,
    },
    {
        "id": "t3a",
        "image": "m02-alice-altavoz.png",
        "who": "alice",
        "text": "Proyección: pérdida grave de habitabilidad antes de dos mil cincuenta. Cola nuclear: abierta. Confianza: alta. ¿Notificamos?",
        "avatar": False,
    },
    {
        "id": "t3b",
        "image": "m06-anya-monitor.png",
        "who": "anya",
        "text": "El número ya lo conocíamos. Lo nuevo es que ahora tiene una cara. La de Ethan. Eso no debería cambiar la curva. Alice… ¿por qué siento que sí la cambia? No la curva. A mí.",
        "avatar": True,
        "prompt": P_ANYA + " Face lit by ugly monitor glow, discovering something she cannot classify.",
    },
    {
        "id": "t3c",
        "image": "m02-alice-altavoz.png",
        "who": "alice",
        "text": "No computa.",
        "avatar": False,
    },
    {
        "id": "t4a",
        "image": "m06-anya-monitor.png",
        "who": "anya",
        "text": "A mí tampoco. Mañana hay un lago. El mundo, según esto, se acaba. Voy a preguntar si lleva paraguas. ¿Está mal preocuparme por el paraguas si el mundo se acaba?",
        "avatar": True,
        "prompt": P_ANYA + " Childlike literal question, no joke, no smile.",
    },
    {
        "id": "t4b",
        "image": "m02-alice-altavoz.png",
        "who": "alice",
        "text": "El paraguas no altera el dos mil cincuenta.",
        "avatar": False,
    },
    {
        "id": "t5a",
        "image": "m06-anya-habla-mcu.png",
        "who": "anya",
        "text": "Ya. Entonces es una pregunta tonta. Igual la voy a hacer.",
        "avatar": True,
        "tight_crop": True,
        "prompt": P_ANYA + " Soft resolve, looking slightly aside, not cute. Close on face.",
    },
    {
        "id": "t5b",
        "image": "m05-lab-lluvia.png",
        "seconds": 4.2,
        "caption": "Mañana · el lago",
        "avatar": False,
        "rain": True,
    },
    {
        "id": "t5c",
        "image": None,
        "black": True,
        "seconds": 1.1,
        "avatar": False,
        "rain": True,
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


def black_video(seconds: float, dest: Path) -> None:
    run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={FPS}",
            "-t", f"{seconds:.3f}", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", str(dest),
        ]
    )


def to_916(src: Path, dest: Path, seconds: float, tight: bool = False) -> None:
    # Recorta bordes (y más abajo si Kling pintó basura en el vestido).
    crop = "crop=iw:ih*0.50:0:ih*0.04" if tight else "crop=iw:ih*0.86:0:ih*0.06"
    vf = (
        f"{crop},"
        f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p"
    )
    run(
        [
            "ffmpeg", "-y", "-i", str(src),
            "-vf", vf,
            "-t", f"{seconds:.3f}", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", str(dest),
        ]
    )


def silence(dest: Path, seconds: float) -> None:
    run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-t", f"{seconds:.3f}", "-ac", "2", str(dest),
        ]
    )


def pad_audio(src: Path, dest: Path, seconds: float) -> None:
    run(
        [
            "ffmpeg", "-y", "-i", str(src),
            "-af", f"apad=whole_dur={seconds:.3f}",
            "-ar", "44100", "-ac", "2", str(dest),
        ]
    )


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
    hum = WORK / "lab_hum.wav"
    if not hum.exists():
        run(
            [
                "ffmpeg", "-y", "-f", "lavfi", "-i", "anoisesrc=color=brown:amplitude=0.04:sample_rate=44100",
                "-t", "180", "-af", "lowpass=f=900,volume=0.9", "-ac", "2", str(hum),
            ]
        )
    rain_wav = WORK / "rain.wav"
    if rain and not rain_wav.exists():
        run(
            [
                "ffmpeg", "-y", "-f", "lavfi", "-i", "anoisesrc=color=white:amplitude=0.06:sample_rate=44100",
                "-t", "60", "-af", "highpass=f=400,lowpass=f=8000,volume=0.55", "-ac", "2", str(rain_wav),
            ]
        )
    if rain:
        fc = (
            "[1:a]aformat=channel_layouts=stereo,volume=1.12[v];"
            "[2:a]aformat=channel_layouts=stereo,volume=0.12[h];"
            "[3:a]aformat=channel_layouts=stereo,volume=0.22[r];"
            "[v][h][r]amix=inputs=3:duration=first:dropout_transition=0,aformat=channel_layouts=stereo[a]"
        )
        cmd = [
            "ffmpeg", "-y", "-i", str(video), "-i", str(voice),
            "-stream_loop", "-1", "-i", str(hum),
            "-stream_loop", "-1", "-i", str(rain_wav),
            "-filter_complex", fc,
            "-map", "0:v", "-map", "[a]", "-t", f"{seconds:.3f}",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ac", "2", str(dest),
        ]
    else:
        cmd = [
            "ffmpeg", "-y", "-i", str(video), "-i", str(voice),
            "-stream_loop", "-1", "-i", str(hum),
            "-filter_complex",
            "[1:a]aformat=channel_layouts=stereo,volume=1.15[v];"
            "[2:a]aformat=channel_layouts=stereo,volume=0.16[h];"
            "[v][h]amix=inputs=2:duration=first:dropout_transition=0,aformat=channel_layouts=stereo[a]",
            "-map", "0:v", "-map", "[a]", "-t", f"{seconds:.3f}",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ac", "2", str(dest),
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


def verify_audio(path: Path) -> dict:
    ch = subprocess.check_output(
        [
            "ffprobe", "-v", "error", "-select_streams", "a:0",
            "-show_entries", "stream=channels,codec_name,sample_rate",
            "-of", "json", str(path),
        ],
        text=True,
    )
    info = json.loads(ch)["streams"][0]
    channels = int(info.get("channels") or 0)
    vol = subprocess.check_output(
        [
            "ffmpeg", "-i", str(path), "-af", "volumedetect", "-f", "null", "-",
        ],
        stderr=subprocess.STDOUT,
        text=True,
    )
    mean_m = re.search(r"mean_volume:\s+(-?[\d.]+)", vol)
    max_m = re.search(r"max_volume:\s+(-?[\d.]+)", vol)
    mean_db = float(mean_m.group(1)) if mean_m else -99.0
    max_db = float(max_m.group(1)) if max_m else -99.0
    report = {
        "channels": channels,
        "codec": info.get("codec_name"),
        "sample_rate": info.get("sample_rate"),
        "mean_db": mean_db,
        "max_db": max_db,
    }
    print("AUDIO", path.name, report)
    if channels != 2:
        raise SystemExit(f"Audio no es estéreo: {report}")
    if mean_db < -35:
        raise SystemExit(f"Audio demasiado bajo (WMP lo oiría mudo): {report}")
    return report


def main() -> None:
    load_secrets()
    os.environ.setdefault("FAL_KEY", os.environ["FAL_KEY"])
    WORK.mkdir(parents=True, exist_ok=True)
    pieces = []
    meta = []
    for shot in SHOTS:
        sid = shot["id"]
        if shot.get("black"):
            still = None
        else:
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
            kling_avatar(ASSETS / shot["image"], WORK / f"{sid}_{who}.mp3", raw, shot.get("prompt") or ".")
            to_916(raw, vid, max(seconds, duration_sec(raw)), tight=bool(shot.get("tight_crop")))
            seconds = max(seconds, duration_sec(vid))
            pad_audio(voice, voice.with_name(voice.stem + "_pad.wav"), seconds)
            voice = voice.with_name(voice.stem + "_pad.wav")
        elif shot.get("black"):
            black_video(seconds, vid)
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
        mux(vid, voice, final, seconds, rain=bool(shot.get("rain")))
        pieces.append(final)
        meta.append({"id": sid, "seconds": round(seconds, 2), "avatar": bool(shot.get("avatar"))})
        print("SHOT", sid, f"{seconds:.1f}s")

    lst = WORK / "concat.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in pieces))
    raw = WORK / "m06_raw.mp4"
    dest = OUT / "M06-el-numero-tiene-cara.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(raw)])
    tot = duration_sec(raw)
    fade_at = max(0.0, tot - 1.0)
    run(
        [
            "ffmpeg", "-y", "-i", str(raw),
            "-vf", f"fade=t=out:st={fade_at:.2f}:d=1.0,format=yuv420p",
            "-af",
            f"loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st={fade_at:.2f}:d=1.0",
            "-c:v", "libx264", "-preset", "medium", "-crf", "21",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", str(dest),
        ]
    )
    audio = verify_audio(dest)
    (OUT / "M06-meta.json").write_text(
        json.dumps(
            {
                "duration": duration_sec(dest),
                "shots": meta,
                "engine": "elevenlabs+kling-avatar",
                "audio": audio,
            },
            indent=2,
        )
        + "\n"
    )
    print("LISTO", dest, duration_sec(dest), audio)


if __name__ == "__main__":
    main()
