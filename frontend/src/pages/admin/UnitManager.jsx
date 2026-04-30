/**
 * Unit Manager Page
 * Dedicated module for managing Units.
 * Class generation is handled separately in the Timetable Manager.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';

export default function UnitManager() {
  const [units, setUnits] = useState([]);
  const [degrees, setDegrees] = useState([]);
  const [trimesters, setTrimesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editUnit, setEditUnit] = useState(null);
  const [unitForm, setUnitForm] = useState({
    name: '',
    code: '',
    degree_ids: [],
    classroom_type: 'normal',
    class_duration: 1,
    trimester_ids: []
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [unitRes, degRes, triRes] = await Promise.all([
        api.get('/units'),
        api.get('/degrees'),
        api.get('/trimesters')
      ]);
      setUnits(unitRes.data);
      setDegrees(degRes.data);
      setTrimesters(triRes.data);
    } catch {
      setToast({ message: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openUnitModal = (unit = null) => {
    setEditUnit(unit);
    if (unit) {
      setUnitForm({
        name: unit.name,
        code: unit.code,
        degree_ids: (unit.degrees || []).map(d => d.id),
        classroom_type: unit.classroom_type,
        class_duration: unit.class_duration || 1,
        trimester_ids: unit.trimester_ids || []
      });
    } else {
      setUnitForm({
        name: '',
        code: '',
        degree_ids: [],
        classroom_type: 'normal',
        class_duration: 1,
        trimester_ids: []
      });
    }
    setShowUnitModal(true);
  };

  const handleTrimesterToggle = (trimesterId) => {
    setUnitForm(prev => {
      const exists = prev.trimester_ids.includes(trimesterId);
      if (exists) {
        return { ...prev, trimester_ids: prev.trimester_ids.filter(id => id !== trimesterId) };
      } else {
        return { ...prev, trimester_ids: [...prev.trimester_ids, trimesterId] };
      }
    });
  };

  const handleDegreeToggle = (degreeId) => {
    setUnitForm(prev => {
      const exists = prev.degree_ids.includes(degreeId);
      if (exists) {
        return { ...prev, degree_ids: prev.degree_ids.filter(id => id !== degreeId) };
      } else {
        return { ...prev, degree_ids: [...prev.degree_ids, degreeId] };
      }
    });
  };

  const saveUnit = async (e) => {
    e.preventDefault();
    try {
      if (editUnit) {
        await api.put(`/units/${editUnit.id}`, unitForm);
        setToast({ message: 'Unit updated', type: 'success' });
      } else {
        await api.post('/units', unitForm);
        setToast({ message: 'Unit created successfully', type: 'success' });
      }
      setShowUnitModal(false);
      fetchData();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to save unit', type: 'error' });
    }
  };

  const deleteUnit = async (id) => {
    if (!window.confirm('Delete this unit? All associated classes and timetable entries will be deleted.')) return;
    try {
      await api.delete(`/units/${id}`);
      setToast({ message: 'Unit deleted', type: 'success' });
      fetchData();
    } catch {
      setToast({ message: 'Failed to delete unit', type: 'error' });
    }
  };

  const roomTypeLabel = (type) => type === 'lab' ? 'Computer Lab' : 'Normal Room';
  const durationLabel = (hours) => `${hours} hour${hours > 1 ? 's' : ''}`;

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark" style={{ fontFamily: 'var(--font-heading)' }}>
            Unit Management
          </h2>
          <p className="text-sm text-surface-600 mt-1">Manage units for your courses. Class generation is handled in Timetable Manager.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openUnitModal()}>
          + Create Unit
        </button>
      </div>

      <div className="glass-card p-4 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="badge badge-info">Note:</span>
          <span className="text-surface-600">
            Enter the tentative number of students that can enroll. Classes are generated separately in the Timetable Manager.
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="glass-card p-12 text-center text-surface-400">Loading units...</div>
        ) : units.length === 0 ? (
          <div className="glass-card p-12 text-center text-surface-500">
            No units found. Create one to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Unit Name</th>
                  <th>Degrees</th>
                  <th>Room Type</th>
                  <th>Duration</th>
                  <th>Trimesters</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map(unit => (
                  <tr key={unit.id}>
                    <td>
                      <span className="badge bg-[#e6eeff] text-[#0044a3]">{unit.code}</span>
                    </td>
                    <td className="font-medium text-brand-dark">{unit.name}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(unit.degrees || []).slice(0, 2).map(deg => (
                          <span key={deg.id} className="bg-[#e6eeff] text-[#0044a3] px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {deg.code}
                          </span>
                        ))}
                        {(unit.degrees || []).length > 2 && (
                          <span className="text-surface-500 text-xs">+{(unit.degrees || []).length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${unit.classroom_type === 'lab' ? 'badge-warning' : 'badge-primary'}`}>
                        {roomTypeLabel(unit.classroom_type)}
                      </span>
                    </td>
                    <td>{durationLabel(unit.class_duration)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(unit.trimester_ids || []).slice(0, 2).map(tid => {
                          const tri = trimesters.find(t => t.id === tid);
                          return (
                            <span key={tid} className="bg-surface-200 text-surface-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {tri?.name || 'Unknown'}
                            </span>
                          );
                        })}
                        {(unit.trimester_ids || []).length > 2 && (
                          <span className="text-surface-500 text-xs">+{unit.trimester_ids.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          className="text-brand-blue hover:text-brand-dark text-xs font-medium"
                          onClick={() => openUnitModal(unit)}
                        >
                          Edit
                        </button>
                        <button 
                          className="text-danger hover:text-red-800 text-xs font-medium"
                          onClick={() => deleteUnit(unit.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal 
        isOpen={showUnitModal} 
        onClose={() => setShowUnitModal(false)} 
        title={editUnit ? 'Edit Unit' : 'New Unit'}
        size="lg"
      >
        <form onSubmit={saveUnit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Unit Name</label>
              <input 
                className="form-input" 
                required 
                placeholder="e.g. Machine Learning" 
                value={unitForm.name} 
                onChange={e => setUnitForm({ ...unitForm, name: e.target.value })} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Code</label>
              <input 
                className="form-input" 
                required 
                placeholder="e.g. ICT706" 
                value={unitForm.code} 
                onChange={e => setUnitForm({ ...unitForm, code: e.target.value })} 
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label block mb-2">Associated Degrees</label>
            {degrees.length === 0 ? (
              <div className="text-sm text-surface-500 italic p-3 bg-surface-50 rounded border border-surface-200">
                No degrees exist. Create them first.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-surface-50 rounded border border-surface-200">
                {degrees.map(d => (
                  <label key={d.id} className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-brand-blue rounded border-surface-300"
                      checked={unitForm.degree_ids.includes(d.id)}
                      onChange={() => handleDegreeToggle(d.id)}
                    />
                    <span className="text-sm font-medium text-surface-700">{d.code} — {d.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Required Room Type</label>
            <select
              className="form-select"
              value={unitForm.classroom_type}
              onChange={e => setUnitForm({ ...unitForm, classroom_type: e.target.value })}
            >
              <option value="normal">Normal Lecture Room</option>
              <option value="lab">Computer Lab</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Class Duration</label>
            <select 
              className="form-select" 
              value={unitForm.class_duration} 
              onChange={e => setUnitForm({ ...unitForm, class_duration: parseInt(e.target.value) })}
            >
              <option value="1">1 Hour</option>
              <option value="2">2 Hours</option>
              <option value="3">3 Hours</option>
              <option value="4">4 Hours</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label block mb-2">Available Trimesters</label>
            {trimesters.length === 0 ? (
              <div className="text-sm text-surface-500 italic p-3 bg-surface-50 rounded border border-surface-200">
                No trimesters exist. Create them first.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-surface-50 rounded border border-surface-200">
                {trimesters.map(t => (
                  <label key={t.id} className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-brand-blue rounded border-surface-300"
                      checked={unitForm.trimester_ids.includes(t.id)}
                      onChange={() => handleTrimesterToggle(t.id)}
                    />
                    <span className="text-sm font-medium text-surface-700">{t.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary flex-1">
              {editUnit ? 'Update Unit' : 'Create Unit'}
            </button>
            <button type="button" onClick={() => setShowUnitModal(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
