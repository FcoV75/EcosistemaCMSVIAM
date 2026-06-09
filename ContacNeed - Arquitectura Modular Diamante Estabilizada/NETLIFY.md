# Despliegue de ContacNeed en Netlify

Este proyecto vive dentro del monorepo `EcosistemaCMSVIAM`. **contacneed.com** debe desplegarse como sitio Netlify separado (o con base directory), sin romper el sitio estático del ecosistema CMS VIAM en la raíz del repo.

## Configuración en Netlify (Build & deploy)

En **Site configuration → Build & deploy → Continuous deployment → Build settings**:

| Campo | Valor |
|-------|-------|
| **Repository** | `FcoV75/EcosistemaCMSVIAM` |
| **Branch** | `main` |
| **Base directory** | `ContacNeed - Arquitectura Modular Diamante Estabilizada` |
| **Build command** | `npm run build` |
| **Publish directory** | `dist/client` |
| **Functions directory** | `netlify/functions` |

Netlify leerá el `netlify.toml` de esta carpeta cuando el **Base directory** esté configurado.

## Dominio

En **Domain management**, conecta:

- `contacneed.com`
- `www.contacneed.com` (redirect a apex si prefieres)

## Variables de entorno (Site configuration → Environment variables)

Copia desde `.env.example` y pega valores reales (nunca en Git):

```
DATABASE_URL=
DIRECT_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=
STRIPE_PRICE_MONTHLY=
STRIPE_PRICE_ANNUAL=
STRIPE_WEBHOOK_SECRET=
GEMINI_API_KEY=
URL=https://contacneed.com
VITE_SITE_URL=https://contacneed.com
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
SUPABASE_SERVICE_ROLE_KEY=
```

## Webhook Stripe

En Stripe Dashboard → Webhooks, apunta a:

```
https://contacneed.com/.netlify/functions/stripe-webhook
```

Evento mínimo: `checkout.session.completed`.

## Admin en Supabase

Marca tu usuario como administrador:

```sql
UPDATE perfiles SET is_admin = true WHERE email = 'tu@correo.com';
```

## Deploy manual desde tu PC

```powershell
cd "C:\Users\Gamer\OneDrive\Escritorio\EcosistemaCMSVIAM\ContacNeed - Arquitectura Modular Diamante Estabilizada"
npm install
npm run build
npx netlify deploy --prod
```

## Notas

- El sitio raíz del repo (`index.html`, `musica.html`, etc.) sigue siendo el ecosistema CMS VIAM.
- ContacNeed usa TanStack Start + preset Netlify (`app.config.ts`).
- Los archivos con credenciales (`SupaB.txt`, `VITE_CLOUDINARY.txt`) están en `.gitignore` a propósito.
