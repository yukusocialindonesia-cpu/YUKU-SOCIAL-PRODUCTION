export interface ProfessionalVerificationGuide {
  applicant: string;
  reviewer: string[];
}

const guides: Record<string, ProfessionalVerificationGuide> = {
  'tour-guide': {
    applicant: 'Siapkan identitas, pengalaman memandu, referensi klien/agen, dan bukti pelatihan atau registrasi pemandu bila diwajibkan di wilayah/jenis destinasi tersebut.',
    reviewer: ['Cocokkan identitas pemohon dengan referensi kerja atau agen yang dapat dihubungi.', 'Periksa pengalaman, bahasa, pengetahuan destinasi, dan portofolio/rencana tur.', 'Periksa kartu/registrasi/izin pemandu jika diwajibkan oleh otoritas setempat atau jenis destinasi.'],
  },
  'travel-companion': {
    applicant: 'Siapkan identitas dan referensi pengalaman pendampingan perjalanan. Layanan ini bukan layanan medis atau pengamanan.',
    reviewer: ['Cocokkan identitas dan referensi.', 'Pastikan deskripsi layanan tidak menjanjikan tindakan medis, pengawalan keamanan, atau kewenangan lain yang tidak dimiliki.'],
  },
  'interpreter-travel': {
    applicant: 'Siapkan identitas, contoh/portofolio interpretasi, bahasa yang dikuasai, dan referensi klien.',
    reviewer: ['Uji atau periksa portofolio bahasa dan pengalaman interpretasi.', 'Periksa referensi klien/agensi dan jelaskan batas layanan interpretasi.'],
  },
  'registered-nurse': {
    applicant: 'Wajib melampirkan STR dan/atau SIP atau dokumen izin praktik lain yang berlaku sesuai ketentuan dan jenis layanan. Jangan unggah data pasien.',
    reviewer: ['Verifikasi STR/SIP melalui kanal resmi yang relevan; cocokkan nama, nomor, status aktif, masa berlaku, dan ruang lingkup praktik.', 'Pastikan layanan dan lokasi praktik sesuai kewenangan serta ketentuan yang berlaku.', 'Jangan menyetujui hanya berdasarkan foto dokumen tanpa pemeriksaan keabsahan.'],
  },
  'caregiver-elderly': {
    applicant: 'Siapkan sertifikat pelatihan caregiver/pertolongan pertama bila ada, pengalaman, dan referensi keluarga/penyedia sebelumnya.',
    reviewer: ['Periksa pelatihan/sertifikat jika diklaim, pengalaman, dan referensi.', 'Pastikan tugas dibatasi pada pendampingan non-medis kecuali kompetensi dan izin yang sesuai telah diverifikasi.'],
  },
  'patient-companion': {
    applicant: 'Siapkan identitas dan referensi pendampingan. Peran ini hanya pendamping non-medis.',
    reviewer: ['Cocokkan identitas dan referensi.', 'Pastikan profil tidak menawarkan diagnosis, pemberian tindakan medis, atau penggantian tenaga kesehatan.'],
  },
  babysitter: {
    applicant: 'Siapkan identitas, minimal dua referensi yang dapat dihubungi bila tersedia, pengalaman pengasuhan, dan pelatihan P3K anak bila ada.',
    reviewer: ['Verifikasi identitas dan hubungi referensi dengan persetujuan yang sesuai.', 'Tinjau pengalaman, pelatihan keselamatan anak, dan batas usia/jenis pengasuhan yang ditawarkan.'],
  },
  'personal-assistant': {
    applicant: 'Siapkan identitas, pengalaman kerja, dan referensi atasan/klien sebelumnya.',
    reviewer: ['Cocokkan identitas dan referensi kerja.', 'Pastikan layanan tidak meminta kata sandi, OTP, atau akses finansial yang tidak semestinya.'],
  },
  'personal-shopper': {
    applicant: 'Siapkan identitas dan portofolio/referensi layanan belanja bila ada.',
    reviewer: ['Cocokkan identitas dan referensi/portofolio.', 'Pastikan proses pembayaran, bukti belanja, dan pengelolaan uang klien dijelaskan transparan.'],
  },
  'private-driver': {
    applicant: 'Wajib melampirkan SIM yang sesuai dan masih berlaku. Siapkan dokumen kendaraan bila menggunakan kendaraan sendiri.',
    reviewer: ['Cocokkan nama dan masa berlaku SIM serta golongan yang sesuai dengan kendaraan/layanan.', 'Jika kendaraan disediakan penyedia, periksa STNK dan bukti kelayakan/asuransi yang relevan.', 'Pastikan cakupan layanan dan area operasi dijelaskan.'],
  },
  chauffeur: {
    applicant: 'Wajib melampirkan SIM yang sesuai dan masih berlaku, serta pengalaman mengemudi profesional. Siapkan dokumen kendaraan bila relevan.',
    reviewer: ['Periksa SIM, masa berlaku, dan kesesuaian golongan.', 'Periksa referensi/riwayat pengalaman profesional dan dokumen kendaraan bila disediakan penyedia.', 'Jangan menampilkan klaim keamanan atau lisensi transportasi yang belum diverifikasi.'],
  },
  housekeeper: {
    applicant: 'Siapkan identitas, referensi kerja rumah tangga, dan pengalaman. Jangan mengirim dokumen pribadi milik pemberi kerja.',
    reviewer: ['Cocokkan identitas dan hubungi referensi dengan persetujuan.', 'Periksa pengalaman, area layanan, dan batas tanggung jawab pekerjaan.'],
  },
  'cleaning-service': {
    applicant: 'Siapkan identitas dan referensi/portofolio pekerjaan kebersihan bila ada.',
    reviewer: ['Cocokkan identitas dan referensi/portofolio.', 'Tinjau prosedur keselamatan bahan pembersih dan batas pekerjaan.'],
  },
  'garden-maintenance': {
    applicant: 'Siapkan identitas dan foto portofolio pekerjaan taman bila ada.',
    reviewer: ['Cocokkan identitas dan portofolio/referensi.', 'Periksa kemampuan penggunaan alat dan praktik keselamatan kerja.'],
  },
  'business-consultant': {
    applicant: 'Siapkan identitas, portofolio proyek, pengalaman, dan referensi klien. Cantumkan sertifikasi hanya jika benar-benar dimiliki.',
    reviewer: ['Periksa portofolio dan hubungi referensi klien bila memungkinkan.', 'Cocokkan klaim sertifikasi/keanggotaan dengan penerbit jika digunakan.', 'Pastikan tidak ada klaim jaminan hasil bisnis yang menyesatkan.'],
  },
  'legal-consultant': {
    applicant: 'Jelaskan bidang layanan hukum dan lampirkan bukti status profesi/izin atau keanggotaan yang diwajibkan untuk layanan yang ditawarkan.',
    reviewer: ['Verifikasi status profesi, keanggotaan/izin, dan kewenangan melalui organisasi/otoritas resmi yang relevan.', 'Pastikan ruang lingkup layanan tidak melampaui kewenangan pemohon.', 'Jangan menyetujui dokumen yang kedaluwarsa atau tidak dapat diverifikasi.'],
  },
  'tax-consultant': {
    applicant: 'Lampirkan izin praktik/kartu izin konsultan pajak dan bukti status/tingkat izin yang masih berlaku sesuai layanan yang ditawarkan.',
    reviewer: ['Verifikasi izin praktik dan status/tingkat izin melalui kanal resmi yang relevan.', 'Cocokkan identitas, masa berlaku, dan ruang lingkup layanan.', 'Jangan tampilkan layanan yang berada di luar kewenangan pemohon.'],
  },
  'graphic-designer': {
    applicant: 'Siapkan identitas dan portofolio desain yang dibuat sendiri atau memiliki izin penggunaan.',
    reviewer: ['Tinjau portofolio dan kepemilikan/hak penggunaan karya.', 'Cocokkan identitas; jangan meminta dokumen sensitif yang tidak relevan.'],
  },
  photographer: {
    applicant: 'Siapkan identitas, portofolio foto, dan referensi klien bila ada.',
    reviewer: ['Tinjau portofolio, referensi, dan izin penggunaan karya.', 'Pastikan praktik persetujuan subjek foto dan perlindungan privasi dijelaskan.'],
  },
  'videographer-editor': {
    applicant: 'Siapkan identitas, showreel/portofolio, dan referensi proyek bila ada.',
    reviewer: ['Tinjau showreel/portofolio dan referensi.', 'Pastikan hak penggunaan materi, musik, dan rekaman dijelaskan.'],
  },
  'event-mc': {
    applicant: 'Siapkan identitas, rekaman penampilan/portofolio, bahasa yang dikuasai, dan referensi acara.',
    reviewer: ['Tinjau rekaman/portofolio dan referensi penyelenggara.', 'Periksa kemampuan bahasa, jenis acara, dan batas layanan.'],
  },
  'event-crew': {
    applicant: 'Siapkan identitas dan pengalaman/referensi kerja event bila ada.',
    reviewer: ['Cocokkan identitas dan pengalaman.', 'Pastikan peran dan protokol keselamatan acara dijelaskan.'],
  },
  'makeup-artist': {
    applicant: 'Siapkan identitas, portofolio hasil rias, dan pelatihan/sertifikat bila ada.',
    reviewer: ['Tinjau portofolio dan pelatihan yang diklaim.', 'Periksa praktik higienitas alat dan persetujuan penggunaan foto.'],
  },
  'personal-trainer': {
    applicant: 'Siapkan sertifikat pelatihan kebugaran yang relevan, pengalaman, dan pertolongan pertama bila tersedia.',
    reviewer: ['Verifikasi penerbit dan ruang lingkup sertifikat/pelatihan.', 'Pastikan layanan dibatasi pada kebugaran non-medis dan tidak membuat klaim diagnosis/terapi.'],
  },
  'pet-sitter': {
    applicant: 'Siapkan identitas, pengalaman, referensi, dan informasi penanganan hewan.',
    reviewer: ['Cocokkan identitas dan referensi.', 'Periksa pengalaman, prosedur keadaan darurat, dan batas jenis hewan yang diterima.'],
  },
  'dog-walker': {
    applicant: 'Siapkan identitas, pengalaman, dan referensi pemilik hewan bila ada.',
    reviewer: ['Cocokkan identitas dan referensi.', 'Tinjau prosedur keselamatan saat berjalan dan penanganan insiden.'],
  },
  'ac-technician': {
    applicant: 'Siapkan identitas, sertifikat/pelatihan teknis bila ada, dan portofolio pekerjaan.',
    reviewer: ['Periksa pelatihan/sertifikat dan pengalaman.', 'Tinjau prosedur keselamatan kelistrikan, refrigeran, dan pekerjaan di ketinggian.'],
  },
  'electronics-technician': {
    applicant: 'Siapkan identitas, pelatihan teknis bila ada, dan portofolio pekerjaan/perbaikan.',
    reviewer: ['Periksa pengalaman dan pelatihan yang diklaim.', 'Tinjau prosedur keselamatan listrik dan pengelolaan data/perangkat milik pelanggan.'],
  },
  'private-tutor': {
    applicant: 'Siapkan identitas, bidang/mata pelajaran, bukti pendidikan atau portofolio mengajar, dan referensi bila ada.',
    reviewer: ['Cocokkan latar pendidikan/portofolio dan referensi.', 'Pastikan bidang ajar sesuai kompetensi dan profil tidak membuat klaim gelar palsu.'],
  },
  'language-translator': {
    applicant: 'Siapkan identitas, contoh terjemahan yang tidak memuat data rahasia, bahasa dan bidang spesialisasi, serta referensi klien.',
    reviewer: ['Tinjau contoh kerja dan referensi.', 'Untuk terjemahan tersumpah/resmi, verifikasi status penerjemah tersumpah melalui kanal resmi sebelum mengizinkan klaim tersebut.'],
  },
};

export const getProfessionalVerificationGuide = (subcategoryId: string) =>
  guides[subcategoryId] || {
    applicant: 'Siapkan identitas dan bukti pengalaman/kompetensi yang relevan dengan jenis layanan.',
    reviewer: ['Cocokkan identitas, pengalaman, bukti kompetensi, dan referensi sesuai risiko layanan.'],
  };
