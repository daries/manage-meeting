import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Calendar, MapPin, Users, Video, Building } from 'lucide-react';

const statusConfig = {
  scheduled: { label: 'Terjadwal', class: 'bg-blue-50 text-blue-700' },
  ongoing: { label: 'Berlangsung', class: 'bg-green-50 text-green-700' },
  completed: { label: 'Selesai', class: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Dibatalkan', class: 'bg-red-50 text-red-600' },
};

export default function MeetingCard({ meeting, onClick }) {
  const status = statusConfig[meeting.status] || statusConfig.scheduled;
  const date = parseISO(meeting.meeting_date);

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-3">
          <h3 className="font-semibold text-gray-900 truncate">{meeting.title}</h3>
          {meeting.creator_name && (
            <p className="text-xs text-gray-400 mt-0.5">oleh {meeting.creator_name}</p>
          )}
        </div>
        <span className={`badge flex-shrink-0 ${status.class}`}>{status.label}</span>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar size={14} className="text-gray-400" />
          <span>{format(date, 'dd MMMM yyyy', { locale: idLocale })} · {meeting.start_time?.slice(0, 5)}</span>
        </div>
        {(meeting.location || meeting.online_link) && (
          <div className="flex items-center gap-2 text-gray-600">
            {meeting.meeting_type === 'online' ? <Video size={14} className="text-gray-400" /> : <MapPin size={14} className="text-gray-400" />}
            <span className="truncate">{meeting.location || meeting.online_link}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-gray-600">
          <Users size={14} className="text-gray-400" />
          <span>{meeting.participant_count || 0} peserta · {meeting.attendance_count || 0} hadir</span>
        </div>
      </div>
    </div>
  );
}
