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

| Plan | Duración | Imágenes | Videos | Renders/día |
|------|----------|----------|--------|-------------|
| Gratuito | máx. 4 min | 3 | 2 | 3 |
| Premium | 5 min – 1 h | ilimitado* | ilimitado* | 10 |

*Prácticamente sin tope en la interfaz; el servidor limita a 100 MB por paquete.
