/* Video Diamante — Motor VIAM v2 */
const RAILWAY_API = "https://ecosistemacmsviam-production.up.railway.app";

const LIMITES = {
    gratuito: { maxSeg: 240, maxImg: 3, maxVid: 2, maxDia: 3, minSeg: 0, etiqueta: "Gratuito" },
    premium: { maxSeg: 3600, maxImg: 99, maxVid: 99, maxDia: 10, minSeg: 300, etiqueta: "Premium" }
};

let isPremium = false;
let audioFile = null;
let audioDuracionEst = 0;
let portadaFile = null;
let cierreFile = null;
let mediaItems = [];
let objectUrls = [];
let letraGuardada = "";
let letraSegmentos = [];
let letraPalabras = [];
let imagenEstudioBlob = null;
let letraEstudioGenerada = "";

const LIMITES_ESTUDIO = { gratuito: 5, premium: 20 };

const $ = (sel) => document.querySelector(sel);

function estudioGensHoy() {
    return parseInt(localStorage.getItem(`vd_estudio_${hoyKey()}`) || "0", 10);
}

function incrementarEstudioGens() {
    localStorage.setItem(`vd_estudio_${hoyKey()}`, String(estudioGensHoy() + 1));
    actualizarCuotaEstudio();
}

function limiteEstudio() {
    return isPremium ? LIMITES_ESTUDIO.premium : LIMITES_ESTUDIO.gratuito;
}

function actualizarCuotaEstudio() {
    const el = $("#status-estudio-cuota");
    if (!el) return;
    const max = limiteEstudio();
    const rest = Math.max(0, max - estudioGensHoy());
    el.textContent = `Generaciones IA hoy: ${rest}/${max} disponibles`;
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
    try {
        const r = await fetchRailway(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const d = await parseJsonSeguro(r);
        if (r.ok && (d.success || d.letra || d.imagen_base64)) return { ok: true, data: d };
    } catch (e) {
        console.warn("Estudio Railway:", e.message);
    }
    const fn = endpoint.includes("letra") ? "estudio-letra" : "estudio-imagen";
    const r2 = await fetch(`/.netlify/functions/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const d2 = await parseJsonSeguro(r2);
    return { ok: r2.ok, data: d2 };
}

function puedeUsarEstudio() {
    if (estudioGensHoy() >= limiteEstudio()) {
        mostrarUpgrade(`Alcanzaste el límite de ${limiteEstudio()} generaciones IA por día.`);
        return false;
    }
    return true;
}

function agregarMedioDesdeBlob(blob, nombre, tipoForzado) {
    const file = new File([blob], nombre || "estudio-viam.jpg", { type: blob.type || "image/jpeg" });
    agregarMedios([file], tipoForzado || "imagen");
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

        incrementarEstudioGens();
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
        if (status) status.textContent = `Imagen lista (${d.fuente || "IA"}) — añádela a la pizarra o genera otra.`;
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
    if (!tema) { alert("Indica el tema de la canción."); return; }

    const btn = $("#btn-generar-letra");
    const status = $("#status-letra-estudio");
    const preview = $("#preview-letra-estudio");
    const btnUsar = $("#btn-usar-letra-subtitulos");
    const genero = $("#estudio-genero")?.value || "pop";
    const mood = $("#estudio-mood")?.value || "romántico";

    if (btn) { btn.disabled = true; btn.textContent = "Componiendo letra..."; }
    if (status) status.textContent = "La IA está escribiendo tu canción...";

    try {
        const { ok, data: d } = await fetchEstudio("/estudio/letra", { tema, genero, mood });
        if (!ok || !d.letra) throw new Error(d.error || "No se pudo generar la letra.");

        incrementarEstudioGens();
        letraEstudioGenerada = d.letra;
        const txt = $("#texto-preview-letra");
        if (txt) txt.textContent = letraEstudioGenerada;
        if (preview) preview.style.display = "block";
        if (btnUsar) btnUsar.style.display = "inline-block";
        if (status) status.textContent = `Letra lista (${d.modelo || "IA"}) — úsala en subtítulos o edítala abajo.`;
    } catch (e) {
        if (status) status.textContent = "Error: " + e.message;
        alert("Error generando letra: " + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "✨ Generar letra"; }
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
    $("#status-transcripcion").textContent = "Letra del Estudio VIAM cargada — se sincronizará por renglones al renderizar.";
    $("#status-letra-estudio").textContent = "Letra aplicada a subtítulos.";
}

function configurarTabsEstudio() {
    document.querySelectorAll(".tab-estudio").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab-estudio").forEach((t) => t.classList.remove("activo"));
            document.querySelectorAll(".panel-estudio").forEach((p) => p.classList.remove("activo"));
            tab.classList.add("activo");
            const id = tab.dataset.tab;
            const panel = id === "imagen" ? $("#panel-estudio-imagen") : $("#panel-estudio-letra");
            if (panel) panel.classList.add("activo");
        });
    });
}

async function fetchRailway(endpoint, options = {}) {
    const isFormData = options.body instanceof FormData;
    if (isFormData) {
        return fetch(`${RAILWAY_API}${endpoint}`, {
            method: options.method || "POST",
            body: options.body,
            mode: "cors",
            credentials: "omit"
        });
    }
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body) headers["Content-Type"] = "application/json";
    return fetch(`${RAILWAY_API}${endpoint}`, { ...options, headers, mode: "cors", credentials: "omit" });
}

async function fetchRailwayViaProxy(endpoint, options = {}) {
    const proxyUrl = `/.netlify/functions/railway-path-proxy?path=${encodeURIComponent(endpoint)}`;
    const isFormData = options.body instanceof FormData;
    if (isFormData) {
        return fetch(proxyUrl, { method: options.method || "POST", body: options.body });
    }
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body) headers["Content-Type"] = "application/json";
    return fetch(proxyUrl, {
        method: options.method || "POST",
        headers,
        body: options.body
    });
}

function mensajeErrorMotorRailway(status, detalle) {
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
        const r = await fetchRailwayViaProxy("/health", { method: "GET" });
        if (r.ok) return true;
        const d = await r.json().catch(() => ({}));
        console.warn("Health Railway:", d.message || r.status);
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
    } catch (e) {
        if (/Motor Railway|No hay conexión/i.test(e.message)) throw e;
        console.warn(`Proxy ${endpoint} no disponible:`, e.message);
    }
    try {
        const r2 = await fetchRailway(endpoint, options);
        if (r2.ok || r2.status === 202) return r2;
        const d2 = await r2.json().catch(() => ({}));
        if (r2.status === 502 || r2.status === 503) {
            throw new Error(mensajeErrorMotorRailway(r2.status, d2.message || d2.detalle));
        }
        return r2;
    } catch (e) {
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
    const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    console.info(`Imagen optimizada: ${(file.size / 1024).toFixed(0)} KB → ${(blob.size / 1024).toFixed(0)} KB`);
    return new File([blob], nombre, { type: "image/jpeg" });
}

async function prepararArchivosRender({ audio, portada, cierre, mediaItems }) {
    const archivos = [];
    if (audio) archivos.push({ campo: "audio", file: audio, etiqueta: audio.name });
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
        const file = item.tipo === "imagen" ? await comprimirImagenParaRender(item.file) : item.file;
        archivos.push({ campo, file, etiqueta: file.name });
    }
    return archivos;
}

async function subirArchivoRenderSesion(uploadId, campo, file) {
    const fd = new FormData();
    fd.append("upload_id", uploadId);
    fd.append("campo", campo);
    fd.append("archivo", file, file.name || campo);
    const r = await fetchRailwayPreferProxy("/renderizar/subir", { method: "POST", body: fd });
    const d = await parseJsonSeguro(r);
    if (!r.ok || !d.success) throw new Error(d.error || d.detalle || "Fallo al subir " + campo);
    return d;
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
    try {
        const r = await fetchRailwayViaProxy("/renderizar", { method: "POST", body: formData });
        if (r.ok || r.status === 202) return r;
    } catch (e) {
        console.warn("Proxy render monolítico:", e.message);
    }
    try {
        const r = await fetchRailway("/renderizar", { method: "POST", body: formData });
        if (r.ok || r.status === 202) return r;
    } catch (e) {
        console.warn("Railway render directo:", e.message);
    }
    return fetch("/.netlify/functions/render-proxy", { method: "POST", body: formData });
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
    const r = await fetchRailway("/descargar");
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
        el.textContent = `💎 Plan Premium — ${restantes} renders hoy (máx. ${lim.maxDia})`;
        el.style.color = "#FFFD00";
    } else {
        el.textContent = `🆓 Plan Gratuito — ${restantes}/${lim.maxDia} renders hoy · máx. 4 min`;
        el.style.color = "#D4AF37";
    }
}

async function verificarMembresia(codigo) {
    if (!codigo) return false;
    try {
        const r = await fetch("/.netlify/functions/member-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: codigo.toUpperCase(), productoRequerido: "video_diamante_premium" })
        });
        const d = await r.json();
        return r.ok && ["active", "warning", "last_day"].includes(d.status);
    } catch {
        return false;
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

function agregarMedios(files, tipoForzado) {
    const lim = limitesActuales();

    Array.from(files).forEach((file) => {
        const esVideo = tipoForzado === "video" || (tipoForzado !== "imagen" && file.type.startsWith("video/"));
        const esImagen = tipoForzado === "imagen" || (tipoForzado !== "video" && file.type.startsWith("image/"));
        if (!esVideo && !esImagen) return;

        const imgsActuales = mediaItems.filter((m) => m.tipo === "imagen").length;
        const vidsActuales = mediaItems.filter((m) => m.tipo === "video").length;

        if (!isPremium && esImagen && imgsActuales >= lim.maxImg) {
            mostrarUpgrade("Límite de imágenes alcanzado en plan gratuito (3).");
            return;
        }
        if (!isPremium && esVideo && vidsActuales >= lim.maxVid) {
            mostrarUpgrade("Límite de videos alcanzado en plan gratuito (2).");
            return;
        }

        mediaItems.push({
            id: Date.now() + Math.random(),
            tipo: esVideo ? "video" : "imagen",
            file,
            texto: "",
            silenciado: true
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

        celda.innerHTML = `
            <span class="tipo-badge">${badge}<span class="orden-badge">#${index + 1}</span></span>
            <span class="arrastrar-hint">⠿ Arrastrar para reordenar</span>
            ${preview}
            <input type="text" class="input-subtitulo input-texto-premium" data-index="${index}" placeholder="Texto para esta escena..." value="${item.texto.replace(/"/g, "&quot;")}">
            ${muteHtml}
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
        const r = await fetch("/.netlify/functions/create-checkout-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
    if (/internal error/i.test(m)) {
        return "El proveedor de IA respondió con error interno. Espera unos segundos e intenta de nuevo. Si persiste, verifica que GROQ_API_KEY esté activa en Railway y Netlify.";
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

function nombreBaseSinExtension(nombre) {
    return String(nombre || "pista").replace(/\.[^.]+$/, "");
}

function necesitaConversionMp3(file) {
    const ext = (file.name || "").split(".").pop().toLowerCase();
    if (["wav", "wave", "aiff", "aif", "flac"].includes(ext)) return true;
    if (file.size > 8 * 1024 * 1024) return true;
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

async function convertirAudioAMp3(file, kbps = 128) {
    if (typeof lamejs === "undefined" || !lamejs.Mp3Encoder) {
        throw new Error("Motor MP3 no cargado. Recarga la página (Ctrl+F5).");
    }
    const audioBuffer = await decodificarArchivoAudio(file);
    const sampleRate = 44100;
    const canales = audioBuffer.numberOfChannels >= 2 ? 2 : 1;
    const offline = new OfflineAudioContext(
        canales,
        Math.max(1, Math.ceil(audioBuffer.duration * sampleRate)),
        sampleRate
    );
    const src = offline.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();

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

    const blob = new Blob(mp3Chunks, { type: "audio/mpeg" });
    return new File([blob], `${nombreBaseSinExtension(file.name)}.mp3`, { type: "audio/mpeg" });
}

function escribirCadenaWav(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function codificarWavMono16(samples, sampleRate) {
    const numSamples = samples.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    escribirCadenaWav(view, 0, "RIFF");
    view.setUint32(4, 36 + numSamples * 2, true);
    escribirCadenaWav(view, 8, "WAVE");
    escribirCadenaWav(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    escribirCadenaWav(view, 36, "data");
    view.setUint32(40, numSamples * 2, true);
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
    }
    return buffer;
}

async function comprimirAudioParaIA(file) {
    const esComprimido = /\.(mp3|m4a|ogg|webm)$/i.test(file.name || "");
    if (esComprimido && file.size <= 4 * 1024 * 1024) return file;

    const audioBuffer = await decodificarArchivoAudio(file);

    const targetRate = 16000;
    const offline = new OfflineAudioContext(
        1,
        Math.max(1, Math.ceil(audioBuffer.duration * targetRate)),
        targetRate
    );
    const src = offline.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    const wavBuffer = codificarWavMono16(rendered.getChannelData(0), targetRate);
    const mb = (wavBuffer.byteLength / (1024 * 1024)).toFixed(1);
    console.info(`Audio preparado para IA: ${mb} MB mono 16 kHz`);
    return new File([wavBuffer], "transcribe_16k.wav", { type: "audio/wav" });
}

async function transcribirConGroq(audioFile) {
    const audio = await comprimirAudioParaIA(audioFile);

    const crearFormData = () => {
        const fd = new FormData();
        fd.append("audio", audio, audio.name || "transcribe_16k.wav");
        return fd;
    };

    const intentos = [
        {
            nombre: "proxy",
            fn: () => fetch("/.netlify/functions/transcribe-proxy", { method: "POST", body: crearFormData() })
        },
        {
            nombre: "netlify-groq",
            fn: () => fetch("/.netlify/functions/transcribe-audio", { method: "POST", body: crearFormData() })
        },
        {
            nombre: "railway",
            fn: () => fetchRailway("/transcribir", { method: "POST", body: crearFormData() })
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
    if (!audioFile) { alert("Carga audio primero."); return; }
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
            status.textContent = letraPalabras.length
                ? `Letra lista (${letraPalabras.length} palabras sincronizadas) — edítala y pulsa Guardar.`
                : "Letra lista — edítala y pulsa Guardar.";
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
        mostrarUpgrade(`Alcanzaste el límite de ${lim.maxDia} videos por día.`);
        return false;
    }
    if (!audioFile) { alert("Selecciona o arrastra un archivo de audio."); return false; }

    const imgs = mediaItems.filter((m) => m.tipo === "imagen");
    const vids = mediaItems.filter((m) => m.tipo === "video");
    if (imgs.length === 0 && vids.length === 0 && !portadaFile && !cierreFile) {
        alert("Añade al menos una imagen o video a la pizarra.");
        return false;
    }
    if (!isPremium) {
        if (imgs.length > lim.maxImg) {
            alert("Máximo 3 imágenes en plan gratuito. Elimina algunas o suscríbete a Premium.");
            mostrarUpgrade("Máximo 3 imágenes en plan gratuito.");
            return false;
        }
        if (vids.length > lim.maxVid) {
            alert("Máximo 2 videos en plan gratuito. Elimina algunos o suscríbete a Premium.");
            mostrarUpgrade("Máximo 2 videos en plan gratuito.");
            return false;
        }
        if (audioDuracionEst > lim.maxSeg) {
            const msg = `Tu audio dura ${formatoDuracion(audioDuracionEst)} min. El plan gratuito permite hasta ${formatoDuracion(lim.maxSeg)} min. Usa un audio más corto o suscríbete a Premium para videos largos.`;
            alert(msg);
            mostrarUpgrade(msg);
            return false;
        }
    } else {
        if (audioDuracionEst > 0 && audioDuracionEst < lim.minSeg) {
            alert("En Premium el video debe ser de al menos 5 minutos.");
            return false;
        }
        if (audioDuracionEst > lim.maxSeg) {
            alert("El audio supera el máximo de 1 hora.");
            return false;
        }
    }
    return true;
}

window.verificarEstatusRenderizado = function () {
    if (window.renderInterval) clearInterval(window.renderInterval);
    const statusText = $("#status-text");
    const loadingBox = $("#loading-box");
    window.renderInterval = setInterval(async () => {
        try {
            const r = await fetchRailway("/status");
            if (!r.ok) return;
            const d = await r.json();
            const estado = String(d.status || "").toLowerCase();
            if (estado === "procesando") {
                if (statusText) statusText.textContent = `Renderizando: ${d.detalle || "..."}`;
            } else if (["listo", "success", "completed"].includes(estado)) {
                clearInterval(window.renderInterval);
                window.renderInterval = null;
                incrementarRenders();
                if (statusText) statusText.textContent = "¡Video listo! Descargando...";
                try {
                    await descargarVideoFinal();
                    finalizarRenderizadoExitoso();
                } catch (err) {
                    if (statusText) statusText.textContent = "Video listo. Abriendo descarga alternativa...";
                    window.location.href = `${RAILWAY_API}/descargar`;
                    setTimeout(finalizarRenderizadoExitoso, 3000);
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
            duracion: 5.0
        }));

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
            nombre_pista: audioFile ? audioFile.name.replace(/\.[^.]+$/, "") : "Pista VIAM"
        };

        if (statusText) statusText.textContent = "Optimizando imágenes y audio...";
        const archivos = await prepararArchivosRender({
            audio: audioFile,
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

function actualizarAvisoAudio(extra = "") {
    const st = $("#status-audio");
    if (!st || !audioFile) return;
    const lim = limitesActuales();
    const seg = Math.ceil(audioDuracionEst);
    const mb = (audioFile.size / (1024 * 1024)).toFixed(1);
    let texto = `🎵 ${audioFile.name} (${seg}s · ${formatoDuracion(audioDuracionEst)} min · ${mb} MB)`;
    if (extra) texto += ` · ${extra}`;
    if (!isPremium && audioDuracionEst > lim.maxSeg) {
        texto += ` — supera el límite gratuito (${formatoDuracion(lim.maxSeg)} min)`;
        st.style.color = "#FF6B6B";
    } else {
        st.style.color = "";
    }
    st.textContent = texto;
}

async function cargarAudio(file) {
    const st = $("#status-audio");
    if (st) {
        st.textContent = "Analizando audio...";
        st.style.color = "#00FFCC";
    }

    let finalFile = file;
    let notaConversion = "";

    if (necesitaConversionMp3(file)) {
        const mbEntrada = (file.size / (1024 * 1024)).toFixed(1);
        if (st) st.textContent = `Convirtiendo ${file.name} (${mbEntrada} MB) a MP3...`;
        try {
            finalFile = await convertirAudioAMp3(file);
            const mbSalida = (finalFile.size / (1024 * 1024)).toFixed(1);
            notaConversion = `convertido de ${mbEntrada} MB a MP3 ${mbSalida} MB`;
            console.info(`WAV/audio pesado → MP3: ${mbEntrada} MB → ${mbSalida} MB`);
        } catch (e) {
            alert("No se pudo convertir el audio a MP3: " + e.message);
            if (st) st.textContent = "Error al convertir audio.";
            st.style.color = "#FF6B6B";
            return;
        }
    }

    audioFile = finalFile;
    audioDuracionEst = await estimarDuracionAudio(finalFile);
    actualizarAvisoAudio(notaConversion);
    const sec = $("#seccion-subtitulos");
    if (sec) sec.style.display = "block";
}

document.addEventListener("DOMContentLoaded", async () => {
    const codigo = localStorage.getItem("video_diamante_premium_code");
    if (codigo) isPremium = await verificarMembresia(codigo);
    actualizarIndicadorPlan();
    actualizarCuotaEstudio();
    actualizarPreviewTipografia();
    configurarTabsEstudio();

    $("#select-escala-texto")?.addEventListener("change", actualizarPreviewTipografia);

    $("#btn-generar-imagen")?.addEventListener("click", generarImagenIA);
    $("#btn-generar-letra")?.addEventListener("click", generarLetraIA);
    $("#btn-anadir-imagen-pizarra")?.addEventListener("click", () => {
        if (!imagenEstudioBlob) return;
        agregarMedioDesdeBlob(imagenEstudioBlob, `estudio-${Date.now()}.jpg`, "imagen");
        $("#status-imagen-estudio").textContent = "Imagen añadida a la pizarra.";
    });
    $("#btn-usar-letra-subtitulos")?.addEventListener("click", usarLetraEnSubtitulos);

    $("#input-audio-real")?.addEventListener("change", (e) => {
        if (e.target.files[0]) cargarAudio(e.target.files[0]);
    });
    configurarDragZone($("#zona-audio"), (files) => {
        const f = Array.from(files).find((x) => x.type.startsWith("audio/"));
        if (f) cargarAudio(f);
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
        letraSegmentos = [];
        letraPalabras = [];
        $("#status-transcripcion").textContent = "Letra guardada — se sincronizará por renglones con la pista.";
    });

    $("#btn-plan-mensual")?.addEventListener("click", () => iniciarStripe("mensual"));
    $("#btn-plan-anual")?.addEventListener("click", () => iniciarStripe("anual"));

    const stripeSessionCode = $("#stripe-session-code");
    const verificationStatus = $("#verification-status");
    const btnVerificarStripe = $("#btn-verificar-stripe");
    const premiumModal = $("#premium-modal");

    btnVerificarStripe?.addEventListener("click", async () => {
        const val = stripeSessionCode?.value.trim();
        if (!val) return alert("Ingresa el ID de sesión.");
        verificationStatus.textContent = "Verificando...";
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
                verificationStatus.textContent = "¡Premium activado!";
                verificationStatus.style.color = "#00FF66";
                actualizarIndicadorPlan();
                actualizarAvisoAudio();
                premiumModal?.close();
                mostrarGraciasCompra();
            } else {
                verificationStatus.textContent = d.error || "ID inválido";
                verificationStatus.style.color = "#FF3333";
            }
        } catch {
            verificationStatus.textContent = "Error de conexión";
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("payment_success") === "true" && urlParams.get("session_id")) {
        mostrarGraciasCompra();
        premiumModal?.showModal();
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
