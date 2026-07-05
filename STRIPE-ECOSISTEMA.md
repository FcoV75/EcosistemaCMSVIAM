# Stripe — Guía simple (Ecosistema VIAM)

**Una cuenta Stripe** · **Dos webhooks** · **Cuatro productos lógicos**

---

## ¿Qué página usa qué?

| Página | Qué se paga | `producto` en Stripe | Cómo paga el usuario |
|--------|-------------|----------------------|----------------------|
| **CMS** (`index.html`) | Consultas, libros, servicios | `ecosistema_cms_compra` | Botón Stripe → monto del carrito |
| **Obras Literarias** | Novelas/libros | `ecosistema_cms_compra` | “Comprar” → redirige al CMS y paga ahí |
| **Sincronía NEXUS** | Membresía $400/mes o $3,600/año | `sincronia_nexus` | CMS (solo membresía) o enlace desde `/nexus` |
| **Video Diamante / VIAM** | Premium $300/mes o $3,000/año | `video_diamante_premium` | Botones en `/video_diamante` |
| **ContacNeed** | PRO $300/mes o $3,000/año | `contacneed_pro` | Modal Stripe en contacneed.com |

---

## Configuración en Stripe (solo 2 pasos)

### Paso 1 — Un webhook para el CMS (VIAM, NEXUS, Obras, Video Diamante)

**Developers → Webhooks → Add destination**

- **URL:** `https://centromultidisciplinarioags.com/.netlify/functions/payment-webhook`
- **Evento:** `checkout.session.completed`
- Copia `whsec_...` → Netlify (sitio CMS) → `STRIPE_WEBHOOK_SECRET`

*(Ya tienes uno activo como `whimsical-wonder` apuntando al mismo sitio Netlify — está bien.)*

### Paso 2 — Un webhook para ContacNeed

- **URL:** `https://contacneed.com/.netlify/functions/stripe-webhook`
- **Evento:** `checkout.session.completed`
- Copia `whsec_...` → Netlify (sitio ContacNeed) → `STRIPE_WEBHOOK_SECRET`

---

## Variables en Netlify

### Sitio `centromultidisciplinarioags.com`

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...        # del webhook payment-webhook
VIDEO_DIAMANTE_OWNER_CODES=CMS-XXXXXX  # propietario Video Diamante (permanente)
SINCRONIA_NEXUS_OWNER_CODES=CMS-XXXXXX # propietario Santuario Nexus (permanente)
# Opcional: un solo código para todo el ecosistema
ECOSISTEMA_OWNER_CODES=CMS-XXXXXX

# Seguridad Fase 1 (mismo valor en Netlify y Railway)
ECOSISTEMA_SESSION_SECRET=genera_una_cadena_larga_aleatoria_64_chars
RAILWAY_INTERNAL_SECRET=la_misma_cadena_que_ECOSISTEMA_SESSION_SECRET

# Unificación Fase 3 (mismo proyecto Supabase que ContacNeed)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...   # obligatorio para login en CMS
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ECOSISTEMA_OWNER_CODES=CMS-8INFW3
```

Opcional (precios fijos en catálogo Stripe):

```
STRIPE_PRICE_VIDEO_DIAMANTE_MONTHLY=price_...
STRIPE_PRICE_VIDEO_DIAMANTE_ANNUAL=price_...
STRIPE_PRICE_NEXUS_MONTHLY=price_...
STRIPE_PRICE_NEXUS_ANNUAL=price_...
```

### Servicio Railway (`EcosistemaCMSVIAM`)

```
GROQ_API_KEY=...
GEMINI_API_KEY=...
RAILWAY_INTERNAL_SECRET=la_misma_cadena_que_ECOSISTEMA_SESSION_SECRET_en_Netlify
```

*(Si `RAILWAY_INTERNAL_SECRET` no está configurado, Railway sigue aceptando peticiones directas — configúralo en producción.)*

### Descargas de libros (Fase 2)

- Los PDF en `/Assets/Docs/` redirigen a `download-libro` (requieren token firmado).
- Tras pagar, el código `CMS-XXXXXX` se valida en `verify-comprobante` antes de descargar.
- Muestra gratuita de 5 min en Obras Literarias vía `libro-muestra` (límite por IP).

### Unificación Fase 3A (Supabase entitlements)

1. Ejecuta en Supabase SQL Editor el archivo `supabase/migrations/008_ecosistema_entitlements.sql`.
2. Asegura `SUPABASE_ANON_KEY` en Netlify CMS (además de URL y SERVICE_ROLE).
3. Tras deploy, semilla propietario (una vez):

```bash
curl -X POST https://centromultidisciplinarioags.com/.netlify/functions/ecosistema-seed \
  -H "Authorization: Bearer TU_ECOSISTEMA_SESSION_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"CMS-8INFW3\"}"
```

4. Panel unificado: `/mi-ecosistema` (misma cuenta que ContacNeed).

### Unificación Fase 3C (sesión o código)

- **Nexus** `/nexus` → «Entrar al Santuario» con sesión ContacNeed; `/miembro/` acepta Bearer sin código.
- **Video Diamante** — Premium por sesión o `CMS-XXXXXX`; checkout Stripe incluye `userId` en metadata si hay sesión.
- **Descargas libros** — `verify-comprobante` con Bearer; auto-verificación al abrir modal si hay sesión.
- **ContacNeed webhook** — escribe `contacneed_pro` en `ecosistema_entitlements` además de `perfiles.es_pro`.

### Sitio `contacneed.com`

```
STRIPE_SECRET_KEY=sk_live_...          # misma cuenta
STRIPE_WEBHOOK_SECRET=whsec_...        # del webhook stripe-webhook (otro whsec)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_PRICE_MONTHLY=price_...         # o STRIPE_PRICE_CONTACNEED_MONTHLY
STRIPE_PRICE_ANNUAL=price_...
```

---

## Productos en catálogo Stripe (opcional pero ordenado)

Crea **4 productos** con un precio mensual y uno anual cada uno (donde aplique):

1. Ecosistema CMS — Servicios (solo pagos únicos variables)
2. Sincronía NEXUS — $400 / $3,600 MXN
3. Video Diamante Premium — $300 / $3,000 MXN
4. ContacNeed PRO — $300 / $3,000 MXN

Si no creas precios fijos, el código los genera automáticamente al cobrar.

---

## Después del pago

| Producto | Qué hace el sistema |
|----------|---------------------|
| CMS / Obras | Código `CMS-XXXX` para comprobante y descargas |
| Sincronía NEXUS | Código `CMS-XXXX` → área `/miembro` |
| Video Diamante | Código `CMS-XXXX` → Premium en el generador |
| ContacNeed | Activa `es_pro` en Supabase (sin código manual) |

---

## Cuenta actual

- **ID:** `acct_1T1bdSQm8x71IzJI`
- **Webhook CMS:** activo → `payment-webhook`
- **Webhook ContacNeed:** pendiente de crear en Dashboard
