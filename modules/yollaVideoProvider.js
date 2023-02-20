import {
  SETUP_COMPLETE,
  SETUP_FAILED,
} from "../libraries/video/constants/events.js";
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
} from "../libraries/video/constants/ortb.js";
import { YOLLA_VIDEO_VENDOR } from "../libraries/video/constants/vendorCodes.js";
import { submodule } from "../src/hook.js";
import stateFactory from "../libraries/video/shared/state.js";
import { PLAYBACK_MODE } from "../libraries/video/constants/constants.js";
import { getEventHandler } from "../libraries/video/shared/eventHandler.js";

export function YollavideoProvider(config, $player, $adUnit) {
  let playerVersion = "1.0.0";

  const { playerConfig, divId } = config;
//   const callbackToHandler = {};

  let playerIsSetup = false;
  let setupCompleteCallbacks = [];
  let setupFailedCallbacks = [];
  let setupFailedEventHandlers = [];

  function setupPlayer(config) {
    // TODO
  }

  function setupAds() {
    // TODO
  }

  function triggerSetupComplete() {
    playerIsSetup = true;
    const payload = {
      divId,
      type: SETUP_COMPLETE,
    };

    setupCompleteCallbacks.forEach((callback) =>
      callback(SETUP_COMPLETE, payload)
    );
    setupCompleteCallbacks = [];

    // isMuted = player.muted();

    setupFailedEventHandlers.forEach((eventHandler) =>
      $player.off("error", eventHandler)
    );
    setupFailedEventHandlers = [];
  }

  function triggerSetupFailure(errorCode, msg, sourceError) {
    const payload = {
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

  function registerSetupErrorListener() {
    const eventHandler = () => {
      if (playerIsSetup) {
        return;
      }

      //   const error = player.error();
      const error = new Error("temp error");
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

  function init() {
    // player found:
    onReady();
    // else
    // setupPlayer(playerConfig);
  }

  function getId() {
    return divId;
  }

  function getOrtbVideo() {
    let playBackMethod = PLAYBACK_METHODS.CLICK_TO_PLAY;
    // // returns a boolean or a string with the autoplay strategy
    // const autoplay = player.autoplay();
    // const muted = player.muted() || autoplay === 'muted';
    // // check if autoplay is truthy since it may be a bool or string
    // if (autoplay) {
    //   playBackMethod = muted ? PLAYBACK_METHODS.AUTOPLAY_MUTED : PLAYBACK_METHODS.AUTOPLAY;
    // }

    // IMA supports vpaid unless its expliclty turned off
    // TODO: needs a reference to the imaOptions used at setup to determine if vpaid can be used

    const supportedMediaTypes = [
      VIDEO_MIME_TYPE.MP4,
      VIDEO_MIME_TYPE.MPEG,
      VIDEO_MIME_TYPE.WEBM,
      VPAID_MIME_TYPE,
    ];

    const video = {
      // placement: PLACEMENT.INSTREAM,
      mimes: supportedMediaTypes,
      // Based on the protocol support provided by the videojs-ima plugin
      // https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/compatibility
      // Need to check for the plugins
      protocols: [
        PROTOCOLS.VAST_2_0,
        PROTOCOLS.VAST_2_0_WRAPPER,
        PROTOCOLS.VAST_4_0,
        PROTOCOLS.VAST_4_0_WRAPPER,
      ],
      api: [
        API_FRAMEWORKS.VPAID_2_0, // TODO: needs a reference to the imaOptions used at setup to determine if vpaid can be used
        API_FRAMEWORKS.OMID_1_0,
      ],
      // TODO: Make sure this returns dimensions in DIPS
      h: 960,
      w: 480,
      // TODO: implement startdelay since its reccomend param
      // both linearity forms are supported so the param is excluded
      // sequence - TODO not yet supported
      maxextended: -1,
      boxingallowed: 1,
      playbackmethod: [
        playBackMethod,
        // PLAYBACK_METHODS.AUTOPLAY_MUTED,
        // PLAYBACK_METHODS.CLICK_TO_PLAY,
        // PLAYBACK_METHODS.CLICK_TO_PLAY_MUTED,
      ],
      playbackend: PLAYBACK_END.VIDEO_COMPLETION,
    };

    // if (player.isFullscreen()) {
    //   video.pos = AD_POSITION.FULL_SCREEN;
    // } else if (findPosition) {
    //   video.pos = utils.getPositionCode(findPosition(player.el()));
    // }

    return video;
  }

  function getOrtbContent() {
    return null;
  }

  function setAdTagUrl(adTagUrl, options) {
    // TODO
  }

  function onEvent(type, callback, payload) {
    registerSetupListeners(type, callback, payload);

    // if (!player) {
    //   return;
    // }

    // player.ready(() => {
    //   registerListeners(type, callback, payload);
    // });
  }

  function offEvent(event, callback) {
    // TODO
  }

  function destroy() {
    // TODO
  }

  function registerListeners(externalEventName, callback, basePayload) {
    // TODO
    // if (externalEventName === MUTE) {
    //   const eventHandler = () => {
    //     if (isMuted !== player.muted()) {
    //       basePayload.mute = isMuted = !isMuted;
    //       callback(externalEventName, basePayload);
    //     }
    //   };
    //   player.on(utils.getVideoEventName(VOLUME), eventHandler);
    //   return;
    // }
  }

  return {
    init: init,
    getId: getId,
    getOrtbVideo: getOrtbVideo,
    getOrtbContent: getOrtbContent,
    setAdTagUrl: setAdTagUrl,
    onEvent: onEvent,
    offEvent: offEvent,
    destroy: destroy,
  };
}

function yollavideoSubmoduleFactory(videoProviderConfig) {
  return YollavideoProvider(videoProviderConfig);
}

yollavideoSubmoduleFactory.vendorCode = YOLLA_VIDEO_VENDOR;
submodule("video", yollavideoSubmoduleFactory);

export default yollavideoSubmoduleFactory;
