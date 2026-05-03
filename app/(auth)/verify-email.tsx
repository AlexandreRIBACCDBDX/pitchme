import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useState } from 'react';

export default function VerifyEmail() {
  const [resending, setResending] = useState(false);

  async function resendEmail() {
    const session = await supabase.auth.getSession();
    const email = session.data.session?.user?.email;
    if (!email) { router.replace('/(auth)/login'); return; }
    setResending(true);
    await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    Alert.alert('Email envoyé', 'Vérifiez votre boîte mail.');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📧</Text>
      <Text style={styles.title}>Vérifiez votre email</Text>
      <Text style={styles.text}>
        Un lien de confirmation vous a été envoyé.{'\n'}
        Cliquez dessus pour activer votre compte, puis revenez vous connecter.
      </Text>

      <TouchableOpacity style={styles.button} onPress={resendEmail} disabled={resending}>
        <Text style={styles.buttonText}>{resending ? 'Envoi...' : 'Renvoyer l\'email'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
        <Text style={styles.link}>Retour à la connexion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emoji: { fontSize: 64, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.gold, marginBottom: 16, textAlign: 'center' },
  text: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  button: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  link: { color: Colors.textSecondary, fontSize: 16 },
});
