import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Plus, X, Search, CheckSquare, User, 
  Trash2, Filter, AlertCircle, Info, Megaphone,
  UserCheck, Users, Send, Calendar
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { isManager, normalizeRank } from '../lib/roles';
import { useToast } from '../context/ToastContext';

const Announcements = () => {
  const navigate = useNavigate();
  const { success, error: toastError, warning } = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    recipients: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const savedUser = localStorage.getItem('custom_user');
      
      if (!savedUser) {
        console.warn('Kullanıcı oturumu bulunamadı');
        navigate('/login');
        return;
      }

      let userObj;
      try {
        userObj = JSON.parse(savedUser);
      } catch (parseErr) {
        console.error('Kullanıcı bilgisi parse hatası:', parseErr);
        localStorage.removeItem('custom_user');
        navigate('/login');
        return;
      }

      if (!userObj || !userObj.id) {
        console.warn('Kullanıcı ID eksik');
        navigate('/login');
        return;
      }

      setCurrentUser(userObj);

      // Duyuruları Backend API'den çek
      try {
        const response = await apiFetch(`/api/auth/announcements/${userObj.id}`);
        if (response.ok) {
          const data = await response.json();
          setAnnouncements(data || []);
        } else {
          const errorData = await response.json();
          console.error('Duyuru çekme hatası:', errorData);
        }
      } catch (fetchErr) {
        console.error('Backend bağlantı hatası:', fetchErr);
      }

      // Yönetici ise üyeleri çek
      if (isManager(userObj)) {
        try {
          const memsResponse = await apiFetch('/api/auth/users');
          if (memsResponse.ok) {
            const mems = await memsResponse.json();
            setMembers(mems || []);
          }
        } catch (memErr) {
          console.error('Üye listesi çekme hatası:', memErr);
        }
      }
    } catch (err) {
      console.error('Yükleme sırasında hata:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (formData.recipients.length === 0) {
      warning('Lütfen en az bir alıcı seçin.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiFetch('/api/auth/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          creator_id: currentUser.id,
          creator_name: currentUser.username || 'Bilinmiyor',
          recipient_ids: formData.recipients
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Duyuru oluşturulamadı');
      }

      setShowModal(false);
      setFormData({ title: '', content: '', recipients: [] });
      await fetchData();
      success('Duyuru başarıyla yayınlandı.');
    } catch (err) {
      console.error('Hata:', err);
      toastError('Hata oluştu: ' + (err.message || 'Veritabanı hatası'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAllMembers = () => {
    if (formData.recipients.length === members.length) {
      setFormData({ ...formData, recipients: [] });
    } else {
      setFormData({ ...formData, recipients: members.map(m => m.id) });
    }
  };

  const filteredMembers = members.filter(m => 
    m.username?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    normalizeRank(m.rank).includes(searchTerm.toLowerCase())
  );

  const canCreate = isManager(currentUser);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 0.35rem 0' }}>Duyurular</h1>
          <p className="page-subtitle" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: 0 }}>Önemli güncellemeler ve duyuruları buradan takip edebilirsiniz.</p>
        </div>
        
        {canCreate && (
          <button 
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              padding: '0.7rem 1.35rem', 
              borderRadius: '12px', 
              fontSize: '0.9rem', 
              fontWeight: '700', 
              cursor: 'pointer', 
              boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.2)',
              border: 'none'
            }}
          >
            <Plus size={18} /> Duyuru Paylaş
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {loading ? (
             <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>İçerik yükleniyor...</div>
        ) : announcements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', backgroundColor: 'var(--surface-color)', borderRadius: '2rem', border: '1px dashed var(--border-color)' }}>
            <Megaphone size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.2 }} />
            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Henüz Duyuru Yok</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>Henüz sizinle paylaşılmış bir duyuru bulunmuyor.</p>
          </div>
        ) : (
          announcements.map(ann => (
            <div key={ann.id} style={{ 
              backgroundColor: 'var(--surface-color)', borderRadius: '20px', padding: '1.5rem', 
              border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: 'var(--primary-color)' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{ann.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><User size={12} /> {ann.creator_name || 'Sistem'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Calendar size={12} /> {new Date(ann.created_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                </div>
              </div>
              <p style={{ color: 'var(--text-main)', lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{ann.content}</p>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowModal(false)}></div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '650px', backgroundColor: 'var(--surface-color)', borderRadius: '24px', padding: '2rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '12px', backgroundColor: 'var(--primary-bg)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={24} />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Yeni Duyuru Yayınla</h2>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <form onSubmit={handleCreateAnnouncement}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>DUYURU BAŞLIĞI</label>
                  <input 
                    type="text" required 
                    value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                    style={{ width: '100%', padding: '0.85rem 1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.95rem' }} 
                    placeholder="Duyuru başlığı..." 
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>DETAYLAR</label>
                  <textarea 
                    required 
                    value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} 
                    style={{ width: '100%', padding: '0.85rem 1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.95rem', minHeight: '120px', resize: 'vertical' }} 
                    placeholder="İçerik..." 
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>ALICILAR ({formData.recipients.length})</label>
                    <button 
                      type="button" onClick={toggleAllMembers}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      {formData.recipients.length === members.length ? 'Seçimi Kaldır' : 'Herkesi Seç'}
                    </button>
                  </div>
                  
                  <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" placeholder="Üye ara..." 
                      value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                      style={{ width: '100%', padding: '0.7rem 1rem 0.7rem 2.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontSize: '0.9rem' }} 
                    />
                  </div>

                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '0.5rem' }}>
                    {filteredMembers.map(member => (
                      <div 
                        key={member.id} 
                        onClick={() => {
                          const isSelected = formData.recipients.includes(member.id);
                          setFormData({ 
                            ...formData, 
                            recipients: isSelected 
                              ? formData.recipients.filter(id => id !== member.id) 
                              : [...formData.recipients, member.id] 
                          });
                        }} 
                        style={{ 
                          padding: '0.6rem', borderRadius: '10px', cursor: 'pointer', 
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                          marginBottom: '4px', backgroundColor: formData.recipients.includes(member.id) ? 'var(--primary-bg)' : 'transparent'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{member.username}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{member.rank}</span>
                        </div>
                        {formData.recipients.includes(member.id) && <UserCheck size={16} color="var(--primary-color)" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color)', fontWeight: '700', cursor: 'pointer' }}>İptal</button>
                <button type="submit" disabled={isSubmitting} style={{ flex: 2, padding: '1rem', borderRadius: '14px', border: 'none', backgroundColor: 'var(--primary-color)', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
                   {isSubmitting ? 'Yayınlanıyor...' : 'Yayınla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;
