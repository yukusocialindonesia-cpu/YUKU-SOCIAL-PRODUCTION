import React from 'react';

type Props = {
  bookingId: string;
  amount: number;
  bookingStatus: string;
  paymentRoute?: string | null;
};

export const XenditCustomerPaymentPanel: React.FC<Props> = ({ bookingStatus, paymentRoute }) => {
  if (bookingStatus !== 'pending_payment') return null;
  if (paymentRoute && paymentRoute !== 'xendit') return null;

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h4 className="text-sm font-extrabold text-amber-950">Pembayaran Xendit sementara belum tersedia</h4>
      <p className="mt-1 text-xs leading-relaxed text-amber-900">
        Jalur checkout Xendit sedang dinonaktifkan sampai integrasi dan pengujian pembayaran selesai.
        Jangan melakukan transfer melalui tautan lama. Gunakan metode pembayaran lain yang masih
        ditampilkan aktif pada booking ini atau hubungi Admin YUKU.
      </p>
    </div>
  );
};
