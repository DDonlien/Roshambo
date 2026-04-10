const fs = require('fs');
let text = fs.readFileSync('ts/src/style.css', 'utf-8');
text = text.replace(/(\d+(\.\d+)?)vw/g, '$1cqw');
text = text.replace('100cqw', '100%');
fs.writeFileSync('ts/src/style.css', text);
