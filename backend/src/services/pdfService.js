const PDFDocument = require('pdfkit');
const { parse } = require('node-html-parser');
const { format } = require('date-fns');
const { id: localeId } = require('date-fns/locale');

const PRIMARY = '#4F46E5';
const DARK    = '#1F2937';
const GRAY    = '#6B7280';
const LIGHT   = '#F3F4F6';
const GREEN   = '#059669';
const L = 50;       // left margin
const R = 50;       // right margin

// ── Utilities ────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '-';
  try { return format(new Date(d), 'd MMMM yyyy', { locale: localeId }); } catch { return d; }
}
function fmtTime(t) { return t ? t.slice(0, 5) : '-'; }

function decodeEntities(str) {
  return (str || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function stripTags(html) {
  return decodeEntities((html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

// ── Section heading ──────────────────────────────────────────

function sectionTitle(doc, title, width) {
  if (doc.y > doc.page.height - 100) doc.addPage();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY)
    .text(title, L, doc.y, { width });
  const lineY = doc.y + 1;
  doc.moveTo(L, lineY).lineTo(L + width, lineY)
    .strokeColor(PRIMARY).lineWidth(1.5).stroke();
  doc.y = lineY + 8;
}

function fieldLabel(doc, label) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
    .text(label, L + 8, doc.y);
  doc.y += 2;
}

// ── HTML → PDF renderer ──────────────────────────────────────

function renderHtml(doc, html, indent, width, fs) {
  if (!html || html.trim() === '' || html === '<p></p>') return;
  const x = L + indent;
  const w = width - indent;
  const root = parse(html);
  renderNodes(doc, root.childNodes, x, w, fs);
}

function renderNodes(doc, nodes, x, width, fs) {
  for (const node of nodes) renderNode(doc, node, x, width, fs);
}

function renderNode(doc, node, x, width, fs) {
  const tag = node.tagName?.toLowerCase();

  if (!tag) {
    const text = decodeEntities(node.rawText || '').trim();
    if (text) {
      doc.font('Helvetica').fontSize(fs).fillColor(GRAY)
        .text(text, x, doc.y, { width });
    }
    return;
  }

  switch (tag) {
    case 'h1': {
      const t = stripTags(node.innerHTML);
      if (t) { doc.font('Helvetica-Bold').fontSize(fs + 4).fillColor(DARK).text(t, x, doc.y, { width }); doc.y += 4; }
      break;
    }
    case 'h2': {
      const t = stripTags(node.innerHTML);
      if (t) { doc.font('Helvetica-Bold').fontSize(fs + 2).fillColor(DARK).text(t, x, doc.y, { width }); doc.y += 3; }
      break;
    }
    case 'h3': {
      const t = stripTags(node.innerHTML);
      if (t) { doc.font('Helvetica-Bold').fontSize(fs + 1).fillColor('#374151').text(t, x, doc.y, { width }); doc.y += 2; }
      break;
    }
    case 'p': {
      const t = stripTags(node.innerHTML);
      if (t.trim()) {
        doc.font('Helvetica').fontSize(fs).fillColor('#374151').text(t, x, doc.y, { width });
        doc.y += 3;
      }
      break;
    }
    case 'ul': {
      node.querySelectorAll('li').forEach(li => {
        const t = stripTags(li.innerHTML);
        doc.font('Helvetica').fontSize(fs).fillColor('#374151')
          .text('• ' + t, x + 6, doc.y, { width: width - 6 });
      });
      doc.y += 3;
      break;
    }
    case 'ol': {
      node.querySelectorAll('li').forEach((li, i) => {
        const t = stripTags(li.innerHTML);
        doc.font('Helvetica').fontSize(fs).fillColor('#374151')
          .text(`${i + 1}. ${t}`, x + 6, doc.y, { width: width - 6 });
      });
      doc.y += 3;
      break;
    }
    case 'table': {
      renderTable(doc, node, x, width, fs);
      break;
    }
    case 'hr': {
      doc.moveTo(x, doc.y + 3).lineTo(x + width, doc.y + 3)
        .strokeColor('#D1D5DB').lineWidth(0.5).stroke();
      doc.y += 10;
      break;
    }
    case 'br': { doc.y += fs * 0.6; break; }
    case 'strong': case 'b': {
      const t = stripTags(node.innerHTML);
      if (t.trim()) doc.font('Helvetica-Bold').fontSize(fs).fillColor(DARK).text(t, x, doc.y, { width });
      break;
    }
    default:
      if (node.childNodes?.length) renderNodes(doc, node.childNodes, x, width, fs);
  }
}

function renderTable(doc, tableNode, x, maxWidth, fs) {
  const rows = tableNode.querySelectorAll('tr');
  if (!rows.length) return;

  const colCount = Math.max(...rows.map(r => r.querySelectorAll('td, th').length));
  if (!colCount) return;

  const colW  = maxWidth / colCount;
  const pad   = 4;
  let   curY  = doc.y;

  rows.forEach(row => {
    const cells    = row.querySelectorAll('td, th');
    const isHeader = row.querySelectorAll('th').length > 0;

    // Measure row height
    let rowH = fs + pad * 2;
    cells.forEach(cell => {
      doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs - 0.5);
      const h = doc.heightOfString(stripTags(cell.innerHTML), { width: colW - pad * 2 }) + pad * 2;
      if (h > rowH) rowH = h;
    });
    rowH = Math.max(rowH, 16);

    if (curY + rowH > doc.page.height - 60) { doc.addPage(); curY = 50; }

    // Draw cells
    cells.forEach((cell, i) => {
      const cx   = x + i * colW;
      const text = stripTags(cell.innerHTML);
      const fill = isHeader ? '#EEF2FF' : (Math.floor(rows.indexOf(row)) % 2 === 0 ? 'white' : '#F9FAFB');

      doc.rect(cx, curY, colW, rowH).fillAndStroke(fill, '#D1D5DB');
      doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fs - 0.5)
        .fillColor(isHeader ? DARK : '#374151')
        .text(text, cx + pad, curY + pad, { width: colW - pad * 2, lineBreak: true });
    });

    curY += rowH;
    doc.y = curY;
  });

  doc.y += 6;
}

// ── Main generator ────────────────────────────────────────────

function generateMinutesPDF(data) {
  return new Promise((resolve, reject) => {
    const { meeting, minutes, approvals, participants } = data;
    const doc = new PDFDocument({ margin: L, size: 'A4', bufferPages: true });
    const buffers = [];
    doc.on('data', c => buffers.push(c));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W      = doc.page.width - L - R;
    const locked = meeting.minutes_locked;

    // ── HEADER ─────────────────────────────────────────────
    const headerH = 52;
    doc.rect(L, 50, W, headerH).fill(PRIMARY);
    doc.font('Helvetica-Bold').fontSize(18).fillColor('white').text('NOTULEN RAPAT', L + 14, 60);
    doc.font('Helvetica').fontSize(9).fillColor('white').text('RapatKu — Sistem Manajemen Rapat', L + 14, 82);

    const badgeText  = locked ? 'FINAL' : 'DRAFT';
    const badgeColor = locked ? '#10B981'  : '#F59E0B';
    const badgeW = 62, badgeH = 18;
    const badgeX = L + W - badgeW - 8, badgeY = 50 + (headerH - badgeH) / 2;
    doc.rect(badgeX, badgeY, badgeW, badgeH).fill(badgeColor);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
      .text(badgeText, badgeX, badgeY + 5, { width: badgeW, align: 'center' });

    doc.y = 50 + headerH + 12;

    // ── MEETING TITLE ────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(14).fillColor(DARK)
      .text(meeting.title, L, doc.y, { width: W });
    doc.y += 10;

    // ── INFO BOX ─────────────────────────────────────────────
    const infoY = doc.y, infoH = 72;
    doc.rect(L, infoY, W, infoH).fill(LIGHT);

    const c1 = L + 12, c2 = L + W * 0.33, c3 = L + W * 0.63;
    const rl = infoY + 10, r2 = infoY + 40;

    const infoRow = (label, value, cx, row, maxW) => {
      doc.font('Helvetica').fontSize(7.5).fillColor(GRAY).text(label, cx, row);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
        .text(value, cx, row + 13, { width: maxW || 140, lineBreak: false });
    };

    infoRow('Tanggal',       fmtDate(meeting.meeting_date), c1, rl);
    infoRow('Waktu',         `${fmtTime(meeting.start_time)}${meeting.end_time ? ' – ' + fmtTime(meeting.end_time) : ''}`, c2, rl);
    infoRow('Tempat',        meeting.location || meeting.online_link || '-', c3, rl, W - (c3 - L) - 8);
    infoRow('Penyelenggara', meeting.creator_name || '-', c1, r2);
    infoRow('Status',        meeting.status?.toUpperCase() || '-', c2, r2);

    doc.y = infoY + infoH + 14;

    // ── PARTICIPANTS ──────────────────────────────────────────
    sectionTitle(doc, 'PESERTA RAPAT', W);

    participants.forEach((p, i) => {
      const approval = approvals.find(a => a.user_id === p.user_id);
      const approved = approval?.approved;
      const rowY = doc.y;

      if (i % 2 === 0) doc.rect(L, rowY - 1, W, 15).fill('#F9FAFB');

      doc.font('Helvetica').fontSize(9).fillColor(DARK)
        .text(`${i + 1}.  ${p.name}`, L + 8, rowY, { width: W * 0.65 });
      doc.font('Helvetica').fontSize(8).fillColor(approved ? GREEN : GRAY)
        .text(approved ? 'Disetujui' : 'Menunggu', L + W * 0.65, rowY, { width: W * 0.35 - 8, align: 'right' });

      doc.y = Math.max(doc.y, rowY + 13);
    });
    doc.y += 10;

    // ── MINUTES SECTIONS ─────────────────────────────────────
    const printSection = (m, title) => {
      if (!m) return;
      if (!m.summary && !m.discussion && !m.decisions && !m.action_items?.length) return;

      if (doc.y > doc.page.height - 130) doc.addPage();
      sectionTitle(doc, title, W);

      if (m.summary) {
        fieldLabel(doc, 'Ringkasan');
        renderHtml(doc, m.summary, 8, W - 8, 9);
        doc.y += 5;
      }
      if (m.discussion) {
        fieldLabel(doc, 'Jalannya Rapat / Diskusi');
        renderHtml(doc, m.discussion, 8, W - 8, 9);
        doc.y += 5;
      }
      if (m.decisions) {
        fieldLabel(doc, 'Keputusan / Hasil Rapat');
        renderHtml(doc, m.decisions, 8, W - 8, 9);
        doc.y += 5;
      }

      if (m.action_items?.length) {
        fieldLabel(doc, 'Tindak Lanjut');
        doc.y += 4;

        const cols = [W * 0.06, W * 0.48, W * 0.23, W * 0.23];
        const thY = doc.y, thH = 17;

        doc.rect(L, thY, W, thH).fill(PRIMARY);
        let cx = L;
        ['No', 'Tugas / Tindak Lanjut', 'PIC', 'Deadline'].forEach((h, i) => {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
            .text(h, cx + 3, thY + 5, { width: cols[i] - 6, lineBreak: false });
          cx += cols[i];
        });
        doc.y = thY + thH;

        m.action_items.forEach((item, idx) => {
          if (doc.y > doc.page.height - 70) doc.addPage();
          const rH = 17, rY = doc.y;
          if (idx % 2 === 0) doc.rect(L, rY, W, rH).fill('#F9FAFB');
          cx = L;
          [`${idx + 1}`, item.task || '-', item.pic || '-', item.deadline ? fmtDate(item.deadline) : '-']
            .forEach((v, i) => {
              doc.font('Helvetica').fontSize(8).fillColor(DARK)
                .text(v, cx + 3, rY + 5, { width: cols[i] - 6, lineBreak: false });
              cx += cols[i];
            });
          doc.y = rY + rH;
        });
        doc.y += 6;
      }

      doc.y += 8;
    };

    const generalMinutes = minutes.find(m => !m.agenda_id);
    printSection(generalMinutes, 'NOTULEN UMUM');
    minutes.filter(m => m.agenda_id).forEach(m =>
      printSection(m, `AGENDA ${m.order_number}: ${(m.agenda_title || '').toUpperCase()}`)
    );

    // ── SIGNATURE ─────────────────────────────────────────────
    if (locked) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      doc.y += 8;
      sectionTitle(doc, 'TANDA TANGAN PERSETUJUAN', W);

      const approved = approvals.filter(a => a.approved);
      const colW = W / 3;

      approved.forEach((a, i) => {
        if (i > 0 && i % 3 === 0) doc.y += 72;
        const col    = i % 3;
        const px     = L + col * colW;
        const baseY  = doc.y;
        const p      = participants.find(p => p.user_id === a.user_id);
        const name   = p?.name    || a.full_name || '-';
        const jabatan = p?.jabatan || '';

        doc.font('Helvetica').fontSize(8).fillColor(DARK)
          .text(name, px + 5, baseY, { width: colW - 10, align: 'center' });
        if (jabatan) {
          doc.font('Helvetica').fontSize(7).fillColor(GRAY)
            .text(jabatan, px + 5, baseY + 11, { width: colW - 10, align: 'center' });
        }
        const lineY = baseY + (jabatan ? 32 : 28);
        doc.moveTo(px + 12, lineY).lineTo(px + colW - 12, lineY)
          .strokeColor(GRAY).lineWidth(0.5).stroke();
        doc.font('Helvetica').fontSize(7).fillColor(GREEN)
          .text(`Disetujui ${fmtDate(a.approved_at)}`, px + 5, lineY + 3, { width: colW - 10, align: 'center' });

        if (col < 2) doc.y = baseY;
      });
    }

    // ── FOOTER ────────────────────────────────────────────────
    const range   = doc.bufferedPageRange();
    const footerY = doc.page.height - doc.page.margins.bottom - 14;
    const footerText = `Dicetak dari RapatKu  •  ${format(new Date(), 'd MMMM yyyy HH:mm', { locale: localeId })}  •  Halaman {n} dari ${range.count}`;
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(7).fillColor('#9CA3AF')
        .text(footerText.replace('{n}', i + 1), L, footerY, { width: W, align: 'center' });
    }

    doc.flushPages();
    doc.end();
  });
}

module.exports = { generateMinutesPDF };
