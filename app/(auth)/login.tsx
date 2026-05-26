import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        const msg = authError.message.toLowerCase();
        if (msg.includes('invalid') || msg.includes('credentials')) {
          setError('Email ou mot de passe incorrect.');
        } else {
          setError(authError.message);
        }
        return;
      }

      const { data: profile } = await (supabase.from('profiles') as any)
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profile?.role !== 'admin') {
        await supabase.auth.signOut();
        setError('Accès réservé aux administrateurs.');
        return;
      }

      router.replace('/(admin)');
    } catch (e: any) {
      setError(e?.message ?? 'Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <AppLogo size={64} />
          <View style={styles.wordmark}>
            <Text style={styles.wordmarkBold}>Pitch</Text>
            <Text style={styles.wordmarkLight}>Me</Text>
          </View>
          <Text style={styles.badge}>Espace Admin</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connexion administrateur</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={v => { setEmail(v); setError(''); }}
            placeholder="admin@email.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={v => { setPassword(v); setError(''); }}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.buttonText}>Se connecter</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(candidate)/choisir-candidature')}>
          <Text style={styles.backText}>← Retour au formulaire candidat</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.background },
  inner:         { flex: 1, padding: 24, justifyContent: 'center' },
  header:        { alignItems: 'center', marginBottom: 32 },
  wordmark:      { flexDirection: 'row', alignItems: 'baseline', marginTop: 14 },
  wordmarkBold:  { fontSize: 28, fontWeight: '800', color: '#1A202C' },
  wordmarkLight: { fontSize: 28, fontWeight: '300', color: Colors.primary },
  badge:         { marginTop: 8, backgroundColor: Colors.primary + '18', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, color: Colors.primary, fontWeight: '700', fontSize: 12, letterSpacing: 1, overflow: 'hidden' },
  card:          { backgroundColor: Colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border },
  cardTitle:     { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 20 },
  errorBox:      { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  errorText:     { color: '#DC2626', fontSize: 14 },
  label:         { fontSize: 14, color: Colors.textSecondary, marginBottom: 6 },
  input:         { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, color: Colors.text, fontSize: 16, marginBottom: 16 },
  button:        { backgroundColor: Colors.primary, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8, minHeight: 52, justifyContent: 'center' },
  buttonDisabled:{ opacity: 0.6 },
  buttonText:    { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  backBtn:       { marginTop: 24, alignItems: 'center' },
  backText:      { color: Colors.textSecondary, fontSize: 14 },
});
