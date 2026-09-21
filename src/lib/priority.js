export const PRIORITY_OPTIONS = [
  { 
    id: 'DÜŞÜK', 
    label: 'Düşük', 
    dot: '#94a3b8', 
    bg: '#f1f5f9', 
    color: '#64748b', 
    border: '#cbd5e1' 
  },
  { 
    id: 'NORMAL', 
    label: 'Normal', 
    dot: '#0ea5e9', 
    bg: 'var(--info-bg, #e0f2fe)', 
    color: 'var(--info, #0284c7)', 
    border: '#7dd3fc' 
  },
  { 
    id: 'YÜKSEK', 
    label: 'Yüksek', 
    dot: '#f59e0b', 
    bg: 'var(--warning-bg, #fef3c7)', 
    color: 'var(--warning, #d97706)', 
    border: '#fcd34d' 
  },
  { 
    id: 'ACİL', 
    label: 'Acil', 
    dot: '#e11d48', 
    bg: 'var(--danger-bg, #fff1f2)', 
    color: 'var(--danger, #e11d48)', 
    border: '#fda4af' 
  }
];

export const getPriorityMeta = (priority) => {
  const normalized = (priority || 'NORMAL').toUpperCase().trim();
  return PRIORITY_OPTIONS.find(opt => opt.id === normalized) || PRIORITY_OPTIONS[1];
};
