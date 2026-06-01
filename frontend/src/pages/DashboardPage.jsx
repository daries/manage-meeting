import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Calendar, Users, ClipboardCheck, Clock, Plus, ChevronRight, AlertCircle } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import MeetingCard from '../components/MeetingCard';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, meetingsRes, upcomingRes] = await Promise.all([
        api.get('/users/stats'),
        api.get(`/meetings${filter !== 'all' ? `?status=${filter}` : ''}`),
        api.get('/meetings/upcoming'),
      ]);
      setStats(statsRes.data);
      setMeetings(meetingsRes.data.meetings || []);
      setUpcoming(upcomingRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats ? [
    { label: 'Total Rapat', value: stats.total_meetings, icon: Calendar, color: 'bg-blue-50 text-blue-600' },
    { label: 'Rapat Mendatang', value: stats.upcoming_meetings, icon: Clock, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Rapat Saya', value: stats.my_meetings, icon: Users, color: 'bg-purple-50 text-purple-600' },
    { label: 'Perlu Persetujuan', value: stats.pending_approvals, icon: ClipboardCheck, color: 'bg-amber-50 text-amber-600' },
  ] : [];

  const filterOptions = [
    { value: 'all', label: 'Semua' },
    { value: 'scheduled', label: 'Terjadwal' },
    { value: 'ongoing', label: 'Berlangsung' },
    { value: 'completed', label: 'Selesai' },
    { value: 'cancelled', label: 'Dibatalkan' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Halo, {user?.full_name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(new Date(), "EEEE, dd MMMM yyyy", { locale: idLocale })}
          </p>
        </div>
        <button
          onClick={() => navigate('/meetings/new')}
          className="btn-primary hidden sm:flex items-center gap-2"
        >
          <Plus size={18} />
          Buat Rapat
        </button>
      </div>

      {/* Profile incomplete warning */}
      {!user?.is_profile_complete && (
        <div
          onClick={() => navigate('/profile')}
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 cursor-pointer hover:bg-amber-100 transition-colors flex items-center gap-3"
        >
          <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 text-sm">Profil belum lengkap</p>
            <p className="text-xs text-amber-700">Lengkapi profil untuk dapat membuat dan mengelola rapat</p>
          </div>
          <ChevronRight size={16} className="text-amber-500" />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className="card">
            <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
              <card.icon size={20} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Upcoming meetings */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Rapat Terdekat</h2>
          <div className="space-y-2">
            {upcoming.map(m => {
              const date = parseISO(m.meeting_date);
              const dateLabel = isToday(date) ? 'Hari ini' : isTomorrow(date) ? 'Besok' : format(date, 'dd MMM', { locale: idLocale });
              return (
                <div
                  key={m.id}
                  onClick={() => navigate(`/meetings/${m.id}`)}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-xs text-indigo-500 font-medium">{dateLabel}</span>
                    <span className="text-sm font-bold text-indigo-700">
                      {m.start_time?.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{m.title}</p>
                    <p className="text-sm text-gray-500">{m.location || m.online_link || 'Lokasi belum ditentukan'}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All meetings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Semua Rapat</h2>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === opt.value
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="card text-center py-12">
            <Calendar size={48} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Belum ada rapat</p>
            <button
              onClick={() => navigate('/meetings/new')}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Buat Rapat Pertama
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {meetings.map(meeting => (
              <MeetingCard key={meeting.id} meeting={meeting} onClick={() => navigate(`/meetings/${meeting.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
