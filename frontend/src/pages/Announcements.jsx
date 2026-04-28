import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Bell, Plus, X, Search, CheckSquare, User, 
  Trash2, Filter, AlertCircle, Info, Megaphone,
  UserCheck, Users, Send, Calendar
} from 'lucide-react';

const Announcements = () => {
  const MANAGER_RANKS = ['başkan', 'başkan yardımcısı', 'komite başkanı', 'yönetici', 'developer'];
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

  const normalizeRank = (rank) => {
    return String(rank || '').toLocaleLowerCase('tr-TR').trim();
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const savedUser = localStorage.getItem('custom_user');
      const userObj = savedUser ? JSON.parse(savedUser) : null;
      setCurrentUser(userObj);

      if (userObj) {
        // Duyuruları çek
        const { data, error } = await supabase
          .from('announcements')
          .select(`
            *,
            announcement_recipients!inner(user_id, is_read)
          `)
          .eq('announcement_recipients.user_id', userObj.id)
          .order('created_at', { ascending: false });

        if (error && error.code !== '42P01') {
          console.error('Duyuru çekme hatası:', error);
        } else {
          setAnnouncements(data || []);
        }

        // Yönetici ise üyeleri çek
        const userRank = normalizeRank(userObj.rank);
        const isManager = MANAGER_RANKS.includes(userRank);
        
        if (isManager) {
          const { data: mems, error: memErr } = await supabase
            .from('custom_users')
            .select('id, username, rank')
            .order('username');
          if (!memErr) setMembers(mems || []);
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
      alert('Lütfen en az bir alıcı seçin.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: annData, error: annError } = await supabase
        .from('announcements')
        .insert([{
          title: formData.title,
          content: formData.content,
          creator_id: currentUser.id,
          creator_name: currentUser.username || 'Bilinmiyor'
        }])
        .select()
        .single();

      if (annError) throw annError;

      const recipientData = formData.recipients.map(userId => ({
        announcement_id: annData.id,
        user_id: userId
      }));

      const { error: recError } = await supabase
        .from('announcement_recipients')
        .insert(recipientData);

      if (recError) throw recError;

      const notificationData = formData.recipients.map(userId => ({
        user_id: userId,
        message: `📢 Yeni Duyuru: ${formData.title}`,
        is_read: false
      }));

      await supabase.from('notifications').insert(notificationData);

      setShowModal(false);
      setFormData({ title: '', content: '', recipients: [] });
      await fetchData();
      alert('Duyuru başarıyla yayınlandı.');
    } catch (err) {
      console.error('Hata:', err);
      alert('Hata oluştu: ' + (err.message || 'Veritabanı hatası'));
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

  const currentUserRank = normalizeRank(currentUser?.rank);
  const isManager = MANAGER_RANKS.includes(currentUserRank);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem' }}>Duyurular</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Önemli güncellemeler ve duyuruları buradan takip edebilirsiniz.</p>
        </div>
        
        {isManager && (
          <button 
            onClick={() => setShowModal(true)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.5rem', 
              borderRadius: '12px', border: 'none', backgroundColor: 'var(--primary-color)', 
              color: 'white', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.2)'
            }}
          >
            <Plus size={20} /> Duyuru Paylaş
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
