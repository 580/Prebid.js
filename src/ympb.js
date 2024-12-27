/**
 * Functions using YMPB
 */
import { getGlobal } from './prebidGlobal.js'; // YMPB

const pbjsInstance = getGlobal(); // YMPB

export function getYmpbOption(key) {
  return pbjsInstance.getOption(key);
}

function getYollaTagElement(adUnitCode) {
  return document.getElementById(adUnitCode);
}

export function getSlotAreaSize(adUnitCode) {
  let slotSize = [0, 0];

  try {
    if (pbjsInstance.getMaxSizeByUnitCode) {
      slotSize = pbjsInstance.getMaxSizeByUnitCode(adUnitCode);
    } else {
      const yollaTagSlot = getYollaTagElement(adUnitCode);
      slotSize = [yollaTagSlot.offsetWidth, yollaTagSlot.offsetHeight];
    }
  } catch (error) {
    slotSize = [0, 0];
  }

  return slotSize;
}

  /**
   * YMPB logic to replace original targeting key-value logic
   * The function allows to control on sendAllBids on function level
   *
   * @param {*} adUnitCodes
   * @param {*} bidsReceived

  function getYmpbTargetings(adUnitCodes, bidsReceived, options = {}) {
    // return (config.getConfig('enableSendAllBids') ? getBidLandscapeTargeting(adUnitCodes, bidsReceived) : getDealBids(adUnitCodes, bidsReceived))
    const enableSendAllVideoBids = options.hasOwnProperty('enableSendAllVideoBids') ? options.enableSendAllVideoBids : config.getConfig('enableSendAllVideoBids');
    const enableSendAllBids = options.hasOwnProperty('enableSendAllBids') ? options.enableSendAllBids : config.getConfig('enableSendAllBids');

    if (enableSendAllBids === false && enableSendAllVideoBids === false) {
      return getDealBids(adUnitCodes, bidsReceived);
    }

    const highestCpmVideoBids = enableSendAllVideoBids ? [] : getHighestCpmBidsFromBidPool(bidsReceived.filter(bid => bid.mediaType === VIDEO), getHighestCpm, 1);
    const highestCpmBids = enableSendAllBids ? [] : getHighestCpmBidsFromBidPool(bidsReceived.filter(bid => bid.mediaType !== VIDEO), getHighestCpm, 1);

    const bids = bidsReceived.filter(bid => {
      if (bid.mediaType === VIDEO) {
        if (enableSendAllVideoBids === false) {
          return !!find(highestCpmVideoBids, b => b.adId === bid.adId);
        }
      } else {
        if (enableSendAllBids === false) {
          return !!find(highestCpmBids, b => b.adId === bid.adId);
        }
      }

      return true;
    });

    return getBidLandscapeTargeting(adUnitCodes, bids);
  }
   */
  