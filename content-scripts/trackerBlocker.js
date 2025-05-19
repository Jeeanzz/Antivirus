(function() {
  // État de la protection
  const protectionStatus = {
    enabled: true
  };
  
  // Vérifier si la protection est activée
  chrome.storage.local.get(['protectionEnabled'], function(result) {
    if (result.protectionEnabled) {
      protectionStatus.enabled = result.protectionEnabled.adsTrackers;
    }
  });
  
  // Liste des scripts de suivi connus
  const knownTrackers = [
    'google-analytics.com/analytics.js',
    'facebook.net/en_US/fbevents.js',
    'connect.facebook.net',
    'platform.twitter.com',
    'ads.linkedin.com',
    'analytics.twitter.com',
    'doubleclick.net',
    'googletagmanager.com',
    'scorecardresearch.com',
    'amazon-adsystem.com',
    'criteo.com',
    'adsrvr.org',
    'taboola.com',
    'outbrain.com',
    'chartbeat.com',
    '.quantserve.com',
    'hotjar.com',
    'adnxs.com',
    'sharethis.com',
    'yandex.ru/metrika',
    'optimizely.com'
  ];
  
  // Bloquer les requêtes de traceurs et compter
  function blockTrackers() {
    if (!protectionStatus.enabled) return;
    
    let count = 0;
    
    // Observer les scripts insérés
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
      const src = script.getAttribute('src') || '';
      if (knownTrackers.some(tracker => src.includes(tracker))) {
        if (!script.dataset.blocked) {
          script.dataset.blocked = 'true';
          script.remove();
          count++;
        }
      }
    });
    
    // Supprimer également les pixels de suivi
    const imgs = document.querySelectorAll('img[src*="pixel"], img[src*="beacon"], img[width="1"][height="1"]');
    imgs.forEach(img => {
      if (!img.dataset.blocked) {
        img.dataset.blocked = 'true';
        img.remove();
        count++;
      }
    });
    
    // Vérifier les iframes de suivi
    const iframes = document.querySelectorAll('iframe[src]');
    iframes.forEach(iframe => {
      const src = iframe.getAttribute('src') || '';
      if (knownTrackers.some(tracker => src.includes(tracker))) {
        if (!iframe.dataset.blocked) {
          iframe.dataset.blocked = 'true';
          iframe.remove();
          count++;
        }
      }
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
    setTimeout(blockTrackers, 100); // Petit délai pour laisser le DOM se stabiliser
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Bloquer les cookies tiers et les techniques de fingerprinting
  function setupPrivacyProtection() {
    if (!protectionStatus.enabled) return;
    
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
    
    // Bloquer certaines méthodes de fingerprinting
    if (document.cookie) {
      const originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
      Object.defineProperty(Document.prototype, 'cookie', {
        get: function() {
          return originalCookie.get.apply(this);
        },
        set: function(val) {
          // Bloquer les cookies contenant des identifiants de traceurs connus
          if (knownTrackers.some(tracker => val.includes(tracker))) {
            chrome.runtime.sendMessage({
              action: "trackersBlocked",
              count: 1
            });
            return '';
          }
          return originalCookie.set.apply(this, arguments);
        }
      });
    }
  }
  
  // Écouter les messages du background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "toggleProtection" && message.feature === "adsTrackers") {
      protectionStatus.enabled = message.enabled;
      if (message.enabled) {
        blockTrackers(); // Réappliquer le blocage si on active
      }
    }
  });
  
  setupPrivacyProtection();
})();
