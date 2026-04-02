/**
 * Generic CRUD Manager Component
 * Reusable admin page for managing entities (degrees, classrooms, etc.)
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';

export default function CrudManager({
  title,
  apiPath,
  columns,      // [{ key, label, render? }]
  formFields,   // [{ name, label, type, required?, options?, placeholder? }]
  entityName,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(apiPath);
      setItems(data);
    } catch (err) {
      setToast({ message: `Failed to load ${entityName}s`, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [apiPath, entityName]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openCreate = () => {
    setEditItem(null);
    const initial = {};
    formFields.forEach(f => { initial[f.name] = f.defaultValue || ''; });
    setForm(initial);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    const initial = {};
    formFields.forEach(f => { initial[f.name] = item[f.name] || ''; });
    setForm(initial);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`${apiPath}/${editItem.id}`, form);
        setToast({ message: `${entityName} updated successfully`, type: 'success' });
      } else {
        await api.post(apiPath, form);
        setToast({ message: `${entityName} created successfully`, type: 'success' });
      }
      setShowModal(false);
      fetchItems();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Operation failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete this ${entityName}? This cannot be undone.`)) return;
    try {
      await api.delete(`${apiPath}/${id}`);
      setToast({ message: `${entityName} deleted`, type: 'success' });
      fetchItems();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Delete failed', type: 'error' });
    }
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-100" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>
        <button onClick={openCreate} className="btn btn-primary">
          + Add {entityName}
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-surface-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-surface-400">No {entityName}s found</div>
            <button onClick={openCreate} className="btn btn-primary btn-sm mt-3">Create your first {entityName}</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map(col => <th key={col.key}>{col.label}</th>)}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    {columns.map(col => (
                      <td key={col.key}>
                        {col.render ? col.render(item) : item[col.key] || '—'}
                      </td>
                    ))}
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(item)} className="btn btn-secondary btn-sm">Edit</button>
                        <button onClick={() => handleDelete(item.id)} className="btn btn-danger btn-sm">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? `Edit ${entityName}` : `New ${entityName}`}>
        <form onSubmit={handleSave} className="space-y-4">
          {formFields.map(field => (
            <div key={field.name} className="form-group">
              <label className="form-label">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  className="form-select"
                  value={form[field.name] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [field.name]: e.target.value }))}
                  required={field.required}
                >
                  <option value="">Select {field.label}</option>
                  {(field.options || []).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  className="form-input"
                  placeholder={field.placeholder || ''}
                  value={form[field.name] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [field.name]: e.target.value }))}
                  required={field.required}
                />
              )}
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving...' : editItem ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
