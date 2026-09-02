# 🚀 HSD CoreTeam — UI/UX Geliştirme Önerileri

Bu doküman, HSD CoreTeam yönetim platformunun mobil deneyimini ve genel kullanıcı arayüzünü (UI/UX) modern SaaS standartlarına (Linear, Trello, Notion kalitesine) yükseltmek için önerilen mimari çözümleri içerir.

---

## 📱 1. Mobil Kanban Panosu Mimari Önerisi (Öncelikli)

### 🧐 Mevcut Problem
Dar mobil ekranlarda (360px – 430px) masaüstü gibi yan yana 3-4 sütun göstermeye çalışmak şu iki soruna yol açar:
1. **Sütunların ezilip okunamaz hale gelmesi** (kartların daracık kutulara sıkışması).
2. **Dokunmatik ekranlarda yatay kaydırma yaparken**, parmağın yanlışlıkla bir görevi sürükleyip başka bir sütuna bırakması (hatalı sürükle-bırak).

---

### 💡 Tavsiye Edilen Çözüm: "Segmented Pill Tabs + Tam Ekran Sütun + Hızlı Taşıma"

Dünyanın en iyi mobil proje yönetim araçlarının (Trello Mobile, Linear, Jira) kullandığı hibrit model:

```
┌────────────────────────────────────────────────────────┐
│  KOMİTE BAŞLIĞI                          [+ Yeni Görev]│
├────────────────────────────────────────────────────────┤
│  [● Planlama (3)]   [ Devam Eden (2) ]   [ Tamam (5) ] │  <- Yapışkan (Sticky) Sekme Çubuğu
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🏷️ NORMAL                               ⋮ Menü  │  │  <- %100 Genişlikte Ferah Kartlar
│  │ Yapay Zeka Hackathonu Sponsorluk Görüşmesi       │  │
│  │ 📅 15 Eyl   👤 Arda B.   📎 2 Dosya              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🏷️ ACİL                                 ⋮ Menü  │  │
│  │ Tasarım Ekibiyle Afiş Revizesi                   │  │
│  │ 📅 12 Eyl   👤 Zeynep K.                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  [+ Bu Aşamaya Görev Ekle]                             │
└────────────────────────────────────────────────────────┘
```

#### 🌟 Neden Bu Model?
1. **%100 Genişlikte Ferah Kartlar:** 
   * Seçili sütundaki görevler telefon ekranını tam kaplar; başlıklar kırpılmaz, tarihler ve kişi etiketleri tek bakışta rahatça okunur.
2. **Tek Dokunuşla Sütun Geçişi:** 
   * Kullanıcı üstteki sekmelere dokunarak veya parmağıyla ekranı sağa/sola hafifçe kaydırarak (Instagram hikayeleri gibi) sütunlar arasında gezinebilir.
3. **Mobilde Sürükle-Bırak Yerine "Hızlı Taşı" Menüsü:** 
   * Telefonda küçük bir kartı parmakla tutup taşımaya çalışmak zahmetlidir.
   * Bunun yerine kartın sağındaki üç noktaya dokunulduğunda veya karta basılı tutulduğunda alttan modern bir menü (`Action Sheet`) açılır:
     * ➜ *Devam Edenler'e Taşı*
     * ➜ *Tamamlandı'ya Taşı*
     * ✏️ *Düzenle*
     * 🗑️ *Sil*

---

### 🛠️ Teknik Uygulama Adımları
1. **`CommitteeBoard.jsx`:**
   * Mobil genişlik kontrolü (`window.innerWidth < 768px` veya CSS medya sorguları).
   * Mobilde aktif sütunu tutan state: `const [activeTab, setActiveTab] = useState(columns[0]?.id)`.
   * Üst kısma sütun isimleri ve sayaçları içeren kaydırılabilir sekme çubuğu (`.mobile-column-tabs`).
2. **`CommitteeBoard.css`:**
   * Masaüstünde (`>= 768px`): Mevcut 3 sütunlu eşit genişlikteki ızgara korunur.
   * Mobilde (`< 768px`): Sekme çubuğu yapışkan (`position: sticky; top: 0`) olur; yalnızca aktif sekmenin kart listesi dikey olarak tam genişlikte listelenir.
3. **`KanbanCard.jsx`:**
   * Kart içine mobil için tek tıkla durum ilerletme butonu (örneğin *Planlama* -> *Devam Eden* oku).

---

## 🎨 2. Genel UI/UX İyileştirme Yol Haritası

| Özellik | Açıklama | Kazanım |
| :--- | :--- | :--- |
| **⚡ Command Palette (`Ctrl + K`)** | Klavyeden `Ctrl+K` ile açılan bulanık arka planlı hızlı arama ve komut çubuğu. | Sayfalar arası anında geçiş, hızlı görev oluşturma ve üye arama. |
| **🖼️ Slide-over Drawer (Çekmece)** | Görev detaylarına tıklandığında ekran ortasında popup yerine sağdan kayan detay paneli. | Arkadaki takvim veya tahtayı kaybetmeden görev üzerinde çalışabilme. |
| **🏷️ Öncelik Etiketleri & Filtre Çubuğu** | Görevlere `Acil` (Kırmızı), `Normal` (Mavi), `Düşük` (Yeşil) renkli rozetler ve filtreleme çubuğu. | Yöneticilerin acil işleri veya belirli bir üyeye atanan görevleri saniyeler içinde süzmesi. |
| **📊 Tablo / Liste Görünümü** | "Görevlerim" sayfasında Kanban kartları ile kompakt Excel/Notion tarzı tablo arasında geçiş butonu. | Yoğun görev listelerini tek ekranda toplu inceleyebilme. |
| **✨ Shimmer Skeleton Loaders** | Sayfa yüklenirken dönen spinner yerine hafif parıldayan kart iskeletleri. | Sayfanın çok daha hızlı açıldığı hissini veren modern algı. |

---

*Bu doküman, gelecekteki arayüz geliştirmelerinde referans tasarım kılavuzu olarak kullanılmak üzere hazırlanmıştır.*
