function lose_severity(win, lose) {
  if (win === 16) {
    if (lose <= 3) {
      return 3;
    } 
    else if (lose <= 8) {
      return 2;
    }
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
