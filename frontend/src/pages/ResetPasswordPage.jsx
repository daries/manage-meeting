import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { ClipboardList, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      return toast.error('Konfirmasi password tidak cocok');
    }
    if (form.password.length < 6) {
      return toast.error('Password minimal 6 karakter');
    }
    setLoading(true);
    try {
      await resetPassword(token, form.password);
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Link reset tidak valid atau sudah kadaluarsa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <ClipboardList size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">RapatKu</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {done ? (
            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Password Berhasil Direset!</h2>
              <p className="text-gray-500 text-sm mb-6">
                Silakan masuk menggunakan password baru Anda.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full btn-primary py-3"
              >
                Masuk Sekarang
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Buat Password Baru</h2>
              <p className="text-gray-500 text-sm mb-6">Masukkan password baru untuk akun Anda.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      className="input-field pr-10"
                      placeholder="Minimal 6 karakter"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required
                      minLength={6}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input-field"
                    placeholder="Ulangi password baru"
                    value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                    required
                  />
                </div>

                {form.confirm && form.password !== form.confirm && (
                  <p className="text-xs text-red-500">Password tidak cocok</p>
                )}

                <button type="submit" disabled={loading} className="w-full btn-primary py-3">
                  {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-400 mt-4">
                <Link to="/login" className="hover:text-gray-600">Kembali ke halaman masuk</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
