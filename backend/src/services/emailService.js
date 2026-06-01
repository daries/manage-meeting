const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'rapat@yourdomain.com';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

const emailTemplates = {
  invitation: (data) => ({
    subject: `Undangan Rapat: ${data.meetingTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background: #4F46E5; color: white; display: inline-block; padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">UNDANGAN RAPAT</div>
          </div>
          <h2 style="color: #1F2937; margin-bottom: 8px;">${data.meetingTitle}</h2>
          <p style="color: #6B7280;">Anda diundang untuk menghadiri rapat berikut:</p>
          <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #6B7280; width: 30%;">Tanggal</td><td style="padding: 6px 0; color: #1F2937; font-weight: 600;">${data.meetingDate}</td></tr>
              <tr><td style="padding: 6px 0; color: #6B7280;">Waktu</td><td style="padding: 6px 0; color: #1F2937; font-weight: 600;">${data.startTime} - ${data.endTime || 'Selesai'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6B7280;">Tempat</td><td style="padding: 6px 0; color: #1F2937; font-weight: 600;">${data.location || data.onlineLink || '-'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6B7280;">Penyelenggara</td><td style="padding: 6px 0; color: #1F2937; font-weight: 600;">${data.organizerName}</td></tr>
            </table>
          </div>
          ${data.description ? `<p style="color: #374151; margin-bottom: 16px;"><strong>Deskripsi:</strong><br>${data.description}</p>` : ''}
          ${data.agendas && data.agendas.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <strong style="color: #374151;">Agenda:</strong>
              <ol style="margin: 8px 0; padding-left: 20px; color: #374151;">
                ${data.agendas.map(a => `<li style="margin-bottom: 4px;">${a.title}</li>`).join('')}
              </ol>
            </div>
          ` : ''}
          <div style="text-align: center; margin-top: 28px;">
            <a href="${APP_URL}/attend/${data.attendanceToken}"
               style="background: #4F46E5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Isi Presensi
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 24px;">
            Link presensi: ${APP_URL}/attend/${data.attendanceToken}
          </p>
        </div>
      </div>
    `
  }),

  reminder: (data) => ({
    subject: `Reminder: Rapat "${data.meetingTitle}" ${data.timeLeft}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background: #F59E0B; color: white; display: inline-block; padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">PENGINGAT RAPAT</div>
          </div>
          <h2 style="color: #1F2937;">${data.meetingTitle}</h2>
          <p style="color: #6B7280;">Rapat akan dimulai <strong style="color: #F59E0B;">${data.timeLeft}</strong></p>
          <div style="background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #92400E; width: 30%;">Tanggal</td><td style="padding: 6px 0; color: #78350F; font-weight: 600;">${data.meetingDate}</td></tr>
              <tr><td style="padding: 6px 0; color: #92400E;">Waktu</td><td style="padding: 6px 0; color: #78350F; font-weight: 600;">${data.startTime}</td></tr>
              <tr><td style="padding: 6px 0; color: #92400E;">Tempat</td><td style="padding: 6px 0; color: #78350F; font-weight: 600;">${data.location || data.onlineLink || '-'}</td></tr>
            </table>
          </div>
          <div style="text-align: center; margin-top: 28px;">
            <a href="${APP_URL}/attend/${data.attendanceToken}"
               style="background: #4F46E5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Isi Presensi
            </a>
          </div>
        </div>
      </div>
    `
  }),

  minutesReview: (data) => ({
    subject: `Notulen Rapat Perlu Persetujuan: ${data.meetingTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background: #10B981; color: white; display: inline-block; padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">NOTULEN RAPAT</div>
          </div>
          <h2 style="color: #1F2937;">${data.meetingTitle}</h2>
          <p style="color: #6B7280;">Notulen rapat telah dibuat dan memerlukan persetujuan Anda. Silakan review dan setujui notulen berikut:</p>
          <div style="text-align: center; margin-top: 28px;">
            <a href="${APP_URL}/meetings/${data.meetingId}/minutes"
               style="background: #10B981; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Review & Setujui Notulen
            </a>
          </div>
        </div>
      </div>
    `
  }),

  forgotPassword: (data) => ({
    subject: 'Reset Password - RapatKu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background: #F59E0B; color: white; display: inline-block; padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">RESET PASSWORD</div>
          </div>
          <h2 style="color: #1F2937; text-align: center;">Permintaan Reset Password</h2>
          <p style="color: #6B7280; text-align: center;">Halo, <strong style="color: #1F2937;">${data.fullName}</strong>!</p>
          <p style="color: #6B7280; text-align: center;">Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah untuk membuat password baru.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${data.resetUrl}"
               style="background: #F59E0B; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 15px;">
              Reset Password Saya
            </a>
          </div>
          <div style="background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="color: #92400E; font-size: 13px; margin: 0;">Atau salin link berikut ke browser Anda:</p>
            <p style="color: #D97706; font-size: 13px; word-break: break-all; margin: 4px 0 0;">${data.resetUrl}</p>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 24px;">
            Link ini berlaku selama <strong>1 jam</strong>. Jika Anda tidak meminta reset password, abaikan email ini — akun Anda tetap aman.
          </p>
        </div>
      </div>
    `
  }),

  reactivation: (data) => ({
    subject: 'Reaktivasi Akun - RapatKu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background: #6366F1; color: white; display: inline-block; padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">REAKTIVASI AKUN</div>
          </div>
          <h2 style="color: #1F2937; text-align: center;">Aktifkan Kembali Akun Anda</h2>
          <p style="color: #6B7280; text-align: center;">Halo, <strong style="color: #1F2937;">${data.fullName}</strong>!</p>
          <p style="color: #6B7280; text-align: center;">Akun Anda saat ini tidak aktif. Klik tombol di bawah untuk mengaktifkan kembali akun dan masuk ke RapatKu.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${data.reactivationUrl}"
               style="background: #6366F1; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 15px;">
              Aktifkan Akun Saya
            </a>
          </div>
          <div style="background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="color: #4338CA; font-size: 13px; margin: 0;">Atau salin link berikut ke browser Anda:</p>
            <p style="color: #6366F1; font-size: 13px; word-break: break-all; margin: 4px 0 0;">${data.reactivationUrl}</p>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 24px;">
            Link ini berlaku selama <strong>24 jam</strong>. Jika Anda tidak meminta reaktivasi, abaikan email ini.
          </p>
        </div>
      </div>
    `
  }),

  emailVerification: (data) => ({
    subject: 'Konfirmasi Email - RapatKu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background: #4F46E5; color: white; display: inline-block; padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">KONFIRMASI EMAIL</div>
          </div>
          <h2 style="color: #1F2937; text-align: center;">Selamat datang di RapatKu!</h2>
          <p style="color: #6B7280; text-align: center;">Halo, <strong style="color: #1F2937;">${data.fullName}</strong>!</p>
          <p style="color: #6B7280; text-align: center;">Terima kasih telah mendaftar. Klik tombol di bawah ini untuk mengkonfirmasi alamat email Anda dan mengaktifkan akun.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${data.verificationUrl}"
               style="background: #4F46E5; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 15px;">
              Konfirmasi Email Saya
            </a>
          </div>
          <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 13px; margin: 0;">Atau salin link berikut ke browser Anda:</p>
            <p style="color: #4F46E5; font-size: 13px; word-break: break-all; margin: 4px 0 0;">${data.verificationUrl}</p>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 24px;">
            Link ini berlaku selama <strong>24 jam</strong>. Jika Anda tidak mendaftar di RapatKu, abaikan email ini.
          </p>
        </div>
      </div>
    `
  }),

  minutesPDF: (data) => ({
    subject: `Notulen Rapat: ${data.meetingTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="background: #4F46E5; color: white; display: inline-block; padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">NOTULEN RAPAT</div>
          </div>
          <h2 style="color: #1F2937;">Halo, ${data.recipientName}!</h2>
          <p style="color: #6B7280;">Notulen rapat <strong style="color: #1F2937;">${data.meetingTitle}</strong> terlampir dalam email ini.</p>
          <p style="color: #6B7280;">Anda juga dapat mengakses notulen secara online melalui tautan di bawah ini.</p>
          <div style="text-align: center; margin-top: 28px;">
            <a href="${APP_URL}/meetings/${data.meetingId}/minutes"
               style="background: #4F46E5; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Buka Notulen Online
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 24px;">
            File PDF notulen terlampir pada email ini.
          </p>
        </div>
      </div>
    `
  }),
};

async function sendEmail(to, type, data) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL SIMULATION] To: ${to}, Type: ${type}`);
    return { success: true, simulated: true };
  }

  try {
    const template = emailTemplates[type](data);
    const payload = {
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: template.subject,
      html: template.html,
    };

    if (data.pdfBuffer && data.pdfFilename) {
      payload.attachments = [{
        filename: data.pdfFilename,
        content: data.pdfBuffer.toString('base64'),
      }];
    }

    const result = await resend.emails.send(payload);
    return { success: true, id: result.id };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = { sendEmail };
