import { calculateTheme, RPS } from './src/logic';

const grid = [
  [RPS.ROCK, RPS.SCISSORS, RPS.BLANK],
  [RPS.ROCK, RPS.SCISSORS, RPS.BLANK],
  [RPS.PAPER, RPS.SCISSORS, RPS.BLANK]
];

console.log(calculateTheme(grid));
