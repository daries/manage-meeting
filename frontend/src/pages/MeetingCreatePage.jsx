import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, Trash2, UserPlus, Search, X, GripVertical } from 'lucide-react';

export default function MeetingCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const searchTimeout = useRef(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    meeting_date: '',
    start_time: '',
    end_time: '',
    location: '',
    meeting_type: 'offline',
    online_link: '',
  });

  const [participants, setParticipants] = useState([]);
  const [agendas, setAgendas] = useState([{ title: '', description: '', duration_minutes: '', pic_name: '' }]);
  const [externalParticipant, setExternalParticipant] = useState({ email: '', name: '', phone: '', jabatan: '' });
  const [showExternal, setShowExternal] = useState(false);

  useEffect(() => {
    if (!user?.is_profile_complete) {
      toast.error('Lengkapi profil Anda terlebih dahulu');
      navigate('/profile');
    }
  }, [user]);

  // Search users
  useEffect(() => {
    if (userSearch.length < 2) { setUserResults([]); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${userSearch}`);
        setUserResults(res.data.filter(u => !participants.find(p => p.user_id === u.id)));
      } catch {}
    }, 300);
  }, [userSearch, participants]);

  const addParticipant = (user) => {
    setParticipants(p => [...p, { user_id: user.id, name: user.full_name, email: user.email, jabatan: user.jabatan || '', role: 'participant' }]);
    setUserSearch('');
    setUserResults([]);
  };

  const addExternalParticipant = () => {
    if (!externalParticipant.email && !externalParticipant.name) return toast.error('Email atau nama wajib diisi');
    setParticipants(p => [...p, { ...externalParticipant, role: 'participant' }]);
    setExternalParticipant({ email: '', name: '', phone: '', jabatan: '' });
    setShowExternal(false);
  };

  const removeParticipant = (idx) => setParticipants(p => p.filter((_, i) => i !== idx));

  const addAgenda = () => setAgendas(a => [...a, { title: '', description: '', duration_minutes: '', pic_name: '' }]);
  const removeAgenda = (idx) => setAgendas(a => a.filter((_, i) => i !== idx));
  const updateAgenda = (idx, field, value) => setAgendas(a => a.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.meeting_date || !form.start_time) {
      return toast.error('Judul, tanggal, dan waktu wajib diisi');
    }
    setLoading(true);
    try {
      const res = await api.post('/meetings', {
        ...form,
        participants,
        agendas: agendas.filter(a => a.title),
      });
      toast.success('Rapat berhasil dibuat!');
      navigate(`/meetings/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuat rapat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Buat Rapat Baru</h1>
        <p className="text-gray-500 text-sm mt-1">Isi informasi rapat dan undang peserta</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Informasi Rapat</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Judul Rapat *</label>
            <input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Contoh: Rapat Evaluasi Bulanan" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
            <textarea className="input-field" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Deskripsi singkat mengenai rapat ini..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
              <input type="date" className="input-field" value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mulai *</label>
              <input type="time" className="input-field" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selesai</label>
              <input type="time" className="input-field" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Rapat</label>
            <div className="flex gap-3">
              {[
                { value: 'offline', label: 'Offline' },
                { value: 'online', label: 'Online' },
                { value: 'hybrid', label: 'Hybrid' },
              ].map(opt => (
                <label key={opt.value} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${form.meeting_type === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" value={opt.value} checked={form.meeting_type === opt.value} onChange={e => setForm(f => ({ ...f, meeting_type: e.target.value }))} className="hidden" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {(form.meeting_type === 'offline' || form.meeting_type === 'hybrid') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
              <input className="input-field" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Ruang rapat / alamat" />
            </div>
          )}
          {(form.meeting_type === 'online' || form.meeting_type === 'hybrid') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link Online</label>
              <input className="input-field" value={form.online_link} onChange={e => setForm(f => ({ ...f, online_link: e.target.value }))} placeholder="https://meet.google.com/..." />
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Peserta Rapat</h2>

          {/* Search registered users */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cari Pengguna Terdaftar</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input-field pl-9"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Ketik nama atau email..."
              />
            </div>
            {userResults.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {userResults.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => addParticipant(u)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-bold">
                      {u.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.full_name}</p>
                      <p className="text-xs text-gray-500">{u.jabatan} · {u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* External participant */}
          {showExternal ? (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Peserta Eksternal (bukan pengguna terdaftar)</p>
              <div className="grid grid-cols-2 gap-3">
                <input className="input-field" value={externalParticipant.name} onChange={e => setExternalParticipant(p => ({ ...p, name: e.target.value }))} placeholder="Nama lengkap" />
                <input className="input-field" value={externalParticipant.jabatan} onChange={e => setExternalParticipant(p => ({ ...p, jabatan: e.target.value }))} placeholder="Jabatan" />
                <input className="input-field" value={externalParticipant.email} onChange={e => setExternalParticipant(p => ({ ...p, email: e.target.value }))} placeholder="Email" />
                <input className="input-field" value={externalParticipant.phone} onChange={e => setExternalParticipant(p => ({ ...p, phone: e.target.value }))} placeholder="No. WhatsApp" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={addExternalParticipant} className="btn-primary text-sm">Tambahkan</button>
                <button type="button" onClick={() => setShowExternal(false)} className="btn-secondary text-sm">Batal</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowExternal(true)} className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700">
              <UserPlus size={16} /> Tambah Peserta Eksternal
            </button>
          )}

          {/* Participant list */}
          {participants.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">{participants.length} peserta ditambahkan</p>
              {participants.map((p, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-bold">
                    {(p.name || p.email)?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name || '-'}</p>
                    <input
                      className="text-xs text-gray-500 border border-gray-200 rounded px-2 py-0.5 w-full mt-0.5 focus:outline-none focus:border-indigo-400"
                      value={p.jabatan || ''}
                      onChange={e => setParticipants(ps => ps.map((pp, i) => i === idx ? { ...pp, jabatan: e.target.value } : pp))}
                      placeholder="Jabatan (opsional)"
                    />
                  </div>
                  <select
                    value={p.role}
                    onChange={e => setParticipants(ps => ps.map((pp, i) => i === idx ? { ...pp, role: e.target.value } : pp))}
                    className="text-xs border border-gray-200 rounded px-2 py-1 flex-shrink-0"
                  >
                    <option value="participant">Peserta</option>
                    <option value="notulen">Notulen</option>
                    <option value="organizer">Panitia</option>
                  </select>
                  <button type="button" onClick={() => removeParticipant(idx)} className="text-red-400 hover:text-red-600">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agendas */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Agenda Rapat</h2>
            <button type="button" onClick={addAgenda} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
              <Plus size={16} /> Tambah Agenda
            </button>
          </div>

          {agendas.map((agenda, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                <div className="flex-1">
                  <input
                    className="input-field"
                    value={agenda.title}
                    onChange={e => updateAgenda(idx, 'title', e.target.value)}
                    placeholder="Judul agenda..."
                  />
                </div>
                {agendas.length > 1 && (
                  <button type="button" onClick={() => removeAgenda(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input-field text-sm"
                  value={agenda.description}
                  onChange={e => updateAgenda(idx, 'description', e.target.value)}
                  placeholder="Deskripsi (opsional)"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input-field text-sm"
                    value={agenda.duration_minutes}
                    onChange={e => updateAgenda(idx, 'duration_minutes', e.target.value)}
                    placeholder="Durasi (menit)"
                    min={0}
                  />
                  <input
                    className="input-field text-sm"
                    value={agenda.pic_name}
                    onChange={e => updateAgenda(idx, 'pic_name', e.target.value)}
                    placeholder="PIC"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Batal</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Membuat Rapat...' : 'Buat Rapat'}
          </button>
        </div>
      </form>
    </div>
  );
}
