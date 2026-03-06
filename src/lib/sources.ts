export interface FeedSource {
  name: string;
  slug: string;
  feedUrl: string;
  website: string;
}

export const SOURCES: FeedSource[] = [
  {
    name: "CoinDesk",
    slug: "coindesk",
    feedUrl: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    website: "coindesk.com",
  },
  {
    name: "Cointelegraph",
    slug: "cointelegraph",
    feedUrl: "https://cointelegraph.com/rss",
    website: "cointelegraph.com",
  },
  {
    name: "Decrypt",
    slug: "decrypt",
    feedUrl: "https://decrypt.co/feed",
    website: "decrypt.co",
  },
  {
    name: "The Block",
    slug: "theblock",
    feedUrl: "https://www.theblock.co/rss",
    website: "theblock.co",
  },
  {
    name: "Blockworks",
    slug: "blockworks",
    feedUrl: "https://blockworks.co/feed",
    website: "blockworks.co",
  },
  {
    name: "Bitcoin Magazine",
    slug: "bitcoinmagazine",
    feedUrl: "https://bitcoinmagazine.com/feed",
    website: "bitcoinmagazine.com",
  },
  {
    name: "CryptoSlate",
    slug: "cryptoslate",
    feedUrl: "https://cryptoslate.com/feed/",
    website: "cryptoslate.com",
  },
  {
    name: "The Daily Hodl",
    slug: "dailyhodl",
    feedUrl: "https://dailyhodl.com/feed/",
    website: "dailyhodl.com",
  },
  {
    name: "NewsBTC",
    slug: "newsbtc",
    feedUrl: "https://newsbtc.com/feed/",
    website: "newsbtc.com",
  },
  {
    name: "Bitcoinist",
    slug: "bitcoinist",
    feedUrl: "https://bitcoinist.com/feed/",
    website: "bitcoinist.com",
  },
  {
    name: "The Defiant",
    slug: "thedefiant",
    feedUrl: "https://thedefiant.io/feed",
    website: "thedefiant.io",
  },
  {
    name: "BitPinas",
    slug: "bitpinas",
    feedUrl: "https://bitpinas.com/feed/",
    website: "bitpinas.com",
  },
];
