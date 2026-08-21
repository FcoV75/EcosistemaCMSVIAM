# Video Diamante — App local (fase 1)

Esta carpeta es la base para la versión **offline** en laptop y móvil.

## Opción A — PWA (ya activa en la web)

1. Abre `https://centromultidisciplinarioags.com/video_diamante` en Chrome/Edge.
2. Menú → **Instalar aplicación** / **Añadir a pantalla de inicio**.
3. Funciona como app; el renderizado sigue usando Railway en la nube.

## Opción B — Escritorio con Electron (próximo paso)

```bash
cd video-diamante-desktop
npm init -y
npm install electron
# Copiar video_diamante.html + video_diamante.js + server.py local
```

## Opción C — Render 100% offline

Requiere instalar en tu PC:

- Python 3.11+
- `pip install -r ../requirements.txt`
- `python server.py` en `localhost:5000`
- Abrir `video_diamante.html` apuntando `RAILWAY_API` a `http://localhost:5000`

## Límites implementados en web

| Plan | Duración del video | Imágenes | Videos | Renders/día |
|------|--------------------|----------|--------|-------------|
| Gratuito | 8 s – 4 min | 10 | 2 | 3 |
| Premium | 8 s – 1 h | 30 | ilimitado* | 10 |

### Estudio VIAM Creativo

| Función | Gratuito | Premium |
|---------|----------|---------|
| Imagen HD + discurso | 5/día | 20/día |
| Voz IA (texto a voz) | 30 s/toma · 3/día | hasta 4 min/toma · 20/día |
| Movimiento Ken Burns | 5 imágenes/día | 30/día |
| Clip IA corto | 8 s · 1/día | 8–12 s · 5/día |
| MIDI | mismos límites de audio del plan | mismos límites de audio del plan |

La voz IA y el clip corto son tomas generativas. El video armado de hasta 1 h (Premium) se construye con tu audio, MIDI o esa locución, no con una hora de IA continua.

*El servidor limita a 100 MB por paquete.
