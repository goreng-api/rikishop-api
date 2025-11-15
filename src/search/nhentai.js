const { fetch } = require('undici');
const cheerio = require('cheerio');

class nHentai {
    hpage = async function (page) {
        try {
            if (!page) {
                throw new Error('Page diperlukan!');
            }
            let hentaiData = {};
            const response = await fetch(`https://nhentai.net/home?page=${page}`);
            const $ = cheerio.load(await response.text());
            
            $('.container').each((_, list) => {
                const type = $(list).find('h2').text().trim()
                hentaiData[type] = [];
                
                $(list).find('.gallery').each((_, element) => {
                    const cover = $(element).find('img').attr('src') || $(element).find('img').attr('data-src')
                    const title = $(element).find('.caption').text().trim()
                    const url = $(element).find('a.cover').attr('href')
                    
                    hentaiData[type].push({
                        title,
                        cover,
                        url: 'https://nhentai.net' + url,
                        code: url.replace(/\//g, '') // Ambil kode nuklirnya
                    })
                })
            })
            return hentaiData;
        } catch (error) {
            throw new Error(error.message);
        }
    }
    
    search = async function (query, page) {
        try {
            if (!page || !query) {
                throw new Error('Query & Page diperlukan!');
            }
            let hentaiData = [];
            const response = await fetch(`https://nhentai.net/search/?q=${encodeURIComponent(query)}&page=${page}`)
            const $ = cheerio.load(await response.text())
            
            const galleryElements = $('.gallery');
            for (const element of galleryElements) {
                const title = $(element).find('.caption').text().trim();
                const url = $(element).find('a.cover').attr('href');
                const fullUrl = 'https://nhentai.net' + url;
                
                // Optimasi: Jangan fetch detail satu-satu di list search biar cepat
                // Cukup ambil cover thumbnail yang ada
                const cover = $(element).find('img').attr('src') || $(element).find('img').attr('data-src');

                hentaiData.push({ 
                    title, 
                    cover, 
                    url: fullUrl,
                    code: url.replace(/\//g, '')
                });
            }
            return hentaiData;
        } catch (error) {
            throw new Error(error.message);
        }
    }
    
    detail = async function (code) {
        try {
            if (!code) throw new Error('Code/Url diperlukan!');
            
            // Support input berupa full URL atau cuma kode angka
            let url = code;
            if (!code.startsWith('http')) {
                url = `https://nhentai.net/g/${code}/`;
            }

            const response = await fetch(url)
            const htmlText = await response.text();
            const $ = cheerio.load(htmlText);
            
            // Cek jika halaman tidak ditemukan (404)
            if ($('title').text().includes('404')) throw new Error('Doujin tidak ditemukan!');

            const coverElement = $('#cover a img');
            const cover = coverElement.attr('data-src') || coverElement.attr('src');
            
            const info = $('#info');
            
            const hentaiData = {
                title: {
                    main: info.find('h1').text().trim(),
                    japanese: info.find('h2').text().trim()
                },
                id: info.find('h3').contents().not('span').text().trim(),
                tags: info.find('a[href*="/tag/"] span.name').map((_, tag) => $(tag).text().trim()).get(),
                artists: info.find('a[href*="/artist/"] span.name').map((_, tag) => $(tag).text().trim()).get(),
                languages: info.find('a[href*="/language/"] span.name').map((_, tag) => $(tag).text().trim()).get(),
                categories: info.find('a[href*="/category/"] span.name').map((_, tag) => $(tag).text().trim()).get(),
                pages: info.find('a[href*="pages"] span.name').text().trim(),
                uploadDate: info.find('time').text().trim(),
                cover,
                url: url
            }
            
            // Ambil images (halaman baca)
            const images = [];
            $('.thumb-container').each((_, el) => {
                const imgElement = $(el).find('img');
                const thumbSrc = imgElement.attr('data-src') || imgElement.attr('src');
                // Convert thumbnail URL ke gallery URL (high res biasanya beda domain/path)
                // Contoh thumb: https://t.nhentai.net/galleries/12345/1t.jpg
                // Contoh full: https://i.nhentai.net/galleries/12345/1.jpg
                if (thumbSrc) {
                    const fullSrc = thumbSrc.replace('t.nhentai.net', 'i.nhentai.net').replace('t.jpg', '.jpg').replace('t.png', '.png');
                    images.push(fullSrc);
                }
            });
            
            hentaiData.images = images;
            
            return hentaiData;
        } catch (error) {
            throw new Error(error.message);
        }
    }
}

// --- SETUP ROUTING API ---
module.exports = function(app) {
    const nh = new nHentai();

    // 1. Search Doujin
    app.get('/search/nhentai', async (req, res) => {
        const { query, page = 1, apikey } = req.query;
        if (!global.apikey.includes(apikey)) return res.status(403).json({ status: false, error: 'Apikey invalid' });
        if (!query) return res.status(400).json({ status: false, error: 'Query required' });

        try {
            const result = await nh.search(query, page);
            res.json({ status: true, result });
        } catch (e) {
            res.status(500).json({ status: false, error: e.message });
        }
    });

    // 2. Detail Doujin (Baca)
    app.get('/search/nhentai-detail', async (req, res) => {
        const { code, apikey } = req.query;
        if (!global.apikey.includes(apikey)) return res.status(403).json({ status: false, error: 'Apikey invalid' });
        if (!code) return res.status(400).json({ status: false, error: 'Code required (contoh: 177013)' });

        try {
            const result = await nh.detail(code);
            res.json({ status: true, result });
        } catch (e) {
            res.status(500).json({ status: false, error: e.message });
        }
    });
    
    // 3. Home Page (Latest/Popular)
    app.get('/search/nhentai-home', async (req, res) => {
        const { page = 1, apikey } = req.query;
        if (!global.apikey.includes(apikey)) return res.status(403).json({ status: false, error: 'Apikey invalid' });

        try {
            const result = await nh.hpage(page);
            res.json({ status: true, result });
        } catch (e) {
            res.status(500).json({ status: false, error: e.message });
        }
    });
};

