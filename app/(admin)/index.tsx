import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, StatusLabels } from '@/constants/theme';
import StatusBadge from '@/components/StatusBadge';
import type { CandidatureWithProfile } from '@/types/database';

const FILTERS = ['all', 'pending', 'reviewing', 'accepted', 'rejected'] as const;
const FILTER_LABELS: Record<string, string> = {
  all: 'Toutes',
  pending: 'En attente',
  reviewing: 'En étude',
  accepted: 'Retenu',
  rejected: 'Refusé',
};

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [candidatures, setCandidatures] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, pending: 0, reviewing: 0, accepted: 0, rejected: 0 });

  useEffect(() => { loadCandidatures(); }, []);

  useEffect(() => {
    let list = candidatures;
    if (activeFilter !== 'all') list = list.filter(c => c.status === activeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.business_name?.toLowerCase().includes(q) ||
        c.siret?.includes(q) ||
        c.profiles?.first_name?.toLowerCase().includes(q) ||
        c.profiles?.last_name?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [candidatures, activeFilter, search]);

  async function loadCandidatures() {
    const { data } = await supabase
      .from('candidatures')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });

    if (data) {
      setCandidatures(data);
      setStats({
        total: data.length,
        pending: data.filter(c => c.status === 'pending').length,
        reviewing: data.filter(c => c.status === 'reviewing').length,
        accepted: data.filter(c => c.status === 'accepted').length,
        rejected: data.filter(c => c.status === 'rejected').length,
      });
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
          <Text style={styles.title}>PitchMe · Admin</Text>
          <Text style={styles.subtitle}>Marché de Noël – Bourg-sur-Gironde</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.qrBtn} onPress={() => router.push('/(admin)/qrcode')}>
            <Text style={styles.qrBtnText}>QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
            <Text style={styles.signOutText}>⏏</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Total" value={stats.total} color={Colors.text} />
        <StatCard label="En attente" value={stats.pending} color={Colors.warning} />
        <StatCard label="En étude" value={stats.reviewing} color={Colors.info} />
        <StatCard label="Retenus" value={stats.accepted} color={Colors.success} />
        <StatCard label="Refusés" value={stats.rejected} color={Colors.error} />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="🔍 Rechercher..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, activeFilter === f && styles.filterBtnActive]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{FILTER_LABELS[f]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        onRefresh={loadCandidatures}
        refreshing={loading}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/(admin)/candidature/${item.id}`)}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.businessName}>{item.business_name}</Text>
                <Text style={styles.candidateName}>
                  {item.profiles?.first_name} {item.profiles?.last_name}
                </Text>
              </View>
              <StatusBadge status={item.status} size="sm" />
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.metaText}>{item.product_category}</Text>
              <Text style={styles.metaText}>·</Text>
              <Text style={styles.metaText}>{item.stand_size}</Text>
              <Text style={styles.metaText}>·</Text>
              <Text style={styles.metaText}>{new Date(item.created_at).toLocaleDateString('fr-FR')}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucune candidature</Text>
          </View>
        }
      />
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: Colors.gold },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  qrBtn: { backgroundColor: Colors.primaryDark, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  qrBtnText: { color: Colors.gold, fontWeight: 'bold', fontSize: 13 },
  signOutBtn: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  signOutText: { color: Colors.textSecondary, fontSize: 16 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: 10, alignItems: 'center', borderTopWidth: 3 },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  searchRow: { paddingHorizontal: 20, marginBottom: 10 },
  searchInput: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, color: Colors.text, fontSize: 15 },
  filtersRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 10 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { color: Colors.textSecondary, fontSize: 12 },
  filterTextActive: { color: '#fff', fontWeight: 'bold' },
  list: { paddingHorizontal: 16, paddingBottom: 30, gap: 10 },
  card: { backgroundColor: Colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  businessName: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  candidateName: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  cardMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: Colors.textMuted },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 16 },
});
