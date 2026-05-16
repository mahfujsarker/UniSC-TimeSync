/**
 * Degree & Courses Manager
 * Unified administration for degrees, courses, offering patterns, and URL imports.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';

const statusOptions = ['draft', 'reviewed', 'published', 'archived'];
const emptyDegree = {
  name: '',
  code: '',
  description: '',
  degree_type: '',
  campus: '',
  study_mode: '',
  duration: '',
  source_url: '',
  status: 'published'
};
const emptyCourse = {
  name: '',
  code: '',
  degree_ids: [],
  classroom_type: 'normal',
  class_duration: 1,
  offering_patterns: [],
  description: '',
  prerequisites: '',
  credit_points: '',
  source_url: '',
  status: 'published'
};

const offeringOptions = [
  { group: 'Trimesters', options: [1, 2, 3].map(n => ({ label: `Trimester ${n}`, period_type: 'TRIMESTER', period_number: n, code: `T${n}` })) },
  { group: 'Semesters', options: [1, 2].map(n => ({ label: `Semester ${n}`, period_type: 'SEMESTER', period_number: n, code: `SEM${n}` })) },
  { group: 'Sessions', options: Array.from({ length: 8 }, (_, i) => {
    const n = i + 1;
    return { label: `Session ${n}`, period_type: 'SESSION', period_number: n, code: `S${n}` };
  }) }
];
const flatOfferings = offeringOptions.flatMap(group => group.options);
const statusClass = {
  draft: 'badge-warning',
  reviewed: 'badge-info',
  published: 'badge-success',
  archived: 'badge-danger'
};
const roomTypeOptions = [
  { value: 'all', label: 'All room types' },
  { value: 'normal', label: 'Normal room' },
  { value: 'lab', label: 'Computer lab' }
];

function samePattern(a, b) {
  return a.period_type === b.period_type && Number(a.period_number) === Number(b.period_number);
}

function StatusBadge({ status = 'published' }) {
  return <span className={`badge ${statusClass[status] || 'badge-primary'}`}>{status}</span>;
}

function CollapseIcon({ open, small = false }) {
  return (
    <span className={`chevron ${small ? 'small' : ''} ${open ? 'is-open' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M7.5 4.5 12.5 10 7.5 15.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function offeringLabel(pattern) {
  const type = pattern.period_type === 'SEMESTER' ? 'Semester' : pattern.period_type === 'SESSION' ? 'Session' : 'Trimester';
  return `${type} ${pattern.period_number}`;
}

function roomTypeLabel(type) {
  return type === 'lab' ? 'Computer Lab' : 'Normal Room';
}

function patternValue(pattern) {
  return `${pattern.period_type}:${pattern.period_number}`;
}

export default function DegreeManager() {
  const [degrees, setDegrees] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [degreeFilter, setDegreeFilter] = useState('all');
  const [offeringFilter, setOfferingFilter] = useState('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState('all');
  const [expandedDegrees, setExpandedDegrees] = useState({});
  const [expandedCourses, setExpandedCourses] = useState({});

  const [showDegreeModal, setShowDegreeModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editDegree, setEditDegree] = useState(null);
  const [editCourse, setEditCourse] = useState(null);
  const [degreeForm, setDegreeForm] = useState(emptyDegree);
  const [courseForm, setCourseForm] = useState(emptyCourse);

  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importDraft, setImportDraft] = useState(null);
  const [importPayload, setImportPayload] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [degreeRes, courseRes] = await Promise.all([
        api.get('/degrees?include_inactive=true'),
        api.get('/courses?include_inactive=true')
      ]);
      setDegrees(degreeRes.data);
      setCourses(courseRes.data);
      setExpandedDegrees(prev => {
        if (Object.keys(prev).length) return prev;
        return Object.fromEntries(degreeRes.data.map(degree => [degree.id, true]));
      });
    } catch {
      setToast({ message: 'Failed to load degrees and courses', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const coursesByDegree = useMemo(() => {
    const map = new Map(degrees.map(degree => [degree.id, []]));
    courses.forEach(course => {
      (course.degrees || []).forEach(degree => {
        if (!map.has(degree.id)) map.set(degree.id, []);
        map.get(degree.id).push(course);
      });
    });
    return map;
  }, [courses, degrees]);

  const filteredDegrees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return degrees.filter(degree => {
      const degreeCourses = coursesByDegree.get(degree.id) || [];
      const degreeMatch = degreeFilter === 'all' || degree.id === degreeFilter;
      const statusMatch = statusFilter === 'all' || degree.status === statusFilter || degreeCourses.some(course => course.status === statusFilter);
      const roomMatch = roomTypeFilter === 'all' || degreeCourses.some(course => course.classroom_type === roomTypeFilter);
      const offeringMatch = offeringFilter === 'all' || degreeCourses.some(course => (course.offering_patterns || []).some(pattern => patternValue(pattern) === offeringFilter));
      const textMatch = !term || [degree.name, degree.code, degree.description, ...degreeCourses.flatMap(course => [course.name, course.code])]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(term));
      return degreeMatch && statusMatch && roomMatch && offeringMatch && textMatch;
    });
  }, [coursesByDegree, degreeFilter, degrees, offeringFilter, roomTypeFilter, search, statusFilter]);

  const getVisibleCourses = degree => {
    const term = search.trim().toLowerCase();
    return (coursesByDegree.get(degree.id) || []).filter(course => {
      const statusMatch = statusFilter === 'all' || course.status === statusFilter || degree.status === statusFilter;
      const roomMatch = roomTypeFilter === 'all' || course.classroom_type === roomTypeFilter;
      const offeringMatch = offeringFilter === 'all' || (course.offering_patterns || []).some(pattern => patternValue(pattern) === offeringFilter);
      const textMatch = !term || [degree.name, degree.code, course.name, course.code, course.description, course.prerequisites]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(term));
      return statusMatch && roomMatch && offeringMatch && textMatch;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDegreeFilter('all');
    setOfferingFilter('all');
    setRoomTypeFilter('all');
  };

  const openDegreeModal = (degree = null) => {
    setEditDegree(degree);
    setDegreeForm(degree ? {
      name: degree.name || '',
      code: degree.code || '',
      description: degree.description || '',
      degree_type: degree.degree_type || '',
      campus: degree.campus || '',
      study_mode: degree.study_mode || '',
      duration: degree.duration || '',
      source_url: degree.source_url || '',
      status: degree.status || 'published'
    } : emptyDegree);
    setShowDegreeModal(true);
  };

  const openCourseModal = (course = null, degreeId = '') => {
    setEditCourse(course);
    setCourseForm(course ? {
      name: course.name || '',
      code: course.code || '',
      degree_ids: (course.degrees || []).map(degree => degree.id),
      classroom_type: course.classroom_type || 'normal',
      class_duration: course.class_duration || 1,
      offering_patterns: course.offering_patterns || [],
      description: course.description || '',
      prerequisites: course.prerequisites || '',
      credit_points: course.credit_points || '',
      source_url: course.source_url || '',
      status: course.status || 'published'
    } : { ...emptyCourse, degree_ids: degreeId ? [degreeId] : [] });
    setShowCourseModal(true);
  };

  const saveDegree = async event => {
    event.preventDefault();
    try {
      if (editDegree) {
        await api.put(`/degrees/${editDegree.id}`, degreeForm);
        setToast({ message: 'Degree updated', type: 'success' });
      } else {
        await api.post('/degrees', degreeForm);
        setToast({ message: 'Degree created', type: 'success' });
      }
      setShowDegreeModal(false);
      fetchData();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to save degree', type: 'error' });
    }
  };

  const saveCourse = async event => {
    event.preventDefault();
    try {
      if (editCourse) {
        await api.put(`/courses/${editCourse.id}`, courseForm);
        setToast({ message: 'Course updated', type: 'success' });
      } else {
        await api.post('/courses', courseForm);
        setToast({ message: 'Course created', type: 'success' });
      }
      setShowCourseModal(false);
      fetchData();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to save course', type: 'error' });
    }
  };

  const deleteDegree = async id => {
    if (!window.confirm('Delete this degree? Shared course records remain if they belong to other degrees.')) return;
    try {
      await api.delete(`/degrees/${id}`);
      setToast({ message: 'Degree deleted', type: 'success' });
      fetchData();
    } catch {
      setToast({ message: 'Failed to delete degree', type: 'error' });
    }
  };

  const deleteCourse = async id => {
    if (!window.confirm('Delete this course? Associated classes and timetable entries will also be deleted.')) return;
    try {
      await api.delete(`/courses/${id}`);
      setToast({ message: 'Course deleted', type: 'success' });
      fetchData();
    } catch {
      setToast({ message: 'Failed to delete course', type: 'error' });
    }
  };

  const toggleCourseDegree = degreeId => {
    setCourseForm(prev => ({
      ...prev,
      degree_ids: prev.degree_ids.includes(degreeId)
        ? prev.degree_ids.filter(id => id !== degreeId)
        : [...prev.degree_ids, degreeId]
    }));
  };

  const toggleOffering = option => {
    setCourseForm(prev => ({
      ...prev,
      offering_patterns: prev.offering_patterns.some(pattern => samePattern(pattern, option))
        ? prev.offering_patterns.filter(pattern => !samePattern(pattern, option))
        : [...prev.offering_patterns, option]
    }));
  };

  const extractImport = async event => {
    event.preventDefault();
    setImportError('');
    setImportDraft(null);
    setImportPayload(null);
    try {
      setImportLoading(true);
      const res = await api.post('/degrees/import/extract', { url: importUrl });
      setImportDraft(res.data.import);
      setImportPayload(res.data.payload);
      setToast({ message: 'Import draft ready for review', type: 'success' });
    } catch (err) {
      setImportError(err.response?.data?.error || 'Unable to automatically extract degree and course information from this URL. Please review the URL or add the data manually.');
    } finally {
      setImportLoading(false);
    }
  };

  const updateImportDegree = (field, value) => {
    setImportPayload(prev => ({ ...prev, degree: { ...prev.degree, [field]: value } }));
  };

  const updateImportCourse = (index, field, value) => {
    setImportPayload(prev => ({
      ...prev,
      courses: prev.courses.map((course, courseIndex) => courseIndex === index ? { ...course, [field]: value } : course)
    }));
  };

  const toggleImportOffering = (courseIndex, option) => {
    setImportPayload(prev => ({
      ...prev,
      courses: prev.courses.map((course, index) => {
        if (index !== courseIndex) return course;
        const selected = course.offering_patterns || [];
        return {
          ...course,
          offering_patterns: selected.some(pattern => samePattern(pattern, option))
            ? selected.filter(pattern => !samePattern(pattern, option))
            : [...selected, option]
        };
      })
    }));
  };

  const toggleImportCourseDegree = (courseIndex, degreeId) => {
    setImportPayload(prev => ({
      ...prev,
      courses: prev.courses.map((course, index) => {
        if (index !== courseIndex) return course;
        const selected = course.degree_ids || [];
        return {
          ...course,
          degree_ids: selected.includes(degreeId)
            ? selected.filter(id => id !== degreeId)
            : [...selected, degreeId]
        };
      })
    }));
  };

  const addImportCourse = () => {
    setImportPayload(prev => ({
      ...prev,
      courses: [...(prev.courses || []), {
        name: '',
        code: '',
        classroom_type: 'normal',
        offering_patterns: [],
        prerequisites: '',
        credit_points: '',
        source_url: prev.degree.source_url || importUrl,
        status: 'draft',
        action: 'create'
      }]
    }));
  };

  const removeImportCourse = index => {
    setImportPayload(prev => ({ ...prev, courses: prev.courses.filter((_, courseIndex) => courseIndex !== index) }));
  };

  const publishImport = async () => {
    if (!importDraft || !importPayload) return;
    try {
      await api.post(`/degrees/import/${importDraft.id}/publish`, { payload: importPayload });
      setToast({ message: 'Imported degree and courses published', type: 'success' });
      setImportDraft(null);
      setImportPayload(null);
      setImportUrl('');
      fetchData();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to publish import', type: 'error' });
    }
  };

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <p className="page-kicker">Academic structure</p>
          <h2 className="page-title">Degree & Courses</h2>
          <p className="page-subtitle">Manage degrees, shared courses, offering patterns, and import approvals.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={() => openDegreeModal()}>Add Degree</button>
          <button className="btn btn-primary" onClick={() => openCourseModal()}>Add Course</button>
        </div>
      </div>

      <div className="glass-panel p-5 mb-6">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="section-title">Import from URL</h3>
            <p className="text-sm text-surface-600 mt-1">Paste a UniSC degree or course page URL to extract degree and course information for review.</p>
          </div>
          {importDraft && <span className="badge badge-info">Draft ready</span>}
        </div>
        <form onSubmit={extractImport} className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="form-group">
            <label className="form-label">Degree or course URL</label>
            <input className="form-input glass-input-large" type="url" value={importUrl} onChange={event => setImportUrl(event.target.value)} placeholder="Paste a UniSC degree or course page URL to extract degree and course information" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={importLoading || !importUrl.trim()}>
            {importLoading ? 'Extracting...' : 'Extract Degree & Courses'}
          </button>
        </form>
        {importLoading && <div className="mt-4 skeleton-card h-14" />}
        {importError && <div className="alert-card alert-error mt-4">{importError}</div>}
      </div>

      {importPayload && (
        <div className="glass-panel p-5 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
            <div>
              <h3 className="section-title">Import Preview</h3>
              <p className="text-sm text-surface-600 mt-1">Draft data is isolated until approved and published.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary btn-sm" type="button" onClick={addImportCourse}>+ Add Course</button>
              <button className="btn btn-primary btn-sm" type="button" onClick={publishImport}>Approve & Publish</button>
            </div>
          </div>

          {importPayload.degree.existing_match && (
            <div className="alert-card border-warning/30 bg-yellow-50/80 text-surface-800 mb-4">
              Existing degree found: {importPayload.degree.existing_match.code} {importPayload.degree.existing_match.name}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
            <input className="form-input" placeholder="Degree name" value={importPayload.degree.name || ''} onChange={event => updateImportDegree('name', event.target.value)} />
            <input className="form-input" placeholder="Degree code" value={importPayload.degree.code || ''} onChange={event => updateImportDegree('code', event.target.value)} />
            <input className="form-input" placeholder="Degree type" value={importPayload.degree.degree_type || ''} onChange={event => updateImportDegree('degree_type', event.target.value)} />
            <select className="form-select" value={importPayload.degree.action || 'create'} onChange={event => updateImportDegree('action', event.target.value)}>
              <option value="create">Create as new</option>
              <option value="keep_existing">Keep existing</option>
              <option value="update_existing">Update existing</option>
              <option value="merge">Merge data</option>
              <option value="ignore">Ignore imported</option>
            </select>
            <input className="form-input" placeholder="Campus/location" value={importPayload.degree.campus || ''} onChange={event => updateImportDegree('campus', event.target.value)} />
            <input className="form-input" placeholder="Study mode" value={importPayload.degree.study_mode || ''} onChange={event => updateImportDegree('study_mode', event.target.value)} />
            <input className="form-input" placeholder="Duration" value={importPayload.degree.duration || ''} onChange={event => updateImportDegree('duration', event.target.value)} />
            <input className="form-input" placeholder="Source URL" value={importPayload.degree.source_url || ''} onChange={event => updateImportDegree('source_url', event.target.value)} />
            <textarea className="form-input lg:col-span-4" rows="2" placeholder="Description" value={importPayload.degree.description || ''} onChange={event => updateImportDegree('description', event.target.value)} />
          </div>

          <div className="space-y-3">
            {(importPayload.courses || []).length === 0 ? (
              <div className="empty-state compact">No courses were extracted. Add courses manually before publishing.</div>
            ) : importPayload.courses.map((course, index) => (
              <div key={`${course.code || 'new'}-${index}`} className="rounded-xl border border-white/70 bg-white/55 p-4">
                {course.existing_match && (
                  <div className="alert-card border-warning/30 bg-yellow-50/80 text-surface-800 mb-3">
                    Existing course found: {course.existing_match.code} {course.existing_match.name}
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
                  <input className="form-input" placeholder="Course code" value={course.code || ''} onChange={event => updateImportCourse(index, 'code', event.target.value)} />
                  <input className="form-input lg:col-span-2" placeholder="Course name" value={course.name || ''} onChange={event => updateImportCourse(index, 'name', event.target.value)} />
                  <select className="form-select" value={course.classroom_type || 'normal'} onChange={event => updateImportCourse(index, 'classroom_type', event.target.value)}>
                    <option value="normal">Normal Room</option>
                    <option value="lab">Computer Lab</option>
                  </select>
                  <select className="form-select" value={course.action || 'create'} onChange={event => updateImportCourse(index, 'action', event.target.value)}>
                    <option value="create">Create as new</option>
                    <option value="keep_existing">Keep existing</option>
                    <option value="update_existing">Update existing</option>
                    <option value="merge">Merge data</option>
                    <option value="ignore">Ignore imported</option>
                  </select>
                  <button className="btn btn-danger btn-sm" type="button" onClick={() => removeImportCourse(index)}>Remove</button>
                  <input className="form-input lg:col-span-2" placeholder="Prerequisites" value={course.prerequisites || ''} onChange={event => updateImportCourse(index, 'prerequisites', event.target.value)} />
                  <input className="form-input" placeholder="Credit points" value={course.credit_points || ''} onChange={event => updateImportCourse(index, 'credit_points', event.target.value)} />
                  <input className="form-input lg:col-span-3" placeholder="Source URL" value={course.source_url || ''} onChange={event => updateImportCourse(index, 'source_url', event.target.value)} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {flatOfferings.map(option => (
                    <label key={option.code} className="inline-flex items-center gap-2 rounded-lg border border-white/70 bg-white/60 px-3 py-1.5 text-xs font-semibold text-surface-700">
                      <input type="checkbox" checked={(course.offering_patterns || []).some(pattern => samePattern(pattern, option))} onChange={() => toggleImportOffering(index, option)} />
                      {option.label}
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="text-xs font-bold text-surface-600 mb-2">Also associate with existing degrees</div>
                  <div className="flex flex-wrap gap-2">
                    {degrees.map(degree => (
                      <label key={degree.id} className="inline-flex items-center gap-2 rounded-lg border border-white/70 bg-white/60 px-3 py-1.5 text-xs font-semibold text-surface-700">
                        <input type="checkbox" checked={(course.degree_ids || []).includes(degree.id)} onChange={() => toggleImportCourseDegree(index, degree.id)} />
                        {degree.code}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel p-4 mb-5">
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="section-title">Find and filter</h3>
            <p className="text-sm text-surface-600">Search degrees and courses, then narrow by status, degree, offering pattern, or room type.</p>
          </div>
          <button className="btn btn-secondary btn-sm" type="button" onClick={clearFilters}>Clear filters</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.4fr_12rem_16rem_14rem_12rem] gap-3">
          <input className="form-input" placeholder="Search degree name, degree code, course name, or course code..." value={search} onChange={event => setSearch(event.target.value)} />
          <select className="form-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
          <select className="form-select" value={degreeFilter} onChange={event => setDegreeFilter(event.target.value)}>
            <option value="all">All degrees</option>
            {degrees.map(degree => <option key={degree.id} value={degree.id}>{degree.code} - {degree.name}</option>)}
          </select>
          <select className="form-select" value={offeringFilter} onChange={event => setOfferingFilter(event.target.value)}>
            <option value="all">All teaching periods</option>
            {offeringOptions.map(group => (
              <optgroup key={group.group} label={group.group}>
                {group.options.map(option => <option key={option.code} value={patternValue(option)}>{option.label}</option>)}
              </optgroup>
            ))}
          </select>
          <select className="form-select" value={roomTypeFilter} onChange={event => setRoomTypeFilter(event.target.value)}>
            {roomTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-surface-400">Loading degrees and courses...</div>
      ) : filteredDegrees.length === 0 ? (
        <div className="empty-state">No degrees or courses found.</div>
      ) : (
        <div className="space-y-4">
          {filteredDegrees.map(degree => {
            const allDegreeCourses = coursesByDegree.get(degree.id) || [];
            const degreeCourses = getVisibleCourses(degree);
            const expanded = expandedDegrees[degree.id] !== false;
            return (
              <div key={degree.id} className="degree-card glass-panel">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <button type="button" className="degree-card-toggle text-left" onClick={() => setExpandedDegrees(prev => ({ ...prev, [degree.id]: !expanded }))} aria-expanded={expanded}>
                    <div className="flex flex-wrap items-center gap-2">
                      <CollapseIcon open={expanded} />
                      <span className="badge badge-primary">{degree.code}</span>
                      <StatusBadge status={degree.status} />
                      <span className="badge bg-white/70 text-surface-700">{allDegreeCourses.length} course{allDegreeCourses.length === 1 ? '' : 's'}</span>
                      {degree.degree_type && <span className="badge bg-surface-200 text-surface-700">{degree.degree_type}</span>}
                    </div>
                    <h3 className="mt-2 text-lg font-black text-brand-dark">{degree.name}</h3>
                    <p className="text-sm text-surface-600">{[degree.campus, degree.study_mode, degree.duration].filter(Boolean).join(' | ') || 'No extra degree metadata recorded'}</p>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-secondary btn-sm" onClick={() => openCourseModal(null, degree.id)}>+ Add Course</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => openDegreeModal(degree)}>Edit Degree</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteDegree(degree.id)}>Delete</button>
                  </div>
                </div>

                <div className={`collapsible ${expanded ? 'is-open' : ''}`}>
                  <div className="mt-4 space-y-2">
                    {degreeCourses.length === 0 ? (
                      <div className="empty-state compact">No courses associated with this degree.</div>
                    ) : degreeCourses.map(course => {
                      const courseExpanded = !!expandedCourses[course.id];
                      const isShared = (course.degrees || []).length > 1;
                      return (
                        <div key={`${degree.id}-${course.id}`} className="course-card">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <button type="button" className="text-left min-w-0" onClick={() => setExpandedCourses(prev => ({ ...prev, [course.id]: !courseExpanded }))} aria-expanded={courseExpanded}>
                              <div className="flex flex-wrap items-center gap-2">
                                <CollapseIcon open={courseExpanded} small />
                                <span className="badge bg-[#e6eeff] text-[#0044a3]">{course.code}</span>
                                <StatusBadge status={course.status} />
                                {isShared && <span className="badge badge-info">Shared Course</span>}
                                <span className={`badge ${course.classroom_type === 'lab' ? 'badge-warning' : 'badge-primary'}`}>{course.classroom_type === 'lab' ? 'Lab Required' : 'Standard Room'}</span>
                                {(course.offering_patterns || []).slice(0, 3).map(pattern => <span key={`${course.id}-${patternValue(pattern)}`} className="badge bg-white/75 text-surface-700">{offeringLabel(pattern)}</span>)}
                              </div>
                              <div className="mt-1 font-semibold text-brand-dark">{course.name}</div>
                            </button>
                            <div className="flex gap-2">
                              <button className="text-brand-blue hover:text-brand-dark text-xs font-medium" onClick={() => openCourseModal(course)}>Edit</button>
                              <button className="text-danger hover:text-red-800 text-xs font-medium" onClick={() => deleteCourse(course.id)}>Delete</button>
                            </div>
                          </div>
                          <div className={`collapsible ${courseExpanded ? 'is-open' : ''}`}>
                            <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm text-surface-700">
                              <div><span className="font-semibold">Associated degrees:</span> {(course.degrees || []).map(item => item.code).join(', ') || 'None'}</div>
                              <div><span className="font-semibold">Normally offered:</span> {(course.offering_patterns || []).map(offeringLabel).join(', ') || 'Not set'}</div>
                              <div><span className="font-semibold">Required room type:</span> {roomTypeLabel(course.classroom_type)}</div>
                              <div><span className="font-semibold">Duration:</span> {course.class_duration || 1} hour{Number(course.class_duration || 1) === 1 ? '' : 's'}</div>
                              <div><span className="font-semibold">Credit points:</span> {course.credit_points || '-'}</div>
                              <div className="lg:col-span-2"><span className="font-semibold">Prerequisites:</span> {course.prerequisites || '-'}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showDegreeModal} onClose={() => setShowDegreeModal(false)} title={editDegree ? 'Edit Degree' : 'New Degree'} size="lg">
        <form onSubmit={saveDegree} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="form-group"><span className="form-label">Degree Name</span><input className="form-input" required value={degreeForm.name} onChange={e => setDegreeForm({ ...degreeForm, name: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Degree Code</span><input className="form-input" required value={degreeForm.code} onChange={e => setDegreeForm({ ...degreeForm, code: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Degree Type</span><input className="form-input" value={degreeForm.degree_type} onChange={e => setDegreeForm({ ...degreeForm, degree_type: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Campus / Location</span><input className="form-input" value={degreeForm.campus} onChange={e => setDegreeForm({ ...degreeForm, campus: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Study Mode</span><input className="form-input" value={degreeForm.study_mode} onChange={e => setDegreeForm({ ...degreeForm, study_mode: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Duration</span><input className="form-input" value={degreeForm.duration} onChange={e => setDegreeForm({ ...degreeForm, duration: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Status</span><select className="form-select" value={degreeForm.status} onChange={e => setDegreeForm({ ...degreeForm, status: e.target.value })}>{statusOptions.map(status => <option key={status} value={status}>{status}</option>)}</select></label>
            <label className="form-group"><span className="form-label">Source URL</span><input className="form-input" value={degreeForm.source_url} onChange={e => setDegreeForm({ ...degreeForm, source_url: e.target.value })} /></label>
          </div>
          <label className="form-group"><span className="form-label">Description</span><textarea className="form-input" rows="3" value={degreeForm.description} onChange={e => setDegreeForm({ ...degreeForm, description: e.target.value })} /></label>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary flex-1">{editDegree ? 'Update Degree' : 'Create Degree'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowDegreeModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showCourseModal} onClose={() => setShowCourseModal(false)} title={editCourse ? 'Edit Course' : 'New Course'} size="lg">
        <form onSubmit={saveCourse} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="form-group"><span className="form-label">Course Name</span><input className="form-input" required value={courseForm.name} onChange={e => setCourseForm({ ...courseForm, name: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Course Code</span><input className="form-input" required value={courseForm.code} onChange={e => setCourseForm({ ...courseForm, code: e.target.value })} /></label>
          </div>

          <div className="form-group">
            <span className="form-label">Associated Degrees</span>
            <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-surface-50 rounded border border-surface-200">
              {degrees.map(degree => (
                <label key={degree.id} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={courseForm.degree_ids.includes(degree.id)} onChange={() => toggleCourseDegree(degree.id)} />
                  <span className="text-sm font-medium text-surface-700">{degree.code} - {degree.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="form-group"><span className="form-label">Required Room Type</span><select className="form-select" value={courseForm.classroom_type} onChange={e => setCourseForm({ ...courseForm, classroom_type: e.target.value })}><option value="normal">Normal Lecture Room</option><option value="lab">Computer Lab</option></select></label>
            <label className="form-group"><span className="form-label">Class Duration</span><select className="form-select" value={courseForm.class_duration} onChange={e => setCourseForm({ ...courseForm, class_duration: parseInt(e.target.value, 10) })}><option value="1">1 Hour</option><option value="2">2 Hours</option><option value="3">3 Hours</option><option value="4">4 Hours</option></select></label>
            <label className="form-group"><span className="form-label">Status</span><select className="form-select" value={courseForm.status} onChange={e => setCourseForm({ ...courseForm, status: e.target.value })}>{statusOptions.map(status => <option key={status} value={status}>{status}</option>)}</select></label>
            <label className="form-group"><span className="form-label">Credit Points</span><input className="form-input" value={courseForm.credit_points} onChange={e => setCourseForm({ ...courseForm, credit_points: e.target.value })} /></label>
            <label className="form-group sm:col-span-2"><span className="form-label">Prerequisites</span><input className="form-input" value={courseForm.prerequisites} onChange={e => setCourseForm({ ...courseForm, prerequisites: e.target.value })} /></label>
          </div>

          <div className="form-group">
            <span className="form-label">Normally Offered In</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-surface-50 rounded border border-surface-200">
              {offeringOptions.map(group => (
                <div key={group.group}>
                  <div className="text-xs font-bold text-surface-600 mb-2">{group.group}</div>
                  <div className="space-y-2">
                    {group.options.map(option => (
                      <label key={option.code} className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={courseForm.offering_patterns.some(pattern => samePattern(pattern, option))} onChange={() => toggleOffering(option)} />
                        <span className="text-sm font-medium text-surface-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="form-group"><span className="form-label">Description</span><textarea className="form-input" rows="3" value={courseForm.description} onChange={e => setCourseForm({ ...courseForm, description: e.target.value })} /></label>
          <label className="form-group"><span className="form-label">Source URL</span><input className="form-input" value={courseForm.source_url} onChange={e => setCourseForm({ ...courseForm, source_url: e.target.value })} /></label>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary flex-1">{editCourse ? 'Update Course' : 'Create Course'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCourseModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
