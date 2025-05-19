(function() {
  // Liste des scripts de suivi connus
  const knownTrackers = [
    'google-analytics.com/analytics.js',
    'facebook.net/en_US/fbevents.js',
    'connect.facebook.net',
    'platform.twitter.com',
    'ads.linkedin.com',
    'analytics.twitter.com',
    'doubleclick.net'
  ];
  
  // Bloquer les requêtes de traceurs et compter
  function blockTrackers() {
    let count = 0;
    
    // Observer les requêtes réseau n'est pas directement possible dans un script de contenu
    // Nous allons donc nous concentrer sur les scripts insérés
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && knownTrackers.some(tracker => src.includes(tracker))) {
        // Empêcher le chargement du script
        script.remove();
        count++;
      }
    });
    
    // Supprimer également les pixels de suivi
    const imgs = document.querySelectorAll('img[src*="pixel"], img[src*="beacon"], img[width="1"][height="1"]');
    imgs.forEach(img => {
      img.remove();
      count++;
    });
    
    if (count > 0) {
      // Notifier le script d'arrière-plan
      chrome.runtime.sendMessage({
        action: "trackersBlocked",
        count: count
      });
    }
  }
  
  // Exécuter dès que possible
  blockTrackers();
  
  // Observer les changements dans le DOM
  const observer = new MutationObserver(() => {
    blockTrackers();
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Bloquer les cookies tiers et les techniques de fingerprinting
  function setupPrivacyProtection() {
    // Remplacer la méthode navigator.sendBeacon pour bloquer les pings analytics
    if (navigator.sendBeacon) {
      const originalSendBeacon = navigator.sendBeacon;
      navigator.sendBeacon = function(url, data) {
        if (knownTrackers.some(tracker => url.includes(tracker))) {
          chrome.runtime.sendMessage({
            action: "trackersBlocked",
            count: 1
          });
          return false;
        }
        return originalSendBeacon.apply(this, arguments);
      };
    }
  }
  
  setupPrivacyProtection();
})();