document.addEventListener('DOMContentLoaded', function() {
  // Références aux éléments du DOM
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const currentDomainElement = document.getElementById('currentDomain');
  const totalBlockedElement = document.getElementById('totalBlockedForSite');
  const totalAdsTrackersElement = document.getElementById('totalAdsTrackers');
  const totalMalwareElement = document.getElementById('totalMalware');
  const totalScamsElement = document.getElementById('totalScams');
  const blockStatusElement = document.getElementById('blockStatus');
  
  // Commutateurs de protection
  const toggleAdsTrackers = document.getElementById('toggleAdsTrackers');
  const toggleMalware = document.getElementById('toggleMalware');
  const toggleScams = document.getElementById('toggleScams');
  
  // État des protections
  let protectionSettings = {
    adsTrackers: true,
    malware: true,
    scams: true
  };
  
  // Initialiser la whitelist
  let whitelist = [];
  
  // Récupérer les paramètres de protection et la liste blanche
  chrome.storage.local.get(['protectionEnabled', 'whitelist'], function(result) {
    if (result.protectionEnabled) {
      protectionSettings = result.protectionEnabled;
      toggleAdsTrackers.checked = protectionSettings.adsTrackers;
      toggleMalware.checked = protectionSettings.malware;
      toggleScams.checked = protectionSettings.scams;
    }
    
    if (result.whitelist) {
      whitelist = result.whitelist;
    }
  });

  // Obtenir le domaine actuel
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].url) {
      try {
        const url = new URL(tabs[0].url);
        currentDomainElement.textContent = url.hostname;
        
        // Vérifier si le domaine est dans la liste blanche
        if (whitelist.includes(url.hostname)) {
          blockStatusElement.textContent = "Ce site est dans votre liste blanche";
        }
      } catch (e) {
        console.error("Erreur lors de l'analyse de l'URL:", e);
        currentDomainElement.textContent = "Inconnu";
      }
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
      const tabId = button.id.replace('tab', '') + 'Content';
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Obtenir les statistiques actuelles
  chrome.runtime.sendMessage({action: "getStats"}, function(response) {
    if (response) {
      updateUIStats(response.stats, response.totalStats);
      updateStatsChart(response.totalStats);
    }
  });

  // Écouter les mises à jour de statistiques
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "updateStats") {
      updateUIStats(message.stats, message.totalStats);
      updateStatsChart(message.totalStats);
      return true;
    }
    
    // Important pour les réponses asynchrones
    return true;
  });

  // Fonction pour mettre à jour l'interface avec les statistiques
  function updateUIStats(stats, totalStats) {
    if (!stats || !totalStats) return;
    
    // Mettre à jour les statistiques pour le site actuel
    const totalForSite = (stats.adsBlocked || 0) + (stats.trackersBlocked || 0) +
                        (stats.malwareDetected || 0) + (stats.scamsBlocked || 0);
    totalBlockedElement.textContent = totalForSite;

    if (totalForSite > 0) {
      blockStatusElement.textContent = totalForSite + " menaces bloquées!";
      blockStatusElement.style.color = "#e74c3c";
    } else {
      blockStatusElement.textContent = "Aucune menace détectée";
      blockStatusElement.style.color = "#2ecc71";
    }

    // Mettre à jour les statistiques totales
    totalAdsTrackersElement.textContent = (totalStats.adsBlocked || 0) + (totalStats.trackersBlocked || 0);
    totalMalwareElement.textContent = totalStats.malwareDetected || 0;
    totalScamsElement.textContent = totalStats.scamsBlocked || 0;
  }
  
  // Initialiser et mettre à jour le graphique de statistiques
  let statsChart = null;
  function updateStatsChart(totalStats) {
    if (!totalStats) return;
    
    const ctx = document.getElementById('statsChart').getContext('2d');
    
    // Données pour le graphique
    const data = {
      labels: ['Ads/Trackers', 'Malware', 'Scams'],
      datasets: [{
        label: 'Menaces bloquées',
        data: [
          (totalStats.adsBlocked || 0) + (totalStats.trackersBlocked || 0),
          totalStats.malwareDetected || 0,
          totalStats.scamsBlocked || 0
        ],
        backgroundColor: [
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 99, 132, 0.5)',
          'rgba(255, 206, 86, 0.5)'
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 206, 86, 1)'
        ],
        borderWidth: 1
      }]
    };
    
    // Options du graphique
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    };
    
    // Créer ou mettre à jour le graphique
    if (statsChart) {
      statsChart.data = data;
      statsChart.update();
    } else {
      statsChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: options
      });
    }
  }

  // Gestion des interrupteurs de protection
  toggleAdsTrackers.addEventListener('change', function(e) {
    const enabled = e.target.checked;
    protectionSettings.adsTrackers = enabled;
    
    chrome.runtime.sendMessage({
      action: "toggleProtection",
      feature: "adsTrackers",
      enabled: enabled
    }, function(response) {
      if (response && response.success) {
        console.log("Protection Ads/Trackers " + (enabled ? "activée" : "désactivée"));
      }
    });
  });

  toggleMalware.addEventListener('change', function(e) {
    const enabled = e.target.checked;
    protectionSettings.malware = enabled;
    
    chrome.runtime.sendMessage({
      action: "toggleProtection",
      feature: "malware",
      enabled: enabled
    }, function(response) {
      if (response && response.success) {
        console.log("Protection Malware " + (enabled ? "activée" : "désactivée"));
      }
    });
  });

  toggleScams.addEventListener('change', function(e) {
    const enabled = e.target.checked;
    protectionSettings.scams = enabled;
    
    chrome.runtime.sendMessage({
      action: "toggleProtection",
      feature: "scams",
      enabled: enabled
    }, function(response) {
      if (response && response.success) {
        console.log("Protection Scams " + (enabled ? "activée" : "désactivée"));
      }
    });
  });

  // Gestion du bouton de signalement de faux positif
  document.getElementById('reportFalsePositive').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url) {
        try {
          const domain = new URL(tabs[0].url).hostname;
          
          if (!whitelist.includes(domain)) {
            whitelist.push(domain);
            chrome.storage.local.set({ whitelist }, function() {
              chrome.runtime.sendMessage({ 
                action: "addToWhitelist", 
                domain: domain 
              }, function(response) {
                if (response && response.success) {
                  alert("Le domaine " + domain + " a été ajouté à la liste des exceptions.");
                  blockStatusElement.textContent = "Ce site est dans votre liste blanche";
                }
              });
            });
          } else {
            alert("Ce domaine est déjà dans votre liste d'exceptions.");
          }
        } catch (e) {
          console.error("Erreur lors de l'ajout à la whitelist:", e);
        }
      }
    });
  });
  
  // Gestion des boutons de mise à niveau
  document.querySelectorAll('.upgrade-button').forEach(button => {
    button.addEventListener('click', function() {
      if (this.id === 'upgradeVPN' || this.id === 'upgradePlan') {
        window.open('https://www.example.com/pricing', '_blank');
      }
    });
  });
  
  // Gestion du changement de période pour les statistiques
  document.getElementById('statsPeriod').addEventListener('change', function(e) {
    const period = e.target.value;
    // Ici, vous pourriez récupérer des statistiques spécifiques à la période
    // Pour l'instant, cela ne fait que mettre à jour le titre
    
    let title = "Cette semaine";
    if (period === "month") {
      title = "Ce mois";
    } else if (period === "all") {
      title = "Tout le temps";
    }
    
    e.target.previousElementSibling.textContent = title;
  });
  
  // Gestion du lien "Afficher plus d'historique"
  document.getElementById('showMoreHistory').addEventListener('click', function(e) {
    e.preventDefault();
    window.open('https://www.example.com/history', '_blank');
  });
});
