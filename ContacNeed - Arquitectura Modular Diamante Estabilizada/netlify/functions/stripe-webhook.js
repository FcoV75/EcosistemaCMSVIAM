const Stripe = require('stripe')

const { createClient } = require('@supabase/supabase-js')



function normalizeSupabaseUrl(raw) {

  const value = String(raw || '').trim().replace(/^['"]+|['"]+$/g, '')

  if (!value) return ''

  const embedded = value.match(/https?:\/\/[a-z0-9-]+\.supabase\.co/i)

  if (embedded) return embedded[0].replace(/\/+$/, '')

  if (/^[a-z0-9-]+\.supabase\.co$/i.test(value)) return `https://${value}`

  try {

    const parsed = new URL(value)

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.origin

  } catch {

    /* ignore */

  }

  return ''

}



function supabaseUrlFromEnv() {

  return (

    normalizeSupabaseUrl(process.env.SUPABASE_URL) ||

    normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL) ||

    ''

  )

}



async function upsertContacNeedPro(supabase, userId, planType, sessionId) {

  const plan = planType === 'annual' ? 'anual' : 'mensual'

  const expiresAt = planType === 'annual'

    ? new Date(Date.now() + 365 * 86400000).toISOString()

    : new Date(Date.now() + 30 * 86400000).toISOString()



  const { data: existente } = await supabase

    .from('ecosistema_entitlements')

    .select('id')

    .eq('user_id', userId)

    .eq('producto', 'contacneed_pro')

    .eq('status', 'active')

    .maybeSingle()



  const row = {

    user_id: userId,

    producto: 'contacneed_pro',

    plan,

    status: 'active',

    expires_at: expiresAt,

    stripe_session_id: sessionId,

    metadata: { source: 'contacneed_webhook' },

    updated_at: new Date().toISOString(),

  }



  if (existente?.id) {

    await supabase.from('ecosistema_entitlements').update(row).eq('id', existente.id)

  } else {

    await supabase.from('ecosistema_entitlements').insert(row)

  }

}



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



    const supabaseUrl = supabaseUrlFromEnv()

    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {

      console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')

      return { statusCode: 500, body: 'Supabase no configurado para ContacNeed.' }

    }



    const supabase = createClient(supabaseUrl, supabaseKey)

    const planType = session.metadata?.plan === 'annual' ? 'annual' : 'monthly'

    try {
      await upsertContacNeedPro(supabase, userId, planType, session.id)
    } catch (err) {
      console.error('ecosistema_entitlements contacneed_pro:', err)
      return { statusCode: 500, body: 'Error registrando entitlement PRO.' }
    }
  }



  return { statusCode: 200, body: JSON.stringify({ received: true }) }

}


