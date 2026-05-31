// Original curated word list for Decrypt (single, uppercase English words). Used for any
// client-side preview; the authoritative board is generated server-side from the
// `word_pool` table. No external lists/assets.

export const WORDS: string[] = [
  'FALCON', 'EMBER', 'GLACIER', 'MARBLE', 'COMPASS', 'LANTERN', 'ORCHARD', 'PRISM',
  'QUARTZ', 'RIVER', 'SADDLE', 'TEMPLE', 'VELVET', 'WALNUT', 'ANCHOR', 'BISON',
  'CANYON', 'DRIFT', 'ENGINE', 'FOSSIL', 'GARDEN', 'HARBOR', 'IGLOO', 'JUNGLE',
  'KETTLE', 'LADDER', 'MAGNET', 'NEEDLE', 'OASIS', 'PEPPER', 'QUIVER', 'ROCKET',
  'SIGNAL', 'THRONE', 'UMBRA', 'VOYAGE', 'WIZARD', 'YONDER', 'ZEPHYR', 'ATLAS',
  'BEACON', 'CIPHER', 'DAGGER', 'ECHO', 'FERRY', 'GROTTO', 'HOLLOW', 'IVORY',
  'JESTER', 'KRAKEN', 'LEDGER', 'MIRAGE', 'NEBULA', 'OBSIDIAN', 'PHANTOM', 'QUEST',
  'RAVEN', 'SPHINX', 'TUNDRA', 'UNICORN', 'VAULT', 'WHISTLE', 'XENON', 'YACHT',
  'ZODIAC', 'BRAMBLE', 'CACTUS', 'DOLMEN', 'EAGLE', 'FLINT', 'GOBLIN', 'HAZEL',
  'INKWELL', 'JACKAL', 'KAYAK', 'LOTUS', 'MEADOW', 'NOMAD', 'ONYX', 'PIRATE',
  'QUILL', 'RIDGE', 'SCROLL', 'TALON', 'USHER', 'VIPER', 'WILLOW', 'YEOMAN',
  'ZEBRA', 'ACORN', 'BADGE', 'CANDLE', 'DUNE', 'ELIXIR', 'FABLE', 'GAVEL',
  'HERON', 'ICICLE', 'JOUST', 'KERNEL', 'LYNX', 'MANTLE', 'NOTCH', 'OTTER',
  'PLUME', 'QUARRY', 'RUNE', 'SOCKET', 'TINDER', 'VOLT', 'WAGON', 'XYLEM',
  'YOLK', 'ZINC', 'ARROW', 'BUCKLE', 'CRANE', 'DELTA', 'EMBASSY', 'FENNEL',
  'GORGE', 'HALO', 'INDIGO', 'JIGSAW', 'KIOSK', 'LACE', 'MOSAIC', 'NUGGET',
  'ORBIT', 'PISTON', 'QUOTA', 'RELIC', 'SPIRE', 'THICKET',
];

/** Return `n` distinct words sampled with the given rng (defaults to Math.random). */
export function sampleWords(n: number, rng: () => number = Math.random): string[] {
  const pool = WORDS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}
