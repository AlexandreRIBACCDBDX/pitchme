import { Stack } from 'expo-router';

export default function CandidateLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="choisir-candidature" />
      <Stack.Screen name="candidature" />
      <Stack.Screen name="candidature-foodtruck" />
    </Stack>
  );
}
