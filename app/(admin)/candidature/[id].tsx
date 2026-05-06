import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Image, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, StatusColors, StatusLabels } from '@/constants/theme';
import MessageThread from '@/components/MessageThread';

type Tab = 'info' | 'photos' | 'messages';

const STATUS_BG: Record<string, string> = {
  pending: '#FEF2F2', reviewing: '#FFFBEB', accepted: '#ECFDF5', rejected: '#F9FAFB',
};

const ACTIONS = [
  { key: 'reviewing', label: '→ Mettre en étude', color: '#F59E0B' },
  { key: 'accepted',  label: '✓ Retenir',          color: '#10B981' },
  { key: 'rejected',  label: '✗ Refuser',           color: '#EF4444' },
] as const;

export default function AdminCandidatureDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData]       = useState<any>(null);
  const [documents, setDocs]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>('info');
  const [notes, setNotes]     = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    const [{ data: cand }, { data: docs }] = await Promise.all([
      (supabase.from('candidatures') as any).select('*, profiles(*)').eq('id', id).single(),
      supabase.from('documents').select('*').eq('candidature_id', id),
    ]);
    if (cand) { setData(cand); setNotes(cand.admin_notes || ''); setRejectReason(cand.rejection_reason || ''); }
    if (docs) setDocs(docs);
    setLoading(false);
  }

  async function updateStatus(status: string, reason?: string) {
    setSaving(true);
    await (supabase.from('candidatures') as any).update({
      status,
      admin_notes: notes,
      rejection_reason: status === 'rejected' ? (reason ?? rejectReason) : null,
    }).eq('id', id);

    const msgs: Record<string, string> = {
      reviewing: "📋 Votre candidature est en cours d'étude. Nous reviendrons vers vous prochainement.",
      accepted:  '🎉 Félicitations ! Votre candidature a été retenue pour le Marché de Noël de Bourg-sur-Gironde.',
      rejected:  `❌ Votre candidature n'a pas été retenue${reason ? '. Motif : ' + reason : '.'}`,
    };
    if (msgs[status]) {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase.from('messages') as any).insert({ candidature_id: id, sender_id: user!.id, content: msgs[status] });
    }

    setData((d: any) => ({ ...d, status, rejection_reason: reason ?? rejectReason }));
    setRejectModal(false);
    setSaving(false);
  }

  async function saveNotes() {
    await (supabase.from('candidatures') as any).update({ admin_notes: notes }).eq('id', id);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!data)   return <View style={styles.centered}><Text style={{ color: Colors.error }}>Candidature introuvable</Text></View>;

  const p = data.profiles;
  const initials = (data.business_name?.[0] ?? '?').toUpperCase();
  const statusColor = StatusColors[data.status] ?? Colors.textSecondary;
  const photos = documents.filter(d => d.file_type === 'image');

  return (
    <View style={styles.root}>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>{data.business_name}</Text>
          <Text style={styles.topBarSub}>{p?.first_name} {p?.last_name} · Déposée le {new Date(data.created_at).toLocaleDateString('fr-FR')}</Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: STATUS_BG[data.status] }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{StatusLabels[data.status]}</Text>
        </View>
      </View>

      <View style={styles.body}>

        {/* ── Left: main content ── */}
        <View style={styles.left}>

          {/* Tabs */}
          <View style={styles.tabs}>
            {([
              { key: 'info',     label: 'Informations' },
              { key: 'photos',   label: `Photos (${photos.length})` },
              { key: 'messages', label: 'Messages' },
            ] as { key: Tab; label: string }[]).map(t => (
              <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Tab: Info ── */}
          {tab === 'info' && (
            <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
              <Row2>
                <Card title="Contact">
                  <Field label="Prénom"    value={p?.first_name} />
                  <Field label="Nom"       value={p?.last_name} />
                  <Field label="Email"     value={p?.email} />
                  <Field label="Téléphone" value={p?.phone || '—'} />
                </Card>
                <Card title="Entreprise">
                  <Field label="Raison sociale" value={data.business_name} />
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>SIRET</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.fieldValue, styles.fieldMono]}>{data.siret}</Text>
                      {data.siret_data?.valid === true && (
                        <View style={styles.certBadge}>
                          <Text style={styles.certBadgeText}>✓ Certifié</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {data.siret_data?.denomination && (
                    <Field label="Raison sociale officielle" value={data.siret_data.denomination} />
                  )}
                  {data.siret_data?.activite_principale && (
                    <Field label="Activité (NAF)" value={data.siret_data.activite_principale} />
                  )}
                  <Field label="Adresse"         value={data.address} />
                  <Field label="Code postal"     value={data.postal_code} />
                  <Field label="Ville"           value={data.city} />
                </Card>
              </Row2>

              <Card title="Produits & activité">
                <Field label="Catégorie" value={data.product_category} />
                {data.website_url   && <Field label="Site web"  value={data.website_url} />}
                {data.instagram_url && <Field label="Instagram" value={`@${data.instagram_url}`} />}
                <View style={styles.descBlock}>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <Text style={styles.descText}>{data.product_description}</Text>
                </View>
              </Card>

              <Row2>
                <Card title="Stand & logistique">
                  <Field label="Taille du stand"  value={data.stand_size ?? '—'} />
                  <Field label="Électricité"       value={data.electricity_needed ? 'Oui' : 'Non'} />
                  <Field label="Ancien exposant"   value={data.previous_participant ? 'Oui' : 'Non'} />
                </Card>
                <Card title="Notes internes">
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Observations, remarques..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    numberOfLines={5}
                  />
                  <TouchableOpacity style={styles.saveNotesBtn} onPress={saveNotes}>
                    <Text style={styles.saveNotesBtnText}>{notesSaved ? '✓ Sauvegardé' : 'Sauvegarder'}</Text>
                  </TouchableOpacity>
                </Card>
              </Row2>

              {data.status === 'rejected' && data.rejection_reason && (
                <View style={styles.rejectionBanner}>
                  <Text style={styles.rejectionBannerTitle}>Motif de refus communiqué</Text>
                  <Text style={styles.rejectionBannerText}>{data.rejection_reason}</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* ── Tab: Photos ── */}
          {tab === 'photos' && (
            <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
              {photos.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📷</Text>
                  <Text style={styles.emptyText}>Aucune photo déposée</Text>
                </View>
              ) : (
                <View style={styles.photoGrid}>
                  {photos.map(doc => (
                    <View key={doc.id} style={styles.photoWrap}>
                      <Image source={{ uri: doc.file_url }} style={styles.photo} resizeMode="cover" />
                      <Text style={styles.photoName} numberOfLines={1}>{doc.file_name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}

          {/* ── Tab: Messages ── */}
          {tab === 'messages' && (
            <View style={styles.tabContent}>
              <MessageThread candidatureId={id} />
            </View>
          )}
        </View>

        {/* ── Right: sidebar ── */}
        <View style={styles.right}>
          {/* Avatar hero */}
          <View style={[styles.avatarHero, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.avatarCircle, { backgroundColor: statusColor + '33' }]}>
              <Text style={[styles.avatarLetter, { color: statusColor }]}>{initials}</Text>
            </View>
            <Text style={styles.heroName}>{data.business_name}</Text>
            <Text style={styles.heroSub}>{data.product_category}</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsBox}>
            <Text style={styles.actionsTitle}>CHANGER LE STATUT</Text>
            {ACTIONS.map(a => (
              data.status !== a.key && (
                <TouchableOpacity
                  key={a.key}
                  style={[styles.actionBtn, { backgroundColor: a.color }]}
                  onPress={() => a.key === 'rejected' ? setRejectModal(true) : updateStatus(a.key)}
                  disabled={saving}
                >
                  <Text style={styles.actionBtnText}>{a.label}</Text>
                </TouchableOpacity>
              )
            ))}
            {data.status === 'rejected' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
                onPress={() => updateStatus('pending')}
                disabled={saving}
              >
                <Text style={styles.actionBtnText}>↩ Remettre en attente</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Key info */}
          <View style={styles.sideInfoBox}>
            <SideRow icon="🗓" label="Déposée" value={new Date(data.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} />
            <SideRow icon="📐" label="Stand"   value={data.stand_size ?? '—'} />
            <SideRow icon="⚡" label="Électricité" value={data.electricity_needed ? 'Oui' : 'Non'} />
            <SideRow icon="🔁" label="Ancien exposant" value={data.previous_participant ? 'Oui' : 'Non'} />
            {data.instagram_url && <SideRow icon="📸" label="Instagram" value={`@${data.instagram_url}`} />}
          </View>
        </View>
      </View>

      {/* ── Reject modal ── */}
      <Modal visible={rejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Motif de refus</Text>
            <Text style={styles.modalSub}>Ce message sera envoyé automatiquement au candidat.</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Ex : catégorie déjà représentée, dossier incomplet..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectModal(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, saving && { opacity: 0.6 }]}
                onPress={() => updateStatus('rejected', rejectReason)}
                disabled={saving}
              >
                <Text style={styles.modalConfirmText}>{saving ? 'Envoi...' : 'Confirmer le refus'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <View style={styles.row2}>{children}</View>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, mono && styles.fieldMono]}>{value || '—'}</Text>
    </View>
  );
}

function SideRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.sideRow}>
      <Text style={styles.sideRowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.sideRowLabel}>{label}</Text>
        <Text style={styles.sideRowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F1F5F9', flexDirection: 'column' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },

  // Top bar
  topBar:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 16 },
  backBtn:       { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  backText:      { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  topBarCenter:  { flex: 1 },
  topBarTitle:   { fontSize: 17, fontWeight: '700', color: Colors.text },
  topBarSub:     { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  statusPill:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  statusDot:     { width: 7, height: 7, borderRadius: 4 },
  statusLabel:   { fontSize: 12, fontWeight: '700' },

  // Body
  body:  { flex: 1, flexDirection: 'row' },
  left:  { flex: 1, flexDirection: 'column' },
  right: { width: 280, backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: Colors.border, flexDirection: 'column' },

  // Tabs
  tabs:          { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 20 },
  tab:           { paddingVertical: 14, paddingHorizontal: 4, marginRight: 28 },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText:       { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  tabContent:    { flex: 1 },
  tabContentInner: { padding: 20, gap: 16, paddingBottom: 40 },

  // 2-col row
  row2: { flexDirection: 'row', gap: 16 },

  // Card
  card:      { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 14, textTransform: 'uppercase' },

  // Field
  field:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  fieldValue: { fontSize: 13, color: Colors.text, fontWeight: '500', flex: 2, textAlign: 'right' },
  fieldMono:  { fontFamily: 'monospace', fontSize: 12 },
  certBadge:     { backgroundColor: '#ECFDF5', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#6EE7B7' },
  certBadgeText: { color: '#059669', fontSize: 11, fontWeight: '700' },

  // Description
  descBlock: { paddingTop: 10 },
  descText:  { fontSize: 13, color: Colors.text, lineHeight: 20, marginTop: 4 },

  // Notes
  notesInput:     { backgroundColor: Colors.surface, borderRadius: 8, padding: 10, color: Colors.text, minHeight: 90, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border, fontSize: 13, marginBottom: 10 },
  saveNotesBtn:   { backgroundColor: Colors.primary, borderRadius: 8, padding: 10, alignItems: 'center' },
  saveNotesBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Rejection banner
  rejectionBanner:     { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: '#FCA5A5' },
  rejectionBannerTitle: { color: '#DC2626', fontWeight: '700', marginBottom: 4, fontSize: 13 },
  rejectionBannerText:  { color: '#7F1D1D', fontSize: 13, lineHeight: 18 },

  // Photos
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyText:  { color: Colors.textMuted, fontSize: 15 },
  photoGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  photoWrap:  { width: '31%' },
  photo:      { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: Colors.border },
  photoName:  { color: Colors.textSecondary, fontSize: 11, marginTop: 5, textAlign: 'center' },

  // Sidebar right
  avatarHero:   { alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarLetter: { fontSize: 26, fontWeight: 'bold' },
  heroName:     { fontSize: 15, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  heroSub:      { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  actionsBox:    { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  actionsTitle:  { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 4 },
  actionBtn:     { borderRadius: 8, padding: 11, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  sideInfoBox: { padding: 16, gap: 14 },
  sideRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sideRowIcon: { fontSize: 16, width: 22, textAlign: 'center', marginTop: 1 },
  sideRowLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sideRowValue: { fontSize: 13, color: Colors.text, fontWeight: '500', marginTop: 1 },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox:      { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480 },
  modalTitle:    { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  modalSub:      { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  modalInput:    { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, color: Colors.text, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border, fontSize: 14, marginBottom: 16 },
  modalBtns:     { flexDirection: 'row', gap: 12 },
  modalCancel:   { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '600' },
  modalConfirm:  { flex: 1, backgroundColor: '#EF4444', borderRadius: 10, padding: 14, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});
