const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fungsi Cek Email
 * @param {string} recipient Nama pengguna email
 */
async function cekEmail(recipient) {
    const url = `https://akunlama.com/api/v1/mail/list?recipient=${recipient}`;
    try {
        const response = await axios.get(url);
        if (Array.isArray(response.data) && response.data.length === 0) {
            return { status: 'available', email: `${recipient}@akunlama.com` };
        } else {
            return { status: 'already taken', message: 'Coba yang lain lek, ini bisa sih tapi udh pernah di pake org' };
        }
    } catch (error) {
        console.error(`[AKUNLAMA_CEKEMAIL] Error: ${error.message}`);
        throw new Error(error.response?.data?.message || 'Gagal mengecek email');
    }
}

/**
 * Fungsi Lihat Inbox
 * @param {string} recipient Nama pengguna email
 */
async function inbox(recipient) {
    const url = `https://akunlama.com/api/v1/mail/list?recipient=${recipient}`;
    try {
        const response = await axios.get(url);
        const messages = response.data;
        if (!Array.isArray(messages) || messages.length === 0) {
            return []; // Kembalikan array kosong jika tidak ada pesan
        }
        // Format balasan sesuai skrip asli Anda
        const formattedInbox = messages.map(item => ({
            region: item.storage.region,
            key: item.storage.key,
            timestamp: item.timestamp,
            sender: item.sender,
            subject: item.message.headers.subject,
            from: item.message.headers.from
        }));
        return formattedInbox;
    } catch (error) {
        console.error(`[AKUNLAMA_INBOX] Error: ${error.message}`);
        throw new Error(error.response?.data?.message || 'Gagal mengambil inbox');
    }
}

/**
 * Fungsi Baca Email
 * @param {string} region Region dari 'inbox'
 * @param {string} key Key dari 'inbox'
 */
async function getInbox(region, key) {
    const url = `https://akunlama.com/api/v1/mail/getHtml?region=${region}&key=${key}`;
    try {
        const response = await axios.get(url);
        const html = response.data;
        if (!html || typeof html !== 'string') {
            return { plainText: '', links: [] };
        }
        
        const $ = cheerio.load(html);
        $('script, style').remove(); // Hapus skrip dan style
        const plainText = $('body').text().replace(/\s+/g, ' ').trim();
        
        const links = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                links.push({ href: href, text: $(el).text().trim() });
            }
        });
        
        return { plainText: plainText, links: links };
    } catch (error) {
        console.error(`[AKUNLAMA_GETINBOX] Error: ${error.message}`);
        throw new Error(error.response?.data?.message || 'Gagal membaca email');
    }
}


// Ekspor modul - Server akan otomatis memanggil fungsi ini
module.exports = function(app) {
    
    // RUTE 1: Cek ketersediaan email
    app.get('/tools/akunlama/check', async (req, res) => {
        const { recipient, apikey } = req.query;

        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }
        if (!recipient) {
            return res.status(400).json({ status: false, error: 'Parameter recipient diperlukan (contoh: rikishop)' });
        }

        try {
            const result = await cekEmail(recipient);
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal',
                result: result
            });
        } catch (error) {
            res.status(500).json({ status: false, error: error.message });
        }
    });

    // RUTE 2: Lihat inbox
    app.get('/tools/akunlama/inbox', async (req, res) => {
        const { recipient, apikey } = req.query;

        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }
        if (!recipient) {
            return res.status(400).json({ status: false, error: 'Parameter recipient diperlukan (contoh: rikishop)' });
        }

        try {
            const result = await inbox(recipient);
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal',
                result: result
            });
        } catch (error) {
            res.status(500).json({ status: false, error: error.message });
        }
    });

    // RUTE 3: Baca isi email
    app.get('/tools/akunlama/read', async (req, res) => {
        const { region, key, apikey } = req.query;

        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }
        if (!region || !key) {
            return res.status(400).json({ status: false, error: 'Parameter region dan key diperlukan (didapat dari inbox)' });
        }

        try {
            const result = await getInbox(region, key);
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal',
                result: result
            });
        } catch (error) {
            res.status(500).json({ status: false, error: error.message });
        }
    });
};
