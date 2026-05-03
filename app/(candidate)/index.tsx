import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Candidature } from '@/types/database';
import { Colors, StatusLabels, StatusColors } from '@/constants/theme';
import StatusBadge from '@/components/StatusBadge';

export default function CandidateDashboard() {
  const { profile, signOut } = useAuth();
  const [candidature, setCandidature] = useState<Candidature | null>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    loadCandidature();
  }, []);

  async function loadCandidature() {
    const { data } = await supabase
      .from('candidatures')
      .select('*')
      .single();
    setCandidature(data);

    if (data) {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('candidature_id', data.id)
        .eq('is_read', false)
        .neq('sender_id', (await supabase.auth.getUser()).data.user?.id);
      setUnread(count || 0);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.name}>{profile?.first_name || 'Candidat'} {profile?.last_name || ''}</Text>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>🎄</Text>
          <Text style={styles.heroTitle}>Marché de Noël</Text>
          <Text style={styles.heroSub}>Bourg-sur-Gironde 2025</Text>
        </View>

        {!candidature ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyTitle}>Aucune candidature</Text>
            <Text style={styles.emptyText}>
              Déposez votre candidature pour participer au Marché de Noël de Bourg-sur-Gironde.
            </Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/(candidate)/candidature')}>
              <Text style={styles.ctaBtnText}>Déposer ma candidature</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Text style={styles.statusTitle}>Ma candidature</Text>
                <StatusBadge status={candidature.status} />
              </View>
              <Text style={styles.businessName}>{candidature.business_name}</Text>
              <Text style={styles.siretText}>SIRET : {candidature.siret}</Text>
              <Text style={styles.dateText}>
                Déposée le {new Date(candidature.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>

              {candidature.status === 'rejected' && candidature.rejection_reason && (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionTitle}>Motif de refus :</Text>
                  <Text style={styles.rejectionText}>{candidature.rejection_reason}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionsGrid}>
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(candidate)/messages')}>
                <Text style={styles.actionEmoji}>💬</Text>
                <Text style={styles.actionLabel}>Messages</Text>
                {unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {(candidature.status === 'pending' || candidature.status === 'reviewing') && (
                <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(candidate)/candidature')}>
                  <Text style={styles.actionEmoji}>📁</Text>
                  <Text style={styles.actionLabel}>Compléter</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Informations</Text>
              <InfoRow label="Produits" value={candidature.product_category} />
              <InfoRow label="Stand" value={candidature.stand_size || '—'} />
              <InfoRow label="Électricité" value={candidature.electricity_needed ? 'Oui' : 'Non'} />
              <InfoRow label="Ancien exposant" value={candidature.previous_participant ? 'Oui' : 'Non'} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  greeting: { color: Colors.textSecondary, fontSize: 14 },
  name: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },
  signOutBtn: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  signOutText: { color: Colors.textSecondary, fontSize: 13 },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16 },
  heroCard: { backgroundColor: Colors.primaryDark, borderRadius: 16, padding: 24, alignItems: 'center' },
  heroEmoji: { fontSize: 40, marginBottom: 8 },
  heroTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.gold },
  heroSub: { color: Colors.text, marginTop: 4 },
  emptyCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  ctaBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32 },
  ctaBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  statusCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusTitle: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  businessName: { color: Colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  siretText: { color: Colors.textSecondary, fontSize: 13 },
  dateText: { color: Colors.textMuted, fontSize: 12, marginTop: 8 },
  rejectionBox: { backgroundColor: Colors.error + '22', borderRadius: 10, padding: 14, marginTop: 12, borderWidth: 1, borderColor: Colors.error },
  rejectionTitle: { color: Colors.error, fontWeight: 'bold', marginBottom: 4 },
  rejectionText: { color: Colors.text, fontSize: 14 },
  actionsGrid: { flexDirection: 'row', gap: 12 },
  actionCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, position: 'relative' },
  actionEmoji: { fontSize: 32, marginBottom: 8 },
  actionLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  badge: { position: 'absolute', top: 10, right: 10, backgroundColor: Colors.primary, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  infoCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  infoTitle: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { color: Colors.textSecondary, fontSize: 14 },
  infoValue: { color: Colors.text, fontSize: 14, fontWeight: '500' },
});
