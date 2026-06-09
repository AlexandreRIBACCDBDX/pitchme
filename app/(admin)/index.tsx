import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AppLogo from '@/components/AppLogo';
import CandidatureDetailPanel from '@/components/CandidatureDetailPanel';

// ─── Config ──────────────────────────────────────────────────────────────────
const MARKET_DATE = new Date('2026-11-14');

const CAT_ICON: Record<string, string> = {
  'Artisanat / Déco':             '🎨',
  'Alimentation / Épicerie fine': '🧺',
  'Bijoux / Accessoires':         '💍',
  'Jouets / Enfants':             '🧸',
  'Textile / Vêtements':          '👗',
  'Cosmétiques / Bien-être':      '🧴',
  'Livres / Art':                 '📚',
  'Plants / Fleurs':              '🌸',
  'Boissons':                     '🍷',
  'Restauration / Food Truck':    '🚚',
  'Autre':                        '🏪',
};
function catIcon(c?: string | null) {
  if (!c) return '🏪';
  if (c.toLowerCase().includes('food') || c.toLowerCase().includes('truck')) return '🚚';
  return CAT_ICON[c] ?? '🏪';
}

const COLUMNS = [
  { key: 'pending',   label: 'À traiter',   color: '#F59E0B', light: '#FFFBEB', dot: '#FEF3C7' },
  { key: 'reviewing', label: 'En étude',    color: '#2563EB', light: '#EFF6FF', dot: '#DBEAFE' },
  { key: 'accepted',  label: 'Retenus',     color: '#059669', light: '#F0FDF4', dot: '#D1FAE5', numbered: true },
  { key: 'rejected',  label: 'Non retenus', color: '#6B7280', light: '#F9FAFB', dot: '#F3F4F6' },
] as const;

const QUICK_ACTIONS: Record<string, { status: string; label: string; color: string }[]> = {
  pending:   [{ status: 'reviewing', label: 'Étudier →', color: '#F59E0B' }, { status: 'accepted', label: '✓', color: '#059669' }, { status: 'rejected', label: '✗', color: '#EF4444' }],
  reviewing: [{ status: 'accepted',  label: '✓ Retenir', color: '#059669' }, { status: 'rejected', label: '✗ Refuser', color: '#EF4444' }, { status: 'pending', label: '↩', color: '#94A3B8' }],
  accepted:  [{ status: 'reviewing', label: '↩ Étude',  color: '#94A3B8' }],
  rejected:  [{ status: 'pending',   label: '↩ Attente', color: '#94A3B8' }],
};

const SCREEN_H = Dimensions.get('window').height;

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { signOut, profile } = useAuth();
  const [candidatures, setCandidatures] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [updating,     setUpdating]     = useState(false);
  const [unreadMap,    setUnreadMap]    = useState<Record<string, number>>({});
  const [rtOk,         setRtOk]         = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState('');

  useEffect(() => {
    load();
    const ch = supabase.channel('admin-rt-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatures' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load)
      .subscribe(s => setRtOk(s === 'SUBSCRIBED'));
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function load() {
    const [{ data: cands }, { data: msgs }] = await Promise.all([
      (supabase.from('candidatures') as any)
        .select('*, profiles(*)')
        .order('created_at', { ascending: false }),
      (supabase.from('messages') as any)
        .select('candidature_id')
        .eq('sender_role', 'candidate')
        .eq('is_read', false),
    ]);
    if (cands) setCandidatures(cands);
    if (msgs) {
      const map: Record<string, number> = {};
      msgs.forEach((m: any) => { map[m.candidature_id] = (map[m.candidature_id] ?? 0) + 1; });
      setUnreadMap(map);
    }
    setLastRefresh(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    setLoading(false);
    setRefreshing(false);
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(true);
    await (supabase.from('candidatures') as any).update({ status }).eq('id', id);
    await load();
    setUpdating(false);
  }

  // Dérivés
  const q = search.toLowerCase();
  const filtered = q
    ? candidatures.filter(c =>
        c.business_name?.toLowerCase().includes(q) ||
        c.contact_email?.toLowerCase().includes(q) ||
        c.product_category?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.siret?.includes(q)
      )
    : candidatures;

  const grouped  = Object.fromEntries(COLUMNS.map(col => [col.key, filtered.filter(c => c.status === col.key)]));
  const counts   = Object.fromEntries(COLUMNS.map(col => [col.key, candidatures.filter(c => c.status === col.key).length]));
  const toAction    = counts.pending + counts.reviewing;
  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);
  const unreadCands = Object.keys(unreadMap).length;

  const acceptRate = candidatures.length
    ? Math.round((counts.accepted / candidatures.length) * 100)
    : 0;

  const jours = Math.max(0, Math.ceil((MARKET_DATE.getTime() - Date.now()) / 86_400_000));

  const catCounts = useMemo(() => {
    const map: Record<string, number> = {};
    candidatures.filter(c => c.status === 'pending' || c.status === 'reviewing').forEach(c => {
      const cat = c.candidature_type === 'foodtruck' ? 'Restauration / Food Truck' : (c.product_category || 'Autre');
      map[cat] = (map[cat] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [candidatures]);

  if (loading) return (
    <View style={styles.splash}>
      <ActivityIndicator color="#fff" size="large" />
      <Text style={styles.splashText}>Chargement…</Text>
    </View>
  );

  return (
    <View style={styles.root}>

      {/* ══════════════════════════════════════════════════════════════════════
          SIDEBAR — dark navy
      ══════════════════════════════════════════════════════════════════════ */}
      <View style={styles.sidebar}>

        {/* Logo */}
        <View style={styles.sideTop}>
          <View style={styles.logoRow}>
            <AppLogo size={30} />
            <Text style={styles.logoText}>Pitch<Text style={styles.logoAccent}>Me</Text></Text>
          </View>
          <Text style={styles.logoSub}>Marché de Noël · Bourg</Text>
        </View>

        {/* Countdown */}
        <View style={styles.countdown}>
          <Text style={styles.countdownNum}>J-{jours}</Text>
          <Text style={styles.countdownLabel}>🎄 {MARKET_DATE.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>

        {/* Messages non lus */}
        {unreadCands > 0 && (
          <View style={styles.unreadBlock}>
            <Text style={styles.unreadBlockTitle}>💬 MESSAGES</Text>
            <View style={styles.unreadBlockRow}>
              <Text style={styles.unreadBlockText}>
                {unreadCands} dossier{unreadCands > 1 ? 's' : ''} avec réponse
              </Text>
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{totalUnread}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Catégories actives */}
        {catCounts.length > 0 && (
          <>
            <Text style={[styles.navSection, { marginTop: 20 }]}>CATÉGORIES ACTIVES</Text>
            {catCounts.map(([cat, n]) => (
              <View key={cat} style={styles.catRow}>
                <Text style={styles.catEmoji}>{catIcon(cat)}</Text>
                <Text style={styles.catName} numberOfLines={1}>{cat.split(' / ')[0]}</Text>
                <Text style={styles.catCount}>{n}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ flex: 1 }} />

        {/* Outils */}
        <View style={styles.sideTools}>
          <TouchableOpacity style={styles.toolBtn} onPress={() => router.push('/(admin)/qrcode')}>
            <Text style={styles.toolBtnText}>📱  QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => router.push('/(admin)/modules')}>
            <Text style={styles.toolBtnText}>⚙️  Modules</Text>
          </TouchableOpacity>
        </View>

        {/* Footer sidebar */}
        <View style={styles.sideFooter}>
          <View style={styles.rtRow}>
            <View style={[styles.rtDot, { backgroundColor: rtOk ? '#34D399' : '#F59E0B' }]} />
            <Text style={styles.rtText}>{rtOk ? 'Temps réel actif' : 'Connexion…'}</Text>
            <TouchableOpacity onPress={() => { setRefreshing(true); load(); }} disabled={refreshing}>
              <Text style={[styles.rtRefresh, refreshing && { opacity: 0.3 }]}>↻</Text>
            </TouchableOpacity>
          </View>
          {lastRefresh ? <Text style={styles.rtLast}>Màj {lastRefresh}</Text> : null}
          <TouchableOpacity style={styles.signOut} onPress={signOut}>
            <Text style={styles.signOutText}>
              {profile?.first_name ? `⏏  ${profile.first_name}` : '⏏  Déconnexion'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════════════════════════════════ */}
      <View style={styles.main}>

        {/* ── KPI strip ───────────────────────────────────────────────────── */}
        <View style={styles.kpiStrip}>
          <KpiCard value={candidatures.length} label="Candidatures" color="#6366F1" icon="📋" />
          <KpiCard value={toAction}            label="À traiter"    color="#F59E0B" icon="⚡" urgent={toAction > 0} />
          <KpiCard value={counts.accepted}     label="Retenus"      color="#059669" icon="✅" />
          <KpiCard value={`${acceptRate}%`}    label="Taux retenu"  color="#2563EB" icon="📊" />
          <KpiCard value={totalUnread}         label="Msgs candidats" color="#EC4899" icon="💬" urgent={totalUnread > 0} />
        </View>

        {/* ── Search bar ──────────────────────────────────────────────────── */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher par nom, catégorie, ville, email, SIRET…"
            placeholderTextColor="#94A3B8"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Kanban ──────────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.kanban}
          contentContainerStyle={styles.kanbanContent}
        >
          {COLUMNS.map(col => {
            const items: any[] = grouped[col.key] ?? [];
            return (
              <View key={col.key} style={styles.col}>

                {/* En-tête colonne */}
                <View style={[styles.colHead, { borderTopColor: col.color }]}>
                  <View style={styles.colHeadLeft}>
                    <View style={[styles.colDot, { backgroundColor: col.color }]} />
                    <Text style={[styles.colLabel, { color: col.color }]}>{col.label}</Text>
                  </View>
                  <View style={[styles.colCount, { backgroundColor: col.dot }]}>
                    <Text style={[styles.colCountText, { color: col.color }]}>{items.length}</Text>
                  </View>
                </View>

                {/* Cartes */}
                <ScrollView
                  style={[styles.colScroll, { backgroundColor: col.light }]}
                  contentContainerStyle={styles.colContent}
                  showsVerticalScrollIndicator={false}
                >
                  {items.length === 0 && (
                    <View style={styles.colEmpty}>
                      <Text style={styles.colEmptyText}>Aucun dossier</Text>
                    </View>
                  )}
                  {items.map((item, idx) => (
                    <KCard
                      key={item.id}
                      item={item}
                      col={col}
                      idx={idx}
                      selected={selectedId === item.id}
                      unreadCount={unreadMap[item.id] ?? 0}
                      onPress={() => setSelectedId(item.id === selectedId ? null : item.id)}
                      onAction={updateStatus}
                      disabled={updating}
                    />
                  ))}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          PANNEAU DÉTAIL (slide-in)
      ══════════════════════════════════════════════════════════════════════ */}
      {selectedId && (
        <View style={styles.panel}>
          <CandidatureDetailPanel
            candidatureId={selectedId}
            onClose={() => setSelectedId(null)}
            onStatusChange={load}
          />
        </View>
      )}
    </View>
  );
}

// ─── Carte KPI ────────────────────────────────────────────────────────────────
function KpiCard({ value, label, color, icon, urgent }: {
  value: number | string; label: string; color: string; icon: string; urgent?: boolean;
}) {
  return (
    <View style={[styles.kpiCard, urgent && { borderColor: color, borderWidth: 1.5 }]}>
      <View style={styles.kpiTop}>
        <Text style={styles.kpiIcon}>{icon}</Text>
        {urgent && (
          <View style={[styles.kpiUrgentDot, { backgroundColor: color }]} />
        )}
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

// ─── Carte kanban ─────────────────────────────────────────────────────────────
function KCard({ item, col, idx, selected, unreadCount, onPress, onAction, disabled }: {
  item: any; col: (typeof COLUMNS)[number]; idx: number;
  selected: boolean; unreadCount: number; onPress: () => void;
  onAction: (id: string, s: string) => void; disabled: boolean;
}) {
  const icon    = item.candidature_type === 'foodtruck' ? '🚚' : catIcon(item.product_category);
  const actions = QUICK_ACTIONS[item.status] ?? [];
  const contact = [item.contact_first_name, item.contact_last_name].filter(Boolean).join(' ')
                  || item.profiles?.first_name;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftColor: col.color },
        selected && { backgroundColor: col.color + '08', borderColor: col.color, borderLeftWidth: 4 },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Ligne 1 : icône + badges */}
      <View style={styles.cardRow}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <View style={styles.cardBadges}>
          {'numbered' in col && col.numbered && (
            <View style={[styles.numBadge, { backgroundColor: col.color }]}>
              <Text style={styles.numText}>#{idx + 1}</Text>
            </View>
          )}
          {item.candidature_type === 'foodtruck' && (
            <View style={styles.ftBadge}>
              <Text style={styles.ftBadgeText}>FOOD TRUCK</Text>
            </View>
          )}
          {item.admin_notes ? <Text style={styles.notesMark}>📝</Text> : null}
          {unreadCount > 0 && (
            <View style={styles.msgBadge}>
              <Text style={styles.msgBadgeText}>💬 {unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Nom commerce */}
      <Text style={styles.cardName} numberOfLines={2}>{item.business_name}</Text>

      {/* Catégorie */}
      {item.product_category && (
        <Text style={styles.cardCat} numberOfLines={1}>{item.product_category}</Text>
      )}

      {/* Contact + ville */}
      <View style={styles.cardMeta}>
        {contact ? <Text style={styles.cardMetaText} numberOfLines={1}>👤 {contact}</Text> : null}
        {item.city ? <Text style={styles.cardMetaText} numberOfLines={1}>📍 {item.city}</Text> : null}
      </View>

      {/* Date */}
      <Text style={styles.cardDate}>
        {new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
      </Text>

      {/* Actions */}
      {actions.length > 0 && (
        <View style={styles.cardActions}>
          {actions.map(a => (
            <TouchableOpacity
              key={a.status}
              style={[styles.actionChip, { backgroundColor: a.color + '15', borderColor: a.color + '50' }]}
              onPress={e => { (e as any).stopPropagation?.(); onAction(item.id, a.status); }}
              disabled={disabled}
            >
              <Text style={[styles.actionChipText, { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const SIDEBAR_W = 220;
const PANEL_W   = 460;
const COL_W     = 255;

const styles = StyleSheet.create({
  // ── Loading
  splash:     { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', gap: 16 },
  splashText: { color: '#94A3B8', fontSize: 14 },

  // ── Layout racine
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#F1F5F9' },

  // ══════════════════ SIDEBAR ══════════════════
  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: '#0F172A',
    paddingVertical: 20,
    paddingHorizontal: 14,
    flexDirection: 'column',
  },
  sideTop:    { marginBottom: 20 },
  logoRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  logoText:   { fontSize: 18, fontWeight: '800', color: '#F8FAFC' },
  logoAccent: { color: '#2563EB' },
  logoSub:    { fontSize: 10, color: '#475569' },

  countdown: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 22,
    alignItems: 'center',
  },
  countdownNum:   { fontSize: 26, fontWeight: '900', color: '#F8FAFC', letterSpacing: -1 },
  countdownLabel: { fontSize: 10, color: '#64748B', marginTop: 2 },

  navSection: { fontSize: 9, fontWeight: '700', color: '#334155', letterSpacing: 1.2, marginBottom: 8, marginTop: 2 },
  navItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  navDot:     { width: 6, height: 6, borderRadius: 3 },
  navLabel:   { flex: 1, fontSize: 12, color: '#94A3B8' },
  navLabelUrgent: { color: '#F8FAFC', fontWeight: '700' },
  navPill:    { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  navPillText: { fontSize: 11, fontWeight: '700' },

  catRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 7 },
  catEmoji: { fontSize: 13, width: 18, textAlign: 'center' },
  catName: { flex: 1, fontSize: 11, color: '#64748B' },
  catCount: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },

  sideTools: { gap: 6, marginBottom: 12 },
  toolBtn:   { backgroundColor: '#1E293B', borderRadius: 8, padding: 9 },
  toolBtnText: { fontSize: 11, color: '#94A3B8' },

  sideFooter: { borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 12, gap: 4 },
  rtRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rtDot:      { width: 6, height: 6, borderRadius: 3 },
  rtText:     { flex: 1, fontSize: 10, color: '#475569' },
  rtRefresh:  { fontSize: 14, color: '#2563EB', fontWeight: 'bold', paddingHorizontal: 4 },
  rtLast:     { fontSize: 9, color: '#334155' },
  signOut:    { paddingVertical: 8 },
  signOutText: { fontSize: 12, color: '#475569' },

  // ══════════════════ MAIN ══════════════════
  main: { flex: 1, flexDirection: 'column' },

  // KPI
  kpiStrip: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 0,
  },
  kpiCard:    {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kpiIcon:      { fontSize: 18 },
  kpiUrgentDot: { width: 8, height: 8, borderRadius: 4 },
  kpiValue:     { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  kpiLabel:     { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '500' },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
  },
  searchIcon:      { fontSize: 14, marginRight: 8, color: '#94A3B8' },
  searchInput:     { flex: 1, height: 40, color: '#1E293B', fontSize: 13 },
  searchClear:     { padding: 4 },
  searchClearText: { color: '#94A3B8', fontSize: 14 },

  // Kanban
  kanban:        { flex: 1 },
  kanbanContent: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 20, alignItems: 'flex-start' },

  // Colonne
  col:      { width: COL_W, borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  colHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 3 },
  colHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colDot:   { width: 8, height: 8, borderRadius: 4 },
  colLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  colCount: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  colCountText: { fontSize: 12, fontWeight: '800' },
  colScroll:   { maxHeight: SCREEN_H - 230 },
  colContent:  { padding: 10, gap: 8 },
  colEmpty:    { alignItems: 'center', paddingVertical: 36 },
  colEmptyText: { fontSize: 12, color: '#CBD5E1' },

  // Carte
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardIcon:    { fontSize: 24 },
  cardBadges:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  numBadge:    { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  numText:     { color: '#fff', fontSize: 10, fontWeight: '800' },
  ftBadge:     { backgroundColor: '#DBEAFE', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  ftBadgeText: { color: '#1D4ED8', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  notesMark:   { fontSize: 13 },
  cardName:    { fontSize: 14, fontWeight: '700', color: '#0F172A', lineHeight: 20, marginBottom: 3 },
  cardCat:     { fontSize: 11, color: '#64748B', marginBottom: 7 },
  cardMeta:    { gap: 2, marginBottom: 7 },
  cardMetaText: { fontSize: 11, color: '#94A3B8' },
  cardDate:    { fontSize: 10, color: '#CBD5E1', marginBottom: 10 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  actionChip:  { borderRadius: 6, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  actionChipText: { fontSize: 11, fontWeight: '600' },

  // Messages non lus (sidebar)
  unreadBlock:      { backgroundColor: '#1E293B', borderRadius: 10, padding: 12, marginBottom: 16 },
  unreadBlockTitle: { fontSize: 9, fontWeight: '700', color: '#EC4899', letterSpacing: 1.2, marginBottom: 8 },
  unreadBlockRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unreadBlockText:  { fontSize: 11, color: '#94A3B8', flex: 1 },
  unreadBadge:      { backgroundColor: '#EC4899', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  unreadBadgeText:  { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Badge message non lu sur carte
  msgBadge:     { backgroundColor: '#EC4899', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' },
  msgBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // ══════════════════ PANEL ══════════════════
  panel: {
    width: PANEL_W,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
});
