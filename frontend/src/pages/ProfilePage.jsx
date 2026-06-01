import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { User, Phone, Briefcase, Building2, Globe, Lock, CheckCircle } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    jabatan: user?.jabatan || '',
    department: user?.department || '',
    organization: user?.organization || '',
  });

  const [pwForm, setPwForm] = useState({
    current_password: '', new_password: '', confirm_password: ''
  });

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.phone || !form.jabatan || !form.department) {
      return toast.error('Nama, HP, Jabatan, dan Departemen wajib diisi');
    }
    setLoading(true);
    try {
      const res = await api.put('/auth/profile', form);
      updateUser(res.data);
      toast.success('Profil berhasil disimpan!');
      if (res.data.is_profile_complete) {
        setTimeout(() => navigate('/dashboard'), 1000);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan profil');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      return toast.error('Konfirmasi password tidak sesuai');
    }
    setLoading(true);
    try {
      await api.put('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success('Password berhasil diubah!');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengubah password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profil Saya</h1>
        <p className="text-gray-500 mt-1">Kelola informasi akun dan keamanan</p>
      </div>

      {!user?.is_profile_complete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <div className="text-amber-500 mt-0.5">⚠️</div>
            <div>
              <p className="font-medium text-amber-800">Profil belum lengkap</p>
              <p className="text-sm text-amber-700 mt-1">
                Lengkapi data diri Anda untuk dapat menggunakan semua fitur aplikasi.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Avatar & Header */}
      <div className="card mb-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-2xl">
          {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{user?.full_name}</h2>
            {user?.is_profile_complete && (
              <CheckCircle size={18} className="text-green-500" />
            )}
          </div>
          <p className="text-gray-500 text-sm">{user?.email}</p>
          {user?.jabatan && (
            <p className="text-sm text-indigo-600 mt-1">{user.jabatan} · {user.department}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'profile', label: 'Data Diri' },
          { id: 'password', label: 'Ubah Password' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="card">
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1.5"><User size={15} /> Nama Lengkap *</span>
              </label>
              <input
                className="input-field"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Nama lengkap Anda"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1.5"><Phone size={15} /> No. WhatsApp *</span>
              </label>
              <input
                className="input-field"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="08xxxxxxxxxx"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Digunakan untuk notifikasi WhatsApp</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5"><Briefcase size={15} /> Jabatan *</span>
                </label>
                <input
                  className="input-field"
                  value={form.jabatan}
                  onChange={e => setForm(f => ({ ...f, jabatan: e.target.value }))}
                  placeholder="Jabatan / posisi"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5"><Building2 size={15} /> Departemen *</span>
                </label>
                <input
                  className="input-field"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="Nama departemen"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1.5"><Globe size={15} /> Organisasi / Instansi</span>
              </label>
              <input
                className="input-field"
                value={form.organization}
                onChange={e => setForm(f => ({ ...f, organization: e.target.value }))}
                placeholder="Nama organisasi atau instansi"
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary py-3">
              {loading ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'password' && (
        <div className="card">
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1.5"><Lock size={15} /> Password Saat Ini</span>
              </label>
              <input
                type="password"
                className="input-field"
                value={pwForm.current_password}
                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
              <input
                type="password"
                className="input-field"
                value={pwForm.new_password}
                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
              <input
                type="password"
                className="input-field"
                value={pwForm.confirm_password}
                onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-3">
              {loading ? 'Memproses...' : 'Ubah Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
