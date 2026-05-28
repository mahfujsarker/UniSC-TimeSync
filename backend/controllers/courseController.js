/**
 * Course Controller
 * CRUD operations for courses.
 */
const pool = require('../config/db');
const { ensureAcademicSchema } = require('../utils/academicSchema');

const STATUS_VALUES = new Set(['draft', 'reviewed', 'published', 'archived']);

function includeInactive(req) {
  return req.user?.role === 'admin' && String(req.query.include_inactive || '').toLowerCase() === 'true';
}

function normalizeStatus(status, fallback = 'published') {
  return STATUS_VALUES.has(status) ? status : fallback;
}

function normalizeOfferingPatterns(patterns = []) {
  // Deduplicate and validate period rules before saving. This protects the
  // scheduler from invalid combinations such as Session 99.
  return [...new Map(patterns
    .filter(pattern => pattern && pattern.period_type && pattern.period_number)
    .map(pattern => {
      const periodType = String(pattern.period_type).toUpperCase();
      const periodNumber = Number(pattern.period_number);
      const code = pattern.code || (periodType === 'TRIMESTER' ? `T${periodNumber}` : periodType === 'SEMESTER' ? `SEM${periodNumber}` : `S${periodNumber}`);
      return [`${periodType}-${periodNumber}`, { period_type: periodType, period_number: periodNumber, code }];
    })).values()]
    .filter(pattern =>
      (pattern.period_type === 'TRIMESTER' && pattern.period_number >= 1 && pattern.period_number <= 3)
      || (pattern.period_type === 'SEMESTER' && pattern.period_number >= 1 && pattern.period_number <= 2)
      || (pattern.period_type === 'SESSION' && pattern.period_number >= 1 && pattern.period_number <= 8)
    );
}

async function replaceOfferingPatterns(client, unitId, patterns) {
  // Offering patterns are authoritative per course, so updates replace the
  // whole set instead of trying to diff individual checkboxes.
  await client.query('DELETE FROM unit_offering_patterns WHERE unit_id = $1', [unitId]);
  for (const pattern of normalizeOfferingPatterns(patterns)) {
    await client.query(
      `INSERT INTO unit_offering_patterns (unit_id, period_type, period_number, code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (unit_id, period_type, period_number) DO NOTHING`,
      [unitId, pattern.period_type, pattern.period_number, pattern.code]
    );
  }
}

async function getAll(req, res) {
  try {
    await ensureAcademicSchema();
    const { degree_id, trimester_id } = req.query;
    
    let query = `
      SELECT u.*,
             COALESCE(jsonb_agg(DISTINCT jsonb_build_object('period_type', uop.period_type, 'period_number', uop.period_number, 'code', uop.code))
               FILTER (WHERE uop.id IS NOT NULL), '[]') as offering_patterns,
             COALESCE(jsonb_agg(DISTINCT ut.trimester_id) FILTER (WHERE ut.trimester_id IS NOT NULL), '[]') as trimester_ids,
             COALESCE(jsonb_agg(DISTINCT
                jsonb_build_object('id', d.id, 'code', d.code, 'name', d.name)
             ) FILTER (WHERE d.id IS NOT NULL), '[]') as degrees
      FROM units u
      LEFT JOIN unit_degrees ud ON u.id = ud.unit_id
      LEFT JOIN degrees d ON ud.degree_id = d.id
      LEFT JOIN unit_trimesters ut ON u.id = ut.unit_id
      LEFT JOIN unit_offering_patterns uop ON u.id = uop.unit_id
    `;
    const params = [];
    const conditions = [];
    
    if (degree_id) {
      params.push(degree_id);
      conditions.push(`ud.degree_id = $${params.length}`);
    }
    
    if (trimester_id) {
      params.push(trimester_id);
      conditions.push(`EXISTS (
        SELECT 1
        FROM trimesters tp
        JOIN unit_offering_patterns uop2 ON uop2.period_type = tp.type AND uop2.period_number = tp.period_number
        WHERE tp.id = $${params.length} AND tp.status = 'published' AND uop2.unit_id = u.id
      )`);
    }

    if (!includeInactive(req)) {
      conditions.push("u.status = 'published'");
      conditions.push("COALESCE(d.status, 'published') = 'published'");
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ' GROUP BY u.id ORDER BY u.code ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getById(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const result = await pool.query(
      `SELECT u.*,
              COALESCE(jsonb_agg(DISTINCT jsonb_build_object('period_type', uop.period_type, 'period_number', uop.period_number, 'code', uop.code))
                FILTER (WHERE uop.id IS NOT NULL), '[]') as offering_patterns,
              COALESCE(jsonb_agg(DISTINCT ut.trimester_id) FILTER (WHERE ut.trimester_id IS NOT NULL), '[]') as trimester_ids,
              COALESCE(jsonb_agg(DISTINCT
                jsonb_build_object('id', d.id, 'code', d.code, 'name', d.name)
              ) FILTER (WHERE d.id IS NOT NULL), '[]') as degrees
       FROM units u 
       LEFT JOIN unit_degrees ud ON u.id = ud.unit_id
       LEFT JOIN degrees d ON ud.degree_id = d.id
       LEFT JOIN unit_trimesters ut ON u.id = ut.unit_id
       LEFT JOIN unit_offering_patterns uop ON u.id = uop.unit_id
       WHERE u.id = $1 ${req.user?.role === 'admin' ? '' : "AND u.status = 'published'"}
       GROUP BY u.id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching course:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getByDegree(req, res) {
  try {
    await ensureAcademicSchema();
    const { degreeId } = req.params;
    const result = await pool.query(
      `SELECT u.*, d.name as degree_name, d.code as degree_code
       FROM units u 
       JOIN unit_degrees ud ON u.id = ud.unit_id
       JOIN degrees d ON ud.degree_id = d.id
       WHERE ud.degree_id = $1
         AND u.status = 'published'
         AND d.status = 'published'
       ORDER BY u.code ASC`,
      [degreeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching courses by degree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getByDegreeAndTrimester(req, res) {
  try {
    await ensureAcademicSchema();
    const { degree_id, trimester_id } = req.query;
    
    if (!trimester_id) {
      return res.status(400).json({ error: 'trimester_id is required' });
    }
    
    // Match courses to a teaching period by type/number, not by a single
    // concrete trimester id, so the same course can recur each year.
    let query = `
      SELECT u.*,
             COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', d.id, 'code', d.code, 'name', d.name)) FILTER (WHERE d.id IS NOT NULL), '[]') as degrees,
             COALESCE(jsonb_agg(DISTINCT jsonb_build_object('period_type', uop.period_type, 'period_number', uop.period_number, 'code', uop.code))
               FILTER (WHERE uop.id IS NOT NULL), '[]') as offering_patterns,
             COALESCE(
               (SELECT jsonb_agg(jsonb_build_object('id', c.id, 'group_name', c.group_name, 'duration', c.duration, 'max_capacity', c.max_capacity, 'required_room_type', c.required_room_type))
                FROM classes c WHERE c.unit_id = u.id AND c.trimester_id = $1), '[]'
             ) as classes
      FROM units u
      JOIN unit_degrees ud ON u.id = ud.unit_id
      JOIN degrees d ON ud.degree_id = d.id
      JOIN trimesters tp ON tp.id = $1
      JOIN unit_offering_patterns uop_match ON uop_match.unit_id = u.id
        AND uop_match.period_type = tp.type
        AND uop_match.period_number = tp.period_number
      LEFT JOIN unit_offering_patterns uop ON u.id = uop.unit_id
      WHERE tp.status = 'published'
        AND u.status = 'published'
        AND d.status = 'published'
    `;
    const params = [trimester_id];
    
    if (degree_id) {
      params.push(degree_id);
      query += ` AND ud.degree_id = $2`;
    }
    
    query += ` GROUP BY u.id ORDER BY u.code ASC`;
    
    const result = await pool.query(query, params);
    
    const coursesWithStatus = result.rows.map(course => ({
      ...course,
      has_classes: (course.classes || []).length > 0,
      classes_count: (course.classes || []).length
    }));
    
    res.json(coursesWithStatus);
  } catch (err) {
    console.error('Error fetching courses by degree and teaching period:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  const client = await pool.connect();
  try {
    await ensureAcademicSchema();
    const { name, code, degree_ids, classroom_type, class_duration, trimester_ids, offering_patterns, description, prerequisites, credit_points, source_url, status } = req.body;

    if (!name || !code || !degree_ids || degree_ids.length === 0) {
      return res.status(400).json({ error: 'Name, code, and at least one degree_id are required' });
    }

    await client.query('BEGIN');

    const existingCourse = await client.query('SELECT * FROM units WHERE UPPER(code) = $1', [code.toUpperCase()]);
    let newCourse;
    if (existingCourse.rows.length > 0) {
      newCourse = existingCourse.rows[0];
      const updatedExisting = await client.query(
        `UPDATE units SET
          name = COALESCE($1, name),
          classroom_type = COALESCE($2, classroom_type),
          class_duration = COALESCE($3, class_duration),
          description = COALESCE($4, description),
          prerequisites = COALESCE($5, prerequisites),
          credit_points = COALESCE($6, credit_points),
          source_url = COALESCE($7, source_url),
          status = COALESCE($8, status),
          updated_at = NOW()
         WHERE id = $9 RETURNING *`,
        [name || null, classroom_type || null, class_duration || null, description || null, prerequisites || null, credit_points || null, source_url || null, status ? normalizeStatus(status) : null, newCourse.id]
      );
      newCourse = updatedExisting.rows[0];
    } else {
      const courseResult = await client.query(
        `INSERT INTO units (name, code, classroom_type, total_students, class_duration, description, prerequisites, credit_points, source_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [name, code.toUpperCase(), classroom_type || 'normal', 0, class_duration || 1, description || null, prerequisites || null, credit_points || null, source_url || null, normalizeStatus(status)]
      );
      newCourse = courseResult.rows[0];
    }

    for (const deg_id of degree_ids) {
      await client.query(
        'INSERT INTO unit_degrees (unit_id, degree_id) VALUES ($1, $2) ON CONFLICT (unit_id, degree_id) DO NOTHING',
        [newCourse.id, deg_id]
      );
    }

    if (Array.isArray(trimester_ids) && trimester_ids.length > 0) {
      for (const t_id of trimester_ids) {
        await client.query(
          'INSERT INTO unit_trimesters (unit_id, trimester_id) VALUES ($1, $2)',
          [newCourse.id, t_id]
        );
      }
    }
    await replaceOfferingPatterns(client, newCourse.id, offering_patterns || []);

    await client.query('COMMIT');

    newCourse.trimester_ids = trimester_ids || [];
    newCourse.offering_patterns = normalizeOfferingPatterns(offering_patterns || []);
    newCourse.degrees = degree_ids.map(id => ({ id }));

    res.status(201).json(newCourse);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Course code already exists' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid reference (degree or trimester not found)' });
    }
    console.error('Error creating course:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function update(req, res) {
  const client = await pool.connect();
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const { name, code, degree_ids, classroom_type, total_students, class_duration, trimester_ids, offering_patterns, description, prerequisites, credit_points, source_url, status } = req.body;

    await client.query('BEGIN');

    const currentCourse = await client.query('SELECT * FROM units WHERE id = $1', [id]);
    if (currentCourse.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Course not found' });
    }

    if (code) {
      const codeExists = await client.query(
        'SELECT id FROM units WHERE code = $1 AND id != $2',
        [code.toUpperCase(), id]
      );
      if (codeExists.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Course code already exists' });
      }
    }

    const result = await client.query(
      `UPDATE units SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        classroom_type = COALESCE($3, classroom_type),
        total_students = COALESCE($4, total_students),
        class_duration = COALESCE($5, class_duration),
        description = COALESCE($6, description),
        prerequisites = COALESCE($7, prerequisites),
        credit_points = COALESCE($8, credit_points),
        source_url = COALESCE($9, source_url),
        status = COALESCE($10, status),
        updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [name, code ? code.toUpperCase() : null, classroom_type, total_students, class_duration, description || null, prerequisites || null, credit_points || null, source_url || null, status ? normalizeStatus(status) : null, id]
    );
    const updatedCourse = result.rows[0];

    if (Array.isArray(degree_ids)) {
      await client.query('DELETE FROM unit_degrees WHERE unit_id = $1', [id]);
      const uniqueDegreeIds = [...new Set(degree_ids)];
      for (const deg_id of uniqueDegreeIds) {
        await client.query(
          'INSERT INTO unit_degrees (unit_id, degree_id) VALUES ($1, $2)',
          [id, deg_id]
        );
      }
    }

    if (Array.isArray(trimester_ids)) {
      await client.query('DELETE FROM unit_trimesters WHERE unit_id = $1', [id]);
      const uniqueTrimesterIds = [...new Set(trimester_ids)];
      for (const t_id of uniqueTrimesterIds) {
        await client.query(
          'INSERT INTO unit_trimesters (unit_id, trimester_id) VALUES ($1, $2)',
          [id, t_id]
        );
      }
      updatedCourse.trimester_ids = trimester_ids;
    }

    if (Array.isArray(offering_patterns)) {
      await replaceOfferingPatterns(client, id, offering_patterns);
      updatedCourse.offering_patterns = normalizeOfferingPatterns(offering_patterns);
    }

    await client.query('COMMIT');
    res.json(updatedCourse);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating course:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function remove(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const result = await pool.query('DELETE FROM units WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    console.error('Error deleting course:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateEnrolledStudents(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const { total_students } = req.body;

    if (!total_students || total_students < 0) {
      return res.status(400).json({ error: 'Valid enrolled student number is required' });
    }

    const result = await pool.query(
      `UPDATE units SET total_students = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [total_students, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating enrolled students:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getAll, getById, getByDegree, getByDegreeAndTrimester, create, update, updateEnrolledStudents, remove };

