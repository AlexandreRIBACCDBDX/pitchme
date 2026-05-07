import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, StatusColors, StatusLabels } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';

const SECTIONS = [
  { key: 'pending',   title: 'EN ATTENTE DE VALIDATION', border: '#EF4444', actions: ['reviewing', 'rejected'] },
  { key: 'reviewing', title: "EN COURS D'ÉTUDE",          border: '#F59E0B', actions: ['accepted', 'rejected'] },
  { key: 'accepted',  title: 'RETENUS',                   border: '#10B981', numbered: true },
  { key: 'rejected',  title: 'REFUSÉS',                   border: '#9CA3AF' },
] as const;

const STATUS_BG: Record<string, string> = {
  pending: '#FEF2F2', reviewing: '#FFFBEB', accepted: '#ECFDF5', rejected: '#F9FAFB',
};

const ACTION_LABEL: Record<string, string> = {
  reviewing: '→ Étude', accepted: '✓ Retenir', rejected: '✗ Refuser',
};
const ACTION_COLOR: Record<string, string> = {
  reviewing: '#F59E0B', accepted: '#10B981', rejected: '#EF4444',
};

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [candidatures, setCandidatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    load();

    const channel = supabase
      .channel('admin-candidatures-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatures' }, () => {
        load();
      })
      .subscribe((status) => {
        setRealtimeStatus(
          status === 'SUBSCRIBED'    ? 'connected'  :
          status === 'CHANNEL_ERROR' ? 'error'       : 'connecting'
        );
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function load() {
    const { data } = await supabase
      .from('candidatures')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });
    if (data) {
      setCandidatures(data);
      setSelected((s: any) => s ? (data.find(c => c.id === s.id) ?? null) : null);
    }
    setLastUpdated(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    setLoading(false);
    setRefreshing(false);
  }

  async function manualRefresh() {
    setRefreshing(true);
    await load();
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(true);
    await (supabase.from('candidatures') as any).update({ status }).eq('id', id);
    await load();
    setUpdating(false);
  }

  const q = search.toLowerCase();
  const filtered = search
    ? candidatures.filter(c =>
        c.business_name?.toLowerCase().includes(q) ||
        c.siret?.includes(q) ||
        c.profiles?.first_name?.toLowerCase().includes(q) ||
        c.profiles?.last_name?.toLowerCase().includes(q)
      )
    : candidatures;

  const grouped = Object.fromEntries(
    SECTIONS.map(s => [s.key, filtered.filter(c => c.status === s.key)])
  );

  const counts = Object.fromEntries(
    SECTIONS.map(s => [s.key, candidatures.filter(c => c.status === s.key).length])
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.root}>

      {/* ── Sidebar ── */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarTop}>
          <View style={styles.logoRow}>
            <AppLogo size={36} />
            <View style={styles.sidebarWordmark}>
              <Text style={styles.appTitleBold}>Pitch</Text>
              <Text style={styles.appTitleLight}>Me</Text>
            </View>
          </View>
          <Text style={styles.appSub}>Marché de Noël · Bourg-sur-Gironde</Text>
        </View>

        <Text style={styles.sidebarLabel}>STATUTS</Text>
        <SidebarItem dot="#64748B" label="Toutes" count={candidatures.length} />
        <SidebarItem dot="#EF4444" label="En attente" count={counts.pending} />
        <SidebarItem dot="#F59E0B" label="En étude"   count={counts.reviewing} />
        <SidebarItem dot="#10B981" label="Retenues"   count={counts.accepted} />
        <SidebarItem dot="#9CA3AF" label="Refusées"   count={counts.rejected} />

        <Text style={[styles.sidebarLabel, { marginTop: 24 }]}>OUTILS</Text>
        <TouchableOpacity style={styles.sidebarBtn} onPress={() => router.push('/(admin)/qrcode')}>
          <Text style={styles.sidebarBtnText}>📱 QR Code candidature</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sidebarBtn} onPress={() => router.push('/(admin)/modules')}>
          <Text style={styles.sidebarBtnText}>⚙️ Modules</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* ── Realtime status + manual refresh ── */}
        <View style={styles.realtimeBar}>
          <View style={[styles.realtimeDot, {
            backgroundColor:
              realtimeStatus === 'connected'  ? '#10B981' :
              realtimeStatus === 'error'      ? '#EF4444' : '#F59E0B',
          }]} />
          <Text style={styles.realtimeText}>
            {realtimeStatus === 'connected'  ? 'Temps réel' :
             realtimeStatus === 'error'      ? 'Hors ligne' : 'Connexion…'}
          </Text>
          <TouchableOpacity onPress={manualRefresh} disabled={refreshing} style={styles.refreshBtn}>
            <Text style={[styles.refreshIcon, refreshing && { opacity: 0.35 }]}>↻</Text>
          </TouchableOpacity>
        </View>
        {lastUpdated ? (
          <Text style={styles.lastUpdated}>Mis à jour à {lastUpdated}</Text>
        ) : null}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>⏏  Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* ── Main list ── */}
      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="🔍  Rechercher un exposant, SIRET..."
          placeholderTextColor={Colors.textMuted}
        />

        {SECTIONS.map(section => {
          const items: any[] = grouped[section.key] ?? [];
          if (items.length === 0) return null;
          return (
            <View key={section.key} style={styles.section}>
              <View style={[styles.sectionHeader, { borderLeftColor: section.border }]}>
                <Text style={[styles.sectionTitle, { color: section.border }]}>
                  {section.title} ({items.length})
                </Text>
              </View>

              {items.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.card, selected?.id === item.id && styles.cardActive]}
                  onPress={() => setSelected(item)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardLeft}>
                    {'numbered' in section && section.numbered && (
                      <View style={[styles.numBadge, { backgroundColor: section.border }]}>
                        <Text style={styles.numText}>{idx + 1}</Text>
                      </View>
                    )}
                    <View style={[styles.avatar, { backgroundColor: section.border + '22' }]}>
                      <Text style={[styles.avatarLetter, { color: section.border }]}>
                        {(item.business_name?.[0] ?? '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.cardMeta}>
                      <Text style={styles.cardName}>{item.business_name}</Text>
                      <Text style={styles.cardSub}>
                        {item.profiles?.first_name} {item.profiles?.last_name}
                        {' · '}{item.product_category}
                        {' · '}{new Date(item.created_at).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardRight}>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[item.status] }]}>
                      <Text style={[styles.statusText, { color: StatusColors[item.status] }]}>
                        {StatusLabels[item.status]}
                      </Text>
                    </View>
                    {'actions' in section && section.actions && (
                      <View style={styles.actionRow}>
                        {section.actions.map((a: string) => (
                          <TouchableOpacity
                            key={a}
                            style={[styles.actionBtn, { backgroundColor: ACTION_COLOR[a] }]}
                            onPress={e => { e.stopPropagation?.(); updateStatus(item.id, a); }}
                            disabled={updating}
                          >
                            <Text style={styles.actionBtnText}>{ACTION_LABEL[a]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {/* ── Detail panel ── */}
      {selected && (
        <View style={styles.detail}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.detailHead}>
            <View style={[styles.detailAvatar, { backgroundColor: StatusColors[selected.status] + '22' }]}>
              <Text style={[styles.detailAvatarLetter, { color: StatusColors[selected.status] }]}>
                {(selected.business_name?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.detailName}>{selected.business_name}</Text>
            <Text style={styles.detailSub}>{selected.product_category}{selected.candidature_type === 'foodtruck' ? ' · Food Truck' : ''}</Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[selected.status], alignSelf: 'center', marginTop: 6 }]}>
              <Text style={[styles.statusText, { color: StatusColors[selected.status] }]}>
                {StatusLabels[selected.status]}
              </Text>
            </View>
          </View>

          {/* Quick action buttons */}
          <View style={styles.detailBtns}>
            {selected.status === 'pending' && (
              <QuickBtn label="→ Mettre en étude" color="#F59E0B" onPress={() => updateStatus(selected.id, 'reviewing')} disabled={updating} />
            )}
            {(selected.status === 'pending' || selected.status === 'reviewing') && (
              <>
                <QuickBtn label="✓ Retenir" color="#10B981" onPress={() => updateStatus(selected.id, 'accepted')} disabled={updating} />
                <QuickBtn label="✗ Refuser" color="#EF4444" onPress={() => updateStatus(selected.id, 'rejected')} disabled={updating} />
              </>
            )}
            {selected.status === 'rejected' && (
              <QuickBtn label="↩ Remettre en attente" color="#F59E0B" onPress={() => updateStatus(selected.id, 'pending')} disabled={updating} />
            )}
            <QuickBtn label="Dossier complet →" color={Colors.primary} onPress={() => router.push(`/(admin)/candidature/${selected.id}`)} />
          </View>

          <ScrollView style={styles.detailScroll}>
            <DetailBlock title="CONTACT">
              <DetailRow label="Nom" value={`${selected.profiles?.first_name ?? ''} ${selected.profiles?.last_name ?? ''}`} />
              <DetailRow label="Email" value={selected.profiles?.email ?? '—'} />
              {selected.profiles?.phone && <DetailRow label="Tél." value={selected.profiles.phone} />}
            </DetailBlock>

            <DetailBlock title="INFORMATIONS">
              <DetailRow label="SIRET" value={selected.siret} />
              <DetailRow label="Adresse" value={`${selected.address}, ${selected.postal_code} ${selected.city}`} />
              {selected.website_url && <DetailRow label="Site" value={selected.website_url} />}
              {selected.instagram_url && <DetailRow label="Instagram" value={`@${selected.instagram_url}`} />}
            </DetailBlock>

            <DetailBlock title="PRODUITS">
              <Text style={styles.detailDesc}>{selected.product_description}</Text>
            </DetailBlock>

            <DetailBlock title="LOGISTIQUE">
              <DetailRow label="Électricité" value={selected.electricity_needed ? 'Oui' : 'Non'} />
              <DetailRow label="Ancien exposant" value={selected.previous_participant ? 'Oui' : 'Non'} />
            </DetailBlock>

            <DetailBlock title="HISTORIQUE">
              <Text style={styles.detailDate}>
                Déposée le {new Date(selected.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>
            </DetailBlock>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function SidebarItem({ dot, label, count }: { dot: string; label: string; count: number }) {
  return (
    <View style={styles.sidebarItem}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={styles.sidebarItemLabel}>{label}</Text>
      <Text style={[styles.sidebarItemCount, { color: dot }]}>{count}</Text>
    </View>
  );
}

function QuickBtn({ label, color, onPress, disabled }: { label: string; color: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[styles.quickBtn, { backgroundColor: color }]} onPress={onPress} disabled={disabled}>
      <Text style={styles.quickBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailBlockTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  root:               { flex: 1, flexDirection: 'row', backgroundColor: '#F1F5F9' },

  // Sidebar
  sidebar:            { width: 220, backgroundColor: '#FFFFFF', borderRightWidth: 1, borderRightColor: '#E2E8F0', paddingVertical: 24, paddingHorizontal: 16, flexDirection: 'column' },
  sidebarTop:         { marginBottom: 28 },
  logoRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  sidebarWordmark:    { flexDirection: 'row', alignItems: 'baseline' },
  appTitleBold:       { fontSize: 20, fontWeight: '800', color: '#1A202C' },
  appTitleLight:      { fontSize: 20, fontWeight: '300', color: Colors.primary },
  appSub:             { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  sidebarLabel:       { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 10 },
  sidebarItem:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  dot:                { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  sidebarItemLabel:   { flex: 1, fontSize: 13, color: Colors.text },
  sidebarItemCount:   { fontSize: 13, fontWeight: '700' },
  sidebarBtn:         { backgroundColor: Colors.surface, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  sidebarBtnText:     { fontSize: 12, color: Colors.text },
  signOutBtn:         { paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8 },
  signOutText:        { fontSize: 13, color: Colors.textSecondary },
  realtimeBar:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 },
  realtimeDot:        { width: 8, height: 8, borderRadius: 4 },
  realtimeText:       { flex: 1, fontSize: 11, color: Colors.textSecondary },
  refreshBtn:         { padding: 4 },
  refreshIcon:        { fontSize: 16, color: Colors.primary, fontWeight: 'bold' },
  lastUpdated:        { fontSize: 9, color: Colors.textMuted, marginBottom: 6 },

  // Main
  main:               { flex: 1 },
  mainContent:        { padding: 20, paddingBottom: 40 },
  search:             { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 20 },

  // Section
  section:            { marginBottom: 24 },
  sectionHeader:      { borderLeftWidth: 4, paddingLeft: 12, marginBottom: 10 },
  sectionTitle:       { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  // Card
  card:               { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border },
  cardActive:         { borderColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.1, shadowRadius: 4 },
  cardLeft:           { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardMeta:           { flex: 1 },
  cardName:           { fontSize: 14, fontWeight: '600', color: Colors.text },
  cardSub:            { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  cardRight:          { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Avatar
  avatar:             { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarLetter:       { fontSize: 15, fontWeight: 'bold' },

  // Number badge (queue)
  numBadge:           { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  numText:            { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Status badge
  statusBadge:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText:         { fontSize: 11, fontWeight: '600' },

  // Action buttons on card
  actionRow:          { flexDirection: 'row', gap: 6, marginLeft: 8 },
  actionBtn:          { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  actionBtnText:      { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Detail panel
  detail:             { width: 300, backgroundColor: '#FFFFFF', borderLeftWidth: 1, borderLeftColor: Colors.border, flexDirection: 'column' },
  closeBtn:           { position: 'absolute', top: 14, right: 14, zIndex: 10, padding: 6 },
  closeBtnText:       { color: Colors.textMuted, fontSize: 16 },
  detailHead:         { alignItems: 'center', padding: 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailAvatar:       { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  detailAvatarLetter: { fontSize: 22, fontWeight: 'bold' },
  detailName:         { fontSize: 16, fontWeight: 'bold', color: Colors.text, textAlign: 'center' },
  detailSub:          { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  detailBtns:         { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  quickBtn:           { borderRadius: 8, padding: 10, alignItems: 'center' },
  quickBtnText:       { color: '#fff', fontSize: 12, fontWeight: '700' },
  detailScroll:       { flex: 1 },
  detailBlock:        { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailBlockTitle:   { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 10 },
  detailRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  detailRowLabel:     { fontSize: 12, color: Colors.textSecondary },
  detailRowValue:     { fontSize: 12, color: Colors.text, fontWeight: '500', flex: 1, textAlign: 'right' },
  detailDesc:         { fontSize: 13, color: Colors.text, lineHeight: 20 },
  detailDate:         { fontSize: 12, color: Colors.textSecondary },
});
