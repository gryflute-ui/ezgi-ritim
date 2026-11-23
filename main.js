// Electron ana süreci: uygulama penceresini oluşturur ve Ezgi & Ritim sayfasını yükler.
const { app, BrowserWindow, dialog, session } = require('electron');
const path = require('path');

function pencereOlustur() {
  const pencere = new BrowserWindow({
    width: 980,
    height: 860,
    minWidth: 640,
    minHeight: 560,
    title: 'Ezgi & Ritim Tekrarı',
    icon: path.join(__dirname, 'simge.png'),
    backgroundColor: '#14161c',   // açılırken beyaz parlama olmasın
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,     // sayfa yalnızca HTML/JS çalıştırır, sisteme erişemez
      sandbox: true,
    },
  });

  pencere.removeMenu();
  pencere.loadFile(path.join(__dirname, 'index.html'));
  pencere.once('ready-to-show', () => pencere.show());

  // Sınav sürerken sayfa kapanmayı engeller (beforeunload). Tarayıcıdaki gibi
  // bir uyarı Electron'da kendiliğinden çıkmadığı için burada soruyoruz.
  pencere.webContents.on('will-prevent-unload', event => {
    const secim = dialog.showMessageBoxSync(pencere, {
      type: 'warning',
      buttons: ['Sınava devam et', 'Çık'],
      defaultId: 0,
      cancelId: 0,
      title: 'Sınav devam ediyor',
      message: 'Sınav henüz bitmedi.',
      detail: 'Şimdi çıkarsan bu sınavın cevapları kaydedilmez.',
    });
    if (secim === 1) event.preventDefault(); // preventDefault = kapanma engelini yok say, çık
  });

  // Sayfa içindeki bağlantılar uygulama içinde yeni pencere açmasın
  pencere.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

// Aynı anda yalnızca bir pencere açık olsun
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [pencere] = BrowserWindow.getAllWindows();
    if (pencere) {
      if (pencere.isMinimized()) pencere.restore();
      pencere.focus();
    }
  });

  app.whenReady().then(() => {
    // Yalnızca mikrofon (sesle cevap) ve pano (sınav bağlantısını kopyalama) izinleri verilir
    const izinli = new Set(['media', 'clipboard-sanitized-write', 'clipboard-read']);
    session.defaultSession.setPermissionRequestHandler((_wc, izin, cevap, ayrinti) => {
      if (izin === 'media') return cevap(!ayrinti.mediaTypes || ayrinti.mediaTypes.every(t => t === 'audio'));
      cevap(izinli.has(izin));
    });
    session.defaultSession.setPermissionCheckHandler((_wc, izin) => izinli.has(izin));
    pencereOlustur();
  });
  app.on('window-all-closed', () => app.quit());
}
