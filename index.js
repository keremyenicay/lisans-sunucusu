const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Bunu kurman gerek: npm install axios
const app = express();

app.use(cors());
app.use(express.json());

// Sabit Lisanslar (Veritabanı kullanmıyorsan)
const licenses = {
    "kerro1": { active: true, hwid: null }, // İlk girişte HWID kilitlenir
    "deneme1": { active: true, hwid: null }
};

// GITHUB AYARLARI
const GITHUB_REPO = "keremyenicay/asin-alici"; // KullanıcıAdı/RepoAdı
const GITHUB_FILE_PATH = "main.js"; // Dosya yolu
// Render'da Environment Variable olarak "GITHUB_TOKEN" eklemelisin!
// Veya test için buraya 'ghp_...' şeklinde yazabilirsin (ÖNERİLMEZ).
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 

app.post('/api/get-extension', async (req, res) => {
    const { key, machineId } = req.body;

    // 1. LİSANS KONTROLÜ
    if (!licenses[key]) {
        return res.status(401).json({ error: "Geçersiz Lisans Anahtarı" });
    }

    const licenseData = licenses[key];

    // HWID (Makine ID) Kilitleme Mantığı
    if (licenseData.hwid === null) {
        licenseData.hwid = machineId; // İlk girişte kilitle
    } else if (licenseData.hwid !== machineId) {
        return res.status(403).json({ error: "Bu lisans başka bir bilgisayarda kullanılıyor!" });
    }

    // Lisans Pasif mi?
    if (!licenseData.active) {
        return res.status(403).json({ error: "Lisans süresi dolmuş." });
    }

    // 2. GITHUB'DAN KODU ÇEK (Kullanıcı Görmez)
    try {
        const githubResponse = await axios.get(
            `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
            {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3.raw' // RAW formatta (direkt kod) iste
                }
            }
        );

        const protectedCode = githubResponse.data;

        // 3. KODU KULLANICIYA GÖNDER
        // Kodu JSON içinde gönderiyoruz ki doğrudan script tag ile çağrılamasın.
        res.json({
            success: true,
            payload: protectedCode 
        });

    } catch (error) {
        console.error("GitHub Hatası:", error.message);
        res.status(500).json({ error: "Sunucu hatası: Kod alınamadı." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor`));
