const RPS = {
  ROCK: 'ROCK',
  SCISSORS: 'SCISSORS',
  PAPER: 'PAPER',
  BLANK: 'BLANK'
};
const ELEMENT_PRIORITY = [RPS.ROCK, RPS.SCISSORS, RPS.PAPER];

function calculateTheme(grid) {
  const counts = {
    [RPS.ROCK]: 0,
    [RPS.SCISSORS]: 0,
    [RPS.PAPER]: 0,
    [RPS.BLANK]: 0
  };

  for (const row of grid) {
    for (const symbol of row) {
      counts[symbol] += 1;
    }
  }

  let bestElement = RPS.ROCK;
  let bestPower = counts[RPS.ROCK];

  for (const element of ELEMENT_PRIORITY) {
    const power = counts[element];
    if (power > bestPower) {
      bestElement = element;
      bestPower = power;
    }
  }

  return { element: bestElement, power: bestPower };
}

const grid = [
  [RPS.ROCK, RPS.SCISSORS, RPS.BLANK],
  [RPS.ROCK, RPS.SCISSORS, RPS.BLANK],
  [RPS.PAPER, RPS.SCISSORS, RPS.BLANK]
];

console.log(calculateTheme(grid));
