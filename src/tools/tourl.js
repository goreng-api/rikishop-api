const fs = require('fs');
const path = require('path');
const formidable = require('formidable');

module.exports = function(app) {
  app.post('/tools/tourl', (req, res) => {
    const uploadDir = path.join(__dirname, '../images');
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const form = formidable({
      uploadDir: uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, 
      filename: (name, ext, part, form) => {
        const cleanName = part.originalFilename.replace(/\s+/g, '_');
        return `${Date.now()}_${cleanName}`; 
      }
    });
    form.parse(req, (err, fields, files) => {
      if (err) {
        return res.status(500).json({
          status: false, 
          message: "Gagal upload file.", 
          error: err.message
        });
      }
      const file = files.image?.[0] || files.file?.[0];

      if (!file) {
        return res.status(400).json({
          status: false, 
          message: "File gambar tidak ditemukan. Gunakan key 'image' atau 'file' di form-data."
        });
      }

      try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const filename = path.basename(file.filepath);
        const fileUrl = `${protocol}://${host}/images/${filename}`;
        res.json({
          status: true,
          creator: "Rikishopreal",
          result: {
            original_name: file.originalFilename,
            filename: filename,
            mimetype: file.mimetype,
            size: file.size,
            url: fileUrl
          }
        });

      } catch (e) {
        console.error(e);
        res.status(500).json({ status: false, message: "Terjadi kesalahan server." });
      }
    });
  });
};
