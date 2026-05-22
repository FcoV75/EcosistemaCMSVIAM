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
        // 3. Hacemos la petición inicial al backend de Railway
        const respuesta = await fetch("https://ecosistemacmsviam-production.up.railway.app/renderizar", {
            method: "POST",
            body: formData
        });

        const datos = await respuesta.json();

        // ¡EL FILTRO DE PRODUCCIÓN! Si el servidor responde 200 o 202, ignoramos cualquier alerta y avanzamos
        if (respuesta.status === 200 || respuesta.status === 202) {
            statusText.innerText = "Proyecto recibido con éxito. Procesando audio, imágenes y subtítulos en segundo plano...";
            
            // 4. Activamos el bucle asincrónico para revisar el estatus real en Railway
            verificarEstatusRenderizado();
        } else {
            statusText.innerText = "Error al arrancar el motor: " + (datos.detalle || "Error desconocido");
            alert("El motor de renderizado reportó un problema: " + (datos.detalle || "Error de configuración"));
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        statusText.innerText = "Error crítico de comunicación con el servidor de renderizado de VIAM.";
        alert("Ocurrió un error al conectar con el servidor de renderizado de VIAM. Por favor, inténtelo de nuevo.");
    }
}

// Esta función pregunta en bucle cerrado a Railway cómo va el procesamiento del video
function verificarEstatusRenderizado() {
    // Bajamos el intervalo a 5 segundos para que la barra de carga sea mucho más ágil y reactiva
    const intervalo = setInterval(async () => {
        try {
            const respuesta = await fetch("https://ecosistemacmsviam-production.up.railway.app/status");
            const datos = await respuesta.json();

            console.log("Estatus actual del renderizado:", datos.status);

            if (datos.status === "procesando") {
                // Sigue trabajando el hilo en segundo plano, mantenemos al usuario informado en tiempo real
                statusText.innerText = `Renderizando: ${datos.detalle || 'Compilando transiciones fluidas y subtítulos...'}`;
            } 
            else if (datos.status === "listo") {
                // ¡Éxito absoluto! Rompemos el bucle y disparamos la descarga nativa
                clearInterval(intervalo);
                statusText.innerText = "¡Video Diamante procesado con éxito! Iniciando descarga...";
                
                // Redirecciona al usuario al archivo final generado para su descarga inmediata
                window.location.href = "https://ecosistemacmsviam-production.up.railway.app/descargar";
                
                // Ocultamos la caja de carga después de unos segundos
                setTimeout(() => {
                    document.getElementById("loading-box").style.display = "none";
                }, 5000);
            } 
            else if (datos.status === "error") {
                // Si algo falla dentro del script de Python, detenemos el reloj y mostramos el porqué real
                clearInterval(intervalo);
                statusText.innerText = `Error en el renderizador: ${datos.detalle}`;
                alert("El motor de renderizado de fondo se detuvo: " + datos.detalle);
            }
        } catch (error) {
            console.error("Error consultando el estatus:", error);
            // No ponemos una alerta aquí para que si hay un micro-corte de red, el bucle no moleste al usuario
            statusText.innerText = "Sincronizando con el servidor de fondo...";
        }
    }, 5000); 
}
