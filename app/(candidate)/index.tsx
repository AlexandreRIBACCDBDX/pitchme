import { View, Text, StyleSheet, TouchableOpacity, Clipboard, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';

export default function CandidatureSuccess() {
  const { code } = useLocalSearchParams<{ code?: string }>();

  function copyCode() {
    if (!code) return;
    Clipboard.setString(code);
    Alert.alert('Copié !', 'Le code a été copié dans le presse-papiers.');
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <AppLogo size={36} />
        <Text style={styles.wordmarkBold}>Pitch</Text>
        <Text style={styles.wordmarkLight}>Me</Text>
      </View>

      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>Candidature envoyée !</Text>
      <Text style={styles.text}>
        Votre dossier a bien été reçu. L'équipe organisatrice le traitera dans les meilleurs délais et vous contactera par email.
      </Text>

      {code ? (
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Votre code d'accès personnel</Text>
          <TouchableOpacity onPress={copyCode} activeOpacity={0.7}>
            <Text style={styles.code}>{code}</Text>
          </TouchableOpacity>
          <Text style={styles.codeHint}>
            Conservez ce code précieusement. Il vous permettra de consulter l'état de votre dossier à tout moment via "Mon espace".
          </Text>
          <TouchableOpacity style={styles.copyBtn} onPress={copyCode}>
            <Text style={styles.copyBtnText}>📋 Copier le code</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(candidate)/choisir-candidature')}>
        <Text style={styles.btnText}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 28 },
  logoRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 },
  wordmarkBold:  { fontSize: 22, fontWeight: '800', color: Colors.text },
  wordmarkLight: { fontSize: 22, fontWeight: '300', color: Colors.primary },
  emoji:         { fontSize: 64, marginBottom: 16 },
  title:         { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginBottom: 12, textAlign: 'center' },
  text:          { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 23, marginBottom: 28 },
  codeCard:      { backgroundColor: Colors.card, borderRadius: 16, padding: 20, width: '100%', alignItems: 'center', borderWidth: 2, borderColor: Colors.primary, marginBottom: 24 },
  codeLabel:     { fontSize: 12, color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  code:          { fontSize: 32, fontWeight: '800', color: Colors.primary, letterSpacing: 6, marginBottom: 12 },
  codeHint:      { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  copyBtn:       { backgroundColor: Colors.primary + '18', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
  copyBtnText:   { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  btn:           { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  btnText:       { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
