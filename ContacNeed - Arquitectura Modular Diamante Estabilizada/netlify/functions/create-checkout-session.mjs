import Stripe from 'stripe'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!stripeSecret) {
    return new Response(JSON.stringify({ error: 'Stripe no configurado en Netlify.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stripe = new Stripe(stripeSecret)
  const url = new URL(req.url)
  const origin = process.env.URL ?? process.env.VITE_SITE_URL ?? url.origin

  try {
    const { planTipo, successUrl, cancelUrl } = await req.json()
    const esAnual = planTipo === 'anual'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: esAnual ? 'ContacNeed PRO — Anual' : 'ContacNeed PRO — Mensual',
              description: esAnual ? '12 meses · 2 meses de regalo' : 'Membresía mensual PRO',
            },
            unit_amount: esAnual ? 300000 : 30000,
            recurring: { interval: esAnual ? 'year' : 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url:
        successUrl ?? `${origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl ?? `${origin}/?payment_cancelled=true`,
      metadata: { plan: planTipo, producto: 'contacneed_pro' },
    })

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
