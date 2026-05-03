import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import MessageThread from '@/components/MessageThread';

export default function CandidateMessages() {
  const [candidatureId, setCandidatureId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('candidatures').select('id').single().then(({ data }) => {
      setCandidatureId(data?.id || null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <View style={{ width: 60 }} />
      </View>

      {candidatureId ? (
        <MessageThread candidatureId={candidatureId} />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Déposez d'abord une candidature pour accéder aux messages.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { color: Colors.textSecondary, fontSize: 16, width: 60 },
  title: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },
  emptyText: { color: Colors.textSecondary, textAlign: 'center' },
});
