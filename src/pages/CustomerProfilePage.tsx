import React, { useEffect, useState } from 'react';
import {
  UserRound,
  Camera,
  MapPin,
  VenusAndMars,
  FileText,
  Mail,
  Phone,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AppRoute } from '../types/navigation';
import { GenderType } from '../types/database';

interface CustomerProfilePageProps {
  onNavigate: (path: AppRoute) => void;
}

interface CustomerProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  gender: GenderType | null;
  bio: string | null;
}

const GENDER_OPTIONS: GenderType[] = [
  'Pria',
  'Wanita',
  'Lainnya',
  'Pilih tidak menyebutkan',
];

export const CustomerProfilePage: React.FC<CustomerProfilePageProps> = ({ onNavigate }) => {
  const { user, role, isAuthLoading } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState<GenderType | ''>('');
  const [bio, setBio] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      onNavigate('/login');
      return;
    }
    if (role && role !== 'customer') {
      onNavigate(role === 'talent' ? '/dashboard-talent' : '/admin');
      return;
    }

    let active = true;
    const loadProfile = async () => {
      setIsLoading(true);
      setErrorMessage('');
      const [{ data, error }, { data: accountData }] = await Promise.all([
        supabase
          .from('customer_profiles')
          .select('id, display_name, avatar_url, city, gender, bio')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('users')
          .select('phone_number')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      if (!active) return;
      setPhoneNumber(accountData?.phone_number || user.user_metadata?.phone_number || '');
      if (error) {
        setErrorMessage('Profil belum bisa dimuat. Silakan coba lagi.');
      } else if (!data) {
        setErrorMessage('Data profil Customer belum ditemukan. Silakan hubungi bantuan YUKU.');
      } else {
        const loaded = data as CustomerProfile;
        setProfile(loaded);
        setDisplayName(loaded.display_name || '');
        setCity(loaded.city || '');
        setGender(loaded.gender || '');
        setBio(loaded.bio || '');
      }
      setIsLoading(false);
    };

    void loadProfile();
    return () => { active = false; };
  }, [isAuthLoading, user?.id, role, onNavigate]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setErrorMessage('');
    setSuccessMessage('');
    if (!file) {
      setAvatarFile(null);
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrorMessage('Foto harus berformat JPG, PNG, atau WEBP.');
      event.target.value = '';
      return;
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      setErrorMessage('Ukuran foto maksimal 2 MB.');
      event.target.value = '';
      return;
    }
    setAvatarFile(file);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !profile) return;
    setErrorMessage('');
    setSuccessMessage('');

    const cleanName = displayName.trim();
    if (!cleanName) {
      setErrorMessage('Nama tampilan wajib diisi.');
      return;
    }
    if (cleanName.length > 100) {
      setErrorMessage('Nama tampilan maksimal 100 karakter.');
      return;
    }
    if (bio.length > 500) {
      setErrorMessage('Bio maksimal 500 karakter.');
      return;
    }

    setIsSaving(true);
    try {
      let avatarUrl = profile.avatar_url;
      if (avatarFile) {
        const extension = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const filePath = `${user.id}/customer-avatar-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { contentType: avatarFile.type, upsert: false });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = publicUrlData.publicUrl;
      }

      const { data, error } = await supabase
        .from('customer_profiles')
        .update({
          display_name: cleanName,
          avatar_url: avatarUrl,
          city: city.trim() || null,
          gender: gender || null,
          bio: bio.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select('id, display_name, avatar_url, city, gender, bio')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Profil tidak berhasil diperbarui. Silakan muat ulang halaman.');

      setProfile(data as CustomerProfile);
      setDisplayName(data.display_name || '');
      setAvatarFile(null);
      setSuccessMessage('Profil berhasil diperbarui.');
    } catch (error: any) {
      console.error('YUKU: gagal menyimpan profil customer', error);
      setErrorMessage(error?.message || 'Profil gagal disimpan. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center px-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Memuat profil...
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}
        <button type="button" onClick={() => onNavigate('/')} className="mt-4 text-sm font-bold text-purple-700">
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const currentAvatar = avatarPreview || profile.avatar_url;

  return (
    <div className="min-h-[65vh] bg-[#FAF8FC] px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-100 text-xs font-bold text-purple-800">
            <UserRound className="w-3.5 h-3.5" />
            Akun Customer
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-[#1E0938]">Profil Saya</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola informasi profil yang tampil di YUKU.</p>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full bg-purple-100 border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Foto profil Customer" className="w-full h-full object-cover" />
                ) : (
                  <UserRound className="w-10 h-10 text-purple-500" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-purple-700 text-white border-2 border-white flex items-center justify-center cursor-pointer hover:bg-purple-800" title="Ubah foto profil">
                <Camera className="w-4 h-4" />
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="sr-only" />
              </label>
            </div>
            <div className="text-center sm:text-left min-w-0">
              <h2 className="font-extrabold text-lg text-slate-900">{displayName || 'Customer YUKU'}</h2>
              <p className="text-xs text-slate-500 mt-1">Foto JPG, PNG, atau WEBP. Maksimal 2 MB.</p>
              {avatarFile && <p className="text-xs text-purple-700 mt-2 break-all">Foto baru: {avatarFile.name}</p>}
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed break-words">{errorMessage}</p>
              </div>
            )}
            {successMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{successMessage}</p>
              </div>
            )}

            <div>
              <label htmlFor="customer-display-name" className="block text-sm font-bold text-slate-700 mb-1.5">Nama Tampilan</label>
              <input id="customer-display-name" type="text" maxLength={100} required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full min-w-0 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-purple-600" placeholder="Nama yang ingin ditampilkan" />
            </div>

            <div>
              <label htmlFor="customer-city" className="block text-sm font-bold text-slate-700 mb-1.5">
                <MapPin className="inline w-4 h-4 mr-1 text-slate-400" />Kota
              </label>
              <input id="customer-city" type="text" maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} className="w-full min-w-0 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-purple-600" placeholder="Contoh: Bogor" />
            </div>

            <div>
              <label htmlFor="customer-gender" className="block text-sm font-bold text-slate-700 mb-1.5">
                <VenusAndMars className="inline w-4 h-4 mr-1 text-slate-400" />Jenis Kelamin
              </label>
              <select id="customer-gender" value={gender} onChange={(e) => setGender(e.target.value as GenderType | '')} className="w-full min-w-0 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-purple-600">
                <option value="">Belum dipilih</option>
                {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="customer-bio" className="block text-sm font-bold text-slate-700 mb-1.5">
                <FileText className="inline w-4 h-4 mr-1 text-slate-400" />Tentang Saya
              </label>
              <textarea id="customer-bio" rows={4} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} className="w-full min-w-0 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-purple-600 resize-y" placeholder="Ceritakan sedikit tentang diri Anda (opsional)." />
              <p className="text-right text-xs text-slate-400 mt-1">{bio.length}/500</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 min-w-0">
                <p className="text-xs font-bold text-slate-500 mb-1"><Mail className="inline w-3.5 h-3.5 mr-1" />Email Akun</p>
                <p className="text-sm text-slate-700 break-all">{user.email || 'Tidak tersedia'}</p>
                <p className="text-[11px] text-slate-400 mt-1">Hubungi bantuan YUKU untuk mengubah email.</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 min-w-0">
                <p className="text-xs font-bold text-slate-500 mb-1"><Phone className="inline w-3.5 h-3.5 mr-1" />Nomor WhatsApp</p>
                <p className="text-sm text-slate-700 break-words">{phoneNumber || 'Belum tersedia'}</p>
                <p className="text-[11px] text-slate-400 mt-1">Informasi kontak tidak diubah dari halaman ini.</p>
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={isSaving} className="w-full sm:w-auto sm:min-w-48 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-700 to-fuchsia-700 text-white text-sm font-bold shadow-sm hover:from-purple-800 hover:to-fuchsia-800 disabled:opacity-60 flex items-center justify-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
