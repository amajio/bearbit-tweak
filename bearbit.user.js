// ==UserScript==
// @name         BearBit Tweak [20.5.26]
// @namespace    http://tampermonkey.net/
// @version      20.5.26
// @description  BearBit Tweak
// @author       You
// @match       https://bearbit.org/viewno18sbx.php*
// @match       https://bearbit.org/viewbrsb.php*
// @match       https://bearbit.org/details.php*
// @match       https://bearbit.org/index.php*
// @match       https://bearbit.org
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/amajio/bearbit-tweak/master/bearbit.user.js
// @downloadURL  https://raw.githubusercontent.com/amajio/bearbit-tweak/master/bearbit.user.js
// @connect      bearbit.org
// ==/UserScript==

(function() {
    'use strict';

    // Shared GLightbox instance (lazily initialised on first use)
    let _glightbox = null;

    // Load GLightbox into the page context (bypasses userscript sandbox proxy issues)
    function loadGLightbox(callback) {
        if (document.getElementById('glightbox-js')) {
            // Already injected — wait for it if not yet ready
            if (typeof unsafeWindow.GLightbox === 'function') {
                callback();
            } else {
                document.getElementById('glightbox-js').addEventListener('load', callback);
            }
            return;
        }

        // Inject CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/glightbox/dist/css/glightbox.min.css';
        document.head.appendChild(link);

        // Inject JS into page context so GLightbox runs outside the sandbox
        const script = document.createElement('script');
        script.id = 'glightbox-js';
        script.src = 'https://cdn.jsdelivr.net/npm/glightbox/dist/js/glightbox.min.js';
        script.onload = callback;
        document.head.appendChild(script);
    }

    function openGLightbox(imageUrl) {
        loadGLightbox(() => {
            if (_glightbox) {
                _glightbox.destroy();
                _glightbox = null;
            }
            // Use unsafeWindow.GLightbox so it runs in page context, not sandbox
            _glightbox = unsafeWindow.GLightbox({
                elements: [{ href: imageUrl, type: 'image' }],
                touchNavigation: true,
                loop: false,
                autoplayVideos: false,
                openEffect: 'fade',
            });
            _glightbox.open();
        });
    }

    let previewContainer = null;
    let currentLink = null;
    let hideTimeout = null;
    let isHovering = false;

    const previewClass = '.bb-preview';
    const vipDivClass = '.bb-file-actions';
    const bookmarkClass = '.bookmark-btn';

    // Default settings
    const defaultSettings = {
        HIDE_GAY: true,
        MINIMAL: false,
        THUMBNAIL_SIZE: "100px"
    };

    // Load settings from storage or use defaults
    const settings = {
        HIDE_GAY: GM_getValue('HIDE_GAY', defaultSettings.HIDE_GAY),
        MINIMAL: GM_getValue('MINIMAL', defaultSettings.MINIMAL),
        THUMBNAIL_SIZE: GM_getValue('THUMBNAIL_SIZE', defaultSettings.THUMBNAIL_SIZE)
    };

    const thumbnailSizeNum = settings.THUMBNAIL_SIZE.replace('px', '');

    // Safe CSS injection function
    function addStyle(css) {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.textContent = css;
        document.head.appendChild(style);
        return style;
    }

    // Apply all styles
    addStyle(`
      #preview-card {
         max-height: 90vh !important;
         overflow: auto !important;
      }

      #preview-card img {
         height: 80vh !important;
         object-fit: contain !important;
      }

      .card-content {
         position: sticky !important;
         bottom: 0 !important;
         background: #222222 !important;
      }

      .poster-column {
         width: auto !important;
      }

      .poster-column img {
         width: ${settings.THUMBNAIL_SIZE} !important;
         height: auto !important;
         min-height: 80px !important;
         max-height: calc(${thumbnailSizeNum}px * 1.3) !important;
         object-fit: contain !important;
         border: 0px !important;
      }

     /* Settings Panel Styles */
     .bearbit-settings-panel {
         position: fixed;
         top: 50%;
         left: 50%;
         transform: translate(-50%, -50%);
         background: #222222 !important;
         border: 2px solid #444 !important;
         border-radius: 10px !important;
         padding: 20px !important;
         z-index: 10000 !important;
         box-shadow: 0 0 20px rgba(0,0,0,0.8) !important;
         min-width: 250px !important;
         font-family: Arial, sans-serif !important;
         color: white !important;
     }

     .bearbit-settings-header {
         display: flex !important;
         justify-content: space-between !important;
         align-items: center !important;
         margin-bottom: 15px !important;
         border-bottom: 1px solid #444 !important;
         padding-bottom: 10px !important;
     }

     .bearbit-settings-title {
         font-size: 18px !important;
         font-weight: bold !important;
         color: white !important;
     }

     .bearbit-settings-close {
         background: none !important;
         border: none !important;
         font-size: 20px !important;
         cursor: pointer !important;
         color: #ccc !important;
     }

     .bearbit-settings-close:hover {
         color: white !important;
     }

     .bearbit-settings-group {
         margin-bottom: 15px !important;
     }

     .bearbit-settings-label {
         display: flex !important;
         align-items: center !important;
         margin-bottom: 8px !important;
         cursor: pointer !important;
         color: white !important;
     }

     .bearbit-settings-checkbox {
         margin-right: 8px !important;
     }

     .bearbit-settings-select {
         width: 100% !important;
         padding: 8px !important;
         border: 1px solid #444 !important;
         border-radius: 4px !important;
         background: #333 !important;
         color: white !important;
         margin-top: 5px !important;
     }

     .bearbit-settings-buttons {
         display: flex !important;
         justify-content: space-between !important;
         margin-top: 20px !important;
         gap: 20px;
     }

     .bearbit-settings-btn {
         padding: 10px 16px !important;
         border: none !important;
         border-radius: 4px !important;
         cursor: pointer !important;
         font-weight: bold !important;
         color: white !important;
     }

     .bearbit-settings-save {
         background: #4CAF50 !important;
     }

     .bearbit-settings-save:hover {
         background: #45a049 !important;
     }

     .bearbit-settings-reset {
         background: #666 !important;
     }

     .bearbit-settings-reset:hover {
         background: #777 !important;
     }

     .bearbit-settings-toggle {
         position: fixed !important;
         top: 10px !important;
         right: 10px !important;
         background: #222 !important;
         color: white !important;
         border: 2px solid #444 !important;
         border-radius: 50% !important;
         width: 40px !important;
         height: 40px !important;
         cursor: pointer !important;
         z-index: 9999 !important;
         font-size: 18px !important;
         display: flex !important;
         align-items: center !important;
         justify-content: center !important;
     }

     .bearbit-settings-toggle:hover {
         background: #333 !important;
         border-color: #555 !important;
     }

     .bearbit-settings-overlay {
         position: fixed !important;
         top: 0 !important;
         left: 0 !important;
         width: 100% !important;
         height: 100% !important;
         background: rgba(0,0,0,0.7) !important;
         z-index: 9998 !important;
     }

     /* Style checkboxes for dark theme */
     .bearbit-settings-checkbox {
         accent-color: #4CAF50 !important;
     }

     /* Style labels and text */
     .bearbit-settings-group label {
         color: white !important;
         font-weight: normal !important;
     }


     /* Style bearbit actions button */
     .bb-actions {
        margin-top: 8px;
        margin-bottom: 5px;
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
    }

    .bb-actions a {
        font-family: Tahoma, Arial, sans-serif;
        font-size: 11px;
        font-weight: bold;
        text-decoration: none;
        border-radius: 16px;
        padding: 5px 11px;
        line-height: 1.2;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 1px solid transparent;
        box-shadow: rgba(15, 23, 42, 0.12) 0px 1px 4px;
    }

    .bb-preview {
        background: #ffffff;
        border-color: rgb(203, 213, 225) !important;
    }

    .bb-bookmark {
        background: none !important;
        color: rgb(157, 171, 190);
        border: 0px !important;
        box-shadow: none !important;
        padding: 3px 5px !important;
        font-size: 20px !important;
    }

    .bb-bookmark.bookmarked {
	    color: rgb(245, 162, 20);
    }

}

`);

    function createSettingsPanel() {
        // Remove existing panel if any
        const existingPanel = document.getElementById('bearbit-settings-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const overlay = document.createElement('div');
        overlay.className = 'bearbit-settings-overlay';
        overlay.onclick = hideSettingsPanel;

        const panel = document.createElement('div');
        panel.id = 'bearbit-settings-panel';
        panel.className = 'bearbit-settings-panel';

        panel.innerHTML = `
            <div class="bearbit-settings-header">
                <div class="bearbit-settings-title">BearBit Tweak Settings</div>
                <button class="bearbit-settings-close">&times;</button>
            </div>
            <div class="bearbit-settings-group">
                <label class="bearbit-settings-label">
                    <input type="checkbox" class="bearbit-settings-checkbox" id="hide-gay" ${settings.HIDE_GAY ? 'checked' : ''}>
                    ซ่อนหมวดสีรุ้ง
                </label>
                <label class="bearbit-settings-label">
                <input type="checkbox" class="bearbit-settings-checkbox" id="minimal" ${settings.MINIMAL ? 'checked' : ''}>
                    Minimal details
                </label>
            </div>
            <div class="bearbit-settings-group">
                <label style="color: white !important;">ขนาดรูป:</label>
                <select class="bearbit-settings-select" id="thumbnail-size-select">
                    <option value="50px" ${settings.THUMBNAIL_SIZE === '50px' ? 'selected' : ''}>เล็ก</option>
                    <option value="100px" ${settings.THUMBNAIL_SIZE === '100px' ? 'selected' : ''}>ปกติ</option>
                    <option value="150px" ${settings.THUMBNAIL_SIZE === '150px' ? 'selected' : ''}>ใหญ่</option>
                </select>
            </div>
            <div class="bearbit-settings-buttons">
                <button class="bearbit-settings-btn bearbit-settings-reset">คืนค่าเริ่มต้น</button>
                <button class="bearbit-settings-btn bearbit-settings-save">บันทึกการตั้งค่า</button>
            </div>
        `;

        // Event listeners
        panel.querySelector('.bearbit-settings-close').onclick = hideSettingsPanel;
        panel.querySelector('.bearbit-settings-save').onclick = saveSettings;
        panel.querySelector('.bearbit-settings-reset').onclick = resetSettings;

        // Handle dropdown change
        const sizeSelect = panel.querySelector('#thumbnail-size-select');

        document.body.appendChild(overlay);
        document.body.appendChild(panel);
    }

    function hideSettingsPanel() {
        const panel = document.getElementById('bearbit-settings-panel');
        const overlay = document.querySelector('.bearbit-settings-overlay');
        const toggle = document.querySelector('.bearbit-settings-toggle');

        if (panel) {
            panel.querySelector('.bearbit-settings-close')?.removeEventListener('click', hideSettingsPanel);
            panel.remove();
        }
        if (overlay) overlay.remove();
        if (toggle) toggle.style.display = 'block';
    }

    function saveSettings() {
        const sizeSelect = document.getElementById('thumbnail-size-select');
        let thumbsize = 0;
        if(document.getElementById('minimal').checked){
                thumbsize = '50px';
        }else{
                thumbsize = sizeSelect.value;
        }
        const newSettings = {
            HIDE_GAY: document.getElementById('hide-gay').checked,
            MINIMAL: document.getElementById('minimal').checked,
            THUMBNAIL_SIZE: thumbsize
        };

        // Save to storage
        GM_setValue('HIDE_GAY', newSettings.HIDE_GAY);
        GM_setValue('MINIMAL', newSettings.MINIMAL);
        GM_setValue('THUMBNAIL_SIZE', newSettings.THUMBNAIL_SIZE);
        // Update current settings
        Object.assign(settings, newSettings);

        hideSettingsPanel();

        window.location.reload();
    }

    function resetSettings() {
        if (confirm('Reset all settings to defaults?')) {
            GM_setValue('HIDE_GAY', defaultSettings.HIDE_GAY);
            GM_setValue('MINIMAL', defaultSettings.MINIMAL);
            GM_setValue('THUMBNAIL_SIZE', defaultSettings.THUMBNAIL_SIZE);

            Object.assign(settings, defaultSettings);
            hideSettingsPanel();

            window.location.reload();
        }
    }

    function createSettingsButton() {
        const button = document.createElement('button');
        button.className = 'bearbit-settings-toggle';
        button.innerHTML = '⚙️';
        button.title = 'BearBit Settings';
        button.onclick = function() {
            this.style.display = 'none';
            createSettingsPanel();
        };
        document.body.appendChild(button);
    }

    function cleanupButtons() {
        document.querySelectorAll('[data-processed="true"]').forEach(btn => {
            if (btn.clickHandler) {
                btn.removeEventListener('click', btn.clickHandler);
                delete btn.clickHandler;
            }
            delete btn.dataset.processed;
        });
    }

    function removeHotTorrentSection() {
        const firstH2 = document.querySelector('h2');
        const hr = document.querySelector('hr');

        if (firstH2 && hr) {
            let current = firstH2.nextSibling;
            const elementsToRemove = [];

            // Collect elements to remove (skip style and script tags)
            while (current && current !== hr) {
                if (current.nodeType === Node.ELEMENT_NODE) {
                    // Keep style and script tags, remove everything else
                    if (current.tagName !== 'STYLE' && current.tagName !== 'SCRIPT') {
                        elementsToRemove.push(current);
                    }
                } else if (current.nodeType === Node.TEXT_NODE && current.textContent.trim() !== '') {
                    // Remove non-empty text nodes
                    elementsToRemove.push(current);
                }
                current = current.nextSibling;
            }

            // Remove the collected elements
            elementsToRemove.forEach(element => {element.style.display = 'none';});

            // Remove the hr itself
            hr.style.display = 'none';
            firstH2.style.display = 'none';
        }
    }

    function hideColumns(row){
        const column_number = [13,10,7,6];
        column_number.forEach(col => {
            let el = row.querySelector(`td:nth-child(${col})`);
            if (el) el.style.display = 'none';
        });
    }

    function removeUploaderAvartar(row){
        const uploader = row.querySelector('td:nth-child(13)');
        if (uploader) {
            // Remove img elements
            uploader.querySelectorAll('img').forEach(img => img.remove());

            // Remove other image types
            uploader.querySelectorAll('picture, svg, [role="img"]').forEach(el => el.remove());

            // Clear background images
            uploader.querySelectorAll('*').forEach(el => {
                if (window.getComputedStyle(el).backgroundImage !== 'none') {
                    el.style.backgroundImage = 'none';
                }
            });
        }
    }

    function minimalDetails(){
        if(!settings.MINIMAL) return;
        removeHotTorrentSection();
        const posterRows = document.querySelectorAll('tr td[class="poster-column"]');
        posterRows.forEach(posterTd => {
            const row = posterTd.closest('tr');
            if (!row) return;
            hideColumns(row);
            const br = row.querySelector('br');
            if(br){
                let nextDiv = br.nextElementSibling;
                while (nextDiv && nextDiv.tagName !== 'DIV') {
                    nextDiv = nextDiv.nextElementSibling;
                }
                if (nextDiv) {
                    let current = br;
                    let nextNode;
                    while (current && current !== nextDiv) {
                        nextNode = current.nextSibling;
                        current.remove();
                        current = nextNode;
                    }
                } else {
                    // Fallback: just remove until the start of the div area
                    let elem = br;
                    while (elem && elem.nextSibling && elem.nextSibling.tagName !== 'DIV') {
                        elem = elem.nextSibling;
                        elem.remove();
                    }
                    if (elem && elem.nextSibling && elem.nextSibling.tagName === 'DIV') {
                        // Everything is removed already, br is gone too
                    }
                }
            }
        });
        const headers = document.querySelectorAll('.colhead'); // hide header column
        for (const col of headers) {
            const h = col.querySelector('a[href^="view"][href$=".php?sortby=1"]');
            if(h){
                const row = h.closest('tr');
                //col.style.width = '100%';
                hideColumns(row);
            }
        }
    }

    function cleanWhitespace(row) {
        // Walk through ALL text nodes in the entire row
        const textNodes = [];
        const walker = document.createTreeWalker(
            row, // Start from the row element itself
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    const text = node.textContent;
                    // Accept if it's empty, only whitespace, or the word "whitespace"
                    if(text.trim() === '' || text.trim() === 'whitespace') {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );

        // Collect all whitespace text nodes
        while(walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        // Remove all collected text nodes
        textNodes.forEach(node => {
            if(node.parentNode) {
                node.parentNode.removeChild(node);
            }
        });

        // Also remove any empty divs that contain ONLY whitespace
        const emptyDivs = row.querySelectorAll('div');
        emptyDivs.forEach(div => {
            // Check if div has no children elements and only whitespace text
            if(div.children.length === 0 && div.textContent.trim() === '') {
                div.remove();
            }
            // Remove div that literally says "whitespace"
            else if(div.children.length === 0 && div.textContent.trim() === 'whitespace') {
                div.remove();
            }
        });
    }

    function hideDiv(row){
        const div = row.querySelectorAll('div');
        div.forEach(d => {
            d.style.display = 'none';
        });
    }

    function actionsButton() {
        cleanupButtons();
        const posterRows = document.querySelectorAll('tr td[class="poster-column"]');
        const baseUrl = "https://bearbit.org/";

        posterRows.forEach(posterTd => {
            const row = posterTd.closest('tr');
            if (!row) return;

            const link = row.querySelector('a[href^="details.php"]');
            if (!link) return;

            const sizeCell = row.querySelector('td:nth-child(9)');
            let fileSize = ' - '
            let numericSize = 0;
            let sizeUnit = '';

            if (sizeCell) {
                const sizeText = sizeCell.innerText.trim();
                const match = sizeText.match(/^([\d.]+)\s+(TB|GB|MB|KB)$/i);
                if (match) {
                    fileSize = sizeText;
                    numericSize = parseFloat(match[1]);
                    sizeUnit = match[2].toUpperCase();

                    // Convert to GB for comparison
                    if (sizeUnit === 'TB') {
                        numericSize = numericSize * 1024; // 1 TB = 1024 GB
                    } else if (sizeUnit === 'MB') {
                        numericSize = numericSize / 1024;
                    } else if (sizeUnit === 'KB') {
                        numericSize = numericSize / (1024 * 1024);
                    }
                }
            }

            //row.querySelector(`${vipDivClass}`)?.style.setProperty('display', 'none');
            hideDiv(row);
            row.querySelector('img[src="pic/cams.gif "]')?.style.setProperty('display', 'none');
            const originalBookmark = row.querySelector(`${bookmarkClass}`);
            const divGroup = document.createElement('div');
            divGroup.className = 'bb-actions';
            const nameCell = row.querySelector('td:nth-child(3)');

            const filename_div = document.createElement('div');
            filename_div.className = 'hover-area';
            filename_div.style.display = 'inline-block';
            link.parentNode.insertBefore(filename_div, link);
            filename_div.appendChild(link);

            const btnDownload = document.createElement('a');
            btnDownload.textContent = `📥 ดาวน์โหลด (${fileSize})`;
            btnDownload.style.color = '#ffffff';
            btnDownload.style.cursor = 'pointer';
            btnDownload.className = 'bb-download';
            btnDownload.title = 'คลิกเพื่อดาวน์โหลด';

            const btnImage = document.createElement('a');
            const camsImg = row.querySelector('img[src="pic/cams.gif "]')?.closest('a').href;
            btnImage.textContent = `📷 รูป`;
            btnImage.style.cursor = 'pointer';
            btnImage.className = 'bb-preview';
            btnImage.href = '#';
            btnImage.title = 'ดูรูปตัวอย่าง';

            if (camsImg) {
                btnImage.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openGLightbox(camsImg);
                });
            } else {
                btnImage.style.opacity = '0.4';
                btnImage.style.cursor = 'default';
                btnImage.title = 'ไม่มีรูปตัวอย่าง';
            }

            const btnBookmark = document.createElement('a');
            btnBookmark.textContent = `★`;
            btnBookmark.className = 'bb-bookmark';
            btnBookmark.style.cursor = 'pointer';
            btnBookmark.title = 'เพิ่ม/ลบ ออกจากบุ๊กมาร์ก';


            // Set background color based on file size (in GB)
            let bgColor;
            if (numericSize < 4) {
                bgColor = '#16A34A'; // Green
            } else if (numericSize >= 4 && numericSize <= 10 ) {
                bgColor = '#2563EB'; // blue
            } else if (numericSize > 10 && numericSize <= 30) {
                bgColor = '#EA580C'; // Orange
            } else if (numericSize > 30) {
                bgColor = '#DC2626'; // Red
            } else {
                bgColor = '#16A34A'; // Grey (for unknown size)
            }

            btnDownload.style.backgroundColor = bgColor;
            divGroup.appendChild(btnImage);
            divGroup.appendChild(btnDownload);
            divGroup.appendChild(btnBookmark);
            nameCell.appendChild(divGroup);

            removeUploaderAvartar(row);
            cleanWhitespace(row);

            if (!btnDownload || btnDownload.dataset.processed === 'true') return;

            const targetUrl = `${baseUrl}${link.getAttribute('href')}`;
            btnDownload.dataset.targetUrl = targetUrl;
            btnDownload.dataset.processed = 'true';

            btnDownload.removeEventListener('click', btnDownload.clickHandler);

            btnBookmark.addEventListener('click', () => {
                originalBookmark.click();
                if (originalBookmark.classList.contains('bookmarked')) {
                    btnBookmark.classList.add('bookmarked');
                }else{
                    btnBookmark.classList.remove('bookmarked');
                }
            });

            btnDownload.clickHandler = function(event) {
                event.preventDefault();
                event.stopPropagation();

                if (this.dataset.loading === 'true') return;

                const storedUrl = this.dataset.targetUrl;
                if (!storedUrl) {
                    console.error('No target URL found');
                    return;
                }

                this.dataset.loading = 'true';

                // Store current state before changing
                const currentState = {
                    html: this.innerHTML,
                    cursor: this.style.cursor
                };

                this.innerHTML = '⏳ กำลังโหลด...';
                this.style.cursor = 'wait';

                GM_xmlhttpRequest({
                    method: "GET",
                    url: storedUrl,
                    timeout: 10000,
                    onload: (response) => {
                        if (response.status !== 200) {
                            console.error(`Failed to load ${storedUrl}: ${response.status}`);
                            this.innerHTML = '❌ ล้มเหลว';
                            this.style.cursor = 'pointer';
                            setTimeout(() => {
                                this.innerHTML = currentState.html;
                                this.style.cursor = currentState.cursor;
                                this.dataset.loading = 'false';
                            }, 2000);
                            return;
                        }

                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, "text/html");
                        const downloadBtn = doc.querySelector('a[href^="downloadnew.php"]');

                        if (downloadBtn) {
                            let downloadUrl = downloadBtn.href
                            const fullDownloadUrl = downloadUrl.startsWith('http')
                            ? downloadUrl
                            : `${baseUrl}${downloadUrl}`;

                            this.dataset.loading = 'false';
                            window.location.href = fullDownloadUrl;
                            this.innerHTML = currentState.html;
                            this.style.cursor = currentState.cursor;
                        } else {
                            this.innerHTML = '❌ ไม่พบลิงก์';
                            this.style.cursor = 'pointer';
                            setTimeout(() => {
                                this.innerHTML = currentState.html;
                                this.style.cursor = currentState.cursor;
                                this.dataset.loading = 'false';
                            }, 2000);
                        }
                    },
                    onerror: (error) => {
                        console.error(`Request failed for ${storedUrl}:`, error);
                        this.innerHTML = '❌ เครือข่ายผิดพลาด';
                        this.style.cursor = 'pointer';
                        setTimeout(() => {
                            this.innerHTML = currentState.html;
                            this.style.cursor = currentState.cursor;
                            this.dataset.loading = 'false';
                        }, 2000);
                    },
                    ontimeout: () => {
                        console.warn(`Request timeout for ${storedUrl}`);
                        this.innerHTML = '⏰ เวลาหมด';
                        this.style.cursor = 'pointer';
                        setTimeout(() => {
                            this.innerHTML = currentState.html;
                            this.style.cursor = currentState.cursor;
                            this.dataset.loading = 'false';
                        }, 2000);
                    }
                });
            };

            btnDownload.addEventListener('click', btnDownload.clickHandler);
        });
    }

    function autoThank() {
        let attempts = 0;
        const maxAttempts = 5;
        function tryThank() {
            if (attempts++ >= maxAttempts) return;
            if (window.location.pathname.includes('details.php')) {
                const sayThanksTd = document.getElementById('saythanks');
                if (sayThanksTd) {
                    const img = sayThanksTd.querySelector('img[src*="pic/thanks/th"]');
                    if (img) {
                        const anchor = sayThanksTd.querySelector('a');
                        if (anchor) {
                            anchor.click();
                        }
                    } else {
                        setTimeout(autoThank, 500);
                    }
                }
            }
        }
        tryThank();
    }

    function hideGayContents() {
        if(!settings.HIDE_GAY) return;
            const input = document.querySelector("input[name='c908']");
            if (input) {
                const td = input.closest('td');
                if (td) {
                    td.style.display = 'none';
                }
            }

            document.querySelectorAll('a[href="viewbrsb.php?cat=908"]').forEach(link => {
                const row = link.closest('tr');
                if (row) {
                    const hasCategoryInput = row.querySelector('input[name="c908"]');
                    if (!hasCategoryInput) {
                        row.style.display = 'none';
                    }
                }
            });
    }

    function setupHoverDetection() {
        const allDetailsLinks = document.querySelectorAll('a[href^="details.php"]');

        allDetailsLinks.forEach(link => {
            let currentRow = link.closest('tr');
            const camsImg = currentRow.querySelector('img[src="pic/cams.gif "]')?.closest('a');
            const fileArea = currentRow.querySelector('.hover-area');

            if (!fileArea) return;

            // Remove old listeners to avoid duplicates
            fileArea.removeEventListener('mouseenter', handleMouseEnter);
            fileArea.removeEventListener('mouseleave', handleMouseLeave);

            // Store the image URL with the element
            if (camsImg) {
                fileArea.dataset.previewUrl = camsImg.getAttribute('href');
            }

            // Add new listeners
            fileArea.addEventListener('mouseenter', handleMouseEnter);
            fileArea.addEventListener('mouseleave', handleMouseLeave);
        });
    }

    function handleMouseEnter(event) {
        const fileArea = event.currentTarget;
        const imageUrl = fileArea.dataset.previewUrl;

        if (imageUrl && !isHovering) {
            // Clear any pending hide timeout
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }

            isHovering = true;
            currentLink = fileArea;
            showPreview(imageUrl);
            fileArea.style.backgroundColor = '#f0f0f0';
        }
    }

    function handleMouseLeave(event) {
        const fileArea = event.currentTarget;

        // Delay hiding to prevent flickering
        hideTimeout = setTimeout(() => {
            fileArea.style.backgroundColor = '';
            hidePreview();
            isHovering = false;
            currentLink = null;
        }, 100);
    }

    function createPreviewContainer() {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.zIndex = '999999';
        container.style.backgroundColor = 'rgba(0,0,0,0.8)';
        container.style.borderRadius = '12px';
        container.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
        container.style.padding = '3px';
        container.style.display = 'none';
        container.style.pointerEvents = 'none';
        container.style.border = "1px solid #fff";
        container.style.maxWidth = '70vh';
        container.style.maxHeight = '90vh';
        container.style.height = '85vh';

        const img = document.createElement('img');
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.display = 'block';
        img.style.borderRadius = '12px';

        container.appendChild(img);
        document.body.appendChild(container);

        return container;
    }

    function centerPreview(container) {
        if (!container) return;
        container.style.left = '50%';
        container.style.top = '50%';
        container.style.transform = 'translate(-50%, -50%)';
    }

    function showPreview(imageUrl) {
        if (!previewContainer) {
            previewContainer = createPreviewContainer();
        }

        const img = previewContainer.querySelector('img');

        // Clear previous error message
        const oldError = previewContainer.querySelector('.error-msg');
        if (oldError) oldError.remove();

        img.src = '';
        img.alt = 'Loading...';
        img.style.opacity = '0.5';

        previewContainer.style.display = 'flex';
        previewContainer.style.alignItems = 'center';
        previewContainer.style.justifyContent = 'center';
        centerPreview(previewContainer);

        const testImg = new Image();

        testImg.onload = function() {
            img.src = imageUrl;
            img.style.opacity = '1';
        };

        testImg.onerror = function() {
            console.error('Failed to load image:', imageUrl);
            img.alt = 'Failed to load image';
            img.style.opacity = '1';

            const errorDiv = document.createElement('div');
            errorDiv.style.color = 'white';
            errorDiv.style.padding = '20px';
            errorDiv.style.textAlign = 'center';
            errorDiv.innerText = 'Failed to load image';
            errorDiv.className = 'error-msg';
            previewContainer.appendChild(errorDiv);
        };

        testImg.src = imageUrl;
        img.src = imageUrl;
    }

    function hidePreview() {
        if (previewContainer && previewContainer.style.display !== 'none') {
            previewContainer.style.display = 'none';
            const img = previewContainer.querySelector('img');
            if (img) {
                img.src = '';
                img.style.opacity = '1';
            }
            const errorDiv = previewContainer.querySelector('.error-msg');
            if (errorDiv) errorDiv.remove();
        }
    }

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (previewContainer) {
            previewContainer.remove();
            previewContainer = null;
        }
    });

    window.addEventListener('resize', function() {
        if (previewContainer && previewContainer.style.display !== 'none') {
            centerPreview(previewContainer);
        }
    });

    // Handle clicks that might interfere
    document.addEventListener('click', function(event) {
        const toggleBtn = event.target.closest('#toggle-posters-btn');
        if (toggleBtn) {
            setTimeout(() => {
                hidePreview();
                isHovering = false;
                if (currentLink) {
                    currentLink.style.backgroundColor = '';
                    currentLink = null;
                }
            }, 50);
        }
    });

    function init() {
        actionsButton();
        minimalDetails();
        autoThank();
        hideGayContents();
        createSettingsButton();
        setupHoverDetection();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
