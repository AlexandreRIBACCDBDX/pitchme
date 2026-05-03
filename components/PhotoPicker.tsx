import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';

interface PhotoItem {
  uri: string;
  name: string;
  uploaded?: boolean;
  url?: string;
}

interface Props {
  candidatureId?: string;
  onPhotosChange?: (photos: PhotoItem[]) => void;
  maxPhotos?: number;
}

export default function PhotoPicker({ candidatureId, onPhotosChange, maxPhotos = 6 }: Props) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l\'accès à la galerie.'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: maxPhotos - photos.length,
    });

    if (!result.canceled) {
      const newPhotos = result.assets.map(a => ({
        uri: a.uri,
        name: a.fileName || `photo_${Date.now()}.jpg`,
      }));
      const updated = [...photos, ...newPhotos].slice(0, maxPhotos);
      setPhotos(updated);
      onPhotosChange?.(updated);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l\'accès à la caméra.'); return; }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      const photo = { uri: result.assets[0].uri, name: `photo_${Date.now()}.jpg` };
      const updated = [...photos, photo].slice(0, maxPhotos);
      setPhotos(updated);
      onPhotosChange?.(updated);
    }
  }

  function removePhoto(index: number) {
    const updated = photos.filter((_, i) => i !== index);
    setPhotos(updated);
    onPhotosChange?.(updated);
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {photos.map((photo, i) => (
          <View key={i} style={styles.photoContainer}>
            <Image source={{ uri: photo.uri }} style={styles.photo} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
              <Text style={styles.removeBtnText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}

        {photos.length < maxPhotos && (
          <TouchableOpacity style={styles.addBtn} onPress={pickImage}>
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addText}>Photo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={pickImage}>
          <Text style={styles.actionText}>📁 Galerie</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={takePhoto}>
          <Text style={styles.actionText}>📷 Caméra</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>{photos.length}/{maxPhotos} photos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { marginBottom: 10 },
  photoContainer: { marginRight: 10, position: 'relative' },
  photo: { width: 90, height: 90, borderRadius: 10 },
  removeBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: Colors.error, borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  addBtn: { width: 90, height: 90, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  addIcon: { fontSize: 24, color: Colors.textSecondary },
  addText: { fontSize: 12, color: Colors.textSecondary },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, backgroundColor: Colors.surface, borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  actionText: { color: Colors.textSecondary, fontSize: 14 },
  hint: { color: Colors.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center' },
});
