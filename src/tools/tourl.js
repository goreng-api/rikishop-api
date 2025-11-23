const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
// PERBAIKAN 1: Cara panggil library Formidable v3 yang benar
const { IncomingForm } = require('formidable');

module.exports = function(app) {

  // Fungsi Helper: Upload ke Catbox (Penyimpanan Eksternal)
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
    return response.data; 
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
   */
  app.post('/tools/tourl', (req, res) => {
    // PERBAIKAN 2: Gunakan 'new IncomingForm' (Wajib untuk Formidable v3)
    const form = new IncomingForm({
      uploadDir: '/tmp', // Wajib /tmp untuk Vercel
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form Parse Error:", err);
        return res.status(500).json({ status: false, message: "Gagal memproses file.", error: err.message });
      }

      // Formidable v3 terkadang menaruh file dalam array, kita ambil yang pertama
      // Cek key 'image' atau 'file'
      let fileData = files.image || files.file;
      
      // Pastikan kita ambil object filenya (karena v3 mengembalikan array)
      if (Array.isArray(fileData)) {
          fileData = fileData[0];
      }

      if (!fileData) {
        return res.status(400).json({ status: false, message: "File tidak ditemukan. Gunakan key 'image' atau 'file' pada form-data." });
      }

      try {
        // Upload ke Catbox
        const url = await uploadToCatbox(fileData.filepath);
        
        // Bersihkan file temporary di Vercel
        fs.unlink(fileData.filepath, (e) => { if(e) console.error("Gagal hapus temp:", e); });

        // Cek apakah response valid URL
        if (!url || !url.startsWith('http')) {
           throw new Error("Gagal mendapatkan URL dari server upload (Catbox).");
        }

        res.json({
          status: true,
          creator: "Rikishopreal",
          result: {
            original_name: fileData.originalFilename,
            url: url.trim(), // URL Publik dari Catbox
            size: fileData.size,
            mimetype: fileData.mimetype
          }
        });

      } catch (e) {
        console.error("Upload Error:", e);
        res.status(500).json({ status: false, message: "Gagal mengupload ke server eksternal.", error: e.message });
      }
    });
  });
};
