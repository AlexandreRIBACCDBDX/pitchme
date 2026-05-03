export interface SiretData {
  siret: string;
  siren: string;
  denomination: string;
  activite_principale: string;
  adresse: string;
  code_postal: string;
  ville: string;
  etat_administratif: string;
  valid: boolean;
}

export async function verifySiret(siret: string): Promise<SiretData | null> {
  const cleaned = siret.replace(/\s/g, '');
  if (cleaned.length !== 14 || !/^\d+$/.test(cleaned)) {
    throw new Error('SIRET invalide : doit contenir 14 chiffres');
  }
  if (!luhnCheck(cleaned)) {
    throw new Error('SIRET invalide : numéro incorrect');
  }

  try {
    const response = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${cleaned}&page=1&per_page=1`,
      { headers: { Accept: 'application/json' } }
    );

    if (!response.ok) throw new Error('Erreur lors de la vérification SIRET');

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error('SIRET introuvable dans le registre national');
    }

    const company = data.results[0];
    const matching = company.matching_etablissements?.find(
      (e: any) => e.siret === cleaned
    ) || company.siege;

    return {
      siret: cleaned,
      siren: cleaned.substring(0, 9),
      denomination: company.nom_complet || company.nom_raison_sociale || '',
      activite_principale: company.activite_principale || '',
      adresse: matching?.adresse || '',
      code_postal: matching?.code_postal || '',
      ville: matching?.libelle_commune || '',
      etat_administratif: matching?.etat_administratif || 'A',
      valid: matching?.etat_administratif === 'A',
    };
  } catch (error: any) {
    if (error.message.includes('SIRET')) throw error;
    throw new Error('Impossible de vérifier le SIRET. Veuillez réessayer.');
  }
}

function luhnCheck(siret: string): boolean {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(siret[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function formatSiret(value: string): string {
  const cleaned = value.replace(/\D/g, '').substring(0, 14);
  const parts = [
    cleaned.substring(0, 3),
    cleaned.substring(3, 6),
    cleaned.substring(6, 9),
    cleaned.substring(9, 14),
  ].filter(Boolean);
  return parts.join(' ');
}
