export const Colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#3B82F6',
  secondary: '#10B981',
  secondaryLight: '#34D399',
  gold: '#F59E0B',
  goldDark: '#D97706',
  background: '#FFFFFF',
  surface: '#F8FAFC',
  surfaceAlt: '#F1F5F9',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#1A202C',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

export const StatusColors: Record<string, string> = {
  pending: Colors.warning,
  reviewing: Colors.info,
  accepted: Colors.success,
  rejected: Colors.error,
};

export const StatusLabels: Record<string, string> = {
  pending: 'En attente',
  reviewing: 'En étude',
  accepted: 'Retenu',
  rejected: 'Refusé',
};

export const ProductCategories = [
  'Artisanat / Déco',
  'Alimentation / Épicerie fine',
  'Bijoux / Accessoires',
  'Jouets / Enfants',
  'Textile / Vêtements',
  'Cosmétiques / Bien-être',
  'Livres / Art',
  'Plants / Fleurs',
  'Boissons',
  'Autre',
];
