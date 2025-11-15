// --- REQ: Muat environment variables dari .env ---
require('dotenv').config();
const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { Ratelimit } = require('@upstash/ratelimit');
const { kv } = require('@vercel/kv');
const formidable = require('formidable');
const { cfto } = require('cfto');

console.log("LOG: Script index.js (Final Full Version) dimulai.");
try {
  if (fs.existsSync(path.join(__dirname, 'function.js'))) {
    require("./function.js"); 
    console.log("LOG: function.js dimuat.");
  } else {
    console.log("LOG: function.js tidak ditemukan, dilewati.");
  }
} catch (funcError) {
  console.warn(chalk.yellow("PERINGATAN: Gagal memproses function.js: " + funcError.message));
}

const app = express();
const PORT = process.env.PORT || 3000;
const getClientIp = (req) => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        return ips[0];
    }
    return req.socket.remoteAddress || req.ip || 'Unknown IP';
};

app.enable("trust proxy");
app.set("json spaces", 2);
app.use((req, res, next) => {
    if (req.path === '/api/submit-report') {
        return next();
    }
    return express.json()(req, res, next);
});
app.use(express.urlencoded({ extended: false }));
app.use(cors());

console.log("LOG: Middleware dasar dimuat.");
const checkAdminKey = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  const { ADMIN_API_KEY } = process.env;

  if (!ADMIN_API_KEY) {
    console.error(chalk.red("FATAL: ADMIN_API_KEY tidak diatur!"));
    return res.status(500).json({ status: false, error: "Konfigurasi server admin error." });
  }

  if (!adminKey || adminKey !== ADMIN_API_KEY) {
    const ip = getClientIp(req);
    console.warn(chalk.yellow(`ADMIN: Akses Ditolak IP: ${ip} ke ${req.path}`));
    return res.status(403).json({ status: false, error: "Akses ditolak. Kunci admin salah." });
  }
  next();
};
const BLACKLIST_URL = process.env.GITHUB_BLACKLIST_URL;

async function fetchBlacklistAndReturnSet() {
  if (!BLACKLIST_URL) return new Set();
  try {
    const response = await axios.get(BLACKLIST_URL, {
      timeout: 5000,
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' }
    });
    if (Array.isArray(response.data)) {
      return new Set(response.data.filter(ip => typeof ip === 'string' && ip.trim()));
    }
    return new Set();
  } catch (error) {
    console.error(chalk.red(`BLACKLIST: Gagal fetch: ${error.message}`));
    return new Set();
  }
}
app.use(async (req, res, next) => {
  const allowedPaths = ['/api/blacklist-info', '/api/my-ip', '/manage-blacklist'];
  if (req.path.startsWith('/admin/') || allowedPaths.includes(req.path)) return next();

  const currentBlacklist = await fetchBlacklistAndReturnSet();
  const userIP = getClientIp(req);

  if (currentBlacklist.has(userIP)) {
    console.warn(chalk.bgRed.white.bold(` BLOKIR: Akses ditolak untuk IP ${userIP} (blacklist). Path: ${req.path} `));
    res.status(403).send(`
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/><title>403 Forbidden</title><style>body{background:#0a0a0a;color:#e0e0e0;font-family:'Courier New',Courier,monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem;text-align:center}.container{max-width:600px;border:1px solid #ff4141;background:rgba(26,26,26,0.9);padding:2rem;border-radius:8px;box-shadow:0 0 30px rgba(255,65,65,0.3)}h1{color:#ff4141;margin-bottom:1rem;font-size:1.8rem}p{font-size:1rem;margin-bottom:1.5rem}pre{color:#ffab70;background:#1a1a1a;padding:0.5rem 1rem;border-radius:4px;display:inline-block;border:1px solid #333}</style></head><body><div class="container"><h1>[ ACCESS DENIED ]</h1><p>Akses dari alamat IP Anda telah diblokir secara permanen.</p><pre>IP Address: ${userIP}</pre></div></body></html>
    `);
    return;
  }
  next();
});
app.use('/', express.static(path.join(__dirname, '/')));
app.use('/', express.static(path.join(__dirname, 'api-page')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/audio', express.static(path.join(__dirname, 'audio')));

const settingsPath = path.join(__dirname, './settings.json');
let settings = {};
try {
  const settingsData = fs.readFileSync(settingsPath, 'utf-8');
  settings = JSON.parse(settingsData);
  global.settings = settings;
  console.log("LOG: settings.json berhasil dibaca.");
} catch (err) {
  console.error(chalk.red(`FATAL ERROR: Gagal memuat settings.json: ${err.message}`));
}
global.apikey = Array.isArray(settings.apikey) ? settings.apikey : [];

const WEBHOOK_URLS = {
  report: process.env.DISCORD_WEBHOOK_REPORT,
  feature: process.env.DISCORD_WEBHOOK_FEATURE,
  ddos: process.env.DISCORD_WEBHOOK_DDOS,
  error: process.env.DISCORD_WEBHOOK_ERROR,
  activity: process.env.DISCORD_WEBHOOK_ACTIVITY,
  blacklist_action: process.env.DISCORD_WEBHOOK_BLACKLIST
};

let webhooksConfiguredCount = 0;
for (const key in WEBHOOK_URLS) { if (WEBHOOK_URLS[key]) webhooksConfiguredCount++; }
console.log(chalk.green(`LOG: ${webhooksConfiguredCount} Webhook Discord terkonfigurasi.`));

async function sendDiscordAlert(type, data) {
  const url = WEBHOOK_URLS[type];
  if (!url) return; 

  let embedPayload = {
    username: "RikiShop System",
    avatar_url: "https://i.imgur.com/R3vQvjV.png",
    embeds: [{
      timestamp: new Date().toISOString(),
      footer: { text: `RikiShop API | IP: ${data.ip || '?'}` }
    }]
  };
  let embed = embedPayload.embeds[0];

  try {
      switch (type) {
        case 'ddos':
          embedPayload.username = "🛡️ DDoS Guardian";
          embedPayload.content = "@here ⚠️ **PERINGATAN: High Traffic Detected!**";
          embed.title = "🚨 Rate Limit Terpicu (DDoS Block)";
          embed.color = 15548997; 
          embed.description = `IP ini melakukan request berlebihan dan telah **diblokir sementara** oleh sistem.`;
          embed.fields = [
            { name: "IP Address", value: `\`${data.ip}\``, inline: true },
            { name: "Endpoint Target", value: `\`${data.endpoint}\``, inline: true },
            { name: "ISP", value: data.ipInfo?.isp || 'Unknown', inline: true },
            { name: "Lokasi", value: `${data.ipInfo?.city || '-'}, ${data.ipInfo?.country || '-'}`, inline: true },
            { name: "Organisasi", value: data.ipInfo?.org || '-', inline: false }
          ];
          break;

        case 'activity':
          embedPayload.username = "📜 Activity Logger";
          const isWebAccess = data.endpoint.endsWith('.html') || data.endpoint === '/';
          const isRoot = data.endpoint === '/';
          
          if (isWebAccess) {
              embed.title = `🌐 Web Visited: ${isRoot ? 'Home Page' : data.endpoint}`;
              embed.color = 4886754;
          } else {
              embed.title = `⚡ API Request (Try It): ${data.endpoint}`;
              embed.color = 16776960;
          }

          embed.fields = [
              { name: "IP Address", value: `\`${data.ip}\``, inline: true },
              { name: "Method", value: `\`${data.method}\``, inline: true },
              { name: "Status", value: `\`${data.statusCode}\``, inline: true },
              { name: "Duration", value: `\`${data.duration}ms\``, inline: true },
              { name: "User Agent", value: `\`\`\`${(data.userAgent || 'Unknown').substring(0, 300)}\`\`\``, inline: false }
          ];
          if (data.apiKeyUsed) embed.fields.push({ name: "API Key", value: "✅ Used", inline: true });
          break;

        case 'report':
        case 'feature':
          embedPayload.username = type === 'report' ? "🐞 Bug Report" : "✨ Feature Request";
          embed.title = type === 'report' ? "Laporan Error Baru" : "Permintaan Fitur Baru";
          embed.color = type === 'report' ? 16734296 : 3447003;
          embed.description = data.teks || 'No Description';
          embed.fields = [
            { name: "Pelapor", value: `\`${data.nama || 'Anonim'}\``, inline: true },
            { name: "IP", value: `\`${data.ip}\``, inline: true }
          ];
          
          if (data.imageUrl) {
            embed.image = { url: data.imageUrl };
            embed.fields.push({ name: "Lampiran Gambar", value: `[Lihat Gambar](${data.imageUrl})`, inline: false });
          }
          break;

        case 'error':
          const statusCode = data.statusCode || 500;
          const isServerError = statusCode >= 500;
          
          embedPayload.username = isServerError ? "💥 Server Error Log" : "🚫 Client Error Log";
          embed.title = isServerError 
              ? `Internal Server Error (${statusCode})` 
              : `Client Error (${statusCode})`;
              
          embed.color = 16711680;
          embed.description = `Pesan Error:\n\`\`\`\n${(data.errorMessage || data.statusMessage || 'Unknown Error').substring(0, 1000)}\n\`\`\``;
          
          embed.fields = [
            { name: "Endpoint", value: `\`${data.endpoint}\``, inline: true },
            { name: "IP Client", value: `\`${data.ip}\``, inline: true }
          ];
          
          if (data.method) {
            embed.fields.push({ name: "Method", value: `\`${data.method}\``, inline: true });
          }
          if (data.userAgent) {
             embed.fields.push({ name: "User Agent", value: `\`\`\`${(data.userAgent || 'Unknown').substring(0, 300)}\`\`\``, inline: false });
          }
          break;

        case 'blacklist_action':
          embedPayload.username = "🔒 Admin Blacklist Log";
          const action = data.action === 'blacklisted' ? 'DIBLOKIR' : 'DIBUKA KEMBALI';
          embed.title = `IP ${action}`;
          embed.color = data.action === 'blacklisted' ? 15158332 : 3066993;
          embed.description = `Target IP: \`${data.ip}\`\nOleh Admin: \`${data.adminIp}\``;
          break;
      }

      await axios.post(url, embedPayload);
  } catch (error) {
  }
}

async function uploadImageToCloudflare(imagePath) {
    const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = process.env;
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
        console.warn(chalk.yellow("UPLOAD: CLOUDFLARE_ACCOUNT_ID atau CLOUDFLARE_API_TOKEN belum diatur. Upload gambar dilewati."));
        return null;
    }
    try {
        const uploader = cfto({
            account: CLOUDFLARE_ACCOUNT_ID,
            token: CLOUDFLARE_API_TOKEN
        });
        const result = await uploader.upload(imagePath);
        console.log(chalk.green(`UPLOAD: Gambar berhasil diupload ke: ${result.url}`));
        return result.url;
    } catch (err) {
        console.error(chalk.red(`UPLOAD: Gagal upload ke Cloudflare: ${err.message}`));
        return null;
    }
}

app.use((req, res, next) => {
  const start = Date.now();
  const ip = getClientIp(req);
  
  const isIgnoredAsset = /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|mp3|json|txt)$/i.test(req.path);
  const isFavicon = req.path === '/favicon.ico';
  
  const shouldLog = !isIgnoredAsset && !isFavicon;

  if (shouldLog) {
      console.log(chalk.bgBlue.white(` IN `), chalk.green(req.method), req.path, chalk.gray(`from ${ip}`));
  }

  const originalJson = res.json;
  res.json = function (data) {
    if (data && typeof data === 'object' && !data.error && res.statusCode >= 200 && res.statusCode < 300) {
      const responseData = data.creator ? data : { creator: global.settings.creator || "Rikishopreal", ...data };
      return originalJson.call(this, responseData);
    }
    return originalJson.call(this, data);
  };

  res.on('finish', () => {
      const shouldLogOnFinish = shouldLog && 
                                res.statusCode !== 404 && 
                                res.statusCode !== 429 && 
                                res.statusCode < 500;

      if (shouldLogOnFinish) {
           const duration = Date.now() - start;
           
           const logData = {
               ip: ip, 
               method: req.method, 
               endpoint: req.originalUrl || req.path, 
               statusCode: res.statusCode,
               statusMessage: res.statusMessage,
               userAgent: req.headers['user-agent'], 
               apiKeyUsed: !!(req.query.apikey || req.headers['x-api-key']), 
               duration: duration
           };

           if (res.statusCode >= 400) {
              sendDiscordAlert('error', logData);
           } else {
              sendDiscordAlert('activity', logData);
           }
           
           const statusColor = res.statusCode >= 400 ? chalk.bgYellow.black : chalk.bgGreen.black;
           console.log(chalk.gray(` OUT`), statusColor(` ${res.statusCode} `), `${duration}ms`);
      } else if (shouldLog && res.statusCode >= 500) {
            const duration = Date.now() - start;
            const statusColor = chalk.bgRed.white;
            console.log(chalk.gray(` OUT`), statusColor(` ${res.statusCode} `), `${duration}ms`);
      }
  });
  next();
});

async function getIpInfo(ip) {
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168')) return { isp: 'Localhost', country: 'Local', city: '-', org: '-' };
    try {
        const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,city,isp,org`, { timeout: 3000 });
        if(res.data.status === 'success') {
            return res.data;
        }
        return { isp: 'Unknown', country: 'Unknown', city: '-', org: '-' };
    } catch (e) { return { isp: 'Error Lookup', country: '-', city: '-', org: '-' }; }
}

const limitHandler = async (req, res) => {
    const ip = getClientIp(req);
    console.warn(chalk.bgMagenta.white.bold(` ⚠️ DDoS/SPAM DETECTED: IP ${ip} blocked temporary `));
    
    const ipInfo = await getIpInfo(ip);
    
    sendDiscordAlert('ddos', { ip: ip, endpoint: req.originalUrl || req.path, ipInfo: ipInfo });
    
    res.status(429).send(`
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>429 Too Many Requests</title><style>@import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap');body{background:#0a0a0a;color:#e0e0e0;font-family:'Roboto Mono','Courier New',Courier,monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem;text-align:center;}.container{max-width:700px;width:100%;border:1px solid #ffab70;background:rgba(26,26,26,0.9);padding:1.5rem 2rem;border-radius:8px;box-shadow:0 0 30px rgba(255,171,112,0.3);animation:fadeIn .5s ease;}@keyframes fadeIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}h1{color:#ffab70;font-size:1.5rem;text-transform:uppercase;letter-spacing:2px;margin-top:0;margin-bottom:1.5rem;}pre{background:#0a0a0a;border:1px solid #444;padding:1rem;border-radius:4px;white-space:pre-wrap;word-wrap:break-word;font-size:.9rem;line-height:1.6;text-align:left;margin-bottom:1.5rem;}.key{color:#88d7ff;font-weight:700;}.value{color:#ffab70;}.comment{color:#505050;display:block;margin-top:.5em;}.info{margin-top:1.5rem;font-size:.8rem;color:#888;}</style></head><body><div class="container"><h1>[ Rate Limit Exceeded ]</h1><pre><span class="key">STATUS</span>   : <span class="value">ACCESS TEMPORARILY BLOCKED (Code: 429)</span>\n<span class="key">REASON</span>   : <span class="value">Too Many Requests.</span>\n<span class="comment">// Anda mengirim terlalu banyak request dalam waktu singkat.</span>\n\n<span class="key">YOUR_IP</span>  : <span class="value">${ip||'Unavailable'}</span>\n<span class="key">DETAILS</span>  :\n  <span class="key">Country</span>  : <span class="value">${ipInfo?.country||'N/A'}</span>\n  <span class="key">City</span>     : <span class="value">${ipInfo?.city||'N/A'}</span>\n  <span class="key">ISP</span>      : <span class="value">${ipInfo?.isp||'N/A'}</span>\n\n<span class="comment">// Aktivitas Anda telah dicatat. Silakan coba lagi setelah beberapa saat.</span></pre><p class="info">Jika Anda merasa ini adalah kesalahan, hubungi administrator.</p></div></body></html>
    `);
};

const ratelimit = kv
  ? new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(parseInt(process.env.RATE_LIMIT_PER_MINUTE || "30"), "60 s"),
      analytics: true,
      prefix: process.env.RATELIMIT_KV_PREFIX || "ratelimit_api",
    })
  : null;

app.use(async (req, res, next) => {
    if (!ratelimit) return next();
    
    const isWebPage = req.path === '/' || req.path.endsWith('.html') || req.path === '/api/endpoint-status';
    if (isWebPage) return next();
    
    const ip = getClientIp(req);
    try {
        const { success, limit, remaining, reset } = await ratelimit.limit(`mw_${ip}`);
        res.setHeader('RateLimit-Limit', limit);
        res.setHeader('RateLimit-Remaining', remaining);
        res.setHeader('RateLimit-Reset', reset);
        
        if (!success) {
            return await limitHandler(req, res);
        }
        next();
    } catch (err) {
        console.error("Rate Limit Error:", err);
        next();
    }
});

app.use((req, res, next) => {
  const reqPath = req.path;
  if (reqPath === '/' || reqPath.endsWith('.html') || reqPath.startsWith('/images/') || reqPath.startsWith('/audio/') || reqPath.startsWith('/admin/')) return next();
  
  let providedApiKey = req.query.apikey || req.headers['x-api-key'];
  let endpointDef = null; 
  let needsKey = false;
  
  if (global.settings?.endpoints) {
      for (const cat in global.settings.endpoints) {
          const found = global.settings.endpoints[cat].find(e => e.path && reqPath === e.path.split('?')[0]);
          if (found) { 
              endpointDef = found; 
              if (endpointDef.path.includes("apikey=")) needsKey = true; 
              break; 
          }
      }
  }

  if (endpointDef) {
    if (needsKey) {
      if (!providedApiKey) return res.status(401).json({ status: false, error: "API key dibutuhkan. Tambahkan ?apikey=KEY_ANDA" });
      if (!global.apikey.includes(providedApiKey)) return res.status(403).json({ status: false, error: "API key tidak valid." });
    } else {
      if (!providedApiKey && global.apikey.length > 0) {
          req.query.apikey = global.apikey[0];
      }
    }
  }
  next();
});

const { GITHUB_USERNAME, GITHUB_REPO, GITHUB_TOKEN, GITHUB_FILE_PATH } = process.env;
const GITHUB_API_URL = GITHUB_USERNAME && GITHUB_REPO && GITHUB_FILE_PATH ? `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}` : null;
const GITHUB_HEADERS = GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': `${process.env.APP_NAME || 'API'}-Server/1.0` } : null;
let githubAdminConfigValid = !!(GITHUB_API_URL && GITHUB_HEADERS);

if(githubAdminConfigValid) console.log(chalk.green("LOG: Fungsi Admin GitHub dimuat."));

async function getGitHubFileSha() {
  if (!githubAdminConfigValid) throw new Error('GITHUB: Konfigurasi API GitHub tidak valid.');
  try {
    const response = await axios.get(GITHUB_API_URL, { headers: GITHUB_HEADERS, timeout: 10000 });
    return response.data.sha;
  } catch (error) {
    if (error.response?.status === 404) { return null; }
    throw error;
  }
}

async function updateGitHubFile(contentArray, commitMessage, sha) {
  if (!githubAdminConfigValid) throw new Error('GITHUB: Konfigurasi API GitHub tidak valid.');
  const contentString = JSON.stringify(contentArray, null, 2);
  const contentBase64 = Buffer.from(contentString).toString('base64');
  const payload = { message: commitMessage, content: contentBase64, sha: sha };
  await axios.put(GITHUB_API_URL, payload, { headers: GITHUB_HEADERS, timeout: 15000 });
  return true;
}

const srcFolder = path.join(__dirname, './src');
console.log("LOG: Memuat rute...");
let totalRoutes = 0;

if (fs.existsSync(srcFolder)) {
    fs.readdirSync(srcFolder).forEach((folderOrFile) => {
        const itemPath = path.join(srcFolder, folderOrFile);
        
        if (fs.statSync(itemPath).isDirectory()) {
             fs.readdirSync(itemPath).forEach(file => {
                 if (file.endsWith('.js')) {
                     try {
                         require(path.join(itemPath, file))(app);
                         totalRoutes++;
                     } catch (e) { console.error(chalk.red(`Gagal muat rute ${file}:`), e.message); }
                 }
             });
        } else if (folderOrFile.endsWith('.js')) {
             if (folderOrFile === 'admin.js') {
                 try {
                    require(itemPath)(app, checkAdminKey, getGitHubFileSha, updateGitHubFile, sendDiscordAlert);
                    console.log(chalk.green("✓ Rute admin.js dimuat."));
                 } catch(e) { console.error(chalk.red("Gagal muat admin.js:"), e.message); }
             } else {
                 try {
                     require(itemPath)(app);
                     totalRoutes++;
                 } catch(e) { console.error(chalk.red(`Gagal muat rute ${folderOrFile}:`), e.message); }
             }
        }
    });
    console.log(chalk.cyan(`-> Total rute dimuat: ${totalRoutes}`));
} else {
    console.warn(chalk.yellow("Folder './src' tidak ditemukan."));
}
const adminRoutePath = path.join(__dirname, 'admin.js');
if (fs.existsSync(adminRoutePath)) {
    try {
        require(adminRoutePath)(app, checkAdminKey, getGitHubFileSha, updateGitHubFile, sendDiscordAlert);
        console.log(chalk.green("✓ Rute admin.js (dari root) berhasil dimuat."));
    } catch(e) {
        console.error(chalk.red("GATAL: Gagal memuat admin.js (dari root):"), e.message);
    }
} else {
    if (!fs.existsSync(path.join(srcFolder, 'admin.js'))) {
        console.warn(chalk.yellow("PERINGATAN: admin.js tidak ditemukan di root ATAU di /src. Rute admin tidak akan berfungsi."));
    }
}
const orderkuotaRoutePath = path.join(__dirname, 'orderkuota.js');
if (fs.existsSync(orderkuotaRoutePath)) {
    try {
        require(orderkuotaRoutePath)(app, console); 
        console.log(chalk.green("✓ Rute orderkuota.js (dari root) berhasil dimuat."));
    } catch(e) {
        console.error(chalk.red("GATAL: Gagal memuat orderkuota.js (dari root):"), e.message);
    }
} else {
    console.warn(chalk.yellow("PERINGATAN: orderkuota.js tidak ditemukan di root. Rute orderkuota tidak akan berfungsi."));
}
const openaiRoutePath = path.join(__dirname, 'openai.js');
if (fs.existsSync(openaiRoutePath)) {
    try {
        require(openaiRoutePath)(app, console); 
        console.log(chalk.green("✓ Rute openai.js (dari root) berhasil dimuat."));
    } catch(e) {
        console.error(chalk.red("GATAL: Gagal memuat openai.js (dari root):"), e.message);
    }
} else {
    console.warn(chalk.yellow("PERINGATAN: openai.js tidak ditemukan di root."));
}
app.post('/api/submit-report', async (req, res) => {
    const ip = getClientIp(req);
    const form = formidable({
        maxFileSize: 5 * 1024 * 1024, 
        allowEmptyFiles: true,
        keepExtensions: true,
        uploadDir: '/tmp',
    });

    try {
        const [fields, files] = await form.parse(req);
        const reportType = fields.reportType?.[0];
        const nama = fields.nama?.[0];
        const teks = fields.teks?.[0];
        
        if (!reportType || !teks || !teks.trim()) {
            return res.status(400).json({status:false, error: "Data tidak lengkap (reportType dan teks wajib diisi)."});
        }

        let imageUrl = null;
        const imageFile = files.reportImage?.[0];
        if (imageFile && imageFile.size > 0) {
            console.log(chalk.blue(`UPLOAD: Menerima file: ${imageFile.originalFilename}, size: ${imageFile.size}`));
            imageUrl = await uploadImageToCloudflare(imageFile.filepath);
            
            fs.unlink(imageFile.filepath, (err) => {
                if (err) console.warn(chalk.yellow(`Gagal hapus file temp: ${imageFile.filepath}`));
            });
        }

        const webhookType = reportType === 'Lapor Error' ? 'report' : 'feature';
        
        sendDiscordAlert(webhookType, { 
            nama, 
            teks, 
            ip, 
            imageUrl
        });
        
        res.status(200).json({ status: true, message: `Terima kasih! ${reportType} terkirim.` });

    } catch (err) {
        console.error(chalk.red(`REPORT PARSE ERROR: ${err.message}`), err);
        if (err.message.includes('maxFileSize')) {
             return res.status(413).json({ status: false, error: "File gambar terlalu besar (Max 5MB)." });
        }
        return res.status(500).json({ status: false, error: "Gagal memproses form data." });
    }
});

app.get('/api/endpoint-status', (req, res) => {
    let staticStatus = {};
    try {
        if (global.settings?.endpoints) {
            for (const category in global.settings.endpoints) {
                if (Array.isArray(global.settings.endpoints[category])) {
                    global.settings.endpoints[category].forEach(endpoint => {
                        if (endpoint && endpoint.path) {
                            staticStatus[endpoint.path.split('?')[0]] = endpoint.status || 'Active';
                        }
                    });
                }
            }
        }
    } catch (e) {}
    res.json({ data: staticStatus });
});

app.get('/api/blacklist-info', async (req, res) => {
    try {
        const bl = await fetchBlacklistAndReturnSet();
        const maskedIPs = Array.from(bl).map(ip => {
            if (ip.includes(':')) return ip.substring(0, 8) + ':****';
            return ip.replace(/\.\d+\.\d+$/, '.xxx.xxx');
        });
        res.status(200).json({ status: true, count: bl.size, data: maskedIPs });
    } catch (e) {
        res.status(500).json({ status: false, error: "Gagal mengambil data." });
    }
});

app.get('/api/my-ip', (req, res) => {
    res.status(200).json({ status: true, ip: getClientIp(req) });
});
app.get('/manage-blacklist', (req, res) => {
    res.sendFile(path.join(__dirname, 'api-page', 'admin.html'), (err) => {
        if(err) res.status(404).send("Halaman admin tidak ditemukan.");
    });
});

app.use((req, res, next) => {
    if (req.path === '/favicon.ico') return res.status(204).end();
    
    if (!req.path.endsWith('.map')) {
        console.warn(chalk.yellow(`404 Not Found: ${req.method} ${req.path}`));
    }
    res.status(404).sendFile(path.join(__dirname, 'api-page', '404.html'));
});

app.use((err, req, res, next) => {
    console.error(chalk.red.bold('\n!!! INTERNAL SERVER ERROR (500) !!!'));
    console.error(chalk.red(`Timestamp: ${new Date().toISOString()}`));
    console.error(err.stack || err.message);

    sendDiscordAlert('error', { 
        ip: getClientIp(req), 
        endpoint: req.originalUrl || req.path, 
        errorMessage: err.message || 'Unknown Error',
        statusCode: 500
    });

    if (res.headersSent) return next(err);
    res.status(500).sendFile(path.join(__dirname, 'api-page', '500.html'));
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(chalk.bgGreen.black(` Server berjalan di http://localhost:${PORT} `));
    });
}

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

console.log("\nLOG: Konfigurasi server selesai.");

module.exports = app;
