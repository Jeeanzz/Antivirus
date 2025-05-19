(function() {
  // Liste des sélecteurs CSS couramment utilisés pour les publicités
  const adSelectors = [
    '.ad', 
    '.advertisement', 
    '.banner-ads', 
    '.sponsored',
    '[class*="ad-"]:not([class*="header"]):not([class*="logo"])',
    'iframe[src*="advertisement"]',
    'div[id*="google_ads"]',
    'ins.adsbygoogle'
    // Vous pouvez ajouter d'autres sélecteurs...
  ];
  
  // Fonction pour masquer les éléments publicitaires
  function hideAds() {
    let count = 0;
    adSelectors.forEach(selector => {
      const ads = document.querySelectorAll(selector);
      ads.forEach(ad => {
        ad.style.display = 'none';
        count++;
      });
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
    hideAds();
  });
  
  // Configurer l'observateur
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Exécuter une fois au chargement
  hideAds();
})();