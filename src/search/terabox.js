const axios = require('axios');
const chalk = require('chalk');

/**
 * Fungsi Pencarian Terabox
 * Mengambil cookie sesi lalu melakukan POST request ke API
 * @param {string} query Kata kunci pencarian
 */
async function teraboxSearch(query) {
    try {
        const base = 'https://teraboxsearch.xyz';
        const ua = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/5.36';

        // 1. Dapatkan cookie sesi dulu
        const getRes = await axios.get(`${base}/?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': base
            },
            timeout: 15000 // 15 detik timeout
        });

        // 2. Parse cookie (Memperbaiki typo 'setkuki' dan 'setCookies')
        const setCookies = getRes.headers['set-cookie'] || [];
        const cookieHeader = setCookies.map(c => c.split(';')[0]).join('; ');

        if (!cookieHeader) {
            console.warn(chalk.yellow('[Terabox] Gagal mendapatkan sesi cookie. Mencoba lanjut...'));
        }

        // 3. Lakukan POST request untuk API
        const { data } = await axios.post(
            `${base}/api/search`,
            { query }, // Kirim { "query": "..." }
            {
                headers: {
                    'User-Agent': ua,
                    'Accept': '*/*',
                    'Content-Type': 'application/json',
                    'Origin': base,
                    'Referer': `${base}/?q=${encodeURIComponent(query)}`,
                    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Cookie': cookieHeader // Gunakan cookie yang didapat
                },
                timeout: 20000 // 20 detik timeout
            }
        );

        if (!data) {
            return { error: 'EMPTY_RESPONSE', details: 'API Terabox mengembalikan respon kosong.' };
        }

        // 4. Logika pencarian array (diambil dari kode kamu)
        let arr = [];
        if (Array.isArray(data)) arr = data;
        else if (Array.isArray(data.results)) arr = data.results;
        else if (Array.isArray(data.items)) arr = data.items;
        else if (Array.isArray(data.data)) arr = data.data;
        else if (typeof data === 'object') {
            for (const k in data) {
                if (Array.isArray(data[k])) {
                    arr = data[k];
                    break;
                }
            }
        }

        if (!arr.length) {
            return { error: 'NO_RESULTS', details: 'Tidak ada hasil yang ditemukan.' };
        }

        // 5. Format hasil (diambil dari kode kamu)
        const results = arr.map((it, i) => ({
            no: i + 1,
            title: it.title || it.name || it.filename || '-',
            url: it.url || it.link || it.download || it.file || '-',
            thumb: it.thumb || it.thumbnail || it.image || (it.meta && it.meta.thumb) || '-'
        }));

        return results; // Sukses, kembalikan array hasil

    } catch (err) {
        console.error(chalk.red('[Terabox Search] Error:', err.message));
        return { 
            error: err.response?.statusText || 'REQUEST_FAILED', 
            details: err.response?.data?.message || err.message 
        };
    }
}

// 6. Buat rute Express
module.exports = function (app) {
    app.get('/search/terabox', async (req, res) => {
        const query = req.query.q;

        if (!query) {
            return res.status(400).json({
                status: false,
                error: "Parameter 'q' (query) dibutuhkan."
            });
        }

        try {
            const results = await teraboxSearch(query);

            // Cek jika fungsi internal mengembalikan error
            if (results.error) {
                const statusCode = results.error === 'NO_RESULTS' ? 404 : 500;
                const message = results.error === 'NO_RESULTS' 
                    ? `Tidak ada hasil ditemukan untuk '${query}'` 
                    : (results.details || 'Terjadi kesalahan internal');
                
                return res.status(statusCode).json({
                    status: false,
                    error: message
                });
            }
            
            // Sukses (Middleware di index.js akan nambahin 'creator')
            res.json({
                status: true,
                result: results
            });

        } catch (error) {
            // Ini untuk jaga-jaga jika ada error tak terduga
            console.error(chalk.red(`[Endpoint /search/terabox] Critical Error: ${error.message}`));
            res.status(500).json({
                status: false,
                error: 'Terjadi kesalahan kritis pada server.'
            });
        }
    });
};
