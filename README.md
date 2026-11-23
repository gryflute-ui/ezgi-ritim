# Ezgi & Ritim Tekrarı

Kulak eğitimi için bir program. Tarayıcıda kurulumsuz çalışır, Windows'a masaüstü uygulaması olarak da kurulabilir. HTML, CSS ve JavaScript (Web Audio API) ile yazıldı.

**🌐 Tarayıcıda aç:** https://gryflute-ui.github.io/ezgi-ritim/

**🖥️ Windows uygulaması:** `Ezgi-Ritim-Kurulum-1.0.0.exe` (aşağıda **Masaüstü uygulaması** bölümüne bak)

## VS Code'da çalıştırma

1. Klasörü VS Code'da aç: **Dosya → Klasör Aç… → `ezgi-ritim`**
2. Eklentiler sekmesinden **Live Server** (Ritwick Dey) eklentisini kur.
3. `index.html` dosyasına sağ tıkla → **Open with Live Server**.
   Tarayıcı açılır; kodu kaydettiğinde sayfa kendiliğinden yenilenir.

Eklenti kurmak istemezsen `index.html` dosyasına çift tıklayıp tarayıcıda açman da yeterli.

## Nasıl kullanılır?

### Ezgi Tekrarı
- **Yeni ezgi**: Program rastgele bir ezgiyi piyano sesiyle çalar.
- **Ritim**: Ezginin ritim kalıbı seçilir:
  - *Düz*: bütün notalar dörtlük
  - *Basit*: dörtlük, sekizlik, ikilik
  - *Noktalı*: + noktalı dörtlük, noktalı sekizlik, senkop (sekizlik–dörtlük–sekizlik)
  - *Karışık*: + on altılık kalıpları ve üçleme
  Cevaplanan notaların altındaki çubuk süresini gösterir (tam genişlik = 2 vuruş). Çubuklar cevaptan önce gizlidir, yoksa ritmi ele verirdi.
- **Ritmi de değerlendir** (varsayılan açık): Perdeler doğruysa ritme de bakılır; ritim hatalıysa hangi notanın kısa/uzun olduğu söylenir (ör. "2. nota kısa (dörtlük yerine sekizlik gibi)") ve çubuğu turuncu olur. Ayrıntılar aşağıda, **Ritim nasıl ölçülür?** bölümünde.
- **Giriş vuruşu**: Ezgiden önce 1 ölçülük (4 vuruş) metronom çalar; ritmi kavramayı kolaylaştırır.
- **Cevap → 🎤 Sesle**: Ezgi bitince mikrofon açılır, öğrenci duyduğunu söyler.
  - "la" ya da "na" hecesiyle söylemek en iyi sonucu verir.
  - Kendi ses aralığında söyleyebilir: ilk notaya göre oktav ayarlanır (ör. erkek sesi bir oktav pes), sonraki notalar bu oktava göre değerlendirilir.
  - Perdede yarım sesin yarısına kadar (±50 sent) sapma kabul edilir; vibrato ve notalar arasındaki kayışlar sorun olmaz.
  - Aynı nota üst üste geliyorsa araya kısa bir sessizlik bırakılmalıdır.
  - Ekranda o an duyulan nota ve sapması (sent) ile ses düzeyi gösterilir.
  - 5 saniye ses gelmezse cevap bitmiş sayılır.
  - Hoparlörle de çalışır: mikrofon, ezginin sesi tamamen bitince açılır.
- **Cevap → Piyano / klavye**: Ezgiyi ekrandaki piyanoda ya da klavyeyle tekrar et:
  `A W S E D F T G Y H U J K` = Do, Do#, Re, … , Do'
- Her doğru nota yeşil, yanlış nota kırmızı görünür. Hata yaparsan doğru ezgi gösterilir.
- Art arda 3 doğruda nota sayısı otomatik olarak 1 artar (ayardan kapatılabilir).
- **Do sesini ver**: Referans ses.

### Ritim Tekrarı
- **Yeni ritim**: Önce 4 vuruşluk giriş, sonra ritim çalar.
- **Sıra bende** (ya da Enter): 4 vuruşluk girişten sonra ritmi **Boşluk** tuşuyla ya da **DOKUN** düğmesiyle çal.
- Sonuçta beklenen vuruşlar (yeşil = yakaladın, kırmızı = kaçtı), senin vuruşların ve fazla vuruşlar gösterilir. Program ayrıca erken mi geç mi vurduğunu söyler.
- **Gecikme düzeltmesi**: Bluetooth kulaklık gibi gecikmeli bir ses çıkışında, her vuruşun "geç" sayıldığını görürsen bu değeri artır (genelde 100–200 ms).

### 📝 Sınav (ezgi tekrarı)

**Öğretmen:**
1. **Sınav** sekmesinde ayarları seç: soru sayısı, nota sayısı (en az–en çok; sorular ilerledikçe artar), dizi, ritim, tempo, dinleme hakkı (1–3), cevap yolu (sesle / piyanoyla), ritim puanı (yok / puanın %30’u / %50’si), her ezgiden önce Do sesi, giriş vuruşu.
2. **Sınav kodu**: Aynı kod ve aynı ayarlarla giren her öğrenci **aynı soruları** alır. Kod otomatik üretilir, istersen değiştirebilirsin.
3. **Öğrenci bağlantısını oluştur ve kopyala**: Bağlantıyı öğrencilerle paylaş. Bağlantıyı açan öğrenci ayarları değiştiremez, yalnızca adını yazıp başlar.

**Öğrenci:**
- Adını (ve numarasını) yazıp **Sınavı başlat**'a basar. Sesle cevapta tarayıcı mikrofon izni ister.
- Her soruda ezgiyi en fazla belirlenen sayıda dinler, sonra söyler (ya da piyanoda çalar).
- Sınav sırasında doğru/yanlış gösterilmez; yalnızca kaç nota cevapladığı görünür.
- **Cevabı sil, yeniden cevapla** ile cevabını yenileyebilir (ezgiyi yeniden dinlemek hakkından düşer).
- Sınav sırasında diğer sekmeler kapalıdır; sayfa kapatılmak istenirse uyarı çıkar.

**Puanlama:** Her soruda söylenen notalar ezgiyle sırayla karşılaştırılır. Atlanan, fazladan ya da yanlış her nota bir nota puanı düşürür (düzeltme uzaklığı). Örneğin 4 notalık ezgide tek bir notayı atlamak %75 alır; sonraki notalar kaymış sayılmaz. Ritim puanı açıksa her sorunun puanı perde ve ritim puanlarının ağırlıklı ortalamasıdır (ör. %30 ritim: 0,7 × perde + 0,3 × ritim). Toplam puan, soru puanlarının ortalamasıdır (100 üzerinden). Sonuç ekranında ve Excel dosyasında perde ve ritim puanları ayrıca gösterilir; ritmi hatalı notaların altı dalgalı çizgiyle işaretlenir.

**Ritim nasıl ölçülür?**
- Her notanın başladığı an kaydedilir (piyanoda tuşa basış, seste notanın başlangıcı). Ardışık iki notanın başlangıçları arasındaki süre, ezgideki nota süresiyle karşılaştırılır. Yaklaşık %22 kısa ile %27 uzun arasındaki sapma doğru sayılır.
- Öğrenci biraz hızlı ya da yavaş söyleyebilir: ritim, öğrencinin kendi temposuna göre ölçülür. Ancak tempo duyulandan çok farklıysa (yaklaşık üçte birden fazla yavaş ya da yarıdan fazla hızlı) bu ritim hatası olarak yansır.
- Son notanın süresi ölçülmez (ardından nota gelmez); n notalık ezgide n−1 süre değerlendirilir.
- Sınırlama: Bütün süreler aynı oranda değişirse (ör. yalnızca üçlemelerden oluşan bir ezgi sekizlik söylenirse) bu, tempo değişikliğinden ayırt edilemez. Üçleme ya da hızlı notalar başka sürelerle bir aradaysa hata yakalanır.
- Eski (ritim puanı eklenmeden önce oluşturulmuş) öğrenci bağlantılarında ritim puanlanmaz.

**Sonuçlar:**
- Sonuç ekranında her sorunun ezgisi ve öğrencinin cevabı renkli gösterilir; **Yazdır / PDF** ile çıktı alınabilir.
- **Sonucu indir (Excel / CSV)**: Öğrenci kendi cihazında yaptıysa bu dosyayı öğretmene gönderebilir.
- Aynı bilgisayarda yapılan bütün sınavlar **Bu bilgisayardaki sonuçlar** listesinde birikir; **Tümünü indir** ile tek bir Excel dosyası alınır.

İstatistikler ve sınav sonuçları tarayıcıda (localStorage) saklanır. Tarayıcı verileri silinirse sonuçlar da silinir; sınavdan sonra CSV'yi indirmeyi unutma.

## Masaüstü uygulaması (Windows)

Program, metronomdaki gibi Electron ile Windows uygulaması olarak paketlenir.

**Kurulum:** `Ezgi-Ritim-Kurulum-1.0.0.exe` dosyasını çalıştır. Dosya dijital olarak imzalı olmadığı için Windows "Windows kişisel bilgisayarınızı korudu" uyarısı gösterebilir: **Ek bilgi → Yine de çalıştır**. Kurulumdan sonra uygulama masaüstünde ve Başlat menüsünde **Ezgi ve Ritim** adıyla görünür.

- **Mikrofon:** Uygulama yalnızca mikrofona erişir, kameraya erişmez. Windows'ta *Ayarlar → Gizlilik ve güvenlik → Mikrofon* altında "Masaüstü uygulamalarının mikrofonunuza erişmesine izin verin" açık olmalıdır.
- **Sınav bağlantısı:** Masaüstü uygulamasında bağlantı tıklanarak açılamaz. Öğrenci, öğretmenin verdiği bağlantıyı Sınav sekmesindeki **"Sınav bağlantısını yapıştır"** kutusuna yapıştırıp **Ayarları yükle**'ye basar.
- Sınav sürerken pencere kapatılmak istenirse uygulama onay ister.
- Sonuçlar uygulamanın kendi verilerinde saklanır; tarayıcıdaki sonuçlardan ayrıdır.

**Yeniden derleme:**
```
npm install
npm start        # uygulamayı geliştirme modunda açar
npm run dist     # dist/ klasörüne kurulum dosyasını üretir
```
Simge, `build/simge-kaynak.html` dosyasındaki SVG çiziminden üretildi (`build/icon.png`, `simge.png`).

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html` | Sayfa yapısı |
| `style.css` | Görünüm |
| `main.js` | Masaüstü (Electron) penceresi, mikrofon izni, sınavda kapanma onayı |
| `package.json` | Masaüstü paketleme ayarları |
| `app.js` | Ses üretimi, ezgi/ritim oluşturma, değerlendirme, mikrofonla perde algılama, sınav |

## Geliştirme fikirleri

- `app.js` içindeki `SCALES` nesnesine yeni diziler ekle (ör. minör, makamlar).
- Piyanoyu iki oktava genişlet (`WHITES` ve `BLACKS`).
- Ritim sınavı: ritim tekrarı sorularını da sınava ekle.
- Ritim için 3/4 ya da 6/8 ölçü seçeneği ekle.
