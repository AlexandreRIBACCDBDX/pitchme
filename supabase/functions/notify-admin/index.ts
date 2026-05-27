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
    const { candidature_id, message_content } = await req.json();
    if (!candidature_id) {
      return new Response(JSON.stringify({ error: 'candidature_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.warn('[notify-admin] RESEND_API_KEY non configuré — email ignoré');
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Récupérer les infos de la candidature
    const { data: cand } = await supabase
      .from('candidatures')
      .select('business_name, contact_first_name, contact_last_name, candidature_type')
      .eq('id', candidature_id)
      .single();

    if (!cand) {
      return new Response(JSON.stringify({ error: 'Candidature introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Récupérer tous les emails admin
    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin');

    const adminEmails = (admins ?? [])
      .map((a: any) => a.email)
      .filter(Boolean) as string[];

    if (adminEmails.length === 0) {
      console.warn('[notify-admin] Aucun admin trouvé');
      return new Response(JSON.stringify({ skipped: true, reason: 'no admin emails' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const typeLabel = cand.candidature_type === 'foodtruck' ? '🚚 Food Truck' : '🏪 Stand marché';
    const candidateName = `${cand.contact_first_name ?? ''} ${cand.contact_last_name ?? ''}`.trim();

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PitchMe <noreply@pitchme.fr>',
        to: adminEmails,
        subject: `Nouveau message de ${cand.business_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
            <div style="background: #1a1a2e; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 18px;">PitchMe · Tableau de bord</h1>
            </div>
            <div style="background: #fff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="font-size: 17px; margin-top: 0;">💬 Réponse d'un candidat</h2>
              <p>Un candidat a répondu dans le fil de messages :</p>

              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 40%;">Commerce</td>
                  <td style="padding: 8px 0; font-weight: bold;">${cand.business_name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Contact</td>
                  <td style="padding: 8px 0;">${candidateName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Type</td>
                  <td style="padding: 8px 0;">${typeLabel}</td>
                </tr>
              </table>

              ${message_content ? `
              <div style="background: #f3f4f6; border-left: 4px solid #6C63FF; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0;">
                <p style="margin: 0; color: #111827; font-size: 14px; line-height: 1.6;">${message_content}</p>
              </div>
              ` : ''}

              <p style="color: #374151; font-size: 14px;">Connectez-vous à <strong>PitchMe</strong> pour consulter le fil de messages complet et répondre.</p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                Notification automatique · PitchMe · Marché de Noël Bourg-sur-Gironde
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[notify-admin] Resend error:', err);
      return new Response(JSON.stringify({ error: err }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent: true, to: adminEmails }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[notify-admin] Exception:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
