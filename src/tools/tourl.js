const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { IncomingForm } = require('formidable'); 

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
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    return response.data; 
  }

  // --- Helper: Proxy Stream (Untuk menampilkan file) ---
  async function streamFile(filename, res) {
    const catboxUrl = `https://files.catbox.moe/${filename}`;
    try {
      const response = await axios({
        url: catboxUrl,
        method: 'GET',
        responseType: 'stream'
      });

      // Teruskan Content-Type asli (video/mp4, audio/mpeg, image/png, dll)
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      
      // Cache agar file tidak didownload ulang terus menerus (Hemat Bandwidth)
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      response.data.pipe(res);
    } catch (error) {
      res.status(404).json({ status: false, message: "File tidak ditemukan atau sudah dihapus." });
    }
  }

  /**
   * [GET /tools/tourl]
   * Info Endpoint
   */
  app.get('/tools/tourl', (req, res) => {
    res.json({
      status: true,
      message: "Support: Image, Video, Audio, File. Gunakan Method POST."
    });
  });

  /**
   * [POST /tools/tourl]
   * Upload File (Apapun) -> Simpan Catbox -> Return Link Domain Sendiri
   */
  app.post('/tools/tourl', (req, res) => {
    const form = new IncomingForm({
      uploadDir: '/tmp', // Wajib tmp di Vercel
      keepExtensions: true,
      maxFileSize: 200 * 1024 * 1024, // Naikkan limit ke 200MB (Limit Catbox)
    });

    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(500).json({ status: false, message: "Gagal parsing form.", error: err.message });

      // Handle array file
      let fileData = files.image || files.file || files.media; // Support key 'media' juga
      if (Array.isArray(fileData)) fileData = fileData[0];

      if (!fileData) {
        return res.status(400).json({ status: false, message: "File tidak ditemukan. Gunakan key 'file', 'image', atau 'media'." });
      }

      try {
        // Upload ke Catbox
        const catboxUrl = await uploadToCatbox(fileData.filepath);
        
        // Hapus file temp
        fs.unlink(fileData.filepath, () => {});

        if (!catboxUrl || !catboxUrl.startsWith('http')) {
           throw new Error("Gagal upload ke storage eksternal.");
        }

        // Masking URL
        const fileName = catboxUrl.split('/').pop();
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        
        // Hasil: https://domainmu.com/files/namafile.mp4
        const customUrl = `${protocol}://${host}/files/${fileName}`;

        res.json({
          status: true,
          creator: "Rikishopreal",
          result: {
            original_name: fileData.originalFilename,
            url: customUrl, 
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
   * [GET /files/:filename]
   * RUTE BARU: Untuk Video, Audio, Dokumen, dll.
   */
  app.get('/files/:filename', async (req, res) => {
    await streamFile(req.params.filename, res);
  });

  /**
   * [GET /images/:filename]
   * RUTE LAMA: Dijaga agar link foto yang sudah dibuat sebelumnya tidak error.
   */
  app.get('/images/:filename', async (req, res) => {
    await streamFile(req.params.filename, res);
  });

};
