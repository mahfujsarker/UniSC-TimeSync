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
    offering_patterns: []
  });

  const offeringOptions = [
    { group: 'Trimesters', options: [
      { label: 'Trimester 1', period_type: 'TRIMESTER', period_number: 1, code: 'T1' },
      { label: 'Trimester 2', period_type: 'TRIMESTER', period_number: 2, code: 'T2' },
      { label: 'Trimester 3', period_type: 'TRIMESTER', period_number: 3, code: 'T3' }
    ] },
    { group: 'Sessions', options: [
      { label: 'Session 1', period_type: 'SESSION', period_number: 1, code: 'S1' },
      { label: 'Session 2', period_type: 'SESSION', period_number: 2, code: 'S2' },
      { label: 'Session 3', period_type: 'SESSION', period_number: 3, code: 'S3' }
    ] }
  ];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [unitRes, degRes] = await Promise.all([
        api.get('/units'),
        api.get('/degrees')
      ]);
      setUnits(unitRes.data);
      setDegrees(degRes.data);
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
        offering_patterns: unit.offering_patterns || []
      });
    } else {
      setUnitForm({
        name: '',
        code: '',
        degree_ids: [],
        classroom_type: 'normal',
        class_duration: 1,
        offering_patterns: []
      });
    }
    setShowUnitModal(true);
  };

  const isOfferingSelected = (option) => unitForm.offering_patterns.some(pattern =>
    pattern.period_type === option.period_type && Number(pattern.period_number) === option.period_number
  );

  const handleOfferingToggle = (option) => {
    setUnitForm(prev => {
      const exists = prev.offering_patterns.some(pattern =>
        pattern.period_type === option.period_type && Number(pattern.period_number) === option.period_number
      );
      if (exists) {
        return {
          ...prev,
          offering_patterns: prev.offering_patterns.filter(pattern =>
            !(pattern.period_type === option.period_type && Number(pattern.period_number) === option.period_number)
          )
        };
      }
      return { ...prev, offering_patterns: [...prev.offering_patterns, option] };
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
  const offeringLabel = (pattern) => `${pattern.period_type === 'SESSION' ? 'Session' : 'Trimester'} ${pattern.period_number}`;

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <p className="page-kicker">Course catalogue</p>
          <h2 className="page-title" style={{ fontFamily: 'var(--font-heading)' }}>Unit Management</h2>
          <p className="page-subtitle">Manage units for your courses. Class generation is handled in Timetable Manager.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openUnitModal()}>
          + Create Unit
        </button>
      </div>

      <div className="glass-card p-4 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="badge badge-info">Note:</span>
          <span className="text-surface-600">
            Classes are generated in the Timetable Manager where you can enter enrolled student numbers.
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
                  <th>Normally Offered In</th>
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
                        {(unit.offering_patterns || []).slice(0, 3).map(pattern => (
                          <span key={`${pattern.period_type}-${pattern.period_number}`} className="bg-surface-200 text-surface-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {offeringLabel(pattern)}
                          </span>
                        ))}
                        {(unit.offering_patterns || []).length > 3 && (
                          <span className="text-surface-500 text-xs">+{unit.offering_patterns.length - 3}</span>
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
            <label className="form-label block mb-1">Normally Offered In</label>
            <p className="text-xs text-surface-500 mb-2">Select the teaching periods this unit is normally offered in each year.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-50 rounded border border-surface-200">
              {offeringOptions.map(group => (
                <div key={group.group}>
                  <div className="text-xs font-bold text-surface-600 mb-2">{group.group}</div>
                  <div className="space-y-2">
                    {group.options.map(option => (
                      <label key={option.code} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-brand-blue rounded border-surface-300"
                          checked={isOfferingSelected(option)}
                          onChange={() => handleOfferingToggle(option)}
                        />
                        <span className="text-sm font-medium text-surface-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
