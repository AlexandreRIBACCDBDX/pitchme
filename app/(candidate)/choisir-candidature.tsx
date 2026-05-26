import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';

export default function ChoisirCandidature() {
  const [foodtruckEnabled, setFoodtruckEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase.from('app_settings') as any)
          .select('value')
          .eq('key', 'foodtruck_module')
          .maybeSingle();
        setFoodtruckEnabled(data?.value?.enabled === true);
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.header}>
        <AppLogo size={52} />
        <View style={styles.wordmark}>
          <Text style={styles.wordmarkBold}>Pitch</Text>
          <Text style={styles.wordmarkLight}>Me</Text>
        </View>
        <Text style={styles.subtitle}>Marché de Noël · Bourg-sur-Gironde</Text>
      </View>

      <Text style={styles.title}>Quel type de candidature ?</Text>
      <Text style={styles.sub}>Choisissez le formulaire correspondant à votre activité</Text>

      <View style={styles.cards}>
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(candidate)/candidature')} activeOpacity={0.85}>
          <Text style={styles.cardEmoji}>🏪</Text>
          <Text style={styles.cardTitle}>Stand marché</Text>
          <Text style={styles.cardDesc}>
            Artisanat, alimentation, bijoux, textile, cosmétiques et autres produits exposés sur stand.
          </Text>
          <View style={styles.cardBtn}>
            <Text style={styles.cardBtnText}>Candidater →</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, !foodtruckEnabled && styles.cardDisabled]}
          onPress={() => foodtruckEnabled && router.push('/(candidate)/candidature-foodtruck')}
          activeOpacity={foodtruckEnabled ? 0.85 : 1}
        >
          <Text style={styles.cardEmoji}>🚚</Text>
          <Text style={[styles.cardTitle, !foodtruckEnabled && styles.cardTitleDisabled]}>Food Truck</Text>
          <Text style={[styles.cardDesc, !foodtruckEnabled && styles.cardDescDisabled]}>
            Restauration itinérante, snacking, boissons artisanales. Formulaire adapté avec menu et logistique véhicule.
          </Text>
          {foodtruckEnabled ? (
            <View style={[styles.cardBtn, { backgroundColor: Colors.secondary }]}>
              <Text style={styles.cardBtnText}>Candidater →</Text>
            </View>
          ) : (
            <View style={styles.disabledBadge}>
              <Text style={styles.disabledBadgeText}>🔒 Non disponible cette année</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.adminLink} onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.adminLinkText}>Accès organisateur</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  container:   { flex: 1, backgroundColor: Colors.background },
  content:     { padding: 24, paddingTop: 56, paddingBottom: 48 },
  header:      { alignItems: 'center', marginBottom: 36 },
  wordmark:    { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  wordmarkBold:  { fontSize: 26, fontWeight: '800', color: Colors.text },
  wordmarkLight: { fontSize: 26, fontWeight: '300', color: Colors.primary },
  subtitle:    { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  title:       { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  sub:         { fontSize: 15, color: Colors.textSecondary, marginBottom: 28 },
  cards:       { gap: 16 },
  card:        { backgroundColor: Colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border },
  cardDisabled: { opacity: 0.55, backgroundColor: Colors.surface },
  cardEmoji:   { fontSize: 40, marginBottom: 12 },
  cardTitle:   { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  cardTitleDisabled: { color: Colors.textMuted },
  cardDesc:    { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: 20 },
  cardDescDisabled: { color: Colors.textMuted },
  cardBtn:     { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  cardBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  disabledBadge:     { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  disabledBadgeText: { color: Colors.textMuted, fontSize: 13 },
  adminLink:   { marginTop: 40, alignItems: 'center' },
  adminLinkText: { color: Colors.textMuted, fontSize: 12 },
});
