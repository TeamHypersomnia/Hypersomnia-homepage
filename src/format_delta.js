function formatMMRDelta(mmr_delta, monospace = false) {
  const deltaSymbol = mmr_delta >= 0 ? '↑' : '↓';
  const deltaColor = mmr_delta >= 0 ? 'chartreuse' : '#f85e73';
  const fontFamily = monospace ? 'font-family: monospace;' : '';
  return `<span style="color:${deltaColor}; ${fontFamily}">${deltaSymbol}${Math.abs(mmr_delta).toFixed(2)}</span>`;
}

module.exports = formatMMRDelta;
