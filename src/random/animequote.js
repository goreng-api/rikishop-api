const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fungsi utama Anime Quote Scraper
 * @returns {Promise<Array<object>>} Array berisi objek-objek quote
 */
async function animequote() {
    try {
        // Mengambil halaman acak (1-184)
        const page = Math.floor(Math.random() * 184) + 1;
        const { data } = await axios.get('https://otakotaku.com/quote/feed/' + page);
        const $ = cheerio.load(data);

        // Mendapatkan semua link dari halaman list
        const kotodamaLinks = $('div.kotodama-list').map((i, el) => {
            return $(el).find('a.kuroi').attr('href');
        }).get();

        // Mengambil detail dari setiap link quote
        const results = await Promise.all(kotodamaLinks.map(async (url) => {
            try {
                const { data: quote } = await axios.get(url);
                const $q = cheerio.load(quote);

                return {
                    char: $q('.char-info .tebal a[href*="/character/"]').text().trim(),
                    from_anime: $q('.char-info a[href*="/anime/"]').text().trim(),
                    episode: $q('.char-info span.meta').text().trim().replace('- ', ''),
                    quote: $q('.post-content blockquote p').text().trim(),
                    source_url: url
                };
            } catch (err) {
                console.error(`[ANIMEQUOTE] Gagal scrape ${url}: ${err.message}`);
                return null; // Kembalikan null jika satu quote gagal
            }
        }));

        // Filter hasil yang null (gagal scrape)
        return results.filter(result => result !== null);

    } catch (error) {
        if (error.response) {
            console.error("[AnimeQuote List Error]:", error.response.data);
            throw new Error(error.response.data.message || 'Gagal mengambil halaman list quote');
        }
        throw new Error(error.message);
    }
};

// Ekspor modul - Server akan otomatis memanggil fungsi ini
module.exports = function(app) {
    
    // Saya letakkan di /random/animequote
    app.get('/random/animequote', async (req, res) => {
        const { apikey } = req.query;

        // 1. Cek API Key (Wajib)
        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }

        try {
            const result = await animequote();
            
            // 2. Kirim respon standar
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal', // Sesuai settings.json
                result: result // Ini akan mengembalikan array berisi quote
            });

        } catch (error) {
            console.error(`[ANIMEQUOTE] Error: ${error.message}`);
            res.status(500).json({ status: false, error: error.message || "Terjadi kesalahan pada server." });
        }
    });
};
