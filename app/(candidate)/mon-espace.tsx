import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';
import PhotoPicker from '@/components/PhotoPicker';
import PhotoGallery from '@/components/PhotoGallery';

const STATUS_CONFIG: Record<string, { icon: string; bg: string; tint: string; label: string; hint: string }> = {
  pending:   { icon: '⏳', bg: '#FEF3C7', tint: '#D97706', label: 'En attente',        hint: "Votre dossier est bien reçu et attend d'être lu par l'équipe organisatrice." },
  reviewing: { icon: '🔍', bg: '#DBEAFE', tint: '#2563EB', label: "En cours d'étude", hint: "Votre dossier est en cours d'examen. Nous reviendrons vers vous prochainement." },
  accepted:  { icon: '🎉', bg: '#D1FAE5', tint: '#059669', label: 'Retenu !',          hint: "Félicitations ! Votre candidature a été retenue pour le Marché de Noël." },
  rejected:  { icon: '❌', bg: '#FEE2E2', tint: '#DC2626', label: 'Non retenu',        hint: "Votre candidature n'a pas été retenue cette année." },
};

const TYPE_LABEL: Record<string, string> = {
  market:    '🏪 Stand marché',
  foodtruck: '🚚 Food Truck',
};

interface MsgRow {
  id: string;
  content: string;
  sender_role: 'admin' | 'candidate';
  is_read: boolean;
  created_at: string;
}

export default function MonEspace() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candidature, setCandidature] = useState<any>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState('');

  const [newPhotos, setNewPhotos] = useState<any[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState('');
  const [photoUploadSuccess, setPhotoUploadSuccess] = useState(false);
  const [photoPickerKey, setPhotoPickerKey] = useState(0);

  function formatCode(raw: string) {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length <= 4) return clean;
    return clean.slice(0, 4) + '-' + clean.slice(4, 8);
  }

  async function loadMessages(cleanedCode: string) {
    const { data } = await supabase.rpc('get_messages_by_access_code', { p_code: cleanedCode });
    if (data) setMessages(Array.isArray(data) ? data : [data]);
  }

  async function handleSearch() {
    const cleaned = code.replace(/\s/g, '');
    if (cleaned.length < 9) { setError('Le code doit contenir 8 caractères (ex: ABCD-EF23)'); return; }

    setError('');
    setLoading(true);
    setCandidature(null);
    setMessages([]);

    try {
      const [{ data, error: rpcError }, { data: msgs }] = await Promise.all([
        supabase.rpc('get_candidature_by_access_code', { p_code: cleaned }),
        supabase.rpc('get_messages_by_access_code', { p_code: cleaned }),
      ]);

      if (rpcError) throw rpcError;
      if (!data || (Array.isArray(data) && data.length === 0)) {
        setError('Aucune candidature trouvée pour ce code. Vérifiez le code reçu après votre inscription.');
        return;
      }
      setCandidature(Array.isArray(data) ? data[0] : data);
      if (msgs) setMessages(Array.isArray(msgs) ? msgs : [msgs]);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoUpload() {
    if (newPhotos.length === 0) return;
    const cleaned = code.replace(/\s/g, '');
    setUploadingPhotos(true);
    setPhotoUploadError('');
    setPhotoUploadSuccess(false);
    try {
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        webp: 'image/webp', heic: 'image/heic',
      };
      const urls: string[] = [];
      for (const photo of newPhotos) {
        try {
          const rawExt = (photo.name ?? '').split('.').pop()?.toLowerCase() || 'jpg';
          const ext = rawExt === 'jpg' ? 'jpeg' : rawExt;
          const mime = mimeMap[rawExt] ?? 'image/jpeg';
          const path = `${candidature.id}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
          const response = await fetch(photo.uri);
          const blob = await response.blob();
          const { data: uploadData, error: storageError } = await supabase.storage
            .from('product-photos').upload(path, blob, { contentType: mime });
          if (storageError) { console.warn('[Photo upload]', storageError.message); continue; }
          if (uploadData) {
            const { data: { publicUrl } } = supabase.storage.from('product-photos').getPublicUrl(path);
            urls.push(publicUrl);
          }
        } catch (e) { console.warn('[Photo exception]', e); }
      }

      if (urls.length === 0) {
        setPhotoUploadError('Aucune photo n\'a pu être envoyée. Vérifiez votre connexion.');
        return;
      }

      const { error: rpcError } = await supabase.rpc('add_photos_to_candidature', {
        p_code: cleaned,
        p_urls: urls,
      });
      if (rpcError) throw rpcError;

      setCandidature((c: any) => ({ ...c, photo_urls: [...(c.photo_urls ?? []), ...urls] }));
      setNewPhotos([]);
      setPhotoPickerKey(k => k + 1);
      setPhotoUploadSuccess(true);
      setTimeout(() => setPhotoUploadSuccess(false), 4000);
    } catch (e: any) {
      setPhotoUploadError(e?.message ?? 'Erreur lors de l\'envoi des photos.');
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function handleReply() {
    if (!reply.trim()) return;
    const cleaned = code.replace(/\s/g, '');
    setReplyError('');
    setSendingReply(true);
    try {
      const { error: rpcError } = await supabase.rpc('send_candidate_message', {
        p_code: cleaned,
        p_content: reply.trim(),
      });
      if (rpcError) throw rpcError;
      setReply('');
      await loadMessages(cleaned);
    } catch (e: any) {
      setReplyError(e?.message ?? 'Erreur lors de l\'envoi. Réessayez.');
    } finally {
      setSendingReply(false);
    }
  }

  const cfg = candidature ? (STATUS_CONFIG[candidature.status] ?? STATUS_CONFIG.pending) : null;
  const unreadCount = messages.filter(m => m.sender_role === 'admin' && !m.is_read).length;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <AppLogo size={44} />
          <View style={styles.wordmark}>
            <Text style={styles.wordmarkBold}>Pitch</Text>
            <Text style={styles.wordmarkLight}>Me</Text>
          </View>
        </View>

        <Text style={styles.title}>Mon espace candidat</Text>
        <Text style={styles.sub}>Entrez le code reçu lors de votre inscription pour consulter l'état de votre dossier.</Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={v => { setCode(formatCode(v)); setError(''); setCandidature(null); setMessages([]); }}
            placeholder="ABCD-EF23"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={9}
          />
          <TouchableOpacity
            style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.searchBtnText}>Accéder →</Text>
            }
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {candidature && cfg && (
          <>
            {/* ── Statut & infos ── */}
            <View style={styles.result}>
              <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
                <Text style={styles.statusIcon}>{cfg.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusLabel, { color: cfg.tint }]}>{cfg.label}</Text>
                  <Text style={styles.statusHint}>{cfg.hint}</Text>
                </View>
              </View>

              <View style={styles.infoBlock}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Commerce</Text>
                  <Text style={styles.infoValue}>{candidature.business_name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Type</Text>
                  <Text style={styles.infoValue}>{TYPE_LABEL[candidature.candidature_type ?? 'market'] ?? '—'}</Text>
                </View>
                {candidature.product_category ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Catégorie</Text>
                    <Text style={styles.infoValue}>{candidature.product_category}</Text>
                  </View>
                ) : null}
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Déposée le</Text>
                  <Text style={styles.infoValue}>
                    {new Date(candidature.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Contact</Text>
                  <Text style={styles.infoValue}>{candidature.contact_first_name} {candidature.contact_last_name}</Text>
                </View>
              </View>

              {candidature.status === 'rejected' && candidature.rejection_reason ? (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionTitle}>Motif de refus</Text>
                  <Text style={styles.rejectionText}>{candidature.rejection_reason}</Text>
                </View>
              ) : null}

              {candidature.status === 'accepted' && (
                <View style={styles.acceptedBox}>
                  <Text style={styles.acceptedText}>
                    L'équipe organisatrice vous contactera à l'adresse {candidature.contact_email} pour les prochaines étapes.
                  </Text>
                </View>
              )}

              <View style={styles.codeReminder}>
                <Text style={styles.codeReminderText}>Votre code d'accès : </Text>
                <Text style={styles.codeReminderCode}>{candidature.access_code}</Text>
              </View>
            </View>

            {/* ── Photos ── */}
            <View style={styles.photosCard}>
              <Text style={styles.photosCardTitle}>📷 Photos de votre dossier</Text>

              <View style={styles.photoGalleryWrap}>
                <PhotoGallery
                  urls={candidature.photo_urls ?? []}
                  thumbSize={88}
                  emptyText="Aucune photo pour l'instant."
                />
              </View>

              <View style={styles.addPhotosBox}>
                <Text style={styles.addPhotosLabel}>Ajouter des photos</Text>
                <Text style={styles.addPhotosHint}>Produits, stand, camion... jusqu'à 6 photos</Text>
                <PhotoPicker key={photoPickerKey} onPhotosChange={setNewPhotos} maxPhotos={6} />
                {photoUploadError ? (
                  <View style={styles.uploadErrorBox}>
                    <Text style={styles.uploadErrorText}>{photoUploadError}</Text>
                  </View>
                ) : null}
                {photoUploadSuccess ? (
                  <View style={styles.uploadSuccessBox}>
                    <Text style={styles.uploadSuccessText}>✓ Photos ajoutées à votre dossier !</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[styles.uploadBtn, (newPhotos.length === 0 || uploadingPhotos) && styles.uploadBtnDisabled]}
                  onPress={handlePhotoUpload}
                  disabled={newPhotos.length === 0 || uploadingPhotos}
                >
                  {uploadingPhotos
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.uploadBtnText}>
                        {newPhotos.length > 0 ? `Envoyer ${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''}` : 'Sélectionnez des photos'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Messages ── */}
            <View style={styles.messagesCard}>
              <View style={styles.messagesHeader}>
                <Text style={styles.messagesTitle}>💬 Messages de l'organisateur</Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCount} nouveau{unreadCount > 1 ? 'x' : ''}</Text>
                  </View>
                )}
              </View>

              {messages.length === 0 ? (
                <Text style={styles.noMessages}>
                  Aucun message pour l'instant. L'équipe vous contactera ici si nécessaire.
                </Text>
              ) : (
                <View style={styles.messagesList}>
                  {messages.map(msg => (
                    <View
                      key={msg.id}
                      style={[
                        styles.msgBubble,
                        msg.sender_role === 'admin' ? styles.msgBubbleAdmin : styles.msgBubbleCandidate,
                      ]}
                    >
                      <Text style={styles.msgSender}>
                        {msg.sender_role === 'admin' ? '🏛 Organisateur' : '👤 Vous'}
                      </Text>
                      <Text style={[
                        styles.msgContent,
                        msg.sender_role === 'admin' ? styles.msgContentAdmin : styles.msgContentCandidate,
                      ]}>
                        {msg.content}
                      </Text>
                      <Text style={styles.msgTime}>
                        {new Date(msg.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {' · '}
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.replySection}>
                <Text style={styles.replyLabel}>Répondre à l'organisateur</Text>
                <TextInput
                  style={styles.replyInput}
                  value={reply}
                  onChangeText={v => { setReply(v); setReplyError(''); }}
                  placeholder="Votre message..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
                {replyError ? (
                  <Text style={styles.replyError}>{replyError}</Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.replyBtn, (!reply.trim() || sendingReply) && styles.replyBtnDisabled]}
                  onPress={handleReply}
                  disabled={!reply.trim() || sendingReply}
                >
                  {sendingReply
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.replyBtnText}>Envoyer le message</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* ── Nouvelle candidature ── */}
        <View style={styles.newCandidatureBox}>
          <Text style={styles.newCandidatureTitle}>Déposer une autre candidature</Text>
          <Text style={styles.newCandidatureDesc}>
            Vous souhaitez candidater avec une autre activité ou un autre stand ?
          </Text>
          <TouchableOpacity
            style={styles.newCandidatureBtn}
            onPress={() => router.push('/(candidate)/choisir-candidature')}
          >
            <Text style={styles.newCandidatureBtnText}>+ Nouvelle candidature</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  scroll:      { padding: 24, paddingTop: 56, paddingBottom: 48 },
  backBtn:     { marginBottom: 24 },
  backText:    { color: Colors.textSecondary, fontSize: 16 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  wordmark:    { flexDirection: 'row', alignItems: 'baseline' },
  wordmarkBold:  { fontSize: 22, fontWeight: '800', color: Colors.text },
  wordmarkLight: { fontSize: 22, fontWeight: '300', color: Colors.primary },
  title:       { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  sub:         { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: 28 },
  inputRow:    { flexDirection: 'row', gap: 10, marginBottom: 16 },
  codeInput:   { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, color: Colors.text, fontSize: 20, fontWeight: 'bold', letterSpacing: 3, textAlign: 'center' },
  searchBtn:   { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  errorBox:    { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  errorText:   { color: '#DC2626', fontSize: 14 },

  // Résultat candidature
  result:       { backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginTop: 8, marginBottom: 16 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  statusIcon:   { fontSize: 32 },
  statusLabel:  { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  statusHint:   { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  infoBlock:    { padding: 18, gap: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoKey:      { fontSize: 13, color: Colors.textMuted, flex: 1 },
  infoValue:    { fontSize: 14, color: Colors.text, fontWeight: '600', flex: 2, textAlign: 'right' },
  rejectionBox: { margin: 18, marginTop: 0, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#FECACA' },
  rejectionTitle: { color: '#DC2626', fontWeight: 'bold', fontSize: 13, marginBottom: 6 },
  rejectionText:  { color: Colors.text, fontSize: 14, lineHeight: 20 },
  acceptedBox:  { margin: 18, marginTop: 0, backgroundColor: '#D1FAE5', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#6EE7B7' },
  acceptedText: { color: '#065F46', fontSize: 14, lineHeight: 20 },
  codeReminder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  codeReminderText: { color: Colors.textMuted, fontSize: 12 },
  codeReminderCode: { color: Colors.text, fontSize: 13, fontWeight: 'bold', letterSpacing: 2 },

  // Photos
  photosCard:        { backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 16 },
  photosCardTitle:   { fontSize: 16, fontWeight: 'bold', color: Colors.text, padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border },
  photoGalleryWrap:  { padding: 16, paddingTop: 8 },
  addPhotosBox:      { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  addPhotosLabel:    { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  addPhotosHint:     { fontSize: 12, color: Colors.textMuted, marginBottom: 14 },
  uploadErrorBox:    { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#FECACA' },
  uploadErrorText:   { color: '#DC2626', fontSize: 13 },
  uploadSuccessBox:  { backgroundColor: '#D1FAE5', borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#6EE7B7' },
  uploadSuccessText: { color: '#065F46', fontSize: 13, fontWeight: '600' },
  uploadBtn:         { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText:     { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  // Messages
  messagesCard:    { backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  messagesHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border },
  messagesTitle:   { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  unreadBadge:     { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  noMessages:      { color: Colors.textMuted, fontSize: 14, padding: 24, textAlign: 'center', lineHeight: 20 },
  messagesList:    { padding: 16, gap: 12 },
  msgBubble:       { borderRadius: 12, padding: 14 },
  msgBubbleAdmin:  { backgroundColor: '#EFF6FF', borderLeftWidth: 3, borderLeftColor: Colors.primary },
  msgBubbleCandidate: { backgroundColor: Colors.surface, borderLeftWidth: 3, borderLeftColor: Colors.secondary, marginLeft: 16 },
  msgSender:       { fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  msgContent:      { fontSize: 15, lineHeight: 22 },
  msgContentAdmin: { color: Colors.text },
  msgContentCandidate: { color: Colors.textSecondary },
  msgTime:         { fontSize: 11, color: Colors.textMuted, marginTop: 8, textAlign: 'right' },

  // Reply
  replySection:  { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  replyLabel:    { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 10 },
  replyInput:    { backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 12, color: Colors.text, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 10 },
  replyError:    { color: Colors.error, fontSize: 13, marginBottom: 8 },
  replyBtn:      { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  replyBtnDisabled: { opacity: 0.5 },
  replyBtnText:  { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  // Nouvelle candidature
  newCandidatureBox:     { marginTop: 28, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 20, alignItems: 'center', backgroundColor: Colors.card },
  newCandidatureTitle:   { fontSize: 15, fontWeight: 'bold', color: Colors.text, marginBottom: 6 },
  newCandidatureDesc:    { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  newCandidatureBtn:     { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  newCandidatureBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
});
