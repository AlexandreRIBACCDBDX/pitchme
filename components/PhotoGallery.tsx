import { useState } from 'react';
import {
  View, Image, TouchableOpacity, StyleSheet,
  Modal, Text, Dimensions, Pressable, Platform,
} from 'react-native';
import { Colors } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  urls: string[];
  thumbSize?: number;
  emptyText?: string;
}

export default function PhotoGallery({ urls, thumbSize = 90, emptyText = 'Aucune photo' }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  if (urls.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  return (
    <>
      <View style={styles.grid}>
        {urls.map((url, i) => (
          <TouchableOpacity key={i} onPress={() => setSelected(i)} activeOpacity={0.8}>
            <Image
              source={{ uri: url }}
              style={[styles.thumb, { width: thumbSize, height: thumbSize }]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          {/* Fermer */}
          <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>

          {/* Compteur */}
          {urls.length > 1 && selected !== null && (
            <Text style={styles.counter}>{selected + 1} / {urls.length}</Text>
          )}

          {/* Image plein écran */}
          {selected !== null && (
            <Image
              source={{ uri: urls[selected] }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}

          {/* Navigation précédent / suivant */}
          {urls.length > 1 && selected !== null && (
            <>
              <TouchableOpacity
                style={[styles.navBtn, styles.navLeft, selected === 0 && styles.navDisabled]}
                onPress={() => setSelected(s => Math.max(0, (s ?? 0) - 1))}
                disabled={selected === 0}
              >
                <Text style={styles.navText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navBtn, styles.navRight, selected === urls.length - 1 && styles.navDisabled]}
                onPress={() => setSelected(s => Math.min(urls.length - 1, (s ?? 0) + 1))}
                disabled={selected === urls.length - 1}
              >
                <Text style={styles.navText}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb:      { borderRadius: 10, backgroundColor: Colors.border },
  empty:      { color: Colors.textMuted, fontSize: 14 },

  // Modal
  overlay:    {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage:  {
    width: Platform.OS === 'web' ? Math.min(W * 0.85, 900) : W,
    height: Platform.OS === 'web' ? Math.min(H * 0.80, 700) : H * 0.75,
  },
  closeBtn:   {
    position: 'absolute', top: 48, right: 20, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  counter:    {
    position: 'absolute', top: 54, alignSelf: 'center',
    color: 'rgba(255,255,255,0.7)', fontSize: 13,
  },
  navBtn:     {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 28, width: 48, height: 48,
    justifyContent: 'center', alignItems: 'center',
  },
  navLeft:    { left: 16 },
  navRight:   { right: 16 },
  navDisabled: { opacity: 0.2 },
  navText:    { color: '#fff', fontSize: 32, fontWeight: '300', lineHeight: 36 },
});
