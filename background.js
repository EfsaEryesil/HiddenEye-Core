

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  
  if (request.action === "fetchNPM") {
    fetch(`https://registry.npmjs.org/${request.package}/latest`)
      .then(res => res.json())
      .then(data => sendResponse({ version: data.version || null }))
      .catch(() => sendResponse({ version: null }));
    return true; 
  }

  
  if (request.action === "fetchCVE") {
    fetch(`https://cve.circl.lu/api/search/${request.vendor}/${request.product}`)
      .then(res => res.json())
      .then(data => sendResponse({ results: data.results || [] }))
      .catch(() => sendResponse({ results: [] }));
    return true; 
  }
});