import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, StatusLabels } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';

const STATUS_CONFIG: Record<string, { icon: string; bg: string; tint: string; hint: string }> = {
  pending:   { icon: '⏳', bg: '#FEF3C7', tint: '#D97706', hint: "En attente de lecture par l'équipe organisatrice." },
  reviewing: { icon: '🔍', bg: '#DBEAFE', tint: '#2563EB', hint: "Dossier en cours d'examen. Nous reviendrons vers vous." },
  accepted:  { icon: '🎉', bg: '#D1FAE5', tint: '#059669', hint: 'Candidature retenue pour le Marché de Noël !' },
  rejected:  { icon: '❌', bg: '#FEE2E2', tint: '#DC2626', hint: "Candidature non retenue cette année." },
};

const TYPE_CONFIG: Record<string, { emoji: string; label: string }> = {
  market:    { emoji: '🏪', label: 'Stand marché' },
  foodtruck: { emoji: '🚚', label: 'Food Truck' },
};

const STEPS = ['Déposée', 'En étude', 'Décision'];

function stepProgress(status: string): number {
  if (status === 'pending')   return 1;
  if (status === 'reviewing') return 2;
  return 3;
}

export default function CandidateDashboard() {
  const { profile, signOut } = useAuth();
  const [candidatures, setCandidatures] = useState<any[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [foodtruckEnabled, setFoodtruckEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('candidate-candidatures-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatures' }, () => {
        load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  async function load() {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const [{ data: cands }, { data: setting }] = await Promise.all([
      supabase.from('candidatures').select('*').order('created_at'),
      (supabase.from('app_settings') as any).select('value').eq('key', 'foodtruck_module').maybeSingle(),
    ]);

    setCandidatures(cands ?? []);
    setFoodtruckEnabled(setting?.value?.enabled === true);

    // Unread messages count per candidature
    if (cands?.length && userId) {
      const counts: Record<string, number> = {};
      await Promise.all(cands.map(async c => {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('candidature_id', c.id)
          .eq('is_read', false)
          .neq('sender_id', userId);
        counts[c.id] = count || 0;
      }));
      setUnreadMap(counts);
    }
    setLoading(false);
    setRefreshing(false);
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const hasMarket    = candidatures.some(c => !c.candidature_type || c.candidature_type === 'market');
  const hasFoodtruck = candidatures.some(c => c.candidature_type === 'foodtruck');
  const canAddMarket    = !hasMarket;
  const canAddFoodtruck = !hasFoodtruck && foodtruckEnabled;
  const hasNone = candidatures.length === 0;

  return (
    <View style={styles.root}>

      {/* ── Hero header ── */}
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.heroLogo}>
              <AppLogo size={28} light />
              <Text style={styles.heroWordmarkBold}>Pitch</Text>
              <Text style={styles.heroWordmarkLight}>Me</Text>
            </View>
            <Text style={styles.heroGreet}>
              Bonjour, {profile?.first_name || 'Candidat'}{profile?.last_name ? ' ' + profile.last_name : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
            <Text style={styles.signOutIcon}>⏏</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >

        {/* ── No candidature at all ── */}
        {hasNone && (
          <View style={styles.inviteCard}>
            <Text style={styles.inviteEmoji}>📋</Text>
            <Text style={styles.inviteTitle}>Prêt à candidater ?</Text>
            <Text style={styles.inviteText}>
              Déposez votre dossier en quelques minutes et rejoignez les exposants du Marché de Noël.
            </Text>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => router.push('/(candidate)/choisir-candidature')}
            >
              <Text style={styles.ctaBtnText}>Déposer ma candidature →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── One card per candidature ── */}
        {candidatures.map(c => (
          <CandidatureCard
            key={c.id}
            candidature={c}
            unread={unreadMap[c.id] ?? 0}
          />
        ))}

        {/* ── Add another candidature ── */}
        {!hasNone && (canAddMarket || canAddFoodtruck) && (
          <View style={styles.addSection}>
            <Text style={styles.addSectionTitle}>Déposer une autre candidature</Text>
            <Text style={styles.addSectionSub}>
              Vous pouvez participer avec différentes activités.
            </Text>
            <View style={styles.addButtons}>
              {canAddMarket && (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => router.push('/(candidate)/candidature')}
                >
                  <Text style={styles.addBtnEmoji}>🏪</Text>
                  <View>
                    <Text style={styles.addBtnLabel}>Stand marché</Text>
                    <Text style={styles.addBtnSub}>Artisanat, alimentation, bijoux…</Text>
                  </View>
                  <Text style={styles.addBtnArrow}>→</Text>
                </TouchableOpacity>
              )}
              {canAddFoodtruck && (
                <TouchableOpacity
                  style={[styles.addBtn, { borderColor: Colors.secondary }]}
                  onPress={() => router.push('/(candidate)/candidature-foodtruck')}
                >
                  <Text style={styles.addBtnEmoji}>🚚</Text>
                  <View>
                    <Text style={styles.addBtnLabel}>Food Truck</Text>
                    <Text style={styles.addBtnSub}>Restauration itinérante…</Text>
                  </View>
                  <Text style={[styles.addBtnArrow, { color: Colors.secondary }]}>→</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

function CandidatureCard({ candidature: c, unread }: { candidature: any; unread: number }) {
  const cfg    = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending;
  const type   = TYPE_CONFIG[c.candidature_type ?? 'market'] ?? TYPE_CONFIG.market;
  const progress = stepProgress(c.status);
  const canEdit  = c.status === 'pending' || c.status === 'reviewing';
  const editRoute = c.candidature_type === 'foodtruck'
    ? '/(candidate)/candidature-foodtruck'
    : '/(candidate)/candidature';
  const finalDotColor = c.status === 'rejected' ? '#DC2626'
    : c.status === 'accepted' ? '#059669'
    : Colors.primary;

  return (
    <View style={styles.candCard}>
      {/* Type tag */}
      <View style={styles.typeTag}>
        <Text style={styles.typeTagEmoji}>{type.emoji}</Text>
        <Text style={styles.typeTagLabel}>{type.label}</Text>
      </View>

      {/* Status banner */}
      <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
        <Text style={styles.statusIcon}>{cfg.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusLabel, { color: cfg.tint }]}>
            {StatusLabels[c.status]}
          </Text>
          <Text style={styles.statusHint}>{cfg.hint}</Text>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.timeline}>
        {STEPS.map((label, idx) => {
          const done  = progress > idx;
          const active = progress === idx + 1;
          const isFirst = idx === 0;
          const isLast  = idx === STEPS.length - 1;
          const dotColor = (done || active) ? (idx === 2 ? finalDotColor : Colors.primary) : Colors.border;
          return (
            <View key={label} style={styles.timelineStep}>
              <View style={[styles.halfLine, { backgroundColor: isFirst ? 'transparent' : (progress > idx ? Colors.primary : Colors.border) }]} />
              <View style={styles.stepCol}>
                <View style={[styles.stepDot, { backgroundColor: dotColor, borderColor: dotColor }]}>
                  {(done || active) && <Text style={styles.stepCheck}>✓</Text>}
                </View>
                <Text style={[styles.stepLabel, (done || active) && styles.stepLabelActive]}>{label}</Text>
              </View>
              <View style={[styles.halfLine, { backgroundColor: isLast ? 'transparent' : (done && !isLast ? Colors.primary : Colors.border) }]} />
            </View>
          );
        })}
      </View>

      {/* Business info */}
      <View style={styles.infoBlock}>
        <View style={[styles.businessAvatar, { backgroundColor: cfg.tint + '18' }]}>
          <Text style={[styles.businessAvatarLetter, { color: cfg.tint }]}>
            {(c.business_name?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.businessName}>{c.business_name}</Text>
          <Text style={styles.businessDate}>
            Déposée le {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Rejection reason */}
      {c.status === 'rejected' && c.rejection_reason && (
        <View style={styles.rejectionBox}>
          <Text style={styles.rejectionTitle}>Motif de refus</Text>
          <Text style={styles.rejectionText}>{c.rejection_reason}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => router.push('/(candidate)/messages')}>
          <Text style={styles.actionBtnIcon}>💬</Text>
          <Text style={[styles.actionBtnLabel, { color: '#fff' }]}>Messages</Text>
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unread}</Text>
            </View>
          )}
        </TouchableOpacity>
        {canEdit && (
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={() => router.push(editRoute as any)}>
            <Text style={styles.actionBtnIcon}>✏️</Text>
            <Text style={[styles.actionBtnLabel, { color: Colors.text }]}>Modifier</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.surface },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },

  hero:              { backgroundColor: Colors.primaryDark, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 },
  heroRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroLogo:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  heroWordmarkBold:  { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  heroWordmarkLight: { fontSize: 17, fontWeight: '300', color: '#93C5FD' },
  heroGreet:         { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  signOutBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  signOutIcon: { color: '#fff', fontSize: 15 },

  scroll: { padding: 16, gap: 16, paddingBottom: 48 },

  // Invite
  inviteCard:  { backgroundColor: Colors.card, borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  inviteEmoji: { fontSize: 52, marginBottom: 14 },
  inviteTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  inviteText:  { color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24, fontSize: 15 },
  ctaBtn:      { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 28, width: '100%', alignItems: 'center' },
  ctaBtnText:  { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Candidature card wrapper
  candCard: { backgroundColor: Colors.card, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },

  // Type tag
  typeTag:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  typeTagEmoji: { fontSize: 18 },
  typeTagLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.3 },

  // Status banner
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  statusIcon:   { fontSize: 30 },
  statusLabel:  { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  statusHint:   { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  // Timeline
  timeline:     { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 8, paddingBottom: 16 },
  timelineStep: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  halfLine:     { flex: 1, height: 2 },
  stepCol:      { alignItems: 'center', gap: 6 },
  stepDot:      { width: 26, height: 26, borderRadius: 13, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  stepCheck:    { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  stepLabel:    { fontSize: 10, color: Colors.textMuted, textAlign: 'center', width: 54 },
  stepLabelActive: { color: Colors.text, fontWeight: '600' },

  // Business info
  infoBlock:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  businessAvatar:      { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  businessAvatarLetter:{ fontSize: 18, fontWeight: 'bold' },
  businessName:        { fontSize: 15, fontWeight: 'bold', color: Colors.text },
  businessDate:        { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // Rejection
  rejectionBox:  { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FECACA' },
  rejectionTitle: { color: '#DC2626', fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
  rejectionText:  { color: Colors.text, fontSize: 13, lineHeight: 19 },

  // Actions
  actionRow:        { flexDirection: 'row', gap: 10, padding: 16, paddingTop: 0 },
  actionBtn:        { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', gap: 4, position: 'relative' },
  actionBtnPrimary: { backgroundColor: Colors.primary },
  actionBtnOutline: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  actionBtnIcon:    { fontSize: 20 },
  actionBtnLabel:   { fontSize: 13, fontWeight: '700' },
  unreadBadge:      { position: 'absolute', top: 8, right: 8, backgroundColor: '#EF4444', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  unreadText:       { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Add another candidature
  addSection:     { backgroundColor: Colors.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border },
  addSectionTitle: { fontSize: 15, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  addSectionSub:   { fontSize: 13, color: Colors.textSecondary, marginBottom: 14 },
  addButtons:      { gap: 10 },
  addBtn:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.primary },
  addBtnEmoji:     { fontSize: 28 },
  addBtnLabel:     { fontSize: 14, fontWeight: '700', color: Colors.text },
  addBtnSub:       { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  addBtnArrow:     { marginLeft: 'auto', fontSize: 18, color: Colors.primary, fontWeight: 'bold' },
});
