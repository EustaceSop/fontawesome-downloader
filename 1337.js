// ==UserScript==
// @name        Font Awesome Simple Downloader
// @namespace   Log
// @description Download SVG directly from Font Awesome CDN
// @author      simple
// @match       *://fontawesome.com/icons/*
// @run-at      document-end
// @version     1.0.0
// @grant       none
// ==/UserScript==

(() => {
    console.log("[Log] Starting...");
    
    // 从 URL 获取图标信息
    function getIconInfo() {
        const match = window.location.pathname.match(/\/icons\/([^/?]+)/);
        if (!match) return null;
        
        const iconName = match[1];
        const params = new URLSearchParams(window.location.search);
        const family = params.get('f') || 'classic';
        const style = params.get('s') || 'solid';
        
        return { iconName, family, style };
    }
    
    // 下载 SVG
    async function downloadSVG() {
        const info = getIconInfo();
        if (!info) {
            alert('❌ Not on an icon page');
            return;
        }
        
        const { iconName, family, style } = info;
        
        // 根据日志，Font Awesome 使用这些 CDN URL
        const urls = [
            `https://site-assets.fontawesome.com/releases/v7.2.0/svgs/${style}/${iconName}.svg`,
            `https://site-assets.fontawesome.com/releases/v7.2.0/svgs-full/${style}/${iconName}.svg`,
            `https://ka-f.fontawesome.com/releases/v7.1.0/svgs/${style}/${iconName}.svg`,
            `https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/${style}/${iconName}.svg`,
        ];
        
        console.log(`[Log] 📥 Downloading ${iconName} (${style})...`);
        
        for (const url of urls) {
            try {
                console.log(`[Log] Trying: ${url}`);
                const response = await fetch(url);
                
                if (response.ok) {
                    const svg = await response.text();
                    
                    // 下载文件
                    const blob = new Blob([svg], { type: 'image/svg+xml' });
                    const downloadUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `${iconName}-${style}.svg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(downloadUrl);
                    
                    console.log(`[Log] Downloaded from: ${url}`);
                    showNotification(`Downloaded ${iconName}-${style}.svg`, 'success');
                    return;
                }
            } catch (e) {
                console.log(`[Log] ❌ Failed: ${url}`, e);
            }
        }
        
        showNotification('❌ All download attempts failed', 'error');
    }
    
    // 显示通知
    function showNotification(message, type = 'info') {
        const colors = {
            success: '#48bb78',
            error: '#f56565',
            info: '#4299e1'
        };
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999999;
            background: ${colors[type]};
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            font-family: sans-serif;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // 创建下载按钮
    function createButton() {
        const button = document.createElement('button');
        button.innerHTML = '⬇️ Download SVG';
        button.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 999999;
            padding: 16px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
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
        console.log("[Log] Button created");
    }
    
    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(createButton, 1000);
        });
    } else {
        setTimeout(createButton, 1000);
    }
    
    console.log("[Log] Ready!");
})();
