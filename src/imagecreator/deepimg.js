const axios = require('axios');

/**
 * Fungsi utama DeepIMG
 * @param {string} prompt Teks prompt
 * @param {object} options Pilihan { style, size }
 * @returns {Promise<string>} URL gambar yang dihasilkan
 */
async function deepimg(prompt, { style = 'default', size = '1:1' } = {}) {
    try {
        const sizeList = {
            '1:1': '1024x1024',
            '3:2': '1080x720',
            '2:3': '720x1080'
        };
        const styleList = {
            'default': '-style Realism',
            'ghibli': '-style Ghibli Art',
            'cyberpunk': '-style Cyberpunk',
            'anime': '-style Anime',
            'portrait': '-style Portrait',
            'chibi': '-style Chibi',
            'pixel art': '-style Pixel Art',
            'oil painting': '-style Oil Painting',
            '3d': '-style 3D'
        };
        
        if (!prompt) throw new Error('Prompt is required');
        if (!styleList[style]) throw new Error(`List available style: ${Object.keys(styleList).join(', ')}`);
        if (!sizeList[size]) throw new Error(`List available size: ${Object.keys(sizeList).join(', ')}`);
        
        const device_id = Array.from({ length: 32 }, () => Math.floor(Math.random()*16).toString(16)).join('');
        
        const { data } = await axios.post('https://api-preview.apirouter.ai/api/v1/deepimg/flux-1-dev', {
            device_id: device_id,
            prompt: prompt + ' ' + styleList[style],
            size: sizeList[size],
            n: '1',
            output_format: 'png'
        }, {
            headers: {
                'content-type': 'application/json',
                origin: 'https://deepimg.ai',
                referer: 'https://deepimg.ai/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
            }
        });
        
        return data.data.images[0].url;
    } catch (error) {
        if (error.response) {
            console.error("[DeepIMG API Error]:", error.response.data);
            throw new Error(error.response.data.message || 'DeepIMG API request failed');
        }
        throw new Error(error.message);
    }
};


// Ekspor modul - Server akan otomatis memanggil fungsi ini
module.exports = function(app) {
    
    // Sesuai path 'creator' di settings.json
    app.get('/imagecreator/deepimg', async (req, res) => {
        const { prompt, style, size, apikey } = req.query;

        // 1. Cek API Key (Wajib)
        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }

        // 2. Cek Parameter Prompt
        if (!prompt) {
            return res.status(400).json({ status: false, error: 'Parameter prompt diperlukan' });
        }

        try {
            // Persiapkan options
            const options = {};
            if (style) options.style = style; // 'anime', 'ghibli', dll.
            if (size) options.size = size;   // '1:1', '3:2', '2:3'

            const result = await deepimg(prompt, options);
            
            // 3. Kirim respon standar
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal', //
                result: result // Ini adalah URL gambar
            });

        } catch (error) {
            console.error(`[DEEPIMG] Error: ${error.message}`);
            res.status(500).json({ status: false, error: error.message || "Terjadi kesalahan pada server AI." });
        }
    });
};
