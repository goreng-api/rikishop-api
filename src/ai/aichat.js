const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function aichat(question, { model = 'gpt-5-nano' } = {}) {
    try {
        const _model = {
            'gpt-4o-mini': '25865',
            'gpt-5-nano': '25871',
            'gemini': '25874',
            'deepseek': '25873',
            'claude': '25875',
            'grok': '25872',
            'meta-ai': '25870',
            'qwen': '25869'
        };
        
        if (!question) throw new Error('Question is required.');
        if (!_model[model]) throw new Error(`Model tidak tersedia. Pilihan: ${Object.keys(_model).join(', ')}.`);
        
        // Dapatkan Nonce
        const { data: html } = await axios.post(`https://api.nekolabs.web.id/px?url=${encodeURIComponent('https://chatgptfree.ai/')}&version=v2`);
        const nonceMatch = html.result.content.match(/&quot;nonce&quot;\s*:\s*&quot;([^&]+)&quot;/);
        if (!nonceMatch) throw new Error('Gagal mendapatkan token sesi (Nonce not found).');
        const nonce = nonceMatch[1];

        // Kirim Chat
        const { data } = await axios.post(`https://api.nekolabs.web.id/px?url=${encodeURIComponent('https://chatgptfree.ai/wp-admin/admin-ajax.php')}&version=v2`, new URLSearchParams({
            action: 'aipkit_frontend_chat_message',
            _ajax_nonce: nonce,
            bot_id: _model[model],
            session_id: uuidv4(),
            conversation_uuid: uuidv4(),
            post_id: '6',
            message: question
        }).toString(), {
            headers: {
                origin: 'https://chatgptfree.ai',
                referer: 'https://chatgptfree.ai/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            }
        });
        
        if (!data.result || !data.result.content || !data.result.content.data || !data.result.content.data.reply) {
             throw new Error("Respons tidak valid dari server AI.");
        }

        return data.result.content.data.reply;
    } catch (error) {
        throw new Error(error.message);
    }
};

// Ekspor endpoint - Otomatis dimuat oleh index.js jika ada di folder src/
module.exports = function(app) {
    app.get('/ai/aichat', async (req, res) => {
        const { text, model, apikey } = req.query;

        // 1. Cek API Key
        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }

        // 2. Cek Parameter Text
        if (!text) {
            return res.status(400).json({ status: false, error: 'Parameter text diperlukan' });
        }

        try {
            // 3. Panggil Fungsi AI
            // Default model: 'gpt-5-nano' jika tidak diisi user
            const result = await aichat(text, { model: model || 'gpt-5-nano' });
            
            res.status(200).json({
                status: true,
                result: result
            });

        } catch (error) {
            res.status(500).json({ status: false, error: error.message });
        }
    });
};

