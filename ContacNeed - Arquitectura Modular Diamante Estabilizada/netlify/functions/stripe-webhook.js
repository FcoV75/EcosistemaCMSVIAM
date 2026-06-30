const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeSecret) {
    return { statusCode: 500, body: 'Stripe no configurado.' }
  }

  const stripe = new Stripe(stripeSecret)
  const signature = event.headers['stripe-signature']
  let stripeEvent

  try {
    if (!signature) {
      return { statusCode: 400, body: 'Falta cabecera stripe-signature.' }
    }
    if (!webhookSecret) {
      return { statusCode: 500, body: 'STRIPE_WEBHOOK_SECRET no configurado en Netlify.' }
    }
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      webhookSecret,
    )
  } catch (error) {
    return { statusCode: 400, body: `Webhook Error: ${error.message}` }
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object
    const producto = session.metadata?.producto || 'contacneed_pro'

    // Solo activar PRO de ContacNeed — ignorar pagos de Video Diamante / CMS
    if (producto !== 'contacneed_pro') {
      return {
        statusCode: 200,
        body: JSON.stringify({ received: true, ignored: true, producto }),
      }
    }

    const userId = session.metadata?.userId
    if (!userId) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          received: true,
          warning: 'checkout sin userId en metadata; use confirmStripeSessionFn en el cliente.',
        }),
      }
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
      return { statusCode: 500, body: 'Supabase no configurado para ContacNeed.' }
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const planType = session.metadata?.plan === 'annual' ? 'annual' : 'monthly'
    await supabase
      .from('perfiles')
      .update({ es_pro: true, is_premium: true, pro_plan_type: planType })
      .eq('id', userId)
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}
