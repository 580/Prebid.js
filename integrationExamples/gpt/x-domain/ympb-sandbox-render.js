/**
 * Render a Prebid bid into an iframe ISOLATED from the publisher page (SafeFrame-style),
 * using the cross-domain postMessage path (secureCreatives.js) instead of pbjs.renderAd.
 *
 *     renderAdInSandbox({ adId, container, creativeUrl: 'https://your.cdn/ymCreative.html' });
 *
 * Isolation comes from ORIGIN, not from an opaque sandbox: serve `creativeUrl` from a domain
 * DIFFERENT than the publisher page (your CDN already is), so the creative is cross-origin to
 * the page and cannot touch its DOM. `allow-same-origin` is included on purpose — the
 * cross-domain bootstrap creates a nested renderer frame and reaches into it, which needs the
 * creative frame and its children to be same-origin. WITHOUT it every frame gets a distinct
 * opaque origin ("null") and the bootstrap throws
 *   "Blocked a frame with origin 'null' from accessing a cross-origin frame".
 * On a cross-origin CDN load, allow-same-origin only keeps the real CDN origin — it does NOT
 * grant access to the publisher page.
 *
 * INVARIANT: never host the creative on the publisher's own domain, or allow-same-origin
 * would let it reach the page.
 *
 * Audio: muting is enforced INSIDE ymCreative.html (the mute guard), because the page cannot
 * reach into this cross-origin frame. Media may autoplay, but only muted. No `allow="autoplay"`
 * is set here, so cross-origin sub-frames are also limited to muted autoplay by the browser.
 *
 * Requirements (already satisfied in this fork):
 *  - Prebid runs on the top page and calls listenMessagesFromCreative() + insertLocatorFrame()
 *    at init (src/prebid.js).
 *  - The iframe is a direct descendant of the page where Prebid runs, so the creative can walk
 *    up to the __pb_locator__ frame.
 *
 * Auto-resize: Prebid's resizeRemoteCreative() (src/secureCreatives.js) resizes by looking up
 * `document.getElementById(id).querySelector('div,iframe')`, where `id` is the GAM slot element
 * id (getYmpbDfpElementId) or falls back to the adUnitCode. Give `container` an id equal to that
 * value and keep the iframe inside it, or pass explicit width/height (resize then no-ops).
 *
 * @param {Object}        opts
 * @param {string}        opts.adId
 * @param {HTMLElement}   opts.container
 * @param {string}        opts.creativeUrl   Absolute URL of the hosted ymCreative.html.
 * @param {number|string} [opts.width]
 * @param {number|string} [opts.height]
 * @param {string}        [opts.clickUrl]
 * @returns {HTMLIFrameElement}
 */
export function renderAdInSandbox({ adId, container, creativeUrl, width, height, clickUrl }) {
  if (!adId) throw new Error('renderAdInSandbox: adId is required');
  if (!container) throw new Error('renderAdInSandbox: container is required');
  if (!creativeUrl) throw new Error('renderAdInSandbox: creativeUrl is required');

  const iframe = document.createElement('iframe');

  // Cross-origin CDN load isolates from the page; allow-same-origin keeps the creative
  // same-origin to its own child frames so the bootstrap works. Never host on the
  // publisher's own domain. No allow="autoplay" — never delegate autoplay-with-sound.
  iframe.sandbox = 'allow-scripts allow-same-origin';

  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('frameborder', '0');
  iframe.style.border = '0';
  iframe.style.display = 'block';
  if (width != null) iframe.width = String(width);
  if (height != null) iframe.height = String(height);

  const url = new URL(creativeUrl);
  url.searchParams.set('adId', adId);
  // Must be the URL of THIS (Prebid) page — the postMessage targetOrigin used by the creative.
  url.searchParams.set('pubUrl', window.location.href);
  if (clickUrl) url.searchParams.set('clickUrl', clickUrl);
  iframe.src = url.toString();

  container.appendChild(iframe);
  return iframe;
}
