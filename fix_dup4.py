with open('src/animation/AnimationManager.js', 'r') as f:
    lines = f.readlines()

# Find the duplicate block starting at '      this.captureTimeline.start()' after the first function end
# The first function ends at line 401 with '    })
# Then there's a blank line 402, then duplicate at 403-415

# Find the second occurrence of 'this.captureTimeline.start()' that is preceded by blank line and followed by the audio block
for i, line in enumerate(lines):
    if i > 400 and line.strip() == 'this.captureTimeline.start()':
        # Check if previous line is blank and this is the second occurrence
        if i > 0 and lines[i-1].strip() == '':
            # Look for the closing of this block
            for j in range(i, len(lines)):
                if lines[j].strip() == '})' and j+1 < len(lines) and lines[j+1].strip() == '}':
                    print(f'Found duplicate at lines {i+1}-{j+2}')
                    del lines[i:j+2]
                    break
            break

with open('src/animation/AnimationManager.js', 'w') as f:
    f.writelines(lines)
print('Done')