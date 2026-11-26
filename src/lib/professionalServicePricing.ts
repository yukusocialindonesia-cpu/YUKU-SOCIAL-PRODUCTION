export type ProfessionalPricingUnit = 'per_hour' | 'per_session' | 'per_day' | 'per_project';

export const professionalPricingUnits: { value: ProfessionalPricingUnit; label: string; shortLabel: string; guidance: string }[] = [
  { value: 'per_hour', label: 'Per jam', shortLabel: '/ jam', guidance: 'Tarif untuk setiap 1 jam layanan. Durasi dan jam mulai harus disepakati sebelum pemesanan.' },
  { value: 'per_session', label: 'Per sesi', shortLabel: '/ sesi', guidance: 'Tarif untuk satu sesi. Cantumkan durasi sesi (misalnya 60 atau 90 menit) dan apa saja yang termasuk di deskripsi.' },
  { value: 'per_day', label: 'Per hari', shortLabel: '/ hari', guidance: 'Tarif untuk satu hari layanan. Jelaskan jam kerja, waktu istirahat, dan apakah biaya transportasi atau kebutuhan lain termasuk.' },
  { value: 'per_project', label: 'Per proyek', shortLabel: '/ proyek', guidance: 'Tarif tetap untuk satu proyek dengan ruang lingkup tertentu. Rincikan hasil kerja, jumlah revisi, tenggat, dan kriteria selesai di deskripsi.' },
];

export const getProfessionalPricingUnit = (value: string) =>
  professionalPricingUnits.find((unit) => unit.value === value);

export const formatProfessionalRate = (amount: number, unit: string) => {
  const suffix = getProfessionalPricingUnit(unit)?.shortLabel;
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
  return suffix ? `${formatted} ${suffix}` : formatted;
};
