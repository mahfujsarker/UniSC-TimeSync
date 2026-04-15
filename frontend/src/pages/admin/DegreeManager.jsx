/**
 * Degree Manager Page
 * Dedicated module for managing Degrees independently.
 */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import { Link } from 'react-router-dom';

export default function DegreeManager() {
  const [degrees, setDegrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [showDegreeModal, setShowDegreeModal] = useState(false);
  const [editDegree, setEditDegree] = useState(null);
  const [degreeForm, setDegreeForm] = useState({ name: '', code: '' });

  const fetchDegrees = async () => {
    try {
      setLoading(true);
      const degRes = await api.get('/degrees');
      setDegrees(degRes.data);
    } catch {
      setToast({ message: 'Failed to load degrees', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDegrees(); }, []);

  const openDegreeModal = (degree = null) => {
    setEditDegree(degree);
    setDegreeForm(degree ? { name: degree.name, code: degree.code } : { name: '', code: '' });
    setShowDegreeModal(true);
  };

  const saveDegree = async (e) => {
    e.preventDefault();
    try {
      if (editDegree) {
        await api.put(`/degrees/${editDegree.id}`, degreeForm);
        setToast({ message: 'Degree updated', type: 'success' });
      } else {
        await api.post('/degrees', degreeForm);
        setToast({ message: 'Degree created', type: 'success' });
      }
      setShowDegreeModal(false);
      fetchDegrees();
    } catch {
      setToast({ message: 'Failed to save degree', type: 'error' });
    }
  };

  const deleteDegree = async (id) => {
    if (!window.confirm('Delete this degree? All associated units will be deleted.')) return;
    try {
      await api.delete(`/degrees/${id}`);
      setToast({ message: 'Degree deleted', type: 'success' });
      fetchDegrees();
    } catch {
      setToast({ message: 'Failed to delete degree', type: 'error' });
    }
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark" style={{ fontFamily: 'var(--font-heading)' }}>
            Degree Management
          </h2>
          <p className="text-sm text-surface-600 mt-1">Manage academic degrees independently.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openDegreeModal()}>
          + Create Degree
        </button>
      </div>

      <div className="glass-card p-4 mb-6 bg-brand-yellow/10 border-brand-yellow">
        <div className="flex items-center gap-2 text-sm text-brand-dark">
          <span>💡</span>
          <span>Tip: After creating degrees, go to <Link to="/admin/units" className="underline font-semibold">Units</Link> to add courses with automatic class generation.</span>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="glass-card p-12 text-center text-surface-400">Loading degrees...</div>
        ) : degrees.length === 0 ? (
          <div className="glass-card p-12 text-center text-surface-500">
            No degrees found. Create one to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Degree Name</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {degrees.map(degree => (
                  <tr key={degree.id}>
                    <td>
                      <span className="badge bg-[#e6eeff] text-[#0044a3]">{degree.code}</span>
                    </td>
                    <td className="font-medium text-brand-dark">{degree.name}</td>
                    <td className="text-surface-500 text-sm">
                      {new Date(degree.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          className="text-brand-blue hover:text-brand-dark text-xs font-medium"
                          onClick={() => openDegreeModal(degree)}
                        >
                          Edit
                        </button>
                        <button 
                          className="text-danger hover:text-red-800 text-xs font-medium"
                          onClick={() => deleteDegree(degree.id)}
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

      <Modal isOpen={showDegreeModal} onClose={() => setShowDegreeModal(false)} title={editDegree ? 'Edit Degree' : 'New Degree'}>
        <form onSubmit={saveDegree} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Degree Name</label>
            <input 
              className="form-input" 
              required 
              placeholder="e.g. Master of Information Technology" 
              value={degreeForm.name} 
              onChange={e => setDegreeForm({ ...degreeForm, name: e.target.value })} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Degree Code</label>
            <input 
              className="form-input" 
              required 
              placeholder="e.g. ICT-MSC" 
              value={degreeForm.code} 
              onChange={e => setDegreeForm({ ...degreeForm, code: e.target.value })} 
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary flex-1">
              {editDegree ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowDegreeModal(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
