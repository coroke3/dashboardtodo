const fs = require('fs');
const content = fs.readFileSync('src/App.jsx', 'utf8');
let divStack = [];
let re = /<div|<\/div/g;
let match;
while ((match = re.exec(content)) !== null) {
  const line = content.substring(0, match.index).split('\n').length;
  if (match[0] === '<div') divStack.push(line);
  else if (match[0] === '</div>') {
    if (divStack.length === 0) console.log('Extra </div> at line ' + line);
    else divStack.pop();
  }
}
console.log('Unclosed <div> starts at lines:');
divStack.forEach(l => console.log(l));
