/* Video Diamante — Motor VIAM v2 */

const LIMITES = {
    gratuito: { maxSeg: 240, maxImg: 10, maxVid: 2, maxDia: 3, minSeg: 8, etiqueta: "Gratuito" },
    premium: { maxSeg: 3600, maxImg: 30, maxVid: 99, maxDia: 10, minSeg: 8, etiqueta: "Premium" }
};

let isPremium = false;
let premiumMeta = { daysLeft: 0, status: "", permanent: false };
let audioFile = null;
let audioDuracionEst = 0;
let rielVozFile = null;
let rielFondoFile = null;
let duracionRielVoz = 0;
let duracionRielFondo = 0;
let nombrePistaEditado = false;
let portadaFile = null;
let cierreFile = null;
let mediaItems = [];
let objectUrls = [];
let letraGuardada = "";
let letraSegmentos = [];
let letraPalabras = [];
let imagenEstudioBlob = null;
let letraEstudioGenerada = "";
let midiEstudioBlob = null;
let midiEstudioAudioFile = null;
let vozEstudioAudioFile = null;
let clipEstudioBlob = null;
let clipEstudioTipo = "imagen";
let movimientoPendienteRender = 0;
let accessToken = localStorage.getItem("video_diamante_access_token") || "";

const LIMITES_ESTUDIO = { gratuito: 5, premium: 20 };
const LIMITES_VOZ = {
    gratuito: { maxSeg: 30, maxDia: 3 },
    premium: { maxSeg: 240, maxDia: 20 }
};
const LIMITES_MOVIMIENTO = { gratuito: 5, premium: 30 };
const LIMITES_CLIP = {
    gratuito: { minSeg: 8, maxSeg: 8, maxDia: 1 },
    premium: { minSeg: 8, maxSeg: 12, maxDia: 5 }
};
/** Netlify rechaza cuerpos ~>6 MB; margen amplio para multipart (campos + boundary). */
const LIMITE_SUBIDA_NETLIFY = 3.8 * 1024 * 1024;
/** A partir de este tamaño siempre se re-encodea el audio antes de subir. */
const UMBRAL_COMPRESION_AUDIO = 2.2 * 1024 * 1024;

const $ = (sel) => document.querySelector(sel);

function guardarAccessToken(token) {
    if (!token) return;
    accessToken = token;
    localStorage.setItem("video_diamante_access_token", token);
}

function authHeaders(extra = {}) {
    const headers = { ...extra };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return headers;
}

function tokenPareceVigente(token) {
    if (!token) return false;
    try {
        const bodyB64 = token.split(".")[0];
        const json = JSON.parse(atob(bodyB64.replace(/-/g, "+").replace(/_/g, "/")));
        return json.exp > Math.floor(Date.now() / 1000);
    } catch {
        return false;
    }
}

async function ensureAccessToken() {
    if (tokenPareceVigente(accessToken)) return;
    try {
        const r = await fetch("/.netlify/functions/access-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product: "video_diamante_premium", tier: "free" })
        });
        const d = await r.json();
        if (d.accessToken) guardarAccessToken(d.accessToken);
        else console.warn("Token de acceso:", d.error || "no disponible");
    } catch (e) {
        console.warn("No se pudo obtener token de acceso:", e.message);
    }
}

function estudioUsoHoy() {
    const raw = localStorage.getItem(`vd_estudio_uso_${hoyKey()}`);
    let uso = { imagen: 0, letra: 0, voz: 0, clip: 0, movimiento: 0 };
    if (raw) {
        try { uso = { ...uso, ...JSON.parse(raw) }; } catch { /* ignore */ }
    }
    const legado = parseInt(localStorage.getItem(`vd_estudio_${hoyKey()}`) || "0", 10);
    if (!raw && legado > 0) uso.imagen = legado;
    return uso;
}

function guardarEstudioUso(uso) {
    localStorage.setItem(`vd_estudio_uso_${hoyKey()}`, JSON.stringify(uso));
    const gens = (uso.imagen || 0) + (uso.letra || 0);
    localStorage.setItem(`vd_estudio_${hoyKey()}`, String(gens));
}

function estudioGensHoy() {
    const u = estudioUsoHoy();
    return (u.imagen || 0) + (u.letra || 0);
}

function incrementarEstudioGens(tipo = "imagen") {
    const u = estudioUsoHoy();
    u[tipo] = (u[tipo] || 0) + 1;
    guardarEstudioUso(u);
    actualizarCuotaEstudio();
}

function limiteEstudio() {
    return isPremium ? LIMITES_ESTUDIO.premium : LIMITES_ESTUDIO.gratuito;
}

function limitesVoz() {
    return isPremium ? LIMITES_VOZ.premium : LIMITES_VOZ.gratuito;
}

function limiteMovimiento() {
    return isPremium ? LIMITES_MOVIMIENTO.premium : LIMITES_MOVIMIENTO.gratuito;
}

function limitesClip() {
    return isPremium ? LIMITES_CLIP.premium : LIMITES_CLIP.gratuito;
}

function restarCuota(max, usado) {
    return Math.max(0, max - (usado || 0));
}

function actualizarCuotaEstudio() {
    const el = $("#status-estudio-cuota");
    const det = $("#cuotas-estudio-detalle");
    const uso = estudioUsoHoy();
    const maxEst = limiteEstudio();
    const restEst = restarCuota(maxEst, estudioGensHoy());
    if (el) {
        el.textContent = isPremium
            ? `Estudio IA Premium: ${restEst}/${maxEst} imágenes+discurso hoy`
            : `Imagen y discurso hoy: ${restEst}/${maxEst}`;
    }
    if (det) {
        const v = limitesVoz();
        const c = limitesClip();
        det.innerHTML = `
            <span>🗣️ Voz ${restarCuota(v.maxDia, uso.voz)}/${v.maxDia}</span>
            <span>🎥 Movimiento ${restarCuota(limiteMovimiento(), uso.movimiento)}/${limiteMovimiento()}</span>
            <span>✨ Clip ${restarCuota(c.maxDia, uso.clip)}/${c.maxDia}</span>
        `;
    }
    const stMov = $("#status-movimiento-estudio");
    if (stMov && !clipEstudioBlob) {
        stMov.textContent = `Cuota de movimiento al renderizar: ${restarCuota(limiteMovimiento(), uso.movimiento)}/${limiteMovimiento()} imágenes con Ken Burns hoy.`;
    }
}

function obtenerEscalaTexto() {
    const val = parseFloat($("#select-escala-texto")?.value || "6");
    return Math.max(1, Math.min(6, isNaN(val) ? 6 : val));
}

function actualizarPreviewTipografia() {
    const canvas = $("#canvas-preview-tipografia");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const escala = obtenerEscalaTexto();
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(20, h - 70, w - 40, 50);

    const tamSub = Math.max(18, Math.round(40 * escala * 0.22));
    const tamEsc = Math.max(14, Math.round(36 * escala * 0.18));
    ctx.textAlign = "center";
    ctx.font = `bold ${tamSub}px Arial, sans-serif`;
    ctx.fillStyle = "#FFD700";
    ctx.fillText("Subtítulo karaoke — palabra resaltada", w / 2, h - 38);
    ctx.font = `${tamEsc}px Arial, sans-serif`;
    ctx.fillStyle = "#FFF";
    ctx.fillText("Texto de escena en la parte inferior", w / 2, h - 12);

    ctx.font = `bold ${Math.max(12, Math.round(38 * escala * 0.15))}px Arial`;
    ctx.fillStyle = "#D4AF37";
    ctx.fillText(`Escala ×${escala}`, w / 2, 28);
}

async function fetchEstudio(endpoint, body) {
    await ensureAccessToken();
    let fn = "estudio-imagen";
    if (endpoint.includes("letra")) fn = "estudio-letra";
    else if (endpoint.includes("voz")) fn = "estudio-voz";
    else if (endpoint.includes("clip")) fn = "estudio-clip";
    const r2 = await fetch(`/.netlify/functions/${fn}`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body)
    });
    const d2 = await parseJsonSeguro(r2);
    return { ok: r2.ok, data: d2 };
}

function puedeUsarEstudio() {
    if (estudioGensHoy() >= limiteEstudio()) {
        const msg = isPremium
            ? `Has usado tus ${limiteEstudio()} generaciones IA Premium de hoy. Mañana tendrás más disponibles.`
            : `Alcanzaste el límite de ${limiteEstudio()} generaciones IA por día en plan gratuito.`;
        if (isPremium) alert(msg);
        else mostrarUpgrade(msg);
        return false;
    }
    return true;
}

function puedeUsarVoz() {
    const lim = limitesVoz();
    if ((estudioUsoHoy().voz || 0) >= lim.maxDia) {
        const msg = `Límite de voz IA: ${lim.maxDia} tomas/día.`;
        if (isPremium) alert(msg);
        else mostrarUpgrade(`${msg} En Premium son 20 tomas de hasta 4 min.`);
        return false;
    }
    return true;
}

function puedeUsarClip() {
    const lim = limitesClip();
    if ((estudioUsoHoy().clip || 0) >= lim.maxDia) {
        const msg = `Límite de clip IA: ${lim.maxDia}/día.`;
        if (isPremium) alert(msg);
        else mostrarUpgrade(`${msg} En Premium son 5 clips de 8–12 s.`);
        return false;
    }
    return true;
}

function estiloMovimientoActual() {
    return $("#estudio-estilo-movimiento")?.value || "zoom_in";
}

function movimientoPorDefecto() {
    return !!$("#chk-movimiento-nuevas")?.checked;
}

function mostrarPreviewMovimiento(src) {
    const wrap = $("#preview-movimiento-estudio");
    const img = $("#img-preview-movimiento");
    if (img) img.src = src;
    if (wrap) wrap.style.display = "block";
}

function nombrePistaSucio(nombre) {
    const base = String(nombre || "").replace(/\.[^.]+$/, "").trim();
    if (!base) return true;
    if (/^(estudio-voz|estudio-midi|estudio-clip|estudio|audio[_-]?temp|pista)[-_\s]?\d*$/i.test(base)) return true;
    if (/^[\d_\-\s.]+$/.test(base)) return true;
    return base.length < 3;
}

function sugerirNombrePista(file, riel) {
    const crudo = String(file?.name || "");
    const base = crudo.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!nombrePistaSucio(crudo) && base.length >= 3) return base.slice(0, 80);
    return riel === "voz" ? "Locución VIAM" : "Pista VIAM";
}

function nombrePistaParaVideo() {
    const escrito = $("#nombre-pista-video")?.value?.trim();
    if (escrito) return escrito.slice(0, 80);
    if (rielFondoFile && !nombrePistaSucio(rielFondoFile.name)) {
        return sugerirNombrePista(rielFondoFile, "fondo");
    }
    if (rielVozFile) return sugerirNombrePista(rielVozFile, "voz");
    return "Pista VIAM";
}

function rellenarNombrePistaSiVacio(sugerido) {
    const el = $("#nombre-pista-video");
    if (!el || nombrePistaEditado) return;
    if (el.value.trim() && !nombrePistaSucio(el.value)) return;
    el.value = sugerido;
}

function mimeRecorderPreferido() {
    if (typeof MediaRecorder === "undefined") return "";
    const candidatos = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    return candidatos.find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
}

function dibujarKenBurnsCanvas(ctx, img, t, w, h, estilo) {
    const te = Math.max(0, Math.min(1, t));
    const ease = te * te * (3 - 2 * te);
    const factor = 1.45;
    let scale = factor;
    if (estilo === "zoom_in") scale = 1 + ease * (factor - 1);
    else if (estilo === "zoom_out") scale = factor - ease * (factor - 1);
    const imgRatio = img.width / Math.max(1, img.height);
    const canvasRatio = w / h;
    let dw;
    let dh;
    if (imgRatio > canvasRatio) {
        dh = h * scale;
        dw = dh * imgRatio;
    } else {
        dw = w * scale;
        dh = dw / imgRatio;
    }
    let x = (w - dw) / 2;
    let y = (h - dh) / 2;
    if (estilo === "pan_derecha") x = (w - dw) * ease;
    else if (estilo === "pan_izquierda") x = (w - dw) * (1 - ease);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, x, y, dw, dh);
}

async function grabarClipKenBurns(imageBlob, duracionSeg, estilo) {
    const mime = mimeRecorderPreferido();
    if (!mime || typeof document.createElement("canvas").captureStream !== "function") {
        throw new Error("Este navegador no puede grabar el clip en video.");
    }
    const img = await createImageBitmap(imageBlob);
    const w = 1280;
    const h = 720;
    const fps = 24;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    const stream = canvas.captureStream(fps);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_400_000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const terminado = new Promise((resolve, reject) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime.split(";")[0] }));
        rec.onerror = () => reject(new Error("No se pudo grabar el movimiento del clip."));
    });
    const ms = Math.max(1000, Number(duracionSeg) * 1000);
    rec.start();
    const inicio = performance.now();
    await new Promise((resolve) => {
        const tick = () => {
            const elapsed = performance.now() - inicio;
            const t = Math.min(1, elapsed / ms);
            dibujarKenBurnsCanvas(ctx, img, t, w, h, estilo || "zoom_in");
            if (elapsed >= ms) {
                rec.stop();
                resolve();
                return;
            }
            setTimeout(tick, 1000 / fps);
        };
        tick();
    });
    const blob = await terminado;
    if (!blob || blob.size < 8000) throw new Error("El clip de video quedó vacío.");
    return blob;
}

function estiloMovimientoDesdePrompt(prompt) {
    const p = String(prompt || "").toLowerCase();
    if (/zoom.{0,24}(afuera|out|atrás|atras|alej)/.test(p) || /alej(ando|amiento)/.test(p)) return "zoom_out";
    if (/paneo?.{0,16}(izq|left)/.test(p)) return "pan_izquierda";
    if (/paneo?.{0,16}(der|right)/.test(p)) return "pan_derecha";
    if (/zoom|acerc|progresivo|acabando en|hacia el /.test(p)) return "zoom_in";
    return estiloMovimientoActual();
}

function agregarMedioDesdeBlob(blob, nombre, tipoForzado, extra = {}) {
    const file = new File([blob], nombre || "estudio-viam.jpg", { type: blob.type || "image/jpeg" });
    agregarMedios([file], tipoForzado || "imagen", extra);
}

async function agregarImagenDesdeBase64(b64, mime) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: mime || "image/jpeg" });
    agregarMedioDesdeBlob(blob, `estudio-${Date.now()}.jpg`, "imagen");
}

async function generarImagenIA() {
    if (!puedeUsarEstudio()) return;
    const prompt = $("#estudio-prompt-imagen")?.value?.trim();
    if (!prompt) { alert("Describe la imagen que deseas generar."); return; }

    const btn = $("#btn-generar-imagen");
    const status = $("#status-imagen-estudio");
    const preview = $("#preview-imagen-estudio");
    const btnAdd = $("#btn-anadir-imagen-pizarra");
    if (btn) { btn.disabled = true; btn.textContent = "Generando imagen..."; }
    if (status) status.textContent = "La IA está creando tu escena visual...";

    try {
        const { ok, data: d } = await fetchEstudio("/estudio/imagen", { prompt });
        if (!ok || !d.imagen_base64) throw new Error(d.error || "No se pudo generar la imagen.");

        incrementarEstudioGens("imagen");
        const mime = d.mime || "image/jpeg";
        const bin = atob(d.imagen_base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        imagenEstudioBlob = new Blob([arr], { type: mime });

        const url = URL.createObjectURL(imagenEstudioBlob);
        const img = $("#img-preview-estudio");
        if (img) img.src = url;
        if (preview) preview.style.display = "block";
        if (btnAdd) btnAdd.style.display = "inline-block";
        mostrarPreviewMovimiento(url);
        if (status) {
            const extra = d.resumen ? ` · ${d.resumen}` : "";
            status.textContent = `Imagen lista (${d.fuente || "IA"})${extra} — añádela a la pizarra o genera otra.`;
        }
    } catch (e) {
        if (status) status.textContent = "Error: " + e.message;
        alert("Error generando imagen: " + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "✨ Generar imagen"; }
    }
}

async function generarLetraIA() {
    if (!puedeUsarEstudio()) return;
    const tema = $("#estudio-tema-letra")?.value?.trim();
    if (!tema) { alert("Indica el producto o el tema del discurso."); return; }

    const btn = $("#btn-generar-letra");
    const status = $("#status-letra-estudio");
    const preview = $("#preview-letra-estudio");
    const btnUsar = $("#btn-usar-letra-subtitulos");
    const btnVoz = $("#btn-pasar-discurso-a-voz");
    const tono = $("#estudio-genero")?.value || "cercano";
    const mood = $("#estudio-mood")?.value || "claro y directo";
    const duracionSeg = clampDuracionEstudio($("#estudio-duracion-discurso")?.value);

    if (btn) { btn.disabled = true; btn.textContent = "Escribiendo discurso..."; }
    if (status) status.textContent = `La IA está redactando un discurso de ${duracionSeg} s...`;

    try {
        const { ok, data: d } = await fetchEstudio("/estudio/letra", {
            tema,
            tono: `${tono}, ${mood}`,
            genero: tono,
            mood,
            duracionSeg,
        });
        const texto = d.discurso || d.letra;
        if (!ok || !texto) throw new Error(d.error || "No se pudo generar el discurso.");

        incrementarEstudioGens("letra");
        letraEstudioGenerada = texto;
        const txt = $("#texto-preview-letra");
        if (txt) txt.textContent = letraEstudioGenerada;
        if (preview) preview.style.display = "block";
        if (btnUsar) btnUsar.style.display = "inline-block";
        if (btnVoz) btnVoz.style.display = "inline-block";
        if (status) status.textContent = `Discurso listo (${d.modelo || "IA"} · ${duracionSeg} s) — úsalo en subtítulos o pásalo a Voz IA.`;
    } catch (e) {
        if (status) status.textContent = "Error: " + e.message;
        alert("Error generando discurso: " + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "✨ Generar discurso"; }
    }
}

function usarLetraEnSubtitulos() {
    if (!letraEstudioGenerada) return;
    const area = $("#letra-cancion");
    const sec = $("#seccion-subtitulos");
    if (area) area.value = letraEstudioGenerada;
    letraGuardada = letraEstudioGenerada;
    letraSegmentos = [];
    letraPalabras = [];
    if (sec) sec.style.display = "block";
    const chk = $("#chk-subtitulos");
    if (chk) chk.checked = true;
    $("#status-transcripcion").textContent = "Discurso del Estudio VIAM cargado — se sincronizará por renglones al renderizar.";
    $("#status-letra-estudio").textContent = "Discurso aplicado a subtítulos.";
}

function pasarDiscursoAVoz() {
    if (!letraEstudioGenerada) {
        alert("Primero genera un discurso.");
        return;
    }
    const area = $("#estudio-texto-voz");
    if (area) area.value = letraEstudioGenerada;
    document.querySelectorAll(".tab-estudio").forEach((t) => t.classList.toggle("activo", t.dataset.tab === "voz"));
    document.querySelectorAll(".panel-estudio").forEach((p) => p.classList.remove("activo"));
    $("#panel-estudio-voz")?.classList.add("activo");
    $("#status-voz-estudio").textContent = "Discurso cargado. Pulsa «Generar voz».";
}

function blobDesdeBase64(b64, mime) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime || "application/octet-stream" });
}

async function generarVozIA() {
    if (!puedeUsarVoz()) return;
    const texto = $("#estudio-texto-voz")?.value?.trim() || letraEstudioGenerada;
    if (!texto) {
        alert("Escribe o pega el texto, o genera un discurso y pásalo a Voz IA.");
        return;
    }
    const btn = $("#btn-generar-voz");
    const status = $("#status-voz-estudio");
    const preview = $("#preview-voz-estudio");
    const audioEl = $("#audio-preview-voz");
    const btnUsar = $("#btn-usar-voz-audio");
    const lim = limitesVoz();
    const maxSeg = Math.max(8, Math.min(lim.maxSeg, Number($("#estudio-voz-maxseg")?.value) || lim.maxSeg));
    const voz = $("#estudio-voz-estilo")?.value || "femenina";

    if (btn) { btn.disabled = true; btn.textContent = "Generando locución..."; }
    if (status) status.textContent = `Creando voz IA (máx. ${maxSeg} s)...`;

    try {
        const { ok, data: d } = await fetchEstudio("/estudio/voz", { texto, voz, maxSeg });
        if (!ok || !d.audio_base64) throw new Error(d.error || "No se pudo generar la voz.");
        incrementarEstudioGens("voz");
        const mime = d.mime || "audio/mpeg";
        const blob = blobDesdeBase64(d.audio_base64, mime);
        const ext = mime.includes("wav") ? "wav" : "mp3";
        vozEstudioAudioFile = new File([blob], `estudio-voz-${Date.now()}.${ext}`, { type: mime });
        const url = URL.createObjectURL(vozEstudioAudioFile);
        if (audioEl) audioEl.src = url;
        if (preview) preview.style.display = "block";
        if (btnUsar) btnUsar.style.display = "inline-block";
        const extra = d.recortado ? " Texto recortado al límite de la toma." : "";
        if (status) {
            status.textContent = `Voz lista (${d.fuente || d.modelo || "IA"}).${extra} Ponla en el riel de locución; el MP3 o MIDI se queda en el riel de fondo.`;
        }
    } catch (e) {
        if (status) status.textContent = "Error: " + e.message;
        alert("Error generando voz: " + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "🗣️ Generar voz"; }
    }
}

async function usarVozComoAudio() {
    if (!vozEstudioAudioFile) {
        alert("Primero genera la voz.");
        return;
    }
    await cargarAudio(vozEstudioAudioFile, "voz");
    $("#status-voz-estudio").textContent = "Locución en el riel 1. El MP3 o MIDI de fondo no se toca.";
}

async function generarClipIA() {
    if (!puedeUsarClip()) return;
    const prompt = $("#estudio-prompt-clip")?.value?.trim();
    if (!prompt) { alert("Describe el clip que deseas generar."); return; }
    const lim = limitesClip();
    let duracionSeg = Number($("#estudio-duracion-clip")?.value) || lim.minSeg;
    duracionSeg = Math.max(lim.minSeg, Math.min(lim.maxSeg, duracionSeg));

    const btn = $("#btn-generar-clip");
    const status = $("#status-clip-estudio");
    const preview = $("#preview-clip-estudio");
    const img = $("#img-preview-clip");
    const vid = $("#video-preview-clip");
    const btnAdd = $("#btn-anadir-clip-pizarra");
    if (btn) { btn.disabled = true; btn.textContent = "Generando clip..."; }
    if (status) status.textContent = `Creando clip de ${duracionSeg} s...`;

    try {
        const { ok, data: d } = await fetchEstudio("/estudio/clip", { prompt, duracionSeg });
        if (!ok) throw new Error(d.error || "No se pudo generar el clip.");
        incrementarEstudioGens("clip");
        clipEstudioBlob = null;
        if (img) img.style.display = "none";
        if (vid) { vid.style.display = "none"; vid.removeAttribute("src"); }

        if (d.video_url || d.video_base64) {
            let blob;
            if (d.video_base64) blob = blobDesdeBase64(d.video_base64, d.mime || "video/mp4");
            else {
                const vr = await fetch(d.video_url);
                if (!vr.ok) throw new Error("No se pudo descargar el clip de video.");
                blob = await vr.blob();
            }
            clipEstudioBlob = blob;
            clipEstudioTipo = "video";
            const url = URL.createObjectURL(blob);
            if (vid) { vid.src = url; vid.style.display = "block"; }
        } else if (d.imagen_base64) {
            const still = blobDesdeBase64(d.imagen_base64, d.mime || "image/jpeg");
            const urlStill = URL.createObjectURL(still);
            if (img) { img.src = urlStill; img.style.display = "block"; }
            mostrarPreviewMovimiento(urlStill);
            if (status) status.textContent = `Escena lista. Grabando movimiento Ken Burns de ${duracionSeg} s…`;
            try {
                const videoBlob = await grabarClipKenBurns(still, duracionSeg, estiloMovimientoDesdePrompt(prompt));
                clipEstudioBlob = videoBlob;
                clipEstudioTipo = "video";
                const urlVid = URL.createObjectURL(videoBlob);
                if (vid) { vid.src = urlVid; vid.style.display = "block"; }
                if (img) img.style.display = "none";
            } catch (grabErr) {
                clipEstudioBlob = still;
                clipEstudioTipo = "cinematico";
                console.warn("Clip Ken Burns:", grabErr);
                if (status) {
                    status.textContent = `La escena se generó, pero este navegador no grabó el video. Al renderizar se aplicará el movimiento (${grabErr.message}).`;
                }
            }
        } else {
            throw new Error("Respuesta de clip incompleta.");
        }
        if (preview) preview.style.display = "block";
        if (btnAdd) btnAdd.style.display = "inline-block";
        if (status && clipEstudioTipo === "video") {
            const extra = d.resumen ? ` · ${d.resumen}` : "";
            status.textContent = `Clip de ${d.duracionSeg || duracionSeg} s con movimiento listo${extra}. Añádelo a la pizarra.`;
        } else if (status && clipEstudioTipo !== "cinematico") {
            status.textContent = d.aviso
                || `Clip listo (${d.fuente || "IA"} · ${d.duracionSeg || duracionSeg} s). Añádelo a la pizarra.`;
        }
    } catch (e) {
        if (status) status.textContent = "Error: " + e.message;
        alert("Error generando clip: " + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "✨ Generar clip"; }
    }
}

function anadirClipAPizarra() {
    if (!clipEstudioBlob) return;
    if (clipEstudioTipo === "video") {
        const ext = (clipEstudioBlob.type || "").includes("mp4") ? "mp4" : "webm";
        agregarMedioDesdeBlob(clipEstudioBlob, `estudio-clip-${Date.now()}.${ext}`, "video");
        $("#status-clip-estudio").textContent = "Clip de video con movimiento añadido a la pizarra.";
        return;
    }
    const file = new File([clipEstudioBlob], `estudio-clip-${Date.now()}.jpg`, { type: clipEstudioBlob.type || "image/jpeg" });
    agregarMedios([file], "imagen", { movimiento: true, movimientoIncluido: true, estilo_movimiento: estiloMovimientoDesdePrompt($("#estudio-prompt-clip")?.value) });
    $("#status-clip-estudio").textContent = "Escena añadida; el movimiento Ken Burns se aplica al renderizar.";
}

function midiU16(n) { return [(n >> 8) & 255, n & 255]; }
function midiU32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
function midiVarLen(value) {
    const bytes = [value & 0x7f];
    let v = value >>> 7;
    while (v > 0) {
        bytes.unshift((v & 0x7f) | 0x80);
        v >>>= 7;
    }
    return bytes;
}

function progresionMidi(estilo) {
    if (estilo === "energia") return [[60, 64, 67, 72], [62, 65, 69, 74], [64, 67, 71, 76], [62, 65, 69, 74]];
    if (estilo === "cinematico") return [[53, 60, 64, 67], [50, 57, 62, 65], [48, 55, 60, 64], [55, 62, 67, 71]];
    if (estilo === "corporativo") return [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
    if (estilo === "regional") return [[67, 71, 74], [65, 69, 72], [64, 67, 71], [62, 65, 69]];
    return [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
}

function construirArchivoMidi(segundos, estilo) {
    const tpq = 480;
    const bpm = estilo === "energia" ? 128 : estilo === "cinematico" ? 84 : 110;
    const usPQ = Math.round(60000000 / bpm);
    const ticksPorSeg = (tpq * bpm) / 60;
    const totalTicks = Math.max(tpq, Math.round(segundos * ticksPorSeg));
    const chords = progresionMidi(estilo);
    const beatsPorAcorde = 2;
    const ticksAcorde = tpq * beatsPorAcorde;

    const events = [
        { tick: 0, bytes: [0xff, 0x51, 0x03, (usPQ >> 16) & 255, (usPQ >> 8) & 255, usPQ & 255] },
        { tick: 0, bytes: [0xff, 0x03, 0x09, ...[..."VIAM MIDI"].map((c) => c.charCodeAt(0))] },
        { tick: 0, bytes: [0xc0, estilo === "regional" ? 25 : estilo === "energia" ? 81 : 89] },
        { tick: 0, bytes: [0xc1, 33] },
    ];

    let tick = 0;
    let i = 0;
    while (tick < totalTicks) {
        const chord = chords[i % chords.length];
        const dur = Math.min(ticksAcorde, totalTicks - tick);
        const vel = 64 + (i % 3) * 6;
        events.push({ tick, bytes: [0x91, chord[0] - 12, 72] });
        chord.forEach((note) => events.push({ tick, bytes: [0x90, note, vel] }));
        const off = tick + dur;
        events.push({ tick: off, bytes: [0x81, chord[0] - 12, 0] });
        chord.forEach((note) => events.push({ tick: off, bytes: [0x80, note, 0] }));
        const melody = chord[chord.length - 1] + (i % 2 === 0 ? 0 : 2);
        events.push({ tick, bytes: [0x90, melody, 80] });
        events.push({ tick: tick + Math.floor(dur * 0.7), bytes: [0x80, melody, 0] });
        tick += dur;
        i += 1;
    }

    events.sort((a, b) => a.tick - b.tick);
    const body = [];
    let last = 0;
    for (const ev of events) {
        body.push(...midiVarLen(Math.max(0, ev.tick - last)), ...ev.bytes);
        last = ev.tick;
    }
    body.push(...midiVarLen(0), 0xff, 0x2f, 0x00);
    const track = [0x4d, 0x54, 0x72, 0x6b, ...midiU32(body.length), ...body];
    const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, ...midiU16(tpq)];
    return new Blob([new Uint8Array([...header, ...track])], { type: "audio/midi" });
}

function frecuenciaMidi(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

function muestraMidiEn(t, estilo) {
    const chords = progresionMidi(estilo);
    const loopSeg = 8;
    const acordeDur = loopSeg / chords.length;
    const local = ((t % loopSeg) + loopSeg) % loopSeg;
    const idx = Math.min(chords.length - 1, Math.floor(local / acordeDur));
    const chord = chords[idx];
    const env = Math.min(1, (local % acordeDur) / 0.04) * Math.min(1, (acordeDur - (local % acordeDur)) / 0.08);
    let sample = Math.sin(2 * Math.PI * frecuenciaMidi(chord[0] - 12) * t) * 0.22;
    chord.forEach((note, n) => {
        sample += Math.sin(2 * Math.PI * frecuenciaMidi(note) * t) * (n === 0 ? 0.16 : 0.07);
    });
    return Math.max(-1, Math.min(1, sample * env));
}

async function midiBufferAMp3(segundos, estilo) {
    if (typeof lamejs === "undefined" || !lamejs.Mp3Encoder) {
        throw new Error("Motor MP3 no cargado. Recarga la página (Ctrl+F5).");
    }
    const sampleRate = 22050;
    const total = Math.max(1, Math.ceil(segundos * sampleRate));
    const encoder = new lamejs.Mp3Encoder(1, sampleRate, 96);
    const bloque = 1152;
    const pcm = new Int16Array(bloque);
    const parts = [];
    for (let i = 0; i < total; i += bloque) {
        const n = Math.min(bloque, total - i);
        for (let j = 0; j < bloque; j++) {
            const t = (i + j) / sampleRate;
            const v = j < n ? muestraMidiEn(t, estilo) : 0;
            pcm[j] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
        }
        const buf = encoder.encodeBuffer(pcm);
        if (buf.length > 0) parts.push(buf);
        if (i % (bloque * 80) === 0) await new Promise((r) => setTimeout(r, 0));
    }
    const fin = encoder.flush();
    if (fin.length > 0) parts.push(fin);
    return new File([new Blob(parts, { type: "audio/mpeg" })], `estudio-midi-${segundos}s.mp3`, { type: "audio/mpeg" });
}

async function generarMidiEstudio() {
    const status = $("#status-midi-estudio");
    const btn = $("#btn-generar-midi");
    const btnDl = $("#btn-descargar-midi");
    const btnUsar = $("#btn-usar-midi-audio");
    const estilo = $("#estudio-estilo-midi")?.value || "calma";
    const duracionSeg = clampDuracionEstudio($("#estudio-duracion-midi")?.value);

    if (btn) { btn.disabled = true; btn.textContent = "Componiendo..."; }
    if (status) status.textContent = `Creando MIDI y audio de ${duracionSeg} s...`;

    try {
        midiEstudioBlob = construirArchivoMidi(duracionSeg, estilo);
        midiEstudioAudioFile = await midiBufferAMp3(duracionSeg, estilo);
        if (btnDl) btnDl.style.display = "inline-block";
        if (btnUsar) btnUsar.style.display = "inline-block";
        if (status) {
            status.textContent = `Listo: ${duracionSeg} s · ${(midiEstudioAudioFile.size / 1024).toFixed(0)} KB. Descarga el .mid o ponlo en el riel de fondo.`;
        }
    } catch (e) {
        if (status) status.textContent = "Error: " + e.message;
        alert("No se pudo generar el MIDI: " + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "🎹 Generar MIDI y audio"; }
    }
}

function descargarMidiEstudio() {
    if (!midiEstudioBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(midiEstudioBlob);
    a.download = `estudio-viam-${Date.now()}.mid`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function usarMidiComoAudio() {
    if (!midiEstudioAudioFile) {
        alert("Primero genera el MIDI.");
        return;
    }
    await cargarAudio(midiEstudioAudioFile, "fondo");
    $("#status-midi-estudio").textContent = "MIDI en el riel 2 de fondo. La locución se queda en el riel 1.";
}

function clampDuracionEstudio(seg) {
    const lim = limitesActuales();
    const n = Number(seg);
    if (!Number.isFinite(n)) return lim.minSeg;
    return Math.max(lim.minSeg, Math.min(lim.maxSeg, Math.round(n)));
}

function actualizarCamposDuracionEstudio() {
    const lim = limitesActuales();
    ["estudio-duracion-discurso", "estudio-duracion-midi"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.min = String(lim.minSeg);
        el.max = String(lim.maxSeg);
        const actual = Number(el.value);
        if (!Number.isFinite(actual) || actual < lim.minSeg) el.value = String(lim.minSeg);
        if (actual > lim.maxSeg) el.value = String(lim.maxSeg);
    });
    const voz = limitesVoz();
    const vozEl = $("#estudio-voz-maxseg");
    if (vozEl) {
        vozEl.min = "8";
        vozEl.max = String(voz.maxSeg);
        const actual = Number(vozEl.value);
        if (!Number.isFinite(actual) || actual < 8) vozEl.value = String(Math.min(30, voz.maxSeg));
        if (actual > voz.maxSeg) vozEl.value = String(voz.maxSeg);
    }
    const hintVoz = $("#hint-duracion-voz");
    if (hintVoz) {
        hintVoz.textContent = isPremium
            ? "Premium: 8 segundos a 4 minutos por toma (20/día). El video de hasta 1 h se arma con este audio, MIDI o tu pista."
            : "Gratis: 8 a 30 segundos por toma (3/día). Premium sube a 4 min y 20 tomas/día.";
    }
    const clipSel = $("#estudio-duracion-clip");
    if (clipSel) {
        const c = limitesClip();
        Array.from(clipSel.options).forEach((opt) => {
            const n = Number(opt.value);
            opt.disabled = n > c.maxSeg || n < c.minSeg;
        });
        if (Number(clipSel.value) > c.maxSeg) clipSel.value = String(c.maxSeg);
    }
    const hint = $("#hint-duracion-discurso");
    if (hint) {
        hint.textContent = isPremium
            ? "Premium: 8 segundos a 1 hora. El discurso sale corto o largo según este tiempo."
            : "Gratis: 8 segundos a 4 minutos. El discurso sale corto o largo según este tiempo.";
    }
}

function configurarTabsEstudio() {
    document.querySelectorAll(".tab-estudio").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab-estudio").forEach((t) => t.classList.remove("activo"));
            document.querySelectorAll(".panel-estudio").forEach((p) => p.classList.remove("activo"));
            tab.classList.add("activo");
            const panel = $(`#panel-estudio-${tab.dataset.tab}`);
            if (panel) panel.classList.add("activo");
        });
    });
}

async function fetchRailwayViaProxy(endpoint, options = {}) {
    await ensureAccessToken();
    const proxyUrl = `/.netlify/functions/railway-path-proxy?path=${encodeURIComponent(endpoint)}`;
    const isFormData = options.body instanceof FormData;
    if (isFormData) {
        return fetch(proxyUrl, {
            method: options.method || "POST",
            headers: authHeaders(),
            body: options.body
        });
    }
    const headers = authHeaders({ Accept: "application/json", ...(options.headers || {}) });
    if (options.body) headers["Content-Type"] = "application/json";
    return fetch(proxyUrl, {
        method: options.method || "POST",
        headers,
        body: options.body
    });
}

function mensajeErrorMotorRailway(status, detalle) {
    if (status === 413 || /payload too large|demasiado grande|entity too large/i.test(String(detalle || ""))) {
        return "El archivo supera el límite de subida (~3.8 MB por archivo vía Netlify). El sistema comprimirá el audio automáticamente; si persiste, usa un MP3 más corto o un clip de video más ligero.";
    }
    if (status === 502 || status === 503 || /failed to respond/i.test(String(detalle || ""))) {
        return "Motor Railway no responde (502). Entra a Railway → EcosistemaCMSVIAM → Deployments → Redeploy. Revisa también que la variable PORT exista.";
    }
    if (/failed to fetch/i.test(String(detalle || ""))) {
        return "No hay conexión con Railway. El servicio puede estar caído o reiniciándose — espera 1 minuto e intenta de nuevo.";
    }
    return detalle || `Error del motor (${status || "desconocido"})`;
}

async function motorRailwayDisponible() {
    try {
        const r = await fetch("/.netlify/functions/railway-path-proxy?path=%2Fhealth", { method: "GET" });
        if (r.ok) return true;
        console.warn("Health Railway:", r.status);
    } catch (e) {
        console.warn("Health Railway no disponible:", e.message);
    }
    return false;
}

async function fetchRailwayPreferProxy(endpoint, options = {}) {
    try {
        const r = await fetchRailwayViaProxy(endpoint, options);
        if (r.ok || r.status === 202) return r;
        const d = await r.clone().json().catch(() => ({}));
        const msg = d.error || d.detalle || d.message || r.status;
        console.warn(`Proxy ${endpoint}:`, msg);
        if (r.status === 502 || r.status === 503) {
            throw new Error(mensajeErrorMotorRailway(r.status, msg));
        }
        return r;
    } catch (e) {
        if (/Motor Railway|No hay conexión/i.test(e.message)) throw e;
        throw new Error(mensajeErrorMotorRailway(0, e.message));
    }
}

async function comprimirImagenParaRender(file, maxW = 1280, maxH = 720, calidad = 0.85) {
    if (!file.type.startsWith("image/")) return file;
    if (file.size <= 900000) return file;
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad));
    if (!blob) return file;
    if (blob.size > LIMITE_SUBIDA_NETLIFY && calidad > 0.45) {
        return comprimirImagenParaRender(file, Math.round(maxW * 0.85), Math.round(maxH * 0.85), calidad - 0.15);
    }
    const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    console.info(`Imagen optimizada: ${(file.size / 1024).toFixed(0)} KB → ${(blob.size / 1024).toFixed(0)} KB`);
    return new File([blob], nombre, { type: "image/jpeg" });
}

async function prepararArchivosRender({ audio, audioFondo, portada, cierre, mediaItems }) {
    const archivos = [];
    async function prepararAudio(file, campo, etiqueta) {
        let audioSubida = file;
        const necesitaReducir = file.size > UMBRAL_COMPRESION_AUDIO || esAudioSinComprimir(file);
        if (necesitaReducir) {
            logAudioAviso(
                esAudioSinComprimir(file)
                    ? `${etiqueta} sin comprimir — convirtiendo a MP3 ligero para subida...`
                    : `${etiqueta} ${(file.size / (1024 * 1024)).toFixed(1)} MB — comprimiendo para subida segura...`
            );
            audioSubida = await comprimirAudioParaSubida(file);
            if (
                esAudioYaComprimido(file) &&
                audioSubida.size >= file.size &&
                file.size <= LIMITE_SUBIDA_NETLIFY
            ) {
                logAudioAviso("La compresión no redujo el peso — se usa el MP3 original.");
                audioSubida = file;
            } else {
                logAudioOk(`${etiqueta} listo para render (${(audioSubida.size / (1024 * 1024)).toFixed(1)} MB MP3)`);
            }
        }
        if (audioSubida.size > LIMITE_SUBIDA_NETLIFY) {
            logAudioAviso("Aún supera el límite — recompresión agresiva...");
            audioSubida = await comprimirAudioParaSubida(audioSubida, { forzarAgresivo: true });
        }
        if (audioSubida.size > LIMITE_SUBIDA_NETLIFY) {
            throw new Error(
                `El audio sigue pesando ${(audioSubida.size / (1024 * 1024)).toFixed(1)} MB tras comprimir. Usa un MP3 más corto o a menor bitrate.`
            );
        }
        archivos.push({ campo, file: audioSubida, etiqueta: etiqueta || audioSubida.name });
    }
    if (audio) await prepararAudio(audio, "audio", audio.name || "locución");
    if (audioFondo) await prepararAudio(audioFondo, "audio_fondo", audioFondo.name || "fondo");
    if (portada) {
        const img = await comprimirImagenParaRender(portada);
        archivos.push({ campo: "portada_file", file: img, etiqueta: img.name });
    }
    if (cierre) {
        const img = await comprimirImagenParaRender(cierre);
        archivos.push({ campo: "cierre_file", file: img, etiqueta: img.name });
    }
    for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        const campo = item.tipo === "video" ? `video_${i}` : `imagen_${i}`;
        let file = item.tipo === "imagen" ? await comprimirImagenParaRender(item.file) : item.file;
        if (file.size > LIMITE_SUBIDA_NETLIFY) {
            throw new Error(
                `"${file.name}" pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB. Cada archivo debe ser menor a ~3.8 MB para subirse al motor. Usa un clip más corto o comprímelo antes.`
            );
        }
        archivos.push({ campo, file, etiqueta: file.name });
    }
    return archivos;
}

async function subirArchivoRenderSesion(uploadId, campo, file, { reintento = true } = {}) {
    const fd = new FormData();
    fd.append("upload_id", uploadId);
    fd.append("campo", campo);
    fd.append("archivo", file, file.name || campo);
    const r = await fetchRailwayPreferProxy("/renderizar/subir", { method: "POST", body: fd });

    let d = {};
    try {
        d = await parseJsonSeguro(r);
    } catch (parseErr) {
        if (r.status === 413) d = { error: "payload too large" };
        else d = { error: parseErr.message || `HTTP ${r.status}` };
    }

    if (r.ok && d.success) return d;

    const es413 = r.status === 413 || /413|payload too large|entity too large|demasiado grande/i.test(
        String(d.error || d.detalle || d.message || "")
    );

    if (es413 && reintento && (campo === "audio" || campo === "audio_fondo")) {
        logAudioAviso("Subida rechazada (413) — recomprimiendo audio más agresivo...");
        const masLiviano = await comprimirAudioParaSubida(file, { forzarAgresivo: true });
        if (masLiviano.size >= file.size && file.size > LIMITE_SUBIDA_NETLIFY * 0.98) {
            throw new Error(mensajeErrorMotorRailway(413, "payload too large"));
        }
        return subirArchivoRenderSesion(uploadId, campo, masLiviano, { reintento: false });
    }

    if (es413) throw new Error(mensajeErrorMotorRailway(413, d.error || d.detalle || "413"));
    throw new Error(d.error || d.detalle || mensajeErrorMotorRailway(r.status, "Fallo al subir " + campo));
}

async function enviarRenderizadoPorPartes(meta, archivos, onProgreso) {
    if (onProgreso) onProgreso("Verificando motor Railway...");
    const online = await motorRailwayDisponible();
    if (!online) {
        throw new Error(mensajeErrorMotorRailway(502, "Application failed to respond"));
    }

    const rSesion = await fetchRailwayPreferProxy("/renderizar/sesion", { method: "POST" });
    const sesion = await parseJsonSeguro(rSesion);
    if (!rSesion.ok || !sesion.upload_id) {
        throw new Error(mensajeErrorMotorRailway(rSesion.status, sesion.error || sesion.detalle || sesion.message));
    }
    const uploadId = sesion.upload_id;

    for (let i = 0; i < archivos.length; i++) {
        const { campo, file, etiqueta } = archivos[i];
        if (onProgreso) onProgreso(`Subiendo ${i + 1}/${archivos.length}: ${etiqueta || campo}...`);
        await subirArchivoRenderSesion(uploadId, campo, file);
    }

    if (onProgreso) onProgreso("Iniciando renderizado en Railway...");
    const body = JSON.stringify({ upload_id: uploadId, ...meta });
    const rInicio = await fetchRailwayPreferProxy("/renderizar/iniciar", {
        method: "POST",
        body
    });
    return { respuesta: rInicio, resultado: await parseJsonSeguro(rInicio) };
}

async function enviarRenderizado(formData) {
    await ensureAccessToken();
    return fetch("/.netlify/functions/render-proxy", {
        method: "POST",
        headers: authHeaders(),
        body: formData
    });
}

async function parseJsonSeguro(respuesta) {
    const texto = await respuesta.text();
    try {
        return JSON.parse(texto);
    } catch {
        const limpio = texto.replace(/<[^>]+>/g, " ").trim();
        throw new Error(limpio.slice(0, 160) || "El servidor respondió con un error interno.");
    }
}

async function descargarVideoFinal() {
    const r = await fetchRailwayViaProxy("/descargar", { method: "GET" });
    if (!r.ok) throw new Error("No se pudo descargar el video.");
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "video_diamante.mp4";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function finalizarRenderizadoExitoso() {
    const statusText = $("#status-text");
    const loadingBox = $("#loading-box");
    if (statusText) {
        statusText.textContent = "✅ ¡Video generado y descargado con éxito!";
        statusText.style.color = "#00FF66";
    }
    if (loadingBox) loadingBox.style.display = "none";
    window.renderInterval = null;
}

function mostrarGraciasCompra() {
    const modal = $("#gracias-modal");
    if (modal) modal.showModal();
    if (typeof window.mostrarGraciasEcosistema === "function") {
        window.mostrarGraciasEcosistema();
    }
}

function aplicarCuotaMovimientoEnLista(lista) {
    const max = limiteMovimiento();
    let remaining = Math.max(0, max - (estudioUsoHoy().movimiento || 0));
    let cobrados = 0;
    let recortados = 0;
    for (let i = 0; i < lista.length; i++) {
        const item = lista[i];
        if (!item.movimiento) continue;
        if (mediaItems[i]?.movimientoIncluido) continue;
        if (remaining <= 0) {
            item.movimiento = false;
            recortados += 1;
        } else {
            remaining -= 1;
            cobrados += 1;
        }
    }
    return { cobrados, recortados };
}

function registrarMovimientoRender(cantidad) {
    if (cantidad <= 0) return;
    const u = estudioUsoHoy();
    u.movimiento = (u.movimiento || 0) + cantidad;
    guardarEstudioUso(u);
    actualizarCuotaEstudio();
}

function limitesActuales() {
    return isPremium ? LIMITES.premium : LIMITES.gratuito;
}

function hoyKey() {
    return new Date().toISOString().slice(0, 10);
}

function rendersHoy() {
    return parseInt(localStorage.getItem(`vd_renders_${hoyKey()}`) || "0", 10);
}

function incrementarRenders() {
    const k = `vd_renders_${hoyKey()}`;
    localStorage.setItem(k, String(rendersHoy() + 1));
    actualizarIndicadorPlan();
}

function revocarUrls() {
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
    objectUrls = [];
}

function estimarDuracionAudio(file) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const audio = new Audio();
        audio.preload = "metadata";
        audio.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(audio.duration && isFinite(audio.duration) ? audio.duration : 0);
        };
        audio.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(0);
        };
        audio.src = url;
    });
}

function aplicarModoPremiumUI() {
    const banner = $("#banner-upgrade");
    const panel = $("#panel-bienvenida-premium");
    const hintEstudio = $("#hint-estudio");
    const hintPizarra = $("#hint-pizarra");
    const hintSub = $("#hint-subtitulos");
    const welcomeMsg = $("#premium-welcome-msg");

    if (banner) banner.style.display = isPremium ? "none" : "block";
    if (panel) panel.style.display = isPremium ? "block" : "none";

    if (isPremium) {
        if (welcomeMsg) {
            if (premiumMeta.permanent) {
                welcomeMsg.textContent = "Acceso de propietario — Premium permanente. Todo desbloqueado para ti.";
            } else if (premiumMeta.status === "warning") {
                welcomeMsg.textContent = `Membresía activa — te quedan ${premiumMeta.daysLeft} días. Considera renovar pronto.`;
            } else if (premiumMeta.status === "last_day") {
                welcomeMsg.textContent = "¡Hoy es el último día de tu membresía Premium! Renueva para no perder beneficios.";
            } else {
                welcomeMsg.textContent = `Membresía activa — ${premiumMeta.daysLeft} días restantes. Todo desbloqueado para ti.`;
            }
        }
        if (hintEstudio) {
            hintEstudio.textContent = "Estudio VIAM Premium: voz IA hasta 4 min (20/día) en el riel de locución, MIDI/MP3 en el riel de fondo, movimiento Ken Burns en 30 imágenes, clips 8–12 s (5/día).";
            hintEstudio.style.color = "#E8DDB5";
        }
        if (hintPizarra) {
            hintPizarra.textContent = "Pizarra Premium: hasta 30 imágenes y videos MP4. Activa movimiento cinematográfico en cada foto. Arrastra para alternar el orden.";
            hintPizarra.style.color = "#E8DDB5";
        }
        if (hintSub) {
            hintSub.textContent = "Transcribe con IA, corrige la letra y activa subtítulos karaoke sincronizados con la voz.";
            hintSub.style.color = "#E8DDB5";
        }
    } else {
        if (hintEstudio) {
            hintEstudio.textContent = "Imagen HD, discurso, MIDI en riel de fondo, voz IA (30 s, 3/día) en riel de locución, movimiento (5/día) y clip 8 s (1/día).";
            hintEstudio.style.color = "#BCB4B4";
        }
        if (hintPizarra) {
            hintPizarra.textContent = "Arrastra imágenes y videos. Activa movimiento Ken Burns en las fotos (5/día gratis). Gratuito: 10 imgs + 2 videos · Premium: 30 imgs.";
            hintPizarra.style.color = "#BCB4B4";
        }
        if (hintSub) {
            hintSub.textContent = "La IA transcribe respetando acentos en español. Puedes corregir la letra antes de renderizar.";
            hintSub.style.color = "#BCB4B4";
        }
    }
    actualizarCuotaEstudio();
    actualizarCamposDuracionEstudio();
}

function mostrarBienvenidaPremium(esNuevo = false) {
    aplicarModoPremiumUI();
    if (esNuevo) {
        $("#guia-premium-modal")?.showModal();
    }
}

function cerrarSesionPremium() {
    if (!confirm("¿Cerrar sesión Premium en este dispositivo? Podrás volver a entrar con tu código CMS-XXXXXX.")) return;
    localStorage.removeItem("video_diamante_premium_code");
    localStorage.removeItem("video_diamante_access_token");
    accessToken = "";
    isPremium = false;
    premiumMeta = { daysLeft: 0, status: "", permanent: false };
    aplicarModoPremiumUI();
    actualizarIndicadorPlan();
    actualizarAvisoAudio();
    ensureAccessToken();
}

function agregarMensajeChat(rol, texto) {
    const hist = $("#chat-asistente-historial");
    if (!hist) return;
    const div = document.createElement("div");
    div.className = rol === "user" ? "chat-msg-user" : "chat-msg-bot";
    div.textContent = texto;
    hist.appendChild(div);
    hist.scrollTop = hist.scrollHeight;
}

async function enviarConsultaAsistente() {
    if (!isPremium) {
        alert("El asistente IA está disponible solo para miembros Premium.");
        return;
    }
    const input = $("#asistente-input");
    const status = $("#asistente-status");
    const btn = $("#btn-enviar-asistente");
    const code = localStorage.getItem("video_diamante_premium_code");
    const msg = input?.value.trim();
    if (!msg) return alert("Escribe tu pregunta.");
    if (!code) return alert("No hay código de membresía activo.");

    if (btn) btn.disabled = true;
    if (status) status.textContent = "El asistente está pensando...";
    agregarMensajeChat("user", msg);
    if (input) input.value = "";

    try {
        const r = await fetch("/.netlify/functions/video-diamante-guia", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, message: msg })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "No se pudo obtener respuesta.");
        agregarMensajeChat("bot", d.reply);
        if (status) {
            status.textContent = typeof d.consultasRestantes === "number"
                ? `Consultas restantes hoy: ${d.consultasRestantes}`
                : "";
        }
    } catch (e) {
        agregarMensajeChat("bot", "Error: " + e.message);
        if (status) status.textContent = "";
    } finally {
        if (btn) btn.disabled = false;
    }
}

function actualizarIndicadorPlan() {
    const el = $("#plan-indicator");
    const lim = limitesActuales();
    const restantes = lim.maxDia - rendersHoy();
    const secMarca = $("#seccion-marca-agua");
    const avisoGratuito = $("#aviso-marca-gratuito");
    if (secMarca) secMarca.style.display = isPremium ? "block" : "none";
    if (avisoGratuito) avisoGratuito.style.display = isPremium ? "none" : "block";
    if (!el) return;
    if (isPremium) {
        const dias = premiumMeta.permanent
            ? " · propietario"
            : premiumMeta.daysLeft > 0
                ? ` · ${premiumMeta.daysLeft} días`
                : "";
        el.textContent = `💎 Premium activo — ${restantes} renders hoy (máx. ${lim.maxDia}) · audio 8 s – 1 h · ${lim.maxImg} imgs${dias}`;
        el.style.color = "#FFFD00";
        el.title = "Clic para gestionar tu membresía Premium";
        el.style.cursor = "pointer";
    } else {
        el.textContent = `🆓 Plan Gratuito — ${restantes}/${lim.maxDia} renders hoy · 8 s – 4 min · ${lim.maxImg} imgs`;
        el.style.color = "#D4AF37";
        el.title = "";
        el.style.cursor = "default";
    }
}

async function verificarMembresiaDetalle(codigo = null) {
    const codigoLimpio = codigo ? String(codigo).trim().toUpperCase() : "";
    const headers = window.EcosistemaCuenta
        ? await window.EcosistemaCuenta.authHeaders({ "Content-Type": "application/json" })
        : { "Content-Type": "application/json" };
    const body = { productoRequerido: "video_diamante_premium" };
    if (codigoLimpio.length >= 5) body.code = codigoLimpio;
    else if (!window.EcosistemaCuenta) {
        return { ok: false, error: "Ingresa un código válido (ej. CMS-XXXXXX)." };
    }
    try {
        const r = await fetch("/.netlify/functions/member-status", {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });
        const d = await r.json();
        if (!r.ok) return { ok: false, error: d.error || "Código no encontrado." };
        if (d.status === "expired") return { ok: false, error: "Tu membresía expiró. Renueva tu plan Premium." };
        if (!["active", "warning", "last_day"].includes(d.status)) {
            return { ok: false, error: "Membresía no activa para Video Diamante." };
        }
        if (d.accessToken) guardarAccessToken(d.accessToken);
        if (d.legacy_code) localStorage.setItem("video_diamante_premium_code", d.legacy_code);
        return { ok: true, status: d.status, daysLeft: d.daysLeft, permanent: !!d.permanent, legacy_code: d.legacy_code };
    } catch {
        return { ok: false, error: "Error de conexión. Intenta de nuevo." };
    }
}

async function verificarMembresia(codigo) {
    const r = await verificarMembresiaDetalle(codigo);
    return r.ok;
}

function abrirModalPremium(foco = "codigo") {
    const modal = $("#premium-modal");
    const memberInput = $("#member-code-input");
    const stripeInput = $("#stripe-session-code");
    const memberStatus = $("#member-code-status");
    const stripeStatus = $("#verification-status");
    if (memberStatus) memberStatus.textContent = "";
    if (stripeStatus) stripeStatus.textContent = "";
    const guardado = localStorage.getItem("video_diamante_premium_code");
    if (memberInput && guardado) memberInput.value = guardado;
    modal?.showModal();
    if (foco === "stripe" && stripeInput) stripeInput.focus();
    else memberInput?.focus();
}

async function activarConCodigoMiembro() {
    const input = $("#member-code-input");
    const status = $("#member-code-status");
    const codigo = input?.value.trim().toUpperCase();
    if (!codigo) return alert("Ingresa tu código CMS-XXXXXX.");
    if (status) { status.textContent = "Verificando..."; status.style.color = "#D4AF37"; }
    const r = await verificarMembresiaDetalle(codigo);
    if (r.ok) {
        isPremium = true;
        premiumMeta = { daysLeft: r.daysLeft, status: r.status, permanent: !!r.permanent };
        localStorage.setItem("video_diamante_premium_code", codigo);
        if (status) {
            const aviso = r.permanent
                ? "¡Bienvenido, propietario! Acceso Premium permanente."
                : r.status === "warning"
                ? `¡Bienvenido! Te quedan ${r.daysLeft} días de membresía.`
                : r.status === "last_day"
                    ? "¡Bienvenido! Hoy es el último día de tu membresía."
                    : `¡Premium activo! Te quedan ${r.daysLeft} días.`;
            status.textContent = aviso;
            status.style.color = "#00FF66";
        }
        actualizarIndicadorPlan();
        actualizarAvisoAudio();
        mostrarBienvenidaPremium(true);
        setTimeout(() => $("#premium-modal")?.close(), 1200);
    } else if (status) {
        status.textContent = r.error || "Código inválido";
        status.style.color = "#FF3333";
    }
}

function configurarDragZone(zona, onFiles) {
    if (!zona) return;
    ["dragenter", "dragover"].forEach((ev) => {
        zona.addEventListener(ev, (e) => {
            e.preventDefault();
            zona.classList.add("zona-activa");
        });
    });
    ["dragleave", "drop"].forEach((ev) => {
        zona.addEventListener(ev, (e) => {
            e.preventDefault();
            zona.classList.remove("zona-activa");
        });
    });
    zona.addEventListener("drop", (e) => {
        e.preventDefault();
        if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
    });
}

function agregarMedios(files, tipoForzado, extra = {}) {
    const lim = limitesActuales();

    Array.from(files).forEach((file) => {
        const esVideo = tipoForzado === "video" || (tipoForzado !== "imagen" && file.type.startsWith("video/"));
        const esImagen = tipoForzado === "imagen" || (tipoForzado !== "video" && file.type.startsWith("image/"));
        if (!esVideo && !esImagen) return;

        const imgsActuales = mediaItems.filter((m) => m.tipo === "imagen").length;
        const vidsActuales = mediaItems.filter((m) => m.tipo === "video").length;

        if (esImagen && imgsActuales >= lim.maxImg) {
            const msg = `Máximo ${lim.maxImg} imágenes en plan ${lim.etiqueta}.`;
            if (isPremium) alert(msg);
            else mostrarUpgrade(msg);
            return;
        }
        if (!isPremium && esVideo && vidsActuales >= lim.maxVid) {
            mostrarUpgrade(`Límite de videos alcanzado en plan gratuito (${lim.maxVid}).`);
            return;
        }

        const movimiento = esImagen
            ? (typeof extra.movimiento === "boolean" ? extra.movimiento : movimientoPorDefecto())
            : false;

        mediaItems.push({
            id: Date.now() + Math.random(),
            tipo: esVideo ? "video" : "imagen",
            file,
            texto: extra.texto || "",
            silenciado: true,
            movimiento,
            movimientoIncluido: !!extra.movimientoIncluido,
            estilo_movimiento: extra.estilo_movimiento || estiloMovimientoActual()
        });
    });
    renderizarPizarras();
}

function renderizarPizarras() {
    revocarUrls();
    const cont = $("#pizarra-secuencia");
    if (!cont) return;
    cont.innerHTML = "";

    if (mediaItems.length === 0) {
        cont.innerHTML = '<p style="color:#888;font-size:0.9rem;padding:12px;">Arrastra aquí imágenes y videos, o usa los botones de arriba. Luego reordénalos alternando como quieras.</p>';
        configurarDragZone(cont, (files) => agregarMedios(files, null));
        return;
    }

    mediaItems.forEach((item, index) => {
        const url = URL.createObjectURL(item.file);
        objectUrls.push(url);

        const celda = document.createElement("div");
        celda.className = `celda-media tipo-${item.tipo}`;
        celda.draggable = true;
        celda.dataset.index = String(index);

        const preview = item.tipo === "video"
            ? `<video src="${url}" class="miniatura-media" muted playsinline></video>`
            : `<img src="${url}" class="miniatura-media" alt="">`;

        const badge = item.tipo === "video" ? "🎬 Video" : "🖼️ Imagen";
        const muteHtml = item.tipo === "video"
            ? `<label class="chk-silencio"><input type="checkbox" class="chk-mute" data-index="${index}" ${item.silenciado ? "checked" : ""}> Silenciar audio del clip</label>`
            : "";
        const movHtml = item.tipo === "imagen"
            ? `<label class="chk-movimiento"><input type="checkbox" class="chk-mov" data-index="${index}" ${item.movimiento ? "checked" : ""}> Movimiento cinematográfico</label>
               <select class="select-tipografia select-movimiento-celda" data-index="${index}" ${item.movimiento ? "" : "disabled"}>
                 <option value="zoom_in"${item.estilo_movimiento === "zoom_in" ? " selected" : ""}>Zoom adentro</option>
                 <option value="zoom_out"${item.estilo_movimiento === "zoom_out" ? " selected" : ""}>Zoom afuera</option>
                 <option value="pan_derecha"${item.estilo_movimiento === "pan_derecha" ? " selected" : ""}>Paneo derecha</option>
                 <option value="pan_izquierda"${item.estilo_movimiento === "pan_izquierda" ? " selected" : ""}>Paneo izquierda</option>
               </select>`
            : "";

        celda.innerHTML = `
            <span class="tipo-badge">${badge}<span class="orden-badge">#${index + 1}</span></span>
            <span class="arrastrar-hint">⠿ Arrastrar para reordenar</span>
            ${preview}
            <input type="text" class="input-subtitulo input-texto-premium" data-index="${index}" placeholder="Texto para esta escena..." value="${item.texto.replace(/"/g, "&quot;")}">
            ${muteHtml}
            ${movHtml}
            <button type="button" class="btn-eliminar-celda" data-index="${index}">Remover</button>
        `;
        cont.appendChild(celda);
    });

    document.querySelectorAll(".input-subtitulo").forEach((inp) => {
        inp.addEventListener("input", function () {
            const i = parseInt(this.dataset.index, 10);
            if (mediaItems[i]) mediaItems[i].texto = this.value;
        });
    });
    document.querySelectorAll(".chk-mute").forEach((chk) => {
        chk.addEventListener("change", function () {
            const i = parseInt(this.dataset.index, 10);
            if (mediaItems[i]) mediaItems[i].silenciado = this.checked;
        });
    });
    document.querySelectorAll(".chk-mov").forEach((chk) => {
        chk.addEventListener("change", function () {
            const i = parseInt(this.dataset.index, 10);
            if (!mediaItems[i]) return;
            mediaItems[i].movimiento = this.checked;
            const sel = cont.querySelector(`.select-movimiento-celda[data-index="${i}"]`);
            if (sel) sel.disabled = !this.checked;
        });
    });
    document.querySelectorAll(".select-movimiento-celda").forEach((sel) => {
        sel.addEventListener("change", function () {
            const i = parseInt(this.dataset.index, 10);
            if (mediaItems[i]) mediaItems[i].estilo_movimiento = this.value;
        });
    });
    document.querySelectorAll(".btn-eliminar-celda").forEach((btn) => {
        btn.addEventListener("click", function () {
            mediaItems.splice(parseInt(this.dataset.index, 10), 1);
            renderizarPizarras();
        });
    });

    configurarReorden(cont);
    configurarDragZone(cont, (files) => agregarMedios(files, null));
}

function configurarReorden(contenedor) {
    let arrastrado = null;
    contenedor.querySelectorAll(".celda-media").forEach((celda) => {
        celda.addEventListener("dragstart", () => { arrastrado = celda; celda.classList.add("arrastrando"); });
        celda.addEventListener("dragend", () => { arrastrado = null; celda.classList.remove("arrastrando"); });
        celda.addEventListener("dragover", (e) => { e.preventDefault(); });
        celda.addEventListener("drop", (e) => {
            e.preventDefault();
            if (!arrastrado || arrastrado === celda) return;
            const from = parseInt(arrastrado.dataset.index, 10);
            const to = parseInt(celda.dataset.index, 10);
            const [moved] = mediaItems.splice(from, 1);
            mediaItems.splice(to, 0, moved);
            renderizarPizarras();
        });
    });
}

function formatoDuracion(seg) {
    const s = Math.ceil(seg);
    const min = Math.floor(s / 60);
    const resto = s % 60;
    return `${min}:${String(resto).padStart(2, "0")}`;
}

function mostrarUpgrade(mensaje) {
    if (isPremium) {
        alert(mensaje);
        return;
    }
    const modal = $("#upgrade-modal");
    const txt = $("#upgrade-mensaje");
    if (txt) txt.textContent = mensaje;
    if (modal) modal.showModal();
}

async function iniciarStripe(planTipo) {
    const origin = window.location.origin;
    const btn = planTipo === "anual" ? $("#btn-plan-anual") : $("#btn-plan-mensual");
    const txtOrig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Redirigiendo a Stripe..."; }
    try {
        const headers = window.EcosistemaCuenta
            ? await window.EcosistemaCuenta.authHeaders({ "Content-Type": "application/json" })
            : { "Content-Type": "application/json" };
        const r = await fetch("/.netlify/functions/create-checkout-session", {
            method: "POST",
            headers,
            body: JSON.stringify({
                producto: "video_diamante_premium",
                planTipo,
                successUrl: `${origin}/video_diamante.html?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${origin}/video_diamante.html?payment_cancelled=true`
            })
        });
        const d = await r.json();
        if (r.ok && d.url) window.location.href = d.url;
        else alert("Error Stripe: " + (d.error || "Desconocido"));
    } catch (e) {
        alert("No se pudo conectar con Stripe.");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = txtOrig; }
    }
}

function formatearLetraDesdeSegmentos(segmentos, textoPlano) {
    if (Array.isArray(segmentos) && segmentos.length) {
        return segmentos.map((s) => String(s.text || "").trim()).filter(Boolean).join("\n");
    }
    return textoPlano || "";
}

function humanizarErrorTranscripcion(msg) {
    const m = String(msg || "");
    if (/GROQ_API_KEY/i.test(m)) {
        return "El servicio de transcripción IA no está configurado en el servidor (falta GROQ_API_KEY en Railway y Netlify). Contacta al administrador del ecosistema.";
    }
    if (/413|payload too large|entity too large|demasiado grande/i.test(m)) {
        return "El audio es demasiado pesado para enviarse al servidor (~3.8 MB máx. por petición). Recarga la página e intenta de nuevo; el sistema comprimirá el audio automáticamente.";
    }
    if (/internal error/i.test(m)) {
        return "Groq (IA de transcripción) respondió con error interno. Espera 30 segundos e intenta de nuevo. Si el audio es muy largo (>4 min), prueba con un fragmento más corto.";
    }
    return m || "Transcripción fallida";
}

function floatAInt16(float32Array) {
    const int16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
}

function logAudioOk(mensaje) {
    console.log(`[Video Diamante] ✅ ${mensaje}`);
}

function logAudioAviso(mensaje) {
    console.warn(`[Video Diamante] ⚠️ ${mensaje}`);
}

function logAudioError(mensaje, err) {
    console.error(`[Video Diamante] ❌ ${mensaje}`, err || "");
}

function nombreBaseSinExtension(nombre) {
    return String(nombre || "pista").replace(/\.[^.]+$/, "");
}

function extensionArchivo(file) {
    const nombre = String(file?.name || "").trim();
    const partes = nombre.split(".");
    if (partes.length < 2) return "";
    return partes.pop().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mimeAudio(file) {
    return String(file?.type || "").toLowerCase();
}

/** MP3 / AAC / OGG / etc. ya comprimidos: no reencodear al cargar. */
function esAudioYaComprimido(file) {
    const ext = extensionArchivo(file);
    const mime = mimeAudio(file);
    if (["mp3", "mpeg", "mpga", "m4a", "aac", "ogg", "oga", "opus", "webm", "mp4"].includes(ext)) {
        return true;
    }
    if (
        mime.includes("mpeg") ||
        mime.includes("mp3") ||
        mime.includes("mp4") ||
        mime.includes("m4a") ||
        mime.includes("aac") ||
        mime.includes("ogg") ||
        mime.includes("opus") ||
        mime.includes("webm")
    ) {
        return true;
    }
    return false;
}

/** WAV / FLAC / AIFF: sí conviene convertir a MP3 al cargar. */
function esAudioSinComprimir(file) {
    const ext = extensionArchivo(file);
    const mime = mimeAudio(file);
    if (["wav", "wave", "aiff", "aif", "flac"].includes(ext)) return true;
    if (mime.includes("wav") || mime.includes("flac") || mime.includes("aiff")) return true;
    return false;
}

function esArchivoAudio(file) {
    if (!file) return false;
    if (mimeAudio(file).startsWith("audio/")) return true;
    if (esAudioYaComprimido(file) || esAudioSinComprimir(file)) return true;
    const ext = extensionArchivo(file);
    return ["mp3", "mpeg", "wav", "wave", "m4a", "aac", "ogg", "flac", "aiff", "aif", "opus", "webm"].includes(ext);
}

/** Solo formatos sin comprimir se convierten al cargar. El tamaño NO fuerza conversión. */
function necesitaConversionMp3(file) {
    if (esAudioYaComprimido(file)) return false;
    return esAudioSinComprimir(file);
}

/** Detecta MP3 por cabecera ID3 o frame sync (por si el nombre/MIME fallan). */
async function pareceMp3PorCabecera(file) {
    try {
        const buf = await file.slice(0, 12).arrayBuffer();
        const u8 = new Uint8Array(buf);
        if (u8.length >= 3 && u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return true; // ID3
        if (u8.length >= 2 && u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) return true; // frame sync
    } catch {
        /* ignore */
    }
    return false;
}

async function decodificarArchivoAudio(file) {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = new AudioContext();
    try {
        return await ctx.decodeAudioData(arrayBuffer.slice(0));
    } finally {
        await ctx.close();
    }
}

async function resampleAudioBuffer(audioBuffer, sampleRate, canales = 1) {
    const ch = Math.min(canales, audioBuffer.numberOfChannels) || 1;
    const offline = new OfflineAudioContext(
        ch,
        Math.max(1, Math.ceil(audioBuffer.duration * sampleRate)),
        sampleRate
    );
    const src = offline.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(offline.destination);
    src.start(0);
    return offline.startRendering();
}

async function encodeMp3FromBuffer(rendered, { sampleRate = 44100, canales = 1, kbps = 128 } = {}) {
    if (typeof lamejs === "undefined" || !lamejs.Mp3Encoder) {
        throw new Error("Motor MP3 no cargado. Recarga la página (Ctrl+F5).");
    }
    const mp3encoder = new lamejs.Mp3Encoder(canales, sampleRate, kbps);
    const bloque = 1152;
    const mp3Chunks = [];

    if (canales === 1) {
        const mono = floatAInt16(rendered.getChannelData(0));
        for (let i = 0; i < mono.length; i += bloque) {
            const buf = mp3encoder.encodeBuffer(mono.subarray(i, i + bloque));
            if (buf.length > 0) mp3Chunks.push(buf);
        }
    } else {
        const izq = floatAInt16(rendered.getChannelData(0));
        const der = floatAInt16(rendered.getChannelData(1));
        for (let i = 0; i < izq.length; i += bloque) {
            const buf = mp3encoder.encodeBuffer(
                izq.subarray(i, i + bloque),
                der.subarray(i, i + bloque)
            );
            if (buf.length > 0) mp3Chunks.push(buf);
        }
    }
    const fin = mp3encoder.flush();
    if (fin.length > 0) mp3Chunks.push(fin);

    return new Blob(mp3Chunks, { type: "audio/mpeg" });
}

async function convertirAudioAMp3(file, kbps = 128) {
    const audioBuffer = await decodificarArchivoAudio(file);
    const sampleRate = 44100;
    const canales = audioBuffer.numberOfChannels >= 2 ? 2 : 1;
    const rendered = await resampleAudioBuffer(audioBuffer, sampleRate, canales);
    const blob = await encodeMp3FromBuffer(rendered, { sampleRate, canales, kbps });
    return new File([blob], `${nombreBaseSinExtension(file.name)}.mp3`, { type: "audio/mpeg" });
}

async function comprimirAudioParaSubida(file, { forzarAgresivo = false } = {}) {
    // Si ya es MP3 y cabe en el límite, no tocar.
    if (!forzarAgresivo && esAudioYaComprimido(file) && file.size <= LIMITE_SUBIDA_NETLIFY) {
        return file;
    }

    const audioBuffer = await decodificarArchivoAudio(file);
    const ladder = forzarAgresivo
        ? [
            { sampleRate: 22050, kbps: 48 },
            { sampleRate: 16000, kbps: 32 },
            { sampleRate: 16000, kbps: 24 },
          ]
        : [
            { sampleRate: 44100, kbps: 96 },
            { sampleRate: 44100, kbps: 64 },
            { sampleRate: 22050, kbps: 48 },
            { sampleRate: 16000, kbps: 32 },
          ];

    let mejor = null;
    for (const paso of ladder) {
        const rendered = await resampleAudioBuffer(audioBuffer, paso.sampleRate, 1);
        const blob = await encodeMp3FromBuffer(rendered, {
            sampleRate: paso.sampleRate,
            canales: 1,
            kbps: paso.kbps,
        });
        if (!mejor || blob.size < mejor.size) mejor = blob;
        if (blob.size <= LIMITE_SUBIDA_NETLIFY && blob.size < file.size) {
            logAudioOk(`Audio comprimido a ${paso.kbps} kbps / ${paso.sampleRate} Hz (${(blob.size / (1024 * 1024)).toFixed(1)} MB)`);
            return new File([blob], `${nombreBaseSinExtension(file.name)}_render.mp3`, { type: "audio/mpeg" });
        }
        if (blob.size <= LIMITE_SUBIDA_NETLIFY) {
            // Cabe en el límite aunque no haya reducido: útil para WAV grandes.
            if (!esAudioYaComprimido(file) || blob.size < file.size * 0.98) {
                logAudioOk(`Audio listo a ${paso.kbps} kbps / ${paso.sampleRate} Hz (${(blob.size / (1024 * 1024)).toFixed(1)} MB)`);
                return new File([blob], `${nombreBaseSinExtension(file.name)}_render.mp3`, { type: "audio/mpeg" });
            }
        }
    }

    // Preferir el más pequeño entre original y mejor intento.
    if (mejor && mejor.size < file.size) {
        return new File([mejor], `${nombreBaseSinExtension(file.name)}_render.mp3`, { type: "audio/mpeg" });
    }
    if (esAudioYaComprimido(file)) return file;
    return new File([mejor], `${nombreBaseSinExtension(file.name)}_render.mp3`, { type: "audio/mpeg" });
}

async function comprimirAudioParaIA(file) {
    // MP3/AAC livianos: enviar tal cual (nunca WAV: infla el body).
    if (file.size <= LIMITE_SUBIDA_NETLIFY && esAudioYaComprimido(file)) {
        return file;
    }

    const audioBuffer = await decodificarArchivoAudio(file);
    const targetRate = 16000;
    const rendered = await resampleAudioBuffer(audioBuffer, targetRate, 1);
    let kbps = 48;
    let blob = await encodeMp3FromBuffer(rendered, { sampleRate: targetRate, canales: 1, kbps });
    if (blob.size > LIMITE_SUBIDA_NETLIFY) {
        kbps = 32;
        blob = await encodeMp3FromBuffer(rendered, { sampleRate: targetRate, canales: 1, kbps });
    }
    if (blob.size > LIMITE_SUBIDA_NETLIFY) {
        kbps = 24;
        blob = await encodeMp3FromBuffer(rendered, { sampleRate: targetRate, canales: 1, kbps });
    }
    if (blob.size > LIMITE_SUBIDA_NETLIFY) {
        throw new Error(
            `Audio de transcripción ${(blob.size / (1024 * 1024)).toFixed(1)} MB tras comprimir — supera el límite de Netlify. Usa un fragmento más corto.`
        );
    }
    // Si el reencode salió más pesado y el original ya cabe, conservar el original.
    if (esAudioYaComprimido(file) && file.size <= LIMITE_SUBIDA_NETLIFY && blob.size >= file.size) {
        logAudioAviso("Reencode IA más pesado que el original — se envía el MP3 original.");
        return file;
    }
    const mb = (blob.size / (1024 * 1024)).toFixed(1);
    logAudioOk(`Audio listo para transcripción IA (${mb} MB MP3 mono 16 kHz @ ${kbps} kbps).`);
    return new File([blob], "transcribe_16k.mp3", { type: "audio/mpeg" });
}

async function transcribirConGroq(audioFile) {
    await ensureAccessToken();
    const audio = await comprimirAudioParaIA(audioFile);

    const crearFormData = () => {
        const fd = new FormData();
        fd.append("audio", audio, audio.name || "transcribe_16k.mp3");
        return fd;
    };

    const intentos = [
        {
            nombre: "proxy",
            fn: () => fetch("/.netlify/functions/transcribe-proxy", {
                method: "POST",
                headers: authHeaders(),
                body: crearFormData()
            })
        },
        {
            nombre: "netlify-groq",
            fn: () => fetch("/.netlify/functions/transcribe-audio", {
                method: "POST",
                headers: authHeaders(),
                body: crearFormData()
            })
        }
    ];

    let ultimoError = "Transcripción fallida";

    for (const intento of intentos) {
        try {
            const r = await intento.fn();
            const d = await parseJsonSeguro(r);
            if (r.ok && d.texto) return d;
            ultimoError = d.error || d.detalle || ultimoError;
            console.warn(`Transcribir ${intento.nombre}:`, ultimoError);
        } catch (e) {
            ultimoError = e.message || ultimoError;
            console.warn(`Transcribir ${intento.nombre} no disponible:`, e.message);
        }
    }

    throw new Error(humanizarErrorTranscripcion(ultimoError));
}

async function transcribirAudio() {
    if (!audioFile) { alert("Pon una locución o un MP3 en los rieles de audio."); return; }
    const btn = $("#btn-transcribir");
    const area = $("#letra-cancion");
    const status = $("#status-transcripcion");
    if (btn) { btn.disabled = true; btn.textContent = "IA escuchando..."; }
    if (status) status.textContent = "Preparando audio (optimizando WAV/MP3)...";
    try {
        if (status) status.textContent = "Transcribiendo con IA (español estricto)...";
        const d = await transcribirConGroq(audioFile);
        const letraFmt = formatearLetraDesdeSegmentos(d.segmentos, d.texto);
        if (area) area.value = letraFmt;
        letraGuardada = letraFmt;
        letraSegmentos = Array.isArray(d.segmentos) ? d.segmentos : [];
        letraPalabras = Array.isArray(d.palabras) ? d.palabras : [];
        if (status) {
            const syncMsg = d.sync_real
                ? `Letra lista (${letraPalabras.length} palabras con sync real de la voz) — edítala y pulsa Guardar.`
                : letraPalabras.length
                    ? `Letra lista (${letraPalabras.length} palabras, sync aproximado) — vuelve a transcribir si el karaoke se desfasa.`
                    : "Letra lista — edítala y pulsa Guardar.";
            status.textContent = syncMsg;
        }
    } catch (e) {
        const msg = humanizarErrorTranscripcion(e.message);
        if (status) status.textContent = "Error: " + msg;
        alert("No se pudo transcribir: " + msg);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "🎙️ Transcribir con IA"; }
    }
}

function validarProyecto() {
    const lim = limitesActuales();
    if (rendersHoy() >= lim.maxDia) {
        if (isPremium) {
            alert(`Has usado tus ${lim.maxDia} renders Premium de hoy. Vuelve mañana para continuar.`);
        } else {
            mostrarUpgrade(`Alcanzaste el límite de ${lim.maxDia} videos por día en plan gratuito.`);
        }
        return false;
    }
    if (!rielVozFile && !rielFondoFile) {
        alert("Pon una locución en el riel 1, un MP3/MIDI en el riel 2, o ambos.");
        return false;
    }
    if (audioDuracionEst > 0 && audioDuracionEst < lim.minSeg) {
        alert(`El audio debe durar al menos ${lim.minSeg} segundos (ahora: ${Math.ceil(audioDuracionEst)} s).`);
        return false;
    }

    const imgs = mediaItems.filter((m) => m.tipo === "imagen");
    const vids = mediaItems.filter((m) => m.tipo === "video");
    if (imgs.length === 0 && vids.length === 0 && !portadaFile && !cierreFile) {
        alert("Añade al menos una imagen o video a la pizarra.");
        return false;
    }
    if (imgs.length > lim.maxImg) {
        const msg = `Máximo ${lim.maxImg} imágenes en plan ${lim.etiqueta}. Elimina algunas${isPremium ? "." : " o suscríbete a Premium."}`;
        alert(msg);
        if (!isPremium) mostrarUpgrade(msg);
        return false;
    }
    if (!isPremium) {
        if (vids.length > lim.maxVid) {
            alert(`Máximo ${lim.maxVid} videos en plan gratuito. Elimina algunos o suscríbete a Premium.`);
            mostrarUpgrade(`Máximo ${lim.maxVid} videos en plan gratuito.`);
            return false;
        }
        if (audioDuracionEst > lim.maxSeg) {
            const msg = `Tu audio dura ${formatoDuracion(audioDuracionEst)} min. El plan gratuito permite de ${lim.minSeg} s a ${formatoDuracion(lim.maxSeg)} min. Usa un audio más corto o suscríbete a Premium para videos de hasta 1 hora.`;
            alert(msg);
            mostrarUpgrade(msg);
            return false;
        }
    } else if (audioDuracionEst > lim.maxSeg) {
        alert("El audio supera el máximo Premium de 1 hora.");
        return false;
    }
    return true;
}

window.verificarEstatusRenderizado = function () {
    if (window.renderInterval) clearInterval(window.renderInterval);
    const statusText = $("#status-text");
    const loadingBox = $("#loading-box");
    window.renderInterval = setInterval(async () => {
        try {
            const r = await fetchRailwayViaProxy("/status", { method: "GET" });
            if (!r.ok) return;
            const d = await r.json();
            const estado = String(d.status || "").toLowerCase();
            if (estado === "procesando") {
                if (statusText) statusText.textContent = `Renderizando: ${d.detalle || "..."}`;
            } else if (["listo", "success", "completed"].includes(estado)) {
                clearInterval(window.renderInterval);
                window.renderInterval = null;
                incrementarRenders();
                registrarMovimientoRender(movimientoPendienteRender);
                movimientoPendienteRender = 0;
                if (statusText) statusText.textContent = "¡Video listo! Descargando...";
                try {
                    await descargarVideoFinal();
                    finalizarRenderizadoExitoso();
                } catch (err) {
                    if (statusText) statusText.textContent = "Video listo pero falló la descarga: " + err.message;
                    if (loadingBox) loadingBox.style.display = "none";
                }
            } else if (estado === "error") {
                clearInterval(window.renderInterval);
                alert("Error: " + (d.detalle || "Motor detenido"));
                if (loadingBox) loadingBox.style.display = "none";
            }
        } catch (e) {
            console.error(e);
        }
    }, 4000);
};

window.generarVideo = async function () {
    if (!validarProyecto()) return;

    const loadingBox = $("#loading-box");
    const statusText = $("#status-text");
    if (loadingBox) loadingBox.style.display = "block";
    if (statusText) statusText.textContent = "Preparando archivos para subida...";

    try {
        const lista = mediaItems.map((item, index) => ({
            id: index,
            tipo: item.tipo,
            texto: item.texto,
            silenciado: item.silenciado,
            duracion: 5.0,
            movimiento: !!(item.tipo === "imagen" && item.movimiento),
            estilo_movimiento: item.estilo_movimiento || "zoom_in"
        }));
        const cuotaMov = aplicarCuotaMovimientoEnLista(lista);
        movimientoPendienteRender = cuotaMov.cobrados;
        if (cuotaMov.recortados > 0) {
            alert(`La cuota de movimiento de hoy es ${limiteMovimiento()} imágenes. ${cuotaMov.recortados} se renderizarán fijas. Mañana se reinicia, o activa Premium (30/día).`);
        }

        const subtitulosOn = $("#chk-subtitulos")?.checked;
        const letra = $("#letra-cancion")?.value || letraGuardada || "";

        const meta = {
            linea_tiempo: lista,
            leyenda_portada: $("#texto-portada")?.value || "",
            leyenda_cierre: $("#texto-cierre")?.value || "",
            letra_cancion: letra,
            letra_segmentos: letraSegmentos,
            letra_palabras: letraPalabras,
            subtitulos_activos: !!subtitulosOn,
            es_premium: isPremium,
            sin_marca_agua: !!(isPremium && $("#chk-sin-marca-agua")?.checked),
            escala_texto: obtenerEscalaTexto(),
            nombre_pista: nombrePistaParaVideo(),
            volumen_fondo: 0.24
        };

        if (statusText) statusText.textContent = "Optimizando imágenes y audio...";
        const archivos = await prepararArchivosRender({
            audio: rielVozFile || rielFondoFile,
            audioFondo: rielVozFile && rielFondoFile ? rielFondoFile : null,
            portada: portadaFile,
            cierre: cierreFile,
            mediaItems
        });

        const { respuesta, resultado } = await enviarRenderizadoPorPartes(
            meta,
            archivos,
            (msg) => { if (statusText) statusText.textContent = msg; }
        );
        const estado = String(resultado.status || "").toLowerCase();

        if (respuesta.ok && (estado === "procesando" || respuesta.status === 202)) {
            if (statusText) statusText.textContent = "¡Procesamiento iniciado en la nube!";
            window.verificarEstatusRenderizado();
        } else {
            throw new Error(resultado.detalle || resultado.error || "Respuesta inválida");
        }
    } catch (e) {
        const msg = mensajeErrorMotorRailway(0, e.message);
        alert("No se pudo iniciar el renderizado: " + msg);
        if (loadingBox) loadingBox.style.display = "none";
    }
};

function sincronizarAudioPrincipal() {
    audioFile = rielVozFile || rielFondoFile;
    audioDuracionEst = rielVozFile ? duracionRielVoz : duracionRielFondo;
}

function actualizarAvisoAudio(extra = "", riel = "fondo") {
    const st = riel === "voz" ? $("#status-audio-voz") : $("#status-audio");
    const file = riel === "voz" ? rielVozFile : rielFondoFile;
    const dur = riel === "voz" ? duracionRielVoz : duracionRielFondo;
    if (!st) return;
    if (!file) {
        st.style.color = "";
        st.textContent = riel === "voz"
            ? "Vacío — usa Voz IA o sube un speech"
            : "Vacío — sube un MP3 o genera MIDI";
        return;
    }
    const lim = limitesActuales();
    const seg = Math.ceil(dur);
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    let texto = `${file.name} (${seg}s · ${formatoDuracion(dur)} min · ${mb} MB)`;
    if (extra) texto += ` · ${extra}`;
    if (!isPremium && audioDuracionEst > lim.maxSeg) {
        texto += ` — supera el límite gratuito (${formatoDuracion(lim.maxSeg)} min)`;
        st.style.color = "#FF6B6B";
    } else if (isPremium && audioDuracionEst > lim.maxSeg) {
        texto += ` — supera el máximo Premium (1 h)`;
        st.style.color = "#FF6B6B";
    } else if (audioDuracionEst > 0 && audioDuracionEst < lim.minSeg) {
        texto += ` — mínimo ${lim.minSeg} s`;
        st.style.color = "#FF6B6B";
    } else {
        st.style.color = "";
    }
    st.textContent = texto;
}

async function cargarAudio(file, riel = "fondo") {
    const st = riel === "voz" ? $("#status-audio-voz") : $("#status-audio");
    if (st) {
        st.textContent = "Analizando audio...";
        st.style.color = "#00FFCC";
    }

    if (!esArchivoAudio(file)) {
        // Último recurso: cabecera MP3 con nombre/MIME raros.
        const esMp3 = await pareceMp3PorCabecera(file);
        if (!esMp3) {
            alert("El archivo no parece audio (MP3/WAV/M4A/OGG). Selecciona un MP3.");
            if (st) {
                st.textContent = "Archivo no reconocido como audio.";
                st.style.color = "#FF6B6B";
            }
            return;
        }
    }

    let finalFile = file;
    let notaConversion = "";
    const mbEntrada = (file.size / (1024 * 1024)).toFixed(1);

    // MP3/M4A/OGG: nunca reconvertir al cargar (evita archivos más pesados).
    let yaComprimido = esAudioYaComprimido(file);
    if (!yaComprimido && !esAudioSinComprimir(file)) {
        yaComprimido = await pareceMp3PorCabecera(file);
        if (yaComprimido && !/\.mp3$/i.test(file.name || "")) {
            finalFile = new File([file], `${nombreBaseSinExtension(file.name) || "pista"}.mp3`, {
                type: "audio/mpeg",
            });
            logAudioOk(`MP3 detectado por cabecera (${mbEntrada} MB) — se conserva sin reconvertir.`);
        }
    }

    if (yaComprimido || esAudioYaComprimido(finalFile)) {
        const mb = (finalFile.size / (1024 * 1024)).toFixed(1);
        notaConversion = finalFile.size > LIMITE_SUBIDA_NETLIFY
            ? `MP3 ${mb} MB — se comprimirá al renderizar si hace falta`
            : "";
        logAudioOk(`Audio cargado sin conversión (${finalFile.name}, ${mb} MB) — ya es MP3/comprimido.`);
    } else if (necesitaConversionMp3(file)) {
        if (st) st.textContent = `Convirtiendo ${file.name} (${mbEntrada} MB) a MP3...`;
        try {
            finalFile = await convertirAudioAMp3(file, 128);
            // Si la conversión engorda, intentar bitrate más bajo; si sigue peor, avisar.
            if (finalFile.size > file.size) {
                const liviano = await convertirAudioAMp3(file, 96);
                if (liviano.size < finalFile.size) finalFile = liviano;
            }
            if (finalFile.size > file.size * 1.05 && file.size > 0) {
                logAudioAviso(
                    `La conversión salió más pesada (${mbEntrada} → ${(finalFile.size / (1024 * 1024)).toFixed(1)} MB). Se mantiene el archivo original.`
                );
                finalFile = file;
                notaConversion = "se conservó el original (la conversión engordaba)";
            } else {
                const mbSalida = (finalFile.size / (1024 * 1024)).toFixed(1);
                notaConversion = `convertido de ${mbEntrada} MB a MP3 ${mbSalida} MB`;
                logAudioOk(`Audio convertido a MP3 (${mbEntrada} MB → ${mbSalida} MB).`);
            }
        } catch (e) {
            logAudioError(`Fallo al convertir ${file.name} a MP3`, e.message);
            alert("No se pudo convertir el audio a MP3: " + e.message);
            if (st) st.textContent = "Error al convertir audio.";
            st.style.color = "#FF6B6B";
            return;
        }
    } else {
        // Formato desconocido pero pasó esArchivoAudio: cargar tal cual.
        logAudioOk(`Audio cargado (${finalFile.name}, ${mbEntrada} MB) sin reconversión.`);
    }

    const dur = await estimarDuracionAudio(finalFile);
    if (riel === "voz") {
        rielVozFile = finalFile;
        duracionRielVoz = dur;
    } else {
        rielFondoFile = finalFile;
        duracionRielFondo = dur;
    }
    sincronizarAudioPrincipal();
    actualizarAvisoAudio(notaConversion, riel);
    rellenarNombrePistaSiVacio(sugerirNombrePista(finalFile, riel));
    const sec = $("#seccion-subtitulos");
    if (sec) sec.style.display = "block";
}

document.addEventListener("DOMContentLoaded", async () => {
    await ensureAccessToken();
    let premiumOk = false;
    if (window.EcosistemaCuenta) {
        try {
            const session = await window.EcosistemaCuenta.getSession();
            if (session) {
                const r = await verificarMembresiaDetalle();
                premiumOk = r.ok;
                if (r.ok) {
                    isPremium = true;
                    premiumMeta = { daysLeft: r.daysLeft, status: r.status, permanent: !!r.permanent };
                    if (r.legacy_code) localStorage.setItem("video_diamante_premium_code", r.legacy_code);
                }
            }
        } catch { /* ignore */ }
    }
    if (!premiumOk) {
        const codigo = localStorage.getItem("video_diamante_premium_code");
        if (codigo) {
            const r = await verificarMembresiaDetalle(codigo);
            isPremium = r.ok;
            if (r.ok) {
                premiumMeta = { daysLeft: r.daysLeft, status: r.status, permanent: !!r.permanent };
            } else {
                localStorage.removeItem("video_diamante_premium_code");
            }
        }
    }
    aplicarModoPremiumUI();
    actualizarIndicadorPlan();
    actualizarCuotaEstudio();
    actualizarPreviewTipografia();
    configurarTabsEstudio();

    $("#select-escala-texto")?.addEventListener("change", actualizarPreviewTipografia);

    $("#btn-generar-imagen")?.addEventListener("click", generarImagenIA);
    $("#btn-generar-letra")?.addEventListener("click", generarLetraIA);
    $("#btn-generar-midi")?.addEventListener("click", generarMidiEstudio);
    $("#btn-descargar-midi")?.addEventListener("click", descargarMidiEstudio);
    $("#btn-usar-midi-audio")?.addEventListener("click", usarMidiComoAudio);
    $("#btn-anadir-imagen-pizarra")?.addEventListener("click", () => {
        if (!imagenEstudioBlob) return;
        agregarMedioDesdeBlob(imagenEstudioBlob, `estudio-${Date.now()}.jpg`, "imagen", {
            movimiento: !!$("#chk-imagen-con-movimiento")?.checked,
            estilo_movimiento: estiloMovimientoActual()
        });
        $("#status-imagen-estudio").textContent = "Imagen añadida a la pizarra.";
    });
    $("#btn-usar-letra-subtitulos")?.addEventListener("click", usarLetraEnSubtitulos);
    $("#btn-pasar-discurso-a-voz")?.addEventListener("click", pasarDiscursoAVoz);
    $("#btn-generar-voz")?.addEventListener("click", generarVozIA);
    $("#btn-usar-voz-audio")?.addEventListener("click", usarVozComoAudio);
    $("#btn-generar-clip")?.addEventListener("click", generarClipIA);
    $("#btn-anadir-clip-pizarra")?.addEventListener("click", anadirClipAPizarra);

    $("#input-audio-real")?.addEventListener("change", (e) => {
        if (e.target.files[0]) cargarAudio(e.target.files[0], "fondo");
    });
    $("#input-audio-voz")?.addEventListener("change", (e) => {
        if (e.target.files[0]) cargarAudio(e.target.files[0], "voz");
    });
    $("#nombre-pista-video")?.addEventListener("input", () => {
        nombrePistaEditado = true;
    });
    configurarDragZone($("#zona-audio"), (files) => {
        const f = Array.from(files).find((x) => esArchivoAudio(x));
        if (f) cargarAudio(f, "fondo");
        else alert("Arrastra un MP3 o MIDI convertido para el riel de fondo.");
    });
    configurarDragZone($("#zona-audio-voz"), (files) => {
        const f = Array.from(files).find((x) => esArchivoAudio(x));
        if (f) cargarAudio(f, "voz");
        else alert("Arrastra un audio de locución al riel 1.");
    });

    $("#input-portada-img")?.addEventListener("change", (e) => {
        if (e.target.files[0]) {
            portadaFile = e.target.files[0];
            $("#status-portada-img").textContent = portadaFile.name;
        }
    });
    $("#input-cierre-img")?.addEventListener("change", (e) => {
        if (e.target.files[0]) {
            cierreFile = e.target.files[0];
            $("#status-cierre-img").textContent = cierreFile.name;
        }
    });

    $("#input-imagenes")?.addEventListener("change", (e) => agregarMedios(e.target.files, "imagen"));
    $("#input-videos")?.addEventListener("change", (e) => agregarMedios(e.target.files, "video"));
    $("#input-medios")?.addEventListener("change", (e) => agregarMedios(e.target.files, null));
    configurarDragZone($("#pizarra-secuencia"), (f) => agregarMedios(f, null));
    renderizarPizarras();

    $("#btn-transcribir")?.addEventListener("click", transcribirAudio);
    $("#btn-guardar-letra")?.addEventListener("click", () => {
        letraGuardada = $("#letra-cancion")?.value || "";
        const conservaSync = letraPalabras.length > 0;
        $("#status-transcripcion").textContent = conservaSync
            ? "Letra guardada — se conserva el sync de la transcripción. Si cambiaste mucho el texto, vuelve a transcribir."
            : "Letra guardada — se sincronizará por renglones con la pista.";
    });

    $("#btn-plan-mensual")?.addEventListener("click", () => iniciarStripe("mensual"));
    $("#btn-plan-anual")?.addEventListener("click", () => iniciarStripe("anual"));
    $("#btn-ya-soy-miembro")?.addEventListener("click", () => abrirModalPremium("codigo"));
    $("#plan-indicator")?.addEventListener("click", () => abrirModalPremium("codigo"));
    $("#btn-ingresar-codigo")?.addEventListener("click", activarConCodigoMiembro);
    $("#member-code-input")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") activarConCodigoMiembro();
    });
    $("#btn-cerrar-premium-modal")?.addEventListener("click", () => $("#premium-modal")?.close());
    $("#btn-guia-premium")?.addEventListener("click", () => $("#guia-premium-modal")?.showModal());
    $("#btn-asistente-ia")?.addEventListener("click", () => $("#asistente-premium-modal")?.showModal());
    $("#btn-gestionar-membresia")?.addEventListener("click", () => abrirModalPremium("codigo"));
    $("#btn-cerrar-sesion-premium")?.addEventListener("click", cerrarSesionPremium);
    $("#btn-enviar-asistente")?.addEventListener("click", enviarConsultaAsistente);
    $("#btn-cerrar-asistente")?.addEventListener("click", () => $("#asistente-premium-modal")?.close());
    $("#asistente-input")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviarConsultaAsistente();
        }
    });

    const stripeSessionCode = $("#stripe-session-code");
    const verificationStatus = $("#verification-status");
    const btnVerificarStripe = $("#btn-verificar-stripe");
    const premiumModal = $("#premium-modal");

    btnVerificarStripe?.addEventListener("click", async () => {
        const val = stripeSessionCode?.value.trim();
        if (!val) return alert("Ingresa el ID de sesión.");
        verificationStatus.textContent = "Consultando Stripe...";
        verificationStatus.style.color = "#D4AF37";
        try {
            const r = await fetch("/.netlify/functions/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transactionId: val, productoRequerido: "video_diamante_premium" })
            });
            const d = await r.json();
            if (r.ok && d.success) {
                isPremium = true;
                localStorage.setItem("video_diamante_premium_code", d.code || val);
                const vr = await verificarMembresiaDetalle(d.code || val);
                if (vr.ok) premiumMeta = { daysLeft: vr.daysLeft, status: vr.status, permanent: !!vr.permanent };
                verificationStatus.textContent = "¡Premium activado!";
                verificationStatus.style.color = "#00FF66";
                actualizarIndicadorPlan();
                actualizarAvisoAudio();
                mostrarBienvenidaPremium(true);
                premiumModal?.close();
                mostrarGraciasCompra();
            } else {
                const errMsg = [d.error, d.detalle].filter(Boolean).join(" — ") || "ID inválido";
                verificationStatus.textContent = errMsg;
                verificationStatus.style.color = "#FF3333";
                if (/sk_test_|sk_live_|STRIPE_SECRET/i.test(errMsg)) {
                    console.error("[Video Diamante] Config Stripe:", errMsg);
                }
            }
        } catch {
            verificationStatus.textContent = "Error de conexión";
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("payment_success") === "true" && urlParams.get("session_id")) {
        mostrarGraciasCompra();
        abrirModalPremium("stripe");
        if (stripeSessionCode) stripeSessionCode.value = urlParams.get("session_id");
        history.replaceState({}, "", window.location.pathname);
        setTimeout(() => btnVerificarStripe?.click(), 1500);
    } else if (urlParams.get("payment_cancelled") === "true") {
        alert("Pago cancelado.");
        history.replaceState({}, "", window.location.pathname);
    }
});

const botonDisparador = document.querySelector(".btn-disparador-motor");
if (botonDisparador) botonDisparador.addEventListener("click", window.generarVideo);
