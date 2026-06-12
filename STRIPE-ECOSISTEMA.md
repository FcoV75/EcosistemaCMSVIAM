# Stripe — Ecosistema VIAM (mapa de cobros)

Una sola cuenta de Stripe alimenta **tres flujos distintos**. Cada uno debe tener producto/metadata claro para no mezclar licencias.

## Mapa de productos

| Producto en Stripe | Sitio | Función checkout | Webhook | Activación |
|--------------------|-------|------------------|---------|------------|
| **Video Diamante Premium** (mensual / anual) | centromultidisciplinarioags.com | `create-checkout-session` (raíz) | `payment-webhook` | `verify-payment` → código CMS-XXXX → Video Diamante |
| **Ecosistema CMS** (compra única: consultas, servicios) | centromultidisciplinarioags.com | `create-checkout-session` (modo `payment`) | `payment-webhook` | `verify-payment` → código NEXUS |
| **ContacNeed PRO** (mensual / anual) | contacneed.com | `create-checkout-session` o server fn | `stripe-webhook` | Supabase `perfiles.es_pro` |

## Precios actuales en código

| Plan | Monto | Intervalo | metadata.producto |
|------|-------|-----------|-------------------|
| Video Diamante mensual | $300 MXN | month | `video_diamante_premium` |
| Video Diamante anual | $3,000 MXN | year | `video_diamante_premium` |
| ContacNeed PRO mensual | $300 MXN | month | `contacneed_pro` |
| ContacNeed PRO anual | $3,000 MXN | year | `contacneed_pro` |
| CMS compra única | variable | pago único | `ecosistema_cms_compra` |

## Configuración en Stripe Dashboard

### 1. Productos (recomendado — catálogo ordenado)

En **Product catalog → Products**, crea (o renombra) estos productos:

1. `Video Diamante Premium`
2. `ContacNeed PRO`
3. `Ecosistema CMS — Servicios`

En cada uno, crea **Prices** recurrentes o únicos con los montos de arriba.

Copia los **Price ID** (`price_...`) a Netlify:

**Sitio centromultidisciplinarioags.com (raíz del repo):**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...   # del endpoint payment-webhook
STRIPE_PRICE_VIDEO_DIAMANTE_MONTHLY=price_...   # opcional
STRIPE_PRICE_VIDEO_DIAMANTE_ANNUAL=price_...    # opcional
```

**Sitio contacneed.com (subcarpeta ContacNeed):**
```
STRIPE_SECRET_KEY=sk_live_...     # misma cuenta OK
STRIPE_WEBHOOK_SECRET=whsec_...   # del endpoint stripe-webhook (distinto al de VIAM)
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Si no pones Price ID, el código crea precios dinámicos (`price_data`) — funciona, pero el catálogo en Stripe se ve duplicado.

### 2. Webhooks (dos endpoints obligatorios)

| Nombre sugerido | URL | Eventos | Secreto va en |
|-----------------|-----|---------|---------------|
| VIAM — Pagos CMS y Video Diamante | `https://centromultidisciplinarioags.com/.netlify/functions/payment-webhook` | `checkout.session.completed` | Netlify sitio VIAM → `STRIPE_WEBHOOK_SECRET` |
| ContacNeed — PRO | `https://contacneed.com/.netlify/functions/stripe-webhook` | `checkout.session.completed` | Netlify sitio ContacNeed → `STRIPE_WEBHOOK_SECRET` |

**No uses un solo webhook para ambos sitios** — cada URL tiene su propio `whsec_...`.

### 3. Cómo verificar que está bien

1. Stripe → Webhooks → cada endpoint → **Send test event** `checkout.session.completed`
2. Debe responder **200** (VIAM) o **200** (ContacNeed con Supabase configurado)
3. Tras un pago real de Video Diamante, en Netlify Blobs (`nexus-payments`) debe aparecer el `cs_live_...` con `producto: video_diamante_premium`

## Flujo Video Diamante (resumen)

```
Usuario → Stripe Checkout (metadata: video_diamante_premium)
       → payment-webhook guarda cs_... en Blobs
       → verify-payment genera CMS-XXXX (solo si producto = video_diamante_premium)
       → member-status valida código con producto correcto
       → Plan Premium activo en el generador
```

## Errores comunes

| Síntoma | Causa |
|---------|-------|
| "No se encontró registro del pago" | Webhook VIAM mal URL o `STRIPE_WEBHOOK_SECRET` incorrecto |
| Premium no activa tras pagar | Webhook apunta a contacneed en vez de VIAM |
| Código CMS activa otro servicio | metadata `producto` incorrecta o mezclada |
| ContacNeed webhook 500 | Falta `SUPABASE_SERVICE_ROLE_KEY` en Netlify ContacNeed |
| Anual dura solo 30 días | Corregido en verify-payment (365 días si plan=anual) |
