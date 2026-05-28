/**
 * Tutor Availability Controller
 * Manages tutor availability per published Teaching Period.
 */
const pool = require('../config/db');
const { ensureAcademicSchema } = require('../utils/academicSchema');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SCOPES = ['YEAR', 'PERIOD', 'DAY'];

async function ensureTutorAvailabilitySchema() {
  // Availability supports three scopes:
  // YEAR covers all published periods in an academic year,
  // PERIOD covers every weekday in one teaching period,
  // DAY narrows availability to a weekday and optional time range.
  await ensureAcademicSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tutor_availability (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
      trimester_id UUID REFERENCES trimesters(id) ON DELETE CASCADE,
      availability_scope VARCHAR(20) NOT NULL DEFAULT 'DAY' CHECK (availability_scope IN ('YEAR', 'PERIOD', 'DAY')),
      day_of_week VARCHAR(10) CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
      start_time TIME,
      end_time TIME,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    ALTER TABLE tutor_availability ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE;
    ALTER TABLE tutor_availability ADD COLUMN IF NOT EXISTS availability_scope VARCHAR(20) NOT NULL DEFAULT 'DAY'
      CHECK (availability_scope IN ('YEAR', 'PERIOD', 'DAY'));
    ALTER TABLE tutor_availability ALTER COLUMN trimester_id DROP NOT NULL;
    ALTER TABLE tutor_availability ALTER COLUMN day_of_week DROP NOT NULL;
    ALTER TABLE tutor_availability ALTER COLUMN start_time DROP NOT NULL;
    ALTER TABLE tutor_availability ALTER COLUMN end_time DROP NOT NULL;

    UPDATE tutor_availability ta
    SET academic_year_id = tr.academic_year_id
    FROM trimesters tr
    WHERE ta.trimester_id = tr.id
      AND ta.academic_year_id IS NULL;

    DELETE FROM tutor_availability a
    USING tutor_availability b
    WHERE a.tutor_id = b.tutor_id
      AND COALESCE(a.academic_year_id::text, '') = COALESCE(b.academic_year_id::text, '')
      AND a.trimester_id = b.trimester_id
      AND a.day_of_week = b.day_of_week
      AND a.availability_scope = b.availability_scope
      AND a.created_at > b.created_at;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tutor_availability_tutor_id_trimester_id_day_of_week_start_time_key'
      ) THEN
        ALTER TABLE tutor_availability
          DROP CONSTRAINT tutor_availability_tutor_id_trimester_id_day_of_week_start_time_key;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_tutor_availability_scope'
      ) THEN
        ALTER TABLE tutor_availability
          ADD CONSTRAINT unique_tutor_availability_scope
          UNIQUE (tutor_id, academic_year_id, trimester_id, availability_scope, day_of_week);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_tutor_availability_scope'
      ) THEN
        ALTER TABLE tutor_availability
          ADD CONSTRAINT valid_tutor_availability_scope
          CHECK (
            (availability_scope = 'YEAR' AND academic_year_id IS NOT NULL AND trimester_id IS NULL AND day_of_week IS NULL AND start_time IS NULL AND end_time IS NULL)
            OR (availability_scope = 'PERIOD' AND trimester_id IS NOT NULL AND day_of_week IS NULL AND start_time IS NULL AND end_time IS NULL)
            OR (availability_scope = 'DAY' AND trimester_id IS NOT NULL AND day_of_week IS NOT NULL)
          );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_tutor_availability_times'
      ) THEN
        ALTER TABLE tutor_availability
          ADD CONSTRAINT valid_tutor_availability_times
          CHECK (
            (start_time IS NULL AND end_time IS NULL)
            OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
          );
      END IF;
    END $$;
  `);
}

function normalizeTime(value) {
  return value ? String(value).slice(0, 5) : null;
}

function validateAvailabilityWindow(day_of_week, start_time, end_time) {
  const errors = [];
  if (!DAYS.includes(day_of_week)) {
    errors.push('Invalid day of week');
  }

  const start = normalizeTime(start_time);
  const end = normalizeTime(end_time);
  if ((start && !end) || (!start && end)) {
    errors.push('Set both start and end time, or leave both blank for full-day availability');
  }
  if (start && end) {
    if (start < '08:00' || end > '22:00') {
      errors.push('Availability time must be between 08:00 and 22:00');
    }
    if (end <= start) {
      errors.push('End time must be after start time');
    }
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    if (((startHour * 60) + startMinute) % 30 !== 0 || ((endHour * 60) + endMinute) % 30 !== 0) {
      errors.push('Availability times must use 30-minute intervals');
    }
  }
  return errors;
}

async function getByTutor(req, res) {
  try {
    await ensureTutorAvailabilitySchema();
    const { tutorId } = req.params;
    const { trimester_id } = req.query;

    let query = `
      SELECT ta.*, t.name as tutor_name, ay.year as academic_year, tr.name as trimester_name, tr.type, tr.code, tr.period_number
      FROM tutor_availability ta
      JOIN tutors t ON ta.tutor_id = t.id
      LEFT JOIN academic_years ay ON ta.academic_year_id = ay.id
      LEFT JOIN trimesters tr ON ta.trimester_id = tr.id
      WHERE ta.tutor_id = $1
    `;
    const params = [tutorId];

    if (trimester_id) {
      query += ' AND ta.trimester_id = $2';
      params.push(trimester_id);
    }

    query += ' ORDER BY ay.year, tr.name, ta.availability_scope, ta.day_of_week, ta.start_time';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tutor availability:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getByTrimester(req, res) {
  try {
    await ensureTutorAvailabilitySchema();
    const { trimesterId } = req.params;

    const result = await pool.query(
      `SELECT ta.*, t.name as tutor_name FROM tutor_availability ta
       JOIN tutors t ON ta.tutor_id = t.id
       WHERE ta.trimester_id = $1
       ORDER BY t.name, ta.day_of_week, ta.start_time`,
      [trimesterId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching availability by trimester:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  try {
    await ensureTutorAvailabilitySchema();
    const { tutor_id, trimester_id, academic_year_id, availability_scope = 'DAY', day_of_week, start_time, end_time } = req.body;
    const scope = String(availability_scope).toUpperCase();

    if (!tutor_id || !SCOPES.includes(scope)) {
      return res.status(400).json({ error: 'Tutor and valid availability scope are required' });
    }

    if (scope === 'YEAR' && !academic_year_id) {
      return res.status(400).json({ error: 'Academic Year is required for full-year availability' });
    }
    if (scope !== 'YEAR' && !trimester_id) {
      return res.status(400).json({ error: 'Teaching Period is required' });
    }
    if (scope === 'DAY' && !day_of_week) {
      return res.status(400).json({ error: 'Day is required for day-level availability' });
    }

    const errors = scope === 'DAY' ? validateAvailabilityWindow(day_of_week, start_time, end_time) : [];
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    let yearId = academic_year_id || null;
    if (trimester_id) {
      const period = await pool.query('SELECT academic_year_id FROM trimesters WHERE id = $1 AND status = $2', [trimester_id, 'published']);
      if (period.rows.length === 0) return res.status(400).json({ error: 'Published Teaching Period not found' });
      yearId = period.rows[0].academic_year_id;
    }

    const result = await pool.query(
      `INSERT INTO tutor_availability (tutor_id, academic_year_id, trimester_id, availability_scope, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tutor_id, academic_year_id, trimester_id, availability_scope, day_of_week)
       DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, updated_at = NOW()
       RETURNING *`,
      [
        tutor_id,
        yearId,
        scope === 'YEAR' ? null : trimester_id,
        scope,
        scope === 'DAY' ? day_of_week : null,
        scope === 'DAY' ? normalizeTime(start_time) : null,
        scope === 'DAY' ? normalizeTime(end_time) : null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Availability already exists for this tutor, trimester, day, and start time' });
    }
    console.error('Error creating tutor availability:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  try {
    await ensureTutorAvailabilitySchema();
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tutor_availability WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Availability entry not found' });
    }
    res.json({ message: 'Availability deleted successfully' });
  } catch (err) {
    console.error('Error deleting tutor availability:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function checkAvailability(tutor_id, trimester_id, day_of_week, start_time, end_time) {
  await ensureTutorAvailabilitySchema();
  // DAY rules take priority because they are the most specific. If no DAY
  // rules exist, PERIOD then YEAR rules can satisfy the booking.
  const result = await pool.query(
    `WITH selected_period AS (
       SELECT id, academic_year_id FROM trimesters WHERE id = $2 AND status = 'published'
     ),
     day_rules AS (
       SELECT ta.*
       FROM tutor_availability ta
       JOIN selected_period sp ON ta.trimester_id = sp.id
       WHERE ta.tutor_id = $1 AND ta.availability_scope = 'DAY'
     )
     SELECT CASE
       WHEN EXISTS (SELECT 1 FROM day_rules) THEN EXISTS (
         SELECT 1 FROM day_rules
         WHERE day_of_week = $3
           AND (
             (start_time IS NULL AND end_time IS NULL)
             OR (start_time <= $4 AND end_time >= $5)
           )
       )
       WHEN EXISTS (
         SELECT 1
         FROM tutor_availability ta
         JOIN selected_period sp ON ta.trimester_id = sp.id
         WHERE ta.tutor_id = $1 AND ta.availability_scope = 'PERIOD'
       ) THEN true
       WHEN EXISTS (
         SELECT 1
         FROM tutor_availability ta
         JOIN selected_period sp ON ta.academic_year_id = sp.academic_year_id
         WHERE ta.tutor_id = $1 AND ta.availability_scope = 'YEAR'
       ) THEN true
       ELSE false
     END AS available`,
    [tutor_id, trimester_id, day_of_week, start_time, end_time]
  );
  return Boolean(result.rows[0]?.available);
}

async function replaceForTutor(req, res) {
  const client = await pool.connect();
  try {
    await ensureTutorAvailabilitySchema();
    const { tutorId } = req.params;
    const { availability = [], year_availability = [] } = req.body;

    await client.query('BEGIN');

    const tutor = await client.query('SELECT id FROM tutors WHERE id = $1', [tutorId]);
    if (tutor.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tutor not found' });
    }

    const rows = [];
    // The frontend sends nested year/period/day selections. Flatten them into
    // normalized rows so conflict checks can query one table efficiently.
    for (const yearId of year_availability) {
      const academicYear = await client.query(
        `SELECT id FROM academic_years WHERE id = $1 AND status = 'published'`,
        [yearId]
      );
      if (academicYear.rows.length === 0) continue;
      rows.push({
        academic_year_id: yearId,
        trimester_id: null,
        availability_scope: 'YEAR',
        day_of_week: null,
        start_time: null,
        end_time: null
      });
    }

    for (const period of availability) {
      if (!period?.trimester_id) continue;
      const teachingPeriod = await client.query(
        `SELECT id, academic_year_id FROM trimesters WHERE id = $1 AND status = 'published'`,
        [period.trimester_id]
      );
      if (teachingPeriod.rows.length === 0) continue;

      if (!Array.isArray(period.days) || period.days.length === 0 || period.full_period) {
        rows.push({
          academic_year_id: teachingPeriod.rows[0].academic_year_id,
          trimester_id: period.trimester_id,
          availability_scope: 'PERIOD',
          day_of_week: null,
          start_time: null,
          end_time: null
        });
        continue;
      }

      for (const day of period.days) {
        const dayName = day.day_of_week;
        const errors = validateAvailabilityWindow(dayName, day.start_time, day.end_time);
        if (errors.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `${dayName}: ${errors.join(', ')}` });
        }
        rows.push({
          academic_year_id: teachingPeriod.rows[0].academic_year_id,
          trimester_id: period.trimester_id,
          availability_scope: 'DAY',
          day_of_week: dayName,
          start_time: normalizeTime(day.start_time),
          end_time: normalizeTime(day.end_time)
        });
      }
    }

    await client.query('DELETE FROM tutor_availability WHERE tutor_id = $1', [tutorId]);
    for (const row of rows) {
      await client.query(
        `INSERT INTO tutor_availability (tutor_id, academic_year_id, trimester_id, availability_scope, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tutorId, row.academic_year_id, row.trimester_id, row.availability_scope, row.day_of_week, row.start_time, row.end_time]
      );
    }
    await client.query('COMMIT');

    const result = await pool.query(
      `SELECT ta.*, ay.year as academic_year, tr.name as trimester_name, tr.type, tr.code
       FROM tutor_availability ta
       LEFT JOIN academic_years ay ON ta.academic_year_id = ay.id
       LEFT JOIN trimesters tr ON ta.trimester_id = tr.id
       WHERE ta.tutor_id = $1
       ORDER BY ay.year, tr.name, ta.availability_scope, ta.day_of_week`,
      [tutorId]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error replacing tutor availability:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

module.exports = { getByTutor, getByTrimester, create, remove, replaceForTutor, checkAvailability, ensureTutorAvailabilitySchema };
