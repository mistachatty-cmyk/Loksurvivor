# Fixed popups must not sit under a filtered ancestor

Symptom (fixed in 0.14.1): popups opened off-center / far below the screen and
had to be scrolled to, mostly on desktop browsers with an animated UI theme.

Cause: five themes (`midnight-reliquary`, `mirror-carnival`, `aurora-transit`,
`chrome-vespers`, `paper-lantern`) animated `filter` on the `[data-ui-theme]`
wrapper that wraps every screen. Any non-`none` `filter` (also `transform`,
`backdrop-filter`, `will-change`, `contain`, `perspective`) on an ancestor
becomes the containing block for `position: fixed` descendants, so every
`fixed inset-0` modal centred on the whole tall page instead of the window.

Rule: never put `filter`/`transform`/etc. (animated or static) on
`[data-ui-theme]` or any wrapper that screens and modals render under. Theme
atmosphere lives on the `::before` fixed layer in `index.css`. The same trap
is why `IntroScreen.tsx` keeps its fixed siblings outside `motion.div`.

Mobile half of the same bug: modal max-heights use `dvh`, not `vh` (`vh`
includes the area behind a phone's URL bar), and a tall stacked popup scrolls
as a whole rather than clipping its first column.

Check: set `data-ui-theme` to each theme above, scroll the page, open a popup,
and compare its top/bottom gap to the viewport.

0.42.59: viewport dialogs now live under `#viewport-overlays`, inside the theme but outside screen animations. Use `ViewportOverlay` for custom viewport overlays and `overlayContainer()` for an existing portal. Shared Radix components already use this host. Avoid adding new portals to `document.body` with low z-index: a Crew dialog opened from pause must appear above pause, and its nested menus must appear above that dialog. World inversion/colour filters belong on the game canvas, never the run's UI ancestor.
