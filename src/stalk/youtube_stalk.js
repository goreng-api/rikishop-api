const axios = require("axios");

/**
 * Helper function untuk cek monetisasi
 */
function checkMonetization(sub, view) {
    const subs = parseInt(sub || 0);
    const views = parseInt(view || 0);
    // Ini asumsi dari skrip Anda, mungkin perlu disesuaikan
    const watchHours = views * 0.1; 
    return subs >= 1000 && watchHours >= 4000;
}

/**
 * Fungsi utama Channel Stats
 * @param {string} url URL Channel YouTube
 */
async function channelStats(url) {
    if (!url) throw new Error("Parameter url diperlukan");
    
    try {
        // 1. Dapatkan Channel ID dari URL
        let { data: channelid } = await axios.post(`https://api.evano.com/api/youtube/search`, 
            { query: url, type: 'url' }, 
            { headers: { 
                "Content-Type": "application/json",
                Origin: "https://evano.com", 
                Referer: "https://evano.com/", 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" 
            }}
        );
        
        if (!channelid.channelId) {
            throw new Error("Gagal menemukan channel ID dari URL yang diberikan.");
        }

        // 2. Dapatkan Analitik dari Channel ID
        let { data } = await axios.get(`https://api.evano.com/api/youtube/channel/${channelid.channelId}/analytics`, {
            headers: { 
                Origin: "https://evano.com", 
                Referer: "https://evano.com/", 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" 
            }
        });
        
        // 3. Tambahkan data monetisasi
        data['isMonetized'] = checkMonetization(data.channel.subscriberCount, data.channel.viewCount);
        return data;
        
    } catch (error) {
        if (error.response) {
            console.error("[EVANO_API Error]:", error.response.data);
            throw new Error(error.response.data.message || 'Error dari API Evano');
        }
        throw new Error(error.message);
    }
}


// Ekspor modul - Server akan otomatis memanggil fungsi ini
module.exports = function(app) {
    
    // Sesuai path 'stalker' di settings.json
    app.get('/stalk/youtube', async (req, res) => {
        const { url, apikey } = req.query;

        // 1. Cek API Key (Wajib)
        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }

        // 2. Cek Parameter URL
        if (!url) {
            return res.status(400).json({ status: false, error: 'Parameter url (link channel YouTube) diperlukan' });
        }

        try {
            const result = await channelStats(url);
            
            // 3. Kirim respon standar
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal', //
                result: result
            });

        } catch (error) {
            console.error(`[YOUTUBE_STALK] Error: ${error.message}`);
            res.status(500).json({ status: false, error: error.message || "Terjadi kesalahan pada server." });
        }
    });
};
