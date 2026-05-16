/**
 * Class Controller
 * Manages class instances generated based on course capacity.
 */
const pool = require('../config/db');
const { ensureAcademicSchema } = require('../utils/academicSchema');

const ROOM_CAPACITIES = {
  lab: 25,
  normal: 30
};

function calculateNumberOfClasses(totalStudents, roomType) {
  const capacity = ROOM_CAPACITIES[roomType] || 30;
  return Math.max(1, Math.ceil(totalStudents / capacity));
}

function generateGroupNames(numClasses) {
  const groups = [];
  for (let i = 0; i < numClasses; i++) {
    const letter = String.fromCharCode(65 + i);
    groups.push(`Group ${letter}`);
  }
  return groups;
}

async function getAll(req, res) {
  try {
    await ensureAcademicSchema();
    const { trimester_id, unit_id, degree_id } = req.query;
    
    let query = `
      SELECT c.*, 
             u.name as unit_name, u.code as unit_code, u.classroom_type,
             d.name as degree_name, d.code as degree_code,
             t.name as trimester_name,
             (SELECT COUNT(*) FROM timetable_entries te WHERE te.class_id = c.id) as scheduled_count
      FROM classes c
      JOIN units u ON c.unit_id = u.id
      JOIN unit_degrees ud ON u.id = ud.unit_id
      JOIN degrees d ON ud.degree_id = d.id
      JOIN trimesters t ON c.trimester_id = t.id
      WHERE u.status = 'published' AND d.status = 'published'
    `;
    const params = [];
    let paramIdx = 1;

    if (trimester_id) {
      query += ` AND c.trimester_id = $${paramIdx++}`;
      params.push(trimester_id);
    }
    if (unit_id) {
      query += ` AND c.unit_id = $${paramIdx++}`;
      params.push(unit_id);
    }
    if (degree_id) {
      query += ` AND ud.degree_id = $${paramIdx++}`;
      params.push(degree_id);
    }
    query += ' GROUP BY c.id, u.id, d.id, t.id ORDER BY u.code, c.group_name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching classes:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getById(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.*, 
              u.name as unit_name, u.code as unit_code,
              d.name as degree_name, d.code as degree_code,
              t.name as trimester_name
       FROM classes c
       JOIN units u ON c.unit_id = u.id
       JOIN unit_degrees ud ON u.id = ud.unit_id
       JOIN degrees d ON ud.degree_id = d.id
       JOIN trimesters t ON c.trimester_id = t.id
       WHERE c.id = $1 AND u.status = 'published' AND d.status = 'published'`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching class:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getByCourseAndTrimester(req, res) {
  try {
    await ensureAcademicSchema();
    const course_id = req.query.course_id || req.query.unit_id;
    const { trimester_id } = req.query;
    
    if (!course_id || !trimester_id) {
      return res.status(400).json({ error: 'course_id and trimester_id are required' });
    }

    const result = await pool.query(
      `SELECT c.*, 
              u.name as unit_name, u.code as unit_code,
              (SELECT COUNT(*) FROM timetable_entries te WHERE te.class_id = c.id AND te.is_recurring = true) as is_scheduled
       FROM classes c
       JOIN units u ON c.unit_id = u.id
       WHERE c.unit_id = $1 AND c.trimester_id = $2 AND u.status = 'published'
       ORDER BY c.group_name`,
      [course_id, trimester_id]
    );

    res.json({
      course_id,
      trimester_id,
      classes: result.rows,
      has_classes: result.rows.length > 0
    });
  } catch (err) {
    console.error('Error fetching classes by course and trimester:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUnscheduled(req, res) {
  try {
    await ensureAcademicSchema();
    const { trimester_id, degree_id } = req.query;
    
    let query = `
      SELECT c.*, 
             u.name as unit_name, u.code as unit_code, u.classroom_type, u.class_duration,
             d.name as degree_name, d.code as degree_code,
             t.name as trimester_name
      FROM classes c
      JOIN units u ON c.unit_id = u.id
      JOIN unit_degrees ud ON u.id = ud.unit_id
      JOIN degrees d ON ud.degree_id = d.id
      JOIN trimesters t ON c.trimester_id = t.id
      WHERE NOT EXISTS (
        SELECT 1 FROM timetable_entries te 
        WHERE te.class_id = c.id AND te.is_recurring = true
      )
        AND u.status = 'published'
        AND d.status = 'published'
    `;
    const params = [];
    let paramIdx = 1;

    if (trimester_id) {
      query += ` AND c.trimester_id = $${paramIdx++}`;
      params.push(trimester_id);
    }
    if (degree_id) {
      query += ` AND ud.degree_id = $${paramIdx++}`;
      params.push(degree_id);
    }
    query += ' ORDER BY u.code, c.group_name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching unscheduled classes:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createForCourse(req, res) {
  const client = await pool.connect();
  try {
    await ensureAcademicSchema();
    const course_id = req.body.course_id || req.body.unit_id;
    const { trimester_id, group_name, required_room_type, duration, max_capacity, enrolled_students } = req.body;

    if (!course_id || !trimester_id) {
      return res.status(400).json({ error: 'course_id and trimester_id are required' });
    }

    const courseResult = await client.query("SELECT * FROM units WHERE id = $1 AND status = 'published'", [course_id]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const course = courseResult.rows[0];

    const roomType = required_room_type || course.classroom_type;
    const classDuration = duration || course.class_duration;
    const capacity = max_capacity || (roomType === 'lab' ? 25 : 30);
    const name = group_name || 'Group A';
    const enrolled = enrolled_students || 0;

    await client.query('BEGIN');

    const existingResult = await client.query(
      'SELECT * FROM classes WHERE unit_id = $1 AND trimester_id = $2 AND group_name = $3',
      [course_id, trimester_id, name]
    );

    let createdClass;
    if (existingResult.rows.length > 0) {
      await client.query(
        `UPDATE classes SET required_room_type = $1, duration = $2, max_capacity = $3, enrolled_students = $4, updated_at = NOW() WHERE id = $5`,
        [roomType, classDuration, capacity, enrolled, existingResult.rows[0].id]
      );
      createdClass = existingResult.rows[0];
    } else {
      const result = await client.query(
        `INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity, enrolled_students)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [course_id, trimester_id, name, roomType, classDuration, capacity, enrolled]
      );
      createdClass = result.rows[0];
    }

    await client.query('COMMIT');
    res.status(201).json(createdClass);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating class:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function createBatchForTrimester(req, res) {
  const client = await pool.connect();
  try {
    await ensureAcademicSchema();
    const { trimester_id, degree_id } = req.body;

    if (!trimester_id) {
      return res.status(400).json({ error: 'trimester_id is required' });
    }

    await client.query('BEGIN');

    let courseQuery = `
      SELECT u.*,
             EXISTS(SELECT 1 FROM classes c WHERE c.unit_id = u.id AND c.trimester_id = $1) as has_existing_classes
      FROM units u
      JOIN trimesters tp ON tp.id = $1
      JOIN unit_offering_patterns uop ON uop.unit_id = u.id
        AND uop.period_type = tp.type
        AND uop.period_number = tp.period_number
      WHERE tp.status = 'published'
        AND u.status = 'published'
        AND EXISTS (
          SELECT 1
          FROM unit_degrees ud2
          JOIN degrees d2 ON d2.id = ud2.degree_id
          WHERE ud2.unit_id = u.id AND d2.status = 'published'
        )
    `;
    const params = [trimester_id];

    if (degree_id) {
      courseQuery += ` AND EXISTS (
        SELECT 1 FROM unit_degrees ud
        JOIN degrees d ON d.id = ud.degree_id
        WHERE ud.unit_id = u.id AND ud.degree_id = $2 AND d.status = 'published'
      )`;
      params.push(degree_id);
    }

    const coursesResult = await client.query(courseQuery, params);

    const results = [];
    let totalGenerated = 0;

    for (const course of coursesResult.rows) {
      if (course.has_existing_classes) {
        results.push({
          unit_id: course.id,
          unit_name: course.name,
          unit_code: course.code,
          status: 'already_exists',
          classes_created: 0
        });
        continue;
      }

      const numClasses = calculateNumberOfClasses(course.total_students || 0, course.classroom_type);
      const groupNames = generateGroupNames(numClasses);
      const capacity = ROOM_CAPACITIES[course.classroom_type] || 30;

      for (const groupName of groupNames) {
        await client.query(
          `INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [course.id, trimester_id, groupName, course.classroom_type, course.class_duration, capacity]
        );
        totalGenerated++;
      }

      results.push({
        unit_id: course.id,
        unit_name: course.name,
        unit_code: course.code,
        status: 'generated',
        classes_created: numClasses
      });
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: `Generated ${totalGenerated} classes across ${results.filter(r => r.status === 'generated').length} courses`,
      total_generated: totalGenerated,
      results
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error batch creating classes:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function update(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const { group_name, duration, max_capacity, enrolled_students } = req.body;

    const result = await pool.query(
      `UPDATE classes SET
        group_name = COALESCE($1, group_name),
        duration = COALESCE($2, duration),
        max_capacity = COALESCE($3, max_capacity),
        enrolled_students = COALESCE($4, enrolled_students),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [group_name, duration, max_capacity, enrolled_students, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating class:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  try {
    await ensureAcademicSchema();
    const { id } = req.params;
    const result = await pool.query('DELETE FROM classes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json({ message: 'Class deleted successfully' });
  } catch (err) {
    console.error('Error deleting class:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function removeByCourse(req, res) {
  try {
    await ensureAcademicSchema();
    const course_id = req.query.course_id || req.query.unit_id;
    const { trimester_id } = req.query;
    if (!course_id || !trimester_id) {
      return res.status(400).json({ error: 'course_id and trimester_id are required' });
    }
    const result = await pool.query(
      'DELETE FROM classes WHERE unit_id = $1 AND trimester_id = $2 RETURNING *',
      [course_id, trimester_id]
    );
    res.json({ 
      message: `${result.rowCount} class(es) deleted`,
      deleted_count: result.rowCount 
    });
  } catch (err) {
    console.error('Error deleting classes by course:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getAll,
  getById,
  getByCourseAndTrimester,
  getByUnitAndTrimester: getByCourseAndTrimester,
  getUnscheduled,
  createForCourse,
  createForUnit: createForCourse,
  createBatchForTrimester,
  update,
  remove,
  removeByCourse,
  removeByUnit: removeByCourse,
  calculateNumberOfClasses,
  ROOM_CAPACITIES
};

