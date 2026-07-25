const fs = require('fs');
const f = 'src/animation/CaptureAnimations.js';
let s = fs.readFileSync(f, 'utf8');
const lines = s.split(/\r?\n/);

// Find the first occurrence of "  // Royal decap: capturing the king"
let firstRoyal = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '// Royal decap: capturing the king (checkmate situation)') {
    if (firstRoyal === -1) firstRoyal = i;
  }
}

// Find the second function start
let secondFunc = -1;
let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export function resolveCaptureTier')) {
    count++;
    if (count === 2) {
      secondFunc = i;
      break;
    }
  }
}

if (secondFunc !== -1) {
  // Find the closing brace of the second function
  let braceCount = 0;
  let closeIdx = -1;
  for (let i = secondFunc; i < lines.length; i++) {
    if (lines[i].includes('{')) braceCount++;
    if (lines[i].includes('}')) {
      braceCount--;
      if (braceCount === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx !== -1) {
    const keep = lines.slice(0, secondFunc).concat(lines.slice(closeIdx + 1));
    fs.writeFileSync(f, keep.join('\n'), 'utf8');
    console.log('Removed duplicate resolveCaptureTier. Now ' + keep.length + ' lines');
  } else {
    console.log('Could not find closing brace');
  }
} else {
  console.log('No duplicate function found');
}
