const axios = require('axios');
const FormData = require('form-data');
const { cfto: cf } = require('cfto'); // Diganti dari import ke require

/**
 * Fungsi utama OCR (freeocr.ai)
 * @param {Buffer} buffer Buffer gambar yang akan di-scan
 * @returns {Promise<object>} Hasil OCR
 */
async function ocr(buffer) {
    try {
        if (!buffer || !Buffer.isBuffer(buffer)) {
            throw new Error('Image buffer is required');
        }

        const form = new FormData();
        
        // 1. Ambil token Cloudflare Turnstile
        const token = await cf.turnstileMin("https://freeocr.ai/", "0x4AAAAAABrId8YvQ6YAVsLJ");
        
        // 2. Gunakan Buffer dari getBuffer, bukan fs.createReadStream
        form.append("image", buffer, "ocr_image.jpg"); // Kita beri nama file generik
        form.append("cf_token", token.token);

        const headers = {
            headers: {
                ...form.getHeaders()
            }
        };

        // 3. Kirim request
        const { data } = await axios.post("https://freeocr.ai/api/v1/ocr", form, headers);
        return data;

    } catch (error) {
        if (error.response) {
            console.error("[FreeOCR API Error]:", error.response.data);
            throw new Error(error.response.data.message || 'FreeOCR API request failed');
        }
        throw new Error(error.message);
    }
}

// Ekspor modul - Server akan otomatis memanggil fungsi ini
module.exports = function(app) {
    
    // Saya letakkan di /tools/ocr
    app.get('/tools/ocr', async (req, res) => {
        const { url, apikey } = req.query;

        // 1. Cek API Key (Wajib)
        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }

        // 2. Cek Parameter URL
        if (!url) {
            return res.status(400).json({ status: false, error: 'Parameter url (link gambar) diperlukan' });
        }

        try {
            // 3. Ambil buffer gambar dari URL
            const imageBuffer = await global.getBuffer(url);
            if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
                 throw new Error('Gagal mengunduh gambar dari URL.');
            }

            // 4. Panggil fungsi ocr
            const result = await ocr(imageBuffer);
            
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal', //
                result: result
            });

        } catch (error) {
            console.error(`[OCR] Error: ${error.message}`);
            res.status(500).json({ status: false, error: error.message || "Terjadi kesalahan pada server." });
        }
    });
};
