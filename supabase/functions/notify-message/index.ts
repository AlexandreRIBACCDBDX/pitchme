import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { candidature_id, content } = await req.json();

    if (!candidature_id || !content) {
      return new Response(
        JSON.stringify({ error: 'candidature_id et content requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.warn('[notify-message] RESEND_API_KEY non configuré — email ignoré');
      return new Response(
        JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY not set' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: cand, error: dbError } = await supabase
      .from('candidatures')
      .select('contact_email, contact_first_name, business_name, access_code')
      .eq('id', candidature_id)
      .single();

    if (dbError || !cand?.contact_email) {
      console.error('[notify-message] Candidature introuvable ou email manquant', dbError);
      return new Response(
        JSON.stringify({ error: 'Email candidat introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Marché de Noël Bourg <noreply@pitchme.fr>',
        to: cand.contact_email,
        subject: `Nouveau message — Candidature ${cand.business_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
            <div style="background: #6C63FF; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">🎄 Marché de Noël de Bourg-sur-Gironde</h1>
            </div>
            <div style="background: #fff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="font-size: 18px; margin-top: 0;">Nouveau message de l'équipe organisatrice</h2>
              <p style="color: #374151;">Bonjour <strong>${cand.contact_first_name ?? ''}</strong>,</p>
              <p style="color: #374151;">Vous avez reçu un nouveau message concernant votre candidature <strong>${cand.business_name}</strong>.</p>
              <div style="background: #f3f4f6; border-left: 4px solid #6C63FF; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #111827; font-size: 15px; line-height: 1.6;">${content}</p>
              </div>
              <p style="color: #374151;">Pour consulter votre dossier et répondre, rendez-vous sur <strong>PitchMe</strong> avec votre code d'accès :</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="font-family: monospace; font-size: 22px; font-weight: bold; letter-spacing: 4px; color: #6C63FF; background: #ede9fe; padding: 12px 24px; border-radius: 8px;">${cand.access_code}</span>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;">
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                Cet email a été envoyé automatiquement par PitchMe · Marché de Noël · Bourg-sur-Gironde
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error('[notify-message] Resend error:', errBody);
      return new Response(
        JSON.stringify({ error: errBody }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ sent: true, to: cand.contact_email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[notify-message] Exception:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
