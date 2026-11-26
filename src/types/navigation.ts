/**
 * YUKU Navigation & Route Types
 */

export type AppRoute =
  | '/'
  | '/talent'
  | '/komunitas'
  | '/talent/:id'
  | '/jasa-profesional'
  | '/jasa-profesional/:id'
  | '/daftar-jasa-profesional'
  | '/cara-kerja'
  | '/daftar-talent'
  | '/dashboard-talent'
  | '/riwayat-booking'
  | '/profil-saya'
  | '/admin'
  | '/admin/jasa-profesional'
  | '/tentang'
  | '/faq'
  | '/bantuan'
  | '/login'
  | '/register'
  | '/ganti-sandi'
  | '/lupa-sandi'
  | '/reset-sandi'
  | '/aktivasi-admin'
  | '/verifikasi-ktp'
  | '/syarat-ketentuan'
  | '/kebijakan-privasi';

export interface NavItem {
  label: string;
  href: AppRoute;
  isAction?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: AppRoute | string;
}
