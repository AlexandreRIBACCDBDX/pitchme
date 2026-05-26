import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import SiretInput from '@/components/SiretInput';
import PhotoPicker from '@/components/PhotoPicker';
import type { SiretData } from '@/lib/siret';

const VEHICLE_TYPES = ['Camion aménagé', 'Remorque', 'Tuk-tuk', 'Stand food fixe'];
const VEHICLE_LENGTHS = ['Moins de 4m', '4 à 6m', '6 à 8m', 'Plus de 8m'];
const POWER_OPTIONS = [
  { key: 'none',      label: 'Autonome (pas de branchement)' },
  { key: '220v_10a',  label: '220V standard (10A)' },
  { key: '220v_16a',  label: '220V renforcé (16A)' },
  { key: '32a_tri',   label: 'Triphasé (32A)' },
];
const SPECIAL_DIETS = ['Végétarien', 'Vegan', 'Sans gluten', 'Halal', 'Kasher'];

interface MenuItem { name: string; price: string; }

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = () => chars[Math.floor(Math.random() * chars.length)];
  return `${r()}${r()}${r()}${r()}-${r()}${r()}${r()}${r()}`;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export default function CandidatureFoodtruck() {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState(1);
  const [siretChecking, setSiretChecking] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);

  const [form, setForm] = useState({
    contactFirstName: '',
    contactLastName: '',
    contactEmail: '',
    contactPhone: '',
    businessName: '',
    siret: '',
    siretData: null as SiretData | null,
    address: '',
    city: '',
    postalCode: '',
    websiteUrl: '',
    instagramUrl: '',
    vehicleType: '',
    vehicleLength: '',
    averagePrice: '',
    specialDiets: [] as string[],
    powerNeeded: 'none',
    waterNeeded: false,
    gasNeeded: false,
    previousParticipant: false,
    menuItems: [{ name: '', price: '' }] as MenuItem[],
    beverages: '',
    cautionAccepted: false,
  });

  function update(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function toggleDiet(diet: string) {
    setForm(f => ({
      ...f,
      specialDiets: f.specialDiets.includes(diet)
        ? f.specialDiets.filter(d => d !== diet)
        : [...f.specialDiets, diet],
    }));
  }

  function updateMenuItem(idx: number, field: keyof MenuItem, value: string) {
    setForm(f => {
      const items = [...f.menuItems];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, menuItems: items };
    });
  }

  function addMenuItem() {
    setForm(f => ({ ...f, menuItems: [...f.menuItems, { name: '', price: '' }] }));
  }

  function removeMenuItem(idx: number) {
    setForm(f => ({ ...f, menuItems: f.menuItems.filter((_, i) => i !== idx) }));
  }

  function validateStep1() {
    if (!form.contactFirstName.trim() || !form.contactLastName.trim()) return 'Prénom et nom du responsable requis';
    if (!form.contactEmail.trim() || !form.contactEmail.includes('@')) return 'Email de contact valide requis';
    if (!form.businessName) return 'Nom du commerce requis';
    if (!form.siret || form.siret.replace(/\s/g, '').length !== 14) return 'SIRET invalide (14 chiffres requis)';
    if (siretChecking) return 'Vérification SIRET en cours…';
    if (!form.siretData) return 'SIRET non vérifié — vérification automatique en cours';
    if (!form.address || !form.city || !form.postalCode) return 'Adresse complète requise';
    return null;
  }

  function validateStep2() {
    if (!form.vehicleType) return 'Type de véhicule requis';
    if (!form.vehicleLength) return 'Longueur du véhicule requise';
    const validItems = form.menuItems.filter(i => i.name.trim());
    if (validItems.length === 0) return 'Au moins un plat requis dans la carte';
    if (!form.cautionAccepted) return 'Vous devez accepter la condition de caution pour continuer';
    return null;
  }

  async function handleSubmit() {
    const err = validateStep2();
    if (err) { setErrorMsg(err); return; }

    setErrorMsg('');
    setSaving(true);

    try {
      const foodtruckData = {
        vehicle_type:   form.vehicleType,
        vehicle_length: form.vehicleLength,
        average_price:  form.averagePrice ? parseFloat(form.averagePrice) : null,
        special_diets:  form.specialDiets,
        power_needed:   form.powerNeeded,
        water_needed:   form.waterNeeded,
        gas_needed:     form.gasNeeded,
        menu_items:     form.menuItems.filter(i => i.name.trim()),
        beverages:      form.beverages,
      };

      const candidatureId = generateUUID();
      const accessCode = generateAccessCode();

      const photoUrls = photos.length > 0 ? await uploadPhotos(photos, candidatureId) : [];

      const payload = {
        id:                  candidatureId,
        access_code:         accessCode,
        caution_accepted:    form.cautionAccepted,
        contact_first_name:  form.contactFirstName.trim(),
        contact_last_name:   form.contactLastName.trim(),
        contact_email:       form.contactEmail.trim(),
        contact_phone:       form.contactPhone.trim() || null,
        candidature_type:    'foodtruck',
        business_name:       form.businessName,
        siret:               form.siret.replace(/\s/g, ''),
        siret_data:          form.siretData ?? null,
        address:             form.address,
        city:                form.city,
        postal_code:         form.postalCode,
        product_category:    'Restauration / Food Truck',
        product_description: form.menuItems
          .filter(i => i.name)
          .map(i => `${i.name}${i.price ? ' — ' + i.price + '€' : ''}`)
          .join(', '),
        website_url:         form.websiteUrl   || null,
        instagram_url:       form.instagramUrl || null,
        electricity_needed:  form.powerNeeded !== 'none',
        previous_participant: form.previousParticipant,
        foodtruck_data:      foodtruckData,
        photo_urls:          photoUrls.length > 0 ? photoUrls : null,
      };

      const { error } = await (supabase.from('candidatures') as any).insert(payload);
      if (error) throw error;

      router.replace({ pathname: '/(candidate)', params: { code: accessCode } });
    } catch (e: any) {
      console.error('[FoodTruck submit]', e);
      const code: string = e?.code ?? '';
      if (code === 'PGRST204' || e?.message?.includes('column')) {
        setErrorMsg('Colonnes manquantes — exécutez les migrations SQL.');
      } else if (code === '42501' || e?.message?.includes('policy')) {
        setErrorMsg('Accès refusé — vérifiez les politiques RLS de la table candidatures.');
      } else {
        setErrorMsg(e?.message ?? 'Erreur lors de l\'envoi. Réessayez.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhotos(photoList: any[], candidatureId: string): Promise<string[]> {
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };
    const urls: string[] = [];
    for (const photo of photoList) {
      try {
        const rawExt = (photo.name ?? '').split('.').pop()?.toLowerCase() || 'jpg';
        const ext = rawExt === 'jpg' ? 'jpeg' : rawExt;
        const mime = mimeMap[rawExt] ?? 'image/jpeg';
        const path = `${candidatureId}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        const { data: uploadData, error: storageError } = await supabase.storage
          .from('product-photos').upload(path, blob, { contentType: mime });
        if (storageError) { console.warn('[Photo upload]', storageError.message); continue; }
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('product-photos').getPublicUrl(path);
          urls.push(publicUrl);
        }
      } catch (e) { console.warn('[Photo upload exception]', e); }
    }
    return urls;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(s => s - 1) : router.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>🚚 Food Truck</Text>
          <Text style={styles.stepText}>Étape {step}/2</Text>
        </View>
      </View>

      <View style={styles.progress}>
        <View style={[styles.progressBar, { width: `${step * 50}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── ÉTAPE 1 ── */}
        {step === 1 && (
          <View>
            <Text style={styles.sectionTitle}>👤 Vos coordonnées</Text>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Prénom *</Text>
                <TextInput style={styles.input} value={form.contactFirstName} onChangeText={v => update('contactFirstName', v)} placeholder="Jean" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Nom *</Text>
                <TextInput style={styles.input} value={form.contactLastName} onChangeText={v => update('contactLastName', v)} placeholder="Dupont" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>

            <Text style={styles.label}>Email de contact *</Text>
            <TextInput style={styles.input} value={form.contactEmail} onChangeText={v => update('contactEmail', v)} placeholder="jean.dupont@email.com" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

            <Text style={styles.label}>Téléphone</Text>
            <TextInput style={styles.input} value={form.contactPhone} onChangeText={v => update('contactPhone', v)} placeholder="06 12 34 56 78" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />

            <Text style={styles.sectionTitle}>🏢 Informations professionnelles</Text>

            <Text style={styles.label}>Nom du commerce *</Text>
            <TextInput style={styles.input} value={form.businessName} onChangeText={v => update('businessName', v)} placeholder="Ex: Le Burger du Fleuve" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Numéro SIRET *</Text>
            <SiretInput
              value={form.siret}
              onChange={v => update('siret', v)}
              onVerified={data => {
                update('siretData', data);
                if (data?.adresse)     update('address',    data.adresse);
                if (data?.code_postal) update('postalCode', data.code_postal);
                if (data?.ville)       update('city',       data.ville);
              }}
              onLoadingChange={setSiretChecking}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Adresse *</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={v => update('address', v)} placeholder="10 rue de la Paix" placeholderTextColor={Colors.textMuted} />

            <View style={styles.row}>
              <View style={styles.quarter}>
                <Text style={styles.label}>Code postal *</Text>
                <TextInput style={styles.input} value={form.postalCode} onChangeText={v => update('postalCode', v)} placeholder="33710" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" maxLength={5} />
              </View>
              <View style={styles.threeQuarters}>
                <Text style={styles.label}>Ville *</Text>
                <TextInput style={styles.input} value={form.city} onChangeText={v => update('city', v)} placeholder="Bourg-sur-Gironde" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>

            <Text style={styles.label}>Site web</Text>
            <TextInput style={styles.input} value={form.websiteUrl} onChangeText={v => update('websiteUrl', v)} placeholder="https://monsite.fr" placeholderTextColor={Colors.textMuted} keyboardType="url" autoCapitalize="none" />

            <Text style={styles.label}>Instagram</Text>
            <View style={styles.instagramRow}>
              <View style={styles.instagramPrefix}><Text style={styles.instagramAt}>@</Text></View>
              <TextInput style={[styles.input, styles.instagramInput]} value={form.instagramUrl} onChangeText={v => update('instagramUrl', v.replace('@', ''))} placeholder="mon_foodtruck" placeholderTextColor={Colors.textMuted} autoCapitalize="none" autoCorrect={false} />
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={() => {
              const e = validateStep1();
              if (e) { setErrorMsg(e); } else { setErrorMsg(''); setStep(2); }
            }}>
              <Text style={styles.nextBtnText}>Étape suivante →</Text>
            </TouchableOpacity>
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          </View>
        )}

        {/* ── ÉTAPE 2 ── */}
        {step === 2 && (
          <View>
            <Text style={styles.sectionTitle}>🚚 Votre véhicule</Text>

            <Text style={styles.label}>Type de véhicule *</Text>
            <View style={styles.chipGrid}>
              {VEHICLE_TYPES.map(t => (
                <TouchableOpacity key={t} style={[styles.chip, form.vehicleType === t && styles.chipActive]} onPress={() => update('vehicleType', t)}>
                  <Text style={[styles.chipText, form.vehicleType === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Longueur du véhicule *</Text>
            <View style={styles.chipGrid}>
              {VEHICLE_LENGTHS.map(l => (
                <TouchableOpacity key={l} style={[styles.chip, form.vehicleLength === l && styles.chipActive]} onPress={() => update('vehicleLength', l)}>
                  <Text style={[styles.chipText, form.vehicleLength === l && styles.chipTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>🍽️ Votre carte</Text>

            <Text style={styles.label}>Plats proposés * (nom + prix indicatif)</Text>
            {form.menuItems.map((item, idx) => (
              <View key={idx} style={styles.menuRow}>
                <TextInput style={[styles.input, styles.menuNameInput]} value={item.name} onChangeText={v => updateMenuItem(idx, 'name', v)} placeholder="Ex: Burger fromage" placeholderTextColor={Colors.textMuted} />
                <View style={styles.priceRow}>
                  <TextInput style={[styles.input, styles.priceInput]} value={item.price} onChangeText={v => updateMenuItem(idx, 'price', v)} placeholder="10" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
                  <Text style={styles.euroSign}>€</Text>
                </View>
                {form.menuItems.length > 1 && (
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeMenuItem(idx)}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={styles.addMenuBtn} onPress={addMenuItem}>
              <Text style={styles.addMenuBtnText}>+ Ajouter un plat</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Boissons proposées</Text>
            <TextInput style={[styles.input, styles.textarea]} value={form.beverages} onChangeText={v => update('beverages', v)} placeholder="Ex: Sodas, bières artisanales, jus de fruits..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />

            <Text style={styles.label}>Prix moyen par personne (€)</Text>
            <TextInput style={styles.input} value={form.averagePrice} onChangeText={v => update('averagePrice', v)} placeholder="15" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />

            <Text style={styles.label}>Régimes spéciaux proposés</Text>
            <View style={styles.chipGrid}>
              {SPECIAL_DIETS.map(d => (
                <TouchableOpacity key={d} style={[styles.chip, form.specialDiets.includes(d) && styles.chipActive]} onPress={() => toggleDiet(d)}>
                  <Text style={[styles.chipText, form.specialDiets.includes(d) && styles.chipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>⚡ Logistique</Text>

            <Text style={styles.label}>Alimentation électrique nécessaire</Text>
            <View style={styles.chipGrid}>
              {POWER_OPTIONS.map(o => (
                <TouchableOpacity key={o.key} style={[styles.chip, styles.chipWide, form.powerNeeded === o.key && styles.chipActive]} onPress={() => update('powerNeeded', o.key)}>
                  <Text style={[styles.chipText, form.powerNeeded === o.key && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Besoin d'eau (raccordement)</Text>
              <Switch value={form.waterNeeded} onValueChange={v => update('waterNeeded', v)} trackColor={{ false: Colors.border, true: Colors.primary }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Utilisation de gaz</Text>
              <Switch value={form.gasNeeded} onValueChange={v => update('gasNeeded', v)} trackColor={{ false: Colors.border, true: Colors.primary }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Déjà participant au marché</Text>
              <Switch value={form.previousParticipant} onValueChange={v => update('previousParticipant', v)} trackColor={{ false: Colors.border, true: Colors.primary }} />
            </View>

            <Text style={styles.sectionTitle}>📷 Photos du camion & des plats</Text>
            <Text style={styles.hint}>Ajoutez jusqu'à 6 photos</Text>
            <PhotoPicker onPhotosChange={setPhotos} maxPhotos={6} />

            <View style={styles.cautionBox}>
              <Text style={styles.cautionTitle}>⚠️ Caution de présence</Text>
              <Text style={styles.cautionText}>
                Afin de garantir la présence des exposants et d'éviter les désistements de dernière minute, une caution vous sera demandée lors de la confirmation de votre place. Elle sera restituée à l'issue du marché.
              </Text>
              <TouchableOpacity style={styles.cautionCheck} onPress={() => update('cautionAccepted', !form.cautionAccepted)} activeOpacity={0.7}>
                <View style={[styles.checkbox, form.cautionAccepted && styles.checkboxChecked]}>
                  {form.cautionAccepted && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.cautionCheckLabel}>J'ai lu et j'accepte la condition de caution</Text>
              </TouchableOpacity>
            </View>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={saving}
            >
              <Text style={styles.submitBtnText}>
                {saving ? 'Envoi en cours...' : '📤 Envoyer ma candidature'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.background },
  topBar:         { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  backText:       { color: Colors.textSecondary, fontSize: 16 },
  topBarCenter:   { flex: 1, alignItems: 'center' },
  topBarTitle:    { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  stepText:       { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  progress:       { height: 3, backgroundColor: Colors.border, marginHorizontal: 20, borderRadius: 2, marginBottom: 4 },
  progressBar:    { height: 3, backgroundColor: Colors.secondary, borderRadius: 2 },
  scroll:         { padding: 20, paddingBottom: 60 },
  sectionTitle:   { fontSize: 15, fontWeight: 'bold', color: Colors.gold, marginTop: 8, marginBottom: 16 },
  label:          { fontSize: 14, color: Colors.textSecondary, marginBottom: 6 },
  hint:           { color: Colors.textMuted, fontSize: 13, marginBottom: 12 },
  input:          { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, color: Colors.text, fontSize: 15, marginBottom: 16 },
  textarea:       { height: 90, textAlignVertical: 'top' },
  row:            { flexDirection: 'row', gap: 10 },
  half:           { flex: 1 },
  quarter:        { flex: 2 },
  threeQuarters:  { flex: 3 },
  instagramRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  instagramPrefix: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRightWidth: 0, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, padding: 14, justifyContent: 'center' },
  instagramAt:    { color: Colors.textSecondary, fontSize: 16, fontWeight: 'bold' },
  instagramInput: { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginBottom: 0 },
  chipGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:           { backgroundColor: Colors.card, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  chipWide:       { width: '100%' },
  chipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:       { color: Colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  menuRow:        { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 4 },
  menuNameInput:  { flex: 2, marginBottom: 0 },
  priceRow:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceInput:     { flex: 1, marginBottom: 0 },
  euroSign:       { color: Colors.textSecondary, fontSize: 16, paddingBottom: 16 },
  removeBtn:      { padding: 14, justifyContent: 'center' },
  removeBtnText:  { color: Colors.error, fontSize: 16, fontWeight: 'bold' },
  addMenuBtn:     { borderWidth: 1, borderColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 16, borderStyle: 'dashed' },
  addMenuBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  switchRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  switchLabel:    { color: Colors.text, fontSize: 15, flex: 1 },
  errorBox:       { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorBoxText:   { color: '#DC2626', fontSize: 14 },
  errorText:      { color: Colors.error, fontSize: 13, marginTop: 8, textAlign: 'center' },
  nextBtn:        { backgroundColor: Colors.secondary, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  nextBtnText:    { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  submitBtn:      { backgroundColor: Colors.secondary, borderRadius: 10, padding: 18, alignItems: 'center', marginTop: 24 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:  { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cautionBox:        { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' },
  cautionTitle:      { color: '#92400E', fontWeight: 'bold', fontSize: 14, marginBottom: 8 },
  cautionText:       { color: '#78350F', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  cautionCheck:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox:          { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#D97706', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  checkboxChecked:   { backgroundColor: '#D97706', borderColor: '#D97706' },
  checkmark:         { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  cautionCheckLabel: { flex: 1, color: '#78350F', fontSize: 13, fontWeight: '600' },
});
