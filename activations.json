// Gerekli kütüphaneleri import ediyoruz.
const express = require('express');
const cors = require('cors'); // Farklı domainlerden gelen isteklere izin vermek için.
const fs = require('fs');     // Dosya okuma/yazma işlemleri için.

// Express uygulamasını oluşturuyoruz.
const app = express();
const PORT = process.env.PORT || 3000; // Render'ın verdiği portu veya local'de 3000'i kullan.

// Gelen JSON verilerini okuyabilmek için middleware'ler.
app.use(cors());
app.use(express.json());

// Veritabanı dosyalarımızın yolları
const LICENSES_DB_PATH = './licenses.json';
const ACTIVATIONS_DB_PATH = './activations.json';

// Ana API endpoint'imiz: Lisans doğrulama
app.post('/api/validate-license', (req, res) => {
    try {
        const { key, machineId } = req.body;

        // İstekte key veya machineId yoksa hata döndür.
        if (!key || !machineId) {
            return res.status(400).json({ success: false, error: 'Lisans anahtarı veya makine ID eksik.' });
        }

        // Dosyalardan verileri oku
        const licenses = JSON.parse(fs.readFileSync(LICENSES_DB_PATH, 'utf8'));
        const activations = JSON.parse(fs.readFileSync(ACTIVATIONS_DB_PATH, 'utf8'));

        const licenseInfo = licenses[key];

        // 1. Lisans anahtarı geçerli mi?
        if (!licenseInfo) {
            return res.status(404).json({ success: false, error: 'Geçersiz lisans kodu.' });
        }

        // 2. Lisansın süresi dolmuş mu?
        const now = new Date();
        const expiryDate = new Date(licenseInfo.expiry);
        if (now > expiryDate) {
            return res.status(403).json({ success: false, error: 'Lisans süreniz dolmuştur.' });
        }

        const existingActivation = activations[key];

        // 3. Lisans daha önce başka bir makinede aktive edilmiş mi?
        if (existingActivation && existingActivation !== machineId) {
            return res.status(409).json({ success: false, error: 'Bu lisans zaten başka bir bilgisayarda kullanılıyor.' });
        }

        // 4. Lisans ilk defa aktive ediliyorsa veya aynı makinede tekrar doğrulanıyorsa
        if (!existingActivation) {
            // İlk aktivasyon: Bu lisansı bu machineId ile eşleştir ve kaydet.
            activations[key] = machineId;
            fs.writeFileSync(ACTIVATIONS_DB_PATH, JSON.stringify(activations, null, 2));
            console.log(`Yeni aktivasyon: ${key} -> ${machineId}`);
        }

        // Her şey yolundaysa, başarı mesajı ve lisans bilgilerini döndür.
        res.json({
            success: true,
            name: licenseInfo.name,
            expiry: licenseInfo.expiry,
            dailyLimit: licenseInfo.dailyLimit
        });

    } catch (error) {
        console.error('Doğrulama hatası:', error);
        res.status(500).json({ success: false, error: 'Sunucuda bir hata oluştu.' });
    }
});

// Sunucuyu dinlemeye başla
app.listen(PORT, () => {
    console.log(`Lisans sunucusu ${PORT} portunda çalışıyor.`);
});