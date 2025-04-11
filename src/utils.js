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
      return { name: rank.name, rankImg: rank.img };
    }
  }
  return { name: 'Bronze', rankImg: 'rank_1.png' };
}

function formatMMRDelta(mmr) {
  const name = mmr >= 0 ? 'u' : 'd';
  const symbol = mmr >= 0 ? '↑' : '↓';
  return `<span class="${name}">${symbol}${Math.abs(mmr).toFixed(2)}</span>`;
}

module.exports = { getRank, formatMMRDelta };
