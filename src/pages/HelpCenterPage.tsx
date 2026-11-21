import React, { useState } from 'react';
import { Mail, MessageSquare, ShieldAlert, FileText, Send, CheckCircle2, PhoneCall } from 'lucide-react';
import { AppRoute } from '../types/navigation';

interface HelpCenterPageProps {
  onNavigate: (path: AppRoute) => void;
}

export const HelpCenterPage: React.FC<HelpCenterPageProps> = ({ onNavigate }) => {
  const [ticketData, setTicketData] = useState({
    name: '',
    email: '',
    category: 'Pertanyaan Umum',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-100 via-[#FAF8FC] to-fuchsia-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl rounded-[2rem] border border-white/80 bg-white/65 px-6 py-8 text-center shadow-[0_24px_70px_-35px_rgba(76,29,149,0.35)] backdrop-blur-xl sm:px-10">
          <span className="text-xs font-bold text-purple-700 tracking-wider uppercase mb-1 block">
            Dukungan Pengguna
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#1E0938] tracking-tight mb-2">
            Pusat Bantuan YUKU
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Tim dukungan kami siap membantu menjawab pertanyaan, memandu verifikasi akun, dan menindaklanjuti laporan keamanan.
          </p>
        </div>

        {/* 3 Channels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="flex flex-col justify-between rounded-3xl border border-white/80 bg-white/75 p-6 shadow-[0_18px_45px_-28px_rgba(76,29,149,0.4)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_55px_-28px_rgba(76,29,149,0.45)]">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Email Resmi</h3>
              <p className="text-xs text-slate-600 mb-3">
                Kirim pertanyaan atau dokumen verifikasi ke alamat email resmi kami.
              </p>
            </div>
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=yukufriends@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-purple-700 hover:text-purple-900"
            >
              yukufriends@gmail.com
            </a>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-white/80 bg-white/75 p-6 shadow-[0_18px_45px_-28px_rgba(76,29,149,0.4)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_55px_-28px_rgba(76,29,149,0.45)]">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Tiket Bantuan Online</h3>
              <p className="text-xs text-slate-600 mb-3">
                Sampaikan kendala jadwal, akun, atau verifikasi e-KTP melalui formulir di bawah ini.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700">
              Respon via Email Terdaftar
            </span>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-rose-200/70 bg-rose-50/70 p-6 shadow-[0_18px_45px_-28px_rgba(190,24,93,0.35)] backdrop-blur-xl transition duration-300 hover:-translate-y-1">
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Laporan Pelanggaran Etika</h3>
              <p className="text-xs text-slate-600 mb-3">
                Laporkan indikasi permintaan kencan terlarang, pelecehan, atau perilaku non-sosial.
              </p>
            </div>
            <span className="text-xs font-bold text-rose-700">
              Prioritas Tindakan 24 Jam
            </span>
          </div>
        </div>

        {/* Contact Form & Help Articles */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Quick Guidance Box */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border border-white/80 bg-white/75 p-6 shadow-[0_18px_45px_-28px_rgba(76,29,149,0.4)] backdrop-blur-xl">
              <h3 className="font-bold text-sm text-slate-900 mb-3">
                Topik Bantuan Populer
              </h3>
              <ul className="space-y-3 text-xs text-slate-600">
                <li
                  onClick={() => onNavigate('/faq')}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-transparent bg-white/55 p-3 transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-md"
                >
                  <span>Cara membatalkan booking & refund</span>
                  <span className="text-purple-600 font-bold">Lihat &rarr;</span>
                </li>
                <li
                  onClick={() => onNavigate('/cara-kerja')}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-transparent bg-white/55 p-3 transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-md"
                >
                  <span>Pedoman pertemuan di tempat umum</span>
                  <span className="text-purple-600 font-bold">Lihat &rarr;</span>
                </li>
                <li
                  onClick={() => onNavigate('/daftar-talent')}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-transparent bg-white/55 p-3 transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-md"
                >
                  <span>Penghasilan talent & pencairan saldo</span>
                  <span className="text-purple-600 font-bold">Lihat &rarr;</span>
                </li>
                <li
                  onClick={() => onNavigate('/syarat-ketentuan')}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-transparent bg-white/55 p-3 transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-md"
                >
                  <span>Syarat verifikasi KTP 18+ tahun</span>
                  <span className="text-purple-600 font-bold">Lihat &rarr;</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-[0_24px_65px_-32px_rgba(76,29,149,0.45)] backdrop-blur-xl sm:p-8">
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                Kirim Pesan ke Tim Bantuan
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Silakan tuliskan kendalamu dan tim kami akan segera merespons.
              </p>

              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nama Anda"
                      value={ticketData.name}
                      onChange={(e) => setTicketData({ ...ticketData, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white/75 p-3 text-xs shadow-inner outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Email Anda *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="email@anda.com"
                      value={ticketData.email}
                      onChange={(e) => setTicketData({ ...ticketData, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white/75 p-3 text-xs shadow-inner outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Kategori Kendala *
                    </label>
                    <select
                      value={ticketData.category}
                      onChange={(e) => setTicketData({ ...ticketData, category: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white/75 p-3 text-xs shadow-inner outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                    >
                      <option>Pertanyaan Umum</option>
                      <option>Kendala Pemesanan / Jadwal</option>
                      <option>Verifikasi Akun & KTP</option>
                      <option>Pencairan Saldo Talent</option>
                      <option>Laporan Pelanggaran Etika</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Pesan / Deskripsi Kendala *
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Jelaskan kendala Anda secara rinci..."
                      value={ticketData.message}
                      onChange={(e) => setTicketData({ ...ticketData, message: e.target.value })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white/75 p-3 text-xs shadow-inner outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                    />
                  </div>

                  <button
                    type="submit"
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 py-3 text-xs font-bold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <Send className="w-4 h-4" />
                    <span>Kirim Pesan Bantuan</span>
                  </button>
                </form>
              ) : (
                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Pesan Bantuan Berhasil Terkirim
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Terima kasih telah menghubungi Tim Dukungan YUKU. Tim kami akan segera menanggapi pertanyaan Anda melalui email.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5"
                  >
                    Kirim Pesan Lain
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
