/**
 * YUKU Navigation & Route Types
 */

export type AppRoute =
  | '/'
  | '/talent'
  | '/komunitas'
  | '/talent/:id'
  | '/cara-kerja'
  | '/daftar-talent'
  | '/dashboard-talent'
  | '/riwayat-booking'
  | '/profil-saya'
  | '/admin'
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
