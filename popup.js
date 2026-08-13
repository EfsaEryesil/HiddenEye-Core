
const NPM_PACKAGE_MAP = {
  'jQuery': 'jquery',
  'Bootstrap': 'bootstrap',
  'FancyBox': '@fancyapps/ui',
  'Elementor': 'elementor',
  'Yoast SEO': 'yoast-seo',
  'Moment.js': 'moment',
  'Contact Form 7': 'contact-form-7'
};

let globalScanResults = []; 


async function fetchLatestNpmVersion(packageName) {
  const npmName = NPM_PACKAGE_MAP[packageName];
  if (!npmName) return null;

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "fetchNPM", package: npmName }, (response) => {
      resolve(response ? response.version : null);
    });
  });
}

function isOutdated(currentVer, latestVer) {
  if (!currentVer || !latestVer || currentVer === 'Unknown') return false;
  const currentParts = currentVer.split('.').map(Number);
  const latestParts = latestVer.split('.').map(Number);
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (c < l) return true;
    if (c > l) return false;
  }
  return false;
}

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.id || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
    hideLoading();
    document.getElementById('sec-score').innerText = "N/A";
    document.getElementById('results').innerHTML = `<div class="empty-box">SYSTEM PAGE - CANNOT INSPECT</div>`;
    return;
  }

  try {
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanPageTechnologies
    });

    let detectedTechs = (results && results[0] && results[0].result) ? results[0].result : [];

    
    try {
      const dynamicResults = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: "getDynamicTechs" }, (response) => {
          resolve(response ? response.techs : []);
        });
      });
      
      if (dynamicResults && dynamicResults.length > 0) {
        dynamicResults.forEach(dt => techsPushUnique(detectedTechs, dt));
      }
    } catch (msgErr) {
      
    }

    hideLoading();

    try {
      const headRes = await fetch(tab.url, { method: 'HEAD' });
      const headers = headRes.headers;

      const serverHeader = headers.get('server') || '';
      const xCdnHeader = headers.get('x-cdn') || '';

      if (serverHeader) techsPushUnique(detectedTechs, { name: 'Header: ' + serverHeader, version: 'Unknown', vendor: null, product: null });
      if (headers.get('x-powered-by')) techsPushUnique(detectedTechs, { name: 'Powered-By: ' + headers.get('x-powered-by'), version: 'Unknown', vendor: null, product: null });

      let wafDetected = null;
      if (serverHeader.includes('cloudflare')) wafDetected = 'Cloudflare WAF';
      else if (serverHeader.includes('imperva') || xCdnHeader.includes('imperva')) wafDetected = 'Imperva Incapsula';
      else if (serverHeader.includes('awselb') || headers.get('x-amz-cf-id')) wafDetected = 'AWS WAF';
      else if (headers.get('x-sucuri-id')) wafDetected = 'Sucuri Firewall';
      else if (headers.get('x-edgeconnect')) wafDetected = 'Akamai';

      if (wafDetected) {
        techsPushUnique(detectedTechs, { name: 'WAF: ' + wafDetected, version: 'Active', vendor: 'firewall', product: 'waf' });
      }

      let score = 'A+';
      let scoreClass = 'score-a';
      if (!headers.get('content-security-policy') || !headers.get('x-frame-options')) {
        score = 'RISK (B)';
        scoreClass = 'score-b';
      }
      if (!headers.get('strict-transport-security') && !headers.get('content-security-policy')) {
        score = 'POOR (F)';
        scoreClass = 'score-f';
      }

      const scoreElem = document.getElementById('sec-score');
      scoreElem.innerText = score;
      scoreElem.className = `score-badge ${scoreClass}`;

    } catch (e) {
      document.getElementById('sec-score').innerText = "SECURE";
    }

    try {
      const cookies = await chrome.cookies.getAll({ url: tab.url });
      let insecureCookies = 0;
      let noHttpOnlyCookies = 0;
      
      cookies.forEach(c => {
        if (!c.secure) insecureCookies++;
        if (!c.httpOnly) noHttpOnlyCookies++;
      });

      if (insecureCookies > 0 || noHttpOnlyCookies > 0) {
        techsPushUnique(detectedTechs, {
          name: 'Cookie Security Risk',
          version: 'Warning',
          vendor: 'cookie',
          product: 'security',
          insecureCount: insecureCookies,
          noHttpOnlyCount: noHttpOnlyCookies
        });
      }
    } catch (cookieErr) {}

    document.getElementById('tech-count').innerText = detectedTechs.length;
    globalScanResults = detectedTechs;

    if (detectedTechs.length === 0) {
      showEmptyState();
      return;
    }

    const resultsContainer = document.getElementById('results');

    await Promise.all(detectedTechs.map(async (tech) => {
      const card = document.createElement('div');
      card.className = 'tech-item';

      if (tech.vendor === 'firewall') {
        card.classList.add('secure-waf');
        card.innerHTML = `
          <div class="tech-row-top">
            <span class="tech-name" style="color: #10b981;">🛡️ ${tech.name}</span>
            <span class="tech-ver" style="background: #10b981; color: #fff; border-color: #10b981;">PROTECTED</span>
          </div>
          <div class="cve-status text-clean"><span class="status-dot dot-clean"></span> FIREWALL ACTIVE</div>
        `;
        resultsContainer.appendChild(card);
        return;
      }

      if (tech.vendor === 'cookie') {
        card.classList.add('outdated');
        card.innerHTML = `
          <div class="tech-row-top">
            <span class="tech-name" style="color: #f59e0b;">🍪 ${tech.name}</span>
            <span class="tech-ver" style="background: #f59e0b; color: #fff; border-color: #f59e0b;">RISK</span>
          </div>
          <div class="cve-status text-outdated"><span class="status-dot dot-outdated"></span> ${tech.insecureCount} lack Secure | ${tech.noHttpOnlyCount} lack HttpOnly</div>
        `;
        resultsContainer.appendChild(card);
        return;
      }

      if (tech.vendor === 'nginx' || tech.vendor === 'apache') {
         card.style.borderLeftColor = '#ff2a4b'; 
      }

      let statusHtml = '';
      let cveDetailsHtml = '';
      
      const latestVersion = await fetchLatestNpmVersion(tech.name);
      let isOut = isOutdated(tech.version, latestVersion);

      if (tech.version !== "Unknown" && tech.vendor && tech.product) {
        try {
          
          const data = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "fetchCVE", vendor: tech.vendor, product: tech.product }, (response) => {
              resolve(response);
            });
          });

          const shortVer = tech.version.split('.').slice(0, 2).join('.');

          const matchedCves = data.results ? data.results.filter(item => {
            const summary = item.summary ? item.summary.toLowerCase() : '';
            return summary.includes(tech.version.toLowerCase()) || summary.includes(shortVer.toLowerCase());
          }).slice(0, 3) : [];

          if (matchedCves.length > 0) {
            cveDetailsHtml = `<div class="cve-details-list">`;
            matchedCves.forEach(cve => {
              cveDetailsHtml += `<div class="cve-detail-item">📌 <strong>${cve.id || 'CVE Risk'}:</strong> ${cve.summary.substring(0, 70)}... <a href="https://nvd.nist.gov/vuln/detail/${cve.id}" target="_blank">Detail ↗</a></div>`;
            });
            cveDetailsHtml += `</div>`;
          }

          if (matchedCves.length > 0 && isOut) {
            card.classList.add('outdated');
            statusHtml = `<div class="cve-status text-outdated"><span class="status-dot dot-outdated"></span> OUTDATED VERSION (${matchedCves.length} CVE - CLICK)</div>`;
          } else if (matchedCves.length > 0) {
            card.classList.add('vulnerable');
            statusHtml = `<div class="cve-status text-vuln"><span class="status-dot dot-vuln"></span> VULNERABILITY DETECTED (${matchedCves.length} CVE - CLICK)</div>`;
          } else if (isOut) {
            card.classList.add('outdated');
            statusHtml = `<div class="cve-status text-outdated"><span class="status-dot dot-outdated"></span> OUTDATED VERSION (UPDATE RECOMMENDED)</div>`;
          } else {
            statusHtml = `<div class="cve-status text-clean"><span class="status-dot dot-clean"></span> NO KNOWN VULNERABILITIES</div>`;
          }
        } catch (e) {
          if (isOut) {
            card.classList.add('outdated');
            statusHtml = `<div class="cve-status text-outdated"><span class="status-dot dot-outdated"></span> OUTDATED VERSION (UPDATE RECOMMENDED)</div>`;
          } else {
            statusHtml = `<div class="cve-status text-clean"><span class="status-dot dot-clean"></span> NO KNOWN VULNERABILITIES</div>`;
          }
        }
      } else {
        statusHtml = `<div class="cve-status"><span class="status-dot dot-unknown"></span> VERSION UNDETECTED</div>`;
      }

      const displayVersion = tech.version !== 'Unknown' 
        ? (tech.version.startsWith('UA') || tech.version.startsWith('GA4') ? tech.version : 'v' + tech.version)
        : 'UNKN';

      card.innerHTML = `
        <div class="tech-row-top">
          <span class="tech-name">${tech.name}</span>
          <span class="tech-ver">${displayVersion}</span>
        </div>
        ${statusHtml}
        ${cveDetailsHtml}
      `;

      card.addEventListener('click', () => {
        const details = card.querySelector('.cve-details-list');
        if (details) {
          details.style.display = (details.style.display === 'block') ? 'none' : 'block';
        }
      });

      resultsContainer.appendChild(card);
    }));

  } catch (err) {
    hideLoading();
    showEmptyState();
  }
});

function techsPushUnique(list, item) {
  if (!list.some(t => t.name === item.name)) {
    list.push(item);
  }
}

document.getElementById('export-btn').addEventListener('click', () => {
  if (!globalScanResults || globalScanResults.length === 0) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalScanResults, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `HiddenEye_Report_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});

function hideLoading() {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.transform = 'scale(0.8)';
    setTimeout(() => { loader.style.display = 'none'; }, 300);
  }
}

function showEmptyState() {
  document.getElementById('tech-count').innerText = "0";
  document.getElementById('results').innerHTML = `<div class="empty-box">NO MATCHING FINGERPRINTS FOUND</div>`;
}


function scanPageTechnologies() {
  const techs = [];
  const html = document.documentElement.outerHTML;

  const getVer = (patterns) => {
    for (let p of patterns) {
      const m = html.match(p);
      if (m && m[1]) return m[1];
    }
    return 'Unknown';
  };

  if (html.includes('wp-content') || html.includes('wp-includes')) {
    const wpVer = getVer([/<meta name=["']generator["'] content=["']WordPress ([0-9.]+)["']/i, /\/wp-includes\/js\/wp-embed\.min\.js\?(?:ver=)?([0-9\.]+)/i]);
    techs.push({ name: 'WordPress', version: wpVer, vendor: 'wordpress', product: 'wordpress' });
  }

  if (html.includes('yoast-seo') || html.includes('Yoast SEO plugin')) {
    const yoastVer = getVer([/Yoast SEO plugin v([0-9.]+)/i, /yoast-seo\/[a-z0-9\/\.\_-]+\?(?:ver=)?([0-9\.]+)/i]);
    techs.push({ name: 'Yoast SEO', version: yoastVer, vendor: 'yoast', product: 'yoast_seo' });
  }

  if (html.includes('jquery')) {
    const jqVer = getVer([/jquery[.-]([0-9.]+)(?:\.min)?\.js/i, /jquery\.(?:min\.)?js\?(?:ver=)?([0-9\.]+)/i]);
    techs.push({ name: 'jQuery', version: jqVer, vendor: 'jquery', product: 'jquery' });
  }

  if (html.includes('moment.js') || html.includes('moment.min.js')) {
    const momentVer = getVer([/moment[.-]([0-9.]+)(?:\.min)?\.js/i, /moment\.js\/([0-9.]+)/i]);
    techs.push({ name: 'Moment.js', version: momentVer, vendor: 'momentjs', product: 'moment' });
  }

  if (html.includes('bootstrap')) {
    const bsVer = getVer([/bootstrap[.-]([0-9.]+)(?:\.min)?\.(?:js|css)/i, /bootstrap\/([0-9.]+)\/css/i, /v([0-9.]+)\/css\/bootstrap/i]);
    techs.push({ name: 'Bootstrap', version: bsVer, vendor: 'getbootstrap', product: 'bootstrap' });
  }

  if (html.includes('google-analytics.com/analytics.js') || /UA-[0-9]+-[0-9]+/.test(html)) {
    techs.push({ name: 'Google Analytics', version: 'UA (Legacy)', vendor: 'google', product: 'analytics' });
  } else if (html.includes('googletagmanager.com/gtag/js') || /G-[A-Z0-9]+/.test(html)) {
    techs.push({ name: 'Google Analytics', version: 'GA4', vendor: 'google', product: 'analytics' });
  }

  if (html.includes('pagead2.googlesyndication.com') || html.includes('adsbygoogle')) {
    techs.push({ name: 'Google AdSense', version: 'Unknown', vendor: 'google', product: 'adsense' });
  }

  const nginxLeak = html.match(/nginx\/([0-9\.]+)(?:\s\([^)]+\))?/i);
  if (nginxLeak && nginxLeak[1]) {
    techs.push({ name: '🚨 Backend Leak: Nginx', version: nginxLeak[1], vendor: 'nginx', product: 'nginx' });
  }

  const apacheLeak = html.match(/Apache\/([0-9\.]+)(?:\s\([^)]+\))?/i);
  if (apacheLeak && apacheLeak[1]) {
    techs.push({ name: '🚨 Backend Leak: Apache', version: apacheLeak[1], vendor: 'apache', product: 'http_server' });
  }

  return techs;
}

(function() {
  const _0x1a2b = atob("TWFkZSBieSBLcmFzbGlzS3JhbmFnaW4="); 
  const _0x3c4d = document.createElement("div");
  _0x3c4d.style.cssText = "font-family: var(--font-mono); font-size: 10px; color: #ff2a4b; text-align: center; padding: 6px; background: #090a0f; border-top: 1px dashed #1e2230; font-weight: 700; letter-spacing: 0.5px;";
  _0x3c4d.innerText = `// ${_0x1a2b} //`;
  document.body.appendChild(_0x3c4d);
})();