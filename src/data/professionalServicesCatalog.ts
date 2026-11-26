export interface ServiceCatalogSubcategory {
  id: string;
  title: string;
  description: string;
  verification_level: string;
  delivery_modes: string[];
}
export interface ServiceCatalogCategory {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  professional_service_subcategories: ServiceCatalogSubcategory[];
}

// Static catalog keeps discovery usable before the professional-services database is deployed.
export const PROFESSIONAL_SERVICES_CATALOG: ServiceCatalogCategory[] = [
  { id: 'travel-tourism', title: 'Travel & Tourism', description: 'Pemandu wisata dan layanan pendamping perjalanan.', icon_name: 'MapPinned', professional_service_subcategories: [
    { id: 'tour-guide', title: 'Tour Guide', description: 'Pemandu wisata lokal dan destinasi.', verification_level: 'reference', delivery_modes: ['offline'] },
    { id: 'travel-companion', title: 'Travel Companion', description: 'Pendamping perjalanan non-medis.', verification_level: 'identity', delivery_modes: ['offline'] },
    { id: 'interpreter-travel', title: 'Penerjemah Wisata', description: 'Bantuan bahasa selama perjalanan.', verification_level: 'credential', delivery_modes: ['online', 'offline'] },
  ]},
  { id: 'caregiving', title: 'Caregiving & Childcare', description: 'Layanan perawatan dan pendampingan sesuai kompetensi.', icon_name: 'HeartHandshake', professional_service_subcategories: [
    { id: 'registered-nurse', title: 'Perawat', description: 'Layanan keperawatan hanya oleh tenaga berizin.', verification_level: 'license', delivery_modes: ['offline'] },
    { id: 'caregiver-elderly', title: 'Caregiver Lansia', description: 'Pendampingan aktivitas harian lansia.', verification_level: 'credential', delivery_modes: ['offline'] },
    { id: 'patient-companion', title: 'Pendamping Pasien', description: 'Pendampingan non-tindakan medis.', verification_level: 'identity', delivery_modes: ['offline'] },
    { id: 'babysitter', title: 'Babysitter', description: 'Pengasuhan anak dengan pemeriksaan identitas dan referensi.', verification_level: 'reference', delivery_modes: ['offline'] },
  ]},
  { id: 'personal-assistance', title: 'Personal Assistance', description: 'Asisten pribadi dan bantuan kebutuhan personal.', icon_name: 'UserRound', professional_service_subcategories: [
    { id: 'personal-assistant', title: 'Personal Assistant', description: 'Bantuan administrasi dan kebutuhan personal.', verification_level: 'reference', delivery_modes: ['offline'] },
    { id: 'personal-shopper', title: 'Personal Shopper', description: 'Bantuan belanja sesuai permintaan.', verification_level: 'identity', delivery_modes: ['offline'] },
  ]},
  { id: 'transportation', title: 'Transportation', description: 'Driver pribadi dan layanan transportasi.', icon_name: 'CarFront', professional_service_subcategories: [
    { id: 'private-driver', title: 'Driver Pribadi', description: 'Pengemudi dengan SIM dan dokumen kendaraan sesuai ketentuan.', verification_level: 'credential', delivery_modes: ['offline'] },
    { id: 'chauffeur', title: 'Chauffeur', description: 'Layanan pengemudi profesional.', verification_level: 'credential', delivery_modes: ['offline'] },
  ]},
  { id: 'home-services', title: 'Home Services', description: 'Bantuan rumah tangga, kebersihan, dan perawatan rumah.', icon_name: 'House', professional_service_subcategories: [
    { id: 'housekeeper', title: 'ART / Housekeeper', description: 'Bantuan pekerjaan rumah tangga.', verification_level: 'reference', delivery_modes: ['offline'] },
    { id: 'cleaning-service', title: 'Cleaning Service', description: 'Layanan kebersihan rumah dan ruang kerja.', verification_level: 'identity', delivery_modes: ['offline'] },
    { id: 'garden-maintenance', title: 'Perawatan Taman', description: 'Perawatan taman dan tanaman.', verification_level: 'identity', delivery_modes: ['offline'] },
  ]},
  { id: 'business-consulting', title: 'Business & Consulting', description: 'Konsultan dan tenaga profesional untuk kebutuhan bisnis.', icon_name: 'BriefcaseBusiness', professional_service_subcategories: [
    { id: 'business-consultant', title: 'Konsultan Bisnis', description: 'Konsultasi strategi dan operasional usaha.', verification_level: 'credential', delivery_modes: ['online', 'offline'] },
    { id: 'legal-consultant', title: 'Konsultan Hukum', description: 'Layanan hukum oleh profesional berwenang.', verification_level: 'license', delivery_modes: ['online', 'offline'] },
    { id: 'tax-consultant', title: 'Konsultan Pajak', description: 'Konsultasi pajak dengan kualifikasi relevan.', verification_level: 'license', delivery_modes: ['online', 'offline'] },
  ]},
  { id: 'creative-digital', title: 'Creative & Digital', description: 'Layanan kreatif, produksi konten, dan teknologi digital.', icon_name: 'Palette', professional_service_subcategories: [
    { id: 'graphic-designer', title: 'Desainer Grafis', description: 'Desain visual dan materi komunikasi.', verification_level: 'reference', delivery_modes: ['online'] },
    { id: 'photographer', title: 'Fotografer', description: 'Fotografi personal, produk, dan acara.', verification_level: 'reference', delivery_modes: ['offline'] },
    { id: 'videographer-editor', title: 'Videografer & Editor', description: 'Produksi dan penyuntingan video.', verification_level: 'reference', delivery_modes: ['online', 'offline'] },
  ]},
  { id: 'events-hospitality', title: 'Events & Hospitality', description: 'Tenaga acara, hospitality, dan kebutuhan event.', icon_name: 'CalendarDays', professional_service_subcategories: [
    { id: 'event-mc', title: 'MC & Host Acara', description: 'Pembawa acara formal dan informal.', verification_level: 'reference', delivery_modes: ['offline', 'online'] },
    { id: 'event-crew', title: 'Event Crew & Usher', description: 'Dukungan operasional acara.', verification_level: 'identity', delivery_modes: ['offline'] },
  ]},
  { id: 'beauty-wellness', title: 'Beauty & Wellness', description: 'Perawatan diri, kebugaran, dan layanan wellness non-medis.', icon_name: 'Sparkles', professional_service_subcategories: [
    { id: 'makeup-artist', title: 'Makeup Artist', description: 'Riasan personal dan acara.', verification_level: 'reference', delivery_modes: ['offline'] },
    { id: 'personal-trainer', title: 'Personal Trainer', description: 'Pendamping latihan kebugaran non-medis.', verification_level: 'credential', delivery_modes: ['offline', 'online'] },
  ]},
  { id: 'pet-services', title: 'Pet Services', description: 'Perawatan dan pendampingan hewan peliharaan.', icon_name: 'PawPrint', professional_service_subcategories: [
    { id: 'pet-sitter', title: 'Pet Sitter', description: 'Penitipan dan pendampingan hewan.', verification_level: 'reference', delivery_modes: ['offline'] },
    { id: 'dog-walker', title: 'Dog Walker', description: 'Layanan jalan-jalan anjing.', verification_level: 'identity', delivery_modes: ['offline'] },
  ]},
  { id: 'technical-repairs', title: 'Technical & Repairs', description: 'Teknisi dan jasa perbaikan rumah maupun perangkat.', icon_name: 'Wrench', professional_service_subcategories: [
    { id: 'ac-technician', title: 'Teknisi AC', description: 'Pemasangan dan perawatan AC.', verification_level: 'credential', delivery_modes: ['offline'] },
    { id: 'electronics-technician', title: 'Teknisi Elektronik', description: 'Perbaikan perangkat elektronik.', verification_level: 'credential', delivery_modes: ['offline'] },
  ]},
  { id: 'language-education', title: 'Language & Education', description: 'Tutor, mentor, penerjemah, dan pelatih keterampilan.', icon_name: 'GraduationCap', professional_service_subcategories: [
    { id: 'private-tutor', title: 'Tutor Privat', description: 'Pendampingan belajar dan pelajaran.', verification_level: 'credential', delivery_modes: ['online', 'offline'] },
    { id: 'language-translator', title: 'Penerjemah', description: 'Terjemahan teks dan dokumen.', verification_level: 'credential', delivery_modes: ['online'] },
  ]},
];
