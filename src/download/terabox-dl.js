const axios = require('axios');
const chalk = require('chalk');

/**
 * Fungsi inti untuk download Terabox.
 * Mengambil SURL (termasuk follow redirect) dan memanggil API worker.
 * @param {string} url URL Terabox (bisa link share atau link redirect)
 */
async function teraboxDownloader(url) {
    try {
        // Pola regex untuk SURL
        const pattern = /^https?:\/\/(?:www\.|1024)?terabox(?:app)?\.com\/.*[?&]?surl=([a-zA-Z0-9_-]+)/i;
        
        let match = url.match(pattern);
        let surl = match?.[1];
        
        // Jika SURL tidak ada di URL awal, kita follow redirect-nya
        if (!surl) {
            // Validasi dulu kalo ini beneran link Terabox
            if (!/^https?:\/\/(?:www\.|1024)?terabox(?:app)?\.com/i.test(url)) {
                throw new Error('URL Terabox tidak valid.');
            }
            
            console.log(chalk.yellow('[Terabox-DL] SURL tidak ditemukan, mencoba follow redirect...'));
            
            // Axios otomatis follow redirect. Kita ambil URL finalnya.
            const { request } = await axios.get(url, {
                maxRedirects: 10,
                validateStatus: status => status >= 200 && status < 400
            });
            
            const finalUrl = request.res.responseUrl;
            if (!finalUrl) {
                throw new Error('Gagal mendapatkan URL final setelah redirect.');
            }

            // Coba cari SURL di URL final
            match = finalUrl.match(pattern);
            surl = match?.[1];
            
            // Kalo masih gak ketemu juga, berarti link-nya aneh
            if (!surl) {
                console.error(chalk.red('[Terabox-DL] SURL tidak ditemukan setelah redirect. URL Final:', finalUrl));
                throw new Error('SURL tidak ditemukan. Pastikan link share-nya valid.');
            }
        }
        
        console.log(chalk.green(`[Terabox-DL] SURL ditemukan: ${surl}`));
        
        // Panggil API worker-nya
        const { data } = await axios.get('https://tera2.sylyt93.workers.dev/info', {
            headers: {
                'origin': 'https://www.kauruka.com',
                'referer': 'https://www.kauruka.com/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            },
            params: { s: surl } // kirim surl sebagai query param 's'
        });
        
        if (!data) {
            throw new Error('API worker mengembalikan data kosong.');
        }
        
        // Sukses, kembalikan datanya
        return data;

    } catch (error) {
        // Tangani error dari axios atau error buatan (throw)
        console.error(chalk.red('[Terabox-DL] Fungsi inti gagal:', error.message));
        // Lempar lagi error-nya biar ditangkap sama endpoint Express
        throw new Error(error.message); 
    }
}

// Ini wrapper untuk Express
module.exports = function (app) {
    app.get('/download/terabox', async (req, res) => {
        const url = req.query.url;

        if (!url) {
            return res.status(400).json({
                status: false,
                error: "Parameter 'url' dibutuhkan."
            });
        }

        try {
            const result = await teraboxDownloader(url);
            
            // Kirim respon sukses
            // Nanti 'creator' ditambahin otomatis sama index.js kamu
            res.json({
                status: true,
                result: result
            });

        } catch (error) {
            // Tangkap error yang dilempar dari fungsi di atas
            console.error(chalk.red(`[Endpoint /download/terabox] Error: ${error.message}`));
            
            // Tentukan status error
            let statusCode = 500;
            if (error.message.includes('valid') || error.message.includes('SURL tidak ditemukan')) {
                statusCode = 400; // 400 Bad Request, karena link-nya salah
            }

            res.status(statusCode).json({
                status: false,
                error: error.message
            });
        }
    });
};
