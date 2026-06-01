import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      // Selalu tampilkan "berhasil" agar tidak bocorkan info akun
      setSent(true);
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
          {sent ? (
            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
                <CheckCircle size={32} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Cek email Anda!</h2>
              <p className="text-gray-500 text-sm mb-1">Link reset password telah dikirim ke:</p>
              <p className="font-medium text-indigo-600 mb-4">{email}</p>
              <p className="text-gray-400 text-xs mb-6">
                Link berlaku <strong>1 jam</strong>. Cek folder Spam jika tidak ada di inbox.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => { setSent(false); }}
                  className="w-full border border-gray-300 text-gray-600 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Kirim ulang
                </button>
                <Link to="/login" className="block text-center text-sm text-indigo-600 hover:underline font-medium">
                  Kembali ke halaman masuk
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <Link to="/login" className="text-gray-400 hover:text-gray-600 transition-colors">
                  <ArrowLeft size={20} />
                </Link>
                <h2 className="text-xl font-semibold text-gray-900">Lupa Password</h2>
              </div>
              <p className="text-gray-500 text-sm mb-6">
                Masukkan email yang terdaftar. Kami akan mengirimkan link untuk mereset password Anda.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      className="input-field pl-10"
                      placeholder="nama@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3"
                >
                  {loading ? 'Mengirim...' : 'Kirim Link Reset Password'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-4">
                Ingat password Anda?{' '}
                <Link to="/login" className="text-indigo-600 hover:underline font-medium">Masuk</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
