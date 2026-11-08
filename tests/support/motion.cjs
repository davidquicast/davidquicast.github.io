/**
 * Wait until the entrance animations of the motion layer have finished.
 * Contrast audits must judge the settled page, not a frame halfway through a
 * fade. Ambient or autonomous motion (availability pulse, project deck
 * progress) is deliberately not awaited.
 */
const ENTRANCES = /^(motion-(avatar|rise|card|reader)|editorial-line-in|pretext-fallback)$/;
async function entrancesFinished(page) {
  await page.waitForFunction((source) => {
    const pattern = new RegExp(source);
    return document.getAnimations().every((animation) => animation.playState !== "running" || !pattern.test(animation.animationName || ""));
  }, ENTRANCES.source);
}
module.exports = { entrancesFinished };
