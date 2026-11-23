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
- **Yeni ezgi**: Program rastgele bir ezgi çalar.
- Ezgiyi ekrandaki piyanoda ya da klavyeyle tekrar et:
  `A W S E D F T G Y H U J K` = Do, Do#, Re, … , Do'
- Her doğru nota yeşil, yanlış nota kırmızı görünür. Hata yaparsan doğru ezgi gösterilir.
- Art arda 3 doğruda nota sayısı otomatik olarak 1 artar (ayardan kapatılabilir).
- **Do sesini ver**: Referans ses.

### Ritim Tekrarı
- **Yeni ritim**: Önce 4 vuruşluk giriş, sonra ritim çalar.
- **Sıra bende** (ya da Enter): 4 vuruşluk girişten sonra ritmi **Boşluk** tuşuyla ya da **DOKUN** düğmesiyle çal.
- Sonuçta beklenen vuruşlar (yeşil = yakaladın, kırmızı = kaçtı), senin vuruşların ve fazla vuruşlar gösterilir. Program ayrıca erken mi geç mi vurduğunu söyler.
- **Gecikme düzeltmesi**: Bluetooth kulaklık gibi gecikmeli bir ses çıkışında, her vuruşun "geç" sayıldığını görürsen bu değeri artır (genelde 100–200 ms).

İstatistikler tarayıcıda (localStorage) saklanır.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html` | Sayfa yapısı |
| `style.css` | Görünüm |
| `app.js` | Ses üretimi, ezgi/ritim oluşturma, değerlendirme |

## Geliştirme fikirleri

- `app.js` içindeki `SCALES` nesnesine yeni diziler ekle (ör. minör, makamlar).
- Piyanoyu iki oktava genişlet (`WHITES` ve `BLACKS`).
- Mikrofonla söylenen ezgiyi algılama (perde tespiti) ekle.
- Ritim için 3/4 ya da 6/8 ölçü seçeneği ekle.
