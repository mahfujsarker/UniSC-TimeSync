/**
 * Trimester Controller
 * CRUD operations for trimesters/sessions.
 */
const pool = require('../config/db');
const { ensureAcademicSchema } = require('../utils/academicSchema');

const PERIOD_TYPES = ['TRIMESTER', 'SESSION', 'SEMESTER', 'OTHER'];
const PERIOD_STATUSES = ['draft', 'reviewed', 'published', 'archived'];

function normalizeType(value = 'TRIMESTER') {
  const type = String(value).toUpperCase();
  return PERIOD_TYPES.includes(type) ? type : 'OTHER';
}

function normalizeCode(type, periodNumber, code) {
  if (code) return String(code).toUpperCase();
  if (type === 'TRIMESTER') return periodNumber ? `T${periodNumber}` : 'T';
  if (type === 'SESSION') return periodNumber ? `S${periodNumber}` : 'S';
  if (type === 'SEMESTER') return periodNumber ? `SEM${periodNumber}` : 'SEM';
  return periodNumber ? `O${periodNumber}` : 'OTHER';
}

async function upsertAcademicYear(client, { year, source_url = null, source_type = 'manual', status = 'draft' }) {
  const result = await client.query(
    `INSERT INTO academic_years (year, source_url, source_type, last_synced_at, status)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (year) DO UPDATE SET
       source_url = COALESCE(EXCLUDED.source_url, academic_years.source_url),
       source_type = EXCLUDED.source_type,
       last_synced_at = NOW(),
       status = CASE WHEN academic_years.status = 'published' THEN academic_years.status ELSE EXCLUDED.status END,
       updated_at = NOW()
     RETURNING *`,
    [year, source_url, source_type, status]
  );
  return result.rows[0];
}

function normalizeCalendarText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|td|th|h[1-6]|section|article|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/&ndash;|&#8211;|&#x2013;/g, '–')
    .replace(/&mdash;|&#8212;|&#x2014;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function getCalendarLines(html) {
  return normalizeCalendarText(html)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function parseDate(raw, year, context = {}) {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const isoMatch = cleaned.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const date = new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
    return date.toISOString().slice(0, 10);
  }

  const slashMatch = cleaned.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}|\d{2}))?\b/);
  if (slashMatch) {
    const parsedYear = slashMatch[3]
      ? Number(String(slashMatch[3]).length === 2 ? `20${slashMatch[3]}` : slashMatch[3])
      : year;
    const date = new Date(Date.UTC(parsedYear, Number(slashMatch[2]) - 1, Number(slashMatch[1])));
    return date.toISOString().slice(0, 10);
  }

  const match = cleaned.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2})\s+([A-Za-z]+)(?:\s+(20\d{2}))?\b/i);
  if (!match) return null;
  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
  };
  const month = months[match[2].toLowerCase()];
  if (month === undefined) return null;
  let parsedYear = Number(match[3] || year);
  if (!match[3] && context.startMonth !== undefined && context.crossesYear && month < context.startMonth) {
    parsedYear += 1;
  }
  const date = new Date(Date.UTC(parsedYear, month, Number(match[1])));
  return date.toISOString().slice(0, 10);
}

function extractDateText(value) {
  if (!value) return null;
  const match = String(value).match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*\d{1,2}(?:st|nd|rd|th)?(?:\s+[A-Za-z]+|\s*[/-]\s*\d{1,2})(?:\s*(?:20\d{2}|\d{2}))?\b/i);
  return match ? match[0] : null;
}

function parseDateRange(text, year, context = {}) {
  if (!text) return { start: null, end: null };
  const normalized = String(text)
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const rangeMatch = normalized.match(/(.+?)\s*(?:–|-)\s*(.+)/) || normalized.match(/(.+?)\s+to\s+(.+)/i);
  if (!rangeMatch) {
    const single = parseDate(extractDateText(normalized), year, context);
    return { start: single, end: null };
  }

  const startText = extractDateText(rangeMatch[1]);
  const endText = extractDateText(rangeMatch[2]);
  let start = parseDate(startText, year, context);
  const startMonth = start ? Number(start.slice(5, 7)) - 1 : context.startMonth;
  const end = parseDate(endText, year, {
    ...context,
    startMonth,
    crossesYear: context.crossesYear || /\b20\d{2}\b/.test(rangeMatch[2])
  });

  if (!start && end) {
    const startDayOnly = rangeMatch[1].match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (startDayOnly) {
      const date = new Date(Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(startDayOnly[1])));
      start = date.toISOString().slice(0, 10);
    }
  }

  return { start, end };
}

function detectPeriodHeader(line, year) {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  const numbered = cleaned.match(/\b(Trimester|Session|Semester)\s+(\d{1,2})(?:\s*,?\s*(20\d{2}))?\b/i);
  if (numbered) {
    const rawType = numbered[1].toUpperCase();
    const type = normalizeType(rawType);
    const periodNumber = Number(numbered[2]);
    return {
      type,
      period_number: periodNumber,
      code: normalizeCode(type, periodNumber),
      name: `${numbered[1][0].toUpperCase()}${numbered[1].slice(1).toLowerCase()} ${periodNumber}, ${numbered[3] || year}`
    };
  }

  const other = cleaned.match(/\b(Summer School|Winter School|Study Period|Teaching Period|Intensive|Block|Term)\s*(\d{1,2})?(?:\s*,?\s*(20\d{2}))?\b/i);
  if (!other || cleaned.length > 80) return null;
  const periodNumber = other[2] ? Number(other[2]) : null;
  return {
    type: 'OTHER',
    period_number: periodNumber,
    code: normalizeCode('OTHER', periodNumber),
    name: `${other[1]}${periodNumber ? ` ${periodNumber}` : ''}, ${other[3] || year}`
  };
}

function buildPeriodSections(lines, year) {
  const sections = [];
  let current = null;

  for (const line of lines) {
    const header = detectPeriodHeader(line, year);
    if (header) {
      if (current) sections.push(current);
      current = { header, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }

  if (current) sections.push(current);
  return sections;
}

function lineMatchesAny(line, phrases) {
  const normalized = line.toLowerCase();
  return phrases.some(phrase => normalized.includes(phrase));
}

function findDateAfterLabel(lines, phrases, year, context = {}) {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!lineMatchesAny(line, phrases)) continue;

    const sameLineRemainder = phrases.reduce((value, phrase) => {
      const phraseIndex = value.toLowerCase().indexOf(phrase.toLowerCase());
      return phraseIndex >= 0 ? value.slice(phraseIndex + phrase.length) : value;
    }, line);
    const sameLineDate = parseDate(extractDateText(sameLineRemainder), year, context);
    if (sameLineDate) return sameLineDate;

    for (let lookAhead = index + 1; lookAhead <= Math.min(index + 3, lines.length - 1); lookAhead++) {
      const next = lines[lookAhead];
      if (/^(ACTION|DATE|NOTES|ENROLMENT|TEACHING)$/i.test(next)) continue;
      const date = parseDate(extractDateText(next), year, context);
      if (date) return date;
      if (detectPeriodHeader(next, year)) break;
    }
  }
  return null;
}

function findRangeAfterLabel(lines, phrases, year, context = {}) {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!lineMatchesAny(line, phrases)) continue;

    const sameLineRange = parseDateRange(line, year, context);
    if (sameLineRange.start || sameLineRange.end) return sameLineRange;

    for (let lookAhead = index + 1; lookAhead <= Math.min(index + 3, lines.length - 1); lookAhead++) {
      const next = lines[lookAhead];
      if (/^(ACTION|DATE|NOTES|ENROLMENT|TEACHING)$/i.test(next)) continue;
      const range = parseDateRange(next, year, context);
      if (range.start || range.end) return range;
    }
  }
  return { start: null, end: null };
}

function inferContextFromRange(startDate, endDate) {
  const startMonth = startDate ? Number(startDate.slice(5, 7)) - 1 : undefined;
  const crossesYear = Boolean(startDate && endDate && Number(endDate.slice(0, 4)) > Number(startDate.slice(0, 4)));
  return { startMonth, crossesYear };
}

function parseTeachingPeriodsFromHtml(html, year, sourceUrl) {
  const lines = getCalendarLines(html);
  const sections = buildPeriodSections(lines, year);
  const periods = [];
  const seen = new Set();

  for (const section of sections) {
    const { header } = section;
    const key = `${header.type}-${header.period_number || header.code}-${header.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const firstDateRangeLine = section.lines.find(line => /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*\d{1,2}\s+[A-Za-z]+.*(?:–|-|to).*?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*\d{1,2}\s+[A-Za-z]+/i.test(line));
    const periodRange = parseDateRange(firstDateRangeLine, year);
    const context = inferContextFromRange(periodRange.start, periodRange.end);
    const classesStart = findDateAfterLabel(section.lines, ['classes start', 'teaching starts'], year, context);
    const explicitClassesEnd = findDateAfterLabel(section.lines, ['classes end', 'teaching ends'], year, context);
    const endOfPeriod = findDateAfterLabel(section.lines, ['end of trimester', 'end of session', 'end of semester', 'end of teaching period'], year, context);
    const examRange = findRangeAfterLabel(section.lines, [
      'study break/exam period',
      'centrally scheduled exam period',
      'exam period',
      'examination period'
    ], year, context);

    periods.push({
      type: header.type,
      code: header.code,
      period_number: header.period_number,
      name: header.name,
      start_date: periodRange.start,
      end_date: periodRange.end,
      classes_start_date: classesStart,
      classes_end_date: explicitClassesEnd || endOfPeriod || periodRange.end,
      timetable_release_date: findDateAfterLabel(section.lines, ['timetable released for viewing', 'timetable released', 'timetable release'], year, context),
      class_selection_open_date: findDateAfterLabel(section.lines, ['class selection opens', 'class selection open', 'class allocation opens'], year, context),
      census_date: findDateAfterLabel(section.lines, ['census date'], year, context),
      exam_start_date: examRange.start,
      exam_end_date: examRange.end,
      grades_release_date: findDateAfterLabel(section.lines, ['grades released', 'results released', 'release of results'], year, context),
      source_url: sourceUrl,
      status: 'draft'
    });
  }

  return periods;
}

async function getAll(req, res) {
  try {
    await ensureAcademicSchema();
    const { academic_year_id, year, status } = req.query;
    const query = `
      SELECT t.*, ay.year as academic_year, ay.status as academic_year_status
      FROM trimesters t
      LEFT JOIN academic_years ay ON t.academic_year_id = ay.id
      WHERE ($1::uuid IS NULL OR t.academic_year_id = $1)
        AND ($2::integer IS NULL OR ay.year = $2)
        AND ($3::text IS NULL OR t.status = $3)
      ORDER BY ay.year DESC NULLS LAST, t.type, t.period_number, t.start_date
    `;
    const result = await pool.query(query, [academic_year_id || null, year || null, status || null]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching trimesters:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getById(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const result = await pool.query(
      `SELECT t.*, ay.year as academic_year, ay.status as academic_year_status
       FROM trimesters t
       LEFT JOIN academic_years ay ON t.academic_year_id = ay.id
       WHERE t.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trimester not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching trimester:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  try {
    await ensureAcademicSchema();
    const {
      name, start_date, end_date, academic_year_id, year, type = 'TRIMESTER',
      code, period_number, classes_start_date, classes_end_date, timetable_release_date,
      class_selection_open_date, census_date, exam_start_date, exam_end_date,
      grades_release_date, source_url, status = 'draft'
    } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'All fields are required: name, start_date, end_date' });
    }
    const periodType = normalizeType(type);
    const periodNumber = period_number ? Number(period_number) : null;
    let yearId = academic_year_id || null;
    if (!yearId && year) {
      const academicYear = await upsertAcademicYear(pool, { year: Number(year), source_url, status: 'draft' });
      yearId = academicYear.id;
    }
    const result = await pool.query(
      `INSERT INTO trimesters (
        academic_year_id, type, code, period_number, name, start_date, end_date,
        classes_start_date, classes_end_date, timetable_release_date, class_selection_open_date,
        census_date, exam_start_date, exam_end_date, grades_release_date, source_url, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        yearId, periodType, normalizeCode(periodType, periodNumber, code), periodNumber, name, start_date, end_date,
        classes_start_date || null, classes_end_date || null, timetable_release_date || null, class_selection_open_date || null,
        census_date || null, exam_start_date || null, exam_end_date || null, grades_release_date || null, source_url || null,
        PERIOD_STATUSES.includes(status) ? status : 'draft'
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating trimester:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function update(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const {
      name, start_date, end_date, type, code, period_number, classes_start_date,
      classes_end_date, timetable_release_date, class_selection_open_date, census_date,
      exam_start_date, exam_end_date, grades_release_date, source_url, status
    } = req.body;
    const periodType = type ? normalizeType(type) : null;
    const result = await pool.query(
      `UPDATE trimesters SET 
        name = COALESCE($1, name),
        start_date = COALESCE($2, start_date),
        end_date = COALESCE($3, end_date),
        type = COALESCE($4, type),
        period_number = COALESCE($5, period_number),
        code = COALESCE($6, code),
        classes_start_date = COALESCE($7, classes_start_date),
        classes_end_date = COALESCE($8, classes_end_date),
        timetable_release_date = COALESCE($9, timetable_release_date),
        class_selection_open_date = COALESCE($10, class_selection_open_date),
        census_date = COALESCE($11, census_date),
        exam_start_date = COALESCE($12, exam_start_date),
        exam_end_date = COALESCE($13, exam_end_date),
        grades_release_date = COALESCE($14, grades_release_date),
        source_url = COALESCE($15, source_url),
        status = COALESCE($16, status),
        updated_at = NOW()
       WHERE id = $17 RETURNING *`,
      [
        name, start_date, end_date, periodType, period_number || null,
        periodType || period_number || code ? normalizeCode(periodType || 'TRIMESTER', period_number, code) : null,
        classes_start_date || null, classes_end_date || null, timetable_release_date || null,
        class_selection_open_date || null, census_date || null, exam_start_date || null, exam_end_date || null,
        grades_release_date || null, source_url || null, status || null, id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trimester not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating trimester:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const result = await pool.query('DELETE FROM trimesters WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trimester not found' });
    }
    res.json({ message: 'Trimester deleted successfully' });
  } catch (err) {
    console.error('Error deleting trimester:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAcademicYears(req, res) {
  try {
    await ensureAcademicSchema();
    const result = await pool.query('SELECT * FROM academic_years ORDER BY year DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching academic years:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function importUniSCCalendar(req, res) {
  const client = await pool.connect();
  try {
    await ensureAcademicSchema();
    const { year, source_url } = req.body;
    if (!year || !source_url) {
      return res.status(400).json({ error: 'Academic year and UniSC calendar URL are required' });
    }

    const response = await fetch(source_url);
    if (!response.ok) {
      return res.status(400).json({ error: 'Unable to fetch this calendar URL.' });
    }
    const html = await response.text();
    const imported = parseTeachingPeriodsFromHtml(html, Number(year), source_url);
    if (imported.length === 0) {
      return res.status(422).json({
        error: 'Unable to automatically parse this calendar page. Please review the URL or enter teaching periods manually.'
      });
    }

    await client.query('BEGIN');
    const academicYear = await upsertAcademicYear(client, {
      year: Number(year),
      source_url,
      source_type: 'import',
      status: 'draft'
    });

    const preview = [];
    for (const period of imported) {
      const existing = await client.query(
        `SELECT * FROM trimesters
         WHERE academic_year_id = $1
           AND type = $2
           AND period_number = $3
           AND code = $4
           AND name = $5
         LIMIT 1`,
        [academicYear.id, period.type, period.period_number, period.code, period.name]
      );

      if (existing.rows.length > 0) {
        preview.push({ ...period, id: existing.rows[0].id, academic_year_id: academicYear.id, academic_year: academicYear.year, import_action: 'update_available', existing: existing.rows[0] });
        continue;
      }

      const inserted = await client.query(
        `INSERT INTO trimesters (
          academic_year_id, type, code, period_number, name, start_date, end_date,
          classes_start_date, classes_end_date, timetable_release_date, class_selection_open_date,
          census_date, exam_start_date, exam_end_date, grades_release_date, source_url, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'draft')
         RETURNING *`,
        [
          academicYear.id, period.type, period.code, period.period_number, period.name, period.start_date, period.end_date,
          period.classes_start_date, period.classes_end_date, period.timetable_release_date, period.class_selection_open_date,
          period.census_date, period.exam_start_date, period.exam_end_date, period.grades_release_date, source_url
        ]
      );
      preview.push({ ...inserted.rows[0], academic_year: academicYear.year, import_action: 'created_draft' });
    }

    await client.query('COMMIT');
    res.status(201).json({ academic_year: academicYear, teaching_periods: preview });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing academic calendar:', err);
    res.status(500).json({ error: 'Unable to automatically parse this calendar page. Please review the URL or enter teaching periods manually.' });
  } finally {
    client.release();
  }
}

async function updateAcademicYear(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const { status, source_url, source_type } = req.body;
    const result = await pool.query(
      `UPDATE academic_years SET
        status = COALESCE($1, status),
        source_url = COALESCE($2, source_url),
        source_type = COALESCE($3, source_type),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status || null, source_url || null, source_type || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Academic year not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating academic year:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function publishPeriods(req, res) {
  try {
    await ensureAcademicSchema();
    const { ids = [], academic_year_id } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Select at least one teaching period to publish' });
    }
    const result = await pool.query(
      `UPDATE trimesters SET status = 'published', updated_at = NOW()
       WHERE id = ANY($1::uuid[])
       RETURNING *`,
      [ids]
    );
    if (academic_year_id) {
      await pool.query(
        `UPDATE academic_years SET status = 'published', updated_at = NOW() WHERE id = $1`,
        [academic_year_id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Error publishing teaching periods:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  getAcademicYears,
  importUniSCCalendar,
  updateAcademicYear,
  publishPeriods,
  _parseTeachingPeriodsFromHtml: parseTeachingPeriodsFromHtml
};
