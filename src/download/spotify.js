const axios = require('axios');

module.exports = function(app) {

  /**
   * [GET /download/spotify]
   * Fitur Hybrid:
   * 1. Jika akses biasa (?url=...) -> Keluar JSON Metadata.
   * 2. Jika akses link download dari JSON (?url=...&getAudio=true) -> Keluar File MP3.
   */
  app.get('/download/spotify', async (req, res) => {
    try {
      // 1. Ambil Parameter
      const input = req.query.url || req.query.q || req.query.text;
      const isGetAudio = req.query.getAudio === 'true'; // Deteksi apakah user mau file audionya

      // 2. Validasi Input
      if (!input) {
        return res.status(400).json({ 
          status: false, 
          message: "Parameter salah. Gunakan ?url=LINK atau ?q=JUDUL" 
        });
      }

      // ============================================================
      // MODE 1: DOWNLOAD AUDIO (Jika user klik link dari JSON)
      // ============================================================
      if (isGetAudio) {
        // Kita request file ke Spotdown menggunakan POST (Wajib begini agar tidak error)
        const { data: audioBuffer } = await axios.post('https://spotdown.org/api/download', 
          { 
            url: input // URL Spotify asli
          }, 
          {
            headers: {
              origin: 'https://spotdown.org',
              referer: 'https://spotdown.org/',
              'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            },
            responseType: 'arraybuffer'
          }
        );

        // Kirim File MP3 ke User
        res.setHeader('Content-Type', 'audio/mpeg');
        // Nama file default (bisa diperbaiki jika kita fetch metadata lagi, tapi biar cepat kita pakai nama generik/input)
        res.setHeader('Content-Disposition', `attachment; filename="spotify-music.mp3"`);
        return res.send(audioBuffer);
      }

      // ============================================================
      // MODE 2: TAMPILKAN JSON (Default)
      // ============================================================
      
      // Cari Metadata Lagu
      const { data: s } = await axios.get(`https://spotdown.org/api/song-details?url=${encodeURIComponent(input)}`, {
        headers: {
          origin: 'https://spotdown.org',
          referer: 'https://spotdown.org/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
        }
      });

      const song = s.songs ? s.songs[0] : null;
      
      if (!song) {
        return res.status(404).json({ status: false, message: "Lagu tidak ditemukan." });
      }

      // BUAT LINK DOWNLOAD PINTAR
      // Link ini mengarah kembali ke API kamu sendiri, tapi menambahkan "&getAudio=true"
      const protocol = req.headers['x-forwarded-proto'] || req.protocol; // Deteksi https/http otomatis
      const host = req.get('host');
      const fullUrl = `${protocol}://${host}/download/spotify`;
      
      // URL untuk download file (menggunakan URL asli dari metadata song.url)
      const smartDownloadUrl = `${fullUrl}?url=${encodeURIComponent(song.url)}&getAudio=true`;

      // Kirim JSON Response
      res.json({
        status: true,
        creator: "Rikishopreal",
        metadata: {
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          cover: song.thumbnail,
          url_original: song.url,
          // Link ini sekarang BISA DIKLIK dan akan otomatis mendownload file
          download_url: smartDownloadUrl 
        }
      });

    } catch (error) {
      console.error("Spotify Error:", error.message);
      // Cek jika error karena link tidak valid saat mode audio
      if (req.query.getAudio === 'true') {
         return res.status(500).send("Gagal mendownload audio. Pastikan link valid.");
      }
      res.status(500).json({ status: false, message: "Server Error", error: error.message });
    }
  });
};
