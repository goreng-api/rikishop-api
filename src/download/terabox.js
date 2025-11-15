const axios = require("axios");
const https = require("https");
const FormData = require("form-data");

// --- Helper functions dari skrip Anda ---
const httpsAgent = new https.Agent({ rejectUnauthorized: true });

function kyahhh(k) {
    return k.replace(/[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu, "").trim().replace(/\s+/g, "_");
}

function obj(x) {
    if (Array.isArray(x)) return x.map(v => obj(v));
    if (x && typeof x === "object") {
        const out = {};
        for (const key in x) out[kyahhh(key)] = obj(x[key]);
        return out;
    }
    return x;
}

async function getNonce(url) {
    try {
        const html = (await axios.get(url, { httpsAgent })).data;
        const m = html.match(/var\s+terabox_ajax\s*=\s*(\{[\s\S]*?\});/m);
        if (!m) return null;
        try {
            return JSON.parse(m[1]).nonce ?? null;
        } catch {
            return null;
        }
    } catch (e) {
         console.error(`[TERABOX_NONCE] Gagal fetch nonce: ${e.message}`);
         return null;
    }
}

// --- Fungsi Logika Utama ---
async function teraboxDL(link, opt = {}) {
    const parse = opt.parse_result ?? false;
    const nonce = await getNonce("https://teradownloadr.com/");

    if (!nonce) {
        throw new Error("Gagal mendapatkan nonce dari teradownloadr.com. Website mungkin sedang down.");
    }

    const form = new FormData();
    form.append("action", "terabox_fetch");
    form.append("url", link);
    form.append("nonce", nonce);

    const { data } = await axios.post(
        "https://teradownloadr.com/wp-admin/admin-ajax.php",
        form,
        { headers: form.getHeaders(), httpsAgent }
    );

    // Cek jika API teradownloadr mengembalikan error
    if (!data.success || !data.data) {
        throw new Error(data.message || "Gagal mem-fetch link Terabox. Link mungkin tidak valid.");
    }

    return parse ? obj(data.data) : data.data;
}


// --- Ekspor Modul Express (Struktur Anda) ---
module.exports = function(app) {
    
    // Saya letakkan di /download/terabox, sesuai settings.json
    app.get('/download/terabox', async (req, res) => {
        const { url, parse, apikey } = req.query;

        // 1. Cek API Key (Wajib)
        if (!global.apikey.includes(apikey)) {
            return res.status(403).json({ status: false, error: 'Apikey invalid' });
        }

        // 2. Cek Parameter URL
        if (!url) {
            return res.status(400).json({ status: false, error: 'Parameter url (link terabox) diperlukan' });
        }

        try {
            // Menangani parameter 'parse' opsional
            const parseResult = parse === 'true' || parse === '1';

            const result = await teraboxDL(url, { parse_result: parseResult });
            
            res.status(200).json({
                status: true,
                creator: 'Rikishopreal', //
                result: result
            });

        } catch (error) {
            console.error(`[TERABOX] Error: ${error.message}`);
            res.status(500).json({ status: false, error: error.message || "Terjadi kesalahan pada server." });
        }
    });
};
