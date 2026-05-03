import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Modal, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import StatusBadge from '@/components/StatusBadge';
import MessageThread from '@/components/MessageThread';
import type { CandidatureWithProfile } from '@/types/database';

type TabType = 'info' | 'documents' | 'messages';

export default function AdminCandidatureDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('info');
  const [statusModal, setStatusModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    const [{ data: cand }, { data: docs }] = await Promise.all([
      supabase.from('candidatures').select('*, profiles(*)').eq('id', id).single(),
      supabase.from('documents').select('*').eq('candidature_id', id),
    ]);
    if (cand) { setData(cand); setNotes(cand.admin_notes || ''); setRejectionReason(cand.rejection_reason || ''); }
    if (docs) setDocuments(docs);
    setLoading(false);
  }

  async function updateStatus(status: string) {
    setSavingStatus(true);
    const { error } = await supabase.from('candidatures').update({
      status,
      admin_notes: notes,
      rejection_reason: status === 'rejected' ? rejectionReason : null,
    }).eq('id', id);
    setSavingStatus(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    setData((d: any) => ({ ...d, status, admin_notes: notes, rejection_reason: rejectionReason }));
    setStatusModal(false);

    // Send notification message
    const statusMessages: Record<string, string> = {
      reviewing: '📋 Votre candidature est maintenant en cours d\'étude. Nous reviendrons vers vous prochainement.',
      accepted: '🎉 Félicitations ! Votre candidature a été retenue pour le Marché de Noël de Bourg-en-Bresse. Nous vous contacterons prochainement pour les détails.',
      rejected: `❌ Votre candidature n'a pas été retenue${rejectionReason ? '. Motif : ' + rejectionReason : '.'}`,
    };
    if (statusMessages[status]) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('messages').insert({
        candidature_id: id,
        sender_id: user!.id,
        content: statusMessages[status],
      });
    }
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }
  if (!data) {
    return <View style={styles.centered}><Text style={styles.errorText}>Candidature introuvable</Text></View>;
  }

  const p = data.profiles;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Retour</Text>
        </TouchableOpacity>
        <StatusBadge status={data.status} />
      </View>

      <View style={styles.titleBar}>
        <Text style={styles.businessName}>{data.business_name}</Text>
        <Text style={styles.candidateName}>{p?.first_name} {p?.last_name}</Text>
      </View>

      {/* Status actions */}
      <View style={styles.actionsBar}>
        {['reviewing', 'accepted', 'rejected'].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.statusBtn, data.status === s && styles.statusBtnActive, s === 'accepted' && { borderColor: Colors.success }, s === 'rejected' && { borderColor: Colors.error }, s === 'reviewing' && { borderColor: Colors.info }]}
            onPress={() => { if (s === 'rejected') { setStatusModal(true); } else { Alert.alert('Confirmer', `Passer en "${s === 'reviewing' ? 'En étude' : 'Retenu'}" ?`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Confirmer', onPress: () => updateStatus(s) }]); } }}
          >
            <Text style={[styles.statusBtnText, s === 'accepted' && { color: Colors.success }, s === 'rejected' && { color: Colors.error }, s === 'reviewing' && { color: Colors.info }]}>
              {s === 'reviewing' ? '📋 En étude' : s === 'accepted' ? '✅ Retenir' : '❌ Refuser'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['info', 'documents', 'messages'] as TabType[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'info' ? '📋 Infos' : t === 'documents' ? `📁 Docs (${documents.length})` : '💬 Messages'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'info' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Section title="Contact">
            <InfoRow label="Nom" value={`${p?.first_name} ${p?.last_name}`} />
            <InfoRow label="Email" value={p?.email} />
            <InfoRow label="Téléphone" value={p?.phone || '—'} />
          </Section>
          <Section title="Entreprise">
            <InfoRow label="Raison sociale" value={data.business_name} />
            <InfoRow label="SIRET" value={data.siret} />
            <InfoRow label="Adresse" value={`${data.address}, ${data.postal_code} ${data.city}`} />
            {data.siret_data && <InfoRow label="Activité" value={(data.siret_data as any).activite_principale || '—'} />}
          </Section>
          <Section title="Produits">
            <InfoRow label="Catégorie" value={data.product_category} />
            <InfoRow label="Description" value={data.product_description} multiline />
            {data.website_url && <InfoRow label="Site web" value={data.website_url} />}
          </Section>
          <Section title="Stand">
            <InfoRow label="Taille" value={data.stand_size || '—'} />
            <InfoRow label="Électricité" value={data.electricity_needed ? 'Oui' : 'Non'} />
            <InfoRow label="Ancien exposant" value={data.previous_participant ? 'Oui' : 'Non'} />
          </Section>
          <Section title="Notes admin">
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ajouter des notes internes..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity style={styles.saveNotesBtn} onPress={async () => {
              await supabase.from('candidatures').update({ admin_notes: notes }).eq('id', id);
              Alert.alert('Sauvegardé');
            }}>
              <Text style={styles.saveNotesBtnText}>Sauvegarder les notes</Text>
            </TouchableOpacity>
          </Section>
        </ScrollView>
      )}

      {tab === 'documents' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {documents.length === 0 ? (
            <Text style={styles.emptyText}>Aucun document déposé.</Text>
          ) : (
            <View style={styles.photoGrid}>
              {documents.map(doc => (
                <View key={doc.id} style={styles.photoCard}>
                  {doc.file_type === 'image' ? (
                    <Image source={{ uri: doc.file_url }} style={styles.photo} resizeMode="cover" />
                  ) : (
                    <View style={styles.docPlaceholder}><Text style={styles.docIcon}>📄</Text></View>
                  )}
                  <Text style={styles.docName} numberOfLines={1}>{doc.file_name}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {tab === 'messages' && (
        <MessageThread candidatureId={id} />
      )}

      {/* Rejection modal */}
      <Modal visible={statusModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Motif de refus</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Expliquez le motif de refus au candidat..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setStatusModal(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, savingStatus && { opacity: 0.6 }]} onPress={() => updateStatus('rejected')} disabled={savingStatus}>
                <Text style={styles.modalConfirmText}>{savingStatus ? 'Envoi...' : 'Confirmer le refus'}</Text>
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

function InfoRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <View style={[styles.infoRow, multiline && styles.infoRowMulti]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, multiline && styles.infoValueMulti]}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  errorText: { color: Colors.error },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  back: { color: Colors.textSecondary, fontSize: 16 },
  titleBar: { paddingHorizontal: 20, paddingBottom: 12 },
  businessName: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  candidateName: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  actionsBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  statusBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: Colors.card },
  statusBtnActive: { backgroundColor: Colors.surface },
  statusBtnText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, marginHorizontal: 16 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontSize: 13 },
  tabTextActive: { color: Colors.primary, fontWeight: 'bold' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  section: { backgroundColor: Colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: Colors.gold, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoRowMulti: { flexDirection: 'column', gap: 4 },
  infoLabel: { color: Colors.textSecondary, fontSize: 13 },
  infoValue: { color: Colors.text, fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  infoValueMulti: { maxWidth: '100%', textAlign: 'left', lineHeight: 20 },
  notesInput: { backgroundColor: Colors.surface, borderRadius: 8, padding: 12, color: Colors.text, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  saveNotesBtn: { backgroundColor: Colors.primaryDark, borderRadius: 8, padding: 12, alignItems: 'center' },
  saveNotesBtnText: { color: '#fff', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: Colors.textMuted, padding: 40 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoCard: { width: '46%' },
  photo: { width: '100%', height: 150, borderRadius: 10 },
  docPlaceholder: { width: '100%', height: 150, borderRadius: 10, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  docIcon: { fontSize: 40 },
  docName: { color: Colors.textSecondary, fontSize: 12, marginTop: 6, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  modalInput: { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, color: Colors.text, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  modalCancelText: { color: Colors.textSecondary, fontWeight: 'bold' },
  modalConfirm: { flex: 1, backgroundColor: Colors.error, borderRadius: 10, padding: 14, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: 'bold' },
});
