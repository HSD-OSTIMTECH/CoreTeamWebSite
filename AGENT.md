# 🤖 AGENT.md — Developer & AI Coding Assistant Guide

Bu dosya, **HSD OSTIMTech CoreTeam Management Platform** projesinde çalışacak geliştiriciler ve yapay zeka (AI) asistanları için mimari kuralları, kodlama standartlarını ve dikkat edilmesi gereken noktaları tanımlar.

---

## 🏗️ 1. Proje Mimarisi & Teknoloji Yığını

* **Frontend:** React 18, Vite 5, React Router DOM 6, Lucide React ikon seti.
* **Backend:** Express.js (Node.js) — Vercel Serverless Function formatında (`api/index.js`).
* **Veritabanı & Altyapı:** Supabase (PostgreSQL, Row Level Security - RLS, Realtime veri dinleme, Supabase Storage).
* **Kimlik Doğrulama:** JWT (JSON Web Token) + Bcrypt parola hashleme (`custom_users` tablosu).

---

## 📂 2. Dizin Yapısı & Sorumluluklar

```text
CoreTeamWebSite/
├── api/                     # Vercel Serverless Backend API
│   ├── index.js             # Express uygulama yapılandırması & Vercel handler
│   └── routes/
│       ├── auth.js          # Kimlik doğrulama, kullanıcılar, duyurular, bildirimler
│       ├── authMiddleware.js# requireAuth, requireManager, requireAdmin korumaları
│       └── taskRoutes.js    # Görev yönetimi, atamalar, dosya yükleme (multer)
├── docs/                    # Mimari, güvenlik raporları ve yol haritası
├── public/                  # Statik varlıklar (logolar, ikonlar)
├── src/                     # React arayüz kaynak kodları
│   ├── components/
│   │   ├── common/          # Ortak bileşenler (CommitteeBoard, KanbanCard, Card vb.)
│   │   └── layout/          # Layout bileşenleri (MainLayout, Header, Sidebar)
│   ├── context/             # React Context'ler (AuthContext, ToastContext)
│   ├── lib/                 # Yardımcı kütüphaneler (api.js, roles.js, security.js, supabaseClient.js)
│   ├── pages/               # Sayfa bileşenleri (Dashboard, MyTasks, UserManagement, vb.)
│   ├── App.jsx              # Rota tanımları ve korumalı rotalar
│   ├── index.css            # Global CSS değişkenleri, Dark Mode ve sıfırlamalar
│   └── main.jsx             # React DOM başlangıç noktası
```

---

## 🔐 3. Kimlik Doğrulama & Yetkilendirme (RBAC) Kuralları

Platformda **çift katmanlı** bir yetki sistemi bulunur:

1. **Unvan (Rank):** Hiyerarşik yetki seviyesidir.
   * `üye` (Standart üye)
   * `komite başkanı`, `başkan yardımcısı`, `başkan`, `developer`, `admin` (`MANAGEMENT_RANKS`)
   * `başkan`, `başkan yardımcısı`, `developer`, `admin` (`ADMIN_RANKS` — Kullanıcı ekleme/silme yetkisine sahiptir)
2. **Roller / Komiteler (Roles):** Kullanıcının atanmış olduğu komite alanlarıdır:
   * `proje` (Teknoloji & Proje)
   * `etkinlik` (Etkinlik & Sponsorluk)
   * `sosyal` (Sosyal Medya)
   * `medium` (Medium & Blog)

### Önemli Helper Fonksiyonlar:
* [src/lib/roles.js](file:///d:/Software/School-Projects/CoreTeamWebSite/src/lib/roles.js) dosyasındaki `canManageUsers(user)`, `isManager(user)`, `canManageCommittee(user, committeeKey)` fonksiyonları kullanılmalıdır. Yetki kontrollerini sayfalarda elle tekrar yazmayın.

---

## 🎨 4. Tasarım Sistemi, CSS ve Dark Mode Kuralları

1. **Sabit Renk Kullanmayın:**
   * Kesinlikle bileşen içine veya stillere `#ffffff`, `#fff`, `#000000`, `#111` gibi sabit renkler yazmayın.
   * Her zaman [src/index.css](file:///d:/Software/School-Projects/CoreTeamWebSite/src/index.css) içerisindeki CSS değişkenlerini kullanın:
     * Yüzeyler: `var(--bg-color)`, `var(--surface-color)`, `var(--surface-card)`
     * Metinler: `var(--text-main)`, `var(--text-muted)`
     * Çerçeveler: `var(--border-color)`
     * Marka Rengi: `var(--primary-color)` (Huawei Crimson Rose), `var(--primary-bg)`
2. **Dark Mode Uyumluluğu:**
   * Tema, `document.body` üzerindeki `.dark-mode` sınıfı üzerinden CSS değişkenleriyle otomatik değişir. Yeni bir bileşen veya stil yazarken açık/koyu mod kontrastına dikkat edin.
3. **İkonlar:**
   * İkonlar için yalnızca `lucide-react` kütüphanesini kullanın.

---

## ⚙️ 5. Backend & Veri İletişim Kuralları

1. **Serverless Yapıyı Bozmayın:**
   * [api/index.js](file:///d:/Software/School-Projects/CoreTeamWebSite/api/index.js) dosyası Vercel tarafından serverless fonksiyon olarak çalıştırılır. `export default app` yapısını koruyun, `app.listen()` çağrısı eklemeyin.
2. **API İstekleri:**
   * Frontend tarafında API istekleri yaparken [src/lib/api.js](file:///d:/Software/School-Projects/CoreTeamWebSite/src/lib/api.js) içerisindeki `apiFetch` veya `getAuthHeaders()` fonksiyonunu kullanın. Token `localStorage` üzerinden otomatik olarak `Authorization: Bearer <token>` başlığına eklenir.
3. **Supabase Güvenliği & RLS:**
   * Frontend tarafında anon key ile doğrudan veritabanına yazma işlemi (INSERT, UPDATE, DELETE) yapmayın. Yazma işlemleri backend API'si üzerinden `service_role` key kullanılarak ve yetki denetiminden geçerek yapılmalıdır.
   * Hassas kullanıcı verileri için doğrudan `custom_users` tablosu yerine `users_safe` view'ı tercih edilmelidir.

---

## 🚀 6. Sık Kullanılan Geliştirme Komutları

```bash
# Geliştirme sunucusunu başlat (Vite + entegre API)
npm run dev

# Projeyi derle (Production build)
npm run build

# Linter kontrolü
npm run lint
```
