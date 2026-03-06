import {
  SETUP_COMPLETE,
  SETUP_FAILED,
  DESTROYED,
  PLAYLIST,
  PLAYBACK_REQUEST,
  CONTENT_LOADED,
  PLAY,
  PAUSE,
  TIME,
  SEEK_START,
  SEEK_END,
  MUTE,
  VOLUME,
  ERROR,
  COMPLETE,
  FULLSCREEN,
  PLAYER_RESIZE,
  AD_REQUEST,
  AD_IMPRESSION,
  AD_TIME,
  AD_COMPLETE,
  AD_SKIPPED,
  AD_CLICK,
  AD_STARTED,
  AD_ERROR,
  AD_LOADED,
  AD_PLAY,
  AD_PAUSE,
} from '../libraries/video/constants/events.js';
// missing events: , AD_BREAK_START, , AD_BREAK_END, VIEWABLE, BUFFER, CAST, PLAYLIST_COMPLETE, RENDITION_UPDATE, PLAY_ATTEMPT_FAILED, AUTOSTART_BLOCKED
import {
  PROTOCOLS,
  API_FRAMEWORKS,
  VIDEO_MIME_TYPE,
  PLAYBACK_METHODS,
  PLACEMENT,
  VPAID_MIME_TYPE,
  AD_POSITION,
  PLAYBACK_END,
} from '../libraries/video/constants/ortb.js';
import { YOLLA_VIDEO_VENDOR } from '../libraries/video/constants/vendorCodes.js';
import { submodule } from '../src/hook.js';
import stateFactory from '../libraries/video/shared/state.js';
import { PLAYBACK_MODE } from '../libraries/video/constants/constants.js';
import { getEventHandler } from '../libraries/video/shared/eventHandler.js';

const setupFailMessage = 'Failed to instantiate the player';
const AD_MANAGER_EVENTS = [
  AD_LOADED,
  AD_STARTED,
  AD_IMPRESSION,
  AD_PLAY,
  AD_PAUSE,
  AD_TIME,
  AD_COMPLETE,
  AD_SKIPPED,
];

export function YollavideoProvider(
  providerConfig,
  // player,
  adState_,
  timeState_,
  callbackStorage_,
  utils
) {
  let playerVersion = '1.0.0';

  const { playerConfig, divId, player } = providerConfig;
  //   const callbackToHandler = {};
  const adState = adState_;
  const timeState = timeState_;

  let isMuted;
  let previousLastTimePosition = 0;
  let lastTimePosition = 0;

  let playerIsSetup = false;
  let setupCompleteCallbacks = [];
  let setupFailedCallbacks = [];
  let setupFailedEventHandlers = [];

  function setupAds() {
    // TODO: init ima plugin
    // if (!player.ima) {
    //   throw new Error(setupFailMessage + ': ima plugin is missing');
    // }
    // const adConfig = utils.getAdConfig(playerConfig);
    // player.ima(adConfig);
  }

  function triggerSetupFailure(errorCode, msg, sourceError) {
    const payload = {
      // player,
      divId,
      playerVersion,
      type: SETUP_FAILED,
      errorCode,
      errorMessage: msg,
      sourceError: sourceError,
    };
    setupFailedCallbacks.forEach((setupFailedCallback) =>
      setupFailedCallback(SETUP_FAILED, payload)
    );
    setupFailedCallbacks = [];
  }

  function triggerSetupComplete() {
    playerIsSetup = true;
    const payload = {
      // player,
      divId,
      playerVersion,
      type: SETUP_COMPLETE,
    };

    setupCompleteCallbacks.forEach((callback) =>
      callback(SETUP_COMPLETE, payload)
    );
    setupCompleteCallbacks = [];

    isMuted = player.$ima.muted;

    setupFailedEventHandlers.forEach((eventHandler) =>
      player.off('error', eventHandler)
    );
    setupFailedEventHandlers = [];
  }

  function registerSetupErrorListener() {
    const eventHandler = () => {
      if (playerIsSetup) {
        return;
      }

      const error = player.error();
      triggerSetupFailure(error.code, error.message, error);
    };

    // player.on(ERROR, eventHandler);
    setupFailedEventHandlers.push(eventHandler);
  }

  function registerSetupListeners(externalEventName, callback, basePayload) {
    // no point in registering for setup failures if already setup.
    if (playerIsSetup) {
      return;
    }

    if (externalEventName === SETUP_COMPLETE) {
      setupCompleteCallbacks.push(callback);
    } else if (externalEventName === SETUP_FAILED) {
      setupFailedCallbacks.push(callback);
      registerSetupErrorListener();
    }
  }

  function onReady() {
    try {
      setupAds();
    } catch (e) {
      triggerSetupFailure(-5, e.message);
      return;
    }
    triggerSetupComplete();
  }

  /**
   * Init video player instance.
   * YMPB: We do not need this, because we have already inited from YollaTag.
   * @param {*} config
   */
  function setupPlayer(config) {
    const setupConfig = utils.getSetupConfig(config);
    // debugger;
    // player = vjs(player, setupConfig, onReady);
  }

  function init() {
    // if divId found: execute onReady (instantiatedPlayers[divId])
    onReady();

    // setupPlayer(playerConfig);
  }

  function getId() {
    return divId;
  }

  function getOrtbVideo() {
    if (!player) {
      return;
    }

    let video = Object.assign({
      // maxextended: -1,
      // boxingallowed: 1,
      playbackend: PLAYBACK_END.VIDEO_COMPLETION,
    }, player.videoConfig);

    if (player.isFullscreen()) {
      video.pos = AD_POSITION.FULL_SCREEN;
    }
    // else if (findPosition) {
    //   video.pos = utils.getPositionCode(findPosition(player.el));
    // }

    return video;
  }

  function getOrtbContent() {
    return null;
  }

  function setAdTagUrl(adTagUrl, options) {
    player.requestAds(adTagUrl);
  }

  // YMPB v10
  function setAdXml(vastXml, options) {
    player.requestAds(vastXml);
  }

  function onEvent(type, callback, payload) {
    registerSetupListeners(type, callback, payload);

    if (!player) {
      return;
    }

    if (payload.divId) {
      player.ready(() => {
        registerListeners(type, callback, payload);
      });
    }
  }

  function offEvent(event, callback) {
    // TODO
  }

  function registerPlaylistEventListener(eventHandler) {
    // TODO
  }

  function destroy() {
    // TODO
  }

  function registerListeners(externalEventName, callback, basePayload) {
    if (externalEventName === MUTE) {
      const eventHandler = () => {
        if (isMuted !== player.$ima.muted) {
          basePayload.mute = isMuted = !isMuted;
          callback(externalEventName, basePayload);
        }
      };
      player.on(utils.getVideoEventName(VOLUME), eventHandler);
      return;
    }

    let getEventPayload;

    switch (externalEventName) {
      case PLAY:
      case PAUSE:
      case DESTROYED:
        break;

      case PLAYBACK_REQUEST:
        getEventPayload = () => ({ playReason: 'unknown' });
        break;

      case AD_REQUEST:
        // YMPB v10
        // getEventPayload = e => {
        //   const adTagUrl = e.detail.adsRequest.adTagUrl;
        //   adState.updateState({ adTagUrl });
        //   return { adTagUrl };
        // };
        break

      case AD_LOADED:
        getEventPayload = e => {
          const imaAd = e.detail.data;
          adState.updateForEvent(imaAd);
          timeState.clearState();
          return adState.getState();
        };
        break

      case AD_STARTED:
      case AD_PLAY:
      case AD_PAUSE:
        getEventPayload = () => adState.getState();
        break

      case AD_IMPRESSION:
      case AD_CLICK:
        getEventPayload = () => {
          return Object.assign({}, adState.getState(), timeState.getState())
        };
        break

      case AD_TIME:
        getEventPayload = (e) => {
          timeState.updateForTimeEvent(e.detail);
          return Object.assign({}, adState.getState(), timeState.getState());
        };
        break

      case AD_COMPLETE:
        getEventPayload = () => {
          const currentState = adState.getState();
          adState.clearState();
          return currentState;
        };
        break

      case AD_SKIPPED:
        getEventPayload = () => {
          const currentState = Object.assign({}, adState.getState(), timeState.getState());
          adState.clearState();
          return currentState;
        };
        break

      case AD_ERROR:
        getEventPayload = e => {
          const imaAdError = e.detail && e.detail.AdError;
          const extraPayload = Object.assign({
            error: imaAdError, // some publisher want this information
            playerErrorCode: imaAdError.getErrorCode(),
            vastErrorCode: imaAdError.getVastErrorCode(),
            errorMessage: imaAdError.getMessage(),
            sourceError: imaAdError.getInnerError()
            // timeout
          }, adState.getState(), timeState.getState());
          adState.clearState();
          return extraPayload;
        };
        break

      case PLAYLIST:
        getEventPayload = e => ({
          playlistItemCount: utils.getPlaylistCount(player),
          autostart: player.$ima.autoplay
        });
        break

      case CONTENT_LOADED:
        getEventPayload = e => {
          const media = utils.getMedia(player);
          const contentUrl = utils.getValidMediaUrl(media && media.src, player.src, e && e.target && e.target.currentSrc)
          return {
            contentId: media && media.id,
            contentUrl,
            title: media && media.title,
            description: media && media.description,
            playlistIndex: utils.getCurrentPlaylistIndex(player),
            contentTags: media && media.contentTags
          };
        };
        break;

      case TIME:
        // TODO: might want to check seeking() and/or scrubbing()
        getEventPayload = e => {
          previousLastTimePosition = lastTimePosition;
          const currentTime = player.currentTime();
          const duration = player.duration();
          timeState.updateForTimeEvent({ currentTime, duration });
          lastTimePosition = currentTime;
          return {
            position: lastTimePosition,
            duration
          };
        };
        break;

      case SEEK_START:
        getEventPayload = e => {
          return {
            position: previousLastTimePosition,
            destination: player.currentTime(),
            duration: player.duration()
          };
        }
        break;

      case SEEK_END:
        getEventPayload = () => ({
          position: player.currentTime(),
          duration: player.duration()
        });
        break;

      case VOLUME:
        getEventPayload = e => ({ volumePercentage: player.$ima.volume * 100 });
        break;

      case ERROR:
        getEventPayload = e => {
          // const error = player.error();
          // TODO: test and verify
          const error = e.detail.error;
          return {
            error: error,
            sourceError: error,
            errorCode: error.code || error.message,
            errorMessage: error.message,
          };
        };
        break;

      case COMPLETE:
        getEventPayload = e => {
          previousLastTimePosition = lastTimePosition = 0;
          timeState.clearState();
        };
        break;

      case FULLSCREEN:
        getEventPayload = e => ({ fullscreen: player.isFullscreen() });
        break;

      case PLAYER_RESIZE:
        getEventPayload = e => ({
          height: player.currentHeight(),
          width: player.currentWidth(),
        });
        break;

      default:
        return;
    }

    const eventHandler = getEventHandler(
      externalEventName,
      callback,
      basePayload,
      getEventPayload
    );

    if (externalEventName === PLAYLIST) {
      registerPlaylistEventListener(eventHandler);
      return;
    }

    const videoEventName = utils.getVideoEventName(externalEventName);
    console.log('addEventListener: Event Name', externalEventName, '=>', videoEventName);

    /**
     * Some events need to be set after `adsManagerLoaded`
     */
    // if (AD_MANAGER_EVENTS.includes(externalEventName)) {
    //   player.$ima.on('adsManagerLoaded', () => {
    //     player.$ima.addEventListener(videoEventName, eventHandler);
    //     // console.log('adsManagerLoaded', externalEventName, videoEventName, eventHandler);
    //   });
    // } else {
    //   player.$ima.addEventListener(videoEventName, eventHandler);
    // }
    player.$ima.addEventListener(videoEventName, eventHandler);
  }

  return {
    init: init,
    getId,
    getOrtbVideo: getOrtbVideo,
    getOrtbContent: getOrtbContent,
    setAdTagUrl: setAdTagUrl,
    setAdXml: setAdXml, // YMPB v10
    onEvent: onEvent,
    offEvent: offEvent,
    destroy: destroy,
  };
}

export const utils = {
  getSetupConfig: function (config) {
    if (!config) {
      return;
    }

    const params = config.params || {};
    const videojsConfig = params.vendorConfig || {};

    if (
      videojsConfig.autostart === undefined &&
      config.autostart !== undefined
    ) {
      videojsConfig.autostart = config.autostart;
    }

    if (videojsConfig.muted === undefined && config.mute !== undefined) {
      videojsConfig.muted = config.mute;
    }

    return videojsConfig;
  },

  getAdConfig: function (config) {
    const params = config && config.params;
    if (!params) {
      return {};
    }

    return params.adPluginConfig || {}; // TODO: add adPluginConfig to spec
  },

  getPositionCode: function ({ left, top, width, height }) {
    const bottom = window.innerHeight - top - height;
    const right = window.innerWidth - left - width;

    if (left < 0 || right < 0 || top < 0) {
      return AD_POSITION.UNKNOWN;
    }

    return bottom >= 0
      ? AD_POSITION.ABOVE_THE_FOLD
      : AD_POSITION.BELOW_THE_FOLD;
  },

  getVideoEventName: function (eventName) {
    switch (eventName) {
      case SETUP_COMPLETE:
        return 'ready';
      case SETUP_FAILED:
        return 'error';
      case DESTROYED:
        return 'dispose';
      case AD_REQUEST:
        return 'ads-request';
      case AD_LOADED:
        return 'loaded';
      case AD_STARTED:
        return 'start';
      case AD_IMPRESSION:
        return 'impression';
      case AD_PLAY:
        return 'resume';
      case AD_PAUSE:
        return 'pause';
      case AD_TIME:
        return 'adProgress';
      case AD_CLICK:
        return 'click';
      case AD_COMPLETE:
        return 'allAdsCompleted';
      case AD_SKIPPED:
        return 'skip';
      case AD_ERROR:
        return 'adError';
      case ERROR:
        return 'error';
      // case CONTENT_LOADED:
      //   return 'loadstart';
      // case ERROR:
      //   return ['error', 'aderror', 'contenterror'];
      // case PLAY:
      //   return PLAY + 'ing';
      // case PLAYBACK_REQUEST:
      //   return PLAY;
      // case SEEK_START:
      //   return 'seeking';
      // case SEEK_END:
      //   return 'seeked';
      // case TIME:
      //   return TIME + 'update';
      // case VOLUME:
      //   return VOLUME + 'change';
      // case MUTE:
      //   return MUTE + 'change';
      // case PLAYER_RESIZE:
      //   return 'playerresize';
      // case FULLSCREEN:
      //   return FULLSCREEN + 'change';
      // case COMPLETE:
      //   return 'ended';
      default:
        return eventName;
    }
  },

  getMedia: function (player) {
    // const playlistItem = this.getCurrentPlaylistItem(player);
    // if (playlistItem) {
    //   return playlistItem.sources[0];
    // }

    // return player.getMedia();
    return null;
  },

  getValidMediaUrl: function (mediaSrc, playerSrc, eventTargetSrc) {
    return (
      this.getMediaUrl(mediaSrc) ||
      this.getMediaUrl(playerSrc) ||
      this.getMediaUrl(eventTargetSrc)
    );
  },

  getMediaUrl: function (source) {
    if (!source) {
      return;
    }

    if (Array.isArray(source) && source.length) {
      return this.parseSource(source[0]);
    }

    return this.parseSource(source);
  },

  parseSource: function (source) {
    const type = typeof source;
    if (type === 'string') {
      return source;
    } else if (type === 'object') {
      return source.src;
    }
  },

  getPlaylistCount: function (player) {
    const playlist = player.playlist; // has playlist plugin
    if (!playlist) {
      return 1;
    }
    return playlist.lastIndex && playlist.lastIndex() + 1;
  },

  getCurrentPlaylistIndex: function (player) {
    const playlist = player.playlist; // has playlist plugin
    if (!playlist) {
      return 0;
    }
    return playlist.currentIndex && playlist.currentIndex();
  },

  getCurrentPlaylistItem: function (player) {
    const playlist = player.playlist; // has playlist plugin
    if (!playlist) {
      return;
    }

    const currentIndex = this.getCurrentPlaylistIndex(player);
    if (!currentIndex) {
      return;
    }

    const item = playlist()[currentIndex];
    return item;
  },
};

// STATE

/**
 * @returns {State}
 */
export function adStateFactory() {
  const adState = Object.assign({}, stateFactory());

  function updateForEvent(event) {
    if (!event) {
      return;
    }

    const skippable = event.skippable;
    // TODO: possibly can check traffickingParameters to determine if winning bid is passed
    const updates = {
      adId: event.adId,
      adServer: event.adSystem,
      advertiserName: event.advertiserName,
      redirectUrl: event.clickThroughUrl,
      creativeId: event.creativeId || event.creativeAdId,
      dealId: event.dealId,
      adDescription: event.description,
      linear: event.linear,
      creativeUrl: event.mediaUrl,
      adTitle: event.title,
      universalAdId: event.universalAdIdValue,
      creativeType: event.contentType,
      wrapperAdIds: event.adWrapperIds,
      skip: skippable ? 1 : 0,
      // missing fields:
      // loadTime
      // advertiserId - TODO: does this even exist ? If not, remove from spec
      // vastVersion
      // adCategories
      // campaignId
      // waterfallIndex
      // waterfallCount
      // skipmin
      // adTagUrl - for now, only has request ad tag
      // adPlacementType
    };

    const adPodInfo = event.adPodInfo;
    if (adPodInfo && adPodInfo.podIndex > -1) {
      updates.adPodCount = adPodInfo.totalAds;
      updates.adPodIndex = adPodInfo.adPosition - 1; // Per IMA docs, adPosition is 1 based.
    }

    if (adPodInfo && adPodInfo.timeOffset) {
      switch (adPodInfo.timeOffset) {
        case -1:
          updates.offset = 'post';
          break;

        case 0:
          // TODO: Defaults to 0 if this ad is not part of a pod, or the pod is not part of an ad playlist. - need to check if loaded dynamically and pass last content time update
          updates.offset = 'pre';
          break;

        default:
          updates.offset = '' + adPodInfo.timeOffset;
      }
    }

    if (skippable) {
      updates.skipafter = event.skipTimeOffset;
    }
    console.log('updateState', updates);
    this.updateState(updates);
  }

  adState.updateForEvent = updateForEvent;

  return adState;
}

export function timeStateFactory() {
  const timeState = Object.assign({}, stateFactory());

  function updateForTimeEvent(event) {
    const { currentTime, duration } = event;
    this.updateState({
      time: currentTime,
      duration,
      playbackMode: getPlaybackMode(duration),
    });
  }

  timeState.updateForTimeEvent = updateForTimeEvent;

  function getPlaybackMode(duration) {
    if (duration > 0) {
      return PLAYBACK_MODE.VOD;
    } else if (duration < 0) {
      return PLAYBACK_MODE.DVR;
    }

    return PLAYBACK_MODE.LIVE;
  }

  return timeState;
}

function yollavideoSubmoduleFactory(config) {
  const adState = adStateFactory();
  const timeState = timeStateFactory();
  const callbackStorage = null;
  // TODO: pass adunit and provide a way to get adunit from outside of yolla tag
  // const videoAdManager = null;

  return YollavideoProvider(
    config,
    // videoAdManager,
    adState,
    timeState,
    callbackStorage,
    utils
  );
}

yollavideoSubmoduleFactory.vendorCode = YOLLA_VIDEO_VENDOR;
submodule('video', yollavideoSubmoduleFactory);

export default yollavideoSubmoduleFactory;
