const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { IncomingForm } = require('formidable'); // Pakai versi 3 yg benar

module.exports = function(app) {

  // --- Helper: Upload ke Catbox ---
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
    return response.data; // Return URL Catbox (contoh: https://files.catbox.moe/xyz.jpg)
  }

  /**
   * [POST /tools/tourl]
   * Upload gambar -> Simpan Catbox -> Return Link Domain Sendiri
   */
  app.post('/tools/tourl', (req, res) => {
    const form = new IncomingForm({
      uploadDir: '/tmp', // Wajib tmp di Vercel
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(500).json({ status: false, message: "Gagal parsing form.", error: err.message });

      // Handle array file dari formidable v3
      let fileData = files.image || files.file;
      if (Array.isArray(fileData)) fileData = fileData[0];

      if (!fileData) {
        return res.status(400).json({ status: false, message: "File tidak ditemukan. Gunakan key 'image'." });
      }

      try {
        // 1. Upload ke Catbox
        const catboxUrl = await uploadToCatbox(fileData.filepath);
        
        // Hapus file temp biar server lega
        fs.unlink(fileData.filepath, () => {});

        if (!catboxUrl || !catboxUrl.startsWith('http')) {
           throw new Error("Gagal upload ke storage eksternal.");
        }

        // 2. MODIFIKASI URL (Masking)
        // Catbox URL: https://files.catbox.moe/abcdef.jpg
        // Kita ambil nama filenya saja: "abcdef.jpg"
        const fileName = catboxUrl.split('/').pop();

        // Kita buat URL Domain Kamu Sendiri
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        
        // Hasil: https://domainmu.com/images/abcdef.jpg
        const customUrl = `${protocol}://${host}/images/${fileName}`;

        res.json({
          status: true,
          creator: "Rikishopreal",
          result: {
            original_name: fileData.originalFilename,
            url: customUrl, // <--- INI SEKARANG DOMAIN KAMU
            size: fileData.size,
            mimetype: fileData.mimetype
          }
        });

      } catch (e) {
        console.error(e);
        res.status(500).json({ status: false, message: "Server Error.", error: e.message });
      }
    });
  });

  /**
   * [GET /images/:filename]
   * RUTE PROXY: Ini rahasianya.
   * Saat link domain kamu dibuka, script ini mengambil gambar dari Catbox
   * dan menampilkannya seolah-olah dari server kamu.
   */
  app.get('/images/:filename', async (req, res) => {
    const { filename } = req.params;
    const catboxUrl = `https://files.catbox.moe/${filename}`;

    try {
      // Ambil gambar dari Catbox sebagai stream
      const response = await axios({
        url: catboxUrl,
        method: 'GET',
        responseType: 'stream'
      });

      // Set Header agar browser tahu ini gambar
      res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache biar cepat
      
      // "Piping" data: Alirkan data dari Catbox langsung ke User
      response.data.pipe(res);

    } catch (error) {
      // Jika file tidak ada di Catbox
      res.status(404).json({ 
        status: false, 
        message: "Gambar tidak ditemukan atau sudah dihapus." 
      });
    }
  });

};
