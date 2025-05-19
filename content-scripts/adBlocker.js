(function() {
  // Configuration pour la connexion avec le script d'arrière-plan
  const protectionStatus = {
    enabled: true
  };
  
  // Liste des sélecteurs CSS couramment utilisés pour les publicités
  const adSelectors = [
    '.ad', 
    '.advertisement', 
    '.banner-ads', 
    '.sponsored',
    '[class*="ad-"]:not([class*="header"]):not([class*="logo"])',
    'iframe[src*="advertisement"]',
    'div[id*="google_ads"]',
    'ins.adsbygoogle',
    '.adsbygoogle',
    '[id*="banner"]',
    '[class*="banner"]',
    '[id*="advert"]',
    '[class*="advert"]',
    '.native-ad',
    '.promoted-content',
    '[id*="sponsor"]',
    '[class*="sponsor"]',
    '.ad-container',
    '.ad-wrapper'
  ];
  
  // Vérifier si la protection est activée
  chrome.storage.local.get(['protectionEnabled'], function(result) {
    if (result.protectionEnabled) {
      protectionStatus.enabled = result.protectionEnabled.adsTrackers;
    }
  });
  
  // Fonction pour masquer les éléments publicitaires
  function hideAds() {
    if (!protectionStatus.enabled) return;
    
    let count = 0;
    adSelectors.forEach(selector => {
      try {
        const ads = document.querySelectorAll(selector);
        ads.forEach(ad => {
          if (ad && !ad.dataset.adblocked) {
            ad.style.display = 'none';
            ad.dataset.adblocked = 'true';
            count++;
          }
        });
      } catch (e) {
        console.error("Erreur lors du masquage des publicités:", e);
      }
    });
    
    if (count > 0) {
      // Notifier le script d'arrière-plan
      chrome.runtime.sendMessage({
        action: "adsBlocked",
        count: count
      });
    }
  }
  
  // Observer les changements dans le DOM pour détecter les nouvelles publicités
  const observer = new MutationObserver(() => {
    setTimeout(hideAds, 100); // Petit délai pour laisser le DOM se stabiliser
  });
  
  // Configurer l'observateur
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Écouter les messages du background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "toggleProtection" && message.feature === "adsTrackers") {
      protectionStatus.enabled = message.enabled;
      if (message.enabled) {
        hideAds(); // Réappliquer le blocage si on active
      }
    }
  });
  
  // Exécuter une fois au chargement
  hideAds();
})();
