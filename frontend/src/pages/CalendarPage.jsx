import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  CalendarDays, Plus, Trash2, RefreshCw, Copy, Check,
  ExternalLink, ChevronDown, ChevronUp, Info
} from 'lucide-react';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'id': localeId },
});

const STATUS_COLORS = {
  scheduled: '#4F46E5',
  ongoing:   '#059669',
  completed: '#6B7280',
  cancelled: '#DC2626',
};

const PALETTE = ['#4F46E5','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#0EA5E9','#F97316'];

export default function CalendarPage() {
  const navigate   = useNavigate();
  const [events,   setEvents]   = useState([]);
  const [view,     setView]     = useState(Views.MONTH);
  const [date,     setDate]     = useState(new Date());
  const [loading,  setLoading]  = useState(true);

  const [icalUrl,  setIcalUrl]  = useState('');
  const [copied,   setCopied]   = useState(false);

  const [extCals,      setExtCals]      = useState([]);
  const [extEvents,    setExtEvents]    = useState([]);
  const [addingCal,    setAddingCal]    = useState(false);
  const [calForm,      setCalForm]      = useState({ name: '', ical_url: '', color: '#10B981' });
  const [syncing,      setSyncing]      = useState({});
  const [showPanel,    setShowPanel]    = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadMeetings(), loadIcalToken(), loadExternalCals()]);
    setLoading(false);
  }

  async function loadMeetings() {
    try {
      const res = await api.get('/meetings?limit=200');
      const meetings = res.data.meetings || res.data || [];
      setEvents(meetings.map(m => {
        const dateStr = m.meeting_date?.slice(0, 10) || '';
        const start = new Date(`${dateStr}T${m.start_time || '00:00'}`);
        const end   = m.end_time
          ? new Date(`${dateStr}T${m.end_time}`)
          : new Date(start.getTime() + 60 * 60 * 1000);
        return {
          id:       m.id,
          title:    m.title,
          start,
          end,
          resource: m,
          type:     'meeting',
          color:    STATUS_COLORS[m.status] || STATUS_COLORS.scheduled,
        };
      }));
    } catch (err) {
      toast.error('Gagal memuat jadwal rapat');
    }
  }

  async function loadIcalToken() {
    try {
      const res = await api.get('/calendar/token');
      setIcalUrl(res.data.url);
    } catch {}
  }

  async function loadExternalCals() {
    try {
      const res = await api.get('/calendar/external');
      setExtCals(res.data);
      // Load events from each external calendar
      const allExtEvents = await Promise.all(
        res.data.map(cal => fetchExtEvents(cal).catch(() => []))
      );
      setExtEvents(allExtEvents.flat());
    } catch {}
  }

  async function fetchExtEvents(cal) {
    try {
      const res = await api.get(`/calendar/external/${cal.id}/events`);
      return res.data;
    } catch {
      return [];
    }
  }

  async function addExternalCal() {
    if (!calForm.name || !calForm.ical_url) {
      toast.error('Nama dan URL iCal wajib diisi');
      return;
    }
    setSyncing(s => ({ ...s, adding: true }));
    try {
      const res = await api.post('/calendar/external', calForm);
      setExtCals(c => [...c, res.data]);
      setCalForm({ name: '', ical_url: '', color: '#10B981' });
      setAddingCal(false);
      toast.success('Kalender ditambahkan!');
      // Load events for the new calendar
      const evs = await fetchExtEvents(res.data);
      setExtEvents(e => [...e, ...evs]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambahkan kalender');
    } finally {
      setSyncing(s => ({ ...s, adding: false }));
    }
  }

  async function syncExtCal(cal) {
    setSyncing(s => ({ ...s, [cal.id]: true }));
    try {
      const evs = await fetchExtEvents(cal);
      setExtEvents(prev => [...prev.filter(e => e.calendarId !== cal.id), ...evs]);
      setExtCals(c => c.map(c2 => c2.id === cal.id ? { ...c2, last_synced: new Date().toISOString() } : c2));
      toast.success('Kalender disinkronkan!');
    } catch {
      toast.error('Gagal sinkronisasi');
    } finally {
      setSyncing(s => ({ ...s, [cal.id]: false }));
    }
  }

  async function deleteExtCal(id) {
    try {
      await api.delete(`/calendar/external/${id}`);
      setExtCals(c => c.filter(c2 => c2.id !== id));
      setExtEvents(e => e.filter(ev => ev.calendarId !== id));
      toast.success('Kalender dihapus');
    } catch {
      toast.error('Gagal menghapus');
    }
  }

  function copyIcalUrl() {
    navigator.clipboard.writeText(icalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const allEvents = [
    ...events,
    ...extEvents.map(e => ({
      ...e,
      type: 'external',
    })),
  ];

  const eventStyleGetter = useCallback((event) => ({
    style: {
      backgroundColor: event.color || '#4F46E5',
      borderRadius: '4px',
      border: 'none',
      color: 'white',
      fontSize: '12px',
      padding: '1px 4px',
      opacity: event.type === 'external' ? 0.85 : 1,
    }
  }), []);

  const handleSelectEvent = useCallback((event) => {
    if (event.type === 'meeting') navigate(`/meetings/${event.id}`);
  }, [navigate]);

  const messages = {
    today: 'Hari Ini', previous: '‹', next: '›',
    month: 'Bulan', week: 'Minggu', day: 'Hari', agenda: 'Agenda',
    noEventsInRange: 'Tidak ada jadwal.',
    showMore: n => `+${n} lainnya`,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={22} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Kalender</h1>
        </div>
        <button
          onClick={() => setShowPanel(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 text-sm font-medium"
        >
          <Plus size={14} />
          Kelola Kalender
          {showPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Panel kelola kalender */}
      {showPanel && (
        <div className="card space-y-5">
          {/* iCal Subscription */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
              <CalendarDays size={15} className="text-indigo-600" />
              Langganan Kalender (iCal)
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Salin URL di bawah dan tambahkan ke Google Calendar, Outlook, atau Apple Calendar untuk melihat jadwal rapat Anda di sana secara otomatis.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={icalUrl}
                className="input-field text-xs font-mono flex-1 bg-gray-50"
              />
              <button onClick={copyIcalUrl} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${copied ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                {copied ? <><Check size={14} /> Tersalin</> : <><Copy size={14} /> Salin</>}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <a href={`https://calendar.google.com/calendar/r/settings/addbyurl?url=${encodeURIComponent(icalUrl)}`} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                <ExternalLink size={12} /> Buka di Google Calendar
              </a>
              <a href={`webcal://${icalUrl.replace(/^https?:\/\//, '')}`}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                <ExternalLink size={12} /> Buka di Apple Calendar
              </a>
              <button onClick={() => { navigator.clipboard.writeText(icalUrl); toast.success('URL disalin untuk Outlook'); }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50">
                <Copy size={12} /> Salin untuk Outlook
              </button>
            </div>
            <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Info size={12} className="mt-0.5 flex-shrink-0" />
              <span>URL ini bersifat pribadi. Jangan bagikan ke orang lain karena berisi seluruh jadwal rapat Anda.</span>
            </div>
          </div>

          {/* Kalender Eksternal */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
                <Plus size={15} className="text-indigo-600" />
                Kalender dari Akun Lain
              </h3>
              <button
                onClick={() => setAddingCal(a => !a)}
                className="text-indigo-600 text-sm hover:text-indigo-700 flex items-center gap-1"
              >
                <Plus size={14} /> Tambah
              </button>
            </div>

            {addingCal && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3 space-y-3">
                <p className="text-xs text-gray-500">
                  Masukkan URL iCal dari Google Calendar (Setelan → ID Kalender → Format iCal), Outlook, atau layanan kalender lainnya.
                </p>
                <input className="input-field text-sm" placeholder="Nama kalender (mis. Kalender Kerja)" value={calForm.name}
                  onChange={e => setCalForm(f => ({ ...f, name: e.target.value }))} />
                <input className="input-field text-sm font-mono" placeholder="https://calendar.google.com/calendar/ical/..." value={calForm.ical_url}
                  onChange={e => setCalForm(f => ({ ...f, ical_url: e.target.value }))} />
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-600">Warna:</label>
                  <div className="flex gap-1.5">
                    {PALETTE.map(c => (
                      <button key={c} onClick={() => setCalForm(f => ({ ...f, color: c }))}
                        className={`w-6 h-6 rounded-full transition-transform ${calForm.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddingCal(false)} className="btn-secondary text-sm flex-1">Batal</button>
                  <button onClick={addExternalCal} disabled={syncing.adding} className="btn-primary text-sm flex-1 flex items-center justify-center gap-1.5">
                    {syncing.adding ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                    {syncing.adding ? 'Memverifikasi...' : 'Tambahkan'}
                  </button>
                </div>
              </div>
            )}

            {extCals.length === 0 && !addingCal && (
              <p className="text-sm text-gray-400 text-center py-3">Belum ada kalender eksternal.</p>
            )}

            <div className="space-y-2">
              {extCals.map(cal => (
                <div key={cal.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cal.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{cal.name}</p>
                    {cal.last_synced && (
                      <p className="text-xs text-gray-400">
                        Sinkron {new Date(cal.last_synced).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <button onClick={() => syncExtCal(cal)} disabled={syncing[cal.id]} title="Sinkronkan"
                    className="p-1.5 text-gray-500 hover:text-indigo-600 rounded hover:bg-indigo-50 disabled:opacity-50">
                    <RefreshCw size={14} className={syncing[cal.id] ? 'animate-spin' : ''} />
                  </button>
                  <button onClick={() => deleteExtCal(cal.id)} title="Hapus"
                    className="p-1.5 text-gray-500 hover:text-red-600 rounded hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries({ scheduled: 'Terjadwal', ongoing: 'Berlangsung', completed: 'Selesai', cancelled: 'Dibatalkan' }).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: STATUS_COLORS[k] }} />
            {v}
          </span>
        ))}
        {extCals.map(cal => (
          <span key={cal.id} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: cal.color }} />
            {cal.name}
          </span>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        {loading ? (
          <div className="flex justify-center items-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={allEvents}
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            messages={messages}
            culture="id"
            style={{ height: 620 }}
            popup
          />
        )}
      </div>
    </div>
  );
}
