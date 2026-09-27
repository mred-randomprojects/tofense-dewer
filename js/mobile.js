// Phone support: detect touch, block zoom gestures (iOS ignores user-scalable=no),
// fullscreen + landscape lock where allowed (Android; iPhone uses Add to Home Screen).

export function isTouch() {
  return matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

export function goFullscreen() {
  const el = document.documentElement;
  if (!el.requestFullscreen || document.fullscreenElement) return;
  el.requestFullscreen({ navigationUI: "hide" })
    .then(() => screen.orientation?.lock?.("landscape"))
    .catch(() => {});
}

export function initMobile() {
  if (isTouch()) document.body.classList.add("touch");
  let lastEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      // a quick second tap would zoom on iOS; but let buttons through
      if (e.timeStamp - lastEnd < 350 && !e.target.closest("button")) e.preventDefault();
      lastEnd = e.timeStamp;
    },
    { passive: false },
  );
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  for (const t of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
  }
  document.addEventListener(
    "touchmove",
    (e) => {
      // allow scrolling inside menus, block everything else (and all pinches)
      if (e.touches.length > 1 || !e.target.closest(".scroll")) e.preventDefault();
    },
    { passive: false },
  );
}
