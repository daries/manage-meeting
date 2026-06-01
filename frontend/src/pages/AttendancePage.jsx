import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Calendar, MapPin, Clock, CheckCircle, ClipboardList, Users } from 'lucide-react';

export default function AttendancePage() {
  const { token } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    jabatan: '',
    department: '',
    organization: '',
  });

  useEffect(() => {
    api.get(`/attendance/${token}`)
      .then(res => setMeeting(res.data))
      .catch(() => setMeeting(null))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Nama wajib diisi');
    setSubmitting(true);
    try {
      await api.post(`/attendance/${token}`, form);
      setSubmitted(true);
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Email ini sudah melakukan presensi sebelumnya');
      } else {
        toast.error(err.response?.data?.message || 'Gagal menyimpan presensi');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );

  if (!meeting) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-500 text-3xl">?</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Link Tidak Ditemukan</h2>
        <p className="text-gray-500">Link presensi ini tidak valid atau sudah kadaluarsa.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Presensi Berhasil!</h2>
        <p className="text-gray-500 mb-4">Kehadiran Anda di rapat <strong>{meeting.title}</strong> telah tercatat.</p>
        <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-1.5">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar size={14} className="text-gray-400" />
            {format(parseISO(meeting.meeting_date), 'EEEE, dd MMMM yyyy', { locale: idLocale })}
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock size={14} className="text-gray-400" />
            {meeting.start_time?.slice(0, 5)}
          </div>
          {meeting.location && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin size={14} className="text-gray-400" />
              {meeting.location}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-4">Terima kasih telah mengisi presensi!</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm mb-4">
            <ClipboardList size={16} className="text-indigo-600" />
            <span className="text-sm font-semibold text-indigo-700">RapatKu</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Form Presensi Rapat</h1>
        </div>

        {/* Meeting info */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{meeting.title}</h2>
              <p className="text-sm text-gray-500">{meeting.organizer_name}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar size={14} className="text-gray-400" />
              {format(parseISO(meeting.meeting_date), 'EEEE, dd MMMM yyyy', { locale: idLocale })}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={14} className="text-gray-400" />
              {meeting.start_time?.slice(0, 5)}{meeting.end_time ? ` - ${meeting.end_time.slice(0, 5)}` : ''}
            </div>
            {meeting.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={14} className="text-gray-400" />
                {meeting.location}
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <Users size={14} className="text-gray-400" />
              {meeting.attendance_count || 0} peserta sudah hadir
            </div>
          </div>

          {/* Agendas */}
          {meeting.agendas?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">AGENDA</p>
              {meeting.agendas.map(a => (
                <div key={a.order_number} className="flex gap-2 text-sm text-gray-600 mb-1">
                  <span className="text-gray-400">{a.order_number}.</span>
                  {a.title}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Data Kehadiran Anda</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
              <input
                className="input-field"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nama lengkap Anda"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="input-field"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@contoh.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. WhatsApp</label>
              <input
                className="input-field"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jabatan</label>
                <input
                  className="input-field"
                  value={form.jabatan}
                  onChange={e => setForm(f => ({ ...f, jabatan: e.target.value }))}
                  placeholder="Jabatan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departemen</label>
                <input
                  className="input-field"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="Departemen"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organisasi / Instansi</label>
              <input
                className="input-field"
                value={form.organization}
                onChange={e => setForm(f => ({ ...f, organization: e.target.value }))}
                placeholder="Nama organisasi atau instansi"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-primary py-3 text-base"
            >
              {submitting ? 'Menyimpan...' : 'Konfirmasi Kehadiran'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-3">
            Data presensi bersifat rahasia dan hanya digunakan untuk keperluan administrasi rapat
          </p>
        </div>
      </div>
    </div>
  );
}
