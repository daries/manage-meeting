import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { ChevronRight } from 'lucide-react';

export default function MeetingEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    api.get(`/meetings/${id}`).then(res => {
      const m = res.data;
      setForm({
        title: m.title || '',
        description: m.description || '',
        meeting_date: m.meeting_date?.slice(0, 10) || '',
        start_time: m.start_time?.slice(0, 5) || '',
        end_time: m.end_time?.slice(0, 5) || '',
        location: m.location || '',
        meeting_type: m.meeting_type || 'offline',
        online_link: m.online_link || '',
        status: m.status || 'scheduled',
      });
    }).catch(() => navigate('/dashboard'));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/meetings/${id}`, form);
      toast.success('Rapat berhasil diperbarui');
      navigate(`/meetings/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui');
    } finally {
      setLoading(false);
    }
  };

  if (!form) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Rapat</h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Judul Rapat *</label>
          <input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
          <textarea className="input-field" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
            <input type="date" className="input-field" value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mulai</label>
            <input type="time" className="input-field" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Selesai</label>
            <input type="time" className="input-field" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Rapat</label>
          <div className="flex gap-3">
            {[{value:'offline',label:'Offline'},{value:'online',label:'Online'},{value:'hybrid',label:'Hybrid'}].map(opt => (
              <label key={opt.value} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer ${form.meeting_type === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200'}`}>
                <input type="radio" value={opt.value} checked={form.meeting_type === opt.value} onChange={e => setForm(f => ({ ...f, meeting_type: e.target.value }))} className="hidden" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        {(form.meeting_type !== 'online') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
            <input className="input-field" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
        )}
        {(form.meeting_type !== 'offline') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link Online</label>
            <input className="input-field" value={form.online_link} onChange={e => setForm(f => ({ ...f, online_link: e.target.value }))} />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="scheduled">Terjadwal</option>
            <option value="ongoing">Berlangsung</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Batal</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}
