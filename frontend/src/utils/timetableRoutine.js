export const ROUTINE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const ROUTINE_TIME_SLOTS = [];
for (let hour = 8; hour < 22; hour++) {
  ROUTINE_TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
  ROUTINE_TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:30`);
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
}

export function formatGeneratedDate() {
  return new Date().toLocaleString();
}

export function getSlotRange(slot) {
  const [hour, minute] = slot.split(':').map(Number);
  const start = hour * 60 + minute;
  const end = start + 30;
  const endHour = Math.floor(end / 60);
  const endMinute = end % 60;
  return `${slot}-${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
}

export function normalizeTimetableEntries(rows = []) {
  const byId = new Map();

  rows.forEach(row => {
    const existing = byId.get(row.id);
    const degreeLabel = row.degree_name
      ? `${row.degree_name}${row.degree_code ? ` (${row.degree_code})` : ''}`
      : '';

    if (existing) {
      if (degreeLabel && !existing.degrees.includes(degreeLabel)) {
        existing.degrees.push(degreeLabel);
      }
      return;
    }

    byId.set(row.id, {
      ...row,
      degrees: degreeLabel ? [degreeLabel] : []
    });
  });

  return Array.from(byId.values()).sort((a, b) => {
    const dayOrder = ROUTINE_DAYS.indexOf(a.day_of_week) - ROUTINE_DAYS.indexOf(b.day_of_week);
    if (dayOrder !== 0) return dayOrder;
    return `${a.start_time}`.localeCompare(`${b.start_time}`);
  });
}

export function buildRoutineCells(entries = []) {
  const cells = new Map();

  entries.forEach(entry => {
    const key = `${entry.day_of_week}|${entry.start_time?.substring(0, 5)}`;
    const existing = cells.get(key) || [];
    existing.push(entry);
    cells.set(key, existing);
  });

  return cells;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getEntryHtml(entry) {
  const unitName = entry.unit_name || 'Unknown Unit';
  const unitCode = entry.unit_code || 'N/A';
  const degree = entry.degrees?.length ? entry.degrees.join(', ') : entry.degree_name || 'N/A';

  return `
    <div class="routine-class">
      <div class="routine-title">${escapeHtml(unitName)} (${escapeHtml(unitCode)})</div>
      <div>Room: ${escapeHtml(entry.room_number || 'TBA')}</div>
      <div>Tutor: ${escapeHtml(entry.tutor_name || 'TBA')}</div>
      <div>Degree: ${escapeHtml(degree)}</div>
      <div>Time: ${escapeHtml(entry.start_time?.substring(0, 5) || '')}-${escapeHtml(entry.end_time?.substring(0, 5) || '')}</div>
    </div>
  `;
}

export function getRoutineCellEntries(cells, day, slot) {
  return cells.get(`${day}|${slot}`) || [];
}

export function buildRoutineHtml({ trimester, entries, generatedAt = formatGeneratedDate(), printable = false }) {
  const cells = buildRoutineCells(entries);
  const title = `${trimester?.name || 'Timetable'} Routine`;

  const rows = ROUTINE_TIME_SLOTS.map(slot => `
    <tr>
      <th>${escapeHtml(getSlotRange(slot))}</th>
      ${ROUTINE_DAYS.map(day => {
        const dayEntries = getRoutineCellEntries(cells, day, slot);
        return `<td>${dayEntries.map(getEntryHtml).join('')}</td>`;
      }).join('')}
    </tr>
  `).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; margin: ${printable ? '20px' : '0'}; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          .meta { font-size: 12px; margin-bottom: 14px; color: #444; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #cfd6dd; vertical-align: top; padding: 7px; font-size: 11px; }
          thead th { background: #f1f4f8; font-weight: 700; text-align: center; }
          tbody th { width: 95px; background: #f8f9fa; white-space: nowrap; }
          .routine-class { border-left: 3px solid #0052c4; background: #f8fbff; padding: 6px; margin-bottom: 6px; line-height: 1.35; }
          .routine-title { font-weight: 700; margin-bottom: 3px; }
          @media print { @page { size: landscape; margin: 10mm; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">
          Trimester/session: ${escapeHtml(trimester?.name || '')}
          ${trimester?.start_date ? ` | ${escapeHtml(formatDate(trimester.start_date))}` : ''}
          ${trimester?.end_date ? ` - ${escapeHtml(formatDate(trimester.end_date))}` : ''}
          | Generated: ${escapeHtml(generatedAt)}
        </div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              ${ROUTINE_DAYS.map(day => `<th>${escapeHtml(day)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

function getFilename(trimester, extension) {
  const name = (trimester?.name || 'timetable-routine')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${name || 'timetable-routine'}-routine.${extension}`;
}

export function downloadRoutineExcel(trimester, entries) {
  const html = buildRoutineHtml({ trimester, entries });
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getFilename(trimester, 'xls');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadRoutinePdf(trimester, entries) {
  const html = buildRoutineHtml({ trimester, entries, printable: true });
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 500);
  }, 100);
}
