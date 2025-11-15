const axios = require('axios');

/**
 * Fungsi utama Venice AI Chat
 * @param {string} question Pertanyaan/prompt untuk AI
 * @returns {Promise<string>} Respon teks dari AI
 */
async function venicechat(question) {
    try {
        if (!question) throw new Error('Question is required');
        
        const { data } = await axios.request({
            method: 'POST',
            url: 'https://outerface.venice.ai/api/inference/chat',
            headers: {
                accept: '*/*',
                'content-type': 'application/json',
                origin: 'https://venice.ai',
                referer: 'https://venice.ai/',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Android 10; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
                'x-venice-version': 'interface@20250523.214528+393d253'
            },
            // Menggunakan data JSON, bukan stringify manual
            data: {
                requestId: 'nekorinn', // Anda bisa ganti ini jika perlu
                modelId: 'dolphin-3.0-mistral-24b',
                prompt: [
                    {
                        content: question,
                        role: 'user'
                    }
                ],
                systemPrompt: '',
                conversationType: 'text',
                temperature: 0.8,
                webEnabled: true,
                topP: 0.9,
                isCharacter: false,
                clientProcessingTime: 15
            }
        });
        
        // Memproses respon stream newline-delimited JSON
        const chunks = data.split('\n').filter(chunk => chunk).map(chunk => JSON.parse(chunk));
        const result = chunks.map(chunk => chunk.content).join('');
        
        return result;
    } catch (error) {
        if (error.response) {
            console.error("[Venice AI Error]:", error.response.data);
            throw new Error(error.response.data.message || 'Venice AI request failed');
        }
        throw new Error(error.message);
    }
};

// Ekspor modul - Server akan otomatis memanggil fungsi ini
module.exports = function(app) {
    
    // Saya letakkan di /ai/venicechat
    app.get('/ai/venicechat', async (req, res) => {
        const { text, apikey } = req.query;

        // 1. Cek API Key (Wajib)
        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }

        // 2. Cek Parameter Text
        if (!text) {
            return res.status(400).json({ status: false, error: 'Parameter text diperlukan' });
        }

        try {
            const result = await venicechat(text);
            
            // 3. Kirim respon standar
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal', // Sesuai settings.json
                result: result
            });

        } catch (error) {
            console.error(`[VENICE AI] Error: ${error.message}`);
            res.status(500).json({ status: false, error: error.message || "Terjadi kesalahan pada server AI." });
        }
    });
};
