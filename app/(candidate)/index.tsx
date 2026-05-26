import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';

export default function CandidatureSuccess() {
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

      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(candidate)/choisir-candidature')}>
        <Text style={styles.btnText}>Soumettre une autre candidature</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 },
  logoRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40 },
  wordmarkBold:  { fontSize: 22, fontWeight: '800', color: Colors.text },
  wordmarkLight: { fontSize: 22, fontWeight: '300', color: Colors.primary },
  emoji:         { fontSize: 72, marginBottom: 20 },
  title:         { fontSize: 26, fontWeight: 'bold', color: Colors.text, marginBottom: 16, textAlign: 'center' },
  text:          { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  btn:           { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  btnText:       { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
