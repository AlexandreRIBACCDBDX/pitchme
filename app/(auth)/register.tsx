import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import AppLogo from '@/components/AppLogo';

export default function Register() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  }

  async function handleRegister() {
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Prénom et nom requis.');
      return;
    }
    if (!form.email.trim()) {
      setError('Email requis.');
      return;
    }
    if (!form.password) {
      setError('Mot de passe requis.');
      return;
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            phone: form.phone.trim(),
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Un compte existe déjà avec cet email.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      router.replace('/(auth)/verify-email');
    } catch (e: any) {
      setError(e?.message ?? 'Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={loading}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <AppLogo size={60} />
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Pour déposer votre candidature</Text>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Prénom *</Text>
              <TextInput style={styles.input} value={form.firstName} onChangeText={v => update('firstName', v)} placeholder="Jean" placeholderTextColor={Colors.textMuted} editable={!loading} />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Nom *</Text>
              <TextInput style={styles.input} value={form.lastName} onChangeText={v => update('lastName', v)} placeholder="Dupont" placeholderTextColor={Colors.textMuted} editable={!loading} />
            </View>
          </View>

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            value={form.email}
            onChangeText={v => update('email', v)}
            placeholder="jean.dupont@email.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={styles.label}>Téléphone</Text>
          <TextInput
            style={styles.input}
            value={form.phone}
            onChangeText={v => update('phone', v)}
            placeholder="06 12 34 56 78"
            placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad"
            editable={!loading}
          />

          <Text style={styles.label}>Mot de passe * (min. 8 caractères)</Text>
          <TextInput
            style={styles.input}
            value={form.password}
            onChangeText={v => update('password', v)}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            editable={!loading}
          />

          <Text style={styles.label}>Confirmer le mot de passe *</Text>
          <TextInput
            style={styles.input}
            value={form.confirmPassword}
            onChangeText={v => update('confirmPassword', v)}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.buttonText}>Créer mon compte</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/login')} disabled={loading}>
            <Text style={styles.link}>
              Déjà un compte ? <Text style={styles.linkBold}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  backBtn: { marginBottom: 10 },
  backText: { color: Colors.textSecondary, fontSize: 16 },
  header: { alignItems: 'center', paddingVertical: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.primary, marginTop: 12 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: '#DC2626', fontSize: 14 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
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
