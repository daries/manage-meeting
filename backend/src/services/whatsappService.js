const axios = require('axios');
require('dotenv').config();

const FONNTE_API_URL = 'https://api.fonnte.com/send';
const FONNTE_TOKEN = process.env.FONNTE_TOKEN;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

function formatPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

const waMessages = {
  invitation: (data) => `
*UNDANGAN RAPAT*

Halo ${data.recipientName},

Anda diundang untuk menghadiri rapat:

📌 *${data.meetingTitle}*
📅 *Tanggal:* ${data.meetingDate}
⏰ *Waktu:* ${data.startTime}${data.endTime ? ' - ' + data.endTime : ''}
📍 *Tempat:* ${data.location || data.onlineLink || '-'}
👤 *Penyelenggara:* ${data.organizerName}

${data.agendas && data.agendas.length > 0 ? `📋 *Agenda:*\n${data.agendas.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}\n` : ''}
Silakan isi presensi Anda melalui link berikut:
${APP_URL}/attend/${data.attendanceToken}

_Pesan ini dikirim otomatis oleh Sistem Manajemen Rapat_`.trim(),

  reminder: (data) => `
*⏰ PENGINGAT RAPAT*

Halo ${data.recipientName},

Rapat akan segera dimulai *${data.timeLeft}*!

📌 *${data.meetingTitle}*
📅 *${data.meetingDate}*
⏰ *${data.startTime}*
📍 *${data.location || data.onlineLink || '-'}*

Jangan lupa isi presensi:
${APP_URL}/attend/${data.attendanceToken}`.trim(),

  minutesReview: (data) => `
*📝 NOTULEN RAPAT*

Halo ${data.recipientName},

Notulen rapat *"${data.meetingTitle}"* telah dibuat dan memerlukan persetujuan Anda.

Silakan review dan setujui melalui:
${APP_URL}/meetings/${data.meetingId}/minutes

_Notulen baru dapat diedit setelah semua peserta menyetujui._`.trim(),

  agendaReminder: (data) => `
*📋 PENGINGAT AGENDA*

Halo ${data.recipientName},

Anda memiliki agenda rapat yang perlu dipersiapkan:

📌 *${data.meetingTitle}*
📅 *${data.meetingDate}* | ⏰ *${data.startTime}*

Agenda Anda:
${data.agendas.map((a, i) => `${i + 1}. ${a.title}`).join('\n')}

Pastikan Anda sudah mempersiapkan materi dengan baik!`.trim(),
};

async function sendWhatsApp(phone, type, data) {
  const formattedPhone = formatPhoneNumber(phone);
  if (!formattedPhone) {
    return { success: false, error: 'Nomor telepon tidak valid' };
  }

  if (!FONNTE_TOKEN) {
    console.log(`[WA SIMULATION] To: ${formattedPhone}, Type: ${type}`);
    return { success: true, simulated: true };
  }

  try {
    const message = waMessages[type](data);
    const response = await axios.post(
      FONNTE_API_URL,
      {
        target: formattedPhone,
        message: message,
        countryCode: '62',
      },
      {
        headers: {
          Authorization: FONNTE_TOKEN,
        },
      }
    );

    if (response.data.status) {
      return { success: true, id: response.data.id };
    } else {
      return { success: false, error: response.data.reason };
    }
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendWhatsApp, formatPhoneNumber };
