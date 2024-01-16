function lose_severity(win, lose) {
  if (win === 16) {
    // Determine the number of iterations based on lose_score
    if (lose <= 3) {
      // Annihilated
      return 3;
    }
    else if (lose <= 8) {
      // Crushed
      return 2;
    }
  }

  return 1;
}

module.exports = lose_severity;
