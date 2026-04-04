const KNOWN_ASSETS = [
  '000', '110', '111', '131', '141', '301', '310', '311', '313', '330', '331', '333', '343',
  '401', '403', '410', '411', '414', '430', '431', '433', '434', '440', '441', '443', '444'
];

const symbols = ['0', '1', '3', '4'];
const allCombos = [];
for (const a of symbols) {
  for (const b of symbols) {
    for (const c of symbols) {
      allCombos.push(a + b + c);
    }
  }
}

const uniquePhysical = new Set();
const missing = [];

for (const combo of allCombos) {
  const rev = combo.split('').reverse().join('');
  const code = combo < rev ? combo : rev; // canonical form
  if (!uniquePhysical.has(code)) {
    uniquePhysical.add(code);
    if (!KNOWN_ASSETS.includes(code) && !KNOWN_ASSETS.includes(rev)) {
      missing.push(code);
    }
  }
}

console.log(missing);
