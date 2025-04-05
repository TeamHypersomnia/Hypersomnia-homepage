function formatMMRDelta(mmr_delta) {
  const deltaSymbol = mmr_delta >= 0 ? '↑' : '↓';
  const className = mmr_delta >= 0 ? 'up' : 'down';
  return `<span class="${className}">${deltaSymbol}${Math.abs(mmr_delta).toFixed(2)}</span>`;
}

module.exports = formatMMRDelta;
