# CoreTeam - Club Management Dashboard

CoreTeam, modern ve kullanıcı dostu bir arayüze sahip, kulüp ve topluluk yönetimi için tasarlanmış tam kapsamlı bir yönetim paneli uygulamasıdır. Bu proje, hem bir yönetim paneli (Frontend) hem de bir API servisi (Backend) içermektedir.

## 🚀 Teknolojiler

### Frontend
- **Framework:** React.js (Vite ile oluşturuldu)
- **Styling:** Vanilla CSS (Modern ve responsive tasarım)
- **İkonlar:** Lucide React
- **Routing:** React Router DOM
- **Veritabanı Bağlantısı:** Supabase JS SDK

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Kimlik Doğrulama:** JSON Web Token (JWT) & Bcrypt
- **Veritabanı:** Supabase (PostgreSQL)
- **Middleware:** CORS, Dotenv

---

## 🛠️ Kurulum ve Çalıştırma

Projeyi yerel makinenizde çalıştırmak için aşağıdaki adımları izleyin.

### 1. Ön Gereksinimler
- Node.js (v16 veya üstü)
- npm veya yarn

```bash
git clone [PROJECT_URL]
```

### 2. Backend Kurulumu

1. `ct/backend` dizinine gidin:
   ```bash
   cd ct/backend
   ```
2. Gerekli paketleri yükleyin:
   ```bash
   npm install
   ```
3. `.env` dosyasını oluşturun veya kontrol edin. Aşağıdaki değişkenlerin tanımlı olduğundan emin olun:
   ```env
   SUPABASE_URL=adresiniz
   SUPABASE_KEY=anahtarınız
   JWT_SECRET=gizli_anahtar
   PORT=5000
   ```
4. Sunucuyu başlatın:
   ```bash
   node server.js
   ```
   *Sunucu varsayılan olarak `http://localhost:5000` adresinde çalışacaktır.*

### 3. Frontend Kurulumu

1. `ct/frontend` dizinine gidin:
   ```bash
   cd ct/frontend
   ```
2. Gerekli paketleri yükleyin:
   ```bash
   npm install
   ```
3. Uygulamayı geliştirme modunda başlatın:
   ```bash
   npm run dev
   ```
   *Uygulama varsayılan olarak `http://localhost:5173` adresinde çalışacaktır.*

---

## 📂 Proje Yapısı

```text
CoreTeam/
├── ct/
│   ├── backend/            # Express.js API klasörü
│   │   ├── routes/         # API uç noktaları
│   │   ├── server.js       # Ana sunucu dosyası
│   │   └── package.json    # Backend bağımlılıkları
│   └── frontend/           # React Uygulaması
│       ├── src/
│       │   ├── components/ # Tekrar kullanılabilir UI bileşenleri
│       │   ├── pages/      # Dashboard sayfaları (Dashboard, Events, Support, vb.)
│       │   ├── lib/        # Supabase istemcisi vb.
│       │   └── App.jsx     # Ana uygulama bileşeni
│       └── package.json    # Frontend bağımlılıkları
└── README.md
```

---

## ✨ Özellikler

- **Modern Dashboard:** Kulüp istatistiklerini ve aktivitelerini takip edebileceğiniz şık bir ana sayfa.
- **Etkinlik Yönetimi:** Kulüp etkinliklerini görüntüleme ve yönetme.
- **Responsive Tasarım:** Mobil, tablet ve masaüstü cihazlarla tam uyumlu arayüz.
- **Güvenli Giriş:** JWT tabanlı kimlik doğrulama sistemi.
- **Destek Sistemi:** Kullanıcıların sorun bildirebileceği destek sayfası.
- **Sidebar Navigasyonu:** Hızlı ve kolay erişim sağlayan dinamik yan menü.

---

## 📝 Önemli Notlar
- Proje veritabanı olarak **Supabase** kullanmaktadır. Tablo yapılarınızın Supabase üzerinde hazır olması gerekmektedir.
- Frontend tarafındaki API bağlantıları `src/lib/supabaseClient.js` üzerinden yönetilmektedir.

---

## 🤝 İletişim
Bu proje CoreTeam ekibi tarafından geliştirilmiştir. Bir sorunla karşılaşırsanız lütfen bir issue açın veya geliştirici ekibe ulaşın.
