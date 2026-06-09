import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';
import CandidatureDetailPanel from '@/components/CandidatureDetailPanel';

// ─── Catégorie → icône ────────────────────────────────────────────────────────
const CAT_ICON: Record<string, string> = {
  'Artisanat / Déco':          '🎨',
  'Alimentation / Épicerie fine': '🧺',
  'Bijoux / Accessoires':      '💍',
  'Jouets / Enfants':          '🧸',
  'Textile / Vêtements':       '👗',
  'Cosmétiques / Bien-être':   '🧴',
  'Livres / Art':              '📚',
  'Plants / Fleurs':           '🌸',
  'Boissons':                  '🍷',
  'Restauration / Food Truck': '🚚',
  'Autre':                     '🏪',
};
function catIcon(category?: string | null): string {
  if (!category) return '🏪';
  if (category.toLowerCase().includes('food') || category.toLowerCase().includes('truck')) return '🚚';
  return CAT_ICON[category] ?? '🏪';
}

// ─── Colonnes kanban ──────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'pending',   label: 'En attente', color: '#D97706', headerBg: '#FEF3C7', colBg: '#FFFBEB' },
  { key: 'reviewing', label: 'En étude',   color: '#2563EB', headerBg: '#DBEAFE', colBg: '#EFF6FF' },
  { key: 'accepted',  label: 'Retenus',    color: '#059669', headerBg: '#D1FAE5', colBg: '#F0FDF4', numbered: true },
  { key: 'rejected',  label: 'Refusés',    color: '#6B7280', headerBg: '#F3F4F6', colBg: '#F9FAFB' },
] as const;

// Actions disponibles par statut actuel
const NEXT: Record<string, { status: string; label: string; color: string }[]> = {
  pending:   [{ status: 'reviewing', label: '→ Étude',   color: '#F59E0B' },
              { status: 'accepted',  label: '✓',          color: '#10B981' },
              { status: 'rejected',  label: '✗',          color: '#EF4444' }],
  reviewing: [{ status: 'accepted',  label: '✓ Retenir', color: '#10B981' },
              { status: 'rejected',  label: '✗ Refuser', color: '#EF4444' },
              { status: 'pending',   label: '↩',          color: '#94A3B8' }],
  accepted:  [{ status: 'reviewing', label: '↩ Étude',   color: '#94A3B8' }],
  rejected:  [{ status: 'pending',   label: '↩ Attente', color: '#94A3B8' }],
};

const COL_W = 250;
const SCREEN_H = Dimensions.get('window').height;

// ─── Composant principal ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [candidatures, setCandidatures] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [updating,     setUpdating]     = useState(false);
  const [rtStatus,     setRtStatus]     = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [lastUpdated,  setLastUpdated]  = useState('');

  useEffect(() => {
    load();
    const channel = supabase
      .channel('admin-kanban-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatures' }, load)
      .subscribe(s => setRtStatus(
        s === 'SUBSCRIBED' ? 'connected' : s === 'CHANNEL_ERROR' ? 'error' : 'connecting'
      ));
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function load() {
    const { data } = await (supabase.from('candidatures') as any)
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });
    if (data) {
      setCandidatures(data);
    }
    setLastUpdated(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    setLoading(false);
    setRefreshing(false);
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(true);
    await (supabase.from('candidatures') as any).update({ status }).eq('id', id);
    await load();
    setUpdating(false);
  }

  // Filtrage
  const q = search.toLowerCase();
  const filtered = search
    ? candidatures.filter(c =>
        c.business_name?.toLowerCase().includes(q) ||
        c.siret?.includes(q) ||
        c.contact_email?.toLowerCase().includes(q) ||
        c.contact_first_name?.toLowerCase().includes(q) ||
        c.contact_last_name?.toLowerCase().includes(q) ||
        c.product_category?.toLowerCase().includes(q) ||
        c.profiles?.first_name?.toLowerCase().includes(q) ||
        c.profiles?.last_name?.toLowerCase().includes(q)
      )
    : candidatures;

  const grouped = Object.fromEntries(
    COLUMNS.map(col => [col.key, filtered.filter(c => c.status === col.key)])
  );
  const counts = Object.fromEntries(
    COLUMNS.map(col => [col.key, candidatures.filter(c => c.status === col.key).length])
  );

  // Compteurs de catégories (en attente + en étude uniquement)
  const catCounts = useMemo(() => {
    const map: Record<string, number> = {};
    candidatures
      .filter(c => c.status === 'pending' || c.status === 'reviewing')
      .forEach(c => {
        const cat = c.candidature_type === 'foodtruck'
          ? 'Restauration / Food Truck'
          : (c.product_category || 'Autre');
        map[cat] = (map[cat] ?? 0) + 1;
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [candidatures]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.root}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarTop}>
          <View style={styles.logoRow}>
            <AppLogo size={34} />
            <View style={styles.wordmark}>
              <Text style={styles.wBold}>Pitch</Text>
              <Text style={styles.wLight}>Me</Text>
            </View>
          </View>
          <Text style={styles.appSub}>Marché de Noël · Bourg-sur-Gironde</Text>
        </View>

        {/* Statuts */}
        <Text style={styles.sideLabel}>STATUTS</Text>
        <SbItem dot="#64748B" label="Toutes"     count={candidatures.length} />
        <SbItem dot="#D97706" label="En attente" count={counts.pending}   urgent={counts.pending > 0} />
        <SbItem dot="#2563EB" label="En étude"   count={counts.reviewing} />
        <SbItem dot="#059669" label="Retenues"   count={counts.accepted} />
        <SbItem dot="#6B7280" label="Refusées"   count={counts.rejected} />

        {/* Catégories à traiter */}
        {catCounts.length > 0 && (
          <>
            <Text style={[styles.sideLabel, { marginTop: 20 }]}>CATÉGORIES À TRAITER</Text>
            {catCounts.map(([cat, n]) => (
              <View key={cat} style={styles.catItem}>
                <Text style={styles.catItemIcon}>{catIcon(cat)}</Text>
                <Text style={styles.catItemLabel} numberOfLines={1}>{cat}</Text>
                <Text style={styles.catItemCount}>{n}</Text>
              </View>
            ))}
          </>
        )}

        {/* Outils */}
        <Text style={[styles.sideLabel, { marginTop: 20 }]}>OUTILS</Text>
        <TouchableOpacity style={styles.sideBtn} onPress={() => router.push('/(admin)/qrcode')}>
          <Text style={styles.sideBtnText}>📱 QR Code</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn} onPress={() => router.push('/(admin)/modules')}>
          <Text style={styles.sideBtnText}>⚙️ Modules</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* Realtime */}
        <View style={styles.rtBar}>
          <View style={[styles.rtDot, {
            backgroundColor: rtStatus === 'connected' ? '#10B981' : rtStatus === 'error' ? '#EF4444' : '#F59E0B',
          }]} />
          <Text style={styles.rtText}>
            {rtStatus === 'connected' ? 'Temps réel' : rtStatus === 'error' ? 'Hors ligne' : 'Connexion…'}
          </Text>
          <TouchableOpacity onPress={() => { setRefreshing(true); load(); }} disabled={refreshing}>
            <Text style={[styles.rtRefresh, refreshing && { opacity: 0.3 }]}>↻</Text>
          </TouchableOpacity>
        </View>
        {lastUpdated ? <Text style={styles.rtLast}>Mis à jour à {lastUpdated}</Text> : null}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>⏏  Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* ── Kanban board ────────────────────────────────────────────────────── */}
      <View style={styles.board}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="🔍  Rechercher un exposant, catégorie, email..."
          placeholderTextColor={Colors.textMuted}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kanban} contentContainerStyle={styles.kanbanContent}>
          {COLUMNS.map((col) => {
            const items: any[] = grouped[col.key] ?? [];
            return (
              <View key={col.key} style={[styles.column, { backgroundColor: col.colBg }]}>

                {/* En-tête colonne */}
                <View style={[styles.colHeader, { backgroundColor: col.headerBg }]}>
                  <View style={[styles.colDot, { backgroundColor: col.color }]} />
                  <Text style={[styles.colTitle, { color: col.color }]}>{col.label}</Text>
                  <View style={[styles.colBadge, { backgroundColor: col.color }]}>
                    <Text style={styles.colBadgeText}>{items.length}</Text>
                  </View>
                </View>

                {/* Cartes */}
                <ScrollView
                  style={styles.colScroll}
                  contentContainerStyle={styles.colContent}
                  showsVerticalScrollIndicator={false}
                >
                  {items.length === 0 && (
                    <Text style={styles.colEmpty}>Aucune candidature</Text>
                  )}
                  {items.map((item, idx) => (
                    <KanbanCard
                      key={item.id}
                      item={item}
                      col={col}
                      index={idx}
                      isSelected={selectedId === item.id}
                      onPress={(i) => setSelectedId(i.id)}
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

      {/* ── Panneau détail (fiche complète inline) ──────────────────────── */}
      {selectedId && (
        <View style={styles.detail}>
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

// ─── Carte kanban ─────────────────────────────────────────────────────────────
function KanbanCard({ item, col, index, isSelected, onPress, onAction, disabled }: {
  item: any; col: (typeof COLUMNS)[number]; index: number;
  isSelected: boolean; onPress: (i: any) => void;
  onAction: (id: string, s: string) => void; disabled: boolean;
}) {
  const icon = item.candidature_type === 'foodtruck' ? '🚚' : catIcon(item.product_category);
  const actions = NEXT[item.status] ?? [];
  const contact = item.contact_first_name ?? item.profiles?.first_name;

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && { borderColor: col.color, borderWidth: 2 }]}
      onPress={() => onPress(item)}
      activeOpacity={0.88}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTopLeft}>
          <Text style={styles.cardCatIcon}>{icon}</Text>
          {'numbered' in col && col.numbered && (
            <View style={[styles.numBadge, { backgroundColor: col.color }]}>
              <Text style={styles.numText}>{index + 1}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardTopRight}>
          {item.candidature_type === 'foodtruck' && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>Food Truck</Text>
            </View>
          )}
          {item.admin_notes && <Text style={styles.notesDot}>📝</Text>}
        </View>
      </View>

      <Text style={styles.cardName} numberOfLines={2}>{item.business_name}</Text>
      <Text style={styles.cardCat} numberOfLines={1}>{item.product_category ?? '—'}</Text>

      {contact && (
        <Text style={styles.cardContact} numberOfLines={1}>👤 {contact}</Text>
      )}

      <Text style={styles.cardDate}>
        {new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
      </Text>

      {/* Actions */}
      {actions.length > 0 && (
        <View style={styles.cardActions}>
          {actions.map(a => (
            <TouchableOpacity
              key={a.status}
              style={[styles.chip, { backgroundColor: a.color + '18', borderColor: a.color + '60' }]}
              onPress={e => { (e as any).stopPropagation?.(); onAction(item.id, a.status); }}
              disabled={disabled}
            >
              <Text style={[styles.chipText, { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Helpers sidebar ──────────────────────────────────────────────────────────
function SbItem({ dot, label, count, urgent }: { dot: string; label: string; count: number; urgent?: boolean }) {
  return (
    <View style={styles.sbItem}>
      <View style={[styles.sbDot, { backgroundColor: dot }]} />
      <Text style={[styles.sbLabel, urgent && { fontWeight: '700', color: Colors.text }]}>{label}</Text>
      <Text style={[styles.sbCount, { color: dot }]}>{count}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  root:     { flex: 1, flexDirection: 'row', backgroundColor: '#F1F5F9' },

  // ── Sidebar
  sidebar:    { width: 210, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#E2E8F0', paddingVertical: 20, paddingHorizontal: 14, flexDirection: 'column' },
  sidebarTop: { marginBottom: 22 },
  logoRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  wordmark:   { flexDirection: 'row', alignItems: 'baseline' },
  wBold:      { fontSize: 18, fontWeight: '800', color: '#1A202C' },
  wLight:     { fontSize: 18, fontWeight: '300', color: Colors.primary },
  appSub:     { fontSize: 10, color: Colors.textMuted },
  sideLabel:  { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 8, marginTop: 4 },

  sbItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  sbDot:      { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  sbLabel:    { flex: 1, fontSize: 12, color: Colors.textSecondary },
  sbCount:    { fontSize: 12, fontWeight: '700' },

  catItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 6 },
  catItemIcon: { fontSize: 14, width: 20, textAlign: 'center' },
  catItemLabel: { flex: 1, fontSize: 11, color: Colors.textSecondary },
  catItemCount: { fontSize: 11, fontWeight: '700', color: Colors.primary, backgroundColor: Colors.primary + '15', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },

  sideBtn:     { backgroundColor: Colors.surface, borderRadius: 7, padding: 9, borderWidth: 1, borderColor: Colors.border, marginBottom: 5 },
  sideBtnText: { fontSize: 11, color: Colors.text },

  rtBar:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  rtDot:     { width: 7, height: 7, borderRadius: 4 },
  rtText:    { flex: 1, fontSize: 10, color: Colors.textSecondary },
  rtRefresh: { fontSize: 15, color: Colors.primary, fontWeight: 'bold', paddingHorizontal: 4 },
  rtLast:    { fontSize: 9, color: Colors.textMuted, marginBottom: 6 },
  signOutBtn:  { paddingVertical: 9, borderTopWidth: 1, borderTopColor: Colors.border },
  signOutText: { fontSize: 12, color: Colors.textSecondary },

  // ── Board
  board:         { flex: 1, flexDirection: 'column', padding: 14 },
  search:        { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: Colors.text, marginBottom: 14 },
  kanban:        { flex: 1 },
  kanbanContent: { flexDirection: 'row', gap: 10, paddingBottom: 20, alignItems: 'flex-start' },

  // ── Colonne
  column:    { width: COL_W, borderRadius: 12, overflow: 'hidden' },
  colHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 7 },
  colDot:    { width: 9, height: 9, borderRadius: 5 },
  colTitle:  { flex: 1, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  colBadge:  { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  colBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  colScroll: { maxHeight: SCREEN_H - 160 },
  colContent: { padding: 8, gap: 8 },
  colEmpty:  { textAlign: 'center', color: Colors.textMuted, fontSize: 12, paddingVertical: 32 },

  // ── Carte
  card:       { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardCatIcon: { fontSize: 22 },
  numBadge:   { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  numText:    { color: '#fff', fontSize: 10, fontWeight: '800' },
  typeBadge:  { backgroundColor: '#DBEAFE', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  typeBadgeText: { color: '#2563EB', fontSize: 9, fontWeight: '700' },
  notesDot:   { fontSize: 12 },
  cardName:   { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  cardCat:    { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  cardContact: { fontSize: 11, color: Colors.textMuted, marginBottom: 3 },
  cardDate:   { fontSize: 10, color: Colors.textMuted, marginBottom: 8 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip:       { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  chipText:   { fontSize: 11, fontWeight: '600' },

  // ── Panneau détail
  detail: { width: 460, borderLeftWidth: 1, borderLeftColor: Colors.border },
});
