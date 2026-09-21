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
- Node.js (v18 veya üstü)
- npm veya yarn
- Supabase hesabı ve projesi

### 2. Ortam Değişkenleri (.env)

Proje kök dizinindeki `.env.example` dosyasını `.env` olarak kopyalayın ve Supabase bilgilerinizi girin:

```env
# Supabase Yapılandırması
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-public-key-here

# Backend / Serverless Kimlik Doğrulama
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-role-key-here
JWT_SECRET=your-jwt-secret-key-change-in-production

# API URL (Vercel ve yerel Vite geliştirmesinde aynı origin için boş bırakın)
VITE_API_URL=
```

### 3. Bağımlılıkları Yükleyin ve Başlatın

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev
```

*Uygulama ve entegre API `http://localhost:3000` adresinde tek bir port üzerinden çalışacaktır.*

---

## 📂 Proje Yapısı

```text
CoreTeamWebSite/
├── api/                     # Vercel Serverless API Fonksiyonları
│   ├── index.js             # API Express handler & Serverless giriş noktası
│   └── routes/
│       ├── auth.js          # Giriş, kullanıcılar, duyuru & bildirim rotaları
│       └── authMiddleware.js# Token doğrulama middleware
├── public/                  # Statik varlıklar (logolar, ikonlar)
├── src/                     # React arayüz kaynak kodları
│   ├── components/          # UI bileşenleri (ortak, komite panosu, layout)
│   ├── context/             # AuthContext ve oturum yönetimi
│   ├── lib/                 # supabaseClient.js, api.js
│   ├── pages/               # Dashboard, Görevler, Duyurular, Giriş sayfaları
│   ├── App.jsx              # Rotalar ve ana uygulama
│   ├── main.jsx             # React DOM başlangıç noktası
│   └── index.css            # Tema ve genel CSS kuralları
├── index.html               # Vite HTML şablonu
├── vite.config.js           # Vite ve dev API middleware konfigürasyonu
├── package.json             # Birleşik bağımlılıklar ve scriptler
├── vercel.json              # Vercel Serverless ve SPA yönlendirmeleri
└── .env.example             # Ortam değişkeni şablonu
```

---

## 🚀 Vercel Dağıtımı (Deployment)

1. Projeyi GitHub / GitLab deponuza push edin.
2. Vercel Dashboard'unda **Add New Project** diyerek deponuzu bağlayın.
3. **Environment Variables** bölümüne `.env` içerisindeki değişkenleri ekleyin:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `JWT_SECRET`
4. **Deploy** butonuna tıklayın. Vercel hem Vite SPA frontend'ini hem de `/api` Serverless fonksiyonlarını otomatik olarak kuracaktır.

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
