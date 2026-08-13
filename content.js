

let detectedTechs = [];

function analyzeDOM() {
  const html = document.documentElement.outerHTML;
  const scripts = Array.from(document.getElementsByTagName('script'));
  const metaTags = Array.from(document.getElementsByTagName('meta'));

  
  const isReact = document.querySelector('[data-reactroot], [data-reactid]') || 
                  scripts.some(s => s.src.includes('react'));
  if (isReact && !detectedTechs.some(t => t.name === 'React.js')) {
    detectedTechs.push({ name: 'React.js', version: 'Unknown', vendor: 'facebook', product: 'react' });
  }

  
  const isVue = document.querySelector('[data-v-]') || 
                scripts.some(s => s.src.includes('vue'));
  if (isVue && !detectedTechs.some(t => t.name === 'Vue.js')) {
    detectedTechs.push({ name: 'Vue.js', version: 'Unknown', vendor: 'vuejs', product: 'vue' });
  }
}


analyzeDOM();


const observer = new MutationObserver((mutations) => {

  if (mutations.some(m => m.addedNodes.length > 0)) {
    analyzeDOM();
  }
});


observer.observe(document.documentElement, { childList: true, subtree: true });


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getDynamicTechs") {
    sendResponse({ techs: detectedTechs });
  }
});