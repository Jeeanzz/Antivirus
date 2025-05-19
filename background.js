let adDomains = [];
let trackerDomains = [];
let maliciousDomains = [];

// Charger les listes depuis le stockage local au démarrage
chrome.storage.local.get(['remoteAdServers', 'remoteTrackers', 'remoteMalware'], (result) => {
  adDomains = result.remoteAdServers || [];
  trackerDomains = result.remoteTrackers || [];
  const malwareData = result.remoteMalware || {};
  maliciousDomains = malwareData.malwareURLs || [];
});

let whitelist = [];
chrome.storage.local.get(['whitelist'], (result) => {
  if (result.whitelist) {
    whitelist = result.whitelist;
  }
});

let statsForCurrentSite = {
  adsBlocked: 0,
  trackersBlocked: 0,
  malwareDetected: 0,
  scamsBlocked: 0
};

let totalStats = {
  adsBlocked: 0,
  trackersBlocked: 0,
  malwareDetected: 0,
  scamsBlocked: 0
};

chrome.storage.local.get(['totalStats'], (result) => {
  if (result.totalStats) {
    totalStats = result.totalStats;
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    const url = details.url;

    if (whitelist.some(domain => url.includes(domain))) {
      return { cancel: false };
    }

    if (isAdServer(url)) {
      statsForCurrentSite.adsBlocked++;
      totalStats.adsBlocked++;
      updateStats();
      return { cancel: true };
    }

    if (isTracker(url)) {
      statsForCurrentSite.trackersBlocked++;
      totalStats.trackersBlocked++;
      updateStats();
      return { cancel: true };
    }

    if (isMalicious(url)) {
      statsForCurrentSite.malwareDetected++;
      totalStats.malwareDetected++;
      updateStats();
      return { redirectUrl: chrome.runtime.getURL("warning.html") };
    }

    if (isPhishingURL(url)) {
      statsForCurrentSite.scamsBlocked++;
      totalStats.scamsBlocked++;
      updateStats();
      return { redirectUrl: chrome.runtime.getURL("warning.html") };
    }

    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

// Fonctions de détection basées sur les listes dynamiques
function isAdServer(url) {
  return adDomains.some(domain => url.includes(domain));
}

function isTracker(url) {
  return trackerDomains.some(domain => url.includes(domain));
}

function isMalicious(url) {
  return maliciousDomains.some(domain => url.includes(domain));
}

function isPhishingURL(url) {
  const phishingKeywords = [
    "verify your account", "unusual activity", "confirm your information",
    "account suspended", "update your payment", "please confirm your identity"
  ];
  const decodedUrl = decodeURIComponent(url.toLowerCase());
  return phishingKeywords.some(keyword => decodedUrl.includes(keyword));
}

// Met à jour les statistiques
function updateStats() {
  chrome.storage.local.set({ totalStats: totalStats });
  chrome.runtime.sendMessage({
    action: "updateStats",
    stats: statsForCurrentSite,
    totalStats: totalStats
  });
}

// Réinitialise les stats au changement de page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    statsForCurrentSite = {
      adsBlocked: 0,
      trackersBlocked: 0,
      malwareDetected: 0,
      scamsBlocked: 0
    };
  }
});

// Récupère les listes depuis l'API cloud
function fetchRemoteLists() {
  fetch('https://extension-backend-production-4e1d.up.railway.app/api/lists')
    .then(res => res.json())
    .then(data => {
      chrome.storage.local.set({
        remoteTrackers: data.trackers,
        remoteAdServers: data.adServers,
        remoteMalware: data.malwareSignatures
      });
      adDomains = data.adServers;
      trackerDomains = data.trackers;
      maliciousDomains = data.malwareSignatures.malwareURLs || [];
      console.log("✅ Listes de menaces mises à jour depuis l’API");
    })
    .catch(err => console.error("❌ Erreur de récupération des listes :", err));
}

// Met à jour les listes au démarrage et toutes les 24h
chrome.runtime.onStartup.addListener(() => {
  fetchRemoteLists();
});

chrome.alarms.create('refreshLists', { periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'refreshLists') {
    fetchRemoteLists();
  }
});

// Mise à jour immédiate dès le chargement
fetchRemoteLists();
