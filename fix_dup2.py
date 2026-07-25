with open('src/animation/AnimationManager.js', 'r') as f:
    content = f.read()

# Find the second occurrence of '      this.captureTimeline.start()' after '  }'
import re
starts = [m.start() for m in re.finditer(re.escape('this.captureTimeline.start()'), content)]
print(f'captureTimeline.start() at: {starts}')

# Find all occurrences of '  updateKnightDarknessProgress'
funcs = [m.start() for m in re.finditer(re.escape('updateKnightDarknessProgress'), content)]
print(f'updateKnightDarknessProgress at: {funcs}')

# The issue is between the first function end and the second function start
# There's duplicate code there. Let's find and remove it.
# Find the pattern: '  }\n\n      this.captureTimeline.start()'
pattern = '  }\n\n      this.captureTimeline.start()'
matches = [m.start() for m in re.finditer(re.escape(pattern), content)]
print(f'Pattern matches at: {matches}')

if len(matches) >= 2:
    # Remove the second occurrence and everything up to the next function
    second_match = matches[1]
    # Find the next function
    next_func = content.find('\n  updateKnightDarknessProgress', second_match)
    if next_func > 0:
        new_content = content[:second_match] + content[next_func:]
        with open('src/animation/AnimationManager.js', 'w') as f:
            f.write(new_content)
        print('Removed second duplicate block')
    else:
        print('Could not find next function')
else:
    print('Not enough pattern matches')