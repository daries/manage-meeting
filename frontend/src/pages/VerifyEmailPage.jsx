import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, CheckCircle, XCircle, Loader } from 'lucide-react';

export default function VerifyEmailPage() {
  const { token } = useParams();
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        await verifyEmail(token);
        if (!cancelled) {
          setStatus('success');
          // Redirect ke dashboard setelah 2 detik
          setTimeout(() => navigate('/dashboard'), 2000);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(
            err.response?.data?.message || 'Link konfirmasi tidak valid atau sudah kadaluarsa.'
          );
        }
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <ClipboardList size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">RapatKu</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="flex justify-center mb-4">
                <Loader size={48} className="text-indigo-500 animate-spin" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Memverifikasi email...</h2>
              <p className="text-gray-500 text-sm">Mohon tunggu sebentar.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle size={56} className="text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Email Berhasil Diverifikasi!</h2>
              <p className="text-gray-500 text-sm mb-6">
                Akun Anda telah aktif. Anda akan dialihkan ke dashboard...
              </p>
              <Link
                to="/dashboard"
                className="inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Ke Dashboard Sekarang
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-4">
                <XCircle size={56} className="text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Verifikasi Gagal</h2>
              <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
              <div className="space-y-3">
                <Link
                  to="/register"
                  className="block w-full bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Daftar Ulang
                </Link>
                <Link to="/login" className="block text-sm text-gray-500 hover:text-gray-700">
                  Kembali ke halaman masuk
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
