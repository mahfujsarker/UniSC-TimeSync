/**
 * Unit Controller
 * CRUD operations for units/courses with automatic class generation.
 */
const pool = require('../config/db');
const classController = require('./classController');

async function getAll(req, res) {
  try {
    const { degree_id, trimester_id } = req.query;
    
    let query = `
      SELECT u.*,
             COALESCE(json_agg(ut.trimester_id) FILTER (WHERE ut.trimester_id IS NOT NULL), '[]') as trimester_ids,
             COALESCE(json_agg(
               json_build_object('id', d.id, 'code', d.code, 'name', d.name)
             ) FILTER (WHERE d.id IS NOT NULL), '[]') as degrees
      FROM units u
      LEFT JOIN unit_degrees ud ON u.id = ud.unit_id
      LEFT JOIN degrees d ON ud.degree_id = d.id
      LEFT JOIN unit_trimesters ut ON u.id = ut.unit_id
    `;
    const params = [];
    const conditions = [];
    
    if (degree_id) {
      params.push(degree_id);
      conditions.push(`ud.degree_id = $${params.length}`);
    }
    
    if (trimester_id) {
      params.push(trimester_id);
      conditions.push(`EXISTS (SELECT 1 FROM unit_trimesters ut2 WHERE ut2.unit_id = u.id AND ut2.trimester_id = $${params.length})`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ' GROUP BY u.id ORDER BY u.code ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching units:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT u.*,
              COALESCE(json_agg(ut.trimester_id) FILTER (WHERE ut.trimester_id IS NOT NULL), '[]') as trimester_ids,
              COALESCE(json_agg(
                json_build_object('id', d.id, 'code', d.code, 'name', d.name)
              ) FILTER (WHERE d.id IS NOT NULL), '[]') as degrees
       FROM units u 
       LEFT JOIN unit_degrees ud ON u.id = ud.unit_id
       LEFT JOIN degrees d ON ud.degree_id = d.id
       LEFT JOIN unit_trimesters ut ON u.id = ut.unit_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching unit:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getByDegree(req, res) {
  try {
    const { degreeId } = req.params;
    const result = await pool.query(
      `SELECT u.*, d.name as degree_name, d.code as degree_code
       FROM units u 
       JOIN unit_degrees ud ON u.id = ud.unit_id
       JOIN degrees d ON ud.degree_id = d.id
       WHERE ud.degree_id = $1
       ORDER BY u.code ASC`,
      [degreeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching units by degree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  const client = await pool.connect();
  try {
    const { name, code, degree_ids, classroom_type, total_students, class_duration, trimester_ids, auto_generate_classes, trimester_for_classes } = req.body;
    
    if (!name || !code || !degree_ids || degree_ids.length === 0) {
      return res.status(400).json({ error: 'Name, code, and at least one degree_id are required' });
    }

    await client.query('BEGIN');
    
    const unitResult = await client.query(
      `INSERT INTO units (name, code, classroom_type, total_students, class_duration) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, code.toUpperCase(), classroom_type || 'normal', total_students || 0, class_duration || 1]
    );
    const newUnit = unitResult.rows[0];

    for (const deg_id of degree_ids) {
      await client.query(
        'INSERT INTO unit_degrees (unit_id, degree_id) VALUES ($1, $2)',
        [newUnit.id, deg_id]
      );
    }

    if (Array.isArray(trimester_ids) && trimester_ids.length > 0) {
      for (const t_id of trimester_ids) {
        await client.query(
          'INSERT INTO unit_trimesters (unit_id, trimester_id) VALUES ($1, $2)',
          [newUnit.id, t_id]
        );
      }
    }

    let classesCreated = null;
    if (auto_generate_classes && trimester_for_classes) {
      const numClasses = classController.calculateNumberOfClasses(
        total_students || 0, 
        classroom_type || 'normal'
      );
      const groups = [];
      for (let i = 0; i < numClasses; i++) {
        const letter = String.fromCharCode(65 + i);
        const capacity = classController.ROOM_CAPACITIES[classroom_type || 'normal'] || 30;
        const result = await client.query(
          `INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (unit_id, trimester_id, group_name) DO UPDATE SET
             max_capacity = $6, duration = $5, updated_at = NOW()
           RETURNING *`,
          [newUnit.id, trimester_for_classes, `Group ${letter}`, classroom_type || 'normal', class_duration || 1, capacity]
        );
        groups.push(result.rows[0]);
      }
      classesCreated = groups;
    }

    await client.query('COMMIT');
    
    newUnit.trimester_ids = trimester_ids || [];
    newUnit._classes_generated = classesCreated ? {
      trimester_id: trimester_for_classes,
      count: classesCreated.length,
      classes: classesCreated
    } : null;
    
    res.status(201).json(newUnit);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Unit code already exists' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid reference (degree or trimester not found)' });
    }
    console.error('Error creating unit:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function update(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, code, degree_ids, classroom_type, total_students, class_duration, trimester_ids, regenerate_classes } = req.body;
    
    await client.query('BEGIN');

    const currentUnit = await client.query('SELECT * FROM units WHERE id = $1', [id]);
    if (currentUnit.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Unit not found' });
    }
    const existingUnit = currentUnit.rows[0];

    if (code) {
      const codeExists = await client.query(
        'SELECT id FROM units WHERE code = $1 AND id != $2',
        [code.toUpperCase(), id]
      );
      if (codeExists.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Unit code already exists' });
      }
    }

    const result = await client.query(
      `UPDATE units SET 
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        classroom_type = COALESCE($3, classroom_type),
        total_students = COALESCE($4, total_students),
        class_duration = COALESCE($5, class_duration),
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, code ? code.toUpperCase() : null, classroom_type, total_students, class_duration, id]
    );
    const updatedUnit = result.rows[0];

    if (total_students !== undefined && total_students !== existingUnit.total_students) {
      const trimesterRows = await client.query('SELECT trimester_id FROM unit_trimesters WHERE unit_id = $1', [id]);
      const trimesterIds = trimesterRows.rows.map(r => r.trimester_id);
      
      for (const tId of trimesterIds) {
        await client.query('DELETE FROM classes WHERE unit_id = $1 AND trimester_id = $2', [id, tId]);
        
        const numClasses = classController.calculateNumberOfClasses(
          total_students,
          classroom_type || existingUnit.classroom_type
        );
        const duration = class_duration || existingUnit.class_duration;
        const roomType = classroom_type || existingUnit.classroom_type;
        const capacity = classController.ROOM_CAPACITIES[roomType] || 30;

        for (let i = 0; i < numClasses; i++) {
          const letter = String.fromCharCode(65 + i);
          await client.query(
            `INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, tId, `Group ${letter}`, roomType, duration, capacity]
          );
        }
      }
    }

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
      updatedUnit.trimester_ids = trimester_ids;
    }

    if (regenerate_classes) {
      const trimesterId = req.body.trimester_for_classes_regen || trimester_ids?.[0];
      if (trimesterId) {
        await client.query('DELETE FROM classes WHERE unit_id = $1 AND trimester_id = $2', [id, trimesterId]);
        const numClasses = classController.calculateNumberOfClasses(
          total_students || existingUnit.total_students,
          classroom_type || existingUnit.classroom_type
        );
        const duration = class_duration || existingUnit.class_duration;
        const roomType = classroom_type || existingUnit.classroom_type;
        const capacity = classController.ROOM_CAPACITIES[roomType] || 30;

        for (let i = 0; i < numClasses; i++) {
          const letter = String.fromCharCode(65 + i);
          await client.query(
            `INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (unit_id, trimester_id, group_name) DO UPDATE SET
               max_capacity = $6, duration = $5, updated_at = NOW()`,
            [id, trimesterId, `Group ${letter}`, roomType, duration, capacity]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json(updatedUnit);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating unit:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM units WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json({ message: 'Unit deleted successfully' });
  } catch (err) {
    console.error('Error deleting unit:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getAll, getById, getByDegree, create, update, remove };
