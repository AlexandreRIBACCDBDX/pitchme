import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="candidature/[id]" />
      <Stack.Screen name="qrcode" />
      <Stack.Screen name="modules" />
    </Stack>
  );
}
