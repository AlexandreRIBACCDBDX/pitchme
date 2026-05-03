import { View, Text, StyleSheet } from 'react-native';
import { StatusColors, StatusLabels } from '@/constants/theme';

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const color = StatusColors[status] || '#666';
  const label = StatusLabels[status] || status;

  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }, size === 'sm' && styles.sm]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }, size === 'sm' && styles.textSm]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  sm: { paddingHorizontal: 8, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 13, fontWeight: '600' },
  textSm: { fontSize: 11 },
});
