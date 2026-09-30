import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlus, Users, Search, Trash2, Edit2, Shield, Key, 
  Mail, Check, X, RefreshCw, AlertCircle, Sparkles, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_BASE_URL, getAuthHeaders, apiFetch } from '../lib/api';
import { canManageUsers, normalizeRank } from '../lib/roles';
import './UserManagement.css';

const AVAILABLE_ROLES = [
  { id: 'proje', label: '💻 Proje & Teknik' },
  { id: 'etkinlik', label: '🎪 Etkinlik & Org.' },
  { id: 'sosyal', label: '📱 Sosyal Medya' },
  { id: 'medium', label: '✍️ Medium & Blog' }
];

const AVAILABLE_RANKS = [
  { id: 'üye', label: 'Üye' },
  { id: 'komite başkanı', label: 'Komite Başkanı' },
  { id: 'başkan yardımcısı', label: 'Başkan Yardımcısı' },
  { id: 'başkan', label: 'Başkan' },
  { id: 'developer', label: 'Developer' }
];

const generateUsernameSlug = (name) => {
  return String(name || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

const generateRandomPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
  const array = new Uint32Array(10);
  window.crypto.getRandomValues(array);
  return Array.from(array, val => chars[val % chars.length]).join('');
};

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const { success, error: toastError, warning } = useToast();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    rank: 'üye',
    roles: []
  });

  // Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    rank: 'üye',
    roles: [],
    password: ''
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Check admin authorization
  useEffect(() => {
    if (currentUser && !canManageUsers(currentUser)) {
      warning('Bu sayfaya yalnızca yöneticiler erişebilir.');
      navigate('/dashboard');
    }
  }, [currentUser, navigate, warning]);

  // Load Users List
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/auth/users');
      if (!res.ok) throw new Error('Kullanıcılar yüklenemedi');
      const data = await res.json();
      setUsers(data || []);
    } catch (err) {
      console.error('Fetch users error:', err);
      toastError('Kullanıcı listesi alınırken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle Full Name change with auto-username suggestion
  const handleNameChange = (e) => {
    const val = e.target.value;
    const suggested = generateUsernameSlug(val);
    setFormData(prev => ({
      ...prev,
      full_name: val,
      username: prev.username === '' || prev.username === generateUsernameSlug(prev.full_name) ? suggested : prev.username
    }));
  };

  // Toggle role selection
  const toggleRole = (roleId, isEdit = false) => {
    if (isEdit) {
      setEditFormData(prev => {
        const has = prev.roles.includes(roleId);
        return {
          ...prev,
          roles: has ? prev.roles.filter(r => r !== roleId) : [...prev.roles, roleId]
        };
      });
    } else {
      setFormData(prev => {
        const has = prev.roles.includes(roleId);
        return {
          ...prev,
          roles: has ? prev.roles.filter(r => r !== roleId) : [...prev.roles, roleId]
        };
      });
    }
  };

  // Submit New User
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.username.trim() || !formData.password.trim()) {
      warning('Lütfen Ad Soyad, Kullanıcı Adı ve Şifre alanlarını doldurun.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(formData)
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Kullanıcı kaydedilemedi');
      }

      success(`🎉 ${formData.full_name} başarıyla eklendi!`);
      // Reset form
      setFormData({
        full_name: '',
        username: '',
        password: '',
        rank: 'üye',
        roles: []
      });
      fetchUsers();
    } catch (err) {
      console.error('Register submit error:', err);
      toastError(err.message || 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete User
  const handleDelete = async (userToDelete) => {
    if (userToDelete.id === currentUser?.id) {
      warning('Kendi hesabınızı bu panelden silemezsiniz.');
      return;
    }

    const confirmDel = window.confirm(`"${userToDelete.full_name || userToDelete.username}" kullanıcısını silmek istediğinize emin misiniz?`);
    if (!confirmDel) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Kullanıcı silinemedi');
      }

      success(`"${userToDelete.full_name || userToDelete.username}" silindi.`);
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
    } catch (err) {
      console.error('Delete user error:', err);
      toastError(err.message || 'Kullanıcı silinemedi.');
    }
  };

  // Open Edit Modal
  const openEditModal = (targetUser) => {
    setEditingUser(targetUser);
    setEditFormData({
      full_name: targetUser.full_name || targetUser.username || '',
      rank: targetUser.rank || 'üye',
      roles: Array.isArray(targetUser.roles) ? targetUser.roles : [],
      password: ''
    });
  };

  // Submit Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setEditSubmitting(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(editFormData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Güncelleme başarısız');

      success(`Kullanıcı bilgileri güncellendi.`);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error('Edit submit error:', err);
      toastError(err.message || 'Güncelleme yapılırken hata oluştu.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Filtered users for search
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return users.filter(u => {
      const name = (u.full_name || '').toLocaleLowerCase('tr-TR');
      const uname = (u.username || '').toLocaleLowerCase('tr-TR');
      const rank = (u.rank || '').toLocaleLowerCase('tr-TR');
      return name.includes(term) || uname.includes(term) || rank.includes(term);
    });
  }, [users, searchTerm]);

  return (
    <div className="page-container user-mgmt-container">
      {/* Header */}
      <div className="user-mgmt-header">
        <div>
          <h1 className="user-mgmt-title">Ekip & Kullanıcı Yönetimi</h1>
          <p className="user-mgmt-subtitle">
            Yeni kulüp üyelerini kaydedin, yetkilerini ve komite görevlerini tek ekrandan yönetin.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="user-mgmt-grid">
        {/* Left Column: Register Form */}
        <section className="user-mgmt-card">
          <div className="card-title-wrap">
            <div className="card-title-icon">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="card-title">Yeni Üye Kaydı</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kulübe yeni üye ekleyin</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Ad Soyad *</label>
              <input 
                type="text" 
                placeholder="Örn: Ahmet Yılmaz" 
                className="form-input"
                value={formData.full_name}
                onChange={handleNameChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Kullanıcı Adı (Giriş için) *</label>
              <input 
                type="text" 
                placeholder="Örn: ahmetyilmaz" 
                className="form-input"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">İlk Şifre *</label>
              <div className="input-with-action">
                <input 
                  type="text" 
                  placeholder="En az 6 karakterli bir şifre girin" 
                  className="form-input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <button 
                  type="button" 
                  className="action-inline-btn"
                  onClick={() => setFormData({ ...formData, password: generateRandomPassword() })}
                  title="Rastgele Şifre Üret"
                >
                  <Sparkles size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Üret
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Yetki / Rol</label>
              <select 
                className="form-select"
                value={formData.rank}
                onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
              >
                {AVAILABLE_RANKS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Görevli Olduğu Komiteler</label>
              <div className="roles-selector-grid">
                {AVAILABLE_ROLES.map(role => {
                  const isSelected = formData.roles.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      className={`role-pill-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => toggleRole(role.id)}
                    >
                      {role.label}
                      {isSelected && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button 
              type="submit" 
              className="submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Kaydediliyor...' : 'Kullanıcıyı Kaydet'}
            </button>
          </form>
        </section>

        {/* Right Column: Registered Users List */}
        <section className="user-mgmt-card">
          <div className="users-list-header">
            <div className="card-title-wrap" style={{ margin: 0, padding: 0, border: 'none' }}>
              <div className="card-title-icon">
                <Users size={20} />
              </div>
              <div>
                <h2 className="card-title">Kayıtlı Ekip Üyeleri</h2>
              </div>
            </div>
            <span className="user-count-badge">
              {filteredUsers.length} Üye
            </span>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div className="search-box-wrap">
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                placeholder="İsim, kullanıcı adı veya role göre ara..." 
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              Yükleniyor...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              Kayıtlı kullanıcı bulunamadı.
            </div>
          ) : (
            <div className="users-cards-grid">
              {filteredUsers.map((u) => {
                const isRankAdmin = ['admin', 'developer', 'başkan', 'baskan', 'başkan yardımcısı', 'baskan yardimcisi'].includes(normalizeRank(u.rank));
                const isRankManager = ['komite başkanı', 'komite baskani'].includes(normalizeRank(u.rank));
                const rankClass = isRankAdmin ? 'rank-admin' : isRankManager ? 'rank-manager' : 'rank-member';

                return (
                  <div key={u.id} className="user-item-row">
                    <div className="user-item-info">
                      <div className="user-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--primary-color)', color: '#fff', fontWeight: '700', fontSize: '0.9rem', borderRadius: '50%', width: '40px', height: '40px', flexShrink: 0 }}>
                        {(u.full_name || u.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="user-text-details">
                        <div className="user-item-name">{u.full_name || u.username}</div>
                        <div className="user-item-username">@{u.username}</div>
                        <div className="user-tags-wrap">
                          <span className={`rank-badge ${rankClass}`}>
                            {u.rank || 'Üye'}
                          </span>
                          {Array.isArray(u.roles) && u.roles.map((r, i) => (
                            <span key={i} className="committee-tag">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="user-actions">
                      <button 
                        type="button" 
                        className="icon-action-btn"
                        onClick={() => openEditModal(u)}
                        title="Düzenle"
                      >
                        <Edit2 size={15} />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button 
                          type="button" 
                          className="icon-action-btn delete"
                          onClick={() => handleDelete(u)}
                          title="Sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Üye Bilgilerini Düzenle</h3>
              <button className="modal-close-btn" onClick={() => setEditingUser(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label">Ad Soyad</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Yetki Seviyesi</label>
                <select 
                  className="form-select"
                  value={editFormData.rank}
                  onChange={(e) => setEditFormData({ ...editFormData, rank: e.target.value })}
                >
                  {AVAILABLE_RANKS.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Komiteler</label>
                <div className="roles-selector-grid">
                  {AVAILABLE_ROLES.map(role => {
                    const isSelected = editFormData.roles.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        className={`role-pill-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => toggleRole(role.id, true)}
                      >
                        {role.label}
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.25rem' }}>
                <label className="form-label">Yeni Şifre Belirle (Boş bırakırsanız değişmez)</label>
                <input 
                  type="password" 
                  placeholder="Değiştirmek istemiyorsanız boş bırakın"
                  className="form-input"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                />
              </div>

              <button 
                type="submit" 
                className="submit-btn"
                disabled={editSubmitting}
              >
                {editSubmitting ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
