const axios = require('axios');

module.exports = function(app) {

  /**
   * [GET /download/spotify]
   * Endpoint All-in-One untuk Spotify.
   * Bisa menerima parameter:
   * 1. ?url=... (Link Spotify)
   * 2. ?q=...   (Judul Lagu / Pencarian)
   */
  app.get('/download/spotify', async (req, res) => {
    // 1. Ambil input dari parameter url, q, atau text
    const input = req.query.url || req.query.q || req.query.text;

    // 2. Validasi jika input kosong
    if (!input) {
      return res.status(400).json({ 
        status: false, 
        message: "Parameter tidak ditemukan. Harap gunakan ?url=LINK atau ?q=JUDUL_LAGU" 
      });
    }

    try {
      // 3. Request Metadata ke API Spotdown
      // (Endpoint ini pintar, dia bisa baca URL atau cari judul lagu sekaligus)
      const { data: s } = await axios.get(`https://spotdown.org/api/song-details?url=${encodeURIComponent(input)}`, {
        headers: {
          origin: 'https://spotdown.org',
          referer: 'https://spotdown.org/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
        }
      });

      // 4. Ambil hasil pertama
      const song = s.songs ? s.songs[0] : null;
      
      if (!song) {
        return res.status(404).json({ 
          status: false, 
          message: "Lagu tidak ditemukan. Coba gunakan judul yang lebih spesifik atau cek link URL." 
        });
      }

      // 5. Request File Audio (MP3)
      const { data: audioBuffer } = await axios.post('https://spotdown.org/api/download', 
        { 
          url: song.url // Menggunakan URL internal dari hasil metadata
        }, 
        {
          headers: {
            origin: 'https://spotdown.org',
            referer: 'https://spotdown.org/',
            'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
          },
          responseType: 'arraybuffer' // Wajib arraybuffer agar file tidak rusak
        }
      );

      // 6. Kirim Response Audio ke User
      // Set header agar browser/WhatsApp mengenali ini sebagai file audio
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${song.title || 'spotify_audio'}.mp3"`);
      
      // Info tambahan di header (opsional)
      res.setHeader('X-Song-Title', song.title || 'Unknown');
      res.setHeader('X-Song-Artist', song.artist || 'Unknown');
      
      // Kirim data buffer langsung
      res.send(audioBuffer);

    } catch (error) {
      console.error("Spotify Error:", error.message);
      res.status(500).json({ 
        status: false, 
        message: "Terjadi kesalahan saat memproses lagu.", 
        error: error.message 
      });
    }
  });

};