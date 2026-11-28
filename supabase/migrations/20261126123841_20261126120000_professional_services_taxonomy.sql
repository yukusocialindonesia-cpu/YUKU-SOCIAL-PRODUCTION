-- YUKU professional services taxonomy (additive; does not alter legacy activity categories).
-- Apply only after review. This migration is intentionally separate from production data changes.

create table if not exists public.professional_service_categories (
  id text primary key,
  title varchar(100) not null,
  description text not null default '',
  icon_name varchar(50) not null default 'BriefcaseBusiness',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_service_categories_id_format check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table if not exists public.professional_service_subcategories (
  id text primary key,
  category_id text not null references public.professional_service_categories(id) on delete restrict,
  title varchar(120) not null,
  description text not null default '',
  verification_level text not null default 'identity'
    check (verification_level in ('identity', 'credential', 'license', 'reference')),
  delivery_modes text[] not null default array['offline']::text[],
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_service_subcategories_id_format check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint professional_service_subcategories_delivery_modes check (
    cardinality(delivery_modes) > 0
    and delivery_modes <@ array['online','offline']::text[]
  )
);

create index if not exists idx_professional_service_subcategories_category
  on public.professional_service_subcategories(category_id, sort_order)
  where is_active = true;

alter table public.professional_service_categories enable row level security;
alter table public.professional_service_subcategories enable row level security;

drop policy if exists professional_service_categories_public_read on public.professional_service_categories;
create policy professional_service_categories_public_read
  on public.professional_service_categories
  for select to anon, authenticated
  using (is_active = true);

drop policy if exists professional_service_subcategories_public_read on public.professional_service_subcategories;
create policy professional_service_subcategories_public_read
  on public.professional_service_subcategories
  for select to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.professional_service_categories c
      where c.id = category_id and c.is_active = true
    )
  );

insert into public.professional_service_categories (id, title, description, icon_name, sort_order)
values
  ('travel-tourism', 'Travel & Tourism', 'Pemandu wisata dan layanan pendamping perjalanan.', 'MapPinned', 10),
  ('caregiving', 'Caregiving & Childcare', 'Layanan perawatan dan pendampingan dengan pemeriksaan kompetensi sesuai peran.', 'HeartHandshake', 20),
  ('personal-assistance', 'Personal Assistance', 'Asisten pribadi dan bantuan kebutuhan personal.', 'UserRound', 30),
  ('transportation', 'Transportation', 'Driver pribadi dan layanan transportasi dengan persyaratan kendaraan yang sesuai.', 'CarFront', 40),
  ('home-services', 'Home Services', 'Bantuan rumah tangga, kebersihan, dan perawatan rumah.', 'House', 50),
  ('business-consulting', 'Business & Consulting', 'Konsultan dan tenaga profesional untuk kebutuhan bisnis.', 'BriefcaseBusiness', 60),
  ('creative-digital', 'Creative & Digital', 'Layanan kreatif, produksi konten, dan teknologi digital.', 'Palette', 70),
  ('events-hospitality', 'Events & Hospitality', 'Tenaga acara, hospitality, dan kebutuhan event.', 'CalendarDays', 80),
  ('beauty-wellness', 'Beauty & Wellness', 'Perawatan diri, kebugaran, dan layanan wellness non-medis.', 'Sparkles', 90),
  ('pet-services', 'Pet Services', 'Perawatan dan pendampingan hewan peliharaan.', 'PawPrint', 100),
  ('technical-repairs', 'Technical & Repairs', 'Teknisi dan jasa perbaikan rumah maupun perangkat.', 'Wrench', 110),
  ('language-education', 'Language & Education', 'Tutor, mentor, penerjemah, dan pelatih keterampilan.', 'GraduationCap', 120)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon_name = excluded.icon_name,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.professional_service_subcategories
  (id, category_id, title, description, verification_level, delivery_modes, sort_order)
values
  ('tour-guide', 'travel-tourism', 'Tour Guide', 'Pemandu wisata lokal dan destinasi.', 'reference', array['offline']::text[], 10),
  ('travel-companion', 'travel-tourism', 'Travel Companion', 'Pendamping perjalanan non-medis.', 'identity', array['offline']::text[], 20),
  ('interpreter-travel', 'travel-tourism', 'Penerjemah Wisata', 'Bantuan bahasa selama perjalanan.', 'credential', array['online','offline']::text[], 30),
  ('registered-nurse', 'caregiving', 'Perawat', 'Layanan keperawatan hanya oleh tenaga berizin sesuai ketentuan.', 'license', array['offline']::text[], 10),
  ('caregiver-elderly', 'caregiving', 'Caregiver Lansia', 'Pendampingan aktivitas harian lansia.', 'credential', array['offline']::text[], 20),
  ('patient-companion', 'caregiving', 'Pendamping Pasien', 'Pendampingan non-tindakan medis.', 'identity', array['offline']::text[], 30),
  ('babysitter', 'caregiving', 'Babysitter', 'Pengasuhan anak dengan pemeriksaan identitas dan referensi.', 'reference', array['offline']::text[], 40),
  ('personal-assistant', 'personal-assistance', 'Personal Assistant', 'Bantuan administrasi dan kebutuhan personal.', 'reference', array['offline']::text[], 10),
  ('personal-shopper', 'personal-assistance', 'Personal Shopper', 'Bantuan belanja sesuai permintaan.', 'identity', array['offline']::text[], 20),
  ('private-driver', 'transportation', 'Driver Pribadi', 'Pengemudi dengan SIM dan dokumen kendaraan sesuai ketentuan.', 'credential', array['offline']::text[], 10),
  ('chauffeur', 'transportation', 'Chauffeur', 'Layanan pengemudi profesional.', 'credential', array['offline']::text[], 20),
  ('housekeeper', 'home-services', 'ART / Housekeeper', 'Bantuan pekerjaan rumah tangga.', 'reference', array['offline']::text[], 10),
  ('cleaning-service', 'home-services', 'Cleaning Service', 'Layanan kebersihan rumah dan ruang kerja.', 'identity', array['offline']::text[], 20),
  ('garden-maintenance', 'home-services', 'Perawatan Taman', 'Perawatan taman dan tanaman.', 'identity', array['offline']::text[], 30),
  ('business-consultant', 'business-consulting', 'Konsultan Bisnis', 'Konsultasi strategi dan operasional usaha.', 'credential', array['online','offline']::text[], 10),
  ('legal-consultant', 'business-consulting', 'Konsultan Hukum', 'Layanan hukum oleh profesional yang berwenang.', 'license', array['online','offline']::text[], 20),
  ('tax-consultant', 'business-consulting', 'Konsultan Pajak', 'Konsultasi pajak dengan kualifikasi yang relevan.', 'license', array['online','offline']::text[], 30),
  ('graphic-designer', 'creative-digital', 'Desainer Grafis', 'Desain visual dan materi komunikasi.', 'reference', array['online']::text[], 10),
  ('photographer', 'creative-digital', 'Fotografer', 'Fotografi personal, produk, dan acara.', 'reference', array['offline']::text[], 20),
  ('videographer-editor', 'creative-digital', 'Videografer & Editor', 'Produksi dan penyuntingan video.', 'reference', array['online','offline']::text[], 30),
  ('event-mc', 'events-hospitality', 'MC & Host Acara', 'Pembawa acara untuk kebutuhan formal dan informal.', 'reference', array['offline','online']::text[], 10),
  ('event-crew', 'events-hospitality', 'Event Crew & Usher', 'Dukungan operasional acara.', 'identity', array['offline']::text[], 20),
  ('makeup-artist', 'beauty-wellness', 'Makeup Artist', 'Riasan personal dan acara.', 'reference', array['offline']::text[], 10),
  ('personal-trainer', 'beauty-wellness', 'Personal Trainer', 'Pendamping latihan kebugaran non-medis.', 'credential', array['offline','online']::text[], 20),
  ('pet-sitter', 'pet-services', 'Pet Sitter', 'Penitipan dan pendampingan hewan.', 'reference', array['offline']::text[], 10),
  ('dog-walker', 'pet-services', 'Dog Walker', 'Layanan jalan-jalan anjing.', 'identity', array['offline']::text[], 20),
  ('ac-technician', 'technical-repairs', 'Teknisi AC', 'Pemasangan dan perawatan AC.', 'credential', array['offline']::text[], 10),
  ('electronics-technician', 'technical-repairs', 'Teknisi Elektronik', 'Perbaikan perangkat elektronik.', 'credential', array['offline']::text[], 20),
  ('private-tutor', 'language-education', 'Tutor Privat', 'Pendampingan belajar dan pelajaran.', 'credential', array['online','offline']::text[], 10),
  ('language-translator', 'language-education', 'Penerjemah', 'Terjemahan teks dan dokumen.', 'credential', array['online']::text[], 20)
on conflict (id) do update set
  category_id = excluded.category_id,
  title = excluded.title,
  description = excluded.description,
  verification_level = excluded.verification_level,
  delivery_modes = excluded.delivery_modes,
  sort_order = excluded.sort_order,
  updated_at = now();

comment on table public.professional_service_categories is
  'Separate taxonomy for professional and daily services; legacy activity_categories remains unchanged.';
comment on table public.professional_service_subcategories is
  'Professional service types and minimum verification requirements; actual credential review must be enforced by workflow.';
