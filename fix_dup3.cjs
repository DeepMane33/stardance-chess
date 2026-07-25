const fs = require('fs');
const f = 'src/animation/CaptureAnimations.js';
let s = fs.readFileSync(f, 'utf8');
const lines = s.split(/\r?\n/);

// Find all lines that contain "// Royal decap: capturing the king"
const indices = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Royal decap: capturing the king')) {
    indices.push(i);
  }
}

if (indices.length >= 2) {
  const start = indices[1]; // second occurrence
  // walk backwards to find the export function line
  let funcStart = start;
  for (let i = start; i >= 0; i--) {
    if (lines[i].includes('export function resolveCaptureTier')) {
      funcStart = i;
      break;
    }
  }
  // walk forwards to find the closing brace
  let braceCount = 0;
  let closeIdx = -1;
  for (let i = funcStart; i < lines.length; i++) {
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
    const keep = lines.slice(0, funcStart).concat(lines.slice(closeIdx + 1));
    fs.writeFileSync(f, keep.join('\n'), 'utf8');
    console.log('Removed duplicate. Now ' + keep.length + ' lines');
  } else {
    console.log('No closing brace found');
  }
} else {
  console.log('Only ' + indices.length + ' occurrences found');
}
