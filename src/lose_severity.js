function lose_severity(win, lose) {
  const diff = win - lose;

  if (diff >= 13) {
    return 3;
  }

  if (diff >= 8) {
    return 2;
  }

  return 1;
}

function severityToString(severity) {
  switch (severity) {
    case 3:
      return 'Annihilated';
    case 2:
      return 'Crushed';
    default:
      return 'Slain';
  }
}

module.exports = { lose_severity, severityToString };
