const pool = require('../config/db');

let ensured = false;

/**
 * Keeps older local databases compatible with the current TimeSync schema.
 * Controllers call this before academic queries so missing columns/tables are
 * created once per server process instead of requiring manual SQL migrations.
 */
async function ensureAcademicSchema() {
  if (ensured) return;

  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS academic_years (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      year INTEGER UNIQUE NOT NULL,
      source_url TEXT,
      source_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'import', 'scraped', 'pdf')),
      last_synced_at TIMESTAMP WITH TIME ZONE,
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL;
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'TRIMESTER'
      CHECK (type IN ('TRIMESTER', 'SESSION', 'SEMESTER', 'OTHER'));
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS code VARCHAR(20);
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS period_number INTEGER;
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS classes_start_date DATE;
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS classes_end_date DATE;
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS timetable_release_date DATE;
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS class_selection_open_date DATE;
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS census_date DATE;
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS exam_start_date DATE;
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS exam_end_date DATE;
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS grades_release_date DATE;
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS source_url TEXT;
    ALTER TABLE trimesters ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published'
      CHECK (status IN ('draft', 'reviewed', 'published', 'archived'));
    ALTER TABLE trimesters ALTER COLUMN start_date DROP NOT NULL;
    ALTER TABLE trimesters ALTER COLUMN end_date DROP NOT NULL;

    CREATE TABLE IF NOT EXISTS teaching_period_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      teaching_period_id UUID NOT NULL REFERENCES trimesters(id) ON DELETE CASCADE,
      event_type VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS unit_offering_patterns (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('TRIMESTER', 'SESSION', 'SEMESTER')),
      period_number INTEGER NOT NULL CHECK (
        (period_type = 'TRIMESTER' AND period_number BETWEEN 1 AND 3)
        OR (period_type = 'SEMESTER' AND period_number BETWEEN 1 AND 2)
        OR (period_type = 'SESSION' AND period_number BETWEEN 1 AND 8)
      ),
      code VARCHAR(20) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(unit_id, period_type, period_number)
    );

    ALTER TABLE degrees ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE degrees ADD COLUMN IF NOT EXISTS degree_type VARCHAR(100);
    ALTER TABLE degrees ADD COLUMN IF NOT EXISTS campus VARCHAR(255);
    ALTER TABLE degrees ADD COLUMN IF NOT EXISTS study_mode VARCHAR(100);
    ALTER TABLE degrees ADD COLUMN IF NOT EXISTS duration VARCHAR(100);
    ALTER TABLE degrees ADD COLUMN IF NOT EXISTS source_url TEXT;
    ALTER TABLE degrees ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published'
      CHECK (status IN ('draft', 'reviewed', 'published', 'archived'));

    ALTER TABLE units ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE units ADD COLUMN IF NOT EXISTS prerequisites TEXT;
    ALTER TABLE units ADD COLUMN IF NOT EXISTS credit_points VARCHAR(50);
    ALTER TABLE units ADD COLUMN IF NOT EXISTS source_url TEXT;
    ALTER TABLE units ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published'
      CHECK (status IN ('draft', 'reviewed', 'published', 'archived'));

    ALTER TABLE classes ADD COLUMN IF NOT EXISTS enrolled_students INTEGER DEFAULT 0;

    CREATE TABLE IF NOT EXISTS degree_course_imports (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      source_url TEXT NOT NULL,
      payload JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published', 'archived')),
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      published_at TIMESTAMP WITH TIME ZONE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_trimesters_period_identity
      ON trimesters (academic_year_id, type, period_number, code, name);
  `);

  await pool.query(`
    ALTER TABLE unit_offering_patterns DROP CONSTRAINT IF EXISTS unit_offering_patterns_period_type_check;
    ALTER TABLE unit_offering_patterns DROP CONSTRAINT IF EXISTS unit_offering_patterns_period_number_check;
    ALTER TABLE unit_offering_patterns ADD CONSTRAINT unit_offering_patterns_period_type_check
      CHECK (period_type IN ('TRIMESTER', 'SESSION', 'SEMESTER'));
    ALTER TABLE unit_offering_patterns ADD CONSTRAINT unit_offering_patterns_period_number_check
      CHECK (
        (period_type = 'TRIMESTER' AND period_number BETWEEN 1 AND 3)
        OR (period_type = 'SEMESTER' AND period_number BETWEEN 1 AND 2)
        OR (period_type = 'SESSION' AND period_number BETWEEN 1 AND 8)
      );
  `);

  await backfillAcademicYears();
  await backfillUnitOfferingPatterns();
  ensured = true;
}

async function backfillAcademicYears() {
  // Existing teaching periods may predate academic_years. Infer a year from
  // the period name or start date, create the year row, then link the periods.
  const years = await pool.query(`
    SELECT DISTINCT COALESCE(
      NULLIF(substring(name from '(20[0-9]{2})'), '')::INTEGER,
      EXTRACT(YEAR FROM start_date)::INTEGER
    ) AS year
    FROM trimesters
    WHERE academic_year_id IS NULL
  `);

  for (const row of years.rows) {
    if (!row.year) continue;
    const yearResult = await pool.query(
      `INSERT INTO academic_years (year, status)
       VALUES ($1, 'published')
       ON CONFLICT (year) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [row.year]
    );
    await pool.query(
      `UPDATE trimesters
       SET academic_year_id = $1,
           type = COALESCE(type, $2),
           period_number = COALESCE(period_number, $3),
           code = COALESCE(code, $4),
           classes_start_date = COALESCE(classes_start_date, start_date),
           classes_end_date = COALESCE(classes_end_date, end_date)
       WHERE academic_year_id IS NULL
         AND COALESCE(NULLIF(substring(name from '(20[0-9]{2})'), '')::INTEGER, EXTRACT(YEAR FROM start_date)::INTEGER) = $5`,
      [yearResult.rows[0].id, 'TRIMESTER', inferPeriodNumber(row.year), null, row.year]
    );
  }

  await pool.query(`
    UPDATE trimesters
    SET period_number = COALESCE(period_number, NULLIF(substring(name from '(?:Trimester|Session|Semester)\\s*([0-9]+)'), '')::INTEGER),
        type = CASE
          WHEN name ILIKE '%session%' THEN 'SESSION'
          WHEN name ILIKE '%semester%' THEN 'SEMESTER'
          ELSE COALESCE(type, 'TRIMESTER')
        END
  `);

  await pool.query(`
    UPDATE trimesters
    SET code = COALESCE(
      code,
      CASE
        WHEN type = 'TRIMESTER' AND period_number IS NOT NULL THEN 'T' || period_number
        WHEN type = 'SESSION' AND period_number IS NOT NULL THEN 'S' || period_number
        WHEN type = 'SEMESTER' AND period_number IS NOT NULL THEN 'SEM' || period_number
        ELSE NULL
      END
    )
  `);
}

function inferPeriodNumber() {
  return null;
}

async function backfillUnitOfferingPatterns() {
  // Convert legacy direct course-period links into reusable offering patterns
  // such as TRIMESTER 1, SESSION 3, or SEMESTER 2.
  await pool.query(`
    INSERT INTO unit_offering_patterns (unit_id, period_type, period_number, code)
    SELECT DISTINCT ut.unit_id, t.type, t.period_number, t.code
    FROM unit_trimesters ut
    JOIN trimesters t ON ut.trimester_id = t.id
    WHERE t.type IN ('TRIMESTER', 'SESSION', 'SEMESTER')
      AND (
        (t.type = 'TRIMESTER' AND t.period_number BETWEEN 1 AND 3)
        OR (t.type = 'SEMESTER' AND t.period_number BETWEEN 1 AND 2)
        OR (t.type = 'SESSION' AND t.period_number BETWEEN 1 AND 8)
      )
      AND t.code IS NOT NULL
    ON CONFLICT (unit_id, period_type, period_number) DO NOTHING
  `);
}

module.exports = { ensureAcademicSchema };
