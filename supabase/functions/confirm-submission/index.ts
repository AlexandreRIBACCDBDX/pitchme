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
    const { candidature_id } = await req.json();
    if (!candidature_id) {
      return new Response(JSON.stringify({ error: 'candidature_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.warn('[confirm-submission] RESEND_API_KEY non configuré — email ignoré');
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: cand } = await supabase
      .from('candidatures')
      .select('contact_email, contact_first_name, business_name, access_code, candidature_type')
      .eq('id', candidature_id)
      .single();

    if (!cand?.contact_email) {
      return new Response(JSON.stringify({ error: 'Email introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const typeLabel = cand.candidature_type === 'foodtruck' ? '🚚 Food Truck' : '🏪 Stand marché';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Marché de Noël Bourg <noreply@pitchme.fr>',
        to: cand.contact_email,
        subject: `Candidature reçue — ${cand.business_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
            <div style="background: #6C63FF; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">🎄 Marché de Noël de Bourg-sur-Gironde</h1>
            </div>
            <div style="background: #fff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="font-size: 18px; margin-top: 0; color: #059669;">✅ Candidature bien reçue !</h2>
              <p>Bonjour <strong>${cand.contact_first_name ?? ''}</strong>,</p>
              <p>Votre candidature pour <strong>${cand.business_name}</strong> (${typeLabel}) a bien été enregistrée. L'équipe organisatrice va l'examiner et reviendra vers vous prochainement.</p>

              <div style="background: #f3f4f6; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
                <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">VOTRE CODE D'ACCÈS</p>
                <span style="font-family: monospace; font-size: 26px; font-weight: bold; letter-spacing: 5px; color: #6C63FF;">${cand.access_code}</span>
                <p style="margin: 12px 0 0; color: #6b7280; font-size: 12px;">Conservez ce code — il vous permet de suivre l'état de votre dossier sur PitchMe.</p>
              </div>

              <p style="color: #374151;">Pour consulter votre dossier à tout moment, rendez-vous sur <strong>PitchMe</strong> → <em>Mon espace candidat</em> et entrez votre code.</p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;">
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                Marché de Noël · Bourg-sur-Gironde · PitchMe
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[confirm-submission] Resend error:', err);
      return new Response(JSON.stringify({ error: err }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent: true, to: cand.contact_email }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[confirm-submission] Exception:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
