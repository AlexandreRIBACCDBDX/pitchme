# CandiBourg – Guide de démarrage

Application de gestion des candidatures pour le Marché de Noël de Bourg-sur-Gironde.

---

## 1. Prérequis

- Node.js 18+
- Expo CLI : `npm install -g expo-cli`
- Un projet Supabase (gratuit sur [supabase.com](https://supabase.com))

---

## 2. Installation

```bash
cd CandiBourg
npm install
```

---

## 3. Configuration Supabase

### 3.1 Créer le projet Supabase

1. Aller sur [supabase.com](https://supabase.com) → New project
2. Copier l'URL et la clé anon depuis **Settings → API**

### 3.2 Variables d'environnement

Copier `.env.example` en `.env` :

```bash
cp .env.example .env
```

Remplir avec vos valeurs :
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### 3.3 Exécuter le schéma SQL

Dans le dashboard Supabase → **SQL Editor** → coller et exécuter le contenu de `supabase/schema.sql`.

### 3.4 Créer les buckets de stockage

Dans Supabase → **Storage** → créer deux buckets :

| Nom | Accès public |
|-----|-------------|
| `product-photos` | ✅ Oui |
| `candidature-documents` | ❌ Non |

Puis ajouter ces policies SQL dans **SQL Editor** :

```sql
-- product-photos : lecture publique
create policy "Public read product-photos"
  on storage.objects for select
  using (bucket_id = 'product-photos');

-- product-photos : upload authentifié
create policy "Authenticated upload product-photos"
  on storage.objects for insert
  with check (bucket_id = 'product-photos' and auth.role() = 'authenticated');

-- candidature-documents : accès restreint
create policy "Owner read candidature-documents"
  on storage.objects for select
  using (bucket_id = 'candidature-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owner upload candidature-documents"
  on storage.objects for insert
  with check (bucket_id = 'candidature-documents' and auth.uid()::text = (storage.foldername(name))[1]);
```

### 3.5 Créer le compte admin

Dans Supabase → **Authentication → Users** → Add user :
- Email : votre email admin
- Password : mot de passe sécurisé

Puis dans **SQL Editor** :
```sql
update public.profiles
set role = 'admin'
where email = 'votre-email@admin.com';
```

---

## 4. Lancer l'application

```bash
npx expo start
```

- Appuyer sur `a` pour Android, `i` pour iOS, `w` pour le web

---

## 5. QR Code

Une fois l'app déployée sur le web (ex: `https://candibourg.app`), mettre à jour l'URL dans [app/(admin)/qrcode.tsx](app/(admin)/qrcode.tsx) ligne 8 :

```tsx
const FORM_URL = 'https://votre-domaine.com/register';
```

L'admin peut générer et partager le QR code depuis **Dashboard Admin → bouton QR**.

---

## 6. Déploiement web (optionnel)

```bash
npx expo export --platform web
# Déployer le dossier dist/ sur Vercel, Netlify, etc.
```

---

## 7. Architecture

```
app/
  (auth)/        → Login, Inscription, Vérification email
  (candidate)/   → Dashboard candidat, Formulaire, Messages
  (admin)/       → Dashboard admin, Détail candidature, QR code
components/
  SiretInput     → Saisie + vérification SIRET (API gouvernementale)
  PhotoPicker    → Sélection photos (galerie + caméra)
  StatusBadge    → Badge coloré selon statut
  MessageThread  → Chat temps réel Supabase
lib/
  supabase.ts    → Client Supabase
  siret.ts       → Vérification SIRET via api.gouv.fr
```

## 8. Statuts des candidatures

| Statut | Couleur | Description |
|--------|---------|-------------|
| `pending` | 🟠 Orange | Candidature reçue, non traitée |
| `reviewing` | 🔵 Bleu | En cours d'étude |
| `accepted` | 🟢 Vert | Candidature retenue |
| `rejected` | 🔴 Rouge | Candidature refusée |
