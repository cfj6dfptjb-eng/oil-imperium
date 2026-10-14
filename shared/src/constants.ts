export const GAME_TITLE = 'Oil Imperium';
export const PROTOCOL_VERSION = 1;

/** Logical screen size, matching an Amiga PAL low-res display. */
export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 256;

export const COMPANIES = ['Interoil', 'All American', 'Transoil', 'Explora Inc.'] as const;
export type Company = (typeof COMPANIES)[number];

export const REGIONS = [
  'Alaska',
  'North America',
  'Central America',
  'South America',
  'Europe',
  'USSR',
  'Gulf Region',
  'Indochina',
] as const;
export type Region = (typeof REGIONS)[number];

export const STARTING_CASH = 5_000_000;
