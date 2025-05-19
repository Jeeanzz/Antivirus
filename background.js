// Variables globales pour stocker les listes de domaines à bloquer
let adDomains = [];
let trackerDomains = [];
let maliciousDomains = [];

// Flags pour activer/désactiver les protections
let protectionEnabled = {
  adsTrackers: true,
  malware: true,
  scams: true
};

// Charger les listes depuis le stockage local au démarrage
chrome.storage.local.get(['remoteAdServers', 'remoteTrackers', 'remoteMalware', 'protectionEnabled'], (result) => {
  adDomains = result.remoteAdServers || [];
  trackerDomains = result.remoteTrackers || [];
  const malwareData = result.remoteMalware || {};
  maliciousDomains = malwareData.malwareURLs || [];
  
  if (result.protectionEnabled) {
    protectionEnabled = result.protectionEnabled;
  } else {
    // Initialiser les préférences si elles n'existent pas
    chrome.storage.local.set({ protectionEnabled });
  }
});

// Liste blanche pour les domaines approuvés
let whitelist = [];
chrome.storage.local.get(['whitelist'], (result) => {
  if (result.whitelist) {
    whitelist = result.whitelist;
  }
});

// Statistiques pour le site actuel
let statsForCurrentSite = {
  adsBlocked: 0,
  trackersBlocked: 0,
  malwareDetected: 0,
  scamsBlocked: 0
};

// Statistiques globales
let totalStats = {
  adsBlocked: 0,
  trackersBlocked: 0,
  malwareDetected: 0,
  scamsBlocked: 0
};

// Charger les statistiques totales
chrome.storage.local.get(['totalStats'], (result) => {
  if (result.totalStats) {
    totalStats = result.totalStats;
  }
});

// Filtrer les requêtes web pour bloquer les domaines malveillants
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    const url = details.url;

    // Vérifier si le domaine est dans la liste blanche
    if (whitelist.some(domain => url.includes(domain))) {
      return { cancel: false };
    }

    // Bloquer les publicités si la protection est activée
    if (protectionEnabled.adsTrackers && isAdServer(url)) {
      statsForCurrentSite.adsBlocked++;
      totalStats.adsBlocked++;
      updateStats();
      return { cancel: true };
    }

    // Bloquer les trackers si la protection est activée
    if (protectionEnabled.adsTrackers && isTracker(url)) {
      statsForCurrentSite.trackersBlocked++;
      totalStats.trackersBlocked++;
      updateStats();
      return { cancel: true };
    }

    // Bloquer les malwares si la protection est activée
    if (protectionEnabled.malware && isMalicious(url)) {
      statsForCurrentSite.malwareDetected++;
      totalStats.malwareDetected++;
      updateStats();
      return { redirectUrl: chrome.runtime.getURL("warning.html") };
    }

    // Bloquer les scams si la protection est activée
    if (protectionEnabled.scams && isPhishingURL(url)) {
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

// Met à jour les statistiques et notifie l'interface utilisateur
function updateStats() {
  chrome.storage.local.set({ totalStats: totalStats });
  // Envoyer un message à tous les content scripts actifs et au popup s'il est ouvert
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
    
    // Notifier le changement
    updateStats();
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
      console.log("✅ Listes de menaces mises à jour depuis l'API");
    })
    .catch(err => console.error("❌ Erreur de récupération des listes :", err));
}

// Gérer les messages depuis les content scripts et le popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Répondre aux demandes de statistiques
  if (message.action === "getStats") {
    sendResponse({
      stats: statsForCurrentSite,
      totalStats: totalStats
    });
  }
  // Gérer l'ajout à la liste blanche
  else if (message.action === "addToWhitelist") {
    if (!whitelist.includes(message.domain)) {
      whitelist.push(message.domain);
      chrome.storage.local.set({ whitelist });
      sendResponse({ success: true });
    }
  }
  // Gérer les activations/désactivations de protections
  else if (message.action === "toggleProtection") {
    protectionEnabled[message.feature] = message.enabled;
    chrome.storage.local.set({ protectionEnabled });
    sendResponse({ success: true });
  }
  // Recevoir les notifications de blocage des content scripts
  else if (message.action === "adsBlocked") {
    statsForCurrentSite.adsBlocked += message.count || 1;
    totalStats.adsBlocked += message.count || 1;
    updateStats();
  }
  else if (message.action === "trackersBlocked") {
    statsForCurrentSite.trackersBlocked += message.count || 1;
    totalStats.trackersBlocked += message.count || 1;
    updateStats();
  }
  else if (message.action === "malwareDetected") {
    statsForCurrentSite.malwareDetected += message.count || 1;
    totalStats.malwareDetected += message.count || 1;
    updateStats();
  }
  else if (message.action === "scamDetected") {
    statsForCurrentSite.scamsBlocked += message.count || 1;
    totalStats.scamsBlocked += message.count || 1;
    updateStats();
  }
  
  // Important pour permettre les réponses asynchrones
  return true;
});

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
