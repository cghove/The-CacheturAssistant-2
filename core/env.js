// [TCA2] core/env.js
(function() {
  'use strict';

  // Namespace
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};

  // Ensure jQuery globals for modules that expect `$` or `jQuery`
  try {
    if (typeof window.jQuery !== 'undefined') {
      root.$ = root.$ || window.jQuery;
      root.jQuery = root.jQuery || window.jQuery;
    }
  } catch (e) {}

  // Very small logger
  const logPrefix = "[TCA2]";
  const log = {
    info: (...args) => console.log(logPrefix, ...args),
    warn: (...args) => console.warn(logPrefix, ...args),
    error: (...args) => console.error(logPrefix, ...args),
    debug: (...args) => console.debug(logPrefix, ...args)
  };

  // Event bus (jQuery-based if available, else a tiny fallback)
  let bus;
  if (root.jQuery) {
    bus = root.jQuery({});
  } else {
    // Tiny event emitter fallback
    const listeners = {};
    bus = {
      on(evt, cb) { (listeners[evt] = listeners[evt] || []).push(cb); },
      off(evt, cb) {
        if (!listeners[evt]) return;
        const i = listeners[evt].indexOf(cb);
        if (i >= 0) listeners[evt].splice(i, 1);
      },
      trigger(evt, data) { (listeners[evt] || []).forEach(fn => fn({ type: evt }, data)); }
    };
  }

  // HTTP helper via Tampermonkey GM_xmlhttpRequest (no CORS preflight headers)
  function gmRequest(method, url, options = {}) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'undefined') {
        reject(new Error('GM_xmlhttpRequest is not available.'));
        return;
      }
      GM_xmlhttpRequest({
        method,
        url,
        headers: options.headers || {},
        responseType: options.responseType || 'text',
        anonymous: options.anonymous !== undefined ? options.anonymous : false, // allow cookies for cross-domain if present
        // withCredentials is honored by TM; anonymous:false is equivalent to with credentials.
        onload: function(resp) {
          if (resp.status >= 200 && resp.status < 300) {
            if (options.json) {
              try {
                const obj = typeof resp.response === 'object' ? resp.response : JSON.parse(resp.responseText);
                resolve(obj);
              } catch (e) {
                reject(e);
              }
            } else {
              resolve(resp.responseText);
            }
          } else {
            reject(new Error(`HTTP ${resp.status} for ${url}`));
          }
        },
        onerror: function(e) { reject(new Error(`Request failed for ${url}`)); },
        ontimeout: function() { reject(new Error(`Request timeout for ${url}`)); }
      });
    });
  }

  const http = {
    get: (url, opts) => gmRequest('GET', url, opts),
    post: (url, body, opts = {}) => gmRequest('POST', url, Object.assign({ data: body }, opts))
  };

  // Expose basics
  TCA2.log = log;
  TCA2.bus = {
    on: (...a) => bus.on ? bus.on(...a) : bus.addEventListener(...a),
    off: (...a) => bus.off ? bus.off(...a) : bus.removeEventListener(...a),
    emit: (evt, data) => bus.trigger ? bus.trigger(evt, data) : bus.dispatchEvent(new CustomEvent(evt, { detail: data }))
  };
  TCA2.http = http;
  TCA2.version = TCA2.version || '0.2.0';

  log.info('[core/env.js] Loaded');

  // Mark ready when DOM is available
  (function domReady() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(() => log.info('[core/env.js] Ready'), 0);
    } else {
      document.addEventListener('DOMContentLoaded', () => log.info('[core/env.js] Ready'));
    }
  })();

})();
