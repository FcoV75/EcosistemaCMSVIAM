const RAILWAY_API = "https://ecosistemacmsviam-production.up.railway.app";

async function fetchRailway(endpoint, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }
    return fetch(`${RAILWAY_API}${endpoint}`, {
        ...options,
        headers,
        mode: "cors",
        credentials: "omit"
    });
}

let audioFile = audioFile || null;
let selectedImages = selectedImages || [];

const statusText = document.getElementById("status-text");

async function generarVideo() {
    // Validamos que existan los archivos obligatorios
    if (!audioFile) {
        alert("Por favor, selecciona un archivo de audio primero.");
        return;
    }
    if (selectedImages.length === 0) {
        alert("Por favor, selecciona al menos una imagen para el video.");
        return;
    }

    // Cambiamos el estado visual de la barra de carga en tu página diamante
    statusText.innerText = "Iniciando proceso de renderizado en la nube...";
    document.getElementById("loading-box").style.display = "block";

    // 2. Empaquetamos todo en el contenedor de datos para el envío
    const formData = new FormData();
    formData.append("audio", audioFile);

    // Inicializamos la lista de control de la línea de tiempo para evitar errores
    const listaLineaTiempo = [];

    // Recorremos tus imágenes seleccionadas reales para extraer subtítulos y adjuntar binarios
    selectedImages.forEach((img, index) => {
        // Buscamos las celdas visuales activas en la pantalla para extraer su subtítulo exacto
        const celdasVisuales = document.querySelectorAll('.celda-imagen');
        let textoSubtitulo = "";
        
        if (celdasVisuales && celdasVisuales[index]) {
            const inputSub = celdasVisuales[index].querySelector('.input-subtitulo');
            if (inputSub) {
                textoSubtitulo = inputSub.value;
            }
        }

        // Creamos el diccionario estructurado que Python procesará de forma limpia
        listaLineaTiempo.push({
            id: index,
            texto: textoSubtitulo,
            duracion: 5.0
        });

        // Adjuntamos el archivo binario real de la imagen emparejado con su índice
        formData.append(`imagen_${index}`, img);
    });
    
    // Convertimos la estructura de control a texto JSON para que Python no tire error de índices
    formData.append("linea_tiempo", JSON.stringify(listaLineaTiempo));

    // Capturamos las leyendas opcionales de los extremos si es que existen en tu panel
    const txtPortada = document.getElementById("texto-portada");
    const txtCierre = document.getElementById("texto-cierre");
    formData.append("leyenda_portada", txtPortada ? txtPortada.value : "");
    formData.append("leyenda_cierre", txtCierre ? txtCierre.value : "");

    try {
        // 3. Hacemos la petición inicial al backend de Railway
        statusText.innerText = "Transmitiendo datos al servidor de VIAM...";
        const respuesta = await fetchRailway("/renderizar", {
            method: "POST",
            body: formData
        });

        const datos = await respuesta.json();

        // ¡EL FILTRO DE PRODUCCIÓN! Si el servidor responde 200 o 202, avanzamos al monitoreo
        if (respuesta.status === 200 || respuesta.status === 202) {
            statusText.innerText = "Proyecto recibido con éxito. Procesando audio, imágenes y subtítulos en segundo plano...";
            
            // 4. Activamos el bucle asincrónico para revisar el estatus real en Railway
            verificarEstatusRenderizado();
        } else {
            statusText.innerText = "Error al arrancar el motor: " + (datos.detalle || "Error desconocido");
            alert("El motor de renderizado reportó un problema: " + (datos.detalle || "Error de configuración"));
            document.getElementById("loading-box").style.display = "none";
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        statusText.innerText = "Sincronizando con el canal de renderizado de fondo...";
        // Por seguridad en peticiones pesadas asíncronas, si entró pero tardó en responder, activamos el bucle
        verificarEstatusRenderizado();
    }
}

// Esta función pregunta en bucle cerrado a Railway cómo va el procesamiento del video
function verificarEstatusRenderizado() {
    // Si ya existía un intervalo colgado de pruebas anteriores, lo limpiamos para no saturar la red
    if (window.renderInterval) {
        clearInterval(window.renderInterval);
    }

    // Bajamos el intervalo a 4 segundos para que sea mucho más ágil y reactiva la respuesta
    window.renderInterval = setInterval(async () => {
        try {
            const respuesta = await fetchRailway("/status");
            const datos = await respuesta.json();
            const estado = String(datos.status || "").toLowerCase();

            console.log("Estatus actual del renderizado:", estado);

            if (estado === "procesando") {
                statusText.innerText = `Renderizando: ${datos.detalle || 'Compilando transiciones fluidas y subtítulos...'}`;
            }
            else if (estado === "listo" || estado === "success" || estado === "completed") {
                clearInterval(window.renderInterval);
                statusText.innerText = "¡Video Diamante procesado con éxito! Iniciando descarga nativa...";
                window.location.href = `${RAILWAY_API}/descargar`;
                setTimeout(() => {
                    document.getElementById("loading-box").style.display = "none";
                }, 5000);
            }
            else if (estado === "error") {
                clearInterval(window.renderInterval);
                statusText.innerText = `Error en el renderizador: ${datos.detalle}`;
                alert("El motor de renderizado de fondo se detuvo: " + datos.detalle);
                document.getElementById("loading-box").style.display = "none";
            }
        } catch (error) {
            console.error("Error consultando el estatus:", error);
            statusText.innerText = "Sincronizando con el servidor de fondo de VIAM...";
        }
    }, 4000); 
}
