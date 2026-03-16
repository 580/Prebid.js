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

export function checkBidderTimeout(adUnitCode, bid) {
  try {
    if (window.YMPB && window.YMPB.checkBidderTimeout) {
      return window.YMPB.checkBidderTimeout(au.code, bid);
    }
  } catch (error) {
    //
  }

  return false;
}

export function getCacheServerCode() {
  const url = pbjsInstance.getConfig('cache.url') || "";

  if (url.indexOf('yolla') > -1) {
    return 'yolla';
  }

  if (url.indexOf('rubicon') > -1) {
    return 'rubicon';
  }

  if (url.indexOf('adnxs') > -1) {
    return 'adnxs';
  }

  return 'unknown';
}
