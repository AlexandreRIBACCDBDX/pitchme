import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';

const STATUS_CONFIG: Record<string, { icon: string; bg: string; tint: string; label: string; hint: string }> = {
  pending:   { icon: '⏳', bg: '#FEF3C7', tint: '#D97706', label: 'En attente',     hint: "Votre dossier est bien reçu et attend d'être lu par l'équipe organisatrice." },
  reviewing: { icon: '🔍', bg: '#DBEAFE', tint: '#2563EB', label: 'En cours d\'étude', hint: "Votre dossier est en cours d'examen. Nous reviendrons vers vous prochainement." },
  accepted:  { icon: '🎉', bg: '#D1FAE5', tint: '#059669', label: 'Retenu !',       hint: "Félicitations ! Votre candidature a été retenue pour le Marché de Noël." },
  rejected:  { icon: '❌', bg: '#FEE2E2', tint: '#DC2626', label: 'Non retenu',     hint: "Votre candidature n'a pas été retenue cette année." },
};

const TYPE_LABEL: Record<string, string> = {
  market:    '🏪 Stand marché',
  foodtruck: '🚚 Food Truck',
};

export default function MonEspace() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candidature, setCandidature] = useState<any>(null);

  function formatCode(raw: string) {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length <= 4) return clean;
    return clean.slice(0, 4) + '-' + clean.slice(4, 8);
  }

  async function handleSearch() {
    const cleaned = code.replace(/\s/g, '');
    if (cleaned.length < 9) { setError('Le code doit contenir 8 caractères (ex: ABCD-EF23)'); return; }

    setError('');
    setLoading(true);
    setCandidature(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_candidature_by_access_code', { p_code: cleaned });
      if (rpcError) throw rpcError;
      if (!data || (Array.isArray(data) && data.length === 0)) {
        setError('Aucune candidature trouvée pour ce code. Vérifiez le code reçu après votre inscription.');
        return;
      }
      setCandidature(Array.isArray(data) ? data[0] : data);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }

  const cfg = candidature ? (STATUS_CONFIG[candidature.status] ?? STATUS_CONFIG.pending) : null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <AppLogo size={44} />
          <View style={styles.wordmark}>
            <Text style={styles.wordmarkBold}>Pitch</Text>
            <Text style={styles.wordmarkLight}>Me</Text>
          </View>
        </View>

        <Text style={styles.title}>Mon espace candidat</Text>
        <Text style={styles.sub}>Entrez le code reçu lors de votre inscription pour consulter l'état de votre dossier.</Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={v => { setCode(formatCode(v)); setError(''); setCandidature(null); }}
            placeholder="ABCD-EF23"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={9}
          />
          <TouchableOpacity
            style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.searchBtnText}>Accéder →</Text>
            }
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {candidature && cfg && (
          <View style={styles.result}>
            {/* En-tête statut */}
            <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
              <Text style={styles.statusIcon}>{cfg.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusLabel, { color: cfg.tint }]}>{cfg.label}</Text>
                <Text style={styles.statusHint}>{cfg.hint}</Text>
              </View>
            </View>

            {/* Infos candidature */}
            <View style={styles.infoBlock}>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Commerce</Text>
                <Text style={styles.infoValue}>{candidature.business_name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Type</Text>
                <Text style={styles.infoValue}>{TYPE_LABEL[candidature.candidature_type ?? 'market'] ?? '—'}</Text>
              </View>
              {candidature.product_category ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Catégorie</Text>
                  <Text style={styles.infoValue}>{candidature.product_category}</Text>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Déposée le</Text>
                <Text style={styles.infoValue}>
                  {new Date(candidature.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Contact</Text>
                <Text style={styles.infoValue}>{candidature.contact_first_name} {candidature.contact_last_name}</Text>
              </View>
            </View>

            {/* Motif de refus */}
            {candidature.status === 'rejected' && candidature.rejection_reason ? (
              <View style={styles.rejectionBox}>
                <Text style={styles.rejectionTitle}>Motif de refus</Text>
                <Text style={styles.rejectionText}>{candidature.rejection_reason}</Text>
              </View>
            ) : null}

            {/* Message accepté */}
            {candidature.status === 'accepted' && (
              <View style={styles.acceptedBox}>
                <Text style={styles.acceptedText}>
                  L'équipe organisatrice vous contactera à l'adresse {candidature.contact_email} pour les prochaines étapes.
                </Text>
              </View>
            )}

            <View style={styles.codeReminder}>
              <Text style={styles.codeReminderText}>Votre code d'accès : </Text>
              <Text style={styles.codeReminderCode}>{candidature.access_code}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  scroll:      { padding: 24, paddingTop: 56, paddingBottom: 48 },
  backBtn:     { marginBottom: 24 },
  backText:    { color: Colors.textSecondary, fontSize: 16 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  wordmark:    { flexDirection: 'row', alignItems: 'baseline' },
  wordmarkBold:  { fontSize: 22, fontWeight: '800', color: Colors.text },
  wordmarkLight: { fontSize: 22, fontWeight: '300', color: Colors.primary },
  title:       { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  sub:         { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: 28 },
  inputRow:    { flexDirection: 'row', gap: 10, marginBottom: 16 },
  codeInput:   { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, color: Colors.text, fontSize: 20, fontWeight: 'bold', letterSpacing: 3, textAlign: 'center' },
  searchBtn:   { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  errorBox:    { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  errorText:   { color: '#DC2626', fontSize: 14 },

  result:       { backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginTop: 8 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  statusIcon:   { fontSize: 32 },
  statusLabel:  { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  statusHint:   { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  infoBlock:    { padding: 18, gap: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoKey:      { fontSize: 13, color: Colors.textMuted, flex: 1 },
  infoValue:    { fontSize: 14, color: Colors.text, fontWeight: '600', flex: 2, textAlign: 'right' },
  rejectionBox: { margin: 18, marginTop: 0, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#FECACA' },
  rejectionTitle: { color: '#DC2626', fontWeight: 'bold', fontSize: 13, marginBottom: 6 },
  rejectionText:  { color: Colors.text, fontSize: 14, lineHeight: 20 },
  acceptedBox:  { margin: 18, marginTop: 0, backgroundColor: '#D1FAE5', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#6EE7B7' },
  acceptedText: { color: '#065F46', fontSize: 14, lineHeight: 20 },
  codeReminder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  codeReminderText: { color: Colors.textMuted, fontSize: 12 },
  codeReminderCode: { color: Colors.text, fontSize: 13, fontWeight: 'bold', letterSpacing: 2 },
});
