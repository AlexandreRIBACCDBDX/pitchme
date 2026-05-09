import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import Constants from 'expo-constants';
import { Colors } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';

const PROD_URL = 'https://pitchme.app/apply';
const STORAGE_KEY = 'pitchme_qr_custom_url';

function getDevUrl() {
  const host = Constants.expoConfig?.hostUri;
  if (host) return `http://${host}/apply`;
  return null;
}

export default function QRCodeScreen() {
  const [customUrl, setCustomUrl] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const devUrl = getDevUrl();
  const defaultUrl = devUrl || PROD_URL;
  const activeUrl = customUrl || defaultUrl;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setCustomUrl(saved);
    } catch {}
  }, []);

  function confirmUrl() {
    try {
      if (customUrl.trim()) {
        window.localStorage.setItem(STORAGE_KEY, customUrl.trim());
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
    setEditingUrl(false);
  }

  async function handleShare() {
    await Share.share({
      title: 'PitchMe – Marché de Noël de Bourg-sur-Gironde',
      message: `Déposez votre candidature via PitchMe : ${activeUrl}`,
      url: activeUrl,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>QR Code Candidature</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.qrCard}>
          <View style={styles.qrLogoRow}>
            <AppLogo size={52} />
            <View style={styles.qrWordmark}>
              <Text style={styles.qrTitleBold}>Pitch</Text>
              <Text style={styles.qrTitleLight}>Me</Text>
            </View>
          </View>
          <Text style={styles.qrSubtitle}>Marché de Noël · Bourg-sur-Gironde 2025</Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={activeUrl}
              size={220}
              backgroundColor="#FFFFFF"
              color="#000000"
            />
          </View>

          <Text style={styles.qrHint}>Scannez pour postuler directement</Text>
        </View>

        {/* URL configurator */}
        <View style={styles.urlCard}>
          <Text style={styles.urlLabel}>URL du formulaire</Text>
          {editingUrl ? (
            <View style={styles.urlEditRow}>
              <TextInput
                style={styles.urlInput}
                value={customUrl}
                onChangeText={setCustomUrl}
                placeholder={defaultUrl}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TouchableOpacity style={styles.urlSaveBtn} onPress={confirmUrl}>
                <Text style={styles.urlSaveBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingUrl(true)} style={styles.urlDisplay}>
              <Text style={styles.urlText} numberOfLines={1}>{activeUrl}</Text>
              <Text style={styles.urlEditHint}>Appuyer pour modifier</Text>
            </TouchableOpacity>
          )}

          {devUrl && (
            <View style={styles.devBadge}>
              <Text style={styles.devText}>🔧 URL locale détectée — à remplacer par votre domaine en production</Text>
            </View>
          )}
        </View>

        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>Parcours du candidat</Text>
          <View style={styles.flowStep}><Text style={styles.flowNum}>1</Text><Text style={styles.flowText}>Scan du QR code</Text></View>
          <View style={styles.flowArrow}><Text style={styles.flowArrowText}>↓</Text></View>
          <View style={styles.flowStep}><Text style={styles.flowNum}>2</Text><Text style={styles.flowText}>Création de compte + validation email</Text></View>
          <View style={styles.flowArrow}><Text style={styles.flowArrowText}>↓</Text></View>
          <View style={styles.flowStep}><Text style={styles.flowNum}>3</Text><Text style={styles.flowText}>Formulaire de candidature</Text></View>
          <View style={styles.flowArrow}><Text style={styles.flowArrowText}>↓</Text></View>
          <View style={styles.flowStep}><Text style={styles.flowNum}>4</Text><Text style={styles.flowText}>Candidature dans votre dashboard</Text></View>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>📤 Partager le lien</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { color: Colors.textSecondary, fontSize: 16, width: 60 },
  title: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },
  content: { padding: 24, gap: 16 },
  qrCard: { backgroundColor: Colors.card, borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  qrLogoRow:    { alignItems: 'center', marginBottom: 8 },
  qrWordmark:   { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  qrTitleBold:  { fontSize: 26, fontWeight: '800', color: '#1A202C' },
  qrTitleLight: { fontSize: 26, fontWeight: '300', color: Colors.primary },
  qrSubtitle:   { fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  qrContainer: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  qrHint: { fontSize: 14, color: Colors.textSecondary },
  urlCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  urlLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 10 },
  urlDisplay: { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.border },
  urlText: { color: Colors.primary, fontSize: 13, fontWeight: '500' },
  urlEditHint: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  urlEditRow: { flexDirection: 'row', gap: 10 },
  urlInput: { flex: 1, backgroundColor: Colors.surface, borderRadius: 10, padding: 12, color: Colors.text, fontSize: 13, borderWidth: 1, borderColor: Colors.primary },
  urlSaveBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  urlSaveBtnText: { color: '#fff', fontWeight: 'bold' },
  devBadge: { backgroundColor: Colors.warning + '18', borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: Colors.warning + '40' },
  devText: { color: Colors.goldDark, fontSize: 12 },
  flowCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  flowTitle: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 14 },
  flowStep: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flowNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, color: '#fff', textAlign: 'center', lineHeight: 28, fontWeight: 'bold', fontSize: 13 },
  flowText: { color: Colors.text, fontSize: 14, flex: 1 },
  flowArrow: { paddingLeft: 8, paddingVertical: 4 },
  flowArrowText: { color: Colors.textMuted, fontSize: 18 },
  shareBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
