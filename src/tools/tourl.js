const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const formidable = require('formidable');

module.exports = function(app) {

  // Fungsi Helper: Upload ke Catbox
  async function uploadToCatbox(filePath) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', fs.createReadStream(filePath));

    const response = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: {
        ...form.getHeaders(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    return response.data; // Mengembalikan URL string
  }

  /**
   * [GET /tools/tourl]
   * Info Endpoint
   */
  app.get('/tools/tourl', (req, res) => {
    res.json({
      status: true,
      message: "Endpoint aktif. Gunakan Method POST untuk upload gambar."
    });
  });

  /**
   * [POST /tools/tourl]
   * Upload gambar -> Simpan ke /tmp -> Upload ke Catbox -> Hapus tmp -> Return URL
   */
  app.post('/tools/tourl', (req, res) => {
    const form = formidable({
      // Simpan di folder temporary sistem (Vercel mengizinkan ini)
      uploadDir: '/tmp', 
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form Parse Error:", err);
        return res.status(500).json({ status: false, message: "Gagal memproses file.", error: err.message });
      }

      // Ambil file dari key 'image' atau 'file'
      const file = files.image?.[0] || files.file?.[0];

      if (!file) {
        return res.status(400).json({ status: false, message: "File tidak ditemukan. Gunakan key 'image' atau 'file'." });
      }

      try {
        // Upload ke Catbox
        const url = await uploadToCatbox(file.filepath);
        
        // Bersihkan file temporary agar storage Vercel tidak penuh
        fs.unlink(file.filepath, (e) => { if(e) console.error("Gagal hapus temp:", e); });

        // Cek apakah response valid URL
        if (!url || !url.startsWith('http')) {
           throw new Error("Gagal mendapatkan URL dari server upload.");
        }

        res.json({
          status: true,
          creator: "Rikishopreal",
          result: {
            original_name: file.originalFilename,
            url: url.trim(), // URL Publik
            size: file.size,
            mimetype: file.mimetype
          }
        });

      } catch (e) {
        console.error("Upload Error:", e);
        res.status(500).json({ status: false, message: "Gagal mengupload ke server eksternal.", error: e.message });
      }
    });
  });
};
