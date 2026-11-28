import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatRupiah } from '../../utils/formatters';

type Props = {
  bookingId: string;
  amount: number;
  bookingStatus: string;
  paymentRoute?: string | null;
  onRouteClaimed?: (route: 'manual_qris') => void;
  expiresAt?: string;
};

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
const EXT_TO_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], 'bukti.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

async function prepareProofFile(original: File): Promise<File> {
  const nameExt = original.name.includes('.')
    ? original.name.split('.').pop()!.toLowerCase()
    : '';
  const ext = EXT_TO_TYPE[nameExt] ? nameExt : TYPE_TO_EXT[original.type] || '';

  if (!ext) {
    throw new Error('Format file harus JPG, PNG, WebP, atau PDF.');
  }

  const buffer = await original.arrayBuffer();
  let file = new File([buffer], `bukti.${ext}`, { type: EXT_TO_TYPE[ext] });

  if (ext !== 'pdf' && file.size > 1.5 * 1024 * 1024) {
    file = await compressImage(file);
  }

  if (file.size > MAX_PROOF_BYTES) {
    throw new Error('Ukuran bukti maksimal 5 MB.');
  }

  return file;
}

export const QrisCustomerPaymentPanel: React.FC<Props> = ({
  bookingId,
  amount,
  bookingStatus,
  paymentRoute,
  onRouteClaimed,
  expiresAt,
}) => {
  const [now, setNow] = useState(Date.now());
  const [settings, setSettings] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [isLoadingPaymentData, setIsLoadingPaymentData] = useState(true);
  const [paymentDataError, setPaymentDataError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = expiresAt
    ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000))
    : null;

  const countdown =
    left === null
      ? ''
      : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const db = supabase as any;

      try {
        const [configRes, proofRes] = await Promise.all([
          db.from('qris_payment_settings')
            .select('is_active,image_path,merchant_name,instructions')
            .eq('id', true)
            .maybeSingle(),

          db.from('qris_payment_submissions')
            .select('status,admin_notes,created_at')
            .eq('booking_id', bookingId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (configRes.error) {
          throw new Error(`Gagal memuat pengaturan QRIS: ${configRes.error.message}`);
        }
        if (proofRes.error) {
          throw new Error(`Gagal memuat status bukti pembayaran: ${proofRes.error.message}`);
        }

        if (alive) {
          setSettings(configRes.data);
          setSubmission(proofRes.data);
          setPaymentDataError('');
        }
      } catch (err: any) {
        if (alive) {
          setPaymentDataError(err?.message || 'Status pembayaran QRIS tidak dapat dimuat. Coba muat ulang halaman.');
        }
      } finally {
        if (alive) setIsLoadingPaymentData(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [bookingId]);

  const imageUrl = settings?.image_path
    ? supabase.storage.from('qris-payment-display')
        .getPublicUrl(settings.image_path).data.publicUrl
    : '';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const selectedFile = input.files?.[0] || null;

    if (!selectedFile) return;

    setError('');
    setSuccess('');
    setBusy(true);

    try {
      const prepared = await prepareProofFile(selectedFile);
      setFile(prepared);
    } catch (err: any) {
      setFile(null);
      setError(err?.message || 'File tidak bisa dibaca. Coba pilih file lain.');
    } finally {
      setBusy(false);
      input.value = '';
    }
  };

  const submit = async () => {
    if (left !== null && left <= 0) {
      setError('Waktu pembayaran sudah habis. Buat booking baru untuk melanjutkan.');
      return;
    }
    if (!file) {
      setError('Pilih bukti pembayaran terlebih dahulu.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran bukti maksimal 5 MB.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    let uploadedPath = '';

    try {
      // Claim the route before uploading: the Storage INSERT policy only
      // accepts proof objects for bookings already locked to manual_qris.
      const { error: routeError } = await (supabase as any).rpc('claim_booking_payment_route', {
        p_booking_id: bookingId,
        p_route: 'manual_qris',
      });
      if (routeError) throw routeError;
      onRouteClaimed?.('manual_qris');

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${bookingId}/${crypto.randomUUID()}.${ext}`;

      const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        pdf: 'application/pdf',
      };

      const contentType = file.type || mimeTypes[ext];

      const { error: uploadError } = await supabase.storage
        .from('qris-payment-proofs')
        .upload(path, file, {
          upsert: false,
          contentType,
        });

      if (uploadError) throw uploadError;

      uploadedPath = path;

      const { error: rpcError } = await (supabase as any).rpc(
        'submit_qris_payment_proof',
        {
          p_booking_id: bookingId,
          p_proof_storage_path: path,
          p_claimed_amount: amount,
          p_transfer_reference: reference.trim() || null,
        }
      );

      if (rpcError) throw rpcError;

      setSubmission({
        status: 'pending_review',
        created_at: new Date().toISOString(),
      });

      onRouteClaimed?.('manual_qris');
      setFile(null);
      setReference('');

      setSuccess(
        'Bukti terkirim. Tunggu pemeriksaan Admin; booking belum dianggap lunas sampai disetujui.'
      );
    } catch (e: any) {
      if (uploadedPath) {
        await supabase.storage
          .from('qris-payment-proofs')
          .remove([uploadedPath]);
      }

      setError(e?.message || 'Gagal mengirim bukti pembayaran.');
    } finally {
      setBusy(false);
    }
  };

  if (bookingStatus !== 'pending_payment') return null;
  if (paymentRoute === 'xendit') return null;

  if (isLoadingPaymentData) {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Memuat informasi pembayaran QRIS...
      </div>
    );
  }

  if (paymentDataError) {
    return (
      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
        <AlertCircle className="mr-1 inline h-4 w-4" />
        {paymentDataError} Muat ulang halaman sebelum mengirim bukti agar status pembayaran sebelumnya tidak terlewat.
      </div>
    );
  }

  if (submission?.status === 'pending_review') {
    return (
      <div className="mt-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Bukti pembayaran sudah terkirim
        </div>
        <p className="mt-2 text-xs">
          Sekarang tinggal menunggu Admin memeriksa. Anda tidak perlu mengunggah atau membayar ulang.
        </p>
        <p className="mt-1 text-xs text-emerald-800">
          Status booking akan berubah otomatis setelah pembayaran diverifikasi.
        </p>
      </div>
    );
  }

  if (submission?.status === 'approved') {
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
        <CheckCircle2 className="mr-1 inline h-4 w-4" />
        Pembayaran telah diverifikasi.
      </div>
    );
  }

  if (!settings?.is_active || !imageUrl) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertCircle className="mr-1 inline h-4 w-4" />
        QRIS belum tersedia. Silakan hubungi Admin YUKU.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {submission?.status === 'rejected' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <div className="font-bold">Bukti pembayaran perlu diperbaiki</div>
          <p className="mt-1">Admin belum dapat memverifikasi bukti sebelumnya. Silakan periksa catatan Admin, lalu kirim bukti yang sesuai.</p>
          {submission.admin_notes && (
            <p className="mt-2 rounded-lg bg-white/80 p-2 text-rose-900">
              <strong>Catatan Admin:</strong> {submission.admin_notes}
            </p>
          )}
        </div>
      )}
    <div className="mt-4 space-y-4 rounded-[1.5rem] border border-white/80 bg-white/85 p-4 shadow-[0_18px_45px_-24px_rgba(76,29,149,0.35)] ring-1 ring-violet-100/80 backdrop-blur-xl sm:p-5">
      {left !== null && (
        <div className={`rounded-xl px-3 py-2 text-center text-xs font-bold ${
          left < 180
            ? 'bg-rose-100 text-rose-800'
            : 'bg-amber-100 text-amber-900'
        }`}>
          {left > 0
            ? `Selesaikan pembayaran dalam ${countdown}`
            : 'Waktu pembayaran habis. Buat booking baru.'}
        </div>
      )}

      <div>
        <h4 className="text-sm font-extrabold text-purple-950">
          Pembayaran QRIS YUKU
        </h4>
        <p className="mt-1 text-xs text-slate-600">
          Pindai QRIS dan bayar sesuai nominal booking.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-violet-100/80 bg-gradient-to-b from-white to-violet-50/50 p-4 shadow-inner">
        <img
          src={imageUrl}
          alt="QRIS pembayaran YUKU"
          className="w-full max-w-[260px] rounded-xl object-contain drop-shadow-md"
        />

        {settings.merchant_name && (
          <p className="text-xs font-bold text-slate-700">
            {settings.merchant_name}
          </p>
        )}

        <p className="text-2xl font-black tracking-tight text-violet-950">
          {formatRupiah(amount)}
        </p>

        {settings.instructions && (
          <p className="text-center text-[11px] text-slate-500">
            {settings.instructions}
          </p>
        )}
      </div>

      <div className="text-xs font-bold text-slate-700">
        Bukti pembayaran (JPG/PNG/WebP/PDF, maks. 5 MB)

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={handleFileChange}
        />

        <button
          type="button"
          disabled={busy || (left !== null && left <= 0)}
          onClick={() => fileInputRef.current?.click()}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-300 bg-white px-4 py-3 text-xs font-extrabold text-violet-800 shadow-sm transition hover:border-violet-500 hover:bg-violet-50 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {file ? 'Ganti file' : 'Ketuk untuk memilih file bukti bayar'}
        </button>

        {file ? (
          <p className="mt-2 flex items-center gap-1 break-all rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            File dipilih: {file.name}
          </p>
        ) : (
          <p className="mt-2 font-normal text-slate-500">
            Belum ada file dipilih.
          </p>
        )}
      </div>

      <label className="block text-xs font-bold text-slate-700">
        Nomor referensi transaksi (opsional)
        <input
          value={reference}
          onChange={e => setReference(e.target.value)}
          maxLength={100}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal shadow-inner outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          placeholder="Nomor referensi dari aplikasi pembayaran"
        />
      </label>

      {error && <p className="text-xs text-rose-700">{error}</p>}
      {success && <p className="text-xs text-emerald-700">{success}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !file || (left !== null && left <= 0)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-700 to-violet-600 px-4 py-3 text-xs font-extrabold text-white shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-50"
      >
        {busy
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Upload className="h-4 w-4" />
        }
        {busy ? 'Mengirim...' : 'Kirim Bukti Pembayaran'}
      </button>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Unggahan tidak otomatis mengesahkan pembayaran. Admin harus mencocokkan dana masuk pada akun merchant.
      </p>
    </div>
    </div>
  );
};
