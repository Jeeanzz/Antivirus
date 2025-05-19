document.addEventListener('DOMContentLoaded', function() {
  // Références aux éléments du DOM
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const currentDomainElement = document.getElementById('currentDomain');
  const totalBlockedElement = document.getElementById('totalBlockedForSite');
  const totalAdsTrackersElement = document.getElementById('totalAdsTrackers');
  const totalMalwareElement = document.getElementById('totalMalware');
  const totalScamsElement = document.getElementById('totalScams');

  // Initialiser la whitelist
  let whitelist = [];
  chrome.storage.local.get({ whitelist: [] }, function(result) {
    whitelist = result.whitelist;
  });

  // Obtenir le domaine actuel
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      currentDomainElement.textContent = url.hostname;
    }
  });

  // Gestion des onglets
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Désactiver tous les onglets
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Activer l'onglet cliqué
      button.classList.add('active');
      const tabId = button.id.replace('tab', '').toLowerCase() + 'Content';
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Obtenir les statistiques actuelles
  chrome.runtime.sendMessage({action: "getStats"}, function(response) {
    if (response) {
      updateUIStats(response.stats, response.totalStats);
    }
  });

  // Un seul listener pour les messages
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "addToWhitelist") {
      if (!whitelist.includes(message.domain)) {
        whitelist.push(message.domain);
        chrome.storage.local.set({ whitelist });
      }
      sendResponse && sendResponse({ success: true });
    } else if (message.action === "updateStats") {
      updateUIStats(message.stats, message.totalStats);
    }
    // Important pour les réponses asynchrones
    return true;
  });

  // Fonction pour mettre à jour l'UI avec les statistiques
  function updateUIStats(stats, totalStats) {
    // Mettre à jour les statistiques pour le site actuel
    const totalForSite = stats.adsBlocked + stats.trackersBlocked +
                         stats.malwareDetected + stats.scamsBlocked;
    totalBlockedElement.textContent = totalForSite;

    if (totalForSite > 0) {
      document.getElementById('blockStatus').textContent = "Menaces bloquées!";
    } else {
      document.getElementById('blockStatus').textContent = "Il n'y a rien à bloquer";
    }

    // Mettre à jour les statistiques totales
    totalAdsTrackersElement.textContent = totalStats.adsBlocked + totalStats.trackersBlocked;
    totalMalwareElement.textContent = totalStats.malwareDetected;
    totalScamsElement.textContent = totalStats.scamsBlocked;

    // Si vous utilisez un graphique, mettez-le à jour ici
    // updateStatsChart(totalStats);
  }

  // Gestion des interrupteurs de protection
  document.getElementById('toggleAdsTrackers').addEventListener('change', function(e) {
    chrome.runtime.sendMessage({
      action: "toggleProtection",
      feature: "adsTrackers",
      enabled: e.target.checked
    });
  });

  document.getElementById('toggleMalware').addEventListener('change', function(e) {
    chrome.runtime.sendMessage({
      action: "toggleProtection",
      feature: "malware",
      enabled: e.target.checked
    });
  });

  document.getElementById('toggleScams').addEventListener('change', function(e) {
    chrome.runtime.sendMessage({
      action: "toggleProtection",
      feature: "scams",
      enabled: e.target.checked
    });
  });

  document.getElementById('reportFalsePositive').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const domain = new URL(tabs[0].url).hostname;
      chrome.runtime.sendMessage({ action: "addToWhitelist", domain }, function(response) {
        if (response && response.success) {
          alert("Le domaine a été ajouté à la liste des exceptions.");
        }
      });
    });
  });
});