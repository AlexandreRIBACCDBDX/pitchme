import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Colors, StatusColors } from '@/constants/theme';
import MessageThread from '@/components/MessageThread';
import PhotoGallery from '@/components/PhotoGallery';

type Tab = 'info' | 'messages';

const STATUS_BG:    Record<string, string> = { pending: '#FEF3C7', reviewing: '#DBEAFE', accepted: '#D1FAE5', rejected: '#F3F4F6' };
const STATUS_LABEL: Record<string, string> = { pending: 'En attente', reviewing: 'En étude', accepted: 'Retenu', rejected: 'Refusé' };
const ACTIONS = [
  { key: 'reviewing', label: '→ En étude',  color: '#F59E0B' },
  { key: 'accepted',  label: '✓ Retenir',   color: '#10B981' },
  { key: 'rejected',  label: '✗ Refuser',   color: '#EF4444' },
] as const;

interface Props {
  candidatureId: string;
  onClose: () => void;
  onStatusChange?: () => void;
}

export default function CandidatureDetailPanel({ candidatureId, onClose, onStatusChange }: Props) {
  const [data,        setData]        = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<Tab>('info');
  const [notes,       setNotes]       = useState('');
  const [notesSaved,  setNotesSaved]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason,setRejectReason]= useState('');

  useEffect(() => {
    setLoading(true);
    setTab('info');
    loadData();
  }, [candidatureId]);

  async function loadData() {
    const { data: cand } = await (supabase.from('candidatures') as any)
      .select('*, profiles(*)')
      .eq('id', candidatureId)
      .single();
    if (cand) { setData(cand); setNotes(cand.admin_notes || ''); setRejectReason(cand.rejection_reason || ''); }
    setLoading(false);
  }

  async function updateStatus(status: string, reason?: string) {
    setSaving(true);
    await (supabase.from('candidatures') as any).update({
      status,
      admin_notes: notes,
      rejection_reason: status === 'rejected' ? (reason ?? rejectReason) : null,
    }).eq('id', candidatureId);

    const autoMsg: Record<string, string> = {
      reviewing: "📋 Votre candidature est en cours d'étude. Nous reviendrons vers vous prochainement.",
      accepted:  '🎉 Félicitations ! Votre candidature a été retenue pour le Marché de Noël de Bourg-sur-Gironde.',
      rejected:  `❌ Votre candidature n'a pas été retenue${reason ? '. Motif : ' + reason : '.'}`,
    };
    if (autoMsg[status]) {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase.from('messages') as any).insert({
        candidature_id: candidatureId,
        sender_id: user!.id,
        sender_role: 'admin',
        content: autoMsg[status],
      });
      supabase.functions.invoke('notify-message', {
        body: { candidature_id: candidatureId, content: autoMsg[status] },
      }).catch(() => {});
    }

    setRejectModal(false);
    setSaving(false);
    await loadData();
    onStatusChange?.();
  }

  async function saveNotes() {
    await (supabase.from('candidatures') as any).update({ admin_notes: notes }).eq('id', candidatureId);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }
  if (!data) return null;

  const p = data.profiles;
  const statusColor = StatusColors[data.status] ?? Colors.textSecondary;
  const photos: string[] = data.photo_urls ?? [];
  const isFoodtruck = data.candidature_type === 'foodtruck';
  const ft = data.foodtruck_data ?? {};

  return (
    <View style={styles.root}>

      {/* ── En-tête ── */}
      <View style={styles.header}>
        <View style={styles.headerMeta}>
          <Text style={styles.headerName} numberOfLines={1}>{data.business_name}</Text>
          <View style={[styles.statusPill, { backgroundColor: STATUS_BG[data.status] }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABEL[data.status]}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ── Onglets ── */}
      <View style={styles.tabs}>
        {(['info', 'messages'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'info' ? 'Informations' : 'Messages'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Actions statut ── */}
      <View style={styles.actionsBar}>
        {ACTIONS.filter(a => data.status !== a.key).map(a => (
          <TouchableOpacity
            key={a.key}
            style={[styles.actionBtn, { backgroundColor: a.color }]}
            onPress={() => a.key === 'rejected' ? setRejectModal(true) : updateStatus(a.key)}
            disabled={saving}
          >
            <Text style={styles.actionBtnText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
        {data.status !== 'pending' && data.status !== 'reviewing' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#94A3B8' }]}
            onPress={() => updateStatus(data.status === 'accepted' ? 'reviewing' : 'pending')}
            disabled={saving}
          >
            <Text style={styles.actionBtnText}>
              {data.status === 'accepted' ? '↩ Étude' : '↩ Attente'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Onglet Informations ── */}
      {tab === 'info' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

          <Section title="CONTACT">
            <Field label="Prénom"    value={data.contact_first_name ?? p?.first_name} />
            <Field label="Nom"       value={data.contact_last_name  ?? p?.last_name} />
            <Field label="Email"     value={data.contact_email      ?? p?.email} />
            <Field label="Téléphone" value={data.contact_phone      ?? p?.phone} />
            {data.access_code && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Code d'accès</Text>
                <Text style={[styles.fieldValue, styles.mono, { color: Colors.primary }]}>{data.access_code}</Text>
              </View>
            )}
            <Field label="Caution"   value={data.caution_accepted ? '✓ Acceptée' : '—'} />
          </Section>

          <Section title="ENTREPRISE">
            <Field label="Raison sociale" value={data.business_name} />
            <Field label="SIRET"           value={data.siret} mono />
            {data.siret_data?.denomination && (
              <Field label="Dénomination" value={data.siret_data.denomination} />
            )}
            {data.siret_data?.activite_principale && (
              <Field label="Activité (NAF)" value={data.siret_data.activite_principale} />
            )}
            <Field label="Adresse"     value={data.address} />
            <Field label="Code postal" value={data.postal_code} />
            <Field label="Ville"       value={data.city} />
            {data.website_url   && <Field label="Site web"   value={data.website_url} />}
            {data.instagram_url && <Field label="Instagram"  value={`@${data.instagram_url}`} />}
          </Section>

          <Section title={isFoodtruck ? 'MENU & CUISINE' : 'PRODUITS & ACTIVITÉ'}>
            {!isFoodtruck && <Field label="Catégorie" value={data.product_category} />}
            <View style={styles.descBlock}>
              <Text style={styles.fieldLabel}>{isFoodtruck ? 'Menu proposé' : 'Description'}</Text>
              <Text style={styles.descText}>{data.product_description}</Text>
            </View>
          </Section>

          <Section title="LOGISTIQUE">
            <Field label="Électricité"     value={data.electricity_needed    ? 'Oui' : 'Non'} />
            <Field label="Ancien exposant" value={data.previous_participant  ? 'Oui' : 'Non'} />
            {isFoodtruck && (
              <>
                {ft.vehicle_type   && <Field label="Véhicule"  value={ft.vehicle_type} />}
                {ft.vehicle_length && <Field label="Longueur"  value={ft.vehicle_length} />}
                {ft.power_needed   && <Field label="Électricité" value={ft.power_needed} />}
                <Field label="Eau" value={ft.water_needed ? 'Oui' : 'Non'} />
                <Field label="Gaz" value={ft.gas_needed   ? 'Oui' : 'Non'} />
                {ft.average_price != null && <Field label="Prix moyen" value={`${ft.average_price} €`} />}
              </>
            )}
          </Section>

          {photos.length > 0 && (
            <Section title={`PHOTOS (${photos.length})`}>
              <View style={{ paddingTop: 8 }}>
                <PhotoGallery urls={photos} thumbSize={80} />
              </View>
            </Section>
          )}

          <Section title="NOTES INTERNES">
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Observations, remarques..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity style={styles.saveNotesBtn} onPress={saveNotes}>
              <Text style={styles.saveNotesBtnText}>{notesSaved ? '✓ Sauvegardé' : 'Sauvegarder les notes'}</Text>
            </TouchableOpacity>
          </Section>

          {data.status === 'rejected' && data.rejection_reason && (
            <View style={styles.rejectionBanner}>
              <Text style={styles.rejectionTitle}>Motif de refus communiqué</Text>
              <Text style={styles.rejectionText}>{data.rejection_reason}</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Onglet Messages ── */}
      {tab === 'messages' && (
        <View style={{ flex: 1 }}>
          <MessageThread candidatureId={candidatureId} />
        </View>
      )}

      {/* ── Modal refus ── */}
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
              numberOfLines={3}
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
                <Text style={styles.modalConfirmText}>{saving ? '...' : 'Confirmer le refus'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, mono && styles.mono]}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, flexDirection: 'column', backgroundColor: '#fff' },
  centered:{ flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  headerMeta: { flex: 1, gap: 6 },
  headerName: { fontSize: 15, fontWeight: '800', color: Colors.text },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot:  { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  closeBtn:   { padding: 6 },
  closeBtnText: { fontSize: 18, color: Colors.textMuted },

  // Tabs
  tabs:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 16 },
  tab:         { paddingVertical: 12, paddingHorizontal: 4, marginRight: 24 },
  tabActive:   { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText:     { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  // Actions bar
  actionsBar:  { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  actionBtn:   { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Scroll content
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Section
  section:      { borderBottomWidth: 1, borderBottomColor: Colors.border, padding: 16 },
  sectionTitle: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },

  // Fields
  fieldRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  fieldValue: { fontSize: 12, color: Colors.text, fontWeight: '500', flex: 2, textAlign: 'right' },
  mono:       { fontFamily: 'monospace', fontSize: 11, letterSpacing: 1 },
  descBlock:  { paddingTop: 8 },
  descText:   { fontSize: 13, color: Colors.text, lineHeight: 20, marginTop: 4 },

  // Notes
  notesInput:     { backgroundColor: Colors.surface, borderRadius: 8, padding: 10, color: Colors.text, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border, fontSize: 13, marginBottom: 10 },
  saveNotesBtn:   { backgroundColor: Colors.primary, borderRadius: 8, padding: 10, alignItems: 'center' },
  saveNotesBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Rejection
  rejectionBanner: { margin: 16, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#FCA5A5' },
  rejectionTitle:  { color: '#DC2626', fontWeight: '700', marginBottom: 4, fontSize: 13 },
  rejectionText:   { color: '#7F1D1D', fontSize: 13, lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox:     { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 },
  modalTitle:   { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  modalSub:     { fontSize: 13, color: Colors.textSecondary, marginBottom: 14 },
  modalInput:   { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, color: Colors.text, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border, fontSize: 13, marginBottom: 16 },
  modalBtns:    { flexDirection: 'row', gap: 10 },
  modalCancel:  { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '600' },
  modalConfirm: { flex: 1, backgroundColor: '#EF4444', borderRadius: 10, padding: 12, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});
