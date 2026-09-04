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
STRIPE_PRICE_MONTHLY=          # price_... ContacNeed PRO mensual
STRIPE_PRICE_ANNUAL=           # price_... ContacNeed PRO anual
STRIPE_WEBHOOK_SECRET=         # whsec_... del endpoint stripe-webhook (distinto al de VIAM)
GEMINI_API_KEY=
URL=https://contacneed.com
VITE_SITE_URL=https://contacneed.com
VITE_SUPABASE_URL=          # obligatorio: el feed lee publicaciones desde el cliente
VITE_SUPABASE_ANON_KEY=     # obligatorio: sin estas dos el feed no carga
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
SUPABASE_SERVICE_ROLE_KEY=     # OBLIGATORIO: guardar posts, perfil, tienda y comentarios
RESEND_API_KEY=                # recomendado: registro, recuperación y códigos CMS al otorgar privilegios
RESEND_FROM=ContacNeed <noreply@contacneed.com>
GOOGLE_MAPS_API_KEY=           # opcional: geocodifica dirección de tienda PRO (si no, usa Nominatim)
VITE_GOOGLE_MAPS_API_KEY=      # opcional, misma key si la usas en el cliente
```

## SQL pendiente (Supabase)

Para likes/comentarios/compartidos/solicitudes/notificaciones en tiempo real, ejecuta en el SQL Editor:

`ContacNeed - Arquitectura Modular Diamante Estabilizada/supabase/migrations/011_realtime_social.sql`

## Correos (registro, recuperación y privilegios)

Con `RESEND_API_KEY`, ContacNeed envía por Resend (mismo remitente unificado):

- Confirmación de cuenta al registrarse
- Recuperación de contraseña (“¿Olvidaste tu contraseña?”)
- Aviso de privilegios + código unificado `CMS-XXXXXX` al otorgar PRO, Nexus, Video Diamante o Curso de Promotores

Supabase **no envía correos a usuarios externos** con el email por defecto. Necesitas **una** de estas opciones:

### Opción A — Resend (recomendada en ContacNeed)

1. Crea cuenta en [resend.com](https://resend.com) y verifica el dominio `contacneed.com` (DNS).
2. En Netlify → Environment variables agrega `RESEND_API_KEY` y `RESEND_FROM` (ej. `ContacNeed <noreply@contacneed.com>`).
3. En Netlify → Environment variables:
   - `RESEND_API_KEY` = tu API key de Resend
   - `RESEND_FROM` = `ContacNeed <noreply@contacneed.com>` (debe ser del dominio verificado)
4. En Supabase → Authentication → URL Configuration:
   - **Site URL:** `https://contacneed.com`
   - **Redirect URLs** (ambas):
     - `https://contacneed.com/auth/confirm`
     - `https://contacneed.com/auth/reset`
     - (opcionales) `http://localhost:3000/auth/confirm` y `http://localhost:3000/auth/reset` para local

Si Resend responde *domain is not verified*, el correo no saldrá hasta completar el paso 1.

### Opción B — SMTP en Supabase

1. Supabase → Authentication → SMTP → activa Custom SMTP (Resend, SendGrid, etc.).
2. Mismas URLs de redirect que arriba.
3. Sin `RESEND_API_KEY` en Netlify: el registro/recuperación usan el SMTP de Supabase; los correos de privilegios/código CMS **sí requieren** `RESEND_API_KEY`.

## Webhook Stripe

Función Netlify (ESM): `netlify/functions/stripe-webhook.mjs`  
URL pública (no cambies el path en Stripe):

```
https://contacneed.com/.netlify/functions/stripe-webhook
```

Requiere en Netlify ContacNeed: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (`whsec_...` de este endpoint, distinto al de VIAM) y `SUPABASE_SERVICE_ROLE_KEY`.

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
