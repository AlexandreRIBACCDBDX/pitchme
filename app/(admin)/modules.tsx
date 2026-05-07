import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';

interface Module {
  key: string;
  label: string;
  description: string;
  emoji: string;
  settingKey: string;
  valueKey: string;
}

const MODULES: Module[] = [
  {
    key: 'foodtruck',
    label: 'Food Truck',
    description: 'Permet aux candidats de déposer une candidature spécifique Food Truck avec menu, logistique véhicule et tarification.',
    emoji: '🚚',
    settingKey: 'foodtruck_module',
    valueKey: 'enabled',
  },
];

export default function AdminModules() {
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await (supabase.from('app_settings') as any)
      .select('key, value')
      .in('key', MODULES.map(m => m.settingKey));

    const map: Record<string, boolean> = {};
    for (const row of data ?? []) {
      const mod = MODULES.find(m => m.settingKey === row.key);
      if (mod) map[mod.key] = row.value?.[mod.valueKey] === true;
    }
    setSettings(map);
    setLoading(false);
  }

  async function toggle(mod: Module, value: boolean) {
    setSaving(mod.key);
    await (supabase.from('app_settings') as any)
      .upsert({ key: mod.settingKey, value: { [mod.valueKey]: value } });
    setSettings(s => ({ ...s, [mod.key]: value }));
    setSaving(null);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Modules</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sub}>Activez ou désactivez les fonctionnalités disponibles pour les candidats.</Text>

        {MODULES.map(mod => (
          <View key={mod.key} style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.emoji}>{mod.emoji}</Text>
              <View style={styles.cardText}>
                <Text style={styles.modLabel}>{mod.label}</Text>
                <Text style={styles.modDesc}>{mod.description}</Text>
              </View>
            </View>
            <Switch
              value={settings[mod.key] ?? false}
              onValueChange={v => toggle(mod, v)}
              disabled={saving === mod.key}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  back: { color: Colors.primary, fontSize: 15 },
  title: { fontSize: 17, fontWeight: 'bold', color: Colors.text },
  scroll: { padding: 20, gap: 14 },
  sub: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  card: { backgroundColor: Colors.card, borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: 12 },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  emoji: { fontSize: 32 },
  cardText: { flex: 1 },
  modLabel: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  modDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
});
