/**
 * This module interacts with the server used to cache video ad content to be restored later.
 * At a high level, the expected workflow goes like this:
 *
 *   - Request video ads from Bidders
 *   - Generate IDs for each valid bid, and cache the key/value pair on the server.
 *   - Return these IDs so that publishers can use them to fetch the bids later.
 *
 * This trickery helps integrate with ad servers, which set character limits on request params.
 */

import {ajaxBuilder} from './ajax.js';
import {config} from './config.js';
import {auctionManager} from './auctionManager.js';
import {generateUUID, logError, logWarn} from './utils.js';
import {addBidToAuction} from './auction.js';
import { getCacheServerCode } from './ympb.js';

// YMPB: adding UUID_MARKER
const PB_PREFIX = 'pb_';
const UUID_MARKER = PB_PREFIX + 'uuid';

/**
 * Might be useful to be configurable in the future
 * Depending on publisher needs
 */
const ttlBufferInSeconds = 15;

export const vastLocalCache = new Map();

/**
 * @typedef {object} CacheableUrlBid
 * @property {string} vastUrl A URL which loads some valid VAST XML.
 */

/**
 * @typedef {object} CacheablePayloadBid
 * @property {string} vastXml Some VAST XML which loads an ad in a video player.
 */

/**
 * A CacheableBid describes the types which the videoCache can store.
 *
 * @typedef {CacheableUrlBid|CacheablePayloadBid} CacheableBid
 */

/**
 * Function which wraps a URI that serves VAST XML, so that it can be loaded.
 *
 * @param {string} uri The URI where the VAST content can be found.
 * @param {(string|string[])} impTrackerURLs An impression tracker URL for the delivery of the video ad
 * @return A VAST URL which loads XML from the given URI.
 */
function wrapURI(uri, impTrackerURLs) {
  impTrackerURLs = impTrackerURLs && (Array.isArray(impTrackerURLs) ? impTrackerURLs : [impTrackerURLs]);
  // Technically, this is vulnerable to cross-script injection by sketchy vastUrl bids.
  // We could make sure it's a valid URI... but since we're loading VAST XML from the
  // URL they provide anyway, that's probably not a big deal.

  // YMPB: adding pb_uuid
  const wraperIdRegex = new RegExp(`[?&]${UUID_MARKER}(=([^&#]*)|&|#|$)`);
  const result = wraperIdRegex.exec(uri);
  let wrapperId = result ? ` id="${result[2]}"` : '';
  let impressions = impTrackerURLs ? impTrackerURLs.map(trk => `<Impression><![CDATA[${trk}]]></Impression>`).join('') : '';
  return `<VAST version="3.0">
    <Ad${wrapperId}>
      <Wrapper>
        <AdSystem>prebid.org wrapper</AdSystem>
        <VASTAdTagURI><![CDATA[${uri}]]></VASTAdTagURI>
        ${impressions}
        <Creatives></Creatives>
      </Wrapper>
    </Ad>
  </VAST>`;
}

// YMPB: replace Ad from XML
function replaceXmlAdId(vastXml, pbUid) {
  if (!vastXml || !pbUid) {
    return vastXml;
  }

  // let wrapperId = `id="${PB_PREFIX}${adId}"`;
  // \sid(=?([^"'\s>]*)|"")
  const wrapperId = /^\s*id=/.test(pbUid) ? ' ' + pbUid : ` id="${pbUid}"`;
  vastXml = vastXml.replace(/<Ad\b[^>]*>/i, `<Ad${wrapperId}>`);

  return vastXml;
}

// YMPB
export function getWrapperAdIdFromBid(bid) {
  if (bid.trackingId) {
    return bid.trackingId;
  }

  // decide adWrapper for a bid.
  let adWrapperId = `${PB_PREFIX}${bid.adId}`;

  if (bid.vastUrl) {
    return adWrapperId;
  }

  let matchedId = bid.vastXml && bid.vastXml.match(/<Ad.+id=("|')(\w+)(\1)[^>]*>/i);

  if (matchedId) {
    // use existing adWrapperId
    adWrapperId = matchedId[2];
  }

  return adWrapperId;
}

/**
 * Wraps a bid in the format expected by the prebid-server endpoints, or returns null if
 * the bid can't be converted cleanly.
 *
 * @param {CacheableBid} bid
 * @param {Object} [options] - Options object.
 * @param {Object} [options.index=auctionManager.index] - Index object, defaulting to `auctionManager.index`.
 * @return {Object|null} - The payload to be sent to the prebid-server endpoints, or null if the bid can't be converted cleanly.
 */
function toStorageRequest(bid, {index = auctionManager.index} = {}) {
  const vastValue = getVastXml(bid);
  const auction = index.getAuction(bid);
  const ttlWithBuffer = Number(bid.ttl) + ttlBufferInSeconds;
  let payload = {
    type: 'xml',
    value: vastValue,
    ttlseconds: ttlWithBuffer
  };

  if (config.getConfig('cache.vasttrack')) {
    payload.bidder = bid.bidder;
    payload.bidid = bid.requestId;
    payload.aid = bid.auctionId;
  }

  if (auction != null) {
    payload.timestamp = auction.getAuctionStart();
  }

  if (typeof bid.customCacheKey === 'string' && bid.customCacheKey !== '') {
    payload.key = bid.customCacheKey;
  }

  return payload;
}

/**
 * A function which should be called with the results of the storage operation.
 *
 * @callback videoCacheStoreCallback
 *
 * @param {Error} [error] The error, if one occurred.
 * @param {?string[]} uuids An array of unique IDs. The array will have one element for each bid we were asked
 *   to store. It may include null elements if some of the bids were malformed, or an error occurred.
 *   Each non-null element in this array is a valid input into the retrieve function, which will fetch
 *   some VAST XML which can be used to render this bid's ad.
 */

/**
 * A function which bridges the APIs between the videoCacheStoreCallback and our ajax function's API.
 *
 * @param {videoCacheStoreCallback} done A callback to the "store" function.
 * @return {Function} A callback which interprets the cache server's responses, and makes up the right
 *   arguments for our callback.
 */
function shimStorageCallback(done) {
  return {
    success: function (responseBody) {
      let ids;
      try {
        ids = JSON.parse(responseBody).responses
      } catch (e) {
        done(e, []);
        return;
      }

      if (ids) {
        done(null, ids);
      } else {
        done(new Error("The cache server didn't respond with a responses property."), []);
      }
    },
    error: function (statusText, responseBody) {
      done(new Error(`Error storing video ad in the cache: ${statusText}: ${JSON.stringify(responseBody)}`), []);
    }
  }
}

function getVastXml(bid) {
  // return bid.vastXml ? bid.vastXml : wrapURI(bid.vastUrl, bid.vastImpUrl); // YMPB

  // const vastValue = bid.vastXml ? bid.vastXml : wrapURI(bid.vastUrl, bid.vastImpUrl);
  // YMPB: prefer cache with a vastURL
  let vastValue = '';
  let adWrapperId = getWrapperAdIdFromBid(bid);
  bid.trackingId = adWrapperId;

  if (bid.vastUrl) {
    const vastUrl = bid.vastUrl + `&${UUID_MARKER}=${adWrapperId}`;
    vastValue = wrapURI(vastUrl, bid.vastImpUrl);
  } else {
    // Replace ad ID
    vastValue = replaceXmlAdId(bid.vastXml, adWrapperId);
  }

  return vastValue;
};

/**
 * If the given bid is for a Video ad, generate a unique ID and cache it somewhere server-side.
 *
 * @param {CacheableBid[]} bids A list of bid objects which should be cached.
 * @param {videoCacheStoreCallback} [done] An optional callback which should be executed after
 * the data has been stored in the cache.
 */
export function store(bids, done, getAjax = ajaxBuilder) {
  const requestData = {
    puts: bids.map(toStorageRequest)
  };
  const ajax = getAjax(config.getConfig('cache.timeout'));
  ajax(config.getConfig('cache.url'), shimStorageCallback(done), JSON.stringify(requestData), {
    contentType: 'text/plain',
    withCredentials: true
  });
}

export function getCacheUrl(id) {
  return `${config.getConfig('cache.url')}?uuid=${id}`;
}

export const storeLocally = (bid) => {
  const vastXml = getVastXml(bid);
  const bidVastUrl = URL.createObjectURL(new Blob([vastXml], { type: 'text/xml' }));

  assignVastUrlAndCacheId(bid, bidVastUrl, bid.videoCacheKey); // YMPB v10 add videoCacheKey

  vastLocalCache.set(bid.videoCacheKey, bidVastUrl);
};

const assignVastUrlAndCacheId = (bid, vastUrl, videoCacheKey) => {
  bid.videoCacheKey = videoCacheKey || generateUUID();
  if (!bid.vastUrl) {
    bid.vastUrl = vastUrl;
  }
}

export const _internal = {
  store
}

export function storeBatch(batch) {
  // YMPB: add tracker
  const startTime = Date.now();
  const bids = batch.map(entry => entry.bidResponse)
  function err(msg) {
    logError(`Failed to save to the video cache: ${msg}. Video bids will be discarded:`, bids)
  }
  _internal.store(bids, function (error, cacheIds) {
    const endTime = Date.now();
    const costTime = endTime - startTime;
    const params = {
      eventCatogory: 'Debug',
      eventAction: 'onCacheServerResponse',
      eventLabel: getCacheServerCode(),
      cm1: bids.length,
      cm2: cacheIds.length,
      cm6: 0,
      cm7: costTime,
    };

    if (error) {
      params.cd6 = error || 'error';
      params.cm6 = bids.length || 1;
      err(error)
    } else if (batch.length !== cacheIds.length) {
      params.cd6 = 'cache IDs mismatched';
      params.cm6 = bids.length || 1;
      logError(`expected ${batch.length} cache IDs, got ${cacheIds.length} instead`)
    } else {
      cacheIds.forEach((cacheId, i) => {
        const {auctionInstance, bidResponse, afterBidAdded} = batch[i];
        if (cacheId.uuid === '') {
          logWarn(`Supplied video cache key was already in use by Prebid Cache; caching attempt was rejected. Video bid must be discarded.`);
        } else {
          assignVastUrlAndCacheId(bidResponse, getCacheUrl(cacheId.uuid), cacheId.uuid);
          addBidToAuction(auctionInstance, bidResponse);
          afterBidAdded();
        }
      });
    }

    // YMPB: send event to yaq
    if (typeof window.yaq !== 'undefined') {
      window.yaq('event.debug', 'onCacheServerResponse', params);
    }
  });
};

let batchSize, batchTimeout, cleanupHandler;
if (FEATURES.VIDEO) {
  config.getConfig('cache', ({cache}) => {
    batchSize = typeof cache.batchSize === 'number' && cache.batchSize > 0
      ? cache.batchSize
      : 1;
    batchTimeout = typeof cache.batchTimeout === 'number' && cache.batchTimeout > 0
      ? cache.batchTimeout
      : 0;

    // removing blobs that are not going to be used
    if (cache.useLocal && !cleanupHandler) {
      cleanupHandler = auctionManager.onExpiry((auction) => {
        auction.getBidsReceived()
          .forEach((bid) => {
            const vastUrl = vastLocalCache.get(bid.videoCacheKey)
            if (vastUrl && vastUrl.startsWith('blob')) {
              URL.revokeObjectURL(vastUrl);
            }
            vastLocalCache.delete(bid.videoCacheKey);
          })
      });
    }
  });
}

export const batchingCache = (timeout = setTimeout, cache = storeBatch) => {
  let batches = [[]];
  let debouncing = false;
  const noTimeout = cb => cb();

  return function (auctionInstance, bidResponse, afterBidAdded) {
    const batchFunc = batchTimeout > 0 ? timeout : noTimeout;
    if (batches[batches.length - 1].length >= batchSize) {
      batches.push([]);
    }

    batches[batches.length - 1].push({auctionInstance, bidResponse, afterBidAdded});

    if (!debouncing) {
      debouncing = true;
      batchFunc(() => {
        batches.forEach(cache);
        batches = [[]];
        debouncing = false;
      }, batchTimeout);
    }
  };
};

export const batchAndStore = batchingCache();
