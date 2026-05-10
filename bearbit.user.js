// ==UserScript==
// @name         BearBit Tweak
// @namespace    http://tampermonkey.net/
// @version      0.3.4
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
// @connect      bearbit.org
// ==/UserScript==

(function() {
    'use strict';

    let previewContainer = null;
    let currentLink = null;
    let hideTimeout = null;

    // Default settings
    const defaultSettings = {
        HIDE_GAY: true,
        THUMBNAIL_SIZE: "100px"
    };

    // Load settings from storage or use defaults
    const settings = {
        HIDE_GAY: GM_getValue('HIDE_GAY', defaultSettings.HIDE_GAY),
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

     .bearbit-settings-input {
         width: 100% !important;
         padding: 8px !important;
         border: 1px solid #444 !important;
         border-radius: 4px !important;
         background: #333 !important;
         color: white !important;
         margin-top: 5px !important;
         display: none;
     }

     .bearbit-settings-input::placeholder {
         color: #999 !important;
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
                <div class="bearbit-settings-title">BearBit Settings</div>
                <button class="bearbit-settings-close">&times;</button>
            </div>
            <div class="bearbit-settings-group">
                <label class="bearbit-settings-label">
                    <input type="checkbox" class="bearbit-settings-checkbox" id="hide-gay" ${settings.HIDE_GAY ? 'checked' : ''}>
                    ซ่อนหมวดสีรุ้ง
                </label>
            </div>
            <div class="bearbit-settings-group">
                <label style="color: white !important;">ขนาดรูป:</label>
                <select class="bearbit-settings-select" id="thumbnail-size-select">
                    <option value="60px" ${settings.THUMBNAIL_SIZE === '60px' ? 'selected' : ''}>เล็ก (60px)</option>
                    <option value="100px" ${settings.THUMBNAIL_SIZE === '100px' ? 'selected' : ''}>ปกติ (100px)</option>
                    <option value="150px" ${settings.THUMBNAIL_SIZE === '150px' ? 'selected' : ''}>ใหญ่ (150px)</option>
                    <option value="custom" ${!['60px', '100px', '150px'].includes(settings.THUMBNAIL_SIZE) ? 'selected' : ''}>กำหนดเอง</option>
                </select>
                <input type="text" class="bearbit-settings-input" id="thumbnail-size-custom" value="${!['60px', '100px', '150px'].includes(settings.THUMBNAIL_SIZE) ? settings.THUMBNAIL_SIZE : ''}" placeholder="ตัวอย่าง 120px (มี px ตามหลังด้วย)">
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
        const customInput = panel.querySelector('#thumbnail-size-custom');

        sizeSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                customInput.style.display = 'block';
            } else {
                customInput.style.display = 'none';
            }
        });

        if (sizeSelect.value === 'custom') {
            customInput.style.display = 'block';
        }

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
        const customInput = document.getElementById('thumbnail-size-custom');

        let thumbnailSize;
        if (sizeSelect.value === 'custom') {
            thumbnailSize = customInput.value.trim();
            // Validate custom input
            if (!thumbnailSize || !thumbnailSize.match(/^\d+px$/)) {
                alert('กรุณากรอกขนาดรูปในรูปแบบที่ถูกต้อง ตัวอย่าง 120px (มี px ตามหลังด้วย)');
                return;
            }
        } else {
            thumbnailSize = sizeSelect.value;
        }

        const newSettings = {
            HIDE_GAY: document.getElementById('hide-gay').checked,
            THUMBNAIL_SIZE: thumbnailSize
        };

        // Save to storage
        GM_setValue('HIDE_GAY', newSettings.HIDE_GAY);
        GM_setValue('THUMBNAIL_SIZE', newSettings.THUMBNAIL_SIZE);

        // Update current settings
        Object.assign(settings, newSettings);

        hideSettingsPanel();

        window.location.reload();
    }

    function resetSettings() {
        if (confirm('Reset all settings to defaults?')) {
            GM_setValue('HIDE_GAY', defaultSettings.HIDE_GAY);
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

    function DownloadButton() {
        cleanupButtons();
        const posterRows = document.querySelectorAll('tr td[class="poster-column"]');
        const baseUrl = "https://bearbit.org/";

        posterRows.forEach(posterTd => {
            const row = posterTd.closest('tr');
            if (!row) return;

            const link = row.querySelector('td[width="900"] a[href^="details.php"]');
            if (!link) return;

            const vipButton = row.querySelector('[class^="vip-download-locked"]');
            if (!vipButton || vipButton.dataset.processed === 'true') return;

            vipButton.removeAttribute('href');

            const targetUrl = `${baseUrl}${link.getAttribute('href')}`;
            vipButton.dataset.targetUrl = targetUrl;
            vipButton.dataset.processed = 'true';

            const fileSizeSpan = vipButton.querySelector('span');

            // Store original state
            const originalState = {
                html: vipButton.innerHTML,
                cursor: vipButton.style.cursor
            };

            vipButton.style.cursor = 'pointer';
            vipButton.style.display = 'inline-block';
            vipButton.innerHTML = '📥 ดาวน์โหลด ';
            if (fileSizeSpan) {
                vipButton.appendChild(fileSizeSpan.cloneNode(true));
            }
            vipButton.title = 'คลิกเพื่อดาวน์โหลด';

            vipButton.removeEventListener('click', vipButton.clickHandler);

            vipButton.clickHandler = function(event) {
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
                        const downloadBtn = doc.querySelector('a[class^="bb-dl-btn"]');

                        if (downloadBtn) {
                            let downloadUrl = downloadBtn.getAttribute('href');
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

            vipButton.addEventListener('click', vipButton.clickHandler);
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

    function checkIfImagesVisible() {
        const toggleBtn = document.getElementById('toggle-posters-btn');
        if (!toggleBtn) return true;

        const btnText = toggleBtn.innerText || toggleBtn.textContent || '';

        return btnText.includes('แสดงรูปภาพ');
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

        const img = document.createElement('img');
        img.style.maxHeight = '90vh';
        img.style.maxWidth = '50vw';
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        img.style.display = 'block';
        img.style.borderRadius = '8px';

        container.appendChild(img);
        document.body.appendChild(container);

        return container;
    }

    window.addEventListener('beforeunload', () => {
        if (previewContainer) {
            previewContainer.remove();
            previewContainer = null;
        }
    });

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

        previewContainer.style.display = 'flex';
        previewContainer.style.alignItems = 'center';
        previewContainer.style.justifyContent = 'center';
        centerPreview(previewContainer);

        // Show loading state
        img.style.opacity = '0.5';

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

            const oldError = previewContainer.querySelector('.error-msg');
            if (oldError) oldError.remove();

            errorDiv.className = 'error-msg';
            previewContainer.appendChild(errorDiv);
        };

        testImg.src = imageUrl;
        img.src = imageUrl;
    }

    function hidePreview() {
        if (previewContainer) {
            previewContainer.style.display = 'none';
            const img = previewContainer.querySelector('img');
            if (img) {
                img.src = '';
                img.style.opacity = '1';
            }
            // Remove error message if exists
            const errorDiv = previewContainer.querySelector('.error-msg');
            if (errorDiv) errorDiv.remove();
        }
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
        currentLink = null;
    }

    document.addEventListener('mouseover', function(event) {
        if (!checkIfImagesVisible()) {
            return;
        }

        let target = event.target.closest('a');
        if (!target) return;

        const linkText = (target.innerText || target.textContent || '');
        if (!linkText.includes('ดูรูป') && !linkText.includes('📷')) return;

        const imageUrl = target.href;
        if (!imageUrl) return;

        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        currentLink = target;
        showPreview(imageUrl);
    });

    document.addEventListener('mouseout', function(event) {
        let target = event.target.closest('a');
        if (target && target === currentLink) {
            hidePreview();
        }
    });

    document.addEventListener('mouseleave', function() {
        hidePreview();
    });

    window.addEventListener('resize', function() {
        if (previewContainer && previewContainer.style.display !== 'none') {
            centerPreview(previewContainer);
        }
    });

    document.addEventListener('click', function(event) {
        const toggleBtn = event.target.closest('#toggle-posters-btn');
        if (toggleBtn) {
            setTimeout(() => {
                if (!checkIfImagesVisible()) {
                    hidePreview();
                }
            }, 50);
        }
    });


    function init() {
        DownloadButton();
        autoThank();
        hideGayContents();
        createSettingsButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
