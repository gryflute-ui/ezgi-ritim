# Ezgi & Ritim Tekrarı

Kulak eğitimi için tarayıcıda çalışan küçük bir program. Kurulum gerektirmez; HTML, CSS ve JavaScript (Web Audio API) ile yazıldı.

**🌐 Tarayıcıda aç:** https://gryflute-ui.github.io/ezgi-ritim/

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
  Her notanın altındaki çubuk süresini gösterir (tam genişlik = 2 vuruş). Değerlendirmede yalnızca notaların perdesine bakılır.
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
1. **Sınav** sekmesinde ayarları seç: soru sayısı, nota sayısı (en az–en çok; sorular ilerledikçe artar), dizi, ritim, tempo, dinleme hakkı (1–3), cevap yolu (sesle / piyanoyla), her ezgiden önce Do sesi, giriş vuruşu.
2. **Sınav kodu**: Aynı kod ve aynı ayarlarla giren her öğrenci **aynı soruları** alır. Kod otomatik üretilir, istersen değiştirebilirsin.
3. **Öğrenci bağlantısını oluştur ve kopyala**: Bağlantıyı öğrencilerle paylaş. Bağlantıyı açan öğrenci ayarları değiştiremez, yalnızca adını yazıp başlar.

**Öğrenci:**
- Adını (ve numarasını) yazıp **Sınavı başlat**'a basar. Sesle cevapta tarayıcı mikrofon izni ister.
- Her soruda ezgiyi en fazla belirlenen sayıda dinler, sonra söyler (ya da piyanoda çalar).
- Sınav sırasında doğru/yanlış gösterilmez; yalnızca kaç nota cevapladığı görünür.
- **Cevabı sil, yeniden cevapla** ile cevabını yenileyebilir (ezgiyi yeniden dinlemek hakkından düşer).
- Sınav sırasında diğer sekmeler kapalıdır; sayfa kapatılmak istenirse uyarı çıkar.

**Puanlama:** Her soruda söylenen notalar ezgiyle sırayla karşılaştırılır. Atlanan, fazladan ya da yanlış her nota bir nota puanı düşürür (düzeltme uzaklığı). Örneğin 4 notalık ezgide tek bir notayı atlamak %75 alır; sonraki notalar kaymış sayılmaz. Toplam puan, soru puanlarının ortalamasıdır (100 üzerinden).

**Sonuçlar:**
- Sonuç ekranında her sorunun ezgisi ve öğrencinin cevabı renkli gösterilir; **Yazdır / PDF** ile çıktı alınabilir.
- **Sonucu indir (Excel / CSV)**: Öğrenci kendi cihazında yaptıysa bu dosyayı öğretmene gönderebilir.
- Aynı bilgisayarda yapılan bütün sınavlar **Bu bilgisayardaki sonuçlar** listesinde birikir; **Tümünü indir** ile tek bir Excel dosyası alınır.

İstatistikler ve sınav sonuçları tarayıcıda (localStorage) saklanır. Tarayıcı verileri silinirse sonuçlar da silinir; sınavdan sonra CSV'yi indirmeyi unutma.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html` | Sayfa yapısı |
| `style.css` | Görünüm |
| `app.js` | Ses üretimi, ezgi/ritim oluşturma, değerlendirme, mikrofonla perde algılama, sınav |

## Geliştirme fikirleri

- `app.js` içindeki `SCALES` nesnesine yeni diziler ekle (ör. minör, makamlar).
- Piyanoyu iki oktava genişlet (`WHITES` ve `BLACKS`).
- Sesle cevapta ritmi de değerlendir (her notanın başladığı an `closeCand` içinde zaten ölçülüyor).
- Ritim için 3/4 ya da 6/8 ölçü seçeneği ekle.
