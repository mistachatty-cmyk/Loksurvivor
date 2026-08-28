# Tilt steering

Read before touching `src/game/input/gyro.ts`.

## Work in gravity space, not in Euler angles

The obvious mapping — `gamma → x`, `beta → y` — is what shipped first and it is
wrong twice over.

**It assumes portrait.** The device's axes are fixed to the device; the player is
looking at the *screen*. Held sideways, those are 90° apart and steering comes
out rotated. The fix is to rotate the tilt into screen space using
`screen.orientation.angle` (with the deprecated `window.orientation` as the only
fallback on older iOS).

**It falls off a cliff in landscape.** `gamma` is reported over −90..90, and
holding a phone sideways puts it *at* that limit — exactly where Euler angles
degenerate. Near the boundary, small movements swing `gamma` wildly or flip its
sign. There is no fix within Euler angles; the boundary is intrinsic to them.

Both problems disappear by deriving the gravity vector from `beta`/`gamma` and
working with that. Where gravity points, in the device's frame, is continuous —
there is no boundary to fall off — and rotating it by the screen angle gives tilt
in the frame the player actually sees. `alpha` is deliberately not a parameter:
it is compass heading, and which way the player is facing is not a tilt.

## Details that bite

- Quarter turns use an exact cos/sin lookup, not `Math.cos`. Floating-point fuzz
  bleeds a sliver of one axis into the other, which reads as slow drift.
- The calibrated neutral is stored as a gravity vector, so any holding pose works
  — lying down, slouched, landscape.
- **Drop the origin on rotation.** Turning the device changes the physical
  neutral completely; keeping the old one yanks the player sideways the instant
  the screen turns.
- Listen for `deviceorientationabsolute` as well. Some Android browsers never
  fire the plain event.

## How to verify it, given no phone

Tilt was written off as untestable headlessly. It is not, but the obvious routes
are dead ends:

- `Emulation.setDeviceOrientationOverride` — removed from current Chromium.
- `Emulation.setSensorOverrideReadings` — accepted, and it does drive the Generic
  Sensor API, but not the legacy `deviceorientation` event the game listens to.

What works is dispatching `DeviceOrientationEvent`s directly while driving the
screen angle for real through `Emulation.setDeviceMetricsOverride`. That covers
the listener, the mapping, calibration, smoothing and the readout — everything
this codebase owns. It cannot cover Chromium's sensor plumbing or the hardware.

`mapTilt` is therefore kept a pure function of angles, so the part most likely to
be wrong is covered by ordinary `node --test` cases with no browser at all.

The remaining hardware question is answered by the live readout in Settings
(`ui/TiltReadout.tsx`): raw angles, mapped steering, orientation, and a dot that
follows the device. Ten seconds on a real phone beats any amount of reasoning.

## The two silent failures

Both look exactly like broken code, and neither reports anything:

- **Not a secure context.** Orientation is only delivered over HTTPS. A phone
  reaching a dev server by LAN address gets plain `http://` and no event ever
  fires. Test against the deployed HTTPS URL.
- **Permission never granted.** iOS 13+ gates orientation behind
  `requestPermission()`, which must be called from a user gesture — which is why
  the request lives in the settings toggle's click handler and not in an effect.

The readout names both rather than leaving them to be guessed at.
