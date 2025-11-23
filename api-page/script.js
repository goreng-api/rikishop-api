// --- Variabel Global ---
let endpointStatuses = {};
let lastFetchedUrl = "";
let currentEndpointMethod = "GET"; 
let settings = {};
let isApiInitialized = false; 

// --- Fungsi Utilitas ---
function highlightJSON(json) { try { if (typeof json != 'string') { json = JSON.stringify(json, null, 2); } json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(match) { let cls = 'json-number'; if (/^"/.test(match)) { cls = /:$/.test(match) ? 'json-key' : 'json-string'; } else if (/true|false/.test(match)) { cls = 'json-boolean'; } else if (/null/.test(match)) { cls = 'json-null'; } return '<span class="' + cls + '">' + match + '</span>'; }); } catch (e) { console.error("Error highlighting JSON:", e); return '<span class="json-string">' + String(json).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>'; } }
let notificationTimeout; function showNotification(message, type = 'info', duration = 3000) { const n = document.getElementById('notification'); if (!n) return; clearTimeout(notificationTimeout); n.textContent = message; n.className = ''; n.classList.add('notification', type, 'show'); notificationTimeout = setTimeout(() => { n.classList.remove('show'); }, duration); }
function copyToClipboard(textToCopy, buttonElement, successMessage = "Copied!", isCopyUrl = false) { const originalIconHTML = buttonElement.innerHTML; const successIconHTML = `<i class="fas fa-check"></i> ${successMessage}`; const failIconHTML = '<i class="fas fa-times"></i> Copy Failed'; const showFeedback = (success) => { buttonElement.innerHTML = success ? successIconHTML : failIconHTML; showNotification(success ? successMessage : "Gagal menyalin ke clipboard!", success ? 'success' : 'error'); setTimeout(() => { buttonElement.innerHTML = originalIconHTML; }, 2000); }; if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(textToCopy).then(() => showFeedback(true)).catch(err => { console.error("Modern copy failed:", err); fallbackCopy(textToCopy, showFeedback); }); } else { console.warn("Using fallback copy method."); fallbackCopy(textToCopy, showFeedback); } }
function fallbackCopy(text, callback) { try { const ta = document.createElement("textarea"); ta.value = text; Object.assign(ta.style, { position: "fixed", top: "-9999px", left: "-9999px", opacity: "0", width: "1px", height:"1px" }); document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, 99999); const ok = document.execCommand('copy'); document.body.removeChild(ta); callback(ok); } catch (err) { console.error("Fallback copy failed:", err); callback(false); } }

// --- Polling Status API ---
async function updateStatuses() { try { const response = await fetch('/api/endpoint-status'); if (!response.ok) { return; } const data = await response.json(); if (data?.data) { endpointStatuses = data.data; const apiListDiv = document.getElementById('api-list'); if (!apiListDiv) return; requestAnimationFrame(() => { for (const path in endpointStatuses) { const status = endpointStatuses[path]; const statusSpan = apiListDiv.querySelector(`.status[data-path="${path}"]`); if (statusSpan && statusSpan.textContent !== status) { statusSpan.textContent = status; statusSpan.className = 'status'; const lowerStatus = status.toLowerCase(); if (lowerStatus.includes("error") || lowerStatus.includes("danger") || lowerStatus.includes("down")) statusSpan.classList.add('danger'); else if (lowerStatus.includes("warning") || lowerStatus.includes("beta") || lowerStatus.includes("maintenance")) statusSpan.classList.add('warning'); } } }); } } catch (e) { } }
function startStatusPolling() { setTimeout(updateStatuses, 1500); setInterval(updateStatuses, 45000); }

// --- Filter Kartu API ---
function filterApiCards() { const searchInput = document.getElementById('apiSearchInput'); const apiListContainer = document.getElementById('api-list'); const noResultsMsg = document.getElementById('noResultsMessage'); if (!searchInput || !apiListContainer || !noResultsMsg) return; const searchTerm = searchInput.value.toLowerCase().trim(); const cards = apiListContainer.querySelectorAll('.api-card'); let visibleCount = 0; cards.forEach(card => { const titleElement = card.querySelector('.api-info h3'); const descElement = card.querySelector('.api-info p'); const titleText = titleElement ? titleElement.textContent.toLowerCase().replace(/new|fix/g, '').trim() : ''; const descText = descElement ? descElement.textContent.toLowerCase() : ''; const isMatch = searchTerm === '' || titleText.includes(searchTerm) || descText.includes(searchTerm); card.style.display = isMatch ? 'flex' : 'none'; if(isMatch) visibleCount++; }); noResultsMsg.style.display = (visibleCount === 0 && searchTerm !== '') ? 'block' : 'none'; }

// --- Widget Tanggal & Waktu ---
function updateDateTime() {
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jum\'at', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const dayName = days[now.getDay()];
    const date = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/\./g, ':');
    const dayEl = document.getElementById('day'); const dateEl = document.getElementById('date'); const timeEl = document.getElementById('time');
    if (dayEl) dayEl.textContent = dayName; if (dateEl) dateEl.textContent = `${date} ${monthName} ${year}`; if (timeEl) timeEl.textContent = time;
}

// --- Inisialisasi Halaman API Utama ---
async function initializeMainApiPage() {
    if (isApiInitialized) return; 
    isApiInitialized = true;

    const preloader = document.getElementById('preloader');
    const body = document.body;
    
    // 1. Terapkan Tema
    const themeToggleBtn = document.getElementById("theme-toggle-btn"); 
    const applyTheme = (theme) => { 
        body.setAttribute("data-theme", theme); localStorage.setItem("theme", theme); 
        if (themeToggleBtn) themeToggleBtn.innerHTML = theme === "dark" ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>'; 
        if (theme === "dark") { body.style.backgroundImage = 'none'; body.style.background = 'linear-gradient(135deg, var(--darker), var(--dark))'; } 
        else { body.style.backgroundImage = "url('/images/background.jpg')"; body.style.backgroundSize = "cover"; body.style.backgroundPosition = "center center"; body.style.backgroundAttachment = "fixed"; body.style.backgroundRepeat = "no-repeat"; }
    }; 
    const savedTheme = localStorage.getItem("theme"); const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? "dark" : "light")); 
    if (themeToggleBtn) { themeToggleBtn.addEventListener("click", () => applyTheme(body.getAttribute("data-theme") === "dark" ? "light" : "dark")); }

    // 2. Musik & Donasi
    const donationModal = document.getElementById("donationModal"); const continueBtn = document.getElementById("continueBtn"); const bgMusic = document.getElementById('backgroundMusic'); const musicFab = document.getElementById('musicFabContainer'); const fabToggle = document.getElementById('fabToggleBtn'); const musicControls = document.getElementById('musicControlsExpanded'); const playPause = document.getElementById('playPauseBtn'); const muteBtn = document.getElementById('muteBtn'); const volume = document.getElementById('volumeSlider'); let musicStarted = false; 
    const tryStartMusic = () => { if (bgMusic && !musicStarted) { bgMusic.volume = parseFloat(localStorage.getItem('musicVolume') || volume?.value || 1); if (localStorage.getItem('musicMuted') === 'true') { bgMusic.muted = true; if(muteBtn) muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>'; } else { bgMusic.muted = false; if(muteBtn) muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>'; } if (volume) volume.value = bgMusic.volume; bgMusic.play().then(() => { if(musicFab) musicFab.style.display = 'block'; musicStarted = true; }).catch(e => { if(musicFab) musicFab.style.display = 'block'; musicStarted = true; console.warn("Autoplay musik gagal:", e.message); }); } }; 
    if (donationModal) { setTimeout(() => donationModal.classList.add("active"), 500); }
    if (continueBtn && donationModal) { continueBtn.addEventListener("click", () => { donationModal.classList.remove("active"); }); }
    if (fabToggle && musicControls) { fabToggle.addEventListener('click', () => { if (!musicStarted) tryStartMusic(); const isExpanded = musicControls.classList.toggle('active'); fabToggle.innerHTML = isExpanded ? '<i class="fas fa-times"></i>' : '<i class="fas fa-music"></i>'; }); } 
    if (playPause && bgMusic) { playPause.addEventListener('click', () => { if (!musicStarted) { musicStarted = true; if(musicFab) musicFab.style.display = 'block'; } if (bgMusic.paused) { bgMusic.play().catch(console.error); } else { bgMusic.pause(); } }); } 
    if (muteBtn && bgMusic) { muteBtn.addEventListener('click', () => { if (musicStarted) { bgMusic.muted = !bgMusic.muted; muteBtn.innerHTML = bgMusic.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>'; localStorage.setItem('musicMuted', bgMusic.muted); if (!bgMusic.muted && bgMusic.volume === 0 && volume) { volume.value = 0.1; bgMusic.volume = 0.1; localStorage.setItem('musicVolume', 0.1); } } else { localStorage.setItem('musicMuted', 'true'); muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>'; tryStartMusic(); } }); } 
    if (volume && bgMusic) { volume.addEventListener('input', (e) => { if (!musicStarted) tryStartMusic(); const nv = parseFloat(e.target.value); bgMusic.volume = nv; localStorage.setItem('musicVolume', nv); if (nv === 0 && !bgMusic.muted) { bgMusic.muted = true; if(muteBtn) muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>'; localStorage.setItem('musicMuted', true); } else if (nv > 0 && bgMusic.muted) { bgMusic.muted = false; if(muteBtn) muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>'; localStorage.setItem('musicMuted', false); } }); } 
    if (bgMusic && playPause) { bgMusic.onplay = () => playPause.innerHTML = '<i class="fas fa-pause"></i>'; bgMusic.onpause = () => playPause.innerHTML = '<i class="fas fa-play"></i>'; bgMusic.onended = () => playPause.innerHTML = '<i class="fas fa-play"></i>'; }
    if (musicFab) musicFab.style.display = 'block'; 

    const qrImg = document.getElementById("donationQR"); const qrBox = document.getElementById("qrLightbox"); const lightImg = document.getElementById("lightboxImage"); if (qrImg && qrBox && lightImg) { qrImg.addEventListener("click", () => { lightImg.src = qrImg.src; qrBox.classList.add("active"); }); qrBox.addEventListener("click", (e) => { if (e.target === qrBox) qrBox.classList.remove("active"); }); }

    // 4. Load Settings & Render API
    const tabsContainer = document.getElementById("tabs"); 
    const apiList = document.getElementById("api-list"); 
    let currentEndpointPath = ""; 
    let currentEndpointRequiresApiKey = false;
    const apiPreloader = document.getElementById('preloader');
    
    try { 
        const response = await fetch("/settings.json"); 
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); 
        settings = await response.json(); 
    } catch (e) { 
        console.error("Gagal memuat settings.json:", e); 
        showNotification("Gagal memuat konfigurasi API!", "error", 5000); 
        if (apiList) apiList.innerHTML = "<p style='color: var(--danger-text); text-align: center;'>Gagal memuat konfigurasi. Coba refresh.</p>"; 
    } finally {
        if (apiPreloader) { setTimeout(() => { apiPreloader.classList.add('hidden'); }, 200); }
    }
    
    if (!settings || Object.keys(settings).length === 0) return;

    const apis = settings.endpoints || {};
    const apiTitleEl = document.getElementById("apiTitle"); if (apiTitleEl) apiTitleEl.innerHTML = `${settings.apititle || "API Docs"} <span class="version-label">v1.1.1</span>`;
    const setC = (id, p, v, isHref=false) => { const el = document.getElementById(id); if (el) { if(isHref){if(v) el.href=v; else el.style.display='none';} else el[p] = v || ''; }};
    setC("page", "textContent", settings.pagetitle || settings.apititle || "API Docs"); 
    setC("credits", "textContent", `© ${new Date().getFullYear()} By ${settings.creator || "Dev"}`);
    setC("githubLink", "href", settings.github, true); setC("whatsappLink", "href", settings.whatsapp, true); setC("youtubeLink", "href", settings.youtube, true);
    setC("aboutApiName", "textContent", settings.apititle || "API"); setC("aboutApiCreator", "textContent", "By " + (settings.creator || "Dev"));
    setC("sidebarWaLink2", "href", settings.whatsapp, true);

    const renderAPIs = (category = 'all') => { 
        if (!apiList) return; 
        apiList.innerHTML = ""; 
        let eps = []; 
        const allEps = Object.values(apis).flat().filter(Boolean); 
        if (category === 'all') eps = allEps; 
        else if (apis[category]?.length) eps = apis[category].filter(Boolean); 
        if (eps.length === 0 && category !== 'all') { apiList.innerHTML = `<p style='color: var(--gray); text-align: center; grid-column: 1 / -1;'>Kategori '${category}' kosong.</p>`; return; } 
        if (allEps.length === 0) { apiList.innerHTML = `<p style='color: var(--gray); text-align: center; grid-column: 1 / -1;'>Belum ada endpoint.</p>`; return; } 
        
        requestAnimationFrame(() => { 
            eps.forEach((api, index) => { 
                if (!api?.path || !api?.name) { console.warn("Skipping invalid endpoint:", api); return;} 
                const card = document.createElement("div"); 
                card.className = "api-card fade-in"; 
                card.style.animationDelay = `${index * 0.03}s`; 
                
                let labelHtml = ''; let isLabelExpired = false;
                if (api.dateAdded) { try { if ((Date.now() - new Date(api.dateAdded).getTime()) / 36e5 > 24) { isLabelExpired = true; } } catch(e) { isLabelExpired = true; } } else { isLabelExpired = true; }
                const apiLabel = api.label ? api.label.toUpperCase().trim() : '';
                if (!isLabelExpired && (apiLabel === 'NEW' || apiLabel === 'FIX')) { let labelStyle = ''; if (apiLabel === 'FIX') { labelStyle = 'background-color: var(--success); animation: pulse-success 1.5s infinite;'; } labelHtml = `<span class="new-label" style="${labelStyle}">${apiLabel}</span>`; }

                const basePath = api.path.split('?')[0]; 
                const liveStatus = endpointStatuses[basePath] || api.status || 'Active'; 
                let sC = ""; const lS = liveStatus.toLowerCase(); 
                if (lS.includes("error") || lS.includes("danger") || lS.includes("down")) sC = "danger"; 
                else if (lS.includes("warning") || lS.includes("beta") || lS.includes("maintenance")) sC = "warning"; 
                
                const method = api.method || "GET";

                card.innerHTML = `<div class="api-info"><h3><span class="api-name-text">${api.name}</span> ${labelHtml}</h3><p>${api.desc || ''}</p><span class="status ${sC}" data-path="${basePath}">${liveStatus}</span></div><button class="play-button" data-endpoint="${api.path}" data-apiname="${api.name}" data-apidesc="${api.desc||''}" data-method="${method}"><i class="fa-solid fa-play"></i> Try it now</button>`; 
                apiList.appendChild(card); 
            }); 
            filterApiCards(); 
        }); 
    };
    
    if (tabsContainer && apiList && Object.keys(apis).length > 0) { 
        tabsContainer.innerHTML = ''; const allBtn = document.createElement("button"); allBtn.className = "tab active"; allBtn.dataset.tab = "all"; allBtn.innerText = "All"; tabsContainer.appendChild(allBtn); 
        Object.keys(apis).forEach(k => { const btn = document.createElement("button"); btn.className = "tab"; btn.dataset.tab = k; btn.innerText = k[0].toUpperCase() + k.slice(1); tabsContainer.appendChild(btn); }); 
        renderAPIs("all"); 
    } else if (apiList) { apiList.innerHTML = "<p style='color: var(--gray); text-align: center; grid-column: 1 / -1;'>No endpoints found.</p>"; }

    // 5. Event Listener & Modal Logic
    const openApiModal = (playBtn) => {
        const endpointPath = playBtn.dataset.endpoint;
        const apiName = playBtn.dataset.apiname;
        let apiDesc = playBtn.dataset.apidesc || '';
        const apiMethod = playBtn.dataset.method || "GET"; 
        
        const selectConfigs = {}; 
        const fileConfigs = {}; 
        
        const selectRegex = /\[select:([^|\]]+)\|([^\]]+)\]/g;
        const fileRegex = /\[input:file\|([^\]]+)\]/g; 
        
        let match;
        while ((match = selectRegex.exec(apiDesc)) !== null) {
            const paramName = match[1].trim();
            const options = match[2].split(',').map(opt => opt.trim());
            selectConfigs[paramName.toLowerCase()] = options;
        }
        while ((match = fileRegex.exec(apiDesc)) !== null) {
            const paramName = match[1].trim();
            fileConfigs[paramName.toLowerCase()] = true;
        }

        const cleanDesc = apiDesc.replace(selectRegex, '').replace(fileRegex, '').trim();

        const modal = document.getElementById("apiResponseModal");
        const modalTitle = document.getElementById("modalApiName");
        const modalDesc = document.getElementById("modalApiDesc");
        const form = document.getElementById("paramForm");
        const submitBtn = document.getElementById("submitParamBtn");
        const copySection = modal.querySelector(".copy-section");
        const copyTextEl = document.getElementById("copyEndpointText");
        const respEl = document.getElementById("apiResponseContent");
        const loadEl = document.getElementById("apiResponseLoading");
        const retryBtn = document.getElementById("retryRequestBtn");
        const copyRespBtn = document.getElementById("copyResponseBtn");
        if (!modal) return;

        respEl.innerHTML = ""; respEl.classList.add("d-none"); loadEl.style.display = "none"; form.innerHTML = ""; form.style.display = "block"; submitBtn.style.display = "none"; copyRespBtn.classList.add("d-none"); retryBtn.classList.add('d-none'); retryBtn.removeAttribute('data-action'); 
        
        // [UPDATE] Tampilkan Copy Section dari awal (karena user ingin melihat link default)
        copySection.classList.add("active"); 
        
        lastFetchedUrl = "";
        currentEndpointPath = endpointPath;
        currentEndpointMethod = apiMethod;
        currentEndpointRequiresApiKey = endpointPath.includes("apikey=");
        
        modalTitle.innerText = apiName || "API Endpoint";
        modalDesc.innerText = cleanDesc || " "; 

        if (endpointPath === '/api/blacklist-info') {
            form.style.display = 'none'; submitBtn.style.display = 'none'; fetchAndDisplayBlacklistInfo(); 
        }
        else {
            const pathParts = endpointPath.split('?');
            const basePath = pathParts[0];
            const queryParams = pathParts[1] ? pathParts[1].split('&') : [];
            
            const allParamKeys = new Set();
            queryParams.forEach(p => { if(p) allParamKeys.add(p.split('=')[0].trim()); });
            Object.keys(fileConfigs).forEach(k => allParamKeys.add(k));
            
            let hasQueryParams = false;
            let hasApiKeyParamInPath = false;

            if (allParamKeys.size > 0 || currentEndpointRequiresApiKey) {
                hasQueryParams = true;

                allParamKeys.forEach(keyRaw => {
                    if(!keyRaw) return;
                    const key = keyRaw.trim();
                    const lowerKey = key.toLowerCase();
                    
                    // Parsing Default Value
                    const urlParam = queryParams.find(p => p.startsWith(key + '='));
                    let defaultValue = "";
                    if (urlParam) {
                         defaultValue = urlParam.substring(key.length + 1);
                         try { defaultValue = decodeURIComponent(defaultValue); } catch(e){}
                    }
                    
                    const label = key.charAt(0).toUpperCase() + key.slice(1);
                    const isApiKey = lowerKey === 'apikey';
                    if (isApiKey) hasApiKeyParamInPath = true;
                    const isRequired = !isApiKey;

                    if (fileConfigs[lowerKey]) {
                        form.innerHTML += `<label for="${key}">${label} (Upload File)</label><input type="file" id="${key}" name="${key}" style="width: 100%; padding: 12px 14px; border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--light); margin-bottom: 1rem;" ${isRequired ? 'required' : ''} />`;
                    }
                    else if (selectConfigs[lowerKey]) {
                        const options = selectConfigs[lowerKey];
                        let optionsHtml = options.map(opt => `<option value="${opt}" ${opt === defaultValue ? 'selected' : ''}>${opt.toUpperCase()}</option>`).join('');
                        form.innerHTML += `<label for="${key}">${label} (Pilih Opsi)</label><select id="${key}" name="${key}" style="width: 100%; padding: 12px 14px; border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--light); margin-bottom: 1rem; font-size: 0.95rem; font-family: inherit;">${optionsHtml}</select>`;
                    } 
                    else {
                        const safeValue = defaultValue.replace(/"/g, "&quot;");
                        form.innerHTML += `<label for="${key}">${label}${isRequired ? ' (Wajib)' : ''}</label><input type="text" id="${key}" name="${key}" value="${safeValue}" placeholder="Masukkan ${label}..." ${isRequired ? 'required' : ''} />`;
                    }
                });

                if (currentEndpointRequiresApiKey && !hasApiKeyParamInPath) {
                     form.innerHTML += `<label for="apikey">Apikey</label><input type="text" id="apikey" name="apikey" value="" placeholder="Masukkan Apikey..." required />`;
                     hasQueryParams = true; 
                }
            
            } else if (currentEndpointRequiresApiKey) {
                 form.innerHTML += `<label for="apikey">Apikey</label><input type="text" id="apikey" name="apikey" value="" placeholder="Masukkan Apikey..." required />`;
                 hasQueryParams = true; 
            }

            if (hasQueryParams) { 
                submitBtn.innerHTML = apiMethod === "POST" ? '<i class="fa-solid fa-cloud-arrow-up"></i> Upload / Submit' : '<i class="fa-solid fa-paper-plane"></i> Submit'; 
                submitBtn.style.display = "flex"; 
            } else { 
                submitBtn.innerHTML = '<i class="fa-solid fa-play"></i> Try it'; 
                submitBtn.style.display = "flex"; 
            }
            
            // [FITUR BARU] Live URL Updater
            // 1. Fungsi untuk update link di atas berdasarkan input
            const updateTopBox = () => {
                let params = [];
                const inputs = form.querySelectorAll("input, select"); 
                inputs.forEach(i => {
                    if (i.type !== 'file' && (i.value || i.required)) { // Abaikan file
                        params.push(`${encodeURIComponent(i.name)}=${encodeURIComponent(i.value)}`);
                    }
                });
                
                const baseUrl = currentEndpointPath.split('?')[0];
                const queryString = params.length > 0 ? `?${params.join('&')}` : '';
                copyTextEl.innerText = window.location.origin + baseUrl + queryString;
            };

            // 2. Jalankan sekali saat modal buka (biar langsung muncul defaultnya)
            updateTopBox();

            // 3. Pasang Event Listener ke semua input biar realtime update
            const allInputs = form.querySelectorAll("input, select");
            allInputs.forEach(input => {
                input.addEventListener('input', updateTopBox);
                input.addEventListener('change', updateTopBox);
            });
        }
        modal.classList.add("active");
    };

    async function fetchAPI(url, options = {}) {
        const fullURL = url.startsWith('/') ? window.location.origin + url : url;
        const respEl = document.getElementById("apiResponseContent");
        const loadEl = document.getElementById("apiResponseLoading");
        const copyRespBtn = document.getElementById("copyResponseBtn");
        const retryBtn = document.getElementById("retryRequestBtn");
        
        if (!respEl || !loadEl || !copyRespBtn || !retryBtn) return;
        
        loadEl.style.display = "block"; respEl.classList.add("d-none"); respEl.className = 'd-none'; copyRespBtn.classList.add("d-none"); retryBtn.classList.add('d-none'); respEl.innerHTML = "";
        
        try {
            const response = await fetch(fullURL, options);
            
            loadEl.style.display = "none"; let hasContent = false; const contentType = response.headers.get("content-type");
            if (!response.ok) { let eBody = `HTTP error! ${response.status} ${response.statusText}`; try { const eTxt = await response.text(); try { const eJson = JSON.parse(eTxt); eBody = eJson.error || eJson.message || JSON.stringify(eJson, null, 2); } catch { eBody = eTxt.substring(0, 500); } } catch {} throw new Error(eBody); }
            
            if (contentType?.includes("application/json")) { const data = await response.json(); respEl.innerHTML = highlightJSON(data); hasContent = true; }
            else if (contentType?.startsWith("image/")) { const blob = await response.blob(); const imgUrl = URL.createObjectURL(blob); const ext = contentType.split('/')[1]?.split(';')[0] || 'png'; respEl.innerHTML = `<img src="${imgUrl}" alt="API Img" style="max-width:100%;max-height:300px;border-radius:4px;display:block;margin:auto;" /><a href="${imgUrl}" download="img.${ext}" style="display:block;text-align:center;margin-top:10px;color:var(--primary);">Download Image</a>`; hasContent = true; }
            else { const text = await response.text(); try { respEl.innerHTML = highlightJSON(JSON.parse(text)); hasContent = true; } catch { const escTxt = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); respEl.textContent = escTxt.substring(0, 3000); if(text.trim()) hasContent = true; } }
            
            respEl.classList.remove("d-none"); if(hasContent) { copyRespBtn.classList.remove("d-none"); copyRespBtn.innerHTML = '<i class="far fa-copy"></i> Copy Response'; } retryBtn.classList.remove('d-none');
        
        } catch (err) { 
            loadEl.style.display = "none"; respEl.classList.remove("d-none"); respEl.classList.add('error-text'); 
            const errMsg = err.message || "Request failed."; respEl.textContent = "Fetch Error:\n" + errMsg; 
            copyRespBtn.classList.remove("d-none"); copyRespBtn.innerHTML = '<i class="far fa-copy"></i> Copy Error'; retryBtn.classList.remove('d-none'); 
            showNotification("Request Failed: " + errMsg.substring(0, 100), 'error', 4000); console.error("Fetch API Error:", err); 
        }
    }

    const submitParamBtn = document.getElementById("submitParamBtn"); if (submitParamBtn) submitParamBtn.addEventListener("click", submitParams);
    
    function submitParams() { 
        const form = document.getElementById("paramForm"); 
        if(!form) return; 
        
        const akInp = form.querySelector('input[name="apikey"]'); 
        if (currentEndpointRequiresApiKey && akInp && !akInp.value.trim()) { showNotification("API Key required!", 'error'); akInp.focus(); return; } 
        if (form.innerHTML && !form.checkValidity()) { const inv = form.querySelector(':invalid'); if (inv) inv.focus(); return; } 
        
        form.style.display = "none"; 
        const sBtn = document.getElementById("submitParamBtn"); if(sBtn) sBtn.style.display = "none"; 
        const rEl = document.getElementById("apiResponseContent"); if(rEl) {rEl.innerHTML = ""; rEl.classList.add("d-none");} 
        const cpBtn = document.getElementById("copyResponseBtn"); if(cpBtn) cpBtn.classList.add("d-none"); 
        const ldEl = document.getElementById("apiResponseLoading"); if(ldEl) ldEl.style.display = "block"; 
        const rtBtn = document.getElementById("retryRequestBtn"); if(rtBtn) rtBtn.classList.add('d-none'); 

        const basePath = currentEndpointPath.split("?")[0];
        
        if (currentEndpointMethod === "POST") {
            const formData = new FormData(form);
            let urlWithKey = basePath;
            if (akInp && akInp.value) {
                urlWithKey += `?apikey=${encodeURIComponent(akInp.value)}`;
                formData.delete('apikey'); 
            }
            
            // URL untuk fetch (bukan display)
            lastFetchedUrl = urlWithKey; 
            fetchAPI(urlWithKey, {
                method: "POST",
                body: formData
            });

        } else {
            // GET biasa, ambil URL dari kotak atas (karena sudah live update)
            const copyTextEl = document.getElementById("copyEndpointText");
            let finalURL = copyTextEl ? copyTextEl.innerText : basePath;
            
            lastFetchedUrl = finalURL; 
            fetchAPI(finalURL); 
        }
    }

    async function fetchAndDisplayBlacklistInfo() { const respEl=document.getElementById("apiResponseContent"),loadEl=document.getElementById("apiResponseLoading"),copyRespBtn=document.getElementById("copyResponseBtn"),retryBtn=document.getElementById("retryRequestBtn"),modal=document.getElementById("apiResponseModal");if(!modal||!respEl||!loadEl||!copyRespBtn||!retryBtn)return;loadEl.style.display="block";respEl.classList.add("d-none");respEl.innerHTML='';respEl.className='';respEl.classList.add('d-none','blacklist-info');try{const blacklistResponse=await fetch('/api/blacklist-info');if(!blacklistResponse.ok)throw new Error(`Gagal memuat blacklist: ${blacklistResponse.statusText}`);const blacklistResult=await blacklistResponse.json();if(!blacklistResult.status||!Array.isArray(blacklistResult.data))throw new Error("Format data blacklist tidak valid.");let currentUserIp='Gagal mendapatkan IP Anda.';try{const ipResponse=await fetch('/api/my-ip');if(ipResponse.ok){const ipResult=await ipResponse.json();if(ipResult.status&&ipResult.ip)currentUserIp=ipResult.ip}}catch(ipError){console.warn("Gagal mengambil IP pengguna:",ipError)}let outputHtml=`<span class="user-ip-label">IP Anda Saat Ini:</span> <span class="user-ip-value">${currentUserIp}</span>\n<hr>\n`;outputHtml+=`<span class="list-title">Daftar IP Diblokir (${blacklistResult.data.length}):</span>\n\n`;if(blacklistResult.data.length>0){outputHtml+=blacklistResult.data.map(ip=>String(ip).replace(/</g,"&lt;").replace(/>/g,"&gt;")).join('\n')}else{outputHtml+='<span class="empty-list">(Tidak ada IP yang diblokir saat ini)</span>'}respEl.innerHTML=outputHtml;respEl.classList.remove("d-none");copyRespBtn.classList.remove("d-none");copyRespBtn.innerHTML='<i class="far fa-copy"></i> Copy List';retryBtn.classList.remove('d-none')}catch(err){console.error("Error fetchAndDisplayBlacklistInfo:",err);respEl.innerHTML=`Gagal memuat informasi:\n${err.message}`;respEl.classList.remove("d-none");respEl.classList.add('error-text');copyRespBtn.classList.remove("d-none");copyRespBtn.innerHTML='<i class="far fa-copy"></i> Copy Error';retryBtn.classList.remove('d-none');showNotification("Gagal memuat info blacklist.","error")}finally{loadEl.style.display="none"}}

    const mainApiPageEl = document.getElementById('main-api-page'); if (mainApiPageEl) { mainApiPageEl.addEventListener("click", (e) => { const playBtn = e.target.closest(".play-button:not(.btn-secondary):not(#continueBtn):not(#retryRequestBtn):not(#docs-page-button)"); if (playBtn && playBtn.closest('.api-card')) openApiModal(playBtn); const copyUrlBtn = e.target.closest(".copy-section .copy-button"); if (copyUrlBtn) { const txt = document.getElementById("copyEndpointText")?.innerText; if(txt) copyToClipboard(txt, copyUrlBtn, "URL Copied!", true); } const copyRespBtnEl = e.target.closest("#copyResponseBtn"); if (copyRespBtnEl) { const respEl = document.getElementById("apiResponseContent"); if (!respEl) return; let txt = ""; let fb = "Copied!"; const img = respEl.querySelector('img'); if (img) { txt = img.src; fb = "URL Copied!"; } else { txt = respEl.textContent || respEl.innerText; try { txt = JSON.stringify(JSON.parse(txt), null, 2); } catch(err){} } if (txt) copyToClipboard(txt, copyRespBtnEl, fb, false); else showNotification("No response.", "warning"); } if (e.target.classList.contains("tab")) { document.querySelectorAll(".tab").forEach(t => t.classList.remove("active")); e.target.classList.add("active"); renderAPIs(e.target.dataset.tab); } const retryBtn = e.target.closest("#retryRequestBtn"); if (retryBtn) { if (retryBtn.getAttribute('data-action') === 'fetchBlacklist') { fetchAndDisplayBlacklistInfo(); } else { const formEl = document.getElementById("paramForm"); const submitBtnEl = document.getElementById("submitParamBtn"); const respEl = document.getElementById("apiResponseContent"); const copyRespBtnEl = document.getElementById("copyResponseBtn"); const loadEl = document.getElementById("apiResponseLoading"); if(respEl) { respEl.innerHTML = ""; respEl.classList.add("d-none"); respEl.className='d-none';} if(copyRespBtnEl) copyRespBtnEl.classList.add("d-none"); if(loadEl) loadEl.style.display = "none"; retryBtn.classList.add('d-none'); if(formEl) formEl.style.display = "block"; if(submitBtnEl) submitBtnEl.style.display = "flex"; } } }); }

    const reportModal = document.getElementById("reportModal"); const reportForm = document.getElementById("reportForm"); const aboutApiModal = document.getElementById("aboutApiModal"); const aboutApiBtn = document.getElementById("aboutApiBtn"); function openModal(modalId, title = null, typeVal = null) { const modal = document.getElementById(modalId); if(!modal) return; if(modalId === 'reportModal' && title && typeVal) { const mTitle = document.getElementById("reportModalTitle"); if(mTitle) mTitle.textContent = title; const rType = document.getElementById("reportType"); if(rType) rType.value = typeVal; const sBtn = document.getElementById("submitReportBtn"); if(sBtn) { sBtn.disabled = false; sBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim';} if(reportForm) reportForm.reset(); } modal.classList.add("active"); } const reportErrorBtn = document.getElementById("reportErrorBtn"); if(reportErrorBtn) reportErrorBtn.addEventListener("click", () => openModal("reportModal", "Lapor Error", "Lapor Error")); const requestFeatureBtn = document.getElementById("requestFeatureBtn"); if(requestFeatureBtn) requestFeatureBtn.addEventListener("click", () => openModal("reportModal", "Request Fitur", "Request Fitur")); if(aboutApiBtn) aboutApiBtn.addEventListener("click", () => openModal("aboutApiModal")); if (reportForm) { reportForm.addEventListener("submit", async (e) => { e.preventDefault(); const submitBtn = document.getElementById("submitReportBtn"); if (!submitBtn) return; const formData = new FormData(reportForm); const teks = formData.get('teks'); if (!teks || !teks.trim()) { showNotification("Teks wajib diisi.", "error"); const ta = document.getElementById("reportText"); if(ta) ta.focus(); return; } const imageFile = formData.get('reportImage'); if (imageFile && imageFile.size > (5 * 1024 * 1024)) { showNotification("File gambar terlalu besar (Max 5MB).", "error"); return; } submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...'; const url = `/api/submit-report`; try { const response = await fetch(url, { method: 'POST', body: formData }); const result = await response.json(); if (!response.ok) throw new Error(result.error || `Error: ${response.status}`); const reportType = formData.get('reportType') || 'Laporan'; showNotification(result.message || `${reportType} sent!`, 'success'); if(reportModal) reportModal.classList.remove('active'); reportForm.reset(); } catch (err) { console.error("Report failed:", err); showNotification(err.message || "Gagal mengirim laporan.", 'error'); } finally { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim'; } }); }
    const sidebarMenu = document.getElementById("sidebarMenu"); const sidebarOverlay = document.getElementById("sidebarOverlay"); const closeSidebarBtn = document.getElementById("closeSidebarBtn"); const sidebarAboutBtn = document.getElementById("sidebarAboutBtn"); const sidebarLinks = document.querySelectorAll(".sidebar-nav a:not(#sidebarAboutBtn)"); function openSidebar() { if (sidebarMenu) sidebarMenu.classList.add("active"); if (sidebarOverlay) sidebarOverlay.classList.add("active"); } function closeSidebar() { if (sidebarMenu) sidebarMenu.classList.remove("active"); if (sidebarOverlay) sidebarOverlay.classList.remove("active"); } const logoBtn = document.querySelector(".navbar-logo"); if (logoBtn) logoBtn.addEventListener("click", (e) => { e.preventDefault(); openSidebar(); }); sidebarLinks.forEach(link => { if (link.getAttribute('href') === '#') { link.addEventListener("click", (e) => { e.preventDefault(); window.location.hash = ''; closeSidebar(); }); } }); if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar); if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar); if (sidebarAboutBtn) { sidebarAboutBtn.addEventListener("click", (e) => { e.preventDefault(); closeSidebar(); openModal("aboutApiModal"); }); }
    const searchInput = document.getElementById('apiSearchInput'); if (searchInput) searchInput.addEventListener('input', filterApiCards); const platformBadge = document.getElementById('apiPlatformBadge'); const contentSection = document.getElementById('apiContentSection'); if (platformBadge && contentSection) platformBadge.addEventListener('click', () => { contentSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    startStatusPolling(); 
} 
document.addEventListener("DOMContentLoaded", () => { const initialLoader = document.getElementById('loader-wrapper'); const docsPage = document.getElementById('docs-page'); const mainApiPage = document.getElementById('main-api-page'); const preloader = document.getElementById('preloader'); const docsButton = document.getElementById('docs-page-button'); const body = document.body; function showDocsPage() { if (mainApiPage) mainApiPage.style.display = 'none'; if (preloader) preloader.classList.add('hidden'); if (docsPage) { docsPage.style.display = 'flex'; setTimeout(() => docsPage.classList.add('visible'), 50); } body.setAttribute("data-theme", "dark"); body.style.backgroundImage = 'none'; body.style.background = 'var(--darker)'; } async function showApiPage() { if (docsPage) { docsPage.classList.remove('visible'); setTimeout(() => docsPage.style.display = 'none', 500); } if (mainApiPage) mainApiPage.style.display = 'block'; if (preloader) preloader.classList.remove('hidden'); await initializeMainApiPage(); } body.setAttribute("data-theme", "dark"); body.style.background = 'var(--darker)'; updateDateTime(); setInterval(updateDateTime, 1000); if (docsButton) docsButton.addEventListener('click', () => { window.location.hash = 'docs'; }); const sidebarHomeLink = document.querySelector('.sidebar-nav a[href="#"]'); if (sidebarHomeLink) { sidebarHomeLink.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = ''; try { closeSidebar(); } catch(e) { const sidebarMenu = document.getElementById("sidebarMenu"); const sidebarOverlay = document.getElementById("sidebarOverlay"); if (sidebarMenu) sidebarMenu.classList.remove("active"); if (sidebarOverlay) sidebarOverlay.classList.remove("active"); } }); } document.addEventListener("click", (e) => { const closeBtn = e.target.closest(".btn-close"); const modalClicked = e.target.classList.contains('modal') ? e.target : null; const activeModal = closeBtn ? closeBtn.closest('.modal.active') : (modalClicked && modalClicked.classList.contains('active') ? modalClicked : null); if (activeModal) { if (closeBtn || (modalClicked && !modalClicked.querySelector('.modal-dialog').contains(e.target))) { if (activeModal.id === 'donationModal') { if (closeBtn) activeModal.classList.remove('active'); } else { activeModal.classList.remove('active'); } if (isApiInitialized && activeModal.id === 'apiResponseModal') { const rEl=document.getElementById("apiResponseContent"); if(rEl){rEl.classList.add("d-none"); rEl.innerHTML = ""; rEl.className='d-none';} const fEl=document.getElementById("paramForm"); if(fEl) fEl.style.display = "block"; const sBtn=document.getElementById("submitParamBtn"); if(sBtn) sBtn.style.display = "none"; const cpS=activeModal.querySelector(".copy-section"); if(cpS) cpS.classList.remove("active"); const cpR=document.getElementById("copyResponseBtn"); if(cpR) cpR.classList.add("d-none"); const ld=document.getElementById("apiResponseLoading"); if(ld) ld.style.display = "none"; const rt=document.getElementById("retryRequestBtn"); if(rt) rt.classList.add('d-none'); lastFetchedUrl = ""; } if (activeModal.id === 'reportModal') { const rF=document.getElementById("reportForm"); if(rF) rF.reset(); const sRB=document.getElementById("submitReportBtn"); if(sRB) { sRB.disabled = false; sRB.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim';} } } } }); function handleRouting() { if (window.location.hash === '#docs') { showApiPage(); } else { showDocsPage(); } } window.addEventListener('hashchange', handleRouting); setTimeout(() => { if (initialLoader) { initialLoader.style.opacity = '0'; initialLoader.style.pointerEvents = 'none'; setTimeout(() => initialLoader.style.display = 'none', 1000); } handleRouting(); }, 3000); });
