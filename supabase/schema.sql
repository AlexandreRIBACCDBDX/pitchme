-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  first_name text,
  last_name text,
  phone text,
  role text not null default 'candidate',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Candidatures table
create table if not exists public.candidatures (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  -- Personal / Business info
  business_name text not null,
  siret text not null,
  siret_data jsonb,
  address text not null,
  city text not null,
  postal_code text not null,
  -- Products
  product_category text not null,
  product_description text not null,
  website_url text,
  -- Stand info
  stand_size text default '3m',
  electricity_needed boolean default false,
  previous_participant boolean default false,
  -- Status
  status text not null default 'pending',
  admin_notes text,
  rejection_reason text,
  -- Timestamps
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  -- Constraints
  constraint status_check check (status in ('pending', 'reviewing', 'accepted', 'rejected'))
);

-- Documents/Photos table
create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  candidature_id uuid references public.candidatures(id) on delete cascade not null,
  uploaded_by uuid references public.profiles(id) not null,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  doc_category text not null default 'product_photo',
  created_at timestamp with time zone default now()
);

-- Messages table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  candidature_id uuid references public.candidatures(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) not null,
  content text not null,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.candidatures enable row level security;
alter table public.documents enable row level security;
alter table public.messages enable row level security;

-- Profiles: users see their own, admins see all
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Admins can view all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Allow profile creation on signup
create policy "Enable insert for authenticated users" on public.profiles
  for insert with check (auth.uid() = id);

-- Candidatures
create policy "Candidates see own candidatures" on public.candidatures
  for select using (user_id = auth.uid());

create policy "Candidates can create candidatures" on public.candidatures
  for insert with check (user_id = auth.uid());

create policy "Candidates can update own candidatures" on public.candidatures
  for update using (user_id = auth.uid() and status = 'pending');

create policy "Admins can view all candidatures" on public.candidatures
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Documents
create policy "Users see own documents" on public.documents
  for select using (uploaded_by = auth.uid());

create policy "Users can upload documents" on public.documents
  for insert with check (uploaded_by = auth.uid());

create policy "Admins can view all documents" on public.documents
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can upload documents" on public.documents
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Messages
create policy "Users see messages for their candidatures" on public.messages
  for select using (
    sender_id = auth.uid() or
    exists (
      select 1 from public.candidatures c
      where c.id = candidature_id and c.user_id = auth.uid()
    )
  );

create policy "Users can send messages" on public.messages
  for insert with check (sender_id = auth.uid());

create policy "Admins can see all messages" on public.messages
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'role', 'candidate'));
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_candidatures_updated_at
  before update on public.candidatures
  for each row execute procedure update_updated_at_column();

-- Storage buckets (run these in Supabase dashboard)
-- insert into storage.buckets (id, name, public) values ('candidature-documents', 'candidature-documents', false);
-- insert into storage.buckets (id, name, public) values ('product-photos', 'product-photos', true);
