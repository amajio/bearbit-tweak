// ==UserScript==
// @name         BearBit Tweak
// @namespace    http://tampermonkey.net/
// @version      26.5.27.1121
// @description  BearBit Tweak
// @author       riffburn
// @match       https://bearbit.org/viewno18sbx.php*
// @match       https://bearbit.org/viewbrsb.php*
// @match       https://bearbit.org/details.php*
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
    const noimage = 'https://bearbit.org/no_poster.jpg';
    const imageSize = {
        'width':{'small': 75,'normal': 100, 'large': 140},
        'height':{'small': 75,'normal': 140, 'large': 180},
    };

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
                touchNavigation: true,
                zoomable: true,
                draggable: true,
                dragToleranceX: 150,
                dragToleranceY: 150,
                onOpen: function() {
                    // Force reset the container transform to 0
                    const mediaContainer = document.querySelector('.gslide-media');
                    if (mediaContainer) {
                        // Override the transform to remove horizontal offset
                        mediaContainer.style.transform = 'translate3d(0px, 0px, 0px)';

                        const observer = new MutationObserver(function(mutations) {
                            mutations.forEach(function(mutation) {
                                if (mutation.attributeName === 'style') {
                                    const currentTransform = mediaContainer.style.transform;
                                    if (currentTransform && currentTransform.includes('translate3d(-')) {
                                        mediaContainer.style.transform = 'translate3d(0px, 0px, 0px)';
                                    }
                                }
                            });
                        });
                        observer.observe(mediaContainer, { attributes: true });
                    }
                }
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
        HIDE_STICKY: true,
        MINIMAL: false,
        PREVIEW: false,
        THUMBNAIL_SIZE: 140
    };

    // Load settings from storage or use defaults
    const settings = {
        HIDE_GAY: GM_getValue('HIDE_GAY', defaultSettings.HIDE_GAY),
        HIDE_STICKY: GM_getValue('HIDE_STICKY', defaultSettings.HIDE_STICKY),
        MINIMAL: GM_getValue('MINIMAL', defaultSettings.MINIMAL),
        PREVIEW: GM_getValue('PREVIEW', defaultSettings.PREVIEW),
        THUMBNAIL_SIZE: GM_getValue('THUMBNAIL_SIZE', defaultSettings.THUMBNAIL_SIZE)
    };

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
         height: ${settings.THUMBNAIL_SIZE}px !important;
         max-height: ${settings.THUMBNAIL_SIZE}px !important;
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
         position: relative;
     }

     /* Tooltip container for the info icon */
    .info-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-left: 6px;
        font-size: 12px;
        font-weight: bold;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.2);
        cursor: help;
        position: relative;
    }

    /* Tooltip text */
    .info-icon .tooltip-text {
        visibility: hidden;
        opacity: 0;
        width: 260px;
        background-color: #1D2E27;
        color: #fff;
        text-align: left;
        border-radius: 8px;
        padding: 10px 12px;
        position: absolute;
        z-index: 1000;
        bottom: 125%;
        left: 50%;
        transform: translateX(-50%);
        white-space: normal;
        font-size: 12px;
        font-weight: normal;
        line-height: 1.5;
        transition: opacity 0.2s ease, visibility 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        pointer-events: none;
    }

    /* Tooltip arrow */
    .info-icon .tooltip-text::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -6px;
        border-width: 6px;
        border-style: solid;
        border-color: #1a1a2e transparent transparent transparent;
    }

    /* Show tooltip on hover */
    .info-icon:hover .tooltip-text {
        visibility: visible;
        opacity: 1;
    }

    /* Tooltip list styling */
    .tooltip-text ul {
        margin: 0;
        padding-left: 16px;
    }

    .tooltip-text li {
        margin: 4px 0;
    }

    .tooltip-text strong {
        color: #ffd966;
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
        margin-top: 3px;
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

     /* Enable scrolling on GLightbox content for tall images */
    .glightbox-container .glightbox-caption {
        max-height: 80vh;
        overflow-y: auto;
    }

    .glightbox-mobile .glightbox-container .gslide-image img {
        max-height: 80vh !important;
        object-fit: contain;
    }

    /* Allow scrolling on the slide content */
    .gslide-media {
        overflow-y: auto !important;
        max-height: 95vh !important;
    }

    /* Custom scrollbar styling */
    .gslide-media::-webkit-scrollbar {
        width: 8px;
    }

    .gslide-media::-webkit-scrollbar-track {
        background: #333;
    }

    .gslide-media::-webkit-scrollbar-thumb {
        background: #666;
        border-radius: 4px;
    }

    .filter-container {
        padding-top: 3px;
        padding-bottom: 3px;
        top: 0px;
        z-index: 101;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 5px;
    }

    .filter-container a {
        font-family: Tahoma, Arial, sans-serif;
        font-size: 10px;
        font-weight: bold;
        text-decoration: none;
        border-radius: 16px;
        padding: 5px 11px;
        min-width: 80px;
        line-height: 1.2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 3px;
        border: 1px solid transparent;
        box-shadow: rgba(15, 23, 42, 0.12) 0px 1px 4px;
        color: #ffffff;
        transition: all 0.3s ease;
        white-space: nowrap;
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
                    <span class="info-icon">
                        ⓘ
                        <span class="tooltip-text">
                            <ul>
                                <li>ซ่อนรายละเอียดด้านล่างชื่อไฟล์</li>
                                <li>ลดขนาดรูปตัวอย่าง</li>
                                <li>ซ่อนบางคอลัมม์</li>
                            </ul>
                        </span>
                    </span>
                </label>
                <label class="bearbit-settings-label">
                    <input type="checkbox" class="bearbit-settings-checkbox" id="preview" ${settings.PREVIEW ? 'checked' : ''}>
                    แสดงรูปตัวอย่างเมื่อแตะชื่อไฟล์
                </label>
         </div>
            <div class="bearbit-settings-group">
                <label style="color: white !important;">ขนาดรูป:</label>
                <select class="bearbit-settings-select" id="thumbnail-size-select">
                    <option value="${imageSize.height.small}" ${settings.THUMBNAIL_SIZE == imageSize.height.small ? 'selected' : ''}>เล็ก</option>
                    <option value="${imageSize.height.normal}" ${settings.THUMBNAIL_SIZE == imageSize.height.normal ? 'selected' : ''}>ปกติ</option>
                    <option value="${imageSize.height.large}" ${settings.THUMBNAIL_SIZE == imageSize.height.large ? 'selected' : ''}>ใหญ่</option>
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
        document.getElementById('minimal').addEventListener('change', updateThumbnailSelectState);
        updateThumbnailSelectState();
    }

    function updateThumbnailSelectState(){
        const minimalCheckbox = document.getElementById('minimal');
        const thumbnailSelect = document.getElementById('thumbnail-size-select');
        const isMinimal = minimalCheckbox.checked;
        thumbnailSelect.disabled = isMinimal;
        thumbnailSelect.style.opacity = isMinimal ? '0.6' : '1';
        thumbnailSelect.style.cursor = isMinimal ? 'not-allowed' : 'pointer';
        thumbnailSelect.title = 'ปิดใช้งานในโหมด Minimal details';
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
                thumbsize = imageSize.height.small;
        }else{
                thumbsize = sizeSelect.value;
        }
        const newSettings = {
            HIDE_GAY: document.getElementById('hide-gay').checked,
            MINIMAL: document.getElementById('minimal').checked,
            PREVIEW: document.getElementById('preview').checked,
            THUMBNAIL_SIZE: thumbsize
        };

        // Save to storage
        GM_setValue('HIDE_GAY', newSettings.HIDE_GAY);
        GM_setValue('MINIMAL', newSettings.MINIMAL);
        GM_setValue('PREVIEW', newSettings.PREVIEW);
        GM_setValue('THUMBNAIL_SIZE', newSettings.THUMBNAIL_SIZE);
        // Update current settings
        Object.assign(settings, newSettings);

        hideSettingsPanel();

        window.location.reload();
    }

    function resetSettings() {
        if (confirm('Reset all settings to defaults?')) {
            GM_setValue('HIDE_GAY', defaultSettings.HIDE_GAY);
            GM_setValue('HIDE_STICKY', defaultSettings.HIDE_STICKY);
            GM_setValue('MINIMAL', defaultSettings.MINIMAL);
            GM_setValue('PREVIEW', defaultSettings.PREVIEW);
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
        const posters = document.querySelectorAll('.poster-column img');
        let matchedSize = null;
        Object.entries(imageSize.height).forEach(([size, value]) => {
            if(settings.THUMBNAIL_SIZE == value) {
                matchedSize = size;
            }
        });

        if(matchedSize) {
            posters.forEach(image => {
                image.style.setProperty('width', imageSize.width[matchedSize] + 'px', 'important');
            });
        }
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

    function hideHotTorrentSection() {
        const h2 = document.querySelector('h2 img[alt="Hot"]')?.closest('h2');
        const hr = [...document.querySelectorAll('h2')].find(el => el.textContent.includes('รายการไฟล์'))?.previousElementSibling;
        const elementsToHide = [];

        if (h2 && hr) {
            let current = h2.nextSibling;

            while (current && current !== hr) {
                if (current.nodeType === Node.ELEMENT_NODE) {
                    elementsToHide.push(current);
                }
                current = current.nextSibling;
            }
            elementsToHide.push(hr);
            elementsToHide.push(h2);
            elementsToHide.forEach(element => {
                if(!settings.HIDE_STICKY){
                    element.style.display = '';
                }else{
                    element.style.display = 'none';
                }
            });
        }
    }

    function hideColumns(row){
        const column_number = [13,10,7,6];
        column_number.forEach(col => {
            let el = row.querySelector(`td:nth-child(${col})`);
            if (el) el.style.display = 'none';
        });
    }

    function hideUploaderAvartar(row){
        const uploader = row.querySelector('td:nth-child(13)');
        uploader.style.width = 'auto';
        if (uploader) {
            const children = uploader.children;
            for (let i = 0; i < children.length; i++) {
                if (children[i].tagName !== 'A') {
                    children[i].style.display = 'none';
                }
            }
        }
    }

    function minimalDetails(){
        if(!settings.MINIMAL) return;
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
                    let elem = br;
                    while (elem && elem.nextSibling && elem.nextSibling.tagName !== 'DIV') {
                        elem = elem.nextSibling;
                        elem.remove();
                    }
                    if (elem && elem.nextSibling && elem.nextSibling.tagName === 'DIV') {
                    }
                }
            }
        });
        const headers = document.querySelectorAll('.colhead'); // hide header column
        for (const col of headers) {
            const h = col.querySelector('a[href^="view"][href$=".php?sortby=1"]');
            if(h){
                const row = h.closest('tr');
                hideColumns(row);
            }
        }
    }

    function cleanWhitespace(row) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            row,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    const text = node.textContent;
                    if(text.trim() === '' || text.trim() === 'whitespace') {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );

        while(walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach(node => {
            if(node.parentNode) {
                node.parentNode.removeChild(node);
            }
        });

        const emptyDivs = row.querySelectorAll('div');
        emptyDivs.forEach(div => {
            if(div.children.length === 0 && div.textContent.trim() === '') {
                div.remove();
            }
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

    function buildFilterButton(text, suffix, color){
        const element = document.createElement('a');
        element.style.cssText = `
             display: inline-flex;
             padding: 5px;
             cursor: pointer;
             border: 2px solid;
             border-color: ${color};
             color: black;
             transition: all 0.2s ease;
             background: white;
        `;
        element.textContent = `${text}`;
        element.className = `bb-filter ${suffix}`
        element.dataset.color = `${color}`;
        if (suffix === 'all') {
            element.classList.add('active');
            element.style.backgroundColor =`${color}`;
            element.style.color = 'black';
        }
        element.addEventListener('click', (e) => {
            e.preventDefault();
            const currentActive = document.querySelector('.bb-filter.active');
            if (currentActive) {
                currentActive.classList.remove('active');
                currentActive.style.backgroundColor = 'white';
                currentActive.style.color = 'black';
            }
            element.classList.add('active');
            element.style.backgroundColor = element.dataset.color;

            if(e.target.classList.contains('all')){
                element.style.color = 'black';
            }else{
                element.style.color = 'white';
            }

            const btnDownloads = document.querySelectorAll('.bb-download');
            btnDownloads.forEach(btn => {
                const row = btn.closest('tr');
                if(!row) return;
                if (e.target.classList.contains('all')) {
                    row.style.display = '';
                }else{
                    if (!btn.classList.contains(`${suffix}`)) {
                        row.style.display = 'none';
                    }else{
                        row.style.display = '';
                    }
                }
            });

            const headers = document.querySelectorAll('.colhead.poster-column');
            let counter=0;
            headers.forEach((head, tindex )=> {
                const empty = document.getElementById(`empty-table-${tindex}`);
                if(empty){
                    empty.remove();
                }
                const table = head.closest('table');
                const rows = table.querySelectorAll('tr');
                rows.forEach((row, rindex) =>{
                    if(rindex == 0) return; //skip header
                    if(row.style.display != 'none') return;
                    counter++;
                });

                if((rows.length-1)-counter == 0){
                    const tr = document.createElement('tr');
                    const td = document.createElement('td');
                    tr.id = `empty-table-${tindex}`;
                    tr.style.height = '60px';
                    td.colSpan = 13;
                    td.textContent = 'ไม่พบไฟล์';
                    td.style.textAlign = 'center';
                    td.style.verticalAlign = 'middle';
                    tr.appendChild(td);
                    table.appendChild(tr);
                }
                counter=0
            });
        });
        return element
    }

    function filters(){
        const filterStyle = [
            {
                text: 'ทั้งหมด',
                suffix: 'all',
                color: '#CBD5E1'
            },{
                text: 'น้อยกว่า 4 GB',
                suffix: 'small',
                color: '#16A34A'
            },{
                text: '4 - 10 GB',
                suffix: 'medium',
                color: '#2563EB'
            },{
                text: '10 - 30 GB',
                suffix: 'large',
                color: '#EA580C'
            },{
                text: '30 GB ขึ้นไป',
                suffix: 'xlarge',
                color: '#DC2626'
            }
        ];

        const toggle_posters = document.getElementById('toggle-posters-btn');
        if(!toggle_posters) return;
        const hideHotTorrent = document.createElement('button');
        let content = settings.HIDE_STICKY ? 'แสดง Hot Torrents':'ซ่อน Hot Torrents';
        hideHotTorrent.textContent = content;
        hideHotTorrent.style.cssText = `
            font-size: 11px;
            padding: 5px 10px;
            cursor: pointer;
            margin-right: 10px;
        `;

        hideHotTorrent.addEventListener('click', (e) => {
            settings.HIDE_STICKY = !settings.HIDE_STICKY
            GM_setValue('HIDE_STICKY', settings.HIDE_STICKY);
            let content = settings.HIDE_STICKY ? 'แสดง Hot Torrents':'ซ่อน Hot Torrents';
            if(settings.HIDE_STICKY){
                hideHotTorrent.textContent = content;
            }else{
                hideHotTorrent.textContent = content;
            }
            hideHotTorrentSection();
        });

        const parentDiv = toggle_posters.parentElement;
        parentDiv.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 10px 0;
            padding-right: 5px;
        `;

        const centerWrapper = document.createElement('div');
        centerWrapper.className = 'filter-container';
        centerWrapper.style.cssText = `
            display: flex;
            gap: 10px;
            justify-content: center;
            flex: 1;
        `;

        filterStyle.forEach(style => {
            let elem = buildFilterButton(style.text, style.suffix, style.color);
            centerWrapper.appendChild(elem);
        });
        parentDiv.insertBefore(centerWrapper, toggle_posters);
        parentDiv.insertBefore(hideHotTorrent, toggle_posters);
        const rightWrapper = document.createElement('div');
        rightWrapper.style.cssText = 'text-align: right;';
        parentDiv.insertBefore(rightWrapper, toggle_posters);
        rightWrapper.appendChild(toggle_posters);
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
            if (originalBookmark.classList.contains('bookmarked')) {
                btnBookmark.classList.add('bookmarked');
            }

            // Set background color based on file size (in GB)
            let bgColor, suffixClass;
            if (numericSize < 4) {
                bgColor = '#16A34A'; // Green
                suffixClass = 'small';
            } else if (numericSize >= 4 && numericSize <= 10 ) {
                bgColor = '#2563EB'; // blue
                suffixClass = 'medium';
            } else if (numericSize > 10 && numericSize <= 30) {
                bgColor = '#EA580C'; // Orange
                suffixClass = 'large';
            } else if (numericSize > 30) {
                bgColor = '#DC2626'; // Red
                suffixClass = 'xlarge';
            } else {
                bgColor = '#16A34A'; // Green (for unknown size)
                suffixClass = 'small';
            }

            btnDownload.style.backgroundColor = bgColor;
            btnDownload.className = `bb-download ${suffixClass}`;
            divGroup.appendChild(btnImage);
            divGroup.appendChild(btnDownload);
            divGroup.appendChild(btnBookmark);
            nameCell.appendChild(divGroup);

           hideUploaderAvartar(row);
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
        if(!settings.PREVIEW){
            return;
        }
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
        }, 30);
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
            img.alt = 'Failed to load image';
            img.style.opacity = '1';
            img.src = noimage;
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
        hideHotTorrentSection()
        minimalDetails();
        filters();
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
