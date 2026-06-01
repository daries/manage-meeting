import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { ChevronRight, Lock, CheckCircle, XCircle, Plus, Send, Save, Trash2, Download, Mail } from 'lucide-react';
import RichTextEditor from '../components/RichTextEditor';

export default function MeetingMinutesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAgenda, setSelectedAgenda] = useState('general');
  const [editMode, setEditMode] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingPdf, setSendingPdf] = useState(false);

  // Minutes form state
  const [minutesForms, setMinutesForms] = useState({});

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const res = await api.get(`/minutes/${id}`);
      setData(res.data);

      // Initialize forms from existing minutes
      const forms = {};
      forms['general'] = { summary: '', discussion: '', decisions: '', action_items: [] };
      res.data.minutes.forEach(m => {
        const key = m.agenda_id || 'general';
        forms[key] = {
          summary: m.summary || '',
          discussion: m.discussion || '',
          decisions: m.decisions || '',
          action_items: m.action_items || [],
        };
      });
      setMinutesForms(forms);
    } catch (err) {
      toast.error('Gagal memuat notulen');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const saveMinutes = async (agendaId) => {
    setSaving(true);
    const formKey = agendaId || 'general';
    const formData = minutesForms[formKey] || { summary: '', discussion: '', decisions: '', action_items: [] };

    try {
      await api.post(`/minutes/${id}`, {
        agenda_id: agendaId === 'general' ? null : agendaId,
        ...formData,
      });
      toast.success('Notulen disimpan!');
      loadData();
      setEditMode(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (approved, notes = '') => {
    try {
      await api.post(`/minutes/${id}/approve`, { approved, notes });
      toast.success(approved ? 'Notulen disetujui!' : 'Notulen ditolak');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses persetujuan');
    }
  };

  const sendReviewNotif = async () => {
    try {
      await api.post(`/minutes/${id}/send-review`);
      toast.success('Notifikasi review dikirim ke semua peserta!');
    } catch (err) {
      toast.error('Gagal mengirim notifikasi');
    }
  };

  const downloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await api.get(`/minutes/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Notulen_${data?.meeting?.title?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Gagal mengunduh PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const sendPdf = async () => {
    setSendingPdf(true);
    try {
      await api.post(`/minutes/${id}/send-pdf`);
      toast.success('PDF notulen berhasil dikirim ke semua peserta!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim PDF');
    } finally {
      setSendingPdf(false);
    }
  };

  const updateForm = (key, field, value) => {
    setMinutesForms(f => ({
      ...f,
      [key]: { ...(f[key] || {}), [field]: value }
    }));
  };

  const addActionItem = (key) => {
    const current = minutesForms[key]?.action_items || [];
    updateForm(key, 'action_items', [...current, { task: '', pic: '', deadline: '' }]);
  };

  const updateActionItem = (key, idx, field, value) => {
    const items = [...(minutesForms[key]?.action_items || [])];
    items[idx] = { ...items[idx], [field]: value };
    updateForm(key, 'action_items', items);
  };

  const removeActionItem = (key, idx) => {
    const items = (minutesForms[key]?.action_items || []).filter((_, i) => i !== idx);
    updateForm(key, 'action_items', items);
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );

  if (!data) return null;

  const { meeting, minutes, approvals, participants, userApproval } = data;
  const isOrganizer = meeting.created_by === user?.id;
  const isParticipant = participants.some(p => p.user_id === user?.id);
  const locked = meeting.minutes_locked;

  const agendas = data.meeting?.agendas || [];
  const tabs = [
    { id: 'general', label: 'Umum' },
    ...agendas.map(a => ({ id: a.id, label: `${a.order_number}. ${a.title.slice(0, 20)}${a.title.length > 20 ? '...' : ''}` }))
  ];

  const currentMinutes = minutes.find(m =>
    selectedAgenda === 'general' ? !m.agenda_id : m.agenda_id === selectedAgenda
  );

  const formKey = selectedAgenda;
  const form = minutesForms[formKey] || { summary: '', discussion: '', decisions: '', action_items: [] };
  const canEdit = !locked && (isOrganizer || isParticipant);

  const approvedCount = approvals.filter(a => a.approved).length;
  const totalRequired = participants.length;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Notulen Rapat</h1>
          <p className="text-gray-500 text-sm">{meeting.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {locked && (
            <span className="badge bg-green-100 text-green-700 flex items-center gap-1">
              <Lock size={12} /> Final
            </span>
          )}
          <button
            onClick={downloadPdf}
            disabled={downloadingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 text-sm font-medium disabled:opacity-50"
          >
            <Download size={14} />
            {downloadingPdf ? 'Memproses...' : 'Unduh PDF'}
          </button>
        </div>
      </div>

      {/* Approval status */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">Status Persetujuan</h3>
          <span className="text-sm text-gray-500">{approvedCount}/{totalRequired} setuju</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: totalRequired > 0 ? `${(approvedCount / totalRequired) * 100}%` : '0%' }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {participants.map(p => {
            const approval = approvals.find(a => a.user_id === p.user_id);
            return (
              <div key={p.user_id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
                approval?.approved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {approval?.approved ? <CheckCircle size={12} /> : <span className="w-3 h-3 rounded-full border border-gray-400 inline-block" />}
                <span>{p.name}{p.jabatan ? <span className="opacity-70"> — {p.jabatan}</span> : ''}</span>
              </div>
            );
          })}
        </div>

        {/* Tanda tangan (hanya tampil saat Final) */}
        {locked && approvals.filter(a => a.approved).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-3">Tanda Tangan Persetujuan</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {approvals.filter(a => a.approved).map(a => {
                const p = participants.find(pp => pp.user_id === a.user_id);
                return (
                  <div key={a.user_id} className="text-center">
                    <div className="h-10 border-b border-gray-400 mb-1" />
                    <p className="text-xs font-medium text-gray-800">{p?.name || a.full_name}</p>
                    {p?.jabatan && <p className="text-xs text-gray-500">{p.jabatan}</p>}
                    <p className="text-xs text-green-600 mt-0.5">
                      {a.approved_at ? new Date(a.approved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Current user action */}
        {isParticipant && !locked && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {userApproval?.approved ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle size={16} />
                <span>Anda sudah menyetujui notulen ini</span>
                <button onClick={() => handleApprove(false)} className="ml-auto text-gray-500 hover:text-red-500 text-xs">Batalkan</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => handleApprove(true)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                  <CheckCircle size={15} /> Setujui Notulen
                </button>
                <button onClick={() => handleApprove(false)} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-sm">
                  <XCircle size={15} /> Tolak
                </button>
              </div>
            )}
          </div>
        )}

        {isOrganizer && (
          <div className="mt-3 flex flex-wrap gap-3">
            <button onClick={sendReviewNotif} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm">
              <Send size={14} /> Kirim notifikasi review
            </button>
            <button
              onClick={sendPdf}
              disabled={sendingPdf}
              className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm disabled:opacity-50"
            >
              <Mail size={14} /> {sendingPdf ? 'Mengirim...' : 'Kirim PDF ke semua peserta'}
            </button>
          </div>
        )}
      </div>

      {/* Agenda tabs */}
      {agendas.length > 0 && (
        <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setSelectedAgenda(tab.id); setEditMode(false); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                selectedAgenda === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Minutes form/view */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">
            {selectedAgenda === 'general' ? 'Notulen Umum' : tabs.find(t => t.id === selectedAgenda)?.label}
          </h3>
          {canEdit && !editMode && (
            <button onClick={() => setEditMode(true)} className="btn-secondary text-sm">Edit</button>
          )}
        </div>

        {!editMode ? (
          // View mode
          <div className="space-y-4 text-sm">
            {currentMinutes ? (
              <>
                {currentMinutes.summary && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">Ringkasan</p>
                    <div className="text-gray-600 notulen-content" dangerouslySetInnerHTML={{ __html: currentMinutes.summary }} />
                  </div>
                )}
                {currentMinutes.discussion && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">Jalannya Rapat / Diskusi</p>
                    <div className="text-gray-600 notulen-content" dangerouslySetInnerHTML={{ __html: currentMinutes.discussion }} />
                  </div>
                )}
                {currentMinutes.decisions && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">Keputusan / Hasil Rapat</p>
                    <div className="text-gray-600 notulen-content" dangerouslySetInnerHTML={{ __html: currentMinutes.decisions }} />
                  </div>
                )}
                {currentMinutes.action_items?.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-700 mb-2">Tindak Lanjut</p>
                    <div className="space-y-2">
                      {currentMinutes.action_items.map((item, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-3 flex items-start gap-2">
                          <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs flex-shrink-0">{idx + 1}</span>
                          <div>
                            <p className="font-medium">{item.task}</p>
                            {item.pic && <p className="text-gray-500 text-xs">PIC: {item.pic}</p>}
                            {item.deadline && <p className="text-gray-500 text-xs">Deadline: {item.deadline}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!currentMinutes.summary && !currentMinutes.discussion && !currentMinutes.decisions && (
                  <p className="text-gray-400 text-center py-4">Notulen belum diisi</p>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>Notulen untuk bagian ini belum diisi</p>
                {canEdit && (
                  <button onClick={() => setEditMode(true)} className="mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                    + Isi Notulen
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          // Edit mode
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ringkasan</label>
              <RichTextEditor
                value={form.summary}
                onChange={val => updateForm(formKey, 'summary', val)}
                placeholder="Ringkasan singkat rapat..."
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jalannya Rapat / Diskusi</label>
              <RichTextEditor
                value={form.discussion}
                onChange={val => updateForm(formKey, 'discussion', val)}
                placeholder="Uraikan jalannya diskusi dan pembahasan..."
                rows={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Keputusan / Hasil Rapat</label>
              <RichTextEditor
                value={form.decisions}
                onChange={val => updateForm(formKey, 'decisions', val)}
                placeholder="Keputusan yang diambil dalam rapat..."
                rows={4}
              />
            </div>

            {/* Action items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Tindak Lanjut</label>
                <button type="button" onClick={() => addActionItem(formKey)} className="text-indigo-600 text-xs flex items-center gap-1">
                  <Plus size={12} /> Tambah
                </button>
              </div>
              {form.action_items?.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input className="input-field text-sm flex-1" value={item.task} onChange={e => updateActionItem(formKey, idx, 'task', e.target.value)} placeholder="Tugas / tindak lanjut" />
                  <input className="input-field text-sm w-28" value={item.pic} onChange={e => updateActionItem(formKey, idx, 'pic', e.target.value)} placeholder="PIC" />
                  <input type="date" className="input-field text-sm w-36" value={item.deadline} onChange={e => updateActionItem(formKey, idx, 'deadline', e.target.value)} />
                  <button type="button" onClick={() => removeActionItem(formKey, idx)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditMode(false)} className="btn-secondary flex-1">Batal</button>
              <button
                type="button"
                onClick={() => saveMinutes(selectedAgenda === 'general' ? null : selectedAgenda)}
                disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Save size={15} />
                {saving ? 'Menyimpan...' : 'Simpan Notulen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
