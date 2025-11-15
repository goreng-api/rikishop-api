const axios = require('axios');

/**
 * Fungsi utama GPT (stablediffusion.fr)
 * @param {string} prompt Teks prompt
 * @param {string} model Model yang digunakan ('chatgpt4' atau 'chatgpt3')
 * @returns {Promise<string>} Respon teks dari AI
 */
async function gpt(prompt, model = 'chatgpt4') {
    try {
        const model_list = {
            chatgpt4: {
                api: 'https://stablediffusion.fr/gpt4/predict2',
                referer: 'https://stablediffusion.fr/chatgpt4'
            },
            chatgpt3: {
                api: 'https://stablediffusion.fr/gpt3/predict',
                referer: 'https://stablediffusion.fr/chatgpt3'
            }
        };
        if (!prompt) throw new Error('Prompt is required');
        if (!model_list[model]) throw new Error(`List available models: ${Object.keys(model_list).join(', ')}`);
        
        // Ambil cookie session
        const hmm = await axios.get(model_list[model].referer, {
            headers: {
                 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36'
            }
        });
        
        const { data } = await axios.post(model_list[model].api, {
            prompt: prompt
        }, {
            headers: {
                accept: '*/*',
                'content-type': 'application/json',
                origin: 'https://stablediffusion.fr',
                referer: model_list[model].referer,
                // Pastikan cookie diambil dengan benar
                cookie: hmm.headers['set-cookie'] ? hmm.headers['set-cookie'].join('; ') : '', 
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36'
            }
        });
        
        return data.message;
    } catch (error) {
        if (error.response) {
            console.error("[GPT API Error]:", error.response.data);
            throw new Error(error.response.data.message || 'GPT (stablediffusion.fr) API request failed');
        }
        throw new Error(error.message);
    }
}

// Ekspor modul - Server akan otomatis memanggil fungsi ini
module.exports = function(app) {
    
    // Saya letakkan di /ai/gpt
    app.get('/ai/gpt', async (req, res) => {
        const { text, model, apikey } = req.query;

        // 1. Cek API Key (Wajib)
        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }

        // 2. Cek Parameter Text
        if (!text) {
            return res.status(400).json({ status: false, error: 'Parameter text diperlukan' });
        }

        try {
            // Tentukan model, default ke 'chatgpt4' jika tidak dispesifikasi
            const selectedModel = model === 'chatgpt3' ? 'chatgpt3' : 'chatgpt4';
            
            const result = await gpt(text, selectedModel);
            
            // 3. Kirim respon standar
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal', // Sesuai settings.json
                result: result
            });

        } catch (error) {
            console.error(`[GPT] Error: ${error.message}`);
            res.status(500).json({ status: false, error: error.message || "Terjadi kesalahan pada server AI." });
        }
    });
};
