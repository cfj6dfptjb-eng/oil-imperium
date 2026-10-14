/** Amiga-style 12-bit colours (each channel 0-15), expanded to CSS hex. */
function amiga(rgb: number): string {
  const r = (rgb >> 8) & 0xf;
  const g = (rgb >> 4) & 0xf;
  const b = rgb & 0xf;
  return '#' + [r, g, b].map((c) => (c * 17).toString(16).padStart(2, '0')).join('');
}

export const PAL = {
  black: amiga(0x000),
  white: amiga(0xfff),
  sand: amiga(0xc94),
  sandDark: amiga(0x962),
  derrick: amiga(0x211),
  gold: amiga(0xfc0),
  goldDark: amiga(0xa60),
  green: amiga(0x4e4),
  greenDark: amiga(0x272),
  red: amiga(0xe44),
  redDark: amiga(0x822),
  grey: amiga(0x888),
  greyDark: amiga(0x444),
  greyLight: amiga(0xbbb),
  blue: amiga(0x46c),
  blueDark: amiga(0x124),
  ocean: amiga(0x237),
  land: amiga(0x5a4),
  wood: amiga(0x642),
  woodDark: amiga(0x421),
  wall: amiga(0x9a8),
  sky: [0x013, 0x024, 0x136, 0x247, 0x358, 0x469, 0x57a, 0x88b, 0xa8a, 0xc98, 0xea7, 0xfb6].map(amiga),
};

/** Company colours, in seat order. */
export const COMPANY_COLORS: Record<string, string> = {
  Interoil: amiga(0xe44),
  'All American': amiga(0x48f),
  Transoil: amiga(0x4c4),
  'Explora Inc.': amiga(0xfc0),
};
