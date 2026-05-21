<script>
// 1. Declaración de variables globales (Aseguran que el script recuerde tus archivos)
let audioFile = audioFile || null;
let selectedImages = selectedImages || [];

// Capturamos el contenedor de estatus de tu propia interfaz para actualizar los mensajes
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
    
    // Añadimos las imágenes seleccionadas
    selectedImages.forEach((img, index) => {
        formData.append(`imagen_${index}`, img);
    });

    try {
        // 3. Hacemos la petición inicial (El servidor de Railway responderá de inmediato para evitar el 502)
        const respuesta = await fetch("https://ecosistemacmsviam-production.up.railway.app/renderizar", {
            method: "POST",
            body: formData
        });

        const datos = await respuesta.json();

        if (respuesta.status === 200 || respuesta.status === 202) {
            statusText.innerText = "Procesando audio, imágenes y subtítulos en segundo plano... Espere por favor.";
            // 4. Activamos el reloj para revisar el estatus de la renderización cada 10 segundos
            verificarEstatusRenderizado();
        } else {
            statusText.innerText = "Error al arrancar el motor: " + (datos.detalle || "Error desconocido");
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        statusText.innerText = "Error crítico de comunicación con el servidor de renderizado de VIAM.";
    }
}

// Esta función pregunta en bucle cerrado a Railway cómo va el procesamiento del video
function verificarEstatusRenderizado() {
    const intervalo = setInterval(async () => {
        try {
            const respuesta = await fetch("https://ecosistemacmsviam-production.up.railway.app/status");
            const datos = await respuesta.json();

            console.log("Estatus actual del renderizado:", datos.status);

            if (datos.status === "procesando") {
                // Sigue trabajando el hilo en segundo plano, mantenemos al usuario informado
                statusText.innerText = `Renderizando: ${datos.detalle}`;
            } 
            else if (datos.status === "listo") {
                // ¡Éxito absoluto! Rompemos el bucle y disparamos la descarga nativa del archivo final
                clearInterval(intervalo);
                statusText.innerText = "¡Video Diamante procesado con éxito! Iniciando descarga...";
                
                // Redirecciona al usuario al archivo final generado de forma gratuita
                window.location.href = "https://ecosistemacmsviam-production.up.railway.app/descargar";
                
                // Ocultamos la caja de carga después de unos segundos
                setTimeout(() => {
                    document.getElementById("loading-box").style.display = "none";
                }, 5000);
            } 
            else if (datos.status === "error") {
                // Si algo falla dentro del script de Python, detenemos el reloj y mostramos el porqué
                clearInterval(intervalo);
                statusText.innerText = `Error en el renderizador: ${datos.detalle}`;
            }
        } catch (error) {
            console.error("Error consultando el estatus:", error);
        }
    }, 10000); // Consulta automática cada 10 segundos
}
</script>
