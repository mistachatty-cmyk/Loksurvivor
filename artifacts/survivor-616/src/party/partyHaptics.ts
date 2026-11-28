import { haptic } from '../../../../lib/lok-universe/src/haptics';
import { setJuiceHaptics } from './juiceEngine';

/** Plugs the shared Lok haptics (player settings, rate limits, phone and controller) into the party feel layer. */
setJuiceHaptics((cue) => haptic(cue));
