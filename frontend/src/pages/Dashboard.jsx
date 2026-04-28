import React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, X, Link as LinkIcon, FileText } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './Dashboard.css';

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DATE_FIELDS = ['date', 'dueDate', 'deadline', 'eventDate', 'startDate', 'endDate', 'createdAt', 'updatedAt', 'tarih'];
const TITLE_FIELDS = ['title', 'name', 'task', 'taskName', 'eventName', 'subject', 'description', 'content'];
const MANAGER_RANKS = ['BASKAN', 'BASKAN YARDIMCISI', 'KOMITE BASKANI'];
const COMPLETED_STATUSES = ['completed', 'tamamlandı', 'done', 'bitti', 'tamamlanan'];

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeText = (value) => String(value || '').trim().toLocaleLowerCase('tr-TR');

const isCompletedTask = (status) => {
  const s = normalizeText(status);
  return COMPLETED_STATUSES.includes(s);
};

const isManagerUser = (user) => {
  const rank = normalizeText(user?.rank)
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .toUpperCase();

  return MANAGER_RANKS.includes(rank);
};

const parsePossibleDate = (rawValue) => {
  if (!rawValue) return null;

  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    return new Date(rawValue.getFullYear(), rawValue.getMonth(), rawValue.getDate());
  }

  if (typeof rawValue === 'number') {
    const fromNumber = new Date(rawValue);
    if (!Number.isNaN(fromNumber.getTime())) {
      return new Date(fromNumber.getFullYear(), fromNumber.getMonth(), fromNumber.getDate());
    }
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;

    const nativeParsed = new Date(trimmed);
    if (!Number.isNaN(nativeParsed.getTime())) {
      return new Date(nativeParsed.getFullYear(), nativeParsed.getMonth(), nativeParsed.getDate());
    }

    const trDateMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (trDateMatch) {
      const day = Number(trDateMatch[1]);
      const month = Number(trDateMatch[2]);
      const year = Number(trDateMatch[3]);
      const trParsed = new Date(year, month - 1, day);
      if (!Number.isNaN(trParsed.getTime())) {
        return new Date(trParsed.getFullYear(), trParsed.getMonth(), trParsed.getDate());
      }
    }
  }

  return null;
};

const formatDisplayName = (value) => {
  if (typeof value !== 'string') return '';
  return value
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
};

const pickFirstString = (record, fields) => {
  for (const field of fields) {
    const value = record?.[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const extractAssignees = (record) => {
  const assignees = [];

  const directAssigneeFields = ['assignee', 'assignedTo', 'owner', 'user', 'username', 'responsible'];
  directAssigneeFields.forEach((field) => {
    const value = record?.[field];
    if (typeof value === 'string' && value.trim()) {
      assignees.push(value.trim());
    }
  });

  if (Array.isArray(record?.avatars)) {
    record.avatars.forEach((avatar) => {
      if (typeof avatar === 'string' && avatar.trim()) {
        assignees.push(avatar.trim());
      }
    });
  }

  return Array.from(new Set(assignees));
};

const normalizeScheduleItem = (item, sourceKey, index) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const rawDate = DATE_FIELDS.map((field) => item[field]).find(Boolean);
  const date = parsePossibleDate(rawDate);
  if (!date) return null;

  const title = pickFirstString(item, TITLE_FIELDS) || `${sourceKey} kaydi`;
  const sourceType = /event|etkinlik/i.test(sourceKey) || /event|etkinlik/i.test(item?.type || '') ? 'event' : 'task';
  const status = pickFirstString(item, ['status', 'columnId', 'stage']) || '';

  return {
    id: `${sourceKey}-${index}`,
    title,
    date,
    type: sourceType,
    status,
    assignees: extractAssignees(item)
  };
};

const readStorageSchedule = () => {
  const records = [];

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !/(task|event|etkinlik|gorev|görev|calendar|plan|todo|project)/i.test(key)) {
      continue;
    }

    const rawValue = localStorage.getItem(key);
    if (!rawValue) continue;

    try {
      const parsed = JSON.parse(rawValue);
      const candidates = Array.isArray(parsed) ? parsed : [];
      candidates.forEach((candidate, index) => {
        const normalized = normalizeScheduleItem(candidate, key, index);
        if (normalized) {
          records.push(normalized);
        }
      });
    } catch (_) {
      // Ignore non-JSON localStorage values.
    }
  }

  return records;
};

const normalizeBackendTask = (task, currentUser) => {
  if (!task || typeof task !== 'object') return null;

  const assignments = Array.isArray(task.task_assignments) ? task.task_assignments : [];
  const completedCount = assignments.length > 0 
    ? assignments.filter((a) => isCompletedTask(a?.status)).length 
    : 0;

  // DB'den gelen status 'completed' ise veya kanban'da bitmişse tamamlandı kabul et
  const dbStatus = normalizeText(task.status || 'pending');
  const isFinishedInBoard = /TAMAMLANAN|TAMAMLANDI/i.test(normalizeText(task.column_id || ''));

  let status = 'pending';

  if (isFinishedInBoard || isCompletedTask(dbStatus)) {
    status = 'completed';
  } else if (assignments.length > 0) {
    // Tüm atananlar bitirdiyse tamamlandı say
    status = completedCount === assignments.length ? 'completed' : 'pending';
  } else {
    // Sütun tamamlandı değilse ve atama yoksa pending
    status = 'pending';
  }

  const date = parsePossibleDate(
    task.due_date || task.dueDate || task.start_date || task.startDate ||
    task.end_date || task.endDate || task.created_at || task.updated_at ||
    task.createdAt || task.updatedAt
  ) || new Date(task.created_at || task.createdAt || Date.now());

  return {
    id: `supabase-${task.id}`,
    title: task.title || task.name || `Görev ${task.id}`,
    description: task.description || '',
    committee: task.committee || 'genel',
    link_url: task.link_url || '',
    attachment_url: task.attachment_url || '',
    creator_name: task.creator_name || 'Bilinmiyor',
    date,
    startDate: parsePossibleDate(task.start_date || task.startDate),
    endDate: parsePossibleDate(task.end_date || task.endDate),
    type: 'task',
    status,
    assignees: assignments.map((a) => a.user_name || a.username || '').filter(Boolean)
  };
};

const fetchAssignedTasks = async (currentUser, setBackendTasks) => {
  if (!currentUser?.id) {
    setBackendTasks([]);
    return;
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_assignments(*)')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    if (!Array.isArray(data)) {
      setBackendTasks([]);
      return;
    }

    const relevantTasks = data.filter((task) => {
      const assignments = Array.isArray(task?.task_assignments) ? task.task_assignments : [];
      return assignments.some((assignment) => String(assignment.user_id) === String(currentUser.id));
    });

    const normalized = relevantTasks
      .map((task) => normalizeBackendTask(task, currentUser))
      .filter(Boolean);

    setBackendTasks(normalized);
  } catch (err) {
    console.error('Dashboard görevleri alınırken hata oluştu:', err);
    setBackendTasks([]);
  }
};

const isAssignedToCurrentUser = (task, currentUsername) => {
  if (!task.assignees.length || !currentUsername) return false;

  const normalizedCurrent = normalizeText(currentUsername);
  return task.assignees.some((assignee) => {
    const normalizedAssignee = normalizeText(assignee);
    return (
      normalizedAssignee === 'ben' ||
      normalizedAssignee === normalizedCurrent ||
      normalizedAssignee.includes(normalizedCurrent) ||
      normalizedCurrent.includes(normalizedAssignee)
    );
  });
};

const buildCalendarCells = (visibleMonth) => {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  const firstDayWeekIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const currentMonthDayCount = new Date(year, month + 1, 0).getDate();
  const previousMonthDayCount = new Date(year, month, 0).getDate();

  const cells = [];

  for (let cellIndex = 0; cellIndex < 42; cellIndex += 1) {
    const dayOffset = cellIndex - firstDayWeekIndex;

    let date;
    let inCurrentMonth = true;

    if (dayOffset < 0) {
      date = new Date(year, month - 1, previousMonthDayCount + dayOffset + 1);
      inCurrentMonth = false;
    } else if (dayOffset >= currentMonthDayCount) {
      date = new Date(year, month + 1, dayOffset - currentMonthDayCount + 1);
      inCurrentMonth = false;
    } else {
      date = new Date(year, month, dayOffset + 1);
    }

    cells.push({
      date,
      day: date.getDate(),
      inCurrentMonth,
      key: toDateKey(date)
    });
  }

  return cells;
};

const Dashboard = () => {
  const [user, setUser] = React.useState(null);
  const [scheduleItems, setScheduleItems] = React.useState([]);
  const [backendTasks, setBackendTasks] = React.useState([]);
  const [selectedItem, setSelectedItem] = React.useState(null);
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  React.useEffect(() => {
    const loadDashboardData = async () => {
      const savedUser = localStorage.getItem('custom_user');
      let currentUser = savedUser ? JSON.parse(savedUser) : null;

      if (!currentUser) {
        const { data: sessionData } = await supabase.auth.getSession();
        currentUser = sessionData?.session?.user || null;
      }

      if (currentUser) {
        setUser(currentUser);
      }

      setScheduleItems(readStorageSchedule());
      await fetchAssignedTasks(currentUser, setBackendTasks);
    };

    loadDashboardData();
    window.addEventListener('storage', loadDashboardData);
    window.addEventListener('focus', loadDashboardData);
    window.addEventListener('dashboard-refresh', loadDashboardData);

    return () => {
      window.removeEventListener('storage', loadDashboardData);
      window.removeEventListener('focus', loadDashboardData);
      window.removeEventListener('dashboard-refresh', loadDashboardData);
    };
  }, []);

  const localTaskItems = React.useMemo(
    () => scheduleItems.filter((item) => item.type === 'task'),
    [scheduleItems]
  );

  const localAssignedTasks = React.useMemo(() => {
    const currentUsername = user?.username || '';
    if (!currentUsername) return [];
    return localTaskItems.filter((task) => isAssignedToCurrentUser(task, currentUsername));
  }, [localTaskItems, user]);

  const taskItems = React.useMemo(
    () => [...localTaskItems, ...backendTasks],
    [localTaskItems, backendTasks]
  );

  const eventItems = React.useMemo(
    () => [...scheduleItems, ...backendTasks].filter((item) => item.type === 'event'),
    [scheduleItems, backendTasks]
  );

  const assignedTasks = React.useMemo(() => {
    return [...localAssignedTasks, ...backendTasks]
      .sort((a, b) => a.date - b.date)
      .slice(0, 8);
  }, [localAssignedTasks, backendTasks]);

  const stats = React.useMemo(() => {
    const total = assignedTasks.length;
    const completed = assignedTasks.filter((task) => isCompletedTask(task.status)).length;
    const pending = Math.max(0, total - completed);
    return { total, completed, pending };
  }, [assignedTasks]);

  const calendarMap = React.useMemo(() => {
    const map = new Map();
    const allItems = [...scheduleItems, ...backendTasks];
    
    allItems.forEach((item) => {
      const addMapping = (d) => {
        const key = toDateKey(d);
        if (!map.has(key)) {
          map.set(key, { tasks: [], events: [] });
        }
        const collection = map.get(key);
        const list = item.type === 'event' ? collection.events : collection.tasks;
        if (!list.find(x => x.id === item.id)) {
          list.push(item);
        }
      };

      if (item.type === 'task') {
        // Genel bakista gorevler sadece bitis tarihine isaretlenir.
        addMapping(item.endDate || item.date);
      } else if (item.startDate && item.endDate) {
        let current = new Date(item.startDate);
        const limit = new Date(item.endDate);
        // Maksimum 31 gun gosterelim ki browser donmasin (guvenlik onlemi)
        let count = 0;
        while (current <= limit && count < 31) {
          addMapping(current);
          current.setDate(current.getDate() + 1);
          count++;
        }
      } else {
        addMapping(item.date);
      }
    });
    return map;
  }, [scheduleItems, backendTasks]);

  const calendarCells = React.useMemo(() => buildCalendarCells(visibleMonth), [visibleMonth]);
  const todayKey = toDateKey(new Date());

  const previousMonth = () => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const monthLabel = visibleMonth.toLocaleDateString('tr-TR', {
    month: 'long',
    year: 'numeric'
  });

  const welcomeName = formatDisplayName(user?.username || user?.email || '') || 'Kullanici';

  return (
    <div className="page-container">
      <div
        style={{
          background: 'linear-gradient(135deg, var(--primary-color) 0%, #0f766e 100%)',
          borderRadius: '24px',
          padding: '2rem',
          marginBottom: '2.5rem',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(15, 118, 110, 0.2)'
        }}
      >
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', blur: '40px' }}></div>
        <div style={{ position: 'absolute', bottom: '-40px', left: '10%', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', blur: '20px' }}></div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '0.875rem', fontWeight: '500', opacity: 0.9, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
          </p>
          <h1 style={{ fontSize: '2.25rem', fontWeight: '800', marginBottom: '0', lineHeight: '1.2' }}>
            Hoş Geldin, {welcomeName}
          </h1>
        </div>
      </div>
        
      {/*
      <div className="section-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)' }}>İstatistik Özeti</h2>
      </div>
      */}

      <div className="dashboard-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--surface-color)', borderRadius: '1rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Toplam Akış</h3>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '0.5rem' }}>{stats.total}</p>
        </div>

        <div style={{ padding: '1.5rem', backgroundColor: 'var(--surface-color)', borderRadius: '1rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Tamamlanan</h3>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success)', marginTop: '0.5rem' }}>{stats.completed}</p>
        </div>

        <div style={{ padding: '1.5rem', backgroundColor: 'var(--surface-color)', borderRadius: '1rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Bekleyen</h3>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--warning)', marginTop: '0.5rem' }}>{stats.pending}</p>
        </div>
      </div>

      <div className="dashboard-planner-grid">
        <section className="dashboard-card dashboard-calendar-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title-wrap">
              <CalendarDays size={18} />
              <h3>Takvim</h3>
            </div>
            <div className="dashboard-month-switcher">
              <button type="button" onClick={previousMonth} aria-label="Onceki ay">
                <ChevronLeft size={16} />
              </button>
              <strong>{monthLabel}</strong>
              <button type="button" onClick={nextMonth} aria-label="Sonraki ay">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="dashboard-calendar-grid dashboard-calendar-daynames">
            {DAY_LABELS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>

          <div className="dashboard-calendar-grid">
            {calendarCells.map((cell) => {
              const dayItems = calendarMap.get(cell.key) || { tasks: [], events: [] };
              const hasTask = dayItems.tasks.length > 0;
              const hasEvent = dayItems.events.length > 0;

              return (
                <div
                  key={cell.key}
                  className={`dashboard-calendar-cell ${cell.inCurrentMonth ? '' : 'is-outside'} ${cell.key === todayKey ? 'is-today' : ''}`}
                >
                  <span className="dashboard-day-number">{cell.day}</span>

                  {(hasTask || hasEvent) && (
                    <div className="dashboard-day-markers" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center', marginTop: '4px' }}>
                      {[...dayItems.events, ...dayItems.tasks].map((item, idx) => {
                        const comm = (item.committee || 'genel').toLowerCase();
                        let letter = comm.charAt(0).toUpperCase();
                        let bgColor = 'var(--primary-color)';
                        if (comm === 'etkinlik') { bgColor = '#ef4444'; letter = 'E'; }
                        if (comm === 'proje') { bgColor = '#3b82f6'; letter = 'P'; }
                        if (comm === 'medium') { bgColor = '#10b981'; letter = 'M'; }
                        if (comm === 'sosyal') { bgColor = '#f59e0b'; letter = 'S'; }
                        
                        return (
                          <span key={`${item.id}-${idx}`} style={{ 
                            width: '14px', height: '14px', borderRadius: '50%', backgroundColor: bgColor, 
                            color: 'white', fontSize: '8px', fontWeight: 'bold', display: 'flex', 
                            alignItems: 'center', justifyContent: 'center' 
                          }}>
                            {letter}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="dashboard-card dashboard-assigned-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title-wrap">
              <ClipboardList size={18} />
              <h3>Genel Akış</h3>
            </div>
          </div>

          <div className="dashboard-assigned-list">
            {assignedTasks.length === 0 ? (
              <div className="dashboard-empty-state">
                Henüz bir görev veya akış kaydı bulunamadı.
              </div>
            ) : (
              assignedTasks.map((task) => (
                <article 
                  key={task.id} 
                  className="dashboard-assigned-item" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedItem(task)}
                >
                  <p className="dashboard-assigned-title">{task.title}</p>
                  {task.description && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0.5rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                      {task.description}
                    </p>
                  )}
                  <div className="dashboard-assigned-meta">
                    <span style={{ textTransform: 'capitalize' }}>{task.committee || 'Görev'}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {task.startDate ? task.startDate.toLocaleDateString('tr-TR') : task.date.toLocaleDateString('tr-TR')}
                      {task.endDate && ` - ${task.endDate.toLocaleDateString('tr-TR')}`}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
      {/* Görev Detay Pop-up */}
      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setSelectedItem(null)}></div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '500px', backgroundColor: 'var(--surface-color)', borderRadius: '24px', padding: '2rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--primary-bg)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>Görev Detayları</h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: '700' }}>{selectedItem.committee}</p>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Başlık</label>
                <p style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>{selectedItem.title}</p>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Açıklama</label>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{selectedItem.description || 'Açıklama belirtilmemiş.'}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Oluşturan</label>
                  <p style={{ fontSize: '0.85rem', fontWeight: '600', margin: 0 }}>{selectedItem.creator_name}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Tarih / Aralık</label>
                  <p style={{ fontSize: '0.85rem', fontWeight: '600', margin: 0 }}>
                    {selectedItem.startDate ? selectedItem.startDate.toLocaleDateString('tr-TR') : selectedItem.date.toLocaleDateString('tr-TR')}
                    {selectedItem.endDate && ` - ${selectedItem.endDate.toLocaleDateString('tr-TR')}`}
                  </p>
                </div>
              </div>

              {selectedItem.assignees?.length > 0 && (
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Atanan Kişiler</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {selectedItem.assignees.map((a, i) => (
                      <span key={i} style={{ backgroundColor: 'var(--bg-color)', padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {(selectedItem.link_url || selectedItem.attachment_url) && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  {selectedItem.link_url && (
                    <a href={selectedItem.link_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <LinkIcon size={14} /> Bağlantıya Git
                    </a>
                  )}
                  {selectedItem.attachment_url && (
                    <a href={selectedItem.attachment_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileText size={14} /> Dosyayı Görüntüle
                    </a>
                  )}
                </div>
              )}
            </div>

            <button onClick={() => setSelectedItem(null)} style={{ width: '100%', marginTop: '2rem', padding: '0.8rem', borderRadius: '12px', border: 'none', backgroundColor: 'var(--primary-color)', color: 'white', fontWeight: '700', cursor: 'pointer' }}>Kapat</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
