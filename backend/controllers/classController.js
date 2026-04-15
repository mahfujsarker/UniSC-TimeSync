/**
 * Class Controller
 * Manages class instances that are auto-generated based on unit capacity.
 */
const pool = require('../config/db');

const ROOM_CAPACITIES = {
  lab: 25,
  normal: 30
};

function calculateNumberOfClasses(totalStudents, roomType) {
  const capacity = ROOM_CAPACITIES[roomType] || 30;
  return Math.ceil(totalStudents / capacity);
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
      WHERE 1=1
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
       WHERE c.id = $1`,
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

async function getUnscheduled(req, res) {
  try {
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

async function createForUnit(req, res) {
  const client = await pool.connect();
  try {
    const { unit_id, trimester_id } = req.body;
    
    if (!unit_id || !trimester_id) {
      return res.status(400).json({ error: 'unit_id and trimester_id are required' });
    }

    const unitResult = await client.query('SELECT * FROM units WHERE id = $1', [unit_id]);
    if (unitResult.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    const unit = unitResult.rows[0];

    const numClasses = calculateNumberOfClasses(unit.total_students, unit.classroom_type);
    const groupNames = generateGroupNames(numClasses);
    const capacity = ROOM_CAPACITIES[unit.classroom_type] || 30;

    await client.query('BEGIN');

    const createdClasses = [];
    for (const groupName of groupNames) {
      const result = await client.query(
        `INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (unit_id, trimester_id, group_name) DO UPDATE SET
           max_capacity = $6, duration = $5, updated_at = NOW()
         RETURNING *`,
        [unit_id, trimester_id, groupName, unit.classroom_type, unit.class_duration, capacity]
      );
      createdClasses.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: `${createdClasses.length} class(es) generated`,
      unit_name: unit.name,
      total_students: unit.total_students,
      room_type: unit.classroom_type,
      classes: createdClasses
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating classes:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function createBatchForTrimester(req, res) {
  const client = await pool.connect();
  try {
    const { trimester_id, degree_id } = req.body;
    
    if (!trimester_id) {
      return res.status(400).json({ error: 'trimester_id is required' });
    }

    await client.query('BEGIN');

    let unitQuery = `
      SELECT u.* FROM units u
      JOIN unit_trimesters ut ON u.id = ut.unit_id
      WHERE ut.trimester_id = $1
    `;
    const params = [trimester_id];
    
    if (degree_id) {
      unitQuery += ' AND EXISTS (SELECT 1 FROM unit_degrees ud WHERE ud.unit_id = u.id AND ud.degree_id = $2)';
      params.push(degree_id);
    }

    const unitsResult = await client.query(unitQuery, params);
    const allCreatedClasses = [];
    const results = [];

    for (const unit of unitsResult.rows) {
      const numClasses = calculateNumberOfClasses(unit.total_students, unit.classroom_type);
      const groupNames = generateGroupNames(numClasses);
      const capacity = ROOM_CAPACITIES[unit.classroom_type] || 30;

      for (const groupName of groupNames) {
        const result = await client.query(
          `INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (unit_id, trimester_id, group_name) DO UPDATE SET
             max_capacity = $6, duration = $5, updated_at = NOW()
           RETURNING *`,
          [unit.id, trimester_id, groupName, unit.classroom_type, unit.class_duration, capacity]
        );
        allCreatedClasses.push(result.rows[0]);
      }

      results.push({
        unit_id: unit.id,
        unit_name: unit.name,
        unit_code: unit.code,
        classes_created: numClasses
      });
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: `Generated ${allCreatedClasses.length} classes across ${results.length} units`,
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
    const { id } = req.params;
    const { group_name, duration, max_capacity } = req.body;
    
    const result = await pool.query(
      `UPDATE classes SET 
        group_name = COALESCE($1, group_name),
        duration = COALESCE($2, duration),
        max_capacity = COALESCE($3, max_capacity),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [group_name, duration, max_capacity, id]
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

async function removeByUnit(req, res) {
  try {
    const { unit_id, trimester_id } = req.query;
    if (!unit_id || !trimester_id) {
      return res.status(400).json({ error: 'unit_id and trimester_id are required' });
    }
    const result = await pool.query(
      'DELETE FROM classes WHERE unit_id = $1 AND trimester_id = $2 RETURNING *',
      [unit_id, trimester_id]
    );
    res.json({ 
      message: `${result.rowCount} class(es) deleted`,
      deleted_count: result.rowCount 
    });
  } catch (err) {
    console.error('Error deleting classes by unit:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getAll,
  getById,
  getUnscheduled,
  createForUnit,
  createBatchForTrimester,
  update,
  remove,
  removeByUnit,
  calculateNumberOfClasses,
  ROOM_CAPACITIES
};
