/* eslint-disable */

import { Renderer } from '../src/Renderer';
import * as utils from '../src/utils';
import { registerBidder } from '../src/adapters/bidderFactory';
import { BANNER, NATIVE, VIDEO } from '../src/mediaTypes';
import find from 'core-js/library/fn/array/find';
import includes from 'core-js/library/fn/array/includes';

const BIDDER_CODE = 'yolla';
const URL = 'http://localhost:9999/integrationExamples/gpt/hello_ympb.json';
const VIDEO_TARGETING = ['id', 'mimes', 'minduration', 'maxduration',
  'startdelay', 'skippable', 'playback_method', 'frameworks'];

const USER_PARAMS = ['age', 'external_uid', 'segments', 'gender', 'dnt', 'language'];

const NATIVE_MAPPING = {
  body: 'description',
  cta: 'ctatext',
  image: {
    serverName: 'main_image',
    requiredParams: { required: true },
    minimumParams: { sizes: [{}] },
  },
  icon: {
    serverName: 'icon',
    requiredParams: { required: true },
    minimumParams: { sizes: [{}] },
  },
  sponsoredBy: 'sponsored_by',
};
const SOURCE = 'pbjs';

export const spec = {
  code: BIDDER_CODE,
  aliases: [],
  supportedMediaTypes: [BANNER, VIDEO, NATIVE],

  /**
   * Determines whether or not the given bid request is valid.
   *
   * @param {object} bid The bid to validate.
   * @return boolean True if this is a valid bid, and false otherwise.
   */
  isBidRequestValid: function(bid) {
    console.log('isBidRequestValid', bid);
    return true;
  },

  /**
   * Make a server request from the list of BidRequests.
   *
   * @param {BidRequest[]} bidRequests A non-empty list of bid requests which should be sent to the Server.
   * @return ServerRequest Info describing the request to the server.
   */
  buildRequests: function(bidRequests, bidderRequest) {
    console.log('bidRequests, bidderRequest', bidRequests, bidderRequest);
    return {
      method: 'GET',
      url: URL,
      data: '',
      bidderRequest
    };
  },

  /**
   * Unpack the response from the server into a list of bids.
   *
   * @param {*} serverResponse A successful response from the server.
   * @return {Bid[]} An array of bids which were nested inside the server.
   */
  interpretResponse: function(serverResponse, {bidderRequest}) {
    console.log(serverResponse, bidderRequest);
    serverResponse = serverResponse.body;
    const bids = [];
    // if (!serverResponse || serverResponse.error) {
    //   let errorMessage = `in response for ${bidderRequest.bidderCode} adapter`;
    //   if (serverResponse && serverResponse.error) { errorMessage += `: ${serverResponse.error}`; }
    //   utils.logError(errorMessage);
    //   return bids;
    // }

    // if (serverResponse.tags) {
    //   serverResponse.tags.forEach(serverBid => {
    //     const rtbBid = getRtbBid(serverBid);
    //     if (rtbBid) {
    //       if (rtbBid.cpm !== 0 && includes(this.supportedMediaTypes, rtbBid.ad_type)) {
    //         const bid = newBid(serverBid, rtbBid, bidderRequest);
    //         bid.mediaType = parseMediaType(rtbBid);
    //         bids.push(bid);
    //       }
    //     }
    //   });
    // }
    return bids;
  },

  getUserSyncs: function(syncOptions) {
    if (syncOptions.iframeEnabled) {
      return [{
        type: 'iframe',
        url: 'https://acdn.adnxs.com/ib/static/usersync/v3/async_usersync.html'
      }];
    }
  }
};

// function newRenderer(adUnitCode, rtbBid, rendererOptions = {}) {
//   const renderer = Renderer.install({
//     id: rtbBid.renderer_id,
//     url: rtbBid.renderer_url,
//     config: rendererOptions,
//     loaded: false,
//   });

//   try {
//     renderer.setRender(outstreamRender);
//   } catch (err) {
//     utils.logWarn('Prebid Error calling setRender on renderer', err);
//   }

//   renderer.setEventHandlers({
//     impression: () => utils.logMessage('xhb outstream video impression event'),
//     loaded: () => utils.logMessage('xhb outstream video loaded event'),
//     ended: () => {
//       utils.logMessage('xhb outstream renderer video event');
//       document.querySelector(`#${adUnitCode}`).style.display = 'none';
//     }
//   });
//   return renderer;
// }

// function outstreamRender(bid) {
//   // push to render queue because ANOutstreamVideo may not be loaded yet
//   bid.renderer.push(() => {
//     window.ANOutstreamVideo.renderAd({
//       tagId: bid.adResponse.tag_id,
//       sizes: [bid.getSize().split('x')],
//       targetId: bid.adUnitCode, // target div id to render video
//       uuid: bid.adResponse.uuid,
//       adResponse: bid.adResponse,
//       rendererOptions: bid.renderer.getConfig()
//     }, handleOutstreamRendererEvents.bind(null, bid));
//   });
// }

// function handleOutstreamRendererEvents(bid, id, eventName) {
//   bid.renderer.handleVideoEvent({ id, eventName });
// }

// function parseMediaType(rtbBid) {
//   const adType = rtbBid.ad_type;
//   if (adType === VIDEO) {
//     return VIDEO;
//   } else if (adType === NATIVE) {
//     return NATIVE;
//   } else {
//     return BANNER;
//   }
// }

registerBidder(spec);
