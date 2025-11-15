const axios = require("axios"); // Mengganti import

/**
 * Fungsi utama TwitterStalk
 * @param {string} usn Username Twitter
 */
async function TwitterStalk(usn) {
    try {
        // 1. Ambil data profile
        const { data: profile } = await axios.get(`https://www.twitter-viewer.com/api/x/user?username=${usn}`);
        
        if (!profile.success || !profile.data) {
            throw new Error(profile.message || 'User tidak ditemukan atau gagal mengambil profil');
        }
        const prf = profile.data;

        // 2. Ambil data tweets
        const { data: twits } = await axios.get(`https://www.twitter-viewer.com/api/x/user-tweets?user=${prf.restId}&cursor=`);

        if (!twits.success) {
            // Tetap kembalikan profil meskipun tweets gagal (mungkin akun private/tidak ada tweet)
            console.warn(`[TWITTER_STALK] Gagal mengambil tweets untuk ${usn}, tapi profil sukses.`);
        }

        const ress = {
            profile: prf,
            tweets: twits.data?.tweets || [] // Pastikan tweets ada atau kembalikan array kosong
        };
        
        return ress; // Kembalikan objek, bukan stringify

    } catch (error) {
        if (error.response) {
            console.error("[TWITTER_STALK API Error]:", error.response.data);
            throw new Error(error.response.data.message || 'Error dari API twitter-viewer');
        }
        throw new Error(error.message);
    }
}

// Ekspor modul - Server akan otomatis memanggil fungsi ini
module.exports = function(app) {
    
    // Sesuai path 'stalker' di settings.json
    app.get('/stalk/twitter', async (req, res) => {
        const { user, apikey } = req.query;

        // 1. Cek API Key (Wajib)
        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }

        // 2. Cek Parameter User
        if (!user) {
            return res.status(400).json({ status: false, error: 'Parameter user (username) diperlukan' });
        }

        try {
            const result = await TwitterStalk(user);
            
            // 3. Kirim respon standar
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal', //
                result: result
            });

        } catch (error) {
            console.error(`[TWITTER_STALK] Error: ${error.message}`);
            res.status(500).json({ status: false, error: error.message || "Terjadi kesalahan pada server." });
        }
    });
};
