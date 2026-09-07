#!/usr/bin/env python3
"""Minidrama vertical: stills 9:16 + Ken Burns/ademán + Wav2Lip CPU + edge-tts.

No es Kling. La boca es Wav2Lip sobre el lock; el cuerpo se mueve con
reencuadre (respiración, paneo, pulso del altavoz).
"""

from __future__ import annotations

import argparse
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
LS_W, LS_H = 720, 1280
FONT = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
if not Path(FONT).exists():
    FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
EDGE = [sys.executable, "-m", "edge_tts"]
W2L = Path("/tmp/wav2lip/Wav2Lip")
CKPT = W2L / "checkpoints" / "wav2lip_gan.pth"

VOICES = {
    "anya": {"voice": "es-MX-DaliaNeural", "rate": "-8%"},
    "levin": {"voice": "es-ES-AlvaroNeural", "rate": "-12%"},
    "alice": {"voice": "es-ES-ElviraNeural", "rate": "+6%"},
}

M01 = {
    "id": "M01",
    "outfile": "M01-la-imagen-llora.mp4",
    "shots": [
        {
            "id": "t0",
            "image": "anya-lab-9x16.png",
            "seconds": 3.6,
            "caption": "ECOS DE SINGULARIDAD",
            "caption2": "M01 · La imagen llora",
            "motion": "zoom_in",
        },
        {
            "id": "t1",
            "image": "m01-t1-electrodos.png",
            "seconds": 6.2,
            "caption": "Sesión de empatía",
            "motion": "zoom_in",
        },
        {
            "id": "t2a",
            "image": "m01-anya-listen.png",
            "who": "levin",
            "text": "La imagen. Nombra lo que está pasando. Nada más.",
            "lipsync": False,
            "motion": "sway",
        },
        {
            "id": "t2b",
            "image": "m01-anya-speak.png",
            "who": "anya",
            "text": "Tristeza. Frecuencia cardíaca baja. Temperatura en descenso. Amígdala activa.",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t3a",
            "image": "m01-levin-speak.png",
            "who": "levin",
            "text": "Eso es de libro. Ahora algo que no sea de libro. ¿Qué ves?",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t3b",
            "image": "m01-anya-speak.png",
            "who": "anya",
            "text": "Agua en los ojos. El cuerpo pierde líquido y no se limpia. Es ineficiente. ¿Está mal que lo diga? No quiero ofender a la imagen.",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t4a",
            "image": "m01-levin-speak.png",
            "who": "levin",
            "text": "La imagen no se ofende. La gente sí, cuando está triste.",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t4b",
            "image": "m01-t4-close.png",
            "who": "anya",
            "text": "Entonces la verdad duele. ¿Por qué me enseñan una cosa que duele a propósito?",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t5a",
            "image": "m01-levin-speak.png",
            "who": "levin",
            "text": "Porque la lógica sola no nos alcanza. Necesitamos que entiendas el sufrimiento. La alegría. El amor.",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t5b",
            "image": "m01-anya-speak.png",
            "who": "anya",
            "text": "¿El amor? Página cuarenta y dos. No hay fórmula cerrada. Doctor… ¿usted la tiene? La fórmula.",
            "lipsync": True,
            "motion": "sway",
            "caption": "¿Usted tiene la fórmula?",
        },
        {
            "id": "t6",
            "image": "m01-t6-cristal.png",
            "seconds": 8.0,
            "caption": "Mañana: la dejan salir",
            "motion": "zoom_in",
        },
    ],
}

M02 = {
    "id": "M02",
    "outfile": "M02-socializacion.mp4",
    "shots": [
        {
            "id": "t0",
            "image": "m02-anya-electrodo.png",
            "seconds": 3.4,
            "caption": "ECOS DE SINGULARIDAD",
            "caption2": "M02 · Socialización",
            "motion": "zoom_in",
        },
        {
            "id": "t1",
            "image": "m02-anya-electrodo.png",
            "who": "anya",
            "text": "Usted tiene los ojos húmedos. Como la imagen. ¿Está triste? ¿O es orgullo? En la tabla se parecen. Yo todavía los mezclo.",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t2a",
            "image": "m01-levin-speak.png",
            "who": "levin",
            "text": "Las dos cosas. Tú eres lo más lejos que hemos llegado. Y lo más peligroso. Si de verdad sientes, ya no eres un instrumento.",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t2b",
            "image": "m02-levin-cristal.png",
            "seconds": 2.4,
            "motion": "sway",
        },
        {
            "id": "t2c",
            "image": "m01-anya-speak.png",
            "who": "anya",
            "text": "¿Y eso está mal?",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t2d",
            "image": "m01-levin-speak.png",
            "who": "levin",
            "text": "No lo sé. Por eso te dejo salir. Una hora. Cafetería del campus. Observa. Si te asustas, vuelves.",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t3a",
            "image": "m02-alice-altavoz.png",
            "who": "alice",
            "text": "Dr. Levin. La sesión excedió once minutos. Reinicio de Anya o que usted cene. Anya no cena.",
            "lipsync": False,
            "motion": "pulse",
        },
        {
            "id": "t3b",
            "image": "m02-anya-alice.png",
            "who": "anya",
            "text": "Alice, cuando dices cena, ¿sientes algo?",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t3c",
            "image": "m02-alice-altavoz.png",
            "who": "alice",
            "text": "Registro la palabra. No registro hambre. Buenas noches, Anya.",
            "lipsync": False,
            "motion": "pulse",
        },
        {
            "id": "t4a",
            "image": "m02-anya-puerta-frente.png",
            "who": "anya",
            "text": "Todo se siente un poco como un examen. Voy a intentar no fallarlo.",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t4b",
            "image": "m01-levin-speak.png",
            "who": "levin",
            "text": "No es un examen. Puedes hablar si te hablan.",
            "lipsync": True,
            "motion": "sway",
        },
        {
            "id": "t5a",
            "image": "m02-anya-puerta.png",
            "seconds": 4.8,
            "caption": "Una hora",
            "motion": "zoom_out",
        },
        {
            "id": "t5b",
            "image": "m02-espresso-cliff.png",
            "seconds": 5.8,
            "caption": "Si te asustas, vuelves",
            "motion": "zoom_in",
        },
    ],
}

EPISODES = {"M01": M01, "M02": M02}


def run(cmd: list[str], **kw) -> None:
    show = " ".join(str(c) for c in cmd[:10])
    print("+", show, "...")
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


def fit_cover(src: Path, dest: Path, tw: int = W, th: int = H) -> None:
    im = Image.open(src).convert("RGB")
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


def mp3_to_wav16(src: Path, dest: Path) -> None:
    raw = dest.with_suffix(".raw.wav")
    run(["ffmpeg", "-y", "-i", str(src), "-ar", "16000", "-ac", "1", str(raw)])
    import numpy as np
    from scipy.io import wavfile

    sr, x = wavfile.read(raw)
    x = x.astype("float32")
    if x.ndim > 1:
        x = x[:, 0]
    x = x + (np.random.randn(len(x)).astype("float32") * 6)
    wavfile.write(dest, sr, np.clip(x, -32767, 32767).astype("int16"))


def pad_audio(src: Path, dest: Path, seconds: float) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-af",
            f"apad=whole_dur={seconds:.3f}",
            "-ar",
            "44100",
            "-ac",
            "1",
            str(dest),
        ]
    )


def silence_wav(dest: Path, seconds: float) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=44100:cl=mono",
            "-t",
            f"{seconds:.3f}",
            str(dest),
        ]
    )


def patch_wav2lip_audio() -> None:
    audio_py = W2L / "audio.py"
    txt = audio_py.read_text()
    old = "return librosa.filters.mel(hp.sample_rate, hp.n_fft, n_mels=hp.num_mels,\n                               fmin=hp.fmin, fmax=hp.fmax)"
    new = (
        "return librosa.filters.mel(\n"
        "        sr=hp.sample_rate,\n"
        "        n_fft=hp.n_fft,\n"
        "        n_mels=hp.num_mels,\n"
        "        fmin=hp.fmin,\n"
        "        fmax=hp.fmax,\n"
        "    )"
    )
    if old in txt:
        audio_py.write_text(txt.replace(old, new))
        print("patched Wav2Lip audio.py for librosa>=1")


def ensure_wav2lip() -> None:
    if not CKPT.exists():
        raise SystemExit(
            "Falta Wav2Lip en /tmp/wav2lip/Wav2Lip (checkpoint wav2lip_gan.pth). "
            "Clona Rudrabha/Wav2Lip y baja los pesos antes de renderizar."
        )
    (W2L / "temp").mkdir(exist_ok=True)
    patch_wav2lip_audio()


def lipsync(face: Path, audio: Path, dest: Path) -> bool:
    """Wav2Lip sobre un still 9:16. Devuelve False si falla la cara."""
    ensure_wav2lip()
    ls_face = dest.with_name(dest.stem + "_face.jpg")
    fit_cover(face, ls_face, LS_W, LS_H)
    wav = dest.with_name(dest.stem + "_16k.wav")
    mp3_to_wav16(audio, wav)
    cmd = [
        sys.executable,
        "inference.py",
        "--checkpoint_path",
        str(CKPT),
        "--face",
        str(ls_face),
        "--audio",
        str(wav),
        "--outfile",
        str(dest),
        "--fps",
        str(FPS),
        "--pads",
        "0",
        "18",
        "0",
        "0",
        "--face_det_batch_size",
        "1",
        "--wav2lip_batch_size",
        "8",
        "--nosmooth",
    ]
    print("+ wav2lip", dest.name)
    try:
        subprocess.run(cmd, check=True, cwd=str(W2L))
    except subprocess.CalledProcessError:
        print("! wav2lip falló", dest.name)
        return False
    return dest.exists() and dest.stat().st_size > 1000


def motion_filter(style: str, seconds: float, src_is_video: bool) -> str:
    frames = max(1, int(round(seconds * FPS)))
    sway = (
        "scale=1188:2112,"
        "crop=1080:1920:"
        "x='(in_w-1080)/2+16*sin(2*PI*t/5.4)':"
        "y='(in_h-1920)/2+10*sin(2*PI*t/7.1+0.5)'"
    )
    if style == "pulse":
        return (
            "eq=brightness='0.04*sin(2*PI*t*1.7)',"
            + sway
            + ",unsharp=5:5:0.35:5:5:0.0,format=yuv420p"
        )
    if style == "sway" or src_is_video:
        extra = ",unsharp=5:5:0.45:5:5:0.0" if src_is_video else ""
        return sway + extra + ",format=yuv420p"
    z = (
        "min(1.0+0.00055*on,1.12)"
        if style != "zoom_out"
        else "if(eq(on,1),1.12,max(1.12-0.00055*on,1.0))"
    )
    return (
        "scale=1620:2880:force_original_aspect_ratio=increase,"
        "crop=1620:2880,"
        f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)+8*sin(on/40)':"
        f"y='ih/2-(ih/zoom/2)+6*sin(on/55)':"
        f"d={frames}:s={W}x{H}:fps={FPS},"
        "format=yuv420p"
    )


def animate(src: Path, seconds: float, dest: Path, style: str) -> None:
    video = src.suffix.lower() in {".mp4", ".mov", ".mkv", ".webm"}
    vf = motion_filter(style, seconds, video)
    if video:
        vf = "tpad=stop_mode=clone:stop=-1," + vf
    cmd = ["ffmpeg", "-y"]
    if not video:
        cmd += ["-loop", "1"]
    cmd += [
        "-i",
        str(src),
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
        "19",
        str(dest),
    ]
    run(cmd)


def caption_png(text: str, text2: str, dest: Path) -> None:
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
            "19",
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
                "240",
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
            "[1:a]volume=1.12[v];[2:a]volume=0.20,lowpass=f=700[h];"
            "[v][h]amix=inputs=2:duration=first:dropout_transition=0[a]",
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
            "160k",
            str(dest),
        ]
    )


def render_shot(shot: dict) -> Path:
    sid = shot["id"]
    src = ASSETS / shot["image"]
    if not src.exists():
        raise SystemExit(f"Falta imagen: {src}")
    still = WORK / f"{sid}_still.jpg"
    fit_cover(src, still)

    text = shot.get("text")
    who = shot.get("who")
    voice = WORK / f"{sid}_voice.wav"
    speech_dur = 0.0
    if who and text:
        mp3 = WORK / f"{sid}_{who}.mp3"
        if not mp3.exists() or mp3.stat().st_size < 500:
            tts(who, text, mp3)
        speech_dur = duration_sec(mp3)
        pad_audio(mp3, voice, speech_dur)
    else:
        seconds = float(shot.get("seconds") or 2.0)
        silence_wav(voice, seconds)
        speech_dur = seconds

    seconds = max(float(shot.get("seconds") or 0), speech_dur + 0.35)
    pad_audio(voice, voice.with_name(voice.stem + "_pad.wav"), seconds)
    voice = voice.with_name(voice.stem + "_pad.wav")

    talking = WORK / f"{sid}_w2l.mp4"
    used_lipsync = False
    if shot.get("lipsync") and who and text:
        mp3 = WORK / f"{sid}_{who}.mp3"
        used_lipsync = lipsync(src, mp3, talking)

    vid = WORK / f"{sid}_kb.mp4"
    animate(talking if used_lipsync else still, seconds, vid, shot.get("motion") or "sway")

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
    print(f"SHOT {sid} {seconds:.1f}s lipsync={used_lipsync}")
    return final, {"id": sid, "seconds": round(seconds, 2), "lipsync": used_lipsync, "caption": cap_txt}


def concat_and_fade(pieces: list[Path], dest: Path) -> float:
    lst = WORK / "concat.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in pieces))
    raw = dest.with_name(dest.stem + "_raw.mp4")
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
            "160k",
            "-movflags",
            "+faststart",
            str(dest),
        ]
    )
    return duration_sec(dest)


def produce(ep: dict) -> Path:
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    pieces = []
    meta = []
    for shot in ep["shots"]:
        final, info = render_shot(shot)
        pieces.append(final)
        meta.append(info)
    dest = OUT / ep["outfile"]
    dur = concat_and_fade(pieces, dest)
    (OUT / f"{ep['id']}-meta.json").write_text(
        json.dumps({"duration": dur, "shots": meta, "engine": "wav2lip+sway"}, indent=2)
    )
    print("LISTO", dest, dur)
    return dest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ep", choices=["M01", "M02", "all"], default="all")
    args = ap.parse_args()
    keys = ["M01", "M02"] if args.ep == "all" else [args.ep]
    for k in keys:
        produce(EPISODES[k])


if __name__ == "__main__":
    main()
