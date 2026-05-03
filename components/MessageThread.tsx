import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Message } from '@/types/database';
import { Colors } from '@/constants/theme';

interface Props {
  candidatureId: string;
}

export default function MessageThread({ candidatureId }: Props) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`messages:${candidatureId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `candidature_id=eq.${candidatureId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [candidatureId]);

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('candidature_id', candidatureId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  async function sendMessage() {
    if (!text.trim() || !user) return;
    setSending(true);
    await supabase.from('messages').insert({
      candidature_id: candidatureId,
      sender_id: user.id,
      content: text.trim(),
    });
    setText('');
    setSending(false);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }

  function isOwnMessage(msg: Message) {
    return msg.sender_id === user?.id;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const own = isOwnMessage(item);
          return (
            <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
              {!own && <Text style={styles.senderLabel}>{profile?.role === 'admin' ? 'Candidat' : 'Organisateur'}</Text>}
              <Text style={[styles.bubbleText, own ? styles.textOwn : styles.textOther]}>{item.content}</Text>
              <Text style={styles.time}>{new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Aucun message. Démarrez la conversation.</Text>}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Votre message..."
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!text.trim() || sending}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 10 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12 },
  bubbleOwn: { backgroundColor: Colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Colors.card, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  senderLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  textOwn: { color: '#fff' },
  textOther: { color: Colors.text },
  time: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4, alignSelf: 'flex-end' },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
  inputRow: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  input: { flex: 1, backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: Colors.text, maxHeight: 100 },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: 24, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: '#fff', fontSize: 16 },
});
