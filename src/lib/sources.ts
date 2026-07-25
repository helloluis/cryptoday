export interface FeedSource {
  name: string;
  slug: string;
  feedUrl: string;
  website: string;
  isAggregator?: boolean;
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
    name: "DL News",
    slug: "dlnews",
    feedUrl: "https://www.dlnews.com/arc/outboundfeeds/rss/",
    website: "dlnews.com",
  },
  {
    name: "Unchained",
    slug: "unchained",
    feedUrl: "https://unchainedcrypto.com/feed/",
    website: "unchainedcrypto.com",
  },
  {
    name: "Protos",
    slug: "protos",
    feedUrl: "https://protos.com/feed/",
    website: "protos.com",
  },
  {
    name: "Yahoo Finance Crypto",
    slug: "yahoo",
    feedUrl: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=BTC-USD,ETH-USD,SOL-USD,XRP-USD&region=US&lang=en-US",
    website: "finance.yahoo.com",
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
  {
    name: "Watcher Guru",
    slug: "watcherguru",
    feedUrl: "https://watcher.guru/news/feed",
    website: "watcher.guru",
  },
  {
    name: "Bilyonaryo",
    slug: "bilyonaryo",
    feedUrl: "https://news.google.com/rss/search?q=site:bilyonaryo.com&hl=en-US&gl=US&ceid=US:en",
    website: "bilyonaryo.com",
    isAggregator: true,
  },
  {
    name: "InsiderPH",
    slug: "insiderph",
    feedUrl: "https://news.google.com/rss/search?q=site:insiderph.com&hl=en-US&gl=US&ceid=US:en",
    website: "insiderph.com",
    isAggregator: true,
  },
  {
    name: "Google News",
    slug: "googlenews",
    feedUrl: "https://news.google.com/rss/search?q=cryptocurrency+OR+bitcoin+OR+blockchain&hl=en-US&gl=US&ceid=US:en",
    website: "news.google.com",
    isAggregator: true,
  },
  // Philippine government and news sources
  // PCO and Official Gazette block datacenter IPs (403 from VPS) — pulled via Google News site search
  {
    name: "Google News PCO",
    slug: "googlenews-pco",
    feedUrl: "https://news.google.com/rss/search?q=site:pco.gov.ph&hl=en-US&gl=US&ceid=US:en",
    website: "pco.gov.ph",
    isAggregator: true,
  },
  {
    name: "Google News Official Gazette",
    slug: "googlenews-gazette",
    feedUrl: "https://news.google.com/rss/search?q=site:officialgazette.gov.ph&hl=en-US&gl=US&ceid=US:en",
    website: "officialgazette.gov.ph",
    isAggregator: true,
  },
  {
    name: "Rappler",
    slug: "rappler",
    feedUrl: "https://www.rappler.com/rss/",
    website: "rappler.com",
  },
  {
    name: "BusinessWorld",
    slug: "businessworld",
    feedUrl: "https://www.bworldonline.com/feed/",
    website: "bworldonline.com",
  },
  {
    name: "Philstar",
    slug: "philstar",
    feedUrl: "https://www.philstar.com/rss/headlines",
    website: "philstar.com",
  },
  // PH agencies without usable RSS (403/no feed) — pulled via Google News site search
  {
    name: "Google News BSP",
    slug: "googlenews-bsp",
    feedUrl: "https://news.google.com/rss/search?q=site:bsp.gov.ph&hl=en-US&gl=US&ceid=US:en",
    website: "bsp.gov.ph",
    isAggregator: true,
  },
  {
    name: "Google News SEC PH",
    slug: "googlenews-secph",
    feedUrl: "https://news.google.com/rss/search?q=site:sec.gov.ph&hl=en-US&gl=US&ceid=US:en",
    website: "sec.gov.ph",
    isAggregator: true,
  },
  {
    name: "Google News DICT",
    slug: "googlenews-dict",
    feedUrl: "https://news.google.com/rss/search?q=site:dict.gov.ph&hl=en-US&gl=US&ceid=US:en",
    website: "dict.gov.ph",
    isAggregator: true,
  },
  {
    name: "Google News PH AI",
    slug: "googlenews-ph-ai",
    feedUrl: "https://news.google.com/rss/search?q=Philippines+(artificial+intelligence+OR+AI)&hl=en-US&gl=US&ceid=US:en",
    website: "news.google.com",
    isAggregator: true,
  },
  {
    name: "Google News PH Crypto",
    slug: "googlenews-ph-crypto",
    feedUrl: "https://news.google.com/rss/search?q=Philippines+(blockchain+OR+cryptocurrency+OR+bitcoin+OR+web3)&hl=en-US&gl=US&ceid=US:en",
    website: "news.google.com",
    isAggregator: true,
  },
  // GlobeNewsWire removed — 98% of its "Blockchain" feed is traditional corporate
  // share buybacks and press releases with no crypto relevance
];
