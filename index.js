const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());

// --- AYARLAR ---
const GITHUB_REPO = "keremyenicay/asin-alici"; 
const GITHUB_FILE_PATH = "main.js"; 
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 

// Dosya Yolları
const LICENSE_FILE = 'licenses.json';
const ACTIVATION_FILE = 'activations.json'; // Kilitlerin tutulduğu dosya

// Yardımcı Fonksiyon: Aktivasyonları Oku
function getActivations() {
    try {
        if (!fs.existsSync(ACTIVATION_FILE)) {
            fs.writeFileSync(ACTIVATION_FILE, '{}');
            return {};
        }
        return JSON.parse(fs.readFileSync(ACTIVATION_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

app.post('/api/get-extension', async (req, res) => {
    const { key, machineId } = req.body;

    // 1. LİSANS VAR MI KONTROL ET
    let licenses;
    try {
        licenses = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
    } catch (err) {
        return res.status(500).json({ error: "Lisans veritabanı hatası." });
    }

    if (!licenses[key]) {
        return res.status(401).json({ error: "Geçersiz Lisans Anahtarı" });
    }

    const userLicense = licenses[key];

    // 2. SÜRE KONTROLÜ
    const today = new Date();
    const expiryDate = new Date(userLicense.expiry);
    if (today > expiryDate) {
        return res.status(403).json({ error: "Lisans süreniz dolmuştur." });
    }

    // 3. HWID (CİHAZ KİLİDİ) KONTROLÜ - EN ÖNEMLİ KISIM
    const activations = getActivations();

    if (activations[key]) {
        // Bu lisans daha önce bir cihaza kilitlenmiş. Kontrol edelim.
        if (activations[key] !== machineId) {
            console.log(`❌ Hatalı Giriş Denemesi: ${key} (Kayıtlı ID: ${activations[key]}, Gelen ID: ${machineId})`);
            return res.status(403).json({ 
                error: "Bu lisans başka bir bilgisayara tanımlanmış! Lütfen kendi lisansınızı kullanın." 
            });
        }
    } else {
        // İlk defa giriliyor! Cihazı kilitleyelim.
        activations[key] = machineId;
        fs.writeFileSync(ACTIVATION_FILE, JSON.stringify(activations, null, 2));
        console.log(`🔒 Lisans Kilitlendi: ${key} -> ${machineId}`);
    }

    // 4. HER ŞEY TAMAM, KODU GÖNDER
    try {
        const githubResponse = await axios.get(
            `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
            {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3.raw'
                }
            }
        );

        res.json({
            success: true,
            payload: githubResponse.data,
            meta: {
                owner: userLicense.name,
                expiry: userLicense.expiry,
                limit: userLicense.dailyLimit,
                plan: userLicense.plan || 'standard'
            }
        });

    } catch (error) {
        console.error("GitHub Hatası:", error.message);
        res.status(500).json({ error: "Sunucu hatası: Kod alınamadı." });
    }
});

// --- AMAZON SP-API VARYASYON KONTROLÜ ---
async function getAmazonAccessToken() {
    try {
        const response = await axios.post('https://api.amazon.com/auth/o2/token', {
            grant_type: 'refresh_token',
            refresh_token: process.env.REFRESH_TOKEN,
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Amazon Token Hatası:", error.response ? error.response.data : error.message);
        throw error;
    }
}

app.get('/api/check-variation/:asin', async (req, res) => {
    const asin = req.params.asin;
    console.log(`[YENI ISTEK] Eklenti şu ASIN'i sordu: ${asin}`); // <-- BU SATIRI EKLEYİN
    
    try {
        const accessToken = await getAmazonAccessToken();
        
        // Amazon Avustralya (FE Region) ve Marketplace ID (A39IBJ37TRP1C6)
        const amazonApiUrl = `https://sellingpartnerapi-fe.amazon.com/catalog/2022-04-01/items/${asin}?marketplaceIds=A39IBJ37TRP1C6&includedData=relationships`;

        const catalogResponse = await axios.get(amazonApiUrl, {
            headers: { 'x-amz-access-token': accessToken }
        });

        const itemData = catalogResponse.data;
        let hasVariation = false;

        if (itemData.relationships && itemData.relationships.length > 0) {
            const variationData = itemData.relationships.find(
                rel => rel.type === 'VARIATION_PARENT' || rel.type === 'VARIATION_CHILD'
            );
            if (variationData) hasVariation = true;
        }

        res.json({ success: true, asin: asin, hasVariation: hasVariation });

    } catch (error) {
        console.error(`ASIN ${asin} sorgulanırken hata:`, error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Amazon API Hatası' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor`));


