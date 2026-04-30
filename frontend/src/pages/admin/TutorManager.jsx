/**
 * Tutor Manager Page
 * Includes tutor availability management per trimester/session.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function TutorManager() {
  const [tutors, setTutors] = useState([]);
  const [trimesters, setTrimesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [showTutorModal, setShowTutorModal] = useState(false);
  const [editTutor, setEditTutor] = useState(null);
  const [tutorForm, setTutorForm] = useState({ name: '', email: '' });

  const [showAvailModal, setShowAvailModal] = useState(false);
  const [availTutor, setAvailTutor] = useState(null);
  const [availabilities, setAvailabilities] = useState([]);
  const [availForm, setAvailForm] = useState({
    trimester_id: '',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '17:00'
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, trRes] = await Promise.all([
        api.get('/tutors'),
        api.get('/trimesters')
      ]);
      setTutors(tRes.data);
      setTrimesters(trRes.data);
    } catch {
      setToast({ message: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openTutorModal = (tutor = null) => {
    setEditTutor(tutor);
    setTutorForm(tutor ? { name: tutor.name, email: tutor.email } : { name: '', email: '' });
    setShowTutorModal(true);
  };

  const saveTutor = async (e) => {
    e.preventDefault();
    try {
      if (editTutor) {
        await api.put(`/tutors/${editTutor.id}`, tutorForm);
        setToast({ message: 'Tutor updated', type: 'success' });
      } else {
        await api.post('/tutors', tutorForm);
        setToast({ message: 'Tutor created', type: 'success' });
      }
      setShowTutorModal(false);
      fetchData();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to save tutor', type: 'error' });
    }
  };

  const deleteTutor = async (id) => {
    if (!window.confirm('Delete this tutor?')) return;
    try {
      await api.delete(`/tutors/${id}`);
      setToast({ message: 'Tutor deleted', type: 'success' });
      fetchData();
    } catch {
      setToast({ message: 'Failed to delete tutor', type: 'error' });
    }
  };

  const openAvailModal = async (tutor) => {
    setAvailTutor(tutor);
    setShowAvailModal(true);
    setAvailForm({ trimester_id: trimesters[0]?.id || '', day_of_week: 'Monday', start_time: '09:00', end_time: '17:00' });
    try {
      const res = await api.get(`/tutor-availability/tutor/${tutor.id}`);
      setAvailabilities(res.data);
    } catch {
      setAvailabilities([]);
    }
  };

  const saveAvailability = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tutor-availability', {
        tutor_id: availTutor.id,
        ...availForm
      });
      setToast({ message: 'Availability added', type: 'success' });
      const res = await api.get(`/tutor-availability/tutor/${availTutor.id}`);
      setAvailabilities(res.data);
      setAvailForm({ trimester_id: availForm.trimester_id, day_of_week: 'Monday', start_time: '09:00', end_time: '17:00' });
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to add availability', type: 'error' });
    }
  };

  const deleteAvailability = async (id) => {
    if (!window.confirm('Delete this availability slot?')) return;
    try {
      await api.delete(`/tutor-availability/${id}`);
      setToast({ message: 'Availability deleted', type: 'success' });
      const res = await api.get(`/tutor-availability/tutor/${availTutor.id}`);
      setAvailabilities(res.data);
    } catch {
      setToast({ message: 'Failed to delete availability', type: 'error' });
    }
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark" style={{ fontFamily: 'var(--font-heading)' }}>
            Tutor Management
          </h2>
          <p className="text-sm text-surface-600 mt-1">Manage tutors and their availability per trimester.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openTutorModal()}>
          + Add Tutor
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="glass-card p-12 text-center text-surface-400">Loading tutors...</div>
        ) : tutors.length === 0 ? (
          <div className="glass-card p-12 text-center text-surface-500">No tutors found. Create one to begin.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Assigned Units</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tutors.map(tutor => (
                  <tr key={tutor.id}>
                    <td className="font-medium text-brand-dark">{tutor.name}</td>
                    <td>{tutor.email}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(tutor.assigned_units || []).slice(0, 3).map((u, i) => (
                          <span key={i} className="badge badge-primary">{u.unit_code}</span>
                        ))}
                        {(tutor.assigned_units || []).length > 3 && (
                          <span className="text-surface-500 text-xs">+{(tutor.assigned_units || []).length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="text-brand-blue hover:text-brand-dark text-xs font-medium" onClick={() => openAvailModal(tutor)}>
                          Availability
                        </button>
                        <button className="text-brand-blue hover:text-brand-dark text-xs font-medium" onClick={() => openTutorModal(tutor)}>
                          Edit
                        </button>
                        <button className="text-danger hover:text-red-800 text-xs font-medium" onClick={() => deleteTutor(tutor.id)}>
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

      <Modal isOpen={showTutorModal} onClose={() => setShowTutorModal(false)} title={editTutor ? 'Edit Tutor' : 'New Tutor'}>
        <form onSubmit={saveTutor} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" required placeholder="Dr. Jane Doe" value={tutorForm.name} onChange={e => setTutorForm({ ...tutorForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" required placeholder="jane.doe@uni.edu" value={tutorForm.email} onChange={e => setTutorForm({ ...tutorForm, email: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary flex-1">{editTutor ? 'Update' : 'Create'}</button>
            <button type="button" onClick={() => setShowTutorModal(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showAvailModal} onClose={() => setShowAvailModal(false)} title={`Availability: ${availTutor?.name || ''}`} size="lg">
        <div className="space-y-6">
          <form onSubmit={saveAvailability} className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Trimester / Session</label>
              <select className="form-select" value={availForm.trimester_id} onChange={e => setAvailForm({ ...availForm, trimester_id: e.target.value })} required>
                <option value="">Select trimester...</option>
                {trimesters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Day</label>
              <select className="form-select" value={availForm.day_of_week} onChange={e => setAvailForm({ ...availForm, day_of_week: e.target.value })}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input type="time" className="form-input" value={availForm.start_time} onChange={e => setAvailForm({ ...availForm, start_time: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">End Time</label>
              <input type="time" className="form-input" value={availForm.end_time} onChange={e => setAvailForm({ ...availForm, end_time: e.target.value })} required />
            </div>
            <div className="col-span-2">
              <button type="submit" className="btn btn-primary w-full">Add Availability</button>
            </div>
          </form>

          <div>
            <h4 className="font-semibold text-sm mb-2">Current Availability</h4>
            {availabilities.length === 0 ? (
              <p className="text-sm text-surface-500 italic">No availability set.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availabilities.map(avail => (
                  <div key={avail.id} className="flex items-center justify-between bg-surface-50 p-3 rounded border border-surface-200">
                    <div className="text-sm">
                      <span className="font-medium">{avail.trimester_name}</span>
                      <span className="mx-2">•</span>
                      <span>{avail.day_of_week}</span>
                      <span className="mx-2">•</span>
                      <span>{avail.start_time?.substring(0,5)} - {avail.end_time?.substring(0,5)}</span>
                    </div>
                    <button onClick={() => deleteAvailability(avail.id)} className="text-danger text-xs font-medium">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
