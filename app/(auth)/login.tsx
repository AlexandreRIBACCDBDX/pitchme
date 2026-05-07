import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';

export default function Login() {
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
        if (msg.includes('not confirmed') || msg.includes('email_not_confirmed')) {
          setError('Email non confirmé — vérifiez votre boîte mail.');
        } else if (msg.includes('invalid') || msg.includes('credentials')) {
          setError('Email ou mot de passe incorrect.');
        } else {
          setError(authError.message);
        }
        return;
      }

      // Fetch profile to determine role — fallback to candidate if fetch fails
      let role = 'candidate';
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!profile) {
          await (supabase.from('profiles') as any).insert({
            id: data.user.id,
            email: data.user.email ?? '',
            role: 'candidate',
          });
        } else {
          role = profile.role;
        }
      } catch {
        // profile fetch failed — default role already 'candidate'
      }

      router.replace(role === 'admin' ? '/(admin)' : '/(candidate)');
    } catch (e: any) {
      setError(e?.message ?? 'Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <AppLogo size={80} />
          <View style={styles.wordmark}>
            <Text style={styles.wordmarkBold}>Pitch</Text>
            <Text style={styles.wordmarkLight}>Me</Text>
          </View>
          <Text style={styles.subtitle}>Marché de Noël · Bourg-sur-Gironde</Text>
          <Text style={styles.tagline}>Espace Candidat</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connexion</Text>

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
            placeholder="votre@email.com"
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

          <TouchableOpacity onPress={() => router.push('/(auth)/register')} disabled={loading}>
            <Text style={styles.link}>
              Pas encore de compte ? <Text style={styles.linkBold}>S'inscrire</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, padding: 20 },
  header: { alignItems: 'center', paddingVertical: 40 },
  wordmark:      { flexDirection: 'row', alignItems: 'baseline', marginTop: 14 },
  wordmarkBold:  { fontSize: 30, fontWeight: '800', color: '#1A202C' },
  wordmarkLight: { fontSize: 30, fontWeight: '300', color: Colors.primary },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
  tagline: { fontSize: 12, color: Colors.textMuted, marginTop: 8, letterSpacing: 2, textTransform: 'uppercase' },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 20 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: '#DC2626', fontSize: 14 },
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 14,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  link: { textAlign: 'center', color: Colors.textSecondary },
  linkBold: { color: Colors.primary, fontWeight: 'bold' },
});
