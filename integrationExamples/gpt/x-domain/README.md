# Cross-domain (SafeFrame-style) rendering, with audio disabled

Render a Prebid bid inside an iframe **isolated from the publisher page** and with **sound
hard-disabled** (muted autoplay allowed, never with audio), using the cross-domain
postMessage path (`src/secureCreatives.js`) instead of `pbjs.renderAd` / `renderAdDirect`.

`renderAdDirect` writes into the target document from the parent window, which requires the
creative frame to be **same-origin with Prebid** (a *friendly* iframe). The postMessage path
never touches the creative's DOM from the page, so the creative can be isolated.

## Isolation comes from ORIGIN, not from an opaque sandbox

Isolate the creative the way SafeFrame does: **serve it from a domain different from the
publisher page** (your CDN already is). That makes it cross-origin to the page, so it cannot
touch the page DOM.

Do **not** try to isolate it with `sandbox="allow-scripts"` *without* `allow-same-origin`.
The cross-domain bootstrap creates a **nested** renderer iframe and reaches into its
`contentWindow` (`W.Promise` / `W.render`) and renders into the creative window — that needs
the creative frame and its child frames to be **same-origin**. An opaque sandbox gives every
frame a **distinct opaque origin ("null")**, so you get:

```
SecurityError: Blocked a frame with origin "null" from accessing a cross-origin frame.
```

Use `sandbox="allow-scripts allow-same-origin"`. On a cross-origin CDN load,
`allow-same-origin` just means "keep your real CDN origin" — still cross-origin to (isolated
from) the publisher page, but same-origin to its own child frames so the bootstrap works.

**INVARIANT:** never host the creative on the publisher's own domain — with
`allow-same-origin` it could then reach the page.

## Audio disabled (muted autoplay only)

Browsers always allow *muted* autoplay; autoplay *with sound* needs a permission the frame
won't get. The page cannot reach into this cross-origin creative, so muting is enforced
**inside `ymCreative.html`** by a mute guard (script #1) that runs before the ad renders:

- Locks `muted=true` / `volume=0` on the media prototype of the creative realm **and** of
  every **same-origin** child frame the renderer creates (the ad renders into a nested
  `srcdoc` iframe), via a `MutationObserver` + `load` handler, and mutes any media already
  present.
- Silences the **Web Audio API** (best-effort) in each locked realm by routing any connection
  to the `AudioContext` destination through a zero-gain node — covers audio not tied to a
  muted media element.
- `renderAdInSandbox` adds **no** `allow="autoplay"`, so a nested **cross-origin** ad frame
  (e.g. an `adUrl` on another origin, which the guard can't reach) is still limited to muted
  autoplay by the browser.
- Residual gaps: a **cross-origin** nested ad frame is beyond the guard's reach (browser still
  limits it to muted autoplay), and exotic Web Audio graphs that never connect to
  `context.destination` in the usual way could evade the zero-gain routing.

## Files

| File | Role |
|------|------|
| `ymCreative.html` | Hosted creative. Deploy to your CDN. Mute guard + bootstrap + reads `adId`/`pubUrl` from the query string and calls `pbRender`. |
| `ympb-sandbox-render.js` | Page-side `renderAdInSandbox({adId, container, creativeUrl})` — replaces `pbjs.renderAd(iframeDoc, adId)`. |
| `ympb-sandbox-test.html` | Runnable local test: one AppNexus test bid → renders via the sandboxed iframe. |

`creative.html` (also here) is the **ad-server** variant using `%%PATTERN%%` macros;
`ymCreative.html` is the query-string-driven variant for client-side (local) rendering, plus
the mute guard.

## How it works

1. Page builds an iframe (`sandbox="allow-scripts allow-same-origin"`) whose `src` is the
   hosted creative on a cross-origin CDN, with `?adId=<id>&pubUrl=<prebid page url>`.
2. Browser loads the creative from its CDN origin (cross-origin to the page). The mute guard
   installs, then the bootstrap (`window.pbRender`) walks up parent frames to the
   `__pb_locator__` frame (the Prebid window) and posts a `Prebid Request` (with a
   `MessageChannel` port), using `pubUrl`'s origin as `postMessage` targetOrigin.
3. `secureCreatives.receiveMessage` → `handleRenderRequest` replies over the port with
   `{message:'Prebid Response', renderer:<display-renderer source>, ...renderingData}`.
4. The bootstrap eval's the renderer and calls `render(...)`, which appends the ad iframe
   inside the creative's own document — the mute guard catches that frame and locks it.
5. Resize flows back via `sendMessage` → `getResizer` → `resizeRemoteCreative`;
   `AD_RENDER_SUCCEEDED` fires in Prebid.

The Prebid receiving side needs **no changes**: `prebid.js` already calls
`listenMessagesFromCreative()` and `insertLocatorFrame()` at init.

## Local test

```bash
gulp build-bundle-dev      # -> build/dev/prebid.js
gulp build-creative-dev    # -> build/creative/creative.js
gulp serve                 # or: gulp review-start
# open http://localhost:9999/integrationExamples/gpt/x-domain/ympb-sandbox-test.html
```
Locally the creative is same-origin to the page, so this validates the render mechanism
only, not isolation (which requires a separate domain in production). The AppNexus test
placement is a banner; to exercise the mute guard, render a bid whose creative has a
`<video autoplay>` with audio and confirm it plays silently.

## Using it from YollaSuiteTemplate3

### 1. Deploy the creative to your CDN

Host `ymCreative.html` at a stable public URL on a domain **different from the publisher
page**, e.g. `https://portal.cdn.yollamedia.com/ymCreative.html`.

- Fully static — `adId`/`pubUrl` arrive as query params, so one file serves all publishers.
- **Keep the inlined bootstrap in sync with the Prebid version inside `ympb.js`
  (currently 9.53.5).** If you bump Prebid, regenerate with `gulp build-creative-prod` and
  re-copy the bootstrap `<script>` blob (script #2) into `ymCreative.html`.
- Version the filename (`ymCreative.v1.html`) or cache-bust so a protocol change isn't served
  stale.

### 2. Add the render helper (TypeScript)

`src/admanagement/helper/renderAdInSandbox.ts`:

```ts
export interface SandboxRenderOpts {
  adId: string;
  container: HTMLElement;
  creativeUrl: string;      // your hosted ymCreative.html (different domain than the page)
  width?: number | string;
  height?: number | string;
  clickUrl?: string;
}

export function renderAdInSandbox(opts: SandboxRenderOpts): HTMLIFrameElement {
  const { adId, container, creativeUrl, width, height, clickUrl } = opts;
  const iframe = document.createElement('iframe');
  iframe.sandbox.add('allow-scripts');
  iframe.sandbox.add('allow-same-origin');  // required; isolation is by origin, not sandbox
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('frameborder', '0');
  iframe.style.border = '0';
  iframe.style.display = 'block';
  if (width != null) iframe.width = String(width);
  if (height != null) iframe.height = String(height);

  const url = new URL(creativeUrl);
  url.searchParams.set('adId', adId);
  url.searchParams.set('pubUrl', window.location.href); // Prebid page URL (targetOrigin)
  if (clickUrl) url.searchParams.set('clickUrl', clickUrl);
  iframe.src = url.toString();

  container.appendChild(iframe);
  return iframe;
}
```

(`ympb-sandbox-render.js` in this dir is the plain-JS reference for the same logic.)

### 3. Replace the render call site

Wherever the tag calls `pbjs.renderAd(iframeDoc, adId)` (in `AdUnitTag.ts`):

```ts
// before — friendly iframe, same-origin with Prebid
pbjs.renderAd(iframe.contentDocument, bid.adId);

// after — cross-origin CDN creative, isolated from the page, audio disabled
renderAdInSandbox({
  adId: bid.adId,
  container: slotElement,                 // see resize note below
  creativeUrl: getOption('sandboxCreativeUrl'),
  width: bid.width,
  height: bid.height,
});
```

### 4. Config / env wiring

- Add an env var, e.g. `TAG_SANDBOX_CREATIVE_URL`, alongside `TAG_STATIC_CDN` /
  `PREBID_CACHE_URL`.
- Add a default option, e.g. `sandboxCreativeUrl`, resolved via `getOption()`.

## Hard requirements

0. **Serve the creative cross-origin to the page, with `allow-same-origin`.** An opaque
   `allow-scripts`-only sandbox throws the `null`-origin SecurityError. Never host the
   creative on the publisher's own domain.
1. **`pubUrl` must be the Prebid page URL.** The helper sets it from `window.location.href`.
   The cross-origin creative cannot read `window.top.location`, and Prebid uses it as the
   `postMessage` targetOrigin — wrong/missing → silent blank. If the tag itself runs inside an
   iframe, pass the **top** page URL explicitly.
2. **Resize needs matching IDs.** `container.id` must equal the GAM slot element id /
   `adUnitCode` (per `resizeRemoteCreative` → `getYmpbDfpElementId`), with the iframe as a
   descendant. Slots already render into `<div id="{adUnitCode}">`, so appending the iframe
   there satisfies it. Otherwise the ad renders but won't auto-resize.

## Preconditions (already met in this setup)

- The creative iframe is a **direct descendant of the publisher page** where Prebid runs —
  required so it can find the `__pb_locator__` frame.
- Prebid's `listenMessagesFromCreative()` + `insertLocatorFrame()` run at init.

## Scope

Display + muted video, `sandbox="allow-scripts allow-same-origin"` on a cross-origin CDN
creative. If creatives later need click-through or forms, add `allow-popups
allow-popups-to-escape-sandbox` and/or `allow-forms` to the `sandbox` attribute in
`renderAdInSandbox`.
