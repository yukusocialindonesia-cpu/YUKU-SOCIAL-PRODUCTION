-- Finalize YUKU's two service lines:
-- Social Experience = paid companionship and shared activities.
-- Professional Services = expertise, credentials, or defined work output.
-- Keep historical Travel Companion rows intact; hide the legacy professional taxonomy entry.
-- Apply through the reviewed migration workflow, never as an ad-hoc production query.

update public.professional_service_subcategories
set is_active = false,
    updated_at = now()
where id = 'travel-companion';

update public.professional_service_categories
set description = 'Pemandu wisata profesional dan layanan penerjemah untuk kebutuhan perjalanan.',
    updated_at = now()
where id = 'travel-tourism';

update public.activity_categories
set title = 'Jalan-Jalan & Travel Companion',
    description = 'Teman berbayar untuk menemani city walk, eksplorasi kota, wisata santai, dan perjalanan bersama. Bukan layanan pemandu wisata profesional.',
    examples = array[
      'Travel Companion',
      'City walk dan eksplorasi kota',
      'Menemani liburan atau perjalanan',
      'Jalan-jalan dan mengunjungi tempat menarik'
    ]::text[]
where id = 'jalan-belanja';

update public.activity_categories
set title = 'Olahraga & Hobi',
    description = 'Teman untuk melakukan hobi dan aktivitas bersama secara santai, bukan pelatih atau instruktur profesional.',
    examples = array[
      'Badminton dan jogging santai',
      'Bersepeda dan aktivitas luar ruang',
      'Board games dan workshop hobi',
      'Belajar atau berlatih hobi bersama'
    ]::text[]
where id = 'aktivitas-sosial';

update public.activity_categories
set description = 'Teman untuk menghadiri kondangan, wisuda, gathering, konser, seminar, dan acara sosial lainnya.'
where id = 'hadir-acara';

update public.activity_categories
set description = 'Teman untuk kulineran, ngopi, brunch, dan makan bersama.'
where id = 'ngopi-makan';

update public.activity_categories
set description = 'Teman untuk menonton bioskop, konser, pertunjukan, dan hiburan bersama.'
where id = 'nonton-film';

update public.activity_categories
set description = 'Teman mengobrol melalui chat atau voice call dan aktivitas sosial online.'
where id = 'ngobrol-online';
