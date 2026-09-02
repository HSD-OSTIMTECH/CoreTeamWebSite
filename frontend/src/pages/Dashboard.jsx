import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarDays, ChevronLeft, ChevronRight, ClipboardList, X, 
  Link as LinkIcon, FileText, CheckCircle2, Clock, ListTodo 
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getDateConstraints } from '../lib/dateConstraints';
import './Dashboard.css';

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
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

const parsePossibleDate = (rawValue) => {
  if (!rawValue) return null;
  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    return new Date(rawValue.getFullYear(), rawValue.getMonth(), rawValue.getDate());
  }
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    const nativeParsed = new Date(trimmed);
    if (!Number.isNaN(nativeParsed.getTime())) {
      return new Date(nativeParsed.getFullYear(), nativeParsed.getMonth(), nativeParsed.getDate());
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
  const { user } = useAuth();
  const [allTasks, setAllTasks] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_assignments (
            user_id,
            user_name,
            status
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const normalized = (data || []).map((t) => {
        const assignments = Array.isArray(t.task_assignments) ? t.task_assignments : [];
        const isFinishedInBoard = /TAMAMLANAN|TAMAMLANDI/i.test(normalizeText(t.column_id || ''));
        const isDbCompleted = isCompletedTask(t.status);
        const status = (isFinishedInBoard || isDbCompleted) ? 'completed' : 'pending';

        const startDate = parsePossibleDate(t.start_date);
        const endDate = parsePossibleDate(t.end_date);
        const date = startDate || endDate || parsePossibleDate(t.created_at) || new Date();

        return {
          id: `supabase-${t.id}`,
          rawId: t.id,
          title: t.title || 'İsimsiz Görev',
          description: t.description || '',
          committee: t.committee || 'genel',
          link_url: t.link_url || '',
          attachment_url: t.attachment_url || '',
          creator_name: t.creator_name || 'Bilinmiyor',
          startDate,
          endDate,
          date,
          status,
          type: t.committee === 'etkinlik' ? 'event' : 'task',
          assignees: assignments.map((a) => a.user_name).filter(Boolean),
          assignmentUserIds: assignments.map((a) => String(a.user_id))
        };
      });

      setAllTasks(normalized);
    } catch (err) {
      console.error('Dashboard verileri yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Supabase Realtime aboneliği
    const channel = supabase
      .channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, () => {
        loadDashboardData();
      })
      .subscribe();

    window.addEventListener('dashboard-refresh', loadDashboardData);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('dashboard-refresh', loadDashboardData);
    };
  }, [user?.id]);

  // Kullanıcıya atanan görevler
  const assignedTasks = useMemo(() => {
    if (!user?.id) return [];
    return allTasks
      .filter((t) => t.assignmentUserIds.includes(String(user.id)))
      .sort((a, b) => a.date - b.date)
      .slice(0, 8);
  }, [allTasks, user?.id]);

  // Kullanıcı istatistikleri
  const stats = useMemo(() => {
    const total = assignedTasks.length;
    const completed = assignedTasks.filter((t) => isCompletedTask(t.status)).length;
    const pending = Math.max(0, total - completed);
    return { total, completed, pending };
  }, [assignedTasks]);

  // Takvim haritası (tüm kulüp görev ve etkinlikleri)
  const calendarMap = useMemo(() => {
    const map = new Map();

    allTasks.forEach((item) => {
      const addMapping = (d) => {
        const key = toDateKey(d);
        if (!map.has(key)) {
          map.set(key, { tasks: [], events: [] });
        }
        const collection = map.get(key);
        const list = item.type === 'event' ? collection.events : collection.tasks;
        if (!list.find((x) => x.id === item.id)) {
          list.push(item);
        }
      };

      if (item.startDate && item.endDate) {
        let current = new Date(item.startDate);
        const limit = new Date(item.endDate);
        let count = 0;
        while (current <= limit && count < 31) {
          addMapping(current);
          current.setDate(current.getDate() + 1);
          count++;
        }
      } else {
        addMapping(item.endDate || item.startDate || item.date);
      }
    });

    return map;
  }, [allTasks]);

  const calendarCells = useMemo(() => buildCalendarCells(visibleMonth), [visibleMonth]);
  const todayKey = toDateKey(new Date());
  const { minDate, maxDate } = getDateConstraints();

  const previousMonth = () => {
    const newMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    if (newMonth >= minDate) {
      setVisibleMonth(newMonth);
    }
  };

  const nextMonth = () => {
    const newMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    if (newMonth <= maxDate) {
      setVisibleMonth(newMonth);
    }
  };

  const monthLabel = visibleMonth.toLocaleDateString('tr-TR', {
    month: 'long',
    year: 'numeric'
  });

  const welcomeName = formatDisplayName(user?.username || user?.email || '') || 'Kullanıcı';

  return (
    <div className="page-container">
      {/* Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--primary-color) 0%, #0f766e 100%)',
          borderRadius: '24px',
          padding: '2rem',
          marginBottom: '2.5rem',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 10px 25px -5px rgba(15, 118, 110, 0.2)'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', color: 'white' }}>
            Hoş Geldin, {welcomeName}! 👋
          </h1>
          <p style={{ opacity: 0.9, fontSize: '1rem', maxWidth: '600px', margin: 0, lineHeight: 1.5 }}>
            Kulüp projeleri, etkinlik takvimi ve sana atanan görevleri buradan takip edebilirsin.
          </p>
        </div>
      </div>

      {/* İstatistik Kartları */}
      <div className="dashboard-stats-grid">
        <div className="dashboard-stat-card stat-total">
          <div className="dashboard-stat-header">
            <span className="dashboard-stat-label">Bana Atanan Görevler</span>
            <div className="dashboard-stat-icon">
              <ListTodo size={20} />
            </div>
          </div>
          <span className="dashboard-stat-value">{stats.total}</span>
        </div>

        <div className="dashboard-stat-card stat-completed">
          <div className="dashboard-stat-header">
            <span className="dashboard-stat-label">Tamamlanan Görevlerim</span>
            <div className="dashboard-stat-icon">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <span className="dashboard-stat-value">{stats.completed}</span>
        </div>

        <div className="dashboard-stat-card stat-pending">
          <div className="dashboard-stat-header">
            <span className="dashboard-stat-label">Bekleyen Görevlerim</span>
            <div className="dashboard-stat-icon">
              <Clock size={20} />
            </div>
          </div>
          <span className="dashboard-stat-value">{stats.pending}</span>
        </div>
      </div>

      <div className="dashboard-main-grid">
        {/* Ortak Kulüp Takvimi */}
        <section className="dashboard-card dashboard-calendar-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title-wrap">
              <CalendarDays size={18} />
              <h3>Kulüp Ajandası & Takvim</h3>
            </div>
            <div className="dashboard-calendar-controls">
              <button
                type="button"
                onClick={previousMonth}
                aria-label="Önceki ay"
                disabled={visibleMonth.getFullYear() === minDate.getFullYear() && visibleMonth.getMonth() === minDate.getMonth()}
                style={{
                  opacity: visibleMonth.getFullYear() === minDate.getFullYear() && visibleMonth.getMonth() === minDate.getMonth() ? 0.5 : 1,
                  cursor: visibleMonth.getFullYear() === minDate.getFullYear() && visibleMonth.getMonth() === minDate.getMonth() ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <strong>{monthLabel}</strong>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Sonraki ay"
                disabled={visibleMonth.getFullYear() === maxDate.getFullYear() && visibleMonth.getMonth() === maxDate.getMonth()}
                style={{
                  opacity: visibleMonth.getFullYear() === maxDate.getFullYear() && visibleMonth.getMonth() === maxDate.getMonth() ? 0.5 : 1,
                  cursor: visibleMonth.getFullYear() === maxDate.getFullYear() && visibleMonth.getMonth() === maxDate.getMonth() ? 'not-allowed' : 'pointer'
                }}
              >
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
              const allDayItems = [...dayItems.events, ...dayItems.tasks];
              const hasItems = allDayItems.length > 0;

              return (
                <div
                  key={cell.key}
                  className={`dashboard-calendar-cell ${cell.inCurrentMonth ? '' : 'is-outside'} ${cell.key === todayKey ? 'is-today' : ''}`}
                  style={{ cursor: hasItems ? 'pointer' : 'default' }}
                  onClick={() => hasItems && setSelectedItem(allDayItems[0])}
                >
                  <span className="dashboard-day-number">{cell.day}</span>

                  {hasItems && (
                    <div className="dashboard-day-markers" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center', marginTop: '4px' }}>
                      {allDayItems.map((item, idx) => {
                        const comm = (item.committee || 'genel').toLowerCase();
                        let letter = comm.charAt(0).toUpperCase();
                        let bgColor = 'var(--primary-color)';
                        if (comm === 'etkinlik') { bgColor = '#ef4444'; letter = 'E'; }
                        if (comm === 'proje') { bgColor = '#3b82f6'; letter = 'P'; }
                        if (comm === 'medium') { bgColor = '#10b981'; letter = 'M'; }
                        if (comm === 'sosyal') { bgColor = '#f59e0b'; letter = 'S'; }

                        return (
                          <span
                            key={`${item.id}-${idx}`}
                            title={`${item.title} (${item.committee})`}
                            style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              backgroundColor: bgColor,
                              color: 'white',
                              fontSize: '8px',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
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

        {/* Görevlerim / Genel Akış Listesi */}
        <section className="dashboard-card dashboard-assigned-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title-wrap">
              <ClipboardList size={18} />
              <h3>Bana Atanan Akış ({assignedTasks.length})</h3>
            </div>
          </div>

          <div className="dashboard-assigned-list">
            {assignedTasks.length === 0 ? (
              <div className="dashboard-empty-state">
                Size atanmış bekleyen bir görev bulunmuyor.
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
                  <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>{selectedItem.type === 'event' ? 'Etkinlik Detayı' : 'Görev Detayı'}</h2>
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
