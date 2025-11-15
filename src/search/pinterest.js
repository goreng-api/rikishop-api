const axios = require('axios');
const chalk = require('chalk');

/**
 * Fungsi Pint (Pinterest Search) diadaptasi menggunakan Axios
 * Mengambil data dari header 'Link' menggunakan method HEAD.
 * @param {string} query Kata kunci pencarian
 */
async function pint(query) {
    // 1. Buat objek data dan ubah jadi JSON string
    const dataObj = { options: { query: query } };
    const dataString = JSON.stringify(dataObj);
    
    // 2. Buat URL dengan data yang sudah di-encode
    const url = "https://www.pinterest.com/resource/BaseSearchResource/get/?data=" + encodeURIComponent(dataString);
    
    try {
        // 3. Gunakan axios.head() untuk mereplikasi method "head"
        const response = await axios.head(url, {
            headers: {
                "screen-dpr": "4",
                "x-pinterest-pws-handler": "www/search/[scope].js",
                // Menambahkan User-Agent agar konsisten dengan helper Anda
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            }
        });

        // 4. Di Axios, nama header otomatis menjadi huruf kecil
        const rhl = response.headers['link']; 
        
        if (!rhl) {
            throw new Error(`Hasil pencarian ${query} kosong (tidak ada header 'Link')`);
        }

        // 5. Logika regex Anda untuk parse header
        const links = [...rhl.matchAll(/<(.*?)>/gm)].map(v => v[1]);
        return links;

    } catch (error) {
        if (error.response) {
            console.error(chalk.red(`[Pint] API Error: ${error.response.status} ${error.response.statusText}`));
            throw new Error(`Error dari Pinterest: ${error.response.status}`);
        } else if (error.request) {
            console.error(chalk.red('[Pint] API Error: No response received'));
            throw new Error('Tidak ada respon dari server Pinterest.');
        } else {
            console.error(chalk.red('[Pint] Error:', error.message));
            throw new Error(error.message); // Lempar ulang error (misal: "Hasil pencarian kosong")
        }
    }
}

// 6. Buat rute Express
module.exports = function (app) {
    app.get('/search/pinterest', async (req, res) => {
        const query = req.query.q;

        if (!query) {
            return res.status(400).json({
                status: false,
                error: "Parameter 'q' (query) dibutuhkan."
            });
        }

        try {
            const results = await pint(query);
            
            if (results.length === 0) {
                return res.status(404).json({
                   status: false,
                   error: `Tidak ada hasil ditemukan untuk '${query}'`
                });
            }

            // Middleware di index.js Anda akan otomatis menambahkan 'creator'
            res.json({
                status: true,
                result: results
            });

        } catch (error) {
            console.error(chalk.red(`[Endpoint /search/pinterest] Error: ${error.message}`));
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    });
};
