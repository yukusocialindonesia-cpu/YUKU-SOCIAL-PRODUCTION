import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Users,
  CreditCard,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Eye,
  FileCheck,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Lock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  MapPin,
  Calendar,
  Building,
  ShieldAlert,
  Image as ImageIcon,
  Upload,
  Trash2,
  EyeOff,
  Megaphone,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AppRoute } from '../types/navigation';
import { formatRupiah } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { PromotionRow, ReportStatus } from '../types/database';
import { getReportCategoryLabel, getReportStatusMeta } from '../utils/reportHelpers';
import { QrisAdminPanel } from '../components/booking/QrisAdminPanel';
import { BrandingAdminPanel } from '../components/admin/BrandingAdminPanel';
import { HeroSlidesAdminPanel } from '../components/admin/HeroSlidesAdminPanel';
import { AffiliateAdminPanel } from '../components/admin/AffiliateAdminPanel';
import { AdminManagementPanel } from '../components/admin/AdminManagementPanel';
import { CommunityModerationPanel } from '../components/admin/CommunityModerationPanel';

interface AdminPageProps {
  onNavigate: (path: AppRoute, params?: Record<string, string>) => void;
}

interface TalentCurationItem {
  id: string;
  display_name: string;
  avatar_url: string | null;
  city: string;
  gender: string;
  headline: string | null;
  bio: string | null;
  hourly_rate: number;
  is_approved: boolean;
  created_at: string;
  // Identities
  full_legal_name?: string;
  date_of_birth?: string;
  ktp_number?: string | null;
  ktp_storage_path?: string | null;
  ktp_verification_status?: string;
  ktp_rejection_reason?: string | null;
  emergency_contact_phone?: string | null;
  // User account
  email?: string;
  account_status?: string;
  is_verified_18?: boolean;
}

interface AdminPayoutItem {
  id: string;
  payout_number: string;
  talent_id: string;
  amount: number;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder_name: string;
  payout_status: 'requested' | 'processing' | 'completed_provider_confirmed' | 'rejected' | 'failed';
  rejection_reason: string | null;
  created_at: string;
  talent_name?: string;
  talent_city?: string;
}

interface AdminRefundItem {
  id: string;
  payment_id: string;
  booking_id: string;
  customer_id: string;
  refund_amount: number;
  reason: string;
  provider_refund_id: string | null;
  status: 'requested' | 'approved' | 'processed' | 'rejected';
  created_at: string;
  booking_code?: string;
  customer_name?: string;
}

interface CustomerCancellationCaseItem {
  id: string;
  booking_id: string;
  customer_id: string;
  gross_amount: number;
  automatic_refund_amount: number;
  retained_pending_admin_amount: number;
  hours_before_session: number | null;
  policy_code: string;
  status: string;
  admin_hold_until?: string | null;
  created_at: string;
  booking_code?: string;
  customer_name?: string;
}

type AdminTab = 'talents' | 'service_reviews' | 'customer_ktp' | 'payouts' | 'refunds' | 'bookings' | 'reports' | 'promos' | 'qris' | 'branding' | 'hero' | 'affiliate' | 'overview' | 'admin_management' | 'community_moderation';

interface AdminBookingItem {
  id: string;
  booking_code: string;
  customer_id: string;
  talent_id: string;
  booking_mode: string;
  start_time: string;
  duration_hours: number;
  meeting_location_name: string;
  gross_amount?: number;
  platform_fee_amount?: number;
  talent_gross_share?: number;
  status: string;
  created_at: string;
  customer_name?: string;
  talent_name?: string;
}

interface CustomerKtpItem {
  id: string;
  full_legal_name: string;
  date_of_birth: string;
  ktp_number: string | null;
  ktp_storage_path: string | null;
  ktp_verification_status: 'unsubmitted' | 'pending_review' | 'verified' | 'rejected';
  ktp_rejection_reason: string | null;
  emergency_contact_phone: string | null;
  email?: string;
  account_status?: string;
  is_verified_18?: boolean;
}

interface AdminReportItem {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  booking_id: string | null;
  category: string;
  description: string;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  reporter_name?: string;
  reported_user_name?: string;
  booking_code?: string | null;
  booking_status?: string | null;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigate }) => {
  const { user: currentUser, role, adminAccess, isAuthLoading: isCheckingAuth } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Data States
  const [talents, setTalents] = useState<TalentCurationItem[]>([]);
  const [pendingTalentServices, setPendingTalentServices] = useState<any[]>([]);
  const [approvedTalentServices, setApprovedTalentServices] = useState<any[]>([]);
  const [talentServiceHistory, setTalentServiceHistory] = useState<any[]>([]);
  const [pendingIdentityChanges, setPendingIdentityChanges] = useState<any[]>([]);
  const [customerKtps, setCustomerKtps] = useState<CustomerKtpItem[]>([]);
  const [selectedCustomerKtpImage, setSelectedCustomerKtpImage] = useState<{ url: string; name: string } | null>(null);
  const [loadingCustomerKtpId, setLoadingCustomerKtpId] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<AdminPayoutItem[]>([]);
  const [refunds, setRefunds] = useState<AdminRefundItem[]>([]);
  const [customerCancellationCases, setCustomerCancellationCases] = useState<CustomerCancellationCaseItem[]>([]);
  const [bookings, setBookings] = useState<AdminBookingItem[]>([]);
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [promoPosters, setPromoPosters] = useState<PromotionRow[]>([]);
  const [promoMigrationMissing, setPromoMigrationMissing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [talentFilter, setTalentFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [payoutFilter, setPayoutFilter] = useState<
    'all' | 'requested' | 'processing' | 'completed_provider_confirmed' | 'rejected' | 'failed'
  >('requested');
  const [reportFilter, setReportFilter] = useState<'all' | ReportStatus>('open');
  const [searchQuery, setSearchQuery] = useState('');

  // Promo Poster Form States
  const [promoFile, setPromoFile] = useState<File | null>(null);
  const [promoPreviewUrl, setPromoPreviewUrl] = useState<string | null>(null);
  const [promoTitle, setPromoTitle] = useState('');
  const [promoTargetLink, setPromoTargetLink] = useState('');
  const [promoSortOrder, setPromoSortOrder] = useState('0');
  const [isUploadingPromo, setIsUploadingPromo] = useState(false);
  const [confirmDeletePromoId, setConfirmDeletePromoId] = useState<string | null>(null);

  // Modals & Action States
  const [selectedKtpItem, setSelectedKtpItem] = useState<TalentCurationItem | null>(null);
  const [selectedReportItem, setSelectedReportItem] = useState<AdminReportItem | null>(null);
  const [reportDecision, setReportDecision] = useState<ReportStatus>('investigating');
  const [reportAdminNotes, setReportAdminNotes] = useState('');
  const [holdBookingOnDispute, setHoldBookingOnDispute] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const isAdminAuthorized = role === 'admin' && adminAccess !== null;
  const isSuperAdmin = adminAccess?.isSuperAdmin === true;
  const canAccess = (permission: 'talent' | 'booking' | 'finance' | 'support') =>
    isSuperAdmin || adminAccess?.permissions.includes(permission) === true;
  const availableTabs = useMemo<AdminTab[]>(() => {
    const tabs: AdminTab[] = [];
    if (canAccess('talent')) tabs.push('talents', 'service_reviews');
    if (canAccess('booking')) tabs.push('bookings');
    if (canAccess('finance')) tabs.push('payouts', 'refunds', 'qris', 'affiliate');
    if (canAccess('support')) tabs.push('customer_ktp', 'reports', 'community_moderation');
    if (isSuperAdmin) tabs.push('overview', 'hero', 'promos', 'branding', 'admin_management');
    return tabs;
  }, [adminAccess]);

  useEffect(() => {
    if (availableTabs.length === 0) {
      if (activeTab !== 'overview') setActiveTab('overview');
      return;
    }
    if (!availableTabs.includes(activeTab)) setActiveTab(availableTabs[0]);
  }, [availableTabs, activeTab]);

  // Load Admin Data
  const loadAdminData = useCallback(async () => {
    if (!adminAccess) {
      setIsLoading(false);
      return;
    }

    const isSuperAdmin = adminAccess.isSuperAdmin;
    const canTalent = isSuperAdmin || adminAccess.permissions.includes('talent');
    const canBooking = isSuperAdmin || adminAccess.permissions.includes('booking');
    const canFinance = isSuperAdmin || adminAccess.permissions.includes('finance');
    const canSupport = isSuperAdmin || adminAccess.permissions.includes('support');

    setIsLoading(true);
    setErrorMessage(null);

    try {
      let enrichedBookings: AdminBookingItem[] = [];

      // TALENT: profile curation, KTP Talent, service and display-name reviews.
      if (canTalent) {
        const { data: talentRows, error: talentErr } = await supabase
          .from('talent_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (talentErr) throw talentErr;

        const talentIds = (talentRows || []).map((t) => t.id);
        const [{ data: identityRows }, { data: userRows }] = talentIds.length
          ? await Promise.all([
              supabase.from('user_identities')
                .select('id,full_legal_name,date_of_birth,ktp_number,ktp_storage_path,ktp_verification_status,ktp_rejection_reason,emergency_contact_phone')
                .in('id', talentIds),
              supabase.rpc('get_admin_user_summaries', { p_user_ids: talentIds }),
            ])
          : [{ data: [] as any[] }, { data: [] as any[] }];

        const idMap = new Map((identityRows || []).map((id) => [id.id, id]));
        const userMap = new Map<string, any>((userRows || []).map((u: any) => [u.id, u] as [string, any]));
        const combinedTalents: TalentCurationItem[] = (talentRows || []).map((t) => {
          const idRecord = idMap.get(t.id);
          const uRecord = userMap.get(t.id);
          const ktpStatus = idRecord?.ktp_verification_status || 'unsubmitted';
          const accountStatus = uRecord?.account_status;
          const isVerified18 = uRecord?.is_verified_18 === true;
          return {
            ...t,
            is_approved: ktpStatus === 'verified' && accountStatus === 'active' && isVerified18,
            full_legal_name: idRecord?.full_legal_name,
            date_of_birth: idRecord?.date_of_birth,
            ktp_number: idRecord?.ktp_number,
            ktp_storage_path: idRecord?.ktp_storage_path,
            ktp_verification_status: ktpStatus,
            ktp_rejection_reason: idRecord?.ktp_rejection_reason,
            emergency_contact_phone: idRecord?.emergency_contact_phone,
            email: uRecord?.email,
            account_status: accountStatus,
            is_verified_18: uRecord?.is_verified_18,
          };
        });
        setTalents(combinedTalents);

        const [
          { data: serviceRequests, error: serviceRequestError },
          { data: identityRequests, error: identityRequestError },
          { data: approvedServices },
          { data: serviceHistory },
        ] = await Promise.all([
          supabase.from('talent_services').select('id,talent_id,activity_category_id,custom_rate_override,approval_status,created_at').eq('approval_status', 'pending').order('created_at', { ascending: true }),
          supabase.from('talent_identity_change_requests').select('id,talent_id,field_name,old_value,requested_value,created_at').eq('status', 'pending').order('created_at', { ascending: true }),
          supabase.from('talent_services').select('id,talent_id,activity_category_id,custom_rate_override,approval_status,is_active,updated_at').eq('approval_status', 'approved').order('updated_at', { ascending: false }).limit(100),
          supabase.from('talent_service_change_log').select('id,talent_id,change_type,old_value,new_value,created_at').order('created_at', { ascending: false }).limit(30),
        ]);
        if (serviceRequestError) console.warn('Gagal membaca antrean layanan Talent:', serviceRequestError.message);
        if (identityRequestError) console.warn('Gagal membaca antrean perubahan identitas:', identityRequestError.message);
        setApprovedTalentServices(approvedServices || []);
        setTalentServiceHistory(serviceHistory || []);

        const serviceTalentIds = Array.from(new Set((serviceRequests || []).map((r) => r.talent_id)));
        const serviceCategoryIds = Array.from(new Set((serviceRequests || []).map((r) => r.activity_category_id)));
        const [{ data: serviceTalentProfiles }, { data: serviceCategoryRows }] = await Promise.all([
          serviceTalentIds.length ? supabase.from('talent_profiles').select('id,display_name,city').in('id', serviceTalentIds) : Promise.resolve({ data: [] as any[] }),
          serviceCategoryIds.length ? supabase.from('activity_categories').select('id,title').in('id', serviceCategoryIds) : Promise.resolve({ data: [] as any[] }),
        ]);
        const serviceTalentMap = new Map((serviceTalentProfiles || []).map((t) => [t.id, t]));
        const serviceCategoryMap = new Map((serviceCategoryRows || []).map((c) => [c.id, c.title]));
        setPendingTalentServices((serviceRequests || []).map((r) => ({
          ...r,
          talent_name: serviceTalentMap.get(r.talent_id)?.display_name || 'Talent',
          talent_city: serviceTalentMap.get(r.talent_id)?.city || '-',
          category_title: serviceCategoryMap.get(r.activity_category_id) || r.activity_category_id,
        })));

        const allServiceTalentIds = Array.from(new Set([
          ...(approvedServices || []).map((r) => r.talent_id),
          ...(serviceHistory || []).map((r) => r.talent_id),
        ]));
        const allServiceCategoryIds = Array.from(new Set((approvedServices || []).map((r) => r.activity_category_id)));
        const [{ data: allTalentProfiles }, { data: allCategories }] = await Promise.all([
          allServiceTalentIds.length ? supabase.from('talent_profiles').select('id,display_name').in('id', allServiceTalentIds) : Promise.resolve({ data: [] as any[] }),
          allServiceCategoryIds.length ? supabase.from('activity_categories').select('id,title').in('id', allServiceCategoryIds) : Promise.resolve({ data: [] as any[] }),
        ]);
        const allTalentMap = new Map((allTalentProfiles || []).map((t) => [t.id, t.display_name]));
        const allCategoryMap = new Map((allCategories || []).map((c) => [c.id, c.title]));
        setApprovedTalentServices((approvedServices || []).map((r) => ({
          ...r,
          talent_name: allTalentMap.get(r.talent_id) || 'Talent',
          category_title: allCategoryMap.get(r.activity_category_id) || r.activity_category_id,
        })));
        setTalentServiceHistory((serviceHistory || []).map((r) => ({
          ...r,
          talent_name: allTalentMap.get(r.talent_id) || 'Talent',
        })));

        const identityTalentIds = Array.from(new Set((identityRequests || []).map((r) => r.talent_id)));
        const { data: identityTalentProfiles } = identityTalentIds.length
          ? await supabase.from('talent_profiles').select('id,display_name,city').in('id', identityTalentIds)
          : { data: [] as any[] };
        const identityTalentMap = new Map((identityTalentProfiles || []).map((t) => [t.id, t]));
        setPendingIdentityChanges((identityRequests || []).map((r) => ({
          ...r,
          talent_name: identityTalentMap.get(r.talent_id)?.display_name || 'Talent',
        })));
      } else {
        setTalents([]);
        setPendingTalentServices([]);
        setApprovedTalentServices([]);
        setTalentServiceHistory([]);
        setPendingIdentityChanges([]);
      }

      // FINANCE: payout, refunds, customer cancellation cases and affiliate data.
      if (canFinance) {
        const { data: payoutRows, error: payoutErr } = await supabase
          .from('payout_requests').select('*').order('created_at', { ascending: false });
        if (payoutErr) throw payoutErr;
        const payoutTalentIds = Array.from(new Set((payoutRows || []).map((p) => p.talent_id)));
        const { data: payoutTalentLabels } = payoutTalentIds.length
          ? await supabase.rpc('get_admin_talent_labels', { p_talent_ids: payoutTalentIds })
          : { data: [] as any[] };
        const payoutTalentMap = new Map<string, any>((payoutTalentLabels || []).map((t: any) => [t.id, t] as [string, any]));
        setPayouts((payoutRows || []).map((p) => ({
          ...p,
          talent_name: payoutTalentMap.get(p.talent_id)?.display_name || 'Talent YUKU',
          talent_city: payoutTalentMap.get(p.talent_id)?.city || '-',
        })));

        const { data: refundRows, error: refundErr } = await supabase
          .from('refunds').select('*').order('created_at', { ascending: false });
        if (refundErr) throw refundErr;
        const refundCustomerIds = Array.from(new Set((refundRows || []).map((r) => r.customer_id)));
        const { data: refundCustomers } = refundCustomerIds.length
          ? await supabase.rpc('get_admin_customer_labels', { p_customer_ids: refundCustomerIds })
          : { data: [] as any[] };
        const refundCustomerMap = new Map((refundCustomers || []).map((c: any) => [c.id, c.display_name]));
        const refundBookingIds = Array.from(new Set((refundRows || []).map((r) => r.booking_id)));
        const { data: refundBookingLabels } = refundBookingIds.length
          ? await supabase.rpc('get_admin_finance_booking_labels', { p_booking_ids: refundBookingIds })
          : { data: [] as any[] };
        const bookingCodeMap = new Map((refundBookingLabels || []).map((b: any) => [b.id, b.booking_code]));
        setRefunds((refundRows || []).map((r) => ({
          ...r,
          customer_name: refundCustomerMap.get(r.customer_id) || 'Customer YUKU',
          booking_code: bookingCodeMap.get(r.booking_id) || r.booking_id,
        })) as AdminRefundItem[]);

        const { data: cancellationCaseRows, error: cancellationCaseErr } = await supabase
          .from('customer_cancellation_cases').select('*').order('created_at', { ascending: false });
        if (cancellationCaseErr) throw cancellationCaseErr;
        const caseCustomerIds = Array.from(new Set((cancellationCaseRows || []).map((c) => c.customer_id)));
        const { data: caseCustomers } = caseCustomerIds.length
          ? await supabase.rpc('get_admin_customer_labels', { p_customer_ids: caseCustomerIds })
          : { data: [] as any[] };
        const caseCustomerMap = new Map((caseCustomers || []).map((c: any) => [c.id, c.display_name]));
        const caseBookingIds = Array.from(new Set((cancellationCaseRows || []).map((c) => c.booking_id)));
        const { data: caseBookingLabels } = caseBookingIds.length
          ? await supabase.rpc('get_admin_finance_booking_labels', { p_booking_ids: caseBookingIds })
          : { data: [] as any[] };
        const caseBookingMap = new Map((caseBookingLabels || []).map((b: any) => [b.id, b.booking_code]));
        setCustomerCancellationCases((cancellationCaseRows || []).map((c) => ({
          ...c,
          customer_name: caseCustomerMap.get(c.customer_id) || 'Customer YUKU',
          booking_code: caseBookingMap.get(c.booking_id) || c.booking_id,
        })) as CustomerCancellationCaseItem[]);
      } else {
        setPayouts([]);
        setRefunds([]);
        setCustomerCancellationCases([]);
      }

      // BOOKING: Admin receives operational fields only; Super Admin keeps full audit data.
      if (canBooking) {
        if (isSuperAdmin) {
          const { data: bookingRows, error: bookingErr } = await supabase
            .from('bookings').select('*').order('created_at', { ascending: false });
          if (bookingErr) throw bookingErr;
          const custIds = Array.from(new Set((bookingRows || []).map((b) => b.customer_id)));
          const talIds = Array.from(new Set((bookingRows || []).map((b) => b.talent_id)));
          const [{ data: customers }, { data: talProfiles }] = await Promise.all([
            custIds.length ? supabase.from('customer_profiles').select('id,display_name').in('id', custIds) : Promise.resolve({ data: [] as any[] }),
            talIds.length ? supabase.from('talent_profiles').select('id,display_name').in('id', talIds) : Promise.resolve({ data: [] as any[] }),
          ]);
          const custMap = new Map((customers || []).map((c) => [c.id, c.display_name]));
          const talMap = new Map((talProfiles || []).map((t) => [t.id, t.display_name]));
          enrichedBookings = (bookingRows || []).map((b) => ({
            ...b,
            customer_name: custMap.get(b.customer_id) || 'Customer',
            talent_name: talMap.get(b.talent_id) || 'Talent',
          }));
        } else {
          const { data: bookingRows, error: bookingErr } = await supabase.rpc('get_admin_bookings');
          if (bookingErr) throw bookingErr;
          enrichedBookings = (bookingRows || []) as AdminBookingItem[];
        }
        setBookings(enrichedBookings);
      } else {
        setBookings([]);
      }

      // SUPPORT: KTP Customer and incident reports. KTP query is already role-scoped by RLS.
      if (canSupport) {
        const { data: allIdentityRows, error: identityFetchError } = await supabase
          .from('user_identities')
          .select('id,full_legal_name,date_of_birth,ktp_number,ktp_storage_path,ktp_verification_status,ktp_rejection_reason,emergency_contact_phone')
          .order('created_at', { ascending: false });
        if (identityFetchError) throw identityFetchError;
        const customerIdentityIds = (allIdentityRows || []).map((row) => row.id);
        const { data: customerUsers } = customerIdentityIds.length
          ? await supabase.rpc('get_admin_user_summaries', { p_user_ids: customerIdentityIds })
          : { data: [] as any[] };
        const customerUserRows = (customerUsers || []).filter((u: any) => u.role === 'customer');
        const customerUserMap = new Map<string, any>(customerUserRows.map((u: any) => [u.id, u] as [string, any]));
        const customerUserIds = new Set(customerUserRows.map((u: any) => u.id));
        setCustomerKtps((allIdentityRows || []).filter((row) => customerUserIds.has(row.id)).map((row) => {
          const uRec = customerUserMap.get(row.id);
          return {
            ...row,
            email: uRec?.email,
            account_status: uRec?.account_status,
            is_verified_18: uRec?.is_verified_18,
          } as CustomerKtpItem;
        }));

        const { data: reportRows, error: reportErr } = await supabase
          .from('reports_complaints')
          .select('id,reporter_id,reported_user_id,booking_id,category,description,status,admin_notes,created_at')
          .order('created_at', { ascending: false });
        if (reportErr) throw reportErr;
        const partyIds = Array.from(new Set((reportRows || []).flatMap((r) => [r.reporter_id, r.reported_user_id])));
        const { data: partyUsers } = partyIds.length
          ? await supabase.rpc('get_admin_user_summaries', { p_user_ids: partyIds })
          : { data: [] as any[] };
        const userLabelMap = new Map<string, string>();
        partyUsers?.forEach((u: any) => userLabelMap.set(u.id, u.full_name || u.email || 'Pengguna YUKU'));
        const reportBookingIds = Array.from(new Set((reportRows || []).map((r) => r.booking_id).filter(Boolean))) as string[];
        const { data: reportBookings } = reportBookingIds.length
          ? await supabase.rpc('get_admin_report_booking_summaries', { p_booking_ids: reportBookingIds })
          : { data: [] as any[] };
        const bookingInfoMap = new Map<string, { code: string; status: string }>((reportBookings || []).map((b: any) => [b.id, { code: b.booking_code, status: b.status }] as [string, { code: string; status: string }]));
        setReports((reportRows || []).map((r) => {
          const bInfo = r.booking_id ? bookingInfoMap.get(r.booking_id) : undefined;
          return {
            ...r,
            reporter_name: userLabelMap.get(r.reporter_id) || 'Pengguna YUKU',
            reported_user_name: userLabelMap.get(r.reported_user_id) || 'Pengguna YUKU',
            booking_code: bInfo?.code || null,
            booking_status: bInfo?.status || null,
          } as AdminReportItem;
        }));
      } else {
        setCustomerKtps([]);
        setReports([]);
      }

      // Super Admin-only content and global overview data.
      if (isSuperAdmin) {
        const { data: promoRows, error: promoErr } = await supabase
          .from('promotions').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
        if (promoErr) {
          if (promoErr.code === '42P01' || promoErr.message.includes('promotions')) setPromoMigrationMissing(true);
          setPromoPosters([]);
        } else {
          setPromoMigrationMissing(false);
          setPromoPosters((promoRows as PromotionRow[]) || []);
        }
      } else {
        setPromoPosters([]);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memuat data panel admin.');
    } finally {
      setIsLoading(false);
    }
  }, [adminAccess]);

  useEffect(() => {
    if (isAdminAuthorized && adminAccess) {
      loadAdminData();
    }
  }, [isAdminAuthorized, adminAccess, loadAdminData]);

  const handleTalentServiceReview = async (serviceId: string, decision: 'approved' | 'rejected' | 'disabled_by_admin') => {
    const note = window.prompt(decision === 'approved' ? 'Catatan Admin (opsional):' : 'Alasan keputusan:') || '';
    setIsLoading(true); setErrorMessage(null);
    try {
      const { error } = await supabase.rpc('review_talent_service', { p_service_id: serviceId, p_decision: decision, p_note: note });
      if (error) throw error;
      setSuccessMessage('Keputusan layanan berhasil disimpan.'); await loadAdminData();
    } catch (err: any) { setErrorMessage(err?.message || 'Gagal memproses pengajuan layanan.'); }
    finally { setIsLoading(false); }
  };

  const handleIdentityChangeReview = async (requestId: string, decision: 'approved' | 'rejected') => {
    const note = window.prompt('Catatan Admin (opsional):') || '';
    setIsLoading(true); setErrorMessage(null);
    try {
      const { error } = await supabase.rpc('review_talent_identity_change', { p_request_id: requestId, p_decision: decision, p_note: note });
      if (error) throw error;
      setSuccessMessage('Permintaan perubahan nama berhasil diproses.'); await loadAdminData();
    } catch (err: any) { setErrorMessage(err?.message || 'Gagal memproses perubahan identitas.'); }
    finally { setIsLoading(false); }
  };

  // Action: Approve Talent
  const handleApproveTalent = async (talent: TalentCurationItem) => {
    setIsSubmittingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error: rpcError } = await supabase.rpc('admin_review_talent', {
        p_talent_id: talent.id,
        p_is_approved: true,
        p_ktp_status: 'verified',
        p_notes: null,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setSuccessMessage(
        `Sukses! Profil Talent "${talent.display_name}" telah disetujui dan kini tayang di katalog publik YUKU.`
      );
      setSelectedKtpItem(null);
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(`Gagal menyetujui profil talent: ${err?.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Action: Reject Talent
  const handleRejectTalent = async (talent: TalentCurationItem) => {
    const reason = window.prompt(
      'Masukkan alasan penolakan berkas / profil talent:',
      'Foto KTP buram atau profil tidak memenuhi standar etika komunitas YUKU'
    );
    if (!reason || !reason.trim()) return;

    setIsSubmittingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error: rpcError } = await supabase.rpc('admin_review_talent', {
        p_talent_id: talent.id,
        p_is_approved: false,
        p_ktp_status: 'rejected',
        p_notes: reason.trim(),
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setSuccessMessage(`Profil Talent "${talent.display_name}" telah ditolak dengan alasan: "${reason.trim()}".`);
      setSelectedKtpItem(null);
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(`Gagal menolak profil talent: ${err?.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleResolveCancellationCase = async (caseItem: CustomerCancellationCaseItem, decision: 'refund_customer' | 'compensate_talent' | 'extend_hold') => {
    const amountLabel = formatRupiah(Number(caseItem.retained_pending_admin_amount));
    let adminNotes = '';
    let providerRefundId: string | null = null;
    let holdUntil: string | null = null;

    if (decision === 'refund_customer') {
      adminNotes = window.prompt(`Catatan keputusan refund ${amountLabel}. Pastikan dana sudah benar-benar dikembalikan melalui provider/bank. Masukkan alasan:`, '') || '';
      if (!adminNotes.trim()) return;
      providerRefundId = window.prompt('Masukkan referensi refund provider/bank yang sudah berhasil:', '') || '';
      if (!providerRefundId.trim()) return;
      if (!window.confirm(`Konfirmasi: ${amountLabel} sudah benar-benar dikembalikan kepada Customer. Catat keputusan ini?`)) return;
    } else if (decision === 'compensate_talent') {
      adminNotes = window.prompt(`Catatan kompensasi Talent sebesar ${amountLabel}. Seluruh nominal kotor dialokasikan kepada Talent tanpa komisi YUKU. Catatan wajib:`, '') || '';
      if (!adminNotes.trim() || !window.confirm(`Setujui kompensasi Talent sebesar ${amountLabel}? Dana akan menjadi saldo tersedia untuk payout, bukan transfer bank otomatis.`)) return;
    } else {
      adminNotes = window.prompt(`Alasan memperpanjang penahanan dana ${amountLabel}:`, '') || '';
      if (!adminNotes.trim()) return;
      const holdInput = window.prompt('Masukkan batas waktu penahanan baru dalam format ISO, contoh 2026-11-20T17:00:00+07:00:', '');
      if (!holdInput || Number.isNaN(Date.parse(holdInput)) || Date.parse(holdInput) <= Date.now()) {
        setErrorMessage('Tanggal/jam penahanan tidak valid atau harus berada di masa depan.');
        return;
      }
      holdUntil = new Date(holdInput).toISOString();
      if (!window.confirm(`Perpanjang penahanan dana sampai ${new Date(holdUntil).toLocaleString('id-ID')}?`)) return;
    }

    setIsSubmittingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { error } = await supabase.rpc('admin_resolve_customer_cancellation_case', {
        p_case_id: caseItem.id,
        p_decision: decision,
        p_admin_notes: adminNotes.trim(),
        p_provider_refund_id: providerRefundId,
        p_hold_until: holdUntil,
      });
      if (error) throw new Error(error.message);
      const labels = {
        refund_customer: 'Refund Customer berhasil dicatat. Pastikan referensi provider tersimpan.',
        compensate_talent: 'Kompensasi 100% dana tertahan telah dialokasikan ke saldo Talent tanpa komisi YUKU.',
        extend_hold: 'Masa penahanan dana berhasil diperpanjang; kasus tetap menunggu keputusan Admin.',
      };
      setSuccessMessage(labels[decision]);
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(`Gagal menyelesaikan kasus pembatalan: ${err?.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleProcessRefund = async (refundId: string) => {
    const reference = window.prompt('Masukkan referensi refund dari provider/bank setelah dana benar-benar dikembalikan:', '');
    if (!reference || !reference.trim()) return;
    const providerRefundId = reference.trim();

    const confirmed = window.confirm('Pastikan refund sudah benar-benar dikirim ke Customer di luar aplikasi. Lanjutkan pencatatan?');
    if (!confirmed) return;

    setIsSubmittingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { error } = await supabase.rpc('admin_process_refund', {
        p_refund_id: refundId,
        p_new_status: 'processed',
        p_provider_refund_id: providerRefundId,
        p_admin_notes: null,
      });
      if (error) throw new Error(error.message);
      setSuccessMessage('Refund dicatat selesai dengan referensi provider/bank.');
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(`Gagal memproses refund: ${err?.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Action: Process Payout (requested -> processing -> transfer confirmed)
  const handleProcessPayout = async (
    payoutId: string,
    newStatus: 'processing' | 'completed_provider_confirmed' | 'rejected'
  ) => {
    let rejectionReason: string | null = null;
    let providerReference: string | null = null;
    if (newStatus === 'completed_provider_confirmed') {
      const reference = window.prompt('Masukkan nomor referensi transfer bank/provider yang sudah berhasil:', '');
      if (!reference || !reference.trim()) return;
      providerReference = reference.trim();
    }
    if (newStatus === 'rejected') {
      const promptReason = window.prompt(
        'Masukkan alasan penolakan pencairan saldo:',
        'Nomor rekening tidak cocok dengan nama KTP terdaftar'
      );
      if (!promptReason) return;
      rejectionReason = promptReason.trim();
    }

    const confirmAction = window.confirm(
      newStatus === 'completed_provider_confirmed'
        ? 'Konfirmasi bahwa dana telah benar-benar ditransfer dan referensinya valid?'
        : newStatus === 'processing'
          ? 'Mulai proses pencairan ini? Status akan berubah menjadi Sedang Diproses.'
          : 'Konfirmasi penolakan permohonan pencairan dana ini?'
    );
    if (!confirmAction) return;

    setIsSubmittingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error: rpcError } = await supabase.rpc('admin_process_payout', {
        p_payout_id: payoutId,
        p_new_status: newStatus,
        p_rejection_reason: rejectionReason,
        p_provider_reference: providerReference,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setSuccessMessage(
        newStatus === 'completed_provider_confirmed'
          ? 'Pencairan ditandai selesai dengan referensi transfer yang dicatat.'
          : newStatus === 'processing'
            ? 'Permintaan pencairan sekarang berstatus Sedang Diproses.'
            : 'Penarikan saldo berhasil ditolak.'
      );
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(`Gagal memproses penarikan saldo: ${err?.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Action: Open private Customer KTP image using a short-lived signed URL
  const handleViewCustomerKtp = async (item: {
    id: string;
    ktp_storage_path: string | null;
    full_legal_name?: string | null;
    display_name?: string | null;
  }) => {
    if (!item.ktp_storage_path) {
      setErrorMessage('Foto KTP belum diunggah oleh pengguna ini.');
      return;
    }

    setLoadingCustomerKtpId(item.id);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.storage
        .from('ktp-documents')
        .createSignedUrl(item.ktp_storage_path, 300);

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Tautan foto KTP tidak berhasil dibuat.');
      }

      setSelectedCustomerKtpImage({
        url: data.signedUrl,
        name: item.full_legal_name || item.display_name || 'Pengguna YUKU',
      });
    } catch (err: any) {
      setErrorMessage(`Foto KTP tidak dapat dibuka: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setLoadingCustomerKtpId(null);
    }
  };

  // Action: Review Customer KTP via admin_review_ktp RPC
  const handleReviewCustomerKtp = async (
    item: CustomerKtpItem,
    decision: 'verified' | 'rejected'
  ) => {
    let reason: string | null = null;
    if (decision === 'rejected') {
      const promptReason = window.prompt(
        'Masukkan alasan penolakan KTP customer:',
        'Foto KTP buram atau NIK tidak terbaca dengan jelas'
      );
      if (!promptReason || !promptReason.trim()) return;
      reason = promptReason.trim();
    } else {
      const confirmApprove = window.confirm(
        `Setujui verifikasi e-KTP 18+ untuk customer "${item.full_legal_name}"?`
      );
      if (!confirmApprove) return;
    }

    setIsSubmittingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error: rpcError } = await supabase.rpc('admin_review_ktp', {
        p_user_id: item.id,
        p_decision: decision,
        p_reason: reason,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setSuccessMessage(
        decision === 'verified'
          ? `e-KTP customer "${item.full_legal_name}" berhasil diverifikasi (18+). Customer kini dapat membuat booking.`
          : `Pengajuan e-KTP customer "${item.full_legal_name}" telah ditolak.`
      );
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(`Gagal memproses verifikasi KTP customer: ${err?.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Action: Open & Resolve Incident Report via admin_resolve_report RPC
  const openReportModerationModal = (report: AdminReportItem) => {
    setSelectedReportItem(report);
    setReportDecision(report.status === 'open' ? 'investigating' : report.status);
    setReportAdminNotes(report.admin_notes || '');
    setHoldBookingOnDispute(false);
  };

  const handleResolveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportItem) return;

    setIsSubmittingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error: rpcError } = await supabase.rpc('admin_resolve_report', {
        p_report_id: selectedReportItem.id,
        p_new_status: reportDecision,
        p_admin_notes: reportAdminNotes.trim() || null,
        p_hold_booking: holdBookingOnDispute,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setSuccessMessage('Status laporan insiden berhasil diperbarui dan dicatat dalam log audit admin.');
      setSelectedReportItem(null);
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(
        `Gagal memproses laporan insiden: ${err?.message}. Pastikan migrasi 12_reports_admin_moderation.sql sudah dijalankan di Supabase.`
      );
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Actions: Promo Posters Management
  const handlePromoFileChange = async (file: File | null) => {
    if (promoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(promoPreviewUrl);
    setPromoFile(null);
    setPromoPreviewUrl(null);
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Format banner harus JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Ukuran file banner maksimal 5 MB.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const image = new Image();
    image.src = previewUrl;
    try {
      await image.decode();
      const ratio = image.naturalWidth / image.naturalHeight;
      if (image.naturalWidth < 1200 || Math.abs(ratio - 3.2) > 0.04) {
        URL.revokeObjectURL(previewUrl);
        setErrorMessage(`Ukuran gambar belum sesuai. Gunakan rasio 16:5 (contoh 1600 × 500 px), minimal lebar 1200 px. File ini ${image.naturalWidth} × ${image.naturalHeight} px.`);
        return;
      }
      setErrorMessage(null);
      setPromoFile(file);
      setPromoPreviewUrl(previewUrl);
    } catch {
      URL.revokeObjectURL(previewUrl);
      setErrorMessage('Gambar tidak dapat dibaca. Coba pilih file JPG, PNG, atau WebP lain.');
    }
  };

  const handleUploadPromoPoster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!promoFile) {
      setErrorMessage('Pilih file banner Jelajah terlebih dahulu.');
      return;
    }
    const file = promoFile;

    setIsUploadingPromo(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const cleanExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const storagePath = `jelajah-banners/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${cleanExt}`;
      const { error: uploadErr } = await supabase.storage
        .from('promotions')
        .upload(storagePath, file, { upsert: false, contentType: file.type });
      if (uploadErr) throw new Error(`Gagal mengunggah banner Jelajah: ${uploadErr.message}`);
      const { data: publicUrlData } = await supabase.storage.from('promotions').getPublicUrl(storagePath);
      const finalImageUrl = publicUrlData.publicUrl;

      const parsedOrder = parseInt(promoSortOrder, 10);
      const { error: insertErr } = await supabase.from('promotions').insert({
        title: promoTitle.trim() || 'Promo YUKU',
        image_url: finalImageUrl,
        storage_path: storagePath,
        link_url: promoTargetLink.trim() || null,
        sort_order: Number.isNaN(parsedOrder) ? 0 : parsedOrder,
        is_active: true,
        created_by: currentUser.id,
      });

      if (insertErr) throw new Error(insertErr.message);
      if (promoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(promoPreviewUrl);
      setPromoFile(null);
      setPromoPreviewUrl(null);
      setPromoTitle('');
      setPromoTargetLink('');
      setPromoSortOrder('0');
      setSuccessMessage('Banner baru berhasil diterbitkan ke halaman Jelajah!');
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(`Gagal menerbitkan banner Jelajah: ${err?.message}. Pastikan migrasi 15_promotions.sql sudah dijalankan di Supabase.`);
    } finally {
      setIsUploadingPromo(false);
    }
  };

  const handleTogglePromoActive = async (poster: PromotionRow) => {
    setIsSubmittingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: !poster.is_active })
        .eq('id', poster.id);

      if (error) throw error;
      setSuccessMessage(
        !poster.is_active
          ? `Banner "${poster.title}" sekarang tayang di Jelajah.`
          : `Banner "${poster.title}" disembunyikan dari Jelajah.`
      );
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(`Gagal mengubah status poster: ${err?.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleShiftPromoOrder = async (poster: PromotionRow, delta: number) => {
    setIsSubmittingAction(true);
    setErrorMessage(null);
    try {
      const nextOrder = Math.max(0, (poster.sort_order || 0) + delta);
      const { error } = await supabase
        .from('promotions')
        .update({ sort_order: nextOrder })
        .eq('id', poster.id);

      if (error) throw error;
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(`Gagal mengubah urutan poster: ${err?.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDeletePromoPoster = async (poster: PromotionRow) => {
    setIsSubmittingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', poster.id);

      if (error) throw error;

      if (poster.storage_path) {
        await supabase.storage.from('promotions').remove([poster.storage_path]);
      }

      setConfirmDeletePromoId(null);
      setSuccessMessage(`Poster "${poster.title}" berhasil dihapus.`);
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(`Gagal menghapus poster: ${err?.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Financial Stats
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const grossMarketplaceVolume = completedBookings.reduce((sum, b) => sum + (b.gross_amount || 0), 0);
  const platformRevenueFee = completedBookings.reduce((sum, b) => sum + (b.platform_fee_amount || 0), 0);
  const talentPayoutsPending = payouts
    .filter((p) => p.payout_status === 'requested')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Filtered Talents
  const filteredTalents = talents.filter((t) => {
    if (talentFilter === 'pending') return !t.is_approved;
    if (talentFilter === 'approved') return t.is_approved;
    return true;
  }).filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.display_name.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q) ||
      (t.email && t.email.toLowerCase().includes(q))
    );
  });

  // Filtered Payouts
  const filteredPayouts = payouts.filter((p) => {
    if (payoutFilter === 'all') return true;
    return p.payout_status === payoutFilter;
  });

  // Filtered Reports
  const filteredReports = reports.filter((r) => {
    if (reportFilter === 'all') return true;
    return r.status === reportFilter;
  });

  const activeReportsCount = reports.filter(
    (r) => r.status === 'open' || r.status === 'investigating'
  ).length;

  if (isCheckingAuth) {
    return (
      <div className="py-24 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-700 mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Memeriksa hak akses Administrator...</p>
      </div>
    );
  }

  // Not Authorized View
  if (!currentUser || !isAdminAuthorized) {
    return (
      <div className="py-20 bg-[#FAF8FC]">
        <div className="max-w-md mx-auto px-4 text-center space-y-6 bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Akses Terbatas: Tim Admin YUKU</h1>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Halaman ini dikhususkan bagi tim kurasi dan administrasi platform YUKU. Silakan masuk menggunakan akun resmi (misal: <strong>yukusocial@gmail.com</strong>) yang memiliki peran <em>admin</em>.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => onNavigate('/login')}
              className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              Masuk dengan Akun Admin
            </button>
            <button
              onClick={() => onNavigate('/')}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-colors"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate py-4 sm:py-8 bg-[radial-gradient(ellipse_at_top,_rgba(233,213,255,0.34),_transparent_48%),linear-gradient(180deg,#FAF8FC_0%,#F6F3FA_100%)] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        {/* Top Notification Alerts */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="font-medium">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 font-bold">
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="font-medium">{successMessage}</p>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">
              ×
            </button>
          </div>
        )}

        {/* Admin Header — mobile-first admin command center */}
        <section className="relative overflow-hidden rounded-[1.75rem] border border-purple-900/10 bg-gradient-to-br from-[#200650] via-[#351078] to-[#6d28d9] p-3.5 text-white shadow-lg shadow-purple-950/10 sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-orange-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-3 sm:gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner backdrop-blur">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-purple-100">
                    {isSuperAdmin ? 'Super Admin' : 'Admin'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Sesi aktif
                  </span>
                </div>
                <h1 className="text-xl font-black leading-tight tracking-tight sm:text-2xl">
                  {isSuperAdmin ? 'Pusat Kendali YUKU' : 'Panel Operasional YUKU'}
                </h1>
                <p className="mt-1 break-all text-[11px] leading-relaxed text-purple-100/85">
                  {currentUser.email}
                </p>
              </div>
            </div>
            <p className="max-w-2xl text-[11px] leading-relaxed text-white/80 sm:text-xs">
              {isSuperAdmin ? 'Pantau operasional, keuangan, keamanan, dan pengaturan seluruh platform dalam satu tempat.' : 'Kelola tugas operasional sesuai izin yang diberikan Super Admin.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={loadAdminData}
                disabled={isLoading}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-[11px] font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Segarkan Data
              </button>
              <button
                onClick={() => onNavigate('/talent')}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[11px] font-bold text-purple-900 transition hover:bg-purple-50"
              >
                Lihat Katalog <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="grid grid-cols-4 justify-items-center gap-x-2 gap-y-3 rounded-[28px] border border-white/90 bg-white/70 p-3 shadow-[0_18px_42px_-24px_rgba(76,29,149,0.24)] ring-1 ring-violet-100/80 backdrop-blur-2xl sm:grid-cols-5 sm:gap-3 sm:p-4">
          {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('promos')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'promos' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <Megaphone className={`w-3.5 h-3.5 ${activeTab === 'promos' ? 'text-white' : 'text-amber-600'}`} />
            <span>Banner Jelajah ({promoPosters.filter((p) => p.is_active).length})</span>
          </button>
          )}
          {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('overview')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${activeTab === 'overview' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'}`}
          >
            <TrendingUp className={`w-3.5 h-3.5 ${activeTab === 'overview' ? 'text-white' : 'text-emerald-600'}`} />
            <span>Overview</span>
          </button>
          )}
          {canAccess('talent') && (
          <button
            onClick={() => setActiveTab('talents')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'talents' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Kurasi Talent ({talents.length})</span>
          </button>
          )}
          {canAccess('talent') && (
          <button
            onClick={() => setActiveTab('service_reviews')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${activeTab === 'service_reviews' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Review Talent ({pendingTalentServices.length + pendingIdentityChanges.length})</span>
          </button>
          )}
          {canAccess('support') && (
          <button
            onClick={() => setActiveTab('customer_ktp')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'customer_ktp' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>
              KTP Customer ({customerKtps.filter((c) => c.ktp_verification_status === 'pending_review').length})
            </span>
          </button>
          )}
          {canAccess('finance') && (
          <button
            onClick={() => setActiveTab('payouts')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'payouts' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Pencairan Dana ({payouts.length})</span>
          </button>
          )}
          {canAccess('finance') && (
          <button
            onClick={() => setActiveTab('refunds')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'refunds' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${activeTab === 'refunds' ? 'text-white' : 'text-rose-600'}`} />
            <span>Refund ({refunds.filter((r) => r.status === 'requested' || r.status === 'approved').length})</span>
          </button>
          )}
          {canAccess('booking') && (
          <button
            onClick={() => setActiveTab('bookings')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'bookings' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Audit Booking & Escrow ({bookings.length})</span>
          </button>
          )}
          {canAccess('support') && (
          <button
            onClick={() => setActiveTab('community_moderation')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${activeTab === 'community_moderation' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Moderasi Komunitas</span>
          </button>
          )}
          {canAccess('support') && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'reports' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${activeTab === 'reports' ? 'text-white' : 'text-rose-600'}`} />
            <span>Laporan Insiden ({activeReportsCount})</span>
          </button>
          )}
          {canAccess('finance') && (
          <button
            onClick={() => setActiveTab('qris')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'qris' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <CreditCard className={`w-3.5 h-3.5 ${activeTab === 'qris' ? 'text-white' : 'text-emerald-600'}`} />
            <span>QRIS & Verifikasi</span>
          </button>
          )}
          {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('hero')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'hero' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <ImageIcon className={`w-3.5 h-3.5 ${activeTab === 'hero' ? 'text-white' : 'text-fuchsia-600'}`} />
            <span>Banner Beranda</span>
          </button>
          )}
          {canAccess('finance') && (
          <button
            onClick={() => setActiveTab('affiliate')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'affiliate' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <TrendingUp className={`w-3.5 h-3.5 ${activeTab === 'affiliate' ? 'text-white' : 'text-emerald-600'}`} />
            <span>Affiliate</span>
          </button>
          )}
          {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('admin_management')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'admin_management' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${activeTab === 'admin_management' ? 'text-white' : 'text-purple-600'}`} />
            <span>Pengaturan Admin</span>
          </button>
          )}
          {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('branding')}
            className={`h-20 w-full max-w-[88px] min-w-0 min-h-0 rounded-2xl border-0 bg-transparent px-1 py-1 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-center whitespace-normal leading-tight hover:bg-purple-50 [&>svg]:h-7 [&>svg]:w-7 [&>span]:text-[10px] [&>span]:font-semibold sm:h-24 sm:w-24 sm:gap-2.5 sm:[&>svg]:h-8 sm:[&>svg]:w-8 sm:[&>span]:text-[11px] ${
              activeTab === 'branding' ? 'border-purple-700 bg-gradient-to-br from-purple-700 to-violet-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            <ImageIcon className={`w-3.5 h-3.5 ${activeTab === 'branding' ? 'text-white' : 'text-purple-600'}`} />
            <span>Logo & Branding</span>
          </button>
          )}
        </div>

        {availableTabs.length === 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
            Akun Admin ini belum memiliki izin menu. Hubungi Super Admin untuk mengatur akses.
          </div>
        )}

        {activeTab === 'service_reviews' && (
          <div className="space-y-6">
            <section className="space-y-3">
              <div><h3 className="text-sm font-black text-slate-900">Pengajuan layanan baru</h3><p className="text-xs text-slate-500">Layanan baru belum tampil di katalog dan belum bisa dibooking sampai disetujui.</p></div>
              {pendingTalentServices.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">Tidak ada pengajuan layanan yang menunggu.</div> : pendingTalentServices.map((r) => <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="font-bold text-sm text-slate-900">{r.category_title}</div><div className="text-xs text-slate-600">{r.talent_name} · {r.talent_city}</div><div className="text-xs text-slate-500 mt-1">Tarif khusus: {r.custom_rate_override ? formatRupiah(r.custom_rate_override) : 'Mengikuti tarif profil'}</div><div className="text-[10px] text-slate-400">Diajukan: {new Date(r.created_at).toLocaleString('id-ID')}</div></div><div className="grid grid-cols-2 sm:flex gap-2"><button onClick={() => handleTalentServiceReview(r.id,'approved')} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Setujui</button><button onClick={() => handleTalentServiceReview(r.id,'rejected')} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">Tolak</button></div></div>)}
            </section>
            <section className="space-y-3">
              <div><h3 className="text-sm font-black text-slate-900">Layanan aktif yang dapat dinonaktifkan</h3><p className="text-xs text-slate-500">Admin dapat menonaktifkan layanan yang melanggar kebijakan. Talent tidak dapat mengaktifkannya kembali sendiri.</p></div>
              {approvedTalentServices.map((r) => <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 flex items-start sm:items-center justify-between gap-3"><div><div className="text-xs font-bold text-slate-800 break-words">{r.category_title} · {r.talent_name}</div><div className="text-[10px] text-slate-500">{r.is_active ? 'Aktif' : 'Nonaktif'} · {r.custom_rate_override ? formatRupiah(r.custom_rate_override) : 'Tarif profil'}</div></div>{r.is_active && <button onClick={() => handleTalentServiceReview(r.id,'disabled_by_admin')} className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800">Nonaktifkan</button>}</div>)}
            </section>
            <section className="space-y-2"><h3 className="text-sm font-black text-slate-900">Riwayat perubahan layanan terbaru</h3>{talentServiceHistory.length === 0 ? <p className="text-xs text-slate-500">Belum ada riwayat perubahan.</p> : talentServiceHistory.slice(0,12).map((h) => <div key={h.id} className="text-[11px] border-b border-slate-100 py-2 text-slate-600">{h.talent_name} · <b>{h.change_type}</b> · {new Date(h.created_at).toLocaleString('id-ID')}</div>)}</section>
            <section className="space-y-3">
              <div><h3 className="text-sm font-black text-slate-900">Perubahan nama tampilan Talent</h3><p className="text-xs text-slate-500">Nama tampilan hanya berubah setelah Admin menyetujui. Data legal/KTP tidak diubah melalui antrean ini.</p></div>
              {pendingIdentityChanges.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">Tidak ada permintaan perubahan nama.</div> : pendingIdentityChanges.map((r) => <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="font-bold text-sm text-slate-900">{r.talent_name}</div><div className="text-xs text-slate-600">{r.old_value || '(kosong)'} → <b>{r.requested_value}</b></div><div className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleString('id-ID')}</div></div><div className="grid grid-cols-2 sm:flex gap-2"><button onClick={() => handleIdentityChangeReview(r.id,'approved')} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Setujui</button><button onClick={() => handleIdentityChangeReview(r.id,'rejected')} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">Tolak</button></div></div>)}
            </section>
          </div>
        )}

        {activeTab === 'qris' && <QrisAdminPanel />}
        {activeTab === 'branding' && <BrandingAdminPanel />}
        {activeTab === 'hero' && <HeroSlidesAdminPanel />}
        {activeTab === 'affiliate' && <AffiliateAdminPanel />}
        {activeTab === 'admin_management' && isSuperAdmin && <AdminManagementPanel />}

        {/* Overview: ringkasan hanya untuk Super Admin */}
        {isSuperAdmin && activeTab === 'overview' && (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 px-0.5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-700">Business overview</p>
                <h2 className="mt-0.5 text-base font-black tracking-tight text-slate-900 sm:text-lg">Ringkasan Platform</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">Kondisi operasional dan transaksi YUKU.</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">Data terkini</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
              <div className="min-w-0 rounded-[26px] border border-white/90 bg-white/85 p-3.5 shadow-[0_16px_38px_-22px_rgba(76,29,149,0.22)] ring-1 ring-amber-100/80 backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-slate-500 sm:text-[10px]">Talent menunggu review</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Clock className="h-4 w-4" /></span>
                </div>
                <div className="text-2xl font-black tracking-tight text-amber-700 tabular-nums sm:text-3xl">{talents.filter((t) => !t.is_approved).length}</div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">Belum disetujui atau belum terverifikasi e-KTP.</p>
              </div>
              <div className="min-w-0 rounded-[26px] border border-white/90 bg-white/85 p-3.5 shadow-[0_16px_38px_-22px_rgba(76,29,149,0.22)] ring-1 ring-violet-100/80 backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-slate-500 sm:text-[10px]">Antrean pencairan</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><CreditCard className="h-4 w-4" /></span>
                </div>
                <div className="text-2xl font-black tracking-tight text-violet-800 tabular-nums sm:text-3xl">{payouts.filter((p) => p.payout_status === 'requested').length}</div>
                <p className="mt-1.5 break-words text-[10px] font-semibold leading-relaxed text-violet-700">Total {formatRupiah(talentPayoutsPending)}</p>
              </div>
              <div className="min-w-0 rounded-[26px] border border-white/90 bg-white/85 p-3.5 shadow-[0_16px_38px_-22px_rgba(76,29,149,0.22)] ring-1 ring-emerald-100/80 backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-slate-500 sm:text-[10px]">Pendapatan platform · 20%</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><TrendingUp className="h-4 w-4" /></span>
                </div>
                <div className="break-words text-xl font-black tracking-tight text-emerald-800 tabular-nums sm:text-2xl">{formatRupiah(platformRevenueFee)}</div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">Dari {completedBookings.length} order selesai.</p>
              </div>
              <div className="min-w-0 rounded-[26px] border border-white/90 bg-white/85 p-3.5 shadow-[0_16px_38px_-22px_rgba(76,29,149,0.22)] ring-1 ring-slate-200/80 backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-slate-500 sm:text-[10px]">Nilai transaksi · GMV</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700"><DollarSign className="h-4 w-4" /></span>
                </div>
                <div className="break-words text-xl font-black tracking-tight text-slate-900 tabular-nums sm:text-2xl">{formatRupiah(grossMarketplaceVolume)}</div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">Akumulasi transaksi di sistem escrow.</p>
              </div>
            </div>
          </section>
        )}



        {/* TAB 1: TALENT CURATION & KTP APPROVAL */}
        {activeTab === 'talents' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {[
                  { label: `Perlu Review (${talents.filter((t) => !t.is_approved).length})`, val: 'pending' },
                  { label: `Sudah Disetujui (${talents.filter((t) => t.is_approved).length})`, val: 'approved' },
                  { label: `Semua Talent (${talents.length})`, val: 'all' },
                ].map((f) => (
                  <button
                    key={f.val}
                    onClick={() => setTalentFilter(f.val as any)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      talentFilter === f.val
                        ? 'bg-purple-50 text-purple-900 border-purple-300 font-bold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama atau kota..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600 text-xs"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-purple-700 mx-auto" />
                <p className="text-xs text-slate-500">Memuat berkas profil talent dari database Supabase...</p>
              </div>
            ) : filteredTalents.length === 0 ? (
              <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center space-y-2 p-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">
                  Semua Berkas Talent Selesai Ditinjau
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Tidak ada permohonan pendaftaran Talent yang membutuhkan peninjauan saat ini.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTalents.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-5 shadow-xs hover:border-purple-200 transition-all space-y-3 sm:space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Avatar and Basic Info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-purple-50 border border-purple-200 shrink-0 relative flex items-center justify-center">
                          {t.avatar_url ? (
                            <img src={t.avatar_url} alt={t.display_name} className="w-full h-full object-contain" />
                          ) : (
                            <User className="w-8 h-8 text-purple-400" />
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <h3 className="text-sm sm:text-base font-black text-slate-900 break-words">{t.display_name}</h3>
                            <span className="text-xs text-slate-400">({t.gender}, {t.city})</span>
                            {t.is_approved ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                                Tayang di Katalog
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                                Menunggu Review
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-purple-700 font-semibold line-clamp-1">{t.headline}</p>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Email: <strong>{t.email || '-'}</strong> • Tarif: <strong>{formatRupiah(t.hourly_rate)}/jam</strong>
                          </div>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2">
                        {t.ktp_verification_status === 'verified' ? (
                          <span className="px-2.5 py-1 bg-purple-100 text-purple-900 text-xs font-bold rounded-lg flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>KTP 18+ Sah</span>
                          </span>
                        ) : t.ktp_verification_status === 'pending_review' ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-lg flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>KTP Menunggu Verifikasi</span>
                          </span>
                        ) : t.ktp_verification_status === 'rejected' ? (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>KTP Ditolak</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">
                            KTP Belum Diunggah
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bio & Details Box */}
                    <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
                      <div><strong>Nama Legal KTP:</strong> {t.full_legal_name || t.display_name}</div>
                      <div><strong>Tanggal Lahir:</strong> {t.date_of_birth || '-'}</div>
                      <div><strong>Nomor e-KTP:</strong> {t.ktp_number ? <span className="font-mono">{t.ktp_number}</span> : 'Belum diisi saat pendaftaran'}</div>
                      {t.emergency_contact_phone && <div><strong>Kontak Darurat / WA:</strong> {t.emergency_contact_phone}</div>}
                      {t.bio && <div className="pt-1 text-slate-500 italic line-clamp-2">"{t.bio}"</div>}
                    </div>

                    {/* Curation Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedKtpItem(t)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat Berkas KTP Lengkap</span>
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleRejectTalent(t)}
                          disabled={isSubmittingAction}
                          className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Tolak Berkas
                        </button>

                        <button
                          onClick={() => handleApproveTalent(t)}
                          disabled={isSubmittingAction || t.is_approved}
                          className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t.is_approved ? 'Sudah Aktif di Katalog' : 'Setujui & Terbitkan Profil'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PAYOUT REQUESTS APPROVAL */}
        {activeTab === 'payouts' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {[
                  { label: `Menunggu Transfer (${payouts.filter((p) => p.payout_status === 'requested').length})`, val: 'requested' },
                  { label: `Diproses (${payouts.filter((p) => p.payout_status === 'processing').length})`, val: 'processing' },
                  {
                    label: `Berhasil Ditransfer (${payouts.filter((p) => p.payout_status === 'completed_provider_confirmed').length})`,
                    val: 'completed_provider_confirmed',
                  },
                  { label: `Ditolak (${payouts.filter((p) => p.payout_status === 'rejected').length})`, val: 'rejected' },
                  { label: `Gagal (${payouts.filter((p) => p.payout_status === 'failed').length})`, val: 'failed' },
                  { label: `Semua (${payouts.length})`, val: 'all' },
                ].map((f) => (
                  <button
                    key={f.val}
                    onClick={() => setPayoutFilter(f.val as any)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      payoutFilter === f.val
                        ? 'bg-purple-50 text-purple-900 border-purple-300 font-bold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredPayouts.length === 0 ? (
              <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center space-y-2 p-6">
                <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">Tidak Ada Antrian Pencairan Saldo</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Semua permohonan penarikan dana Talent pada kategori ini telah selesai diproses.
                </p>
              </div>
            ) : (
              <>
              <div className="sm:hidden space-y-3">
                {filteredPayouts.map((p) => (
                  <article key={p.id} className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-black text-purple-900 break-all">{p.payout_number}</p>
                        <p className="mt-1 text-sm font-bold text-slate-900 break-words">{p.talent_name}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold ${
                        p.payout_status === 'completed_provider_confirmed' ? 'bg-emerald-100 text-emerald-800' :
                        p.payout_status === 'processing' ? 'bg-purple-100 text-purple-900' :
                        p.payout_status === 'rejected' || p.payout_status === 'failed' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {p.payout_status === 'completed_provider_confirmed' ? 'Selesai Ditransfer' :
                         p.payout_status === 'processing' ? 'Sedang Diproses' :
                         p.payout_status === 'rejected' ? 'Ditolak' :
                         p.payout_status === 'failed' ? 'Gagal Ditransfer' : 'Menunggu Transfer'}
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 space-y-2 text-xs">
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Bank / E-Wallet</span><strong className="text-slate-800 text-right">{p.bank_name}</strong></div>
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Nomor Rekening</span><strong className="font-mono text-slate-800 text-right break-all">{p.bank_account_number}</strong></div>
                      <div className="flex justify-between gap-3"><span className="text-slate-500">Atas Nama</span><strong className="text-slate-800 text-right break-words">{p.bank_account_holder_name}</strong></div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                      <span className="text-xs text-slate-500">Nominal Transfer</span>
                      <strong className="text-base text-slate-900 tabular-nums">{formatRupiah(p.amount)}</strong>
                    </div>
                    {p.payout_status === 'requested' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleProcessPayout(p.id, 'rejected')} disabled={isSubmittingAction} className="py-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold disabled:opacity-50">Tolak</button>
                        <button onClick={() => handleProcessPayout(p.id, 'processing')} disabled={isSubmittingAction} className="py-2.5 bg-purple-700 text-white rounded-lg text-xs font-bold disabled:opacity-50">Mulai Proses</button>
                      </div>
                    )}
                    {p.payout_status === 'processing' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleProcessPayout(p.id, 'rejected')} disabled={isSubmittingAction} className="py-2.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold disabled:opacity-50">Tolak</button>
                        <button onClick={() => handleProcessPayout(p.id, 'completed_provider_confirmed')} disabled={isSubmittingAction} className="py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">Konfirmasi Transfer</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <div className="hidden sm:block bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[720px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <tr>
                        <th className="p-3.5">Nomor Payout</th>
                        <th className="p-3.5">Talent Penerima</th>
                        <th className="p-3.5">Bank / E-Wallet Tujuan</th>
                        <th className="p-3.5">Nomor Rekening</th>
                        <th className="p-3.5">Atas Nama</th>
                        <th className="p-3.5">Nominal Transfer</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Tindakan Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPayouts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="p-3.5 font-mono font-bold text-purple-900">{p.payout_number}</td>
                          <td className="p-3.5 font-semibold text-slate-900">{p.talent_name}</td>
                          <td className="p-3.5 font-semibold text-purple-950">{p.bank_name}</td>
                          <td className="p-3.5 font-mono text-slate-700">{p.bank_account_number}</td>
                          <td className="p-3.5 text-slate-700 font-medium">{p.bank_account_holder_name}</td>
                          <td className="p-3.5 font-black text-slate-900 tabular-nums">{formatRupiah(p.amount)}</td>
                          <td className="p-3.5">
                            {p.payout_status === 'completed_provider_confirmed' ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                                Selesai Ditransfer
                              </span>
                            ) : p.payout_status === 'processing' ? (
                              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[11px] font-bold">
                                Sedang Diproses
                              </span>
                            ) : p.payout_status === 'rejected' ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                                Ditolak
                              </span>
                            ) : p.payout_status === 'failed' ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                                Gagal Ditransfer
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                                Menunggu Transfer
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            {p.payout_status === 'requested' && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleProcessPayout(p.id, 'rejected')}
                                  disabled={isSubmittingAction}
                                  className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-xs font-semibold cursor-pointer"
                                >
                                  Tolak
                                </button>
                                <button
                                  onClick={() => handleProcessPayout(p.id, 'processing')}
                                  disabled={isSubmittingAction}
                                  className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-bold cursor-pointer"
                                >
                                  Mulai Proses
                                </button>
                              </div>
                            )}
                            {p.payout_status === 'processing' && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleProcessPayout(p.id, 'rejected')}
                                  disabled={isSubmittingAction}
                                  className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-xs font-semibold cursor-pointer"
                                >
                                  Tolak
                                </button>
                                <button
                                  onClick={() => handleProcessPayout(p.id, 'completed_provider_confirmed')}
                                  disabled={isSubmittingAction}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer"
                                >
                                  Konfirmasi Transfer
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              </>
            )}
          </div>
        )}

        {/* TAB: REFUND REQUESTS */}
        {activeTab === 'refunds' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
              Refund saat ini diproses manual di dashboard provider/bank. Tandai selesai hanya setelah dana benar-benar dikembalikan dan referensinya tersedia.
            </div>
            <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
              <div className="p-4 border-b border-amber-100">
                <h3 className="text-sm font-bold text-slate-900">Sisa Dana Menunggu Keputusan Admin</h3>
                <p className="text-xs text-slate-500 mt-1">Dana ini bukan pendapatan YUKU dan bukan saldo Talent. Jangan dicairkan sebelum keputusan dan jurnal penyesuaian tersedia.</p>
              </div>
              {customerCancellationCases.filter((c) => c.status === 'pending_admin_review').length === 0 ? (
                <div className="p-4 text-xs text-slate-500">Tidak ada sisa dana yang menunggu peninjauan.</div>
              ) : (
                <>
                <div className="sm:hidden p-3 space-y-3">
                  {customerCancellationCases.filter((c) => c.status === 'pending_admin_review').map((c) => (
                    <article key={c.id} className="rounded-xl border border-amber-200 p-3 space-y-3">
                      <div><p className="font-mono text-xs font-bold text-purple-900">{c.booking_code}</p><p className="text-sm font-semibold text-slate-900">{c.customer_name}</p><p className="text-[11px] text-slate-500">{c.policy_code === '6_to_24h' ? 'Pembatalan 6–24 jam' : 'Pembatalan kurang dari 6 jam'}</p></div>
                      <div className="bg-amber-50 rounded-lg p-2.5 space-y-2 text-xs">
                        <div className="flex justify-between gap-2"><span>Refund Customer</span><strong>{formatRupiah(Number(c.automatic_refund_amount))}</strong></div>
                        <div className="flex justify-between gap-2"><span>Ditahan untuk Admin</span><strong className="text-amber-800">{formatRupiah(Number(c.retained_pending_admin_amount))}</strong></div>
                        <div className="text-[10px] text-slate-600">Batas penahanan: {c.admin_hold_until ? new Date(c.admin_hold_until).toLocaleString('id-ID') : 'Belum diperpanjang'}</div>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <button disabled={isSubmittingAction} onClick={() => handleResolveCancellationCase(c, 'refund_customer')} className="py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50">Refund Customer</button>
                        <button disabled={isSubmittingAction} onClick={() => handleResolveCancellationCase(c, 'compensate_talent')} className="py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">Kompensasi Talent</button>
                        <button disabled={isSubmittingAction} onClick={() => handleResolveCancellationCase(c, 'extend_hold')} className="py-2.5 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-50">Perpanjang Tahan</button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-amber-50 text-slate-500"><tr><th className="p-3">Booking</th><th className="p-3">Customer</th><th className="p-3">Aturan</th><th className="p-3">Refund Customer</th><th className="p-3">Ditahan untuk Admin</th><th className="p-3">Batas Penahanan</th><th className="p-3">Keputusan Admin</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerCancellationCases.filter((c) => c.status === 'pending_admin_review').map((c) => (
                        <tr key={c.id}>
                          <td className="p-3 font-mono font-semibold">{c.booking_code}</td>
                          <td className="p-3">{c.customer_name}</td>
                          <td className="p-3">{c.policy_code === '6_to_24h' ? 'Pembatalan 6–24 jam' : 'Pembatalan kurang dari 6 jam'}</td>
                          <td className="p-3 tabular-nums">{formatRupiah(Number(c.automatic_refund_amount))}</td>
                          <td className="p-3 font-bold tabular-nums text-amber-800">{formatRupiah(Number(c.retained_pending_admin_amount))}</td>
                          <td className="p-3 text-slate-600">{c.admin_hold_until ? new Date(c.admin_hold_until).toLocaleString('id-ID') : 'Belum diperpanjang'}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-2">
                              <button disabled={isSubmittingAction} onClick={() => handleResolveCancellationCase(c, 'refund_customer')} className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">Refund Customer</button>
                              <button disabled={isSubmittingAction} onClick={() => handleResolveCancellationCase(c, 'compensate_talent')} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50">Kompensasi Talent</button>
                              <button disabled={isSubmittingAction} onClick={() => handleResolveCancellationCase(c, 'extend_hold')} className="px-2.5 py-1.5 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-50">Perpanjang Tahan</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
            {refunds.length === 0 ? (
              <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-500">Belum ada permintaan refund.</div>
            ) : (
              <>
              <div className="sm:hidden p-3 space-y-3">
                {refunds.map((refund) => (
                  <article key={refund.id} className="rounded-xl border border-slate-200 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="font-mono text-xs font-bold text-purple-900 break-all">{refund.booking_code}</p><p className="mt-1 text-sm font-semibold text-slate-900">{refund.customer_name}</p></div>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold ${refund.status === 'processed' ? 'bg-emerald-100 text-emerald-800' : refund.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{refund.status === 'processed' ? 'Selesai' : refund.status === 'rejected' ? 'Ditolak' : 'Menunggu Proses'}</span>
                    </div>
                    <div className="text-base font-black text-slate-900">{formatRupiah(Number(refund.refund_amount))}</div>
                    <p className="text-xs text-slate-600 break-words">{refund.reason}</p>
                    {refund.provider_refund_id && <p className="text-[10px] text-slate-500 break-all">Referensi: {refund.provider_refund_id}</p>}
                    {(refund.status === 'requested' || refund.status === 'approved') && <button onClick={() => handleProcessRefund(refund.id)} disabled={isSubmittingAction} className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">Konfirmasi Refund</button>}
                  </article>
                ))}
              </div>
              <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="p-3">Booking</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Nominal Refund</th>
                      <th className="p-3">Alasan</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {refunds.map((refund) => (
                      <tr key={refund.id}>
                        <td className="p-3 font-mono font-semibold text-purple-900">{refund.booking_code}</td>
                        <td className="p-3 font-semibold">{refund.customer_name}</td>
                        <td className="p-3 font-bold tabular-nums">{formatRupiah(Number(refund.refund_amount))}</td>
                        <td className="p-3 max-w-xs whitespace-normal">{refund.reason}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${refund.status === 'processed' ? 'bg-emerald-100 text-emerald-800' : refund.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                            {refund.status === 'processed' ? 'Selesai' : refund.status === 'rejected' ? 'Ditolak' : 'Menunggu Proses'}
                          </span>
                          {refund.provider_refund_id && <div className="mt-1 text-[10px] text-slate-500">Ref: {refund.provider_refund_id}</div>}
                        </td>
                        <td className="p-3 text-right">
                          {(refund.status === 'requested' || refund.status === 'approved') && (
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => handleProcessRefund(refund.id)} disabled={isSubmittingAction} className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold">Konfirmasi Refund</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: BOOKINGS & ESCROW AUDIT */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
              <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                <h3 className="text-sm font-bold text-slate-900">Seluruh Transaksi Booking Platform YUKU</h3>
                <span className="text-xs text-slate-500">Total: {bookings.length} Transaksi</span>
              </div>

              <div className="sm:hidden divide-y divide-slate-100">
                {bookings.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">Belum ada transaksi booking.</div>
                ) : bookings.map((b) => (
                  <article key={b.id} className="p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-black text-purple-900 break-all">{b.booking_code}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{new Date(b.created_at).toLocaleString('id-ID')}</p>
                      </div>
                      <div className="shrink-0">
                        {b.status === 'completed' ? (
                          <span className="inline-block px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Selesai</span>
                        ) : b.status === 'confirmed' ? (
                          <span className="inline-block px-2 py-1 rounded-full bg-purple-100 text-purple-900 text-[10px] font-bold">Terkonfirmasi</span>
                        ) : b.status === 'cancelled' ? (
                          <span className="inline-block px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">Dibatalkan</span>
                        ) : (
                          <span className="inline-block px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">Menunggu Bayar</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 p-2 min-w-0">
                        <p className="text-[10px] text-slate-500">Customer</p>
                        <p className="font-semibold text-slate-800 break-words">{b.customer_name}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 min-w-0">
                        <p className="text-[10px] text-slate-500">Talent</p>
                        <p className="font-semibold text-purple-900 break-words">{b.talent_name}</p>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      <span className="text-slate-500">Lokasi:</span> {b.meeting_location_name || '-'}
                    </div>
                    {isSuperAdmin && (
                      <div className="rounded-lg border border-slate-100 p-2.5 grid grid-cols-1 gap-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500">Total Bayar</span><strong className="text-slate-900 tabular-nums">{formatRupiah(b.gross_amount || 0)}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500">Fee YUKU (20%)</span><strong className="text-emerald-700 tabular-nums">{formatRupiah(b.platform_fee_amount || 0)}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500">Bagian Talent (80%)</span><strong className="text-purple-700 tabular-nums">{formatRupiah(b.talent_gross_share || 0)}</strong>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[720px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="p-3.5">Kode Booking</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Talent</th>
                      <th className="p-3.5">Lokasi Publik</th>
{isSuperAdmin && (
                        <>
                          <th className="p-3.5">Total Bayar</th>
                          <th className="p-3.5">Fee YUKU (20%)</th>
                          <th className="p-3.5">Share Talent (80%)</th>
                        </>
                      )}
                      <th className="p-3.5">Status Escrow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/60">
                        <td className="p-3.5 font-mono font-bold text-purple-900">{b.booking_code}</td>
                        <td className="p-3.5 font-semibold text-slate-900">{b.customer_name}</td>
                        <td className="p-3.5 font-semibold text-purple-950">{b.talent_name}</td>
                        <td className="p-3.5 text-slate-600 max-w-[180px] truncate">{b.meeting_location_name}</td>
{isSuperAdmin && (
                          <>
                            <td className="p-3.5 font-bold text-slate-900 tabular-nums">{formatRupiah(b.gross_amount || 0)}</td>
                            <td className="p-3.5 font-bold text-emerald-700 tabular-nums">{formatRupiah(b.platform_fee_amount || 0)}</td>
                            <td className="p-3.5 font-bold text-purple-700 tabular-nums">{formatRupiah(b.talent_gross_share || 0)}</td>
                          </>
                        )}
                        <td className="p-3.5">
                          {b.status === 'completed' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                              Selesai (Released)
                            </span>
                          ) : b.status === 'confirmed' ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[11px] font-bold">
                              Terkonfirmasi (Held)
                            </span>
                          ) : b.status === 'cancelled' ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                              Dibatalkan
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                              Menunggu Pembayaran
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CUSTOMER KTP VERIFICATION */}
        {activeTab === 'customer_ktp' && (
          <div className="space-y-4">
            {customerKtps.length === 0 ? (
              <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center space-y-2 p-6">
                <FileCheck className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">Belum Ada Pengajuan KTP Customer</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Pengajuan verifikasi e-KTP dari akun Customer akan tampil di sini untuk ditinjau.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customerKtps.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-5 shadow-xs space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-slate-900 break-words">{c.full_legal_name}</h3>
                        <p className="text-[11px] text-slate-500 break-words leading-relaxed">
                          Email: <strong>{c.email || '-'}</strong> • Tanggal Lahir: <strong>{c.date_of_birth}</strong>
                        </p>
                      </div>

                      <div>
                        {c.ktp_verification_status === 'verified' ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                            Terverifikasi 18+
                          </span>
                        ) : c.ktp_verification_status === 'pending_review' ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg">
                            Menunggu Review
                          </span>
                        ) : c.ktp_verification_status === 'rejected' ? (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg">
                            Ditolak
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg">
                            Belum Lengkap
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-2 break-words">
                      <div>
                        <strong>NIK e-KTP:</strong>{' '}
                        <span className="font-mono">{c.ktp_number || '-'}</span>
                      </div>
                      <div>
                        <strong>WhatsApp / Darurat:</strong> {c.emergency_contact_phone || '-'}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className={c.ktp_storage_path ? "text-slate-500" : "text-rose-700"}>
                          {c.ktp_storage_path ? 'Dokumen KTP tersimpan secara privat.' : 'Foto KTP belum tercatat.'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleViewCustomerKtp(c)}
                          disabled={loadingCustomerKtpId === c.id}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-indigo-50 text-indigo-800 font-bold text-xs hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {loadingCustomerKtpId === c.id ? 'Membuka foto...' : 'Lihat Foto KTP'}
                        </button>
                      </div>
                      {c.ktp_rejection_reason && (
                        <div className="text-rose-700">
                          <strong>Alasan Penolakan:</strong> {c.ktp_rejection_reason}
                        </div>
                      )}
                    </div>

                    {c.ktp_verification_status === 'pending_review' && (
                      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleReviewCustomerKtp(c, 'rejected')}
                          disabled={isSubmittingAction}
                          className="w-full sm:w-auto px-3.5 py-2.5 sm:py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Tolak KTP
                        </button>
                        <button
                          onClick={() => handleReviewCustomerKtp(c, 'verified')}
                          disabled={isSubmittingAction}
                          className="w-full sm:w-auto justify-center px-4 py-2.5 sm:py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Setujui KTP 18+</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: INCIDENT REPORTS & DISPUTE MODERATION */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { label: `Menunggu Tinjauan (${reports.filter((r) => r.status === 'open').length})`, val: 'open' },
                { label: `Diinvestigasi (${reports.filter((r) => r.status === 'investigating').length})`, val: 'investigating' },
                { label: `Ditindaklanjuti (${reports.filter((r) => r.status === 'resolved_action_taken').length})`, val: 'resolved_action_taken' },
                { label: `Ditutup (${reports.filter((r) => r.status === 'dismissed').length})`, val: 'dismissed' },
                { label: `Semua (${reports.length})`, val: 'all' },
              ].map((f) => (
                <button
                  key={f.val}
                  onClick={() => setReportFilter(f.val as 'all' | ReportStatus)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                    reportFilter === f.val
                      ? 'bg-purple-50 text-purple-900 border-purple-300 font-bold'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredReports.length === 0 ? (
              <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center space-y-2 p-6">
                <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">Tidak Ada Laporan Insiden</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Belum ada laporan pelanggaran atau sengketa transaksi pada kategori ini.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((rep) => {
                  const statusMeta = getReportStatusMeta(rep.status);
                  return (
                    <div
                      key={rep.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-5 shadow-xs space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black text-slate-900">
                              {getReportCategoryLabel(rep.category)}
                            </span>
                            {rep.booking_code && (
                              <span className="font-mono text-[11px] font-bold bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 rounded">
                                {rep.booking_code}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 break-words leading-relaxed">
                            Pelapor: <strong className="text-slate-700">{rep.reporter_name}</strong> • Terlapor:{' '}
                            <strong className="text-rose-700">{rep.reported_user_name}</strong> •{' '}
                            {new Date(rep.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusMeta.badgeClass}`}>
                          {statusMeta.label}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-100 break-words">
                        {rep.description}
                      </p>

                      {rep.admin_notes && (
                        <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-xs text-purple-950">
                          <strong>Catatan Penanganan Admin:</strong> {rep.admin_notes}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => openReportModerationModal(rep)}
                          className="w-full sm:w-auto px-4 py-2.5 sm:py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                        >
                          Tinjau & Ubah Status
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'community_moderation' && <CommunityModerationPanel />}

        {/* TAB 6: BANNER PROMOSI HALAMAN JELAJAH */}
        {activeTab === 'promos' && (
          <div className="space-y-6">
            {promoMigrationMissing && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Pengelolaan Banner Jelajah belum aktif di Supabase:</strong> Jalankan file migrasi{' '}
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">
                    supabase/migrations/15_promotions.sql
                  </code>{' '}
                  di SQL Editor Supabase untuk mengaktifkan unggahan banner Jelajah.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Upload khusus Banner Jelajah */}
              <form
                onSubmit={handleUploadPromoPoster}
                className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 text-xs"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Upload Banner Jelajah
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload khusus banner halaman Jelajah. Gunakan rasio 16:5 (disarankan 1600 × 500 px, minimal lebar 1200 px). Sistem memeriksa ukuran gambar sebelum upload agar banner konsisten di HP dan desktop tanpa terpotong.
                  </p>
                </div>

                {/* Image File Picker + Live Preview */}
                <div className="space-y-2">
                  <label htmlFor="promo-file-upload" className="block font-bold text-slate-700">
                    Pilih Gambar Banner (JPG / PNG / WebP, maks. 5 MB) *
                  </label>
                  <label
                    htmlFor="promo-file-upload"
                    className="block rounded-xl border border-dashed border-purple-300 bg-purple-50/40 hover:bg-purple-50 p-4 text-center cursor-pointer transition-colors"
                  >
                    <Upload className="w-5 h-5 text-purple-700 mx-auto mb-1.5" />
                    <span className="font-bold text-purple-900 block">
                      {promoFile ? promoFile.name : 'Klik untuk memilih gambar dari perangkat'}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Rasio wajib 16:5 · contoh 1600 × 500 px · minimal lebar 1200 px
                    </span>
                  </label>
                  <input
                    id="promo-file-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handlePromoFileChange(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                </div>

                {promoPreviewUrl && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Preview Banner Jelajah (rasio 16:5)
                    </span>
                    <div className="w-full aspect-[16/5] rounded-xl overflow-hidden border border-slate-200 bg-purple-950">
                      <img
                        src={promoPreviewUrl}
                        alt="Pratinjau poster promosi"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}


                <div>
                  <label htmlFor="promo-title" className="block font-bold text-slate-700 mb-1">
                    Judul / Keterangan Poster (Opsional)
                  </label>
                  <input
                    id="promo-title"
                    type="text"
                    maxLength={150}
                    placeholder="Contoh: Promo Akhir Pekan Bebas Biaya Admin"
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="promo-link" className="block font-bold text-slate-700 mb-1">
                      Tautan Saat Diklik (Opsional)
                    </label>
                    <input
                      id="promo-link"
                      type="text"
                      placeholder="/talent atau https://..."
                      value={promoTargetLink}
                      onChange={(e) => setPromoTargetLink(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="promo-order" className="block font-bold text-slate-700 mb-1">
                      Urutan
                    </label>
                    <input
                      id="promo-order"
                      type="number"
                      min={0}
                      value={promoSortOrder}
                      onChange={(e) => setPromoSortOrder(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600 tabular-nums"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUploadingPromo || !promoFile}
                  className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl shadow-xs transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUploadingPromo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengunggah Banner...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4" />
                      <span>Terbitkan Banner ke Jelajah</span>
                    </>
                  )}
                </button>
              </form>

              {/* Existing Posters List */}
              <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Daftar Banner Jelajah ({promoPosters.length})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Atur urutan slide, sembunyikan sementara, atau hapus banner Jelajah.
                    </p>
                  </div>
                </div>

                {promoPosters.length === 0 ? (
                  <div className="py-12 px-4 rounded-xl bg-slate-50 border border-slate-200/70 text-center space-y-1.5">
                    <Megaphone className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-sm font-bold text-slate-700">Belum Ada Banner Jelajah</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Upload banner pertama melalui formulir khusus di sebelah kiri untuk menampilkannya di halaman Jelajah.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {promoPosters.map((poster) => (
                      <div
                        key={poster.id}
                        className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-3"
                      >
                        <div className="w-full aspect-[16/5] rounded-lg overflow-hidden border border-slate-200 bg-purple-950">
                          <img
                            src={poster.image_url}
                            alt={poster.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-bold text-slate-900 truncate">{poster.title}</div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span className="font-mono tabular-nums">Urutan: {poster.sort_order}</span>
                              <span aria-hidden="true">·</span>
                              <span className={poster.is_active ? 'text-emerald-700 font-semibold' : 'text-slate-500 font-semibold'}>
                                {poster.is_active ? 'Tayang di Jelajah' : 'Disembunyikan'}
                              </span>
                              {poster.link_url && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono truncate max-w-[180px]">{poster.link_url}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleShiftPromoOrder(poster, -1)}
                              disabled={isSubmittingAction || poster.sort_order <= 0}
                              aria-label="Naikkan prioritas urutan"
                              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg cursor-pointer disabled:opacity-40"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShiftPromoOrder(poster, 1)}
                              disabled={isSubmittingAction}
                              aria-label="Turunkan prioritas urutan"
                              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg cursor-pointer disabled:opacity-40"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTogglePromoActive(poster)}
                              disabled={isSubmittingAction}
                              className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                                poster.is_active
                                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                  : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                              }`}
                            >
                              {poster.is_active ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span>Sembunyikan</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Tayangkan</span>
                                </>
                              )}
                            </button>

                            {confirmDeletePromoId === poster.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeletePromoPoster(poster)}
                                  disabled={isSubmittingAction}
                                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer whitespace-nowrap"
                                >
                                  Yakin Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePromoId(null)}
                                  disabled={isSubmittingAction}
                                  className="px-2 py-1.5 bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePromoId(poster.id)}
                                disabled={isSubmittingAction}
                                aria-label="Hapus poster promosi"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: VIEW KTP DETAILS & VERIFICATION */}
      <Modal
        isOpen={Boolean(selectedKtpItem)}
        onClose={() => setSelectedKtpItem(null)}
        title={`Peninjauan Dokumen KTP — ${selectedKtpItem?.display_name}`}
      >
        {selectedKtpItem && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Lengkap (sesuai KTP):</span>
                <span className="font-bold text-slate-900">{selectedKtpItem.full_legal_name || selectedKtpItem.display_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tanggal Lahir:</span>
                <span className="font-semibold text-slate-800">{selectedKtpItem.date_of_birth || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor NIK e-KTP:</span>
                <span className="font-mono font-bold text-purple-900">{selectedKtpItem.ktp_number || 'Belum diisi'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Verifikasi Saat Ini:</span>
                <span className="font-bold text-purple-700">{selectedKtpItem.ktp_verification_status || 'unsubmitted'}</span>
              </div>
              {selectedKtpItem.ktp_storage_path && (
                <div className="flex justify-between">
                  <span className="text-slate-500">File Storage:</span>
                  <span className="font-mono text-[11px] text-slate-600 truncate max-w-[200px]">
                    {selectedKtpItem.ktp_storage_path}
                  </span>
                </div>
              )}
            </div>

            {selectedKtpItem.ktp_storage_path ? (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                <div className="font-bold text-purple-900 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-purple-700" />
                  <span>Dokumen e-KTP Privat Terlampir</span>
                </div>
                <p className="text-[11px] text-purple-800">
                  Berkas foto e-KTP tersimpan secara privat. Admin dapat membuka foto untuk memeriksa kecocokan identitas.
                </p>
                <button
                  type="button"
                  onClick={() => handleViewCustomerKtp({
                    id: selectedKtpItem.id,
                    ktp_storage_path: selectedKtpItem.ktp_storage_path || null,
                    full_legal_name: selectedKtpItem.full_legal_name,
                    display_name: selectedKtpItem.display_name,
                  })}
                  disabled={loadingCustomerKtpId === selectedKtpItem.id}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-indigo-700 text-white font-bold text-xs hover:bg-indigo-800 disabled:opacity-50"
                >
                  {loadingCustomerKtpId === selectedKtpItem.id ? 'Membuka foto...' : 'Lihat Foto KTP Talent'}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">
                Talent belum mengunggah berkas foto fisik e-KTP saat pendaftaran awal. Anda tetap dapat menyetujui profil jika verifikasi identitas dilakukan via wawancara / kontak darurat resmi.
              </div>
            )}

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedKtpItem(null)}
                className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => handleRejectTalent(selectedKtpItem)}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg cursor-pointer"
              >
                Tolak Berkas
              </button>
              <button
                type="button"
                onClick={() => handleApproveTalent(selectedKtpItem)}
                disabled={isSubmittingAction || selectedKtpItem.is_approved}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{selectedKtpItem.is_approved ? 'Sudah Disetujui' : 'Setujui & Verifikasi 18+'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {selectedCustomerKtpImage && (
        <div className="fixed inset-0 z-[120] bg-black/80 p-3 sm:p-6 flex items-center justify-center" onClick={() => setSelectedCustomerKtpImage(null)}>
          <div className="w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 p-3 sm:p-4 border-b border-slate-200">
              <div className="min-w-0">
                <h3 className="font-black text-sm text-slate-900">Foto e-KTP Pengguna</h3>
                <p className="text-xs text-slate-500 truncate">{selectedCustomerKtpImage.name}</p>
              </div>
              <button type="button" onClick={() => setSelectedCustomerKtpImage(null)} className="shrink-0 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">Tutup</button>
            </div>
            <div className="p-2 sm:p-4 overflow-auto flex items-center justify-center bg-slate-100">
              <img src={selectedCustomerKtpImage.url} alt={`Foto e-KTP ${selectedCustomerKtpImage.name}`} className="max-w-full max-h-[76vh] object-contain rounded-lg" />
            </div>
            <p className="px-3 py-2 text-[10px] text-slate-500 text-center">Dokumen rahasia. Tautan foto hanya berlaku sementara dan hanya dapat dibuat oleh Admin berwenang.</p>
          </div>
        </div>
      )}

      {/* MODAL: MODERASI LAPORAN INSIDEN */}
      <Modal
        isOpen={Boolean(selectedReportItem)}
        onClose={() => !isSubmittingAction && setSelectedReportItem(null)}
        title="Penanganan Laporan Insiden"
      >
        {selectedReportItem && (
          <form onSubmit={handleResolveReport} className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="font-bold text-slate-900">
                {getReportCategoryLabel(selectedReportItem.category)}
              </div>
              <div className="text-[11px] text-slate-500">
                Pelapor: <strong>{selectedReportItem.reporter_name}</strong> → Terlapor:{' '}
                <strong className="text-rose-700">{selectedReportItem.reported_user_name}</strong>
              </div>
              {selectedReportItem.booking_code && (
                <div className="text-[11px] text-purple-900 font-mono font-bold">
                  Booking: {selectedReportItem.booking_code} ({selectedReportItem.booking_status || '-'})
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-report-status" className="block font-bold text-slate-800">
                Status Penanganan *
              </label>
              <select
                id="admin-report-status"
                value={reportDecision}
                onChange={(e) => setReportDecision(e.target.value as ReportStatus)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 font-semibold"
              >
                <option value="open">Menunggu Tinjauan (Open)</option>
                <option value="investigating">Sedang Diinvestigasi (Investigating)</option>
                <option value="resolved_action_taken">Ditindaklanjuti (Resolved)</option>
                <option value="dismissed">Ditutup / Tidak Terbukti (Dismissed)</option>
              </select>
            </div>

            {selectedReportItem.booking_id && (
              <label className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={holdBookingOnDispute}
                  onChange={(e) => setHoldBookingOnDispute(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-purple-700"
                />
                <span className="text-[11px] text-amber-900">
                  <strong>Tahan Escrow Booking (Disputed Hold):</strong> Ubah status booking aktif menjadi <code>disputed_hold</code> selama investigasi berlangsung.
                </span>
              </label>
            )}

            <div className="space-y-1.5">
              <label htmlFor="admin-report-notes" className="block font-bold text-slate-800">
                Catatan Keputusan Admin (Terlihat oleh Pelapor)
              </label>
              <textarea
                id="admin-report-notes"
                rows={3}
                value={reportAdminNotes}
                onChange={(e) => setReportAdminNotes(e.target.value)}
                placeholder="Tuliskan hasil investigasi atau langkah tindak lanjut dari Tim Keamanan YUKU..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedReportItem(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingAction}
                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Keputusan</span>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
