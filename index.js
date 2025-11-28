// Gerekli kütüphaneleri import ediyoruz.
const express = require('express');
const cors = require('cors'); 
const fs = require('fs');     

// Express uygulamasını oluşturuyoruz.
const app = express();
const PORT = process.env.PORT || 3000; 

// Gelen JSON verilerini okuyabilmek için middleware'ler.
app.use(cors());
app.use(express.json());

// Veritabanı dosyalarımızın yolları
const LICENSES_DB_PATH = './licenses.json';
const ACTIVATIONS_DB_PATH = './activations.json';

// --- VARSAYILAN AYAR: Lisansta maxDevices belirtilmeyenler için geçerli olacak limit ---
const DEFAULT_MAX_DEVICES = 3; 

// Ana API endpoint'imiz: Lisans doğrulama
app.post('/api/validate-license', (req, res) => {
    try {
        const { key, machineId } = req.body;

        if (!key || !machineId) {
            return res.status(400).json({ success: false, error: 'Lisans anahtarı veya makine ID eksik.' });
        }

        // Dosyalardan verileri oku
        const licenses = JSON.parse(fs.readFileSync(LICENSES_DB_PATH, 'utf8'));
        const activations = JSON.parse(fs.readFileSync(ACTIVATIONS_DB_PATH, 'utf8'));
        const licenseInfo = licenses[key];

        // 1. Lisansın varlığını kontrol et.
        if (!licenseInfo) {
            return res.status(404).json({ success: false, error: 'Lisans anahtarı geçersiz.' });
        }

        // 2. Lisans süresinin dolup dolmadığını kontrol et.
        const now = new Date();
        const expiryDate = new Date(licenseInfo.expiry);
        if (now > expiryDate) {
            return res.status(403).json({ success: false, error: 'Lisans süreniz dolmuştur.' });
        }
        
        // --- ÖZEL LİMİTİ BELİRLEME ---
        // Lisansta 'maxDevices' belirtilmişse onu kullan, yoksa varsayılanı kullan.
        const currentMaxDevices = licenseInfo.maxDevices || DEFAULT_MAX_DEVICES; 

        // activations[key] artık bir machineId dizisi (array) tutacak. 
        let existingActivations = activations[key] || []; 
        if (typeof existingActivations === 'string') {
             // Eski tekli string yapısındaysa, diziye çevir.
             existingActivations = [existingActivations];
        }

        // Gelen machineId'nin zaten aktif edilmiş cihazlar arasında olup olmadığını kontrol et.
        const isAlreadyActive = existingActivations.includes(machineId); 

        // Eğer bu machineId listede yoksa VE Lisanstaki limit aşıldıysa, hata döndür.
        if (!isAlreadyActive && existingActivations.length >= currentMaxDevices) {
            return res.status(409).json({ 
                success: false, 
                error: `Bu lisans zaten maksimum (${currentMaxDevices}) farklı cihazda/tarayıcıda kullanılıyor.` 
            });
        }

        // Eğer bu machineId listede yoksa, yeni cihazı kaydet.
        if (!isAlreadyActive) {
            // Yeni aktivasyon: Bu machineId'yi listeye ekle.
            existingActivations.push(machineId);
            activations[key] = existingActivations;
            fs.writeFileSync(ACTIVATIONS_DB_PATH, JSON.stringify(activations, null, 2));
            console.log(`Yeni aktivasyon (Cihaz ${existingActivations.length}/${currentMaxDevices}): ${key} -> ${machineId}`);
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
        res.status(500).json({ success: false, error: 'Sunucu tarafında doğrulama hatası oluştu.' });
    }
});

app.listen(PORT, () => {
    console.log(`Lisans sunucusu http://localhost:${PORT} adresinde çalışıyor`);
});
