const fs = require('fs');
const content = fs.readFileSync('src/App.jsx', 'utf8');
let stack = [];
for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (char === '(') stack.push({ line: content.substring(0, i).split('\n').length, char: i });
  else if (char === ')') {
    if (stack.length === 0) {
      console.log('Extra closing parenthesis found at line ' + content.substring(0, i).split('\n').length);
    } else {
      stack.pop();
    }
}
}
if (stack.length > 0) {
  console.log('Unclosed opening parentheses:');
  stack.forEach(s => console.log('Line ' + s.line));
}
