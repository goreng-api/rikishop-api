const axios = require('axios');

module.exports = function(app) {

  /**
   * [GET /download/spotify]
   * Mengembalikan JSON Metadata + Link Download.
   * Input: ?url=LINK atau ?q=JUDUL
   */
  app.get('/download/spotify', async (req, res) => {
    const input = req.query.url || req.query.q || req.query.text;

    if (!input) {
      return res.status(400).json({ 
        status: false, 
        message: "Parameter tidak ditemukan. Gunakan ?url=LINK atau ?q=JUDUL" 
      });
    }

    try {
      // 1. Request Metadata
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

      // 2. Kirim JSON (Bukan Buffer)
      // User/Bot nanti yang akan mendownload dari link 'download_url'
      res.json({
        status: true,
        creator: "Rikishopreal",
        metadata: {
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          cover: song.thumbnail,
          // Ini link download langsung dari Spotdown
          download_url: `https://spotdown.org/api/download-track?url=${encodeURIComponent(song.url)}` 
        }
      });

    } catch (error) {
      console.error("Spotify Error:", error.message);
      res.status(500).json({ status: false, message: "Server Error", error: error.message });
    }
  });
};