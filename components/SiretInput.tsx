import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { verifySiret, formatSiret, SiretData } from '@/lib/siret';
import { Colors } from '@/constants/theme';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onVerified: (data: SiretData | null) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export default function SiretInput({ value, onChange, onVerified, onLoadingChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [verified, setVerified] = useState<SiretData | null>(null);

  async function runVerification(digits: string) {
    setError('');
    setVerified(null);
    onVerified(null);
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const data = await verifySiret(digits);
      if (data) {
        setVerified(data);
        onVerified(data);
        if (!data.valid) setError('⚠️ Établissement fermé (état administratif F)');
      }
    } catch (e: any) {
      setError(e.message ?? 'Erreur de vérification');
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }

  function handleChange(text: string) {
    const digits    = text.replace(/\D/g, '');
    const formatted = formatSiret(text);
    onChange(formatted);
    setVerified(null);
    setError('');
    onVerified(null);
    // Auto-trigger as soon as the 14th digit is typed
    if (digits.length === 14) {
      runVerification(digits);
    }
  }

  function handleRetry() {
    const digits = value.replace(/\s/g, '');
    if (digits.length === 14) runVerification(digits);
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={[
            styles.input,
            verified && styles.inputVerified,
            !!error && styles.inputError,
            loading && styles.inputLoading,
          ]}
          value={value}
          onChangeText={handleChange}
          placeholder="XXX XXX XXX XXXXX"
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={18}
          editable={!loading}
        />

        {/* Status indicator */}
        {loading ? (
          <View style={styles.statusBox}>
            <ActivityIndicator color={Colors.primary} size="small" />
          </View>
        ) : verified ? (
          <View style={[styles.statusBox, styles.statusBoxOk]}>
            <Text style={styles.statusIconOk}>✓</Text>
          </View>
        ) : error ? (
          <TouchableOpacity style={[styles.statusBox, styles.statusBoxError]} onPress={handleRetry}>
            <Text style={styles.statusIconError}>↺</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.statusBox, styles.statusBoxIdle]}>
            <Text style={styles.statusIconIdle}>{value.replace(/\s/g, '').length}/14</Text>
          </View>
        )}
      </View>

      {loading && <Text style={styles.loadingText}>Vérification en cours…</Text>}
      {error    && <Text style={styles.errorText}>{error}</Text>}

      {verified && (
        <View style={styles.result}>
          <Text style={styles.resultName}>{verified.denomination}</Text>
          <Text style={styles.resultDetail}>SIREN : {verified.siren}</Text>
          {verified.adresse
            ? <Text style={styles.resultDetail}>{verified.adresse}, {verified.code_postal} {verified.ville}</Text>
            : null}
          <Text style={[styles.resultStatus, verified.valid ? styles.statusOk : styles.statusKo]}>
            {verified.valid ? '✓ Établissement actif' : '⚠ Établissement fermé'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row:             { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input:           { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, color: Colors.text, fontSize: 16 },
  inputVerified:   { borderColor: Colors.success },
  inputError:      { borderColor: Colors.error },
  inputLoading:    { opacity: 0.6 },
  statusBox:       { width: 52, height: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  statusBoxIdle:   { backgroundColor: Colors.surface, borderColor: Colors.border },
  statusBoxOk:     { backgroundColor: Colors.success + '22', borderColor: Colors.success },
  statusBoxError:  { backgroundColor: Colors.error + '22', borderColor: Colors.error },
  statusIconOk:    { color: Colors.success, fontSize: 22, fontWeight: 'bold' },
  statusIconError: { color: Colors.error, fontSize: 22, fontWeight: 'bold' },
  statusIconIdle:  { color: Colors.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  loadingText:     { color: Colors.textMuted, fontSize: 12, marginTop: 6 },
  errorText:       { color: Colors.error, fontSize: 13, marginTop: 6 },
  result:          { backgroundColor: Colors.secondary + '22', borderRadius: 10, padding: 14, marginTop: 10, borderWidth: 1, borderColor: Colors.secondary },
  resultName:      { color: Colors.text, fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  resultDetail:    { color: Colors.textSecondary, fontSize: 13, marginBottom: 2 },
  resultStatus:    { fontSize: 13, fontWeight: '600', marginTop: 6 },
  statusOk:        { color: Colors.success },
  statusKo:        { color: Colors.warning },
});
