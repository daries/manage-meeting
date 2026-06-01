import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  Calendar, MapPin, Video, Users, Bell, Link2, Edit, Trash2,
  ChevronRight, Copy, CheckCircle, Clock, ClipboardList, MessageSquare,
  ExternalLink, Send, UserCheck
} from 'lucide-react';

const statusConfig = {
  scheduled: { label: 'Terjadwal', class: 'bg-blue-100 text-blue-700' },
  ongoing: { label: 'Berlangsung', class: 'bg-green-100 text-green-700' },
  completed: { label: 'Selesai', class: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Dibatalkan', class: 'bg-red-100 text-red-600' },
};

export default function MeetingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => { loadMeeting(); }, [id]);

  const loadMeeting = async () => {
    try {
      const res = await api.get(`/meetings/${id}`);
      setMeeting(res.data);
    } catch (err) {
      toast.error('Rapat tidak ditemukan');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/attend/${meeting.attendance_token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link presensi disalin!');
  };

  const sendNotifications = async (type) => {
    setNotifyLoading(true);
    try {
      const res = await api.post(`/meetings/${id}/notify`, { type });
      toast.success(`Notifikasi ${type === 'invitation' ? 'undangan' : 'pengingat'} berhasil dikirim!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim notifikasi');
    } finally {
      setNotifyLoading(false);
    }
  };

  const sendAgendaReminder = async () => {
    try {
      await api.post(`/agendas/${id}/notify-pic`);
      toast.success('Pengingat agenda dikirim ke PIC!');
    } catch (err) {
      toast.error('Gagal mengirim pengingat');
    }
  };

  const deleteMeeting = async () => {
    if (!confirm('Yakin ingin menghapus rapat ini?')) return;
    try {
      await api.delete(`/meetings/${id}`);
      toast.success('Rapat dihapus');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Gagal menghapus rapat');
    }
  };

  const updateStatus = async (status) => {
    try {
      await api.put(`/meetings/${id}`, { ...meeting, status });
      toast.success('Status rapat diperbarui');
      loadMeeting();
    } catch (err) {
      toast.error('Gagal update status');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );

  if (!meeting) return null;

  const isOrganizer = meeting.created_by === user?.id;
  const status = statusConfig[meeting.status] || statusConfig.scheduled;
  const attendanceLink = `${window.location.origin}/attend/${meeting.attendance_token}`;

  const tabs = [
    { id: 'info', label: 'Info', icon: Calendar },
    { id: 'agenda', label: 'Agenda', icon: ClipboardList },
    { id: 'attendance', label: 'Presensi', icon: UserCheck },
    { id: 'actions', label: 'Aksi', icon: Bell },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 mt-1">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 flex-1">{meeting.title}</h1>
            <span className={`badge ${status.class}`}>{status.label}</span>
          </div>
          <p className="text-gray-500 text-sm mt-1">Dibuat oleh {meeting.creator_name}</p>
        </div>
        {isOrganizer && (
          <div className="flex gap-2">
            <button onClick={() => navigate(`/meetings/${id}/edit`)} className="btn-secondary flex items-center gap-1 text-sm">
              <Edit size={15} /> Edit
            </button>
            <button onClick={deleteMeeting} className="text-red-500 hover:text-red-700 p-2">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Quick info bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Calendar size={16} className="text-indigo-500" />
          <span className="font-medium">{format(parseISO(meeting.meeting_date), 'EEEE, dd MMMM yyyy', { locale: idLocale })}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock size={16} className="text-indigo-500" />
          <span>{meeting.start_time?.slice(0, 5)}{meeting.end_time ? ` - ${meeting.end_time.slice(0, 5)}` : ''}</span>
        </div>
        {meeting.location && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-indigo-500" />
            <span>{meeting.location}</span>
          </div>
        )}
        {meeting.online_link && (
          <a href={meeting.online_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
            <Video size={16} />
            <span>Link Online</span>
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Info */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          {meeting.description && (
            <div className="card">
              <h3 className="font-medium text-gray-900 mb-2">Deskripsi</h3>
              <p className="text-gray-600 text-sm whitespace-pre-wrap">{meeting.description}</p>
            </div>
          )}

          <div className="card">
            <h3 className="font-medium text-gray-900 mb-3">Peserta ({meeting.participants?.length || 0})</h3>
            <div className="space-y-2">
              {meeting.participants?.map(p => (
                <div key={p.id} className="flex items-center gap-3 py-1">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-bold">
                    {(p.full_name || p.external_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.full_name || p.external_name || '-'}</p>
                    <p className="text-xs text-gray-500">{p.email || p.external_email}</p>
                  </div>
                  <span className={`badge text-xs ${
                    p.role === 'organizer' ? 'bg-indigo-100 text-indigo-700' :
                    p.role === 'notulen' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {p.role === 'organizer' ? 'Panitia' : p.role === 'notulen' ? 'Notulen' : 'Peserta'}
                  </span>
                  <div className="flex gap-1">
                    {p.notified_email && <span title="Email terkirim" className="text-green-500">✉</span>}
                    {p.notified_wa && <span title="WA terkirim" className="text-green-500">📱</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notulen link */}
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium text-gray-900">Notulen Rapat</h3>
              {meeting.minutes_locked && (
                <span className="badge bg-green-100 text-green-700">✓ Final</span>
              )}
            </div>
            <button
              onClick={() => navigate(`/meetings/${id}/minutes`)}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium mt-2"
            >
              <ClipboardList size={16} />
              {meeting.minutes_locked ? 'Lihat Notulen' : 'Buat / Edit Notulen'}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* TAB: Agenda */}
      {activeTab === 'agenda' && (
        <div className="space-y-3">
          {meeting.agendas?.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">
              <ClipboardList size={40} className="mx-auto mb-2 opacity-40" />
              <p>Belum ada agenda</p>
            </div>
          ) : (
            meeting.agendas?.map((a, idx) => (
              <div key={a.id} className="card">
                <div className="flex items-start gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    a.status === 'discussed' ? 'bg-green-100 text-green-700' :
                    a.status === 'skipped' ? 'bg-gray-100 text-gray-500' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {a.status === 'discussed' ? '✓' : a.order_number}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{a.title}</p>
                    {a.description && <p className="text-sm text-gray-500 mt-1">{a.description}</p>}
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      {a.duration_minutes && <span>⏱ {a.duration_minutes} menit</span>}
                      {a.pic_name && <span>👤 {a.pic_name}</span>}
                      {a.pic_full_name && <span>👤 {a.pic_full_name}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: Attendance */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Attendance link */}
          <div className="card bg-indigo-50 border-indigo-200">
            <h3 className="font-medium text-indigo-900 mb-2">Link Presensi</h3>
            <p className="text-xs text-indigo-700 mb-3">Bagikan link ini kepada peserta. Tidak perlu login untuk mengisi presensi.</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={attendanceLink}
                className="input-field text-sm bg-white flex-1"
              />
              <button onClick={copyLink} className={`px-3 py-2 rounded-lg border flex items-center gap-1 text-sm font-medium transition-colors ${
                copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}>
                {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
                {copied ? 'Disalin' : 'Salin'}
              </button>
            </div>
          </div>

          {/* Attendance list */}
          <div className="card">
            <h3 className="font-medium text-gray-900 mb-3">
              Daftar Kehadiran ({meeting.attendance?.length || 0} hadir)
            </h3>
            {meeting.attendance?.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Belum ada presensi</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 font-medium text-gray-600">Nama</th>
                      <th className="text-left py-2 font-medium text-gray-600">Jabatan</th>
                      <th className="text-left py-2 font-medium text-gray-600">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {meeting.attendance?.map((a, idx) => (
                      <tr key={a.id}>
                        <td className="py-2">
                          <p className="font-medium">{a.name}</p>
                          <p className="text-xs text-gray-400">{a.email}</p>
                        </td>
                        <td className="py-2 text-gray-600">{a.jabatan || '-'}</td>
                        <td className="py-2 text-gray-500 text-xs">
                          {format(new Date(a.attended_at), 'HH:mm', { locale: idLocale })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Actions */}
      {activeTab === 'actions' && isOrganizer && (
        <div className="space-y-4">
          {/* Status update */}
          <div className="card">
            <h3 className="font-medium text-gray-900 mb-3">Update Status Rapat</h3>
            <div className="grid grid-cols-2 gap-2">
              {['scheduled', 'ongoing', 'completed', 'cancelled'].map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  disabled={meeting.status === s}
                  className={`py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                    meeting.status === s
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default'
                      : 'hover:bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  {statusConfig[s]?.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="card">
            <h3 className="font-medium text-gray-900 mb-3">Kirim Notifikasi</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Undangan Rapat</p>
                  <p className="text-xs text-gray-500">Email & WhatsApp ke semua peserta</p>
                </div>
                <button onClick={() => sendNotifications('invitation')} disabled={notifyLoading} className="btn-primary text-sm">
                  {notifyLoading ? '...' : <><Send size={14} className="inline mr-1" />Kirim</>}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Pengingat Rapat</p>
                  <p className="text-xs text-gray-500">Reminder H-1 ke semua peserta</p>
                </div>
                <button onClick={() => sendNotifications('reminder')} disabled={notifyLoading} className="btn-secondary text-sm">
                  {notifyLoading ? '...' : <><Bell size={14} className="inline mr-1" />Kirim</>}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Pengingat Agenda ke PIC</p>
                  <p className="text-xs text-gray-500">WhatsApp ke PIC yang bertanggung jawab agenda</p>
                </div>
                <button onClick={sendAgendaReminder} className="btn-secondary text-sm">
                  <MessageSquare size={14} className="inline mr-1" />Kirim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'actions' && !isOrganizer && (
        <div className="card text-center py-8 text-gray-400">
          <Bell size={40} className="mx-auto mb-2 opacity-40" />
          <p>Hanya penyelenggara yang dapat mengelola aksi</p>
        </div>
      )}
    </div>
  );
}
