import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, ProductCategories } from '@/constants/theme';
import SiretInput from '@/components/SiretInput';
import PhotoPicker from '@/components/PhotoPicker';
import type { SiretData } from '@/lib/siret';

export default function CandidatureForm() {
  const { user } = useAuth();
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    businessName: '',
    siret: '',
    siretData: null as SiretData | null,
    address: '',
    city: '',
    postalCode: '',
    productCategory: '',
    productDescription: '',
    websiteUrl: '',
    instagramUrl: '',
    standSize: '3m',
    electricityNeeded: false,
    previousParticipant: false,
  });
  const [photos, setPhotos] = useState<any[]>([]);

  useEffect(() => {
    loadExisting();
  }, []);

  async function loadExisting() {
    const { data } = await supabase.from('candidatures').select('*').limit(1).maybeSingle() as any;
    if (data) {
      setExistingId(data.id);
      setForm({
        businessName: data.business_name || '',
        siret: data.siret || '',
        siretData: data.siret_data as any,
        address: data.address || '',
        city: data.city || '',
        postalCode: data.postal_code || '',
        productCategory: data.product_category || '',
        productDescription: data.product_description || '',
        websiteUrl: data.website_url || '',
        instagramUrl: (data as any).instagram_url || '',
        standSize: data.stand_size || '3m',
        electricityNeeded: data.electricity_needed || false,
        previousParticipant: data.previous_participant || false,
      });
    }
  }

  function update(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function validateStep1() {
    if (!form.businessName) return 'Nom du commerce / activité requis';
    if (!form.siret || form.siret.replace(/\s/g, '').length !== 14) return 'SIRET invalide (14 chiffres requis)';
    if (!form.address || !form.city || !form.postalCode) return 'Adresse complète requise';
    return null;
  }

  function validateStep2() {
    if (!form.productCategory) return 'Catégorie de produits requise';
    if (!form.productDescription || form.productDescription.length < 20) return 'Description requise (min. 20 caractères)';
    return null;
  }

  async function uploadPhotos(photoList: any[], candidatureId: string, userId: string) {
    for (const photo of photoList) {
      try {
        const ext = (photo.name ?? 'photo').split('.').pop() || 'jpg';
        const path = `${userId}/${candidatureId}/${Date.now()}.${ext}`;
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        const { data: uploadData } = await supabase.storage
          .from('product-photos')
          .upload(path, blob, { contentType: `image/${ext}` });
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('product-photos').getPublicUrl(path);
          await (supabase.from('documents') as any).insert({
            candidature_id: candidatureId,
            uploaded_by: userId,
            file_name: photo.name,
            file_url: publicUrl,
            file_type: 'image',
            doc_category: 'product_photo',
          });
        }
      } catch {}
    }
  }

  async function handleSubmit() {
    const err2 = validateStep2();
    if (err2) { setErrorMsg(err2); return; }

    setErrorMsg('');
    setSaving(true);

    const deadline = <T,>(p: Promise<T>): Promise<T> =>
      Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Délai dépassé — vérifiez votre connexion réseau')), 12000))]);

    try {
      if (!user) throw new Error('Non connecté');

      const payload = {
        user_id: user.id,
        business_name: form.businessName,
        siret: form.siret.replace(/\s/g, ''),
        siret_data: form.siretData as any,
        address: form.address,
        city: form.city,
        postal_code: form.postalCode,
        product_category: form.productCategory,
        product_description: form.productDescription,
        website_url: form.websiteUrl || null,
        instagram_url: form.instagramUrl || null,
        stand_size: form.standSize,
        electricity_needed: form.electricityNeeded,
        previous_participant: form.previousParticipant,
      };

      let candidatureId = existingId;

      if (existingId) {
        const { error } = await deadline((supabase.from('candidatures') as any).update(payload).eq('id', existingId)) as any;
        if (error) { console.error('[Submit] update error:', error); setErrorMsg(error.message); return; }
      } else {
        const { data, error } = await deadline((supabase.from('candidatures') as any).insert(payload).select().maybeSingle()) as any;
        if (error) { console.error('[Submit] insert error:', error); setErrorMsg(error.message); return; }
        candidatureId = data?.id;
      }

      if (photos.length > 0 && candidatureId) {
        uploadPhotos(photos, candidatureId, user.id);
      }
      router.replace('/(candidate)');
    } catch (e: any) {
      console.error('[Submit] exception:', e);
      setErrorMsg(e?.message ?? 'Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(s => s - 1) : router.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.stepText}>Étape {step}/2</Text>
      </View>

      <View style={styles.progress}>
        <View style={[styles.progressBar, { width: `${step * 50}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View>
            <Text style={styles.sectionTitle}>🏪 Informations professionnelles</Text>

            <Text style={styles.label}>Nom du commerce / activité *</Text>
            <TextInput style={styles.input} value={form.businessName} onChangeText={v => update('businessName', v)} placeholder="Ex: Les Douceurs de Marie" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Numéro SIRET *</Text>
            <SiretInput
              value={form.siret}
              onChange={v => update('siret', v)}
              onVerified={data => {
                update('siretData', data);
                if (data.adresse)    update('address',    data.adresse);
                if (data.code_postal) update('postalCode', data.code_postal);
                if (data.ville)      update('city',       data.ville);
              }}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Adresse *</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={v => update('address', v)} placeholder="10 rue de la Paix" placeholderTextColor={Colors.textMuted} />

            <View style={styles.row}>
              <View style={styles.quarter}>
                <Text style={styles.label}>Code postal *</Text>
                <TextInput style={styles.input} value={form.postalCode} onChangeText={v => update('postalCode', v)} placeholder="01000" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" maxLength={5} />
              </View>
              <View style={styles.threeQuarters}>
                <Text style={styles.label}>Ville *</Text>
                <TextInput style={styles.input} value={form.city} onChangeText={v => update('city', v)} placeholder="Bourg-sur-Gironde" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={() => { const e = validateStep1(); if (e) { Alert.alert('Champs manquants', e); } else { setStep(2); } }}>
              <Text style={styles.nextBtnText}>Étape suivante →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.sectionTitle}>🛍️ Vos produits</Text>

            <Text style={styles.label}>Catégorie *</Text>
            <View style={styles.categoryGrid}>
              {ProductCategories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryBtn, form.productCategory === cat && styles.categoryBtnActive]}
                  onPress={() => update('productCategory', cat)}
                >
                  <Text style={[styles.categoryBtnText, form.productCategory === cat && styles.categoryBtnTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Description de vos produits * (min. 20 car.)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.productDescription}
              onChangeText={v => update('productDescription', v)}
              placeholder="Décrivez vos produits, leur fabrication, leur origine..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={5}
            />
            <Text style={styles.charCount}>{form.productDescription.length} / 1000</Text>

            <Text style={styles.label}>Site web</Text>
            <TextInput style={styles.input} value={form.websiteUrl} onChangeText={v => update('websiteUrl', v)} placeholder="https://monsite.fr" placeholderTextColor={Colors.textMuted} keyboardType="url" autoCapitalize="none" />

            <Text style={styles.label}>Instagram</Text>
            <View style={styles.instagramRow}>
              <View style={styles.instagramPrefix}>
                <Text style={styles.instagramAt}>@</Text>
              </View>
              <TextInput
                style={[styles.input, styles.instagramInput]}
                value={form.instagramUrl}
                onChangeText={v => update('instagramUrl', v.replace('@', ''))}
                placeholder="mon_compte"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.sectionTitle}>📐 Stand & logistique</Text>

            <Text style={styles.label}>Taille du stand souhaitée</Text>
            <View style={styles.standRow}>
              {['3m', '6m', '9m'].map(size => (
                <TouchableOpacity
                  key={size}
                  style={[styles.standBtn, form.standSize === size && styles.standBtnActive]}
                  onPress={() => update('standSize', size)}
                >
                  <Text style={[styles.standBtnText, form.standSize === size && styles.standBtnTextActive]}>{size}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Besoin d'électricité</Text>
              <Switch value={form.electricityNeeded} onValueChange={v => update('electricityNeeded', v)} trackColor={{ false: Colors.border, true: Colors.primary }} />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Déjà participant</Text>
              <Switch value={form.previousParticipant} onValueChange={v => update('previousParticipant', v)} trackColor={{ false: Colors.border, true: Colors.primary }} />
            </View>

            <Text style={styles.sectionTitle}>📷 Photos de vos produits</Text>
            <Text style={styles.hint}>Ajoutez jusqu'à 6 photos de vos produits</Text>
            <PhotoPicker onPhotosChange={setPhotos} maxPhotos={6} />

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={saving}
            >
              <Text style={styles.submitBtnText}>
                {saving ? 'Envoi en cours...' : existingId ? '💾 Mettre à jour' : '📤 Envoyer ma candidature'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  backText: { color: Colors.textSecondary, fontSize: 16 },
  stepText: { color: Colors.textSecondary, fontSize: 14 },
  progress: { height: 3, backgroundColor: Colors.border, marginHorizontal: 20, borderRadius: 2, marginBottom: 4 },
  progressBar: { height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  scroll: { padding: 20, paddingBottom: 60 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.gold, marginTop: 8, marginBottom: 16 },
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, color: Colors.text, fontSize: 16, marginBottom: 16 },
  textarea: { height: 120, textAlignVertical: 'top' },
  charCount: { color: Colors.textMuted, fontSize: 12, textAlign: 'right', marginTop: -12, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10 },
  quarter: { flex: 2 },
  threeQuarters: { flex: 3 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryBtn: { backgroundColor: Colors.card, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  categoryBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryBtnText: { color: Colors.textSecondary, fontSize: 13 },
  categoryBtnTextActive: { color: '#fff', fontWeight: 'bold' },
  standRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  standBtn: { flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  standBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  standBtnText: { color: Colors.textSecondary, fontSize: 15, fontWeight: 'bold' },
  standBtnTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  switchLabel: { color: Colors.text, fontSize: 15 },
  hint: { color: Colors.textMuted, fontSize: 13, marginBottom: 12 },
  nextBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  nextBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  submitBtn: { backgroundColor: Colors.secondary, borderRadius: 10, padding: 18, alignItems: 'center', marginTop: 24 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: '#DC2626', fontSize: 14 },
  instagramRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  instagramPrefix: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRightWidth: 0, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, padding: 14, justifyContent: 'center' },
  instagramAt: { color: Colors.textSecondary, fontSize: 16, fontWeight: 'bold' },
  instagramInput: { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginBottom: 0 },
});
