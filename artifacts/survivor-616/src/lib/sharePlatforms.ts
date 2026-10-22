/** Where a run recap can be sent. Pure data + link builders, so it is easy to test and to extend. */
export const SHARE_URL = 'https://survivor.gsix.online';

export type SharePlatformId = 'x' | 'facebook' | 'reddit' | 'whatsapp' | 'telegram' | 'bluesky' | 'email' | 'sms';

export interface ShareLink {
  id: SharePlatformId;
  label: string;
  href: string;
}

/**
 * Links only carry text and the game's address (no web intent can attach a picture), so the card image and clips
 * go through the device share sheet or "Save", and these links are for sending the message.
 */
export function buildShareLinks(text: string, url: string = SHARE_URL, title = '616 Survivor'): ShareLink[] {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  const both = encodeURIComponent(`${text} ${url}`);
  return [
    { id: 'x', label: 'X', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}` },
    { id: 'reddit', label: 'Reddit', href: `https://www.reddit.com/submit?url=${u}&title=${encodeURIComponent(title + ': ' + text)}` },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${both}` },
    { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
    { id: 'bluesky', label: 'Bluesky', href: `https://bsky.app/intent/compose?text=${both}` },
    { id: 'email', label: 'Email', href: `mailto:?subject=${encodeURIComponent(title)}&body=${both}` },
    { id: 'sms', label: 'Message', href: `sms:?&body=${both}` },
  ];
}

export function runShareText(areaName: string, survived: string, kills: number): string {
  return `Survived ${survived} on ${areaName} in 616 Survivor with ${kills.toLocaleString('en-US')} kills. Can you beat it?`;
}

/** File extension for a recorded clip. */
export function clipExtension(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm';
}
