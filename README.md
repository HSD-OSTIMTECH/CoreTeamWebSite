# CoreTeam - Club Management Dashboard

CoreTeam, modern ve kullanıcı dostu bir arayüze sahip, kulüp ve topluluk yönetimi için tasarlanmış tam kapsamlı bir yönetim paneli uygulamasıdır. Bu proje, hem bir yönetim paneli (Frontend) hem de bir API servisi (Backend) içermektedir.

## 🚀 Teknolojiler

### Frontend
- **Framework:** React.js (Vite ile oluşturuldu)
- **Styling:** Vanilla CSS (Modern ve responsive tasarım)
- **İkonlar:** Lucide React
- **Routing:** React Router DOM
- **API İletişimi:** Native Fetch API (RESTful)

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Kimlik Doğrulama:** JSON Web Token (JWT) & Bcrypt
- **Veritabanı:** Supabase (PostgreSQL)
- **Middleware:** CORS, Dotenv, Express JSON

---

## 🛠️ Kurulum ve Çalıştırma

Projeyi yerel makinenizde çalıştırmak için aşağıdaki adımları izleyin.

### 1. Ön Gereksinimler
- Node.js (v16 veya üstü)
- npm veya yarn
- Supabase hesabı ve projesi

### 2. Supabase Yapılandırması

1. [Supabase Dashboard](https://app.supabase.com) → Projeniz → **Settings** → **API**
2. Aşağıdaki bilgileri not edin:
   - **Project URL** → `VITE_SUPABASE_URL` / `SUPABASE_URL`
   - **Anon Public Key** → `VITE_SUPABASE_KEY` (⚠️ Secret Key değil!)
   - **Service Role Key** → `SUPABASE_KEY` (yalnızca backend için)

### 3. Backend Kurulumu

1. `backend` dizinine gidin:
   ```bash
   cd backend
   ```
2. Gerekli paketleri yükleyin:
   ```bash
   npm install
   ```
3. `.env` dosyasını oluşturun:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-service-role-key-here
   JWT_SECRET=your-secret-key-change-in-production
   PORT=5000
   ```
4. Sunucuyu başlatın:
   ```bash
   npm run dev
   ```
   *Sunucu `http://localhost:5000` adresinde çalışacaktır.*

### 4. Frontend Kurulumu

1. `frontend` dizinine gidin:
   ```bash
   cd frontend
   ```
2. Gerekli paketleri yükleyin:
   ```bash
   npm install
   ```
3. `.env.local` dosyasını oluşturun:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_KEY=your-anon-public-key-here
   ```
4. Uygulamayı geliştirme modunda başlatın:
   ```bash
   npm run dev
   ```
   *Uygulama `http://localhost:5173` adresinde çalışacaktır.*

---

## 📂 Proje Yapısı

```text
CoreTeamWebSite/
├── backend/
│   ├── routes/
│   │   └── auth.js          # Kimlik doğrulama ve API endpoints
│   ├── server.js            # Ana sunucu dosyası
│   ├── package.json         # Backend bağımlılıkları
│   └── .env                 # Çevre değişkenleri
├── frontend/
│   ├── src/
│   │   ├── components/      # Tekrar kullanılabilir UI bileşenleri
│   │   │   ├── common/      # Card, Badge gibi temel bileşenler
│   │   │   └── layout/      # Header, Sidebar, MainLayout
│   │   ├── pages/           # Dashboard sayfaları
│   │   ├── lib/             # Supabase client
│   │   ├── App.jsx          # Ana uygulama bileşeni
│   │   ├── main.jsx         # Entry point
│   │   └── index.css        # Global stiller
│   ├── index.html           # HTML template
│   ├── vite.config.js       # Vite konfigürasyonu
│   ├── package.json         # Frontend bağımlılıkları
│   └── .env.local           # Çevre değişkenleri (⚠️ .gitignore'a ekle)
├── README.md
└── vercel.json              # Vercel deployment konfigürasyonu
```

---

## 🔌 API Endpoints

### Kimlik Doğrulama
- `POST /api/auth/login` - Kullanıcı girişi
- `GET /api/auth/users` - Tüm kullanıcıları listele

### Bildirimler
- `GET /api/auth/notifications/:userId` - Kullanıcının bildirimlerini al
- `PUT /api/auth/notifications/:userId/mark-read` - Bildirimleri okundu işaretle

---

## ✨ Özellikler

- **Modern Dashboard:** Kulüp istatistiklerini ve aktivitelerini takip edebileceğiniz şık ana sayfa
- **Görev Yönetimi:** Sosyal Medya, Projeler ve Teknoloji görevlerinin kanban tablosu
- **Etkinlik Yönetimi:** Kulüp etkinliklerini görüntüleme ve sponsorluk takibi
- **Responsive Tasarım:** Mobil, tablet ve masaüstü cihazlarla tam uyumlu
- **Güvenli Giriş:** JWT tabanlı kimlik doğrulama sistemi
- **Bildirim Sistemi:** Gerçek zamanlı bildirimler (polling ile)
- **Dark Mode:** Tema değiştirme desteği
- **Responsive Sidebar:** Mobil uyumlu navigasyon menüsü

---

## ⚙️ Sistem Gereksinimleri

### Supabase Tabloları
Aşağıdaki tabloların Supabase'de oluşturulmuş olması gerekir:
- `custom_users` - Kullanıcı bilgileri
- `tasks` - Görevler
- `task_assignments` - Görev atanmış kişiler
- `notifications` - Bildirimler
- `announcements` - Duyurular
- `events` - Etkinlikler

### Row Level Security (RLS)
- Supabase RLS policies'leri uygun şekilde yapılandırılmalıdır
- Backend Service Role Key'i kullanmak daha güvenlidir

---

## 📝 Önemli Notlar

⚠️ **Supabase Key'leri:**
- Frontend: **Anon Public Key** kullanmalı (`VITE_SUPABASE_KEY`)
- Backend: **Service Role Key** kullanmalı (`SUPABASE_KEY`)
- Secret key'leri browser'da kullanmayın!

⚠️ **.env dosyaları:**
- `.env` ve `.env.local` dosyalarını `.gitignore`'a ekleyin
- Production'da güvenli değişken yönetimi kullanın

⚠️ **Çalıştırma Sırası:**
1. Backend'i ilk başlatın
2. Frontend'i ikinci başlatın
3. Frontend'in localhost:5000'e erişebildiğinden emin olun

---

## 🚀 Production Deployment

### Vercel (Frontend)
```bash
npm run build
# vercel deploy
```

### Backend Deployment
- Heroku, Railway, Render gibi platformlara deploy yapabilirsiniz
- `SUPABASE_URL` ve `SUPABASE_KEY` environment variable'larını ayarlayın
- `PORT` değişkenini dinamik tutun

---

## 🤝 İletişim ve Destek

Bu proje CoreTeam ekibi tarafından geliştirilmiştir. Bir sorunla karşılaşırsanız lütfen:
- Issue açın
- Geliştirici ekibe ulaşın
- Destek sayfasından bildiriş gönderin
