const ranks = [
  { name: "Sol Invictus", scoreThreshold: 55, img: 'rank_12.png' },
  { name: "Aurora Borealis", scoreThreshold: 50, img: 'rank_11.png' },
  { name: "Skylord", scoreThreshold: 45, img: 'rank_10.png' },
  { name: "Sentinel", scoreThreshold: 40, img: 'rank_9.png' },
  { name: "Starling", scoreThreshold: 35, img: 'rank_8.png' },
  { name: "Twin Plates", scoreThreshold: 30, img: 'rank_7.png' },
  { name: "Platinum", scoreThreshold: 25, img: 'rank_6.png' },
  { name: "Knower", scoreThreshold: 20, img: 'rank_5.png' },
  { name: "Seeker", scoreThreshold: 15, img: 'rank_4.png' },
  { name: "Survivor", scoreThreshold: 10, img: 'rank_3.png' },
  { name: "Bronze Elite", scoreThreshold: 5, img: 'rank_2.png' },
  { name: "Bronze", scoreThreshold: 0, img: 'rank_1.png' },
  { name: "Elo Hell 1", scoreThreshold: -5, img: 'rank_hell_1.png' },
  { name: "Elo Hell 2", scoreThreshold: -10, img: 'rank_hell_2.png' },
  { name: "Elo Hell 3", scoreThreshold: -99, img: 'rank_hell_3.png' }
];

function getRank(score) {
  for (const rank of ranks) {
    if (score >= rank.scoreThreshold) {
      return { rankName: rank.name, rankImg: rank.img };
    }
  }
  return { rankName: 'Bronze', rankImg: 'rank_1.png' };
}

function formatMMRDelta(mmr) {
  const name = mmr >= 0 ? 'u' : 'd';
  const symbol = mmr >= 0 ? '↑' : '↓';
  return `<span class="${name}">${symbol}${Math.abs(mmr).toFixed(2)}</span>`;
}

function countryCodeToEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🏴';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/*
  How an account is shown on the site. A key account ("key_<public key in hex>") is shown as its public key
  with "0x" - in short "0xaf2e22db..." (as in the game), in full "0x<all 64 digits>". The id itself ("key_..." in URLs and
  the database) stays as it is.
*/
function accountLabel(id) {
  return id.startsWith('key_') ? `0x${id.slice(4, 12)}...` : id.split('_')[0];
}

function fullAccountId(id) {
  return id.startsWith('key_') ? `0x${id.slice(4)}` : id;
}

/*
  A server's address as the game shows it - without the default port 8412, which a join without a port uses anyway:
  "1.2.3.4:8412" is "1.2.3.4", "[::1]:8412" is "[::1]"; any other port stays. Never a bare IPv6 nor a WebRTC id
  ("rtc:..."), and never the address in a URL or a browser join (there the port is part of the server's id).
*/
function shownAddress(address) {
  const a = String(address).trim();
  const suffix = ':8412';

  if (a.startsWith('rtc:') || !a.endsWith(suffix)) {
    return a;
  }

  const host = a.slice(0, -suffix.length);
  const bracketedIpv6 = host.startsWith('[') && host.endsWith(']');

  return (!bracketedIpv6 && host.includes(':')) ? a : host;
}

module.exports = {
  getRank,
  formatMMRDelta,
  countryCodeToEmoji,
  accountLabel,
  fullAccountId,
  shownAddress
};