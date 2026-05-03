import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { verifySiret, formatSiret, SiretData } from '@/lib/siret';
import { Colors } from '@/constants/theme';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onVerified: (data: SiretData) => void;
}

export default function SiretInput({ value, onChange, onVerified }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState<SiretData | null>(null);

  async function handleVerify() {
    setError('');
    setVerified(null);
    setLoading(true);
    try {
      const data = await verifySiret(value);
      if (data) {
        setVerified(data);
        onVerified(data);
        if (!data.valid) {
          setError('⚠️ Établissement fermé (état administratif F)');
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(text: string) {
    const formatted = formatSiret(text);
    onChange(formatted);
    setVerified(null);
    setError('');
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, verified && styles.inputVerified, !!error && styles.inputError]}
          value={value}
          onChangeText={handleChange}
          placeholder="XXX XXX XXX XXXXX"
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={18}
        />
        <TouchableOpacity
          style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={loading || value.replace(/\s/g, '').length !== 14}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.verifyText}>{verified ? '✓' : 'Vérifier'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {verified && (
        <View style={styles.result}>
          <Text style={styles.resultName}>{verified.denomination}</Text>
          <Text style={styles.resultDetail}>SIREN : {verified.siren}</Text>
          {verified.adresse ? <Text style={styles.resultDetail}>{verified.adresse}, {verified.code_postal} {verified.ville}</Text> : null}
          <Text style={[styles.resultStatus, verified.valid ? styles.statusOk : styles.statusKo]}>
            {verified.valid ? '✓ Établissement actif' : '⚠ Établissement fermé'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, color: Colors.text, fontSize: 16 },
  inputVerified: { borderColor: Colors.success },
  inputError: { borderColor: Colors.error },
  verifyBtn: { backgroundColor: Colors.secondary, borderRadius: 10, padding: 14, minWidth: 80, alignItems: 'center' },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  error: { color: Colors.error, fontSize: 13, marginTop: 6 },
  result: { backgroundColor: Colors.secondary + '22', borderRadius: 10, padding: 14, marginTop: 10, borderWidth: 1, borderColor: Colors.secondary },
  resultName: { color: Colors.text, fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  resultDetail: { color: Colors.textSecondary, fontSize: 13, marginBottom: 2 },
  resultStatus: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  statusOk: { color: Colors.success },
  statusKo: { color: Colors.warning },
});
