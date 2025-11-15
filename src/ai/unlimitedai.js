const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Fungsi utama UnlimitedAI
async function unlimitedai(question) {
    try {
        if (!question) throw new Error('Question is required.');
        
        const inst = axios.create({
            baseURL: 'https://app.unlimitedai.chat/api',
            headers: {
                referer: 'https://app.unlimitedai.chat/id',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            }
        });
        
        const { data: a } = await inst.get('/token');
        const { data } = await inst.post('/chat', {
            messages: [{
                id: uuidv4(),
                createdAt: new Date().toISOString(),
                role: 'user',
                content: question,
                parts: [{
                    type: 'text',
                    text: question
                }]
            }],
            id: uuidv4(),
            selectedChatModel: 'chat-model-reasoning',
            selectedCharacter: null,
            selectedStory: null
        }, {
            headers: {
                'x-api-token': a.token
            }
        });
        
        const result = data.split('\n').find(line => line.startsWith('0:')).slice(3, -1);
        if (!result) throw new Error('No result found.');
        
        return result;
    } catch (error) {
        throw new Error(error.message);
    }
};

// Ekspor modul - Server akan otomatis memanggil fungsi ini
module.exports = function(app) {
    
    // Tidak perlu log manual disini karena index.js sudah melog loading file
    
    app.get('/ai/unlimited', async (req, res) => {
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
            const result = await unlimitedai(text);
            
            res.status(200).json({
                status: true,
                result: result
            });

        } catch (error) {
            console.error(`[UNLIMITED AI] Error: ${error.message}`);
            res.status(500).json({ status: false, error: error.message || "Terjadi kesalahan pada server AI." });
        }
    });
};

