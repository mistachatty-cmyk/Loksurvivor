/**
 * Field notes on the Quirk Surge. Deliberately incomplete: the survivors who
 * write these down do not know what causes it, only what it does.
 */
export interface QuirkSurgeLore {
  title: string;
  paragraphs: string[];
  /** A recovered wall transcription, shown set apart. */
  glyphs: string;
  /** Said in the run alert when a surge starts. */
  alertTail: string;
}

export const QUIRK_SURGE_LORE: QuirkSurgeLore = {
  title: 'Field note: the Surge',
  paragraphs: [
    'Sometime in the night the Howls of the Eclipse reach the city. For twenty seconds everything that crawls out of the dark comes out wrong: hopping, swelling, glowing, bursting. Then it stops, as if someone lifted a hand.',
    'Glyphs show up on the walls just before it starts. Nobody has read a whole one. The wall transcription below is the longest anyone has kept, and it ends the way they all do.',
    'We do not know much. We know the survivors who lived through a Surge found their pockets heavier afterward. It is one heck of a boost for someone. Nobody can say who.',
    'Past the last map it stops asking. It comes every night.',
  ],
  glyphs: 'HOWLS OF THE ECLIPSE // sens— // [glyph] [glyph] [glyph] // WE',
  alertTail: 'The glyphs were right.',
};
