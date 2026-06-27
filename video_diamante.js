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

const $ = (sel) => document.querySelector(sel);

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

async function enviarRenderizado(formData) {
    try {
        const r = await fetchRailway("/renderizar", { method: "POST", body: formData });
        if (r.ok || r.status === 202) return r;
    } catch (e) {
        console.warn("Proxy Netlify por fallo directo:", e.message);
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

async function transcribirConGroq(audio) {
    const fd = new FormData();
    fd.append("audio", audio);

    let r;
    try {
        r = await fetchRailway("/transcribir", { method: "POST", body: fd });
    } catch (e) {
        console.warn("Railway transcribir no disponible:", e.message);
        r = null;
    }

    if (r) {
        const d = await parseJsonSeguro(r);
        if (r.ok && d.texto) return d;
        const err = String(d.error || d.detalle || "");
        if (!err.includes("GROQ") && r.ok) {
            throw new Error(err || "Transcripción fallida");
        }
        console.warn("Railway transcribir falló, probando Netlify:", err);
    }

    const fdNetlify = new FormData();
    fdNetlify.append("audio", audio);
    const r2 = await fetch("/.netlify/functions/transcribe-audio", { method: "POST", body: fdNetlify });
    const d2 = await parseJsonSeguro(r2);
    if (r2.ok && d2.texto) return d2;
    throw new Error(d2.error || d2.detalle || "Transcripción fallida");
}

async function transcribirAudio() {
    if (!audioFile) { alert("Carga audio primero."); return; }
    const btn = $("#btn-transcribir");
    const area = $("#letra-cancion");
    const status = $("#status-transcripcion");
    if (btn) { btn.disabled = true; btn.textContent = "IA escuchando..."; }
    if (status) status.textContent = "Transcribiendo con IA (español estricto)...";
    try {
        const d = await transcribirConGroq(audioFile);
        if (area) area.value = d.texto;
        letraGuardada = d.texto;
        letraSegmentos = Array.isArray(d.segmentos) ? d.segmentos : [];
        letraPalabras = Array.isArray(d.palabras) ? d.palabras : [];
        if (status) status.textContent = "Letra lista — edítala y pulsa Guardar.";
    } catch (e) {
        if (status) status.textContent = "Error: " + e.message;
        alert("No se pudo transcribir: " + e.message);
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
    if (statusText) statusText.textContent = "Enviando proyecto a Railway...";

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

        const formData = new FormData();
        formData.append("audio", audioFile);
        formData.append("linea_tiempo", JSON.stringify(lista));
        formData.append("leyenda_portada", $("#texto-portada")?.value || "");
        formData.append("leyenda_cierre", $("#texto-cierre")?.value || "");
        formData.append("letra_cancion", letra);
        formData.append("letra_segmentos", JSON.stringify(letraSegmentos));
        formData.append("letra_palabras", JSON.stringify(letraPalabras));
        formData.append("subtitulos_activos", subtitulosOn ? "true" : "false");
        formData.append("nombre_pista", audioFile ? audioFile.name.replace(/\.[^.]+$/, "") : "Pista VIAM");

        if (portadaFile) formData.append("portada_file", portadaFile);
        if (cierreFile) formData.append("cierre_file", cierreFile);

        mediaItems.forEach((item, index) => {
            const key = item.tipo === "video" ? `video_${index}` : `imagen_${index}`;
            formData.append(key, item.file);
        });

        const respuesta = await enviarRenderizado(formData);
        const resultado = await parseJsonSeguro(respuesta);
        const estado = String(resultado.status || "").toLowerCase();

        if (respuesta.ok && (estado === "procesando" || respuesta.status === 202)) {
            if (statusText) statusText.textContent = "¡Procesamiento iniciado en la nube!";
            window.verificarEstatusRenderizado();
        } else {
            throw new Error(resultado.detalle || resultado.error || "Respuesta inválida");
        }
    } catch (e) {
        alert("No se pudo iniciar el renderizado: " + e.message);
        if (loadingBox) loadingBox.style.display = "none";
    }
};

function actualizarAvisoAudio() {
    const st = $("#status-audio");
    if (!st || !audioFile) return;
    const lim = limitesActuales();
    const seg = Math.ceil(audioDuracionEst);
    let texto = `🎵 ${audioFile.name} (${seg}s · ${formatoDuracion(audioDuracionEst)} min)`;
    if (!isPremium && audioDuracionEst > lim.maxSeg) {
        texto += ` — supera el límite gratuito (${formatoDuracion(lim.maxSeg)} min)`;
        st.style.color = "#FF6B6B";
    } else {
        st.style.color = "";
    }
    st.textContent = texto;
}

async function cargarAudio(file) {
    audioFile = file;
    audioDuracionEst = await estimarDuracionAudio(file);
    actualizarAvisoAudio();
    const sec = $("#seccion-subtitulos");
    if (sec) sec.style.display = "block";
}

document.addEventListener("DOMContentLoaded", async () => {
    const codigo = localStorage.getItem("video_diamante_premium_code");
    if (codigo) isPremium = await verificarMembresia(codigo);
    actualizarIndicadorPlan();

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
