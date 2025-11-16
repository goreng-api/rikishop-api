const axios = require('axios');
const chalk = require('chalk');

/**
 * ======================================================
 * FUNGSI INTI (diambil dari kode kamu)
 * ======================================================
 */

/**
 * Menerjemahkan teks bahasa Indonesia ke aksara Jawa.
 * @param {string} text Teks yang akan diterjemahkan
 * @param {object} options Opsi { from, to }
 */
async function translateJawa(text, { from = 'indo', to = 'krama-alus' } = {}) {
    try {
        if (!text) throw new Error('Parameter "text" dibutuhkan.');

        const languageMap = {
            'indo': 'id',
            'jawa': 'jw',
            'krama-lugu': 'kl',
            'krama-alus': 'ka',
            'ngoko': 'ng'
        };

        const fromCode = languageMap[from];
        const toCode = languageMap[to];

        // Validasi (dari kode kamu)
        if (!fromCode) throw new Error(`Bahasa 'from' tidak valid: ${from}. Pilihan: indo, jawa.`);
        if (!toCode) throw new Error(`Bahasa 'to' tidak valid: ${to}. Pilihan: indo, krama-lugu, krama-alus, ngoko.`);
        if (fromCode === 'id' && toCode === 'id') throw new Error('Tidak bisa translate dari indo ke indo.');
        if (fromCode === 'jw' && toCode !== 'id') throw new Error('Jika 'from' adalah jawa, 'to' harus indo.');

        const { data } = await axios.post('https://api.translatejawa.id/translate', 
            { text: text.trim(), from: fromCode, to: toCode }, 
            {
                headers: {
                    'content-type': 'application/json',
                    'referer': 'https://translatejawa.id/',
                    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
                }
            }
        );

        return data.result;

    } catch (error) {
        // Dilempar lagi agar ditangkap oleh Express
        throw new Error(error.response?.data?.message || error.message);
    }
}

/**
 * Mengubah teks Latin ke Aksara Jawa atau sebaliknya.
 * @param {string} text Teks yang akan diubah
 * @param {object} options Opsi { direction, withSpace, withMurda }
 */
async function aksaraJawa(text, { direction = 'toJavanese', withSpace = true, withMurda = true } = {}) {
    try {
        if (!text) throw new Error('Parameter "text" dibutuhkan.');

        const validDirections = ['toJavanese', 'toLatin'];
        if (!validDirections.includes(direction)) {
            throw new Error(`Parameter 'direction' tidak valid: ${direction}. Pilihan: ${validDirections.join(', ')}.`);
        }

        // Ubah string "true" / "false" dari query param jadi boolean
        const useSpace = String(withSpace) === 'true';
        const useMurda = String(withMurda) === 'true';

        const { data } = await axios.post('https://aksarajawa.id/api/translate', 
            {
                text: text.trim(),
                direction: direction,
                options: {
                    withSpace: useSpace,
                    withMurda: useMurda,
                    typeMode: true // Sesuai kode asli
                }
            }, 
            {
                headers: {
                    'content-type': 'application/json',
                    'referer': 'https://aksarajawa.id/',
                    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
                }
            }
        );

        return data.result;

    } catch (error) {
        // Dilempar lagi
        throw new Error(error.response?.data?.message || error.message);
    }
}


/**
 * ======================================================
 * ROUTE EXPRESS
 * ======================================================
 */
module.exports = function (app) {

    // Endpoint 1: Translate Bahasa Jawa
    app.get('/tools/translate-jawa', async (req, res) => {
        const { text, from, to } = req.query;

        if (!text) {
            return res.status(400).json({
                status: false,
                error: "Parameter 'text' dibutuhkan."
            });
        }

        try {
            const options = {
                from: from || 'indo', // Default 'indo'
                to: to || 'krama-alus' // Default 'krama-alus'
            };
            const result = await translateJawa(text, options);
            
            res.json({
                status: true,
                result: result
            });

        } catch (error) {
            console.error(chalk.red(`[Endpoint /tools/translate-jawa] Error: ${error.message}`));
            res.status(400).json({ // 400 Bad Request (biasanya karena input salah)
                status: false,
                error: error.message
            });
        }
    });

    // Endpoint 2: Aksara Jawa
    app.get('/tools/aksara-jawa', async (req, res) => {
        const { text, direction, withSpace, withMurda } = req.query;

        if (!text) {
            return res.status(400).json({
                status: false,
                error: "Parameter 'text' dibutuhkan."
            });
        }

        try {
            const options = {
                direction: direction || 'toJavanese',
                withSpace: withSpace !== 'false', // Default true
                withMurda: withMurda !== 'false'  // Default true
            };
            const result = await aksaraJawa(text, options);
            
            res.json({
                status: true,
                result: result
            });

        } catch (error) {
            console.error(chalk.red(`[Endpoint /tools/aksara-jawa] Error: ${error.message}`));
            res.status(400).json({
                status: false,
                error: error.message
            });
        }
    });
};
