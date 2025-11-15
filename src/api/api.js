// File: src/api.js
// PASTIKAN FILE INI ADA DI DALAM FOLDER /src

const os = require('os');

module.exports = function (app) {

    // Helper untuk menghitung total endpoint dari settings.json
    function countEndpoints() {
        if (!global.settings || !global.settings.endpoints) {
            return 0;
        }
        let total = 0;
        try {
            // Iterasi setiap kategori (downloader, games, dll)
            const categories = Object.values(global.settings.endpoints);
            for (const category of categories) {
                if (Array.isArray(category)) {
                    total += category.length;
                }
            }
        } catch (e) {
            console.error("Error counting endpoints:", e.message);
            return 0; // Kembalikan 0 jika ada error
        }
        return total;
    }

    // Helper untuk mendapatkan info CPU
    function getCpuInfo() {
         try {
            const cpus = os.cpus();
            const avg = os.loadavg(); // [1m, 5m, 15m]
            return {
                model: cpus[0].model,
                cores: cpus.length,
                speed: `${cpus[0].speed} MHz`,
                load_1m: `${(avg[0]).toFixed(2)}%`, // Vercel mungkin melaporkan 0
                load_5m: `${(avg[1]).toFixed(2)}%`,
                load_15m: `${(avg[2]).toFixed(2)}%`
            };
         } catch (e) {
            return { model: "Unknown", cores: 0, speed: "0 MHz", load_1m: "0%" };
         }
    }

    // Helper untuk info memori
    function getMemoryInfo() {
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            return {
                total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
                used: `${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
                free: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
                usage_percent: `${((usedMem / totalMem) * 100).toFixed(2)}%`
            };
        } catch(e) {
            return { total: "0 GB", used: "0 GB", free: "0 GB", usage_percent: "0%" };
        }
    }

    // Rute /api/status yang baru dan lebih estetik
    app.get('/api/status', async (req, res) => {
        try {
            const totalEndpoints = countEndpoints();
            const cpu = getCpuInfo();
            const memory = getMemoryInfo();
            
            // Ambil semua nama kategori endpoint dari settings.json
            const categories = global.settings?.endpoints ? Object.keys(global.settings.endpoints) : [];

            res.status(200).json({
                status: true,
                server_owner: global.settings?.creator || "Rikishopreal",
                server_details: {
                    status: "Aktif",
                    domain: req.hostname,
                    runtime: global.runtime ? global.runtime(process.uptime()) : "N/A",
                    total_request_global: global.totalreq?.toString() || "0",
                    platform: os.platform(),
                    os_release: os.release(),
                    node_version: process.version,
                    memory: memory,
                    cpu: cpu
                },
                api_features: {
                    total_endpoints_tercatat: totalEndpoints,
                    kategori_endpoint: categories
                    // Daftar endpoint lengkap (global.settings.endpoints) telah dihapus
                }
            });
        } catch (error) {
            // Ini akan menangkap error dan memasukkannya ke log (sesuai permintaan)
            console.error("Error di /api/status:", error);
            res.status(500).json({
                status: false,
                error: "Gagal mengambil status server.",
                message: error.message
            });
        }
    });

    // Rute ini tetap sama, tidak diubah
    app.get('/api/express-routes', (req, res) => {
         try {
            const expressRoutes = app._router.stack
                .filter(layer => layer.route)
                .map(layer => ({
                    method: Object.keys(layer.route.methods).join(', ').toUpperCase(),
                    path: layer.route.path
                }));
                
            res.status(200).json({
                status: true,
                message: "Rute yang terdaftar di Express App (index.js). Ini tidak termasuk serverless function di /api/*.",
                total_rute_express: expressRoutes.length,
                routes: expressRoutes
             });
         } catch(e) {
             console.error("Error di /api/express-routes:", e);
             res.status(500).json({ status: false, error: "Gagal mengambil rute Express." });
         }
    });
}