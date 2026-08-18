# AGENTS.md

## Cursor Cloud specific instructions

This monorepo hosts three independently-runnable pieces. The startup update script
already installs all dependencies (root npm, ContacNeed npm, and the Python venv at
`/workspace/.venv`), so you only need to start/configure services below.

### Services overview

| Service | Location | Dev command | Port |
|---|---|---|---|
| CMS VIAM static site + Netlify functions | repo root | static preview: `python3 -m http.server 8080`; full stack: `npx netlify dev` | 8080 (static) / 8888 (netlify) |
| ContacNeed (React 19 + TanStack Start + Vite) | `ContacNeed - Arquitectura Modular Diamante Estabilizada/` | `npm run dev` | 5173 |
| Video/AI render backend (Flask + ffmpeg) | `server.py` | `source /workspace/.venv/bin/activate && python server.py` | 5000 (`PORT`) |

### Non-obvious caveats

- Flask backend: start it with the venv activated (`source /workspace/.venv/bin/activate`
  first). The render route shells out to `python generador_videos.py`, and there is no
  bare `python` on `PATH` outside the venv — without activation the render subprocess
  fails (and it needs the venv's `opencv`/`numpy`/`Pillow`). Health: `GET /health` and
  `GET /health/detalle`. Rendering is asynchronous: `POST /renderizar` (multipart:
  `audio`, `imagen_0`, ...), poll `GET /status` until `"listo"`, then `GET /descargar`
  for the MP4. `RAILWAY_INTERNAL_SECRET` (if set) gates the protected routes.

- ContacNeed dev server listens on **5173** (Vite default), not the `3000` in its
  `netlify.toml` — that `[dev] port` only applies when running via `netlify dev`.

- ContacNeed npm install needs `--legacy-peer-deps` (mirrors `NPM_FLAGS` in its
  `netlify.toml`); React 19 peer ranges conflict otherwise. Its `postinstall` runs
  `prisma generate`.

- ContacNeed SSR requires Supabase env vars. Without `SUPABASE_URL` +
  `SUPABASE_ANON_KEY` the root route throws "Faltan variables de Supabase" (500), and
  server writes additionally need `SUPABASE_SERVICE_ROLE_KEY`. The dev server still
  compiles and serves; you just need real credentials to render/authenticate. See
  `ContacNeed - Arquitectura Modular Diamante Estabilizada/.env.example` and `NETLIFY.md`
  for the full variable list (Supabase, Stripe, Cloudinary, Resend, Google Maps).

- CMS VIAM root site: the HTML pages + client-side JS run fine from a plain static
  server, but any purchase/auth/AI/video flow calls Netlify Functions under
  `netlify/functions/` that need env vars (Stripe, Supabase, Groq, Railway proxy). Use
  `npx netlify dev` with those vars set to exercise the serverless API end to end. See
  `STRIPE-ECOSISTEMA.md` for the CMS env var list.

- The Python venv lives at `/workspace/.venv`. `ffmpeg` is available system-wide.
