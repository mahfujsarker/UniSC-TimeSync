/**
 * Degree Controller
 * CRUD operations for degrees and Degree & Courses URL import drafts.
 */
const pool = require('../config/db');
const { ensureAcademicSchema } = require('../utils/academicSchema');

const STATUS_VALUES = new Set(['draft', 'reviewed', 'published', 'archived']);
const OFFERING_OPTIONS = [
  ...[1, 2, 3].map(number => ({ label: `Trimester ${number}`, period_type: 'TRIMESTER', period_number: number, code: `T${number}` })),
  ...[1, 2].map(number => ({ label: `Semester ${number}`, period_type: 'SEMESTER', period_number: number, code: `SEM${number}` })),
  ...Array.from({ length: 8 }, (_, index) => {
    const number = index + 1;
    return { label: `Session ${number}`, period_type: 'SESSION', period_number: number, code: `S${number}` };
  })
];

function includeInactive(req) {
  return req.user?.role === 'admin' && String(req.query.include_inactive || '').toLowerCase() === 'true';
}

function normalizeStatus(status, fallback = 'published') {
  return STATUS_VALUES.has(status) ? status : fallback;
}

function nullIfBlank(value) {
  return typeof value === 'string' && value.trim() === '' ? null : value ?? null;
}

async function getAll(req, res) {
  try {
    await ensureAcademicSchema();
    const where = includeInactive(req) ? '' : "WHERE status = 'published'";
    const result = await pool.query(`SELECT * FROM degrees ${where} ORDER BY name ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching degrees:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getById(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const statusClause = req.user?.role === 'admin' ? '' : " AND status = 'published'";
    const result = await pool.query(`SELECT * FROM degrees WHERE id = $1${statusClause}`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Degree not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching degree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  try {
    await ensureAcademicSchema();
    const { name, code, description, degree_type, campus, study_mode, duration, source_url, status } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }
    const result = await pool.query(
      `INSERT INTO degrees (name, code, description, degree_type, campus, study_mode, duration, source_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        name,
        code.toUpperCase(),
        nullIfBlank(description),
        nullIfBlank(degree_type),
        nullIfBlank(campus),
        nullIfBlank(study_mode),
        nullIfBlank(duration),
        nullIfBlank(source_url),
        normalizeStatus(status)
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Degree code already exists' });
    }
    console.error('Error creating degree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function update(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const { name, code, description, degree_type, campus, study_mode, duration, source_url, status } = req.body;
    const result = await pool.query(
      `UPDATE degrees SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        description = COALESCE($3, description),
        degree_type = COALESCE($4, degree_type),
        campus = COALESCE($5, campus),
        study_mode = COALESCE($6, study_mode),
        duration = COALESCE($7, duration),
        source_url = COALESCE($8, source_url),
        status = COALESCE($9, status),
        updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [
        name,
        code ? code.toUpperCase() : null,
        nullIfBlank(description),
        nullIfBlank(degree_type),
        nullIfBlank(campus),
        nullIfBlank(study_mode),
        nullIfBlank(duration),
        nullIfBlank(source_url),
        status ? normalizeStatus(status) : null,
        id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Degree not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Degree code already exists' });
    }
    console.error('Error updating degree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const result = await pool.query('DELETE FROM degrees WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Degree not found' });
    }
    res.json({ message: 'Degree deleted successfully' });
  } catch (err) {
    console.error('Error deleting degree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(html, name) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  return (html.match(pattern) || [null, ''])[1];
}

function findLabelValue(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`\\b${label}\\b\\s*[:\\-]?\\s*([^|.]{2,120})`, 'i'));
    if (match) return match[1].trim();
  }
  return '';
}

function extractTitle(html, text) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1 ? stripHtml(h1[1]) : stripHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [null, ''])[1]);
  return title || (text.match(/\b((Bachelor|Master|Graduate|Diploma|Certificate|Doctor)[^|]{5,140})/i) || [null, ''])[1] || '';
}

function inferDegreeCode(text, sourceUrl) {
  const code = findLabelValue(text, ['Program code', 'Degree code', 'Course code']);
  if (code) return code.split(/\s/)[0].toUpperCase();
  const urlCode = sourceUrl.match(/\/([A-Z]{2,}[A-Z0-9-]{2,})(?:\/|$)/i);
  return urlCode ? urlCode[1].toUpperCase() : '';
}

function inferDegreeType(name) {
  const match = name.match(/\b(Bachelor|Master|Graduate Certificate|Graduate Diploma|Diploma|Certificate|Doctor|PhD)\b/i);
  return match ? match[1] : '';
}

function inferOfferingPatterns(fragment) {
  return OFFERING_OPTIONS.filter(option => {
    const period = option.period_type === 'TRIMESTER' ? 'trimester' : option.period_type === 'SEMESTER' ? 'semester' : 'session';
    const pattern = new RegExp(`\\b(${period}\\s*${option.period_number}|${option.code})\\b`, 'i');
    return pattern.test(fragment);
  });
}

function inferRoomType(fragment) {
  return /\b(lab|laboratory|computer lab)\b/i.test(fragment) ? 'lab' : 'normal';
}

function extractCourses(text, sourceUrl) {
  const courseRegex = /\b([A-Z]{3,4}[0-9]{3})\b\s*[-:–—]?\s*([A-Z][A-Za-z0-9 &,()'/-]{3,100})?/g;
  const courses = new Map();
  let match;
  while ((match = courseRegex.exec(text)) !== null) {
    const code = match[1].toUpperCase();
    const context = text.slice(Math.max(0, match.index - 180), Math.min(text.length, match.index + 320));
    const rawName = (match[2] || '').replace(/\b(Trimester|Semester|Session|Course|Unit|Credit|Prerequisite|Required).*$/i, '').trim();
    if (!courses.has(code)) {
      courses.set(code, {
        code,
        name: rawName,
        classroom_type: inferRoomType(context),
        offering_patterns: inferOfferingPatterns(context),
        prerequisites: findLabelValue(context, ['Prerequisite', 'Prerequisites']),
        credit_points: findLabelValue(context, ['Credit points', 'Credits']),
        description: '',
        source_url: sourceUrl,
        status: 'draft',
        action: 'create'
      });
    }
  }
  return [...courses.values()].slice(0, 120);
}

async function attachDuplicateMatches(payload) {
  const degreeParams = [];
  const degreeConditions = [];
  if (payload.degree.code) {
    degreeParams.push(payload.degree.code.toUpperCase());
    degreeConditions.push(`UPPER(code) = $${degreeParams.length}`);
  }
  if (payload.degree.name) {
    degreeParams.push(payload.degree.name.toLowerCase());
    degreeConditions.push(`LOWER(name) = $${degreeParams.length}`);
  }

  if (degreeConditions.length > 0) {
    const existingDegree = await pool.query(
      `SELECT id, code, name, status, description, degree_type, campus, study_mode, duration
       FROM degrees WHERE ${degreeConditions.join(' OR ')} LIMIT 1`,
      degreeParams
    );
    if (existingDegree.rows[0]) {
      payload.degree.existing_match = existingDegree.rows[0];
      payload.degree.action = 'keep_existing';
    }
  }

  for (const course of payload.courses) {
    const courseParams = [];
    const courseConditions = [];
    if (course.code) {
      courseParams.push(course.code.toUpperCase());
      courseConditions.push(`UPPER(code) = $${courseParams.length}`);
    }
    if (course.name) {
      courseParams.push(course.name.toLowerCase());
      courseConditions.push(`LOWER(name) = $${courseParams.length}`);
    }
    if (courseConditions.length === 0) continue;

    const existingCourse = await pool.query(
      `SELECT id, code, name, classroom_type, status, description, prerequisites, credit_points
       FROM units WHERE ${courseConditions.join(' OR ')} LIMIT 1`,
      courseParams
    );
    if (existingCourse.rows[0]) {
      course.existing_match = existingCourse.rows[0];
      course.action = 'keep_existing';
    }
  }

  return payload;
}

async function extractImport(req, res) {
  try {
    await ensureAcademicSchema();
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Enter a valid URL' });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are supported' });
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'TTMS Degree Course Importer/1.0' },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      return res.status(422).json({ error: 'Unable to automatically extract degree and course information from this URL. Please review the URL or add the data manually.' });
    }

    const html = await response.text();
    const text = stripHtml(html);
    const name = extractTitle(html, text);
    const description = extractMeta(html, 'description') || findLabelValue(text, ['Overview', 'Description']);
    const payload = await attachDuplicateMatches({
      degree: {
        name,
        code: inferDegreeCode(text, parsedUrl.toString()),
        description,
        degree_type: inferDegreeType(name),
        campus: findLabelValue(text, ['Campus', 'Location']),
        study_mode: findLabelValue(text, ['Study mode', 'Mode']),
        duration: findLabelValue(text, ['Duration']),
        source_url: parsedUrl.toString(),
        status: 'draft',
        action: 'create'
      },
      courses: extractCourses(text, parsedUrl.toString())
    });

    const draft = await pool.query(
      `INSERT INTO degree_course_imports (source_url, payload, status, created_by)
       VALUES ($1, $2, 'draft', $3) RETURNING *`,
      [parsedUrl.toString(), payload, req.user.id]
    );

    res.status(201).json({ import: draft.rows[0], payload });
  } catch (err) {
    console.error('Error extracting degree/course import:', err);
    res.status(422).json({ error: 'Unable to automatically extract degree and course information from this URL. Please review the URL or add the data manually.' });
  }
}

async function publishImport(req, res) {
  const client = await pool.connect();
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const { payload } = req.body;
    if (!payload?.degree) return res.status(400).json({ error: 'Import payload is required' });

    await client.query('BEGIN');
    const draft = await client.query('SELECT * FROM degree_course_imports WHERE id = $1 FOR UPDATE', [id]);
    if (draft.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Import draft not found' });
    }

    const degree = payload.degree;
    let degreeId = degree.existing_match?.id || degree.degree_id || null;
    const degreeAction = degree.action || 'create';
    if (degreeAction === 'ignore') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A degree must be selected or created before publishing courses' });
    }

    if (degreeId) {
      if (['update_existing', 'merge'].includes(degreeAction)) {
        await client.query(
          `UPDATE degrees SET
            name = COALESCE($1, name), code = COALESCE($2, code), description = COALESCE($3, description),
            degree_type = COALESCE($4, degree_type), campus = COALESCE($5, campus), study_mode = COALESCE($6, study_mode),
            duration = COALESCE($7, duration), source_url = COALESCE($8, source_url), status = 'published', updated_at = NOW()
           WHERE id = $9`,
          [degree.name || null, degree.code ? degree.code.toUpperCase() : null, degree.description || null, degree.degree_type || null, degree.campus || null, degree.study_mode || null, degree.duration || null, degree.source_url || null, degreeId]
        );
      } else {
        await client.query("UPDATE degrees SET status = 'published', updated_at = NOW() WHERE id = $1", [degreeId]);
      }
    } else {
      if (!degree.name || !degree.code) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Degree name and code are required before publishing' });
      }
      const created = await client.query(
        `INSERT INTO degrees (name, code, description, degree_type, campus, study_mode, duration, source_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published')
         ON CONFLICT (code) DO UPDATE SET status = 'published', updated_at = NOW()
         RETURNING id`,
        [degree.name, degree.code.toUpperCase(), degree.description || null, degree.degree_type || null, degree.campus || null, degree.study_mode || null, degree.duration || null, degree.source_url || null]
      );
      degreeId = created.rows[0].id;
    }

    const courseIds = [];
    for (const course of payload.courses || []) {
      const action = course.action || 'create';
      if (action === 'ignore') continue;
      const code = course.code?.toUpperCase();
      if (!code) continue;

      let unitId = course.existing_match?.id || course.unit_id || null;
      if (unitId) {
        if (['update_existing', 'merge'].includes(action)) {
          await client.query(
            `UPDATE units SET
              name = COALESCE($1, name), code = COALESCE($2, code), classroom_type = COALESCE($3, classroom_type),
              description = COALESCE($4, description), prerequisites = COALESCE($5, prerequisites),
              credit_points = COALESCE($6, credit_points), source_url = COALESCE($7, source_url),
              status = 'published', updated_at = NOW()
             WHERE id = $8`,
            [course.name || null, code, course.classroom_type || null, course.description || null, course.prerequisites || null, course.credit_points || null, course.source_url || null, unitId]
          );
        } else {
          await client.query("UPDATE units SET status = 'published', updated_at = NOW() WHERE id = $1", [unitId]);
        }
      } else {
        const created = await client.query(
          `INSERT INTO units (name, code, classroom_type, description, prerequisites, credit_points, source_url, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'published')
           ON CONFLICT (code) DO UPDATE SET status = 'published', updated_at = NOW()
           RETURNING id`,
          [course.name || code, code, course.classroom_type || 'normal', course.description || null, course.prerequisites || null, course.credit_points || null, course.source_url || null]
        );
        unitId = created.rows[0].id;
      }

      const degreeIds = [...new Set([degreeId, ...(course.degree_ids || [])].filter(Boolean))];
      for (const associatedDegreeId of degreeIds) {
        await client.query(
          `INSERT INTO unit_degrees (unit_id, degree_id) VALUES ($1, $2)
           ON CONFLICT (unit_id, degree_id) DO NOTHING`,
          [unitId, associatedDegreeId]
        );
      }

      await client.query('DELETE FROM unit_offering_patterns WHERE unit_id = $1', [unitId]);
      for (const pattern of course.offering_patterns || []) {
        const periodType = String(pattern.period_type).toUpperCase();
        const periodNumber = Number(pattern.period_number);
        const valid = (periodType === 'TRIMESTER' && periodNumber >= 1 && periodNumber <= 3)
          || (periodType === 'SEMESTER' && periodNumber >= 1 && periodNumber <= 2)
          || (periodType === 'SESSION' && periodNumber >= 1 && periodNumber <= 8);
        if (!valid) continue;
        const codeValue = pattern.code || (periodType === 'TRIMESTER' ? `T${periodNumber}` : periodType === 'SEMESTER' ? `SEM${periodNumber}` : `S${periodNumber}`);
        await client.query(
          `INSERT INTO unit_offering_patterns (unit_id, period_type, period_number, code)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (unit_id, period_type, period_number) DO NOTHING`,
          [unitId, periodType, periodNumber, codeValue]
        );
      }
      courseIds.push(unitId);
    }

    await client.query(
      `UPDATE degree_course_imports
       SET payload = $1, status = 'published', updated_at = NOW(), published_at = NOW()
       WHERE id = $2`,
      [payload, id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Degree and courses published', degree_id: degreeId, course_ids: courseIds });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error publishing degree/course import:', err);
    res.status(500).json({ error: 'Failed to publish import' });
  } finally {
    client.release();
  }
}

module.exports = { getAll, getById, create, update, remove, extractImport, publishImport };
