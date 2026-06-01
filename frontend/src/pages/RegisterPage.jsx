import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { ClipboardList, Mail, CheckCircle } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function EmailSentState({ email, onResend, resending }) {
  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
        <Mail size={32} className="text-green-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Cek email Anda!</h3>
      <p className="text-gray-500 text-sm mb-1">
        Link konfirmasi telah dikirim ke:
      </p>
      <p className="font-medium text-indigo-600 mb-4">{email}</p>
      <p className="text-gray-400 text-xs mb-6">
        Klik link dalam email untuk mengaktifkan akun. Link berlaku 24 jam.
        Cek folder <strong>Spam/Junk</strong> jika tidak ada di inbox.
      </p>
      <div className="space-y-3">
        <button
          onClick={onResend}
          disabled={resending}
          className="w-full border border-indigo-300 text-indigo-600 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-indigo-50 transition-colors disabled:opacity-60"
        >
          {resending ? 'Mengirim...' : 'Kirim ulang email konfirmasi'}
        </button>
        <Link to="/login" className="block text-center text-sm text-gray-500 hover:text-gray-700">
          Kembali ke halaman masuk
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState(null);
  const { register, loginWithGoogle, resendVerification } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      return toast.error('Password minimal 6 karakter');
    }
    setLoading(true);
    try {
      await register(form);
      setRegisteredEmail(form.email);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification(registeredEmail);
      toast.success('Email konfirmasi telah dikirim ulang!');
    } catch {
      toast.error('Gagal mengirim ulang. Coba lagi nanti.');
    } finally {
      setResending(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const data = await loginWithGoogle({ access_token: tokenResponse.access_token });
        toast.success(data.user?.is_profile_complete ? 'Login berhasil!' : 'Akun berhasil dibuat! Lengkapi profil Anda.');
        navigate(data.user?.is_profile_complete ? '/dashboard' : '/profile');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Daftar dengan Google gagal');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => toast.error('Daftar dengan Google gagal'),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <ClipboardList size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">RapatKu</h1>
          <p className="text-gray-500 mt-2">Buat akun baru</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {registeredEmail ? (
            <EmailSentState
              email={registeredEmail}
              onResend={handleResend}
              resending={resending}
            />
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Daftar Akun</h2>

              <button
                type="button"
                onClick={() => googleLogin()}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-4"
              >
                <GoogleIcon />
                {googleLoading ? 'Memproses...' : 'Daftar dengan Google'}
              </button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs text-gray-400">
                  <span className="bg-white px-3">atau daftar dengan email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Nama lengkap Anda"
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    required
                    minLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="nama@email.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Minimal 6 karakter"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
                <button type="submit" disabled={loading || googleLoading} className="w-full btn-primary py-3">
                  {loading ? 'Memproses...' : 'Daftar'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-4">
                Sudah punya akun?{' '}
                <Link to="/login" className="text-indigo-600 hover:underline font-medium">
                  Masuk
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
