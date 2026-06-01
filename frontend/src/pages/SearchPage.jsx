import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Search, Calendar, MapPin, Users, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const statusConfig = {
  scheduled: { label: 'Terjadwal', class: 'bg-blue-50 text-blue-700' },
  ongoing: { label: 'Berlangsung', class: 'bg-green-50 text-green-700' },
  completed: { label: 'Selesai', class: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Dibatalkan', class: 'bg-red-50 text-red-600' },
};

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchTimeout = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      doSearch(query);
    }, 400);
  }, [query]);

  const doSearch = async (q) => {
    setLoading(true);
    try {
      const res = await api.get(`/meetings/search?q=${encodeURIComponent(q)}`);
      setResults(res.data);
      setSearched(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cari Rapat</h1>
        <p className="text-gray-500 text-sm mt-1">Cari berdasarkan judul, topik, atau isi notulen</p>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          className="w-full pl-12 pr-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
          placeholder="Ketik kata kunci rapat, topik, atau hasil rapat..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500" />
          </div>
        )}
      </div>

      {/* Results */}
      {!query && (
        <div className="text-center py-16 text-gray-400">
          <Search size={48} className="mx-auto mb-3 opacity-30" />
          <p>Mulai ketik untuk mencari rapat</p>
          <p className="text-xs mt-1">Pencarian meliputi judul, deskripsi, dan isi notulen</p>
        </div>
      )}

      {searched && results.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🔍</div>
          <p className="font-medium">Tidak ada hasil untuk "{query}"</p>
          <p className="text-xs mt-1">Coba kata kunci lain</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{results.length} rapat ditemukan untuk "{query}"</p>
          {results.map(meeting => {
            const status = statusConfig[meeting.status] || statusConfig.scheduled;
            return (
              <div
                key={meeting.id}
                onClick={() => navigate(`/meetings/${meeting.id}`)}
                className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{meeting.title}</h3>
                    {meeting.creator_name && (
                      <p className="text-xs text-gray-400">oleh {meeting.creator_name}</p>
                    )}
                  </div>
                  <span className={`badge ml-2 flex-shrink-0 ${status.class}`}>{status.label}</span>
                </div>
                {meeting.description && (
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">{meeting.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {format(parseISO(meeting.meeting_date), 'dd MMM yyyy', { locale: idLocale })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {meeting.start_time?.slice(0, 5)}
                  </span>
                  {meeting.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {meeting.location}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
