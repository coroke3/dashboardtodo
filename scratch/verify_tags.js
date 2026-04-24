const fs = require('fs');
const content = fs.readFileSync('src/App.jsx', 'utf8');
let stack = [];
let re = /<(div|main|header|footer|aside|section|Section|Container|UISettingsView|AnalyticsView|BatchReplaceView|TagManagerView|RoutineDetectorView|CompositeChart|AnimatedToggle)|<\/(div|main|header|footer|aside|section|Section|Container|UISettingsView|AnalyticsView|BatchReplaceView|TagManagerView|RoutineDetectorView|CompositeChart|AnimatedToggle)/g;
let match;
while ((match = re.exec(content)) !== null) {
  const line = content.substring(0, match.index).split('\n').length;
  const tag = match[1] || match[2];
  const isClosing = match[0].startsWith('</');
  
  if (isClosing) {
    if (stack.length === 0) {
      console.log(`Extra closing </${tag}> at line ${line}`);
    } else {
      const top = stack.pop();
      if (top.tag !== tag) {
        console.log(`Mismatched closing tag: expected </${top.tag}> (opened at ${top.line}), but found </${tag}> at line ${line}`);
      }
    }
  } else {
    // Check for self-closing in the original content
    const tail = content.substring(match.index);
    const endOfTag = tail.indexOf('>');
    if (endOfTag !== -1 && tail.substring(0, endOfTag).endsWith('/')) {
      // Self-closing, ignore
    } else {
      stack.push({ tag, line });
    }
  }
}
console.log('Final unclosed stack:');
stack.forEach(s => console.log(`${s.tag} (opened at ${s.line})`));
