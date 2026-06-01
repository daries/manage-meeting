import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { ClipboardList, Eye, EyeOff, AlertTriangle, Mail } from 'lucide-react';

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

// Banner khusus untuk status akun yang butuh tindakan
function StatusBanner({ code, email, onResendVerification, onRequestReactivation, sending }) {
  if (code === 'EMAIL_NOT_VERIFIED') {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-4">
        <div className="flex gap-3">
          <Mail size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Email belum dikonfirmasi</p>
            <p className="text-amber-700 mt-0.5">Cek inbox <strong>{email}</strong> dan klik link konfirmasi.</p>
            <button
              onClick={onResendVerification}
              disabled={sending}
              className="mt-2 text-amber-700 underline font-medium hover:text-amber-900 disabled:opacity-60"
            >
              {sending ? 'Mengirim...' : 'Kirim ulang email konfirmasi'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (code === 'ACCOUNT_INACTIVE') {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
        <div className="flex gap-3">
          <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-red-800">Akun tidak aktif</p>
            <p className="text-red-700 mt-0.5">Akun Anda telah dinonaktifkan.</p>
            <button
              onClick={onRequestReactivation}
              disabled={sending}
              className="mt-2 text-red-700 underline font-medium hover:text-red-900 disabled:opacity-60"
            >
              {sending ? 'Mengirim...' : 'Minta link reaktivasi via email'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null); // { code, email }
  const { login, loginWithGoogle, resendVerification, requestReactivation } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusBanner(null);
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'EMAIL_NOT_VERIFIED' || data?.code === 'ACCOUNT_INACTIVE') {
        setStatusBanner({ code: data.code, email: data.email || form.email });
      } else {
        toast.error(data?.message || 'Login gagal');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setSending(true);
    try {
      await resendVerification(statusBanner.email);
      toast.success('Email konfirmasi telah dikirim ulang!');
    } catch {
      toast.error('Gagal mengirim ulang. Coba lagi nanti.');
    } finally {
      setSending(false);
    }
  };

  const handleRequestReactivation = async () => {
    setSending(true);
    try {
      await requestReactivation(statusBanner.email);
      toast.success('Link reaktivasi telah dikirim ke email Anda!');
    } catch {
      toast.error('Gagal mengirim. Coba lagi nanti.');
    } finally {
      setSending(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        await loginWithGoogle({ access_token: tokenResponse.access_token });
        toast.success('Login berhasil!');
        navigate('/dashboard');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Login Google gagal');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => toast.error('Login Google gagal'),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <ClipboardList size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">RapatKu</h1>
          <p className="text-gray-500 mt-2">Sistem Manajemen Rapat & Kegiatan</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Masuk ke akun Anda</h2>

          <button
            type="button"
            onClick={() => googleLogin()}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-4"
          >
            <GoogleIcon />
            {googleLoading ? 'Memproses...' : 'Masuk dengan Google'}
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-400">
              <span className="bg-white px-3">atau masuk dengan email</span>
            </div>
          </div>

          {statusBanner && (
            <StatusBanner
              code={statusBanner.code}
              email={statusBanner.email}
              onResendVerification={handleResendVerification}
              onRequestReactivation={handleRequestReactivation}
              sending={sending}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-indigo-600 hover:underline font-medium"
                >
                  Lupa password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full btn-primary py-3"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Belum punya akun?{' '}
            <Link to="/register" className="text-indigo-600 hover:underline font-medium">
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
