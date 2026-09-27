import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(18);

/**
 * Use a system Chromium when one is provided (CI images ship one already, and
 * downloading a second copy per job is wasted minutes). Falls back to
 * Remotion's own browser locally.
 */
if (process.env.CHROMIUM_PATH) {
  Config.setBrowserExecutable(process.env.CHROMIUM_PATH);
}
