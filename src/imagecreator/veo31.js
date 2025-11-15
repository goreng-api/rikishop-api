const axios = require('axios');

/**
 * Fungsi utama Veo31 (Pixverse)
 * @param {string} prompt Teks prompt
 * @param {string} image URL gambar
 */
async function veo31Generator(prompt, image) {
    
    // Validasi input (sudah diganti dari process.argv)
    if (!prompt || !image) throw new Error('Parameter prompt dan image URL diperlukan');

    const payload = {
        videoPrompt: prompt,
        videoAspectRatio: "16:9",
        videoDuration: 5,
        videoQuality: "540p",
        videoModel: "v4.5",
        videoImageUrl: image,
        videoPublic: false
    };

    try {
        // 1. Buat Task
        const gen = await axios.post('https://veo31ai.io/api/pixverse-token/gen', payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const taskId = gen.data.taskId;
        if (!taskId) throw new Error('Gagal membuat task (API veo31)');

        let videoUrl;
        const timeout = Date.now() + 180000; // Timeout 3 menit (180.000 ms)

        // 2. Polling (menunggu) hasil
        while (Date.now() < timeout) {
            
            // Beri jeda 5 detik sebelum cek
            await new Promise(r => setTimeout(r, 5000)); 

            const res = await axios.post('https://veo31ai.io/api/pixverse-token/get', {
                taskId,
                videoPublic: false,
                videoQuality: "540p",
                videoAspectRatio: "16:9",
                videoPrompt: prompt
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            // Jika video sudah jadi, ambil URL dan hentikan loop
            if (res.data?.videoData?.url) {
                videoUrl = res.data.videoData.url;
                break;
            }
            // Jika belum, loop akan lanjut
        }

        if (!videoUrl) throw new Error('Video belum tersedia atau gagal dibuat (timeout 180 detik).');
        
        return videoUrl;

    } catch (e) {
        console.error("[VEO31 Error]:", e.response?.data || e.message);
        throw new Error(e.response?.data?.message || e.message || "Error tidak diketahui dari veo31");
    }
}

// Ekspor modul - Server akan otomatis memanggil fungsi ini
module.exports = function(app) {
    
    // Saya letakkan di /imagecreator/
    app.get('/imagecreator/veo31', async (req, res) => {
        // Ambil parameter dari query
        const { prompt, url, apikey } = req.query;

        // 1. Cek API Key (Wajib)
        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }

        // 2. Cek Parameter
        if (!prompt || !url) {
            return res.status(400).json({ status: false, error: 'Parameter prompt dan url (link gambar) diperlukan' });
        }

        try {
            const result = await veo31Generator(prompt, url);
            
            // 3. Kirim respon standar
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal',
                result: result // Ini adalah URL video
            });

        } catch (error) {
            console.error(`[VEO31] Error: ${error.message}`);
            res.status(500).json({ status: false, error: error.message || "Terjadi kesalahan pada server AI." });
        }
    });
};
