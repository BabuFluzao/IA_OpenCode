const fs = require('fs');
const c = fs.readFileSync('bot.js', 'utf8');
const s = c.indexOf('Você é Sophia');
const e = c.indexOf('`;', s);
const p = c.substring(s, e);
console.log('Chars:', p.length);
console.log('~Tokens (chars/4):', Math.round(p.length / 4));
console.log('~Tokens (chars/3.5):', Math.round(p.length / 3.5));
