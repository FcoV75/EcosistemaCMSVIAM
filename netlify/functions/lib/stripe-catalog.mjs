/** Catálogo único Stripe — Ecosistema VIAM (módulo de datos, no function). */
export const PRODUCTOS = {
  video_diamante_premium: {
    etiqueta: 'Video Diamante Premium',
    paginas: ['video_diamante', 'musica (banner)'],
    tipo: 'subscription',
    mensual: { centavos: 30000, nombre: 'Video Diamante Premium — Mensual', envPrice: 'STRIPE_PRICE_VIDEO_DIAMANTE_MONTHLY' },
    anual: { centavos: 300000, nombre: 'Video Diamante Premium — Anual', envPrice: 'STRIPE_PRICE_VIDEO_DIAMANTE_ANNUAL' },
    successPath: '/video_diamante.html?payment_success=true&session_id={CHECKOUT_SESSION_ID}',
    cancelPath: '/video_diamante.html?payment_cancelled=true',
  },
  sincronia_nexus: {
    etiqueta: 'Sincronía NEXUS',
    paginas: ['index (membresía)', 'nexus', 'miembro'],
    tipo: 'subscription',
    mensual: { centavos: 40000, nombre: 'Sincronía NEXUS — Mensual', envPrice: 'STRIPE_PRICE_NEXUS_MONTHLY' },
    anual: { centavos: 360000, nombre: 'Sincronía NEXUS — Anual (3 meses de regalo)', envPrice: 'STRIPE_PRICE_NEXUS_ANNUAL' },
    successPath: '/?payment_success=true&session_id={CHECKOUT_SESSION_ID}#pago-general',
    cancelPath: '/?payment_cancelled=true',
  },
  ecosistema_cms_compra: {
    etiqueta: 'CMS — libros, consultas y servicios',
    paginas: ['index', 'obras'],
    tipo: 'payment',
  },
  contacneed_pro: {
    etiqueta: 'ContacNeed PRO',
    paginas: ['contacneed.com'],
    tipo: 'subscription',
    mensual: { centavos: 30000, nombre: 'ContacNeed PRO — Mensual', envPrice: 'STRIPE_PRICE_CONTACNEED_MONTHLY' },
    anual: { centavos: 300000, nombre: 'ContacNeed PRO — Anual', envPrice: 'STRIPE_PRICE_CONTACNEED_ANNUAL' },
    successPath: '/?payment_success=true&session_id={CHECKOUT_SESSION_ID}',
    cancelPath: '/?payment_cancelled=true',
  },
  cms_plus: {
    etiqueta: 'Círculo CMS-Plus Membresías',
    paginas: ['contacneed.com/circulo-cms-plus'],
    tipo: 'subscription',
    niveles: {
      plata: {
        mensual: { centavos: 49900, nombre: 'Círculo CMS-Plus Plata — Mensual', envPrice: 'STRIPE_PRICE_CMS_PLUS_PLATA_MONTHLY' },
        anual: { centavos: 499000, nombre: 'Círculo CMS-Plus Plata — Anual', envPrice: 'STRIPE_PRICE_CMS_PLUS_PLATA_ANNUAL' },
      },
      oro: {
        mensual: { centavos: 89900, nombre: 'Círculo CMS-Plus Oro — Mensual', envPrice: 'STRIPE_PRICE_CMS_PLUS_ORO_MONTHLY' },
        anual: { centavos: 899000, nombre: 'Círculo CMS-Plus Oro — Anual', envPrice: 'STRIPE_PRICE_CMS_PLUS_ORO_ANNUAL' },
      },
      platino: {
        mensual: { centavos: 149900, nombre: 'Círculo CMS-Plus Platino — Mensual', envPrice: 'STRIPE_PRICE_CMS_PLUS_PLATINO_MONTHLY' },
        anual: { centavos: 1499000, nombre: 'Círculo CMS-Plus Platino — Anual', envPrice: 'STRIPE_PRICE_CMS_PLUS_PLATINO_ANNUAL' },
      },
      diamante: {
        mensual: { centavos: 249900, nombre: 'Círculo CMS-Plus Diamante — Mensual', envPrice: 'STRIPE_PRICE_CMS_PLUS_DIAMANTE_MONTHLY' },
        anual: { centavos: 2499000, nombre: 'Círculo CMS-Plus Diamante — Anual', envPrice: 'STRIPE_PRICE_CMS_PLUS_DIAMANTE_ANNUAL' },
      },
    },
    successPath: '/circulo-cms-plus?payment_success=true&session_id={CHECKOUT_SESSION_ID}',
    cancelPath: '/circulo-cms-plus?payment_cancelled=true',
  },
};

export function resolverProducto(producto, planTipo) {
  if (producto && PRODUCTOS[producto]) return producto;
  if (planTipo === 'mensual' || planTipo === 'anual') return 'video_diamante_premium';
  return 'ecosistema_cms_compra';
}

/** Vista pública del catálogo (sin price IDs ni secretos). */
export function catalogoPublico() {
  return Object.fromEntries(
    Object.entries(PRODUCTOS).map(([id, cfg]) => [
      id,
      {
        id,
        etiqueta: cfg.etiqueta,
        tipo: cfg.tipo,
        paginas: cfg.paginas,
        planes: cfg.mensual || cfg.anual
          ? {
              mensual: cfg.mensual
                ? { nombre: cfg.mensual.nombre, centavos: cfg.mensual.centavos }
                : null,
              anual: cfg.anual
                ? { nombre: cfg.anual.nombre, centavos: cfg.anual.centavos }
                : null,
            }
          : null,
        niveles: cfg.niveles
          ? Object.fromEntries(
              Object.entries(cfg.niveles).map(([nivel, planes]) => [
                nivel,
                {
                  mensual: planes.mensual
                    ? { nombre: planes.mensual.nombre, centavos: planes.mensual.centavos }
                    : null,
                  anual: planes.anual
                    ? { nombre: planes.anual.nombre, centavos: planes.anual.centavos }
                    : null,
                },
              ]),
            )
          : null,
      },
    ]),
  );
}
