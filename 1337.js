// ==UserScript==
// @name        Font Awesome Simple Downloader
// @namespace   Log
// @description Download SVG directly from Font Awesome CDN (v7.3+ aware)
// @author      simple
// @match       *://fontawesome.com/icons/*
// @run-at      document-end
// @version     2.0.2
// @grant       none
// ==/UserScript==

(() => {
    'use strict';
    console.log('[FA-DL] Starting...');

    // 從頁面已載入的 CSS link 動態取得當前 Font Awesome 版本號
    // 避免硬編碼版本——FA 升版後仍可運作
    function detectVersion() {
        const links = document.querySelectorAll('link[href*="site-assets.fontawesome.com/releases/v"]');
        for (const l of links) {
            const m = l.href.match(/releases\/v([\d.]+)\//);
            if (m) return m[1];
        }
        for (const s of document.scripts) {
            const m = (s.src || '').match(/releases\/v([\d.]+)\//);
            if (m) return m[1];
        }
        return '7.3.0';
    }

    // 取圖示資訊 — 優先從頁面 canonical / og 標籤拿，無論 URL 形式都穩定
    // 支援的 URL 表單:
    //   /icons/{iconName}?f={family}&s={style}           (舊)
    //   /icons/{family}/{style}/{iconName}               (新 — v7.3)
    function getIconInfo() {
        const canonical =
            document.querySelector('link[rel="canonical"]')?.href ||
            document.querySelector('meta[property="og:url"]')?.content || '';
        let m = canonical.match(/\/icons\/([^/]+)\/([^/]+)\/([^/?#]+)/);
        if (m) {
            return { family: m[1], style: m[2], iconName: decodeURIComponent(m[3]) };
        }

        // 備援 1：og:image 帶 ?f=&s= 形式
        const og = document.querySelector('meta[property="og:image"]')?.content || '';
        const im = og.match(/\/social\/([^?#]+)\?([^"]+)/);
        if (im) {
            const p = new URLSearchParams(im[2].replace(/&amp;/g, '&'));
            return {
                iconName: decodeURIComponent(im[1]),
                family: p.get('f') || 'classic',
                style: p.get('s') || 'solid',
            };
        }

        // 備援 2：解析當前 location（不一定可靠，但作最後一搏）
        const segs = window.location.pathname.split('/').filter(Boolean);
        const params = new URLSearchParams(window.location.search);
        if (segs[0] === 'icons' && segs.length >= 4) {
            return {
                family: segs[1],
                style: segs[2],
                iconName: decodeURIComponent(segs[3]),
            };
        }
        if (segs[0] === 'icons' && segs.length === 2) {
            return {
                iconName: decodeURIComponent(segs[1]),
                family: params.get('f') || 'classic',
                style: params.get('s') || 'solid',
            };
        }
        return null;
    }

    // family + style → svgs 子目錄候選清單（依實測結果排序）
    function buildSvgPaths(family, style) {
        const out = [];
        if (family === 'classic') {
            out.push(style);
            if (style !== 'brands') out.push('brands'); // brand 圖示走 /svgs/brands/
        } else if (family === 'duotone') {
            // 特例：duotone+solid 的資料夾是 'duotone' 而非 'duotone-solid'
            if (style === 'solid') {
                out.push('duotone');
            } else {
                out.push(`duotone-${style}`);
                out.push('duotone');
            }
        } else {
            // sharp / sharp-duotone / v7.3 新家族 (jelly / slab / chisel / etch / mosaic /
            // notdog / pixel / thumbprint / vellum / whiteboard / graphite / utility ...)
            out.push(`${family}-${style}`);
            // 對單一樣式家族（如 jelly 只有 regular）保留常見後綴 fallback
            for (const s of ['regular', 'solid', 'light', 'semibold', 'thin']) {
                if (s !== style) out.push(`${family}-${s}`);
            }
            out.push(family);
        }
        return [...new Set(out)];
    }

    async function downloadSVG() {
        const info = getIconInfo();
        if (!info) {
            showNotification('❌ Not on an icon page', 'error');
            return;
        }
        const { iconName, family, style } = info;
        const version = detectVersion();
        const paths = buildSvgPaths(family, style);

        console.log(`[FA-DL] v${version} | ${iconName} | f=${family} s=${style}`);

        // 組合所有候選 URL：**先 svgs-full/**（640×640 完整 canvas，不裁切上下）
        // 再 fallback 到 svgs/（512×512 legacy，會裁切高瘦圖示頂/底）
        const urls = [];
        for (const fmt of ['svgs-full', 'svgs']) {
            for (const path of paths) {
                urls.push(`https://site-assets.fontawesome.com/releases/v${version}/${fmt}/${path}/${iconName}.svg`);
            }
        }
        // ka-f.fontawesome.com 是備援 CDN
        urls.push(`https://ka-f.fontawesome.com/releases/v${version}/svgs-full/${paths[0]}/${iconName}.svg`);
        urls.push(`https://ka-f.fontawesome.com/releases/v${version}/svgs/${paths[0]}/${iconName}.svg`);

        console.log(`[FA-DL] 📥 Trying ${urls.length} URL(s)...`);

        for (const url of urls) {
            try {
                const res = await fetch(url, { credentials: 'omit' });
                if (!res.ok) {
                    console.log(`[FA-DL] ${res.status} ${url}`);
                    continue;
                }
                const text = await res.text();
                // 必須是真正的 SVG 內容，避免 HTML 錯誤頁被當成成功
                const head = text.trimStart();
                if (!head.startsWith('<svg') && !head.startsWith('<?xml')) {
                    console.log(`[FA-DL] not svg: ${url}`);
                    continue;
                }
                const folder = url.match(/\/svgs(?:-full)?\/([^/]+)\//)[1];
                const filename = `${iconName}-${folder}.svg`;
                triggerDownload(text, filename);
                console.log(`[FA-DL] ✅ ${url}`);
                showNotification(`Downloaded ${filename}`, 'success');
                return;
            } catch (e) {
                console.warn(`[FA-DL] fetch err ${url}`, e);
            }
        }
        showNotification('❌ All download attempts failed', 'error');
    }

    function triggerDownload(svg, filename) {
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showNotification(message, type = 'info') {
        const colors = { success: '#48bb78', error: '#f56565', info: '#4299e1' };
        const n = document.createElement('div');
        n.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            z-index: 9999999; background: ${colors[type]}; color: white;
            padding: 15px 30px; border-radius: 8px; font-family: sans-serif;
            font-size: 16px; font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    const BTN_ID = '__fa_dl_btn';
    function createButton() {
        if (document.getElementById(BTN_ID)) return;
        const button = document.createElement('button');
        button.id = BTN_ID;
        button.innerHTML = '⬇️ Download SVG';
        button.style.cssText = `
            position: fixed; bottom: 30px; right: 30px; z-index: 999999;
            padding: 16px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; border: none; border-radius: 12px;
            font-size: 16px; font-weight: bold; cursor: pointer;
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
        button.onmouseover = () => {
            button.style.transform = 'translateY(-2px) scale(1.05)';
            button.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5)';
        };
        button.onmouseout = () => {
            button.style.transform = 'translateY(0) scale(1)';
            button.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
        };
        button.onclick = downloadSVG;
        document.body.appendChild(button);
        console.log('[FA-DL] Button created');
    }

    // SPA 換頁不會 reload —— 監聽 URL 變化以確保按鈕一直存在
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (!document.getElementById(BTN_ID)) setTimeout(createButton, 300);
        }
    }).observe(document, { subtree: true, childList: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(createButton, 500));
    } else {
        setTimeout(createButton, 500);
    }
    console.log('[FA-DL] Ready');
})();
