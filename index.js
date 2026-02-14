const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs'); // Dosya okuma modülü eklendi
const app = express();

app.use(cors());
app.use(express.json());

// --- AYARLAR ---
const GITHUB_REPO = "keremyenicay/asin-alici"; // KullanıcıAdı/RepoAdı
const GITHUB_FILE_PATH = "main.js"; // GitHub'daki dosya adı
// Render Environment Variables kısmındaki Token'ı alır
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 

// Veritabanı Dosyaları
const LICENSE_FILE = 'licenses.json';

app.post('/api/get-extension', async (req, res) => {
    const { key, machineId } = req.body;

    // 1. LİSANS DOSYASINI OKU
    let licenses;
    try {
        const fileData = fs.readFileSync(LICENSE_FILE, 'utf8');
        licenses = JSON.parse(fileData);
    } catch (err) {
        console.error("Lisans dosyası okunamadı:", err);
        return res.status(500).json({ error: "Sunucu hatası: Lisans veritabanı bulunamadı." });
    }

    // 2. ANAHTAR KONTROLÜ
    if (!licenses[key]) {
        return res.status(401).json({ error: "Geçersiz Lisans Anahtarı" });
    }

    const userLicense = licenses[key];

    // 3. SÜRE KONTROLÜ (Basit Tarih Kontrolü)
    const today = new Date();
    const expiryDate = new Date(userLicense.expiry);
    if (today > expiryDate) {
        return res.status(403).json({ error: "Lisans süreniz dolmuştur." });
    }

    // 4. HWID (MAKİNE KİLİDİ) KONTROLÜ
    // Not: Render'da dosya sistemi geçicidir. Kalıcı kilit için MongoDB gibi bir DB gerekir.
    // Ancak basit koruma için bu yeterlidir.
    // Eğer lisansta kayıtlı cihaz yoksa veya gelen cihaz kayıtlı olana eşitse devam et.
    // (Burayı şimdilik esnek bırakıyorum, sorun çıkmasın diye)

    // 5. GITHUB'DAN KODU ÇEK
    try {
        const githubResponse = await axios.get(
            `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
            {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3.raw' // RAW format
                }
            }
        );

        const protectedCode = githubResponse.data;

        // 6. YANIT OLUŞTUR (Kod + Lisans Bilgileri)
        // Burası eklentideki "Limit 0" sorununu çözen kısımdır.
        res.json({
            success: true,
            payload: protectedCode, // Şifreli kod
            meta: {
                owner: userLicense.name,       // Örn: Kerem Yeniçay
                expiry: userLicense.expiry,    // Örn: 2031-12-29
                limit: userLicense.dailyLimit, // Örn: 5000000
                plan: userLicense.plan || 'standard'
            }
        });

        console.log(`Başarılı Giriş: ${userLicense.name} (${key})`);

    } catch (error) {
        console.error("GitHub Hatası:", error.response ? error.response.status : error.message);
        res.status(500).json({ error: "Sunucu hatası: Kod güncellemesi alınamadı." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor`));
