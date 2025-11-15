const axios = require('axios');
const crypto = require('crypto');

// --- Helper Functions dari Skrip Asli ---

const COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json',
    'sec-ch-ua-platform': '"Android"',
    'authorization': 'null',
    'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
    'sec-ch-ua-mobile': '?1',
    'dnt': '1',
    'content-type': 'application/json',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    'referer': 'https://supawork.ai/id/nano-banana',
    'accept-language': 'id,en-US;q=0.9,en;q=0.8,ja;q=0.7',
    'priority': 'u=1, i'
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getPresigned() {
    const config = {
        method: 'GET',
        url: 'https://supawork.ai/supawork/headshot/api/sys/oss/token?f_suffix=png&get_num=3&unsafe=1',
        headers: COMMON_HEADERS
    };
    try {
        const response = await axios.request(config);
        if (response.data && response.data.code === 100000 && response.data.data.length > 0) {
            const urls = response.data.data[0];
            return urls;
        } else {
            throw new Error('Presig url nya ga dapet');
        }
    } catch (error) {
        console.error('Error (getPresigned):', error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * @param {Buffer} fileBuffer - Buffer gambar dari global.getBuffer
 */
async function upload(fileBuffer) {
    try {
        const urls = await getPresigned();
        
        const config = {
            method: 'PUT',
            url: urls.put,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Content-Type': 'image/png',
                'sec-ch-ua-platform': '"Android"',
                'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
                'DNT': '1',
                'sec-ch-ua-mobile': '?1',
                'Origin': 'https://supawork.ai',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'Referer': 'https://supawork.ai/',
                'Accept-Language': 'id,en-US;q=0.9,en;q=0.8,ja;q=0.7',
                'Content-Length': fileBuffer.length // Menggunakan panjang buffer
            },
            data: fileBuffer // Mengirim buffer langsung
        };
        
        const response = await axios.request(config);
        if (response.status === 200) {
            return urls.get;
        } else {
            throw new Error(`gagal, status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error (upload):', error.response ? error.response.statusText : error.message);
        throw error;
    }
}

async function generate(imageUrl, identity, prompt) {
    const data = JSON.stringify({
        "identity_id": identity,
        "aigc_app_code": "image_to_image_generator",
        "model_code": "google_nano_banana",
        "custom_prompt": prompt,
        "aspect_ratio": "match_input_image",
        "image_urls": [imageUrl],
        "currency_type": "silver"
    });
    const config = {
        method: 'POST',
        url: 'https://supawork.ai/supawork/headshot/api/media/image/generator',
        headers: { ...COMMON_HEADERS, 'origin': 'https://supawork.ai' },
        data: data
    };
    try {
        const response = await axios.request(config);
        if (response.data && response.data.code === 100000) {
            return response.data.data;
        } else {
            throw new Error(`Gagal (generate): ${response.data.message}`);
        }
    } catch (error) {
        console.error('Error (generate):', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function check(identity) {
    const config = {
        method: 'GET',
        url: `https://supawork.ai/supawork/headshot/api/media/aigc/result/list/v1?page_no=1&page_size=10&identity_id=${identity}`,
        headers: COMMON_HEADERS
    };
    const maxAttempts = 15;
    const pollInterval = 5000; // 5 detik
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await delay(pollInterval);
            const response = await axios.request(config);
            const data = response.data.data;
            if (data && data.list && data.list.length > 0) {
                const mainTask = data.list[0];
                if (mainTask.status === 1 && mainTask.list && mainTask.list.length > 0) {
                    const subTask = mainTask.list[0];
                    if (subTask.status === 1 && subTask.url && subTask.url.length > 0) {
                        return subTask.url[0]; // Sukses
                    }
                }
            }
            // Jika status belum 1, loop lanjut (setelah delay)
        } catch (error) {
            console.error('Error (check):', error.response ? error.response.data : error.message);
            // Tetap lanjut polling meskipun error
        }
    }
    throw new Error('Timeout. Gagal mendapatkan hasil setelah 75 detik.');
}

/**
 * @param {Buffer} imageBuffer - Buffer gambar
 * @param {string} prompt - Prompt kustom
 */
async function supaworkCreate(imageBuffer, prompt) {
    let identityId;
    try {
        identityId = crypto.randomUUID();
        const sUrl = await upload(imageBuffer);
        await generate(sUrl, identityId, prompt);
        const rUrl = await check(identityId);
        return { success: true, author: 'shannz', result: rUrl };
    } catch (error) {
        console.error(`Error (supaworkCreate):`, error.message);
        throw error; // Lempar ulang agar ditangkap oleh route
    }
}

// --- Ekspor Modul Express (Struktur Anda) ---
module.exports = function(app) {
    
    app.get('/imagecreator/nanobanana', async (req, res) => {
        const { url, prompt, apikey } = req.query;

        // 1. Cek API Key (Wajib)
        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }

        // 2. Cek Parameter
        if (!url || !prompt) {
            return res.status(400).json({ status: false, error: 'Parameter url (link gambar) dan prompt diperlukan' });
        }

        try {
            // 3. Ambil buffer gambar dari URL
            const imageBuffer = await global.getBuffer(url);
            if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
                 throw new Error('Gagal mengunduh gambar dari URL.');
            }

            // 4. Panggil fungsi utama
            const result = await supaworkCreate(imageBuffer, prompt);
            
            // 5. Kirim respon standar
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal', //
                result: result.result // URL gambar hasil
            });

        } catch (error) {
            console.error(`[NANO BANANA] Error: ${error.message}`);
            res.status(500).json({ status: false, error: error.message || "Terjadi kesalahan pada server AI." });
        }
    });
};
