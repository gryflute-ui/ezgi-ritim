# Ezgi & Ritim Tekrarı

Kulak eğitimi için bir program. Tarayıcıda kurulumsuz çalışır, Windows'a masaüstü uygulaması olarak da kurulabilir. HTML, CSS ve JavaScript (Web Audio API) ile yazıldı.

**🌐 Tarayıcıda aç:** https://gryflute-ui.github.io/ezgi-ritim/

**⬇️ Windows için indir:** [Ezgi-Ritim-Kurulum-1.1.0.exe](https://github.com/gryflute-ui/ezgi-ritim/releases/download/v1.1.0/Ezgi-Ritim-Kurulum-1.1.0.exe) (aşağıda **Masaüstü uygulaması** bölümüne bak)

## VS Code'da çalıştırma

1. Klasörü VS Code'da aç: **Dosya → Klasör Aç… → `ezgi-ritim`**
2. Eklentiler sekmesinden **Live Server** (Ritwick Dey) eklentisini kur.
3. `index.html` dosyasına sağ tıkla → **Open with Live Server**.
   Tarayıcı açılır; kodu kaydettiğinde sayfa kendiliğinden yenilenir.

Eklenti kurmak istemezsen `index.html` dosyasına çift tıklayıp tarayıcıda açman da yeterli.

## Nasıl kullanılır?

### Ezgi Tekrarı
- **Yeni ezgi**: Program rastgele bir ezgiyi piyano sesiyle çalar. Piyano sesi uzun çınlar; notalar birbirine bağlı (legato) çalınır.
- **Dizi**: Majör, pentatonik, doğal / armonik / melodik minör, Hicaz, Kürdi, Nihavend, kromatik. Makamlar piyano perdelerine (12 eşit perde) yaklaştırılmıştır (≈ işareti); koma sesleri yoktur.
- **Ton**: Dizinin başladığı nota (Do, Re, Mi♭, Mi, Fa, Sol, La, Si♭) ya da **Rastgele**. Nota adları tona göre yazılır (ör. Fa majörde La# değil **Si♭**; Re Hicaz'da Mi♭ ve Fa#).
- **Ölçü**: 4/4, 3/4, 2/4, 6/8. Ritim kalıpları ölçü çizgisini aşmaz, son nota ölçüyü tamamlar. 6/8'de vuruş noktalı dörtlüktür (tempo da ona göre).
- **Ritim**: Ezginin ritim kalıbı seçilir:
  - *Düz*: bütün notalar bir vuruş
  - *Basit*: dörtlük, sekizlik, ikilik (6/8'de noktalı dörtlük, dörtlük + sekizlik, üç sekizlik)
  - *Noktalı*: + noktalı dörtlük, noktalı sekizlik, senkop (sekizlik–dörtlük–sekizlik)
  - *Karışık*: + on altılık kalıpları ve üçleme
  Cevaplanan notaların altındaki çubuk süresini gösterir. Çubuklar cevaptan önce gizlidir, yoksa ritmi ele verirdi.
- **Ezginin notası (porte)**: Cevap bitince ya da doğru ezgi gösterilince ezgi, sol anahtarı, ölçü işareti ve ölçü çizgileriyle portede gösterilir. Yeşil = doğru, turuncu = yanlış ya da ritmi hatalı nota, yanındaki soluk kırmızı nota = öğrencinin çaldığı/söylediği, gri = cevaplanmayan.
- **Ritmi de değerlendir** (varsayılan açık): Perdeler doğruysa ritme de bakılır; ritim hatalıysa hangi notanın kısa/uzun olduğu söylenir (ör. "2. nota kısa (dörtlük yerine sekizlik gibi)"). Ayrıntılar aşağıda, **Ritim nasıl ölçülür?** bölümünde.
- **Giriş vuruşu**: Ezgiden önce bir ölçü metronom çalar (2/4 ve 6/8'de iki ölçü).
- **Cevap → 🎤 Sesle**: Ezgi bitince mikrofon açılır, öğrenci duyduğunu söyler.
  - "la" ya da "na" hecesiyle söylemek en iyi sonucu verir.
  - Kendi ses aralığında söyleyebilir: ilk notaya göre oktav ayarlanır (ör. erkek sesi bir oktav pes), sonraki notalar bu oktava göre değerlendirilir.
  - Perdede yarım sesin yarısına kadar (±50 sent) sapma kabul edilir; vibrato ve notalar arasındaki kayışlar sorun olmaz.
  - Aynı nota üst üste geliyorsa araya kısa bir sessizlik bırakılmalıdır.
  - Ekranda o an duyulan nota ve sapması (sent) ile ses düzeyi gösterilir.
  - 5 saniye ses gelmezse cevap bitmiş sayılır.
  - Hoparlörle de çalışır: mikrofon, piyano sesi tamamen sönünce açılır.
- **Cevap → Piyano / klavye**: Ezgiyi ekrandaki iki oktavlık piyanoda (Do4–Do6) ya da bilgisayar klavyesiyle tekrar et:
  `A W S E D F T G Y H U J K` = bir oktav (Do … Do'); **Z** alt oktav (Do4–Do5), **X** üst oktav (Do5–Do6). Klavyenin çaldığı oktav piyanoda çerçeveyle gösterilir.
- Art arda 3 doğruda nota sayısı otomatik olarak 1 artar (ayardan kapatılabilir).
- **Do sesini ver**: Referans ses.

### Ritim Tekrarı
İki alıştırma var (**Alıştırma** seçeneği):
- **🎧 Dinle ve tekrar et**: Önce giriş vuruşları, sonra ritim çalar. **Sıra bende** (ya da Enter) ile girişten sonra ritmi **Boşluk** tuşuyla ya da **DOKUN** düğmesiyle çal. Denemeden sonra ritmin notası gösterilir.
- **📖 Notadan oku ve çal (ritim okuma)**: Ritim duyulmaz, nota olarak (tek çizgili ritim portesinde) gösterilir. Öğrenci okuyup çalar. Denemeden sonra notalar yeşil (yakalandı) / kırmızı (kaçtı) olur ve **Dinle** ile doğrusu dinlenebilir.
- **Ölçü** (4/4, 3/4, 2/4, 6/8), **Seviye** (kolay / orta / zor) ve **Uzunluk** (1–2 ölçü) seçilebilir.
- Sonuçta zaman çizelgesinde beklenen vuruşlar (yeşil = yakaladın, kırmızı = kaçtı), senin vuruşların ve fazla vuruşlar gösterilir. Program ayrıca erken mi geç mi vurduğunu söyler.
- **Gecikme düzeltmesi**: Bluetooth kulaklık gibi gecikmeli bir ses çıkışında, her vuruşun "geç" sayıldığını görürsen bu değeri artır (genelde 100–200 ms).

### 📝 Sınav

**Soru türleri** (biri ya da birkaçı seçilir; seçilenler sırayla dönüşümlü gelir):
- **🎵 Ezgi**: Ezgiyi dinle, söyle (ya da piyanoda çal).
- **🎧 Ritim (dinleme)**: Ritmi dinle, sonra çal.
- **📖 Ritim (okuma)**: Ritmi notadan oku ve çal (dinleme yok).

**Öğretmen:**
1. **Öğretmen şifresi oluştur** (önerilir): Şifre oluşturulunca sınav ayarları, öğrenci bağlantısı ve sonuçlar yalnızca **Öğretmen girişi** ile görülür ve değiştirilir. Öğretmenin ayarları bu bilgisayarda saklanır; öğrenci bu ayarlarla sınava başlar. Sınav başlayınca öğretmen oturumu kendiliğinden kapanır. **Şifremi unuttum** şifreyi sıfırlar, ama öğrencilerin sonuçları görmesini önlemek için bu bilgisayardaki bütün sonuçları da siler.
2. **Sınav** sekmesinde ayarları seç: soru türleri, soru sayısı, nota sayısı (en az–en çok; ezgi soruları ilerledikçe artar), dizi, ton (ya da rastgele), ölçü, ritim, ritim sorusu uzunluğu, tempo, dinleme hakkı (1–3), ezgi cevabı (sesle / piyanoyla), ezgide ritim puanı (yok / puanın %30’u / %50’si), her ezgiden önce Do sesi, giriş vuruşu.
3. **Sınav kodu**: Aynı kod ve aynı ayarlarla giren her öğrenci **aynı soruları** alır (aynı program sürümünde). Kod otomatik üretilir, istersen değiştirebilirsin.
4. **Öğrenci bağlantısını oluştur ve kopyala**: Bağlantıyı öğrencilerle paylaş. Bağlantıyı açan öğrenci ayarları değiştiremez, yalnızca adını yazıp başlar.

**Öğrenci:**
- Adını (ve numarasını) yazıp **Sınavı başlat**'a basar. Sesle cevapta tarayıcı mikrofon izni ister.
- Ezgi ve ritim dinleme sorularında ezgiyi/ritmi en fazla belirlenen sayıda dinler. Ritim sorularında **Çalmaya başla** (ya da Enter) ile girişten sonra Boşluk tuşuyla ya da DOKUN düğmesiyle çalar.
- Sınav sırasında doğru/yanlış gösterilmez; yalnızca kaç nota cevapladığı görünür.
- **Cevabı sil, yeniden cevapla** ile cevabını yenileyebilir (ezgiyi yeniden dinlemek hakkından düşer).
- Sınav sırasında diğer sekmeler kapalıdır; sayfa kapatılmak istenirse uyarı çıkar.

**Puanlama:**
- **Ezgi**: Söylenen notalar ezgiyle sırayla karşılaştırılır. Atlanan, fazladan ya da yanlış her nota bir nota puanı düşürür (düzeltme uzaklığı). Örneğin 4 notalık ezgide tek bir notayı atlamak %75 alır; sonraki notalar kaymış sayılmaz. Ezgide ritim puanı açıksa sorunun puanı perde ve ritim puanlarının ağırlıklı ortalamasıdır (ör. %30 ritim: 0,7 × perde + 0,3 × ritim).
- **Ritim soruları**: yakalanan vuruş / (beklenen vuruş + fazla vuruş). Vuruş, en kısa notanın yaklaşık %45'i kadar (en az 60 ms, en çok 130 ms) erken ya da geç olabilir.
- Toplam puan, soru puanlarının ortalamasıdır (100 üzerinden). Sonuç ekranında ve Excel dosyasında perde ve ritim puanları ayrıca gösterilir.

**Ritim nasıl ölçülür? (ezgi sorularında)**
- Her notanın başladığı an kaydedilir (piyanoda tuşa basış, seste notanın başlangıcı). Ardışık iki notanın başlangıçları arasındaki süre, ezgideki nota süresiyle karşılaştırılır. Yaklaşık %22 kısa ile %27 uzun arasındaki sapma doğru sayılır.
- Öğrenci biraz hızlı ya da yavaş söyleyebilir: ritim, öğrencinin kendi temposuna göre ölçülür. Ancak tempo duyulandan çok farklıysa (yaklaşık üçte birden fazla yavaş ya da yarıdan fazla hızlı) bu ritim hatası olarak yansır.
- Son notanın süresi ölçülmez (ardından nota gelmez); n notalık ezgide n−1 süre değerlendirilir.
- Sınırlama: Bütün süreler aynı oranda değişirse (ör. yalnızca üçlemelerden oluşan bir ezgi sekizlik söylenirse) bu, tempo değişikliğinden ayırt edilemez. Üçleme ya da hızlı notalar başka sürelerle bir aradaysa hata yakalanır.
- Eski (ritim puanı eklenmeden önce oluşturulmuş) öğrenci bağlantılarında ritim puanlanmaz; ritim soruları ve yeni dizi/ton/ölçü ayarları eklenmeden önceki bağlantılar yalnızca ezgi, Do majör/4/4 varsayımıyla açılır.

**Sonuçlar:**
- Sonuç ekranında her sorunun cevabı renkli gösterilir; **♪ nota** düğmesiyle sorunun notası (öğrencinin hatalarıyla birlikte) açılır. **Yazdır / PDF** ile çıktı alınabilir.
- **Sonucu indir (Excel / CSV)**: Öğrenci kendi cihazında yaptıysa bu dosyayı öğretmene gönderebilir.
- Aynı bilgisayarda yapılan bütün sınavlar **Bu bilgisayardaki sonuçlar** listesinde birikir; **Tümünü indir** ile tek bir Excel dosyası alınır.

İstatistikler ve sınav sonuçları tarayıcıda (localStorage) saklanır. Tarayıcı verileri silinirse sonuçlar da silinir; sınavdan sonra CSV'yi indirmeyi unutma.

**Öğretmen şifresi hakkında:** Şifre tuzlanıp özetlenerek (PBKDF2) saklanır, kendisi saklanmaz. Ancak koruma bu cihazın tarayıcısındadır: Tarayıcı verilerini silen biri kilidi kaldırabilir (o zaman sonuçlar da silinir). Sınıf içi kullanım için yeterlidir; resmî sınav güvenliği sağlamaz.

## Masaüstü uygulaması (Windows)

Program, metronomdaki gibi Electron ile Windows uygulaması olarak paketlenir.

**Kurulum:** `Ezgi-Ritim-Kurulum-1.1.0.exe` dosyasını çalıştır. Dosya dijital olarak imzalı olmadığı için Windows "Windows kişisel bilgisayarınızı korudu" uyarısı gösterebilir: **Ek bilgi → Yine de çalıştır**. Kurulumdan sonra uygulama masaüstünde ve Başlat menüsünde **Ezgi ve Ritim** adıyla görünür.

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
| `app.js` | Ses üretimi, diziler/tonlar/ölçüler, ezgi/ritim oluşturma, değerlendirme, mikrofonla perde algılama, sınav, öğretmen girişi |
| `notation.js` | Porte (nota yazısı) çizimi: SVG |

## Geliştirme fikirleri

- Makamları koma sesleriyle (53 koma) çalmak ve mikrofonla koma düzeyinde değerlendirmek.
- Ezgi yazımı (dikte): öğrencinin duyduğu ezgiyi portede yazması.
- Sonuçları bir sunucuda toplamak (şu an her cihaz kendi sonuçlarını saklıyor).
