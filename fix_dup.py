with open('src/animation/AnimationManager.js', 'r') as f:
    content = f.read()

import re

# Find 'this.captureTimeline.start()' occurrences
starts = [m.start() for m in re.finditer(re.escape('this.captureTimeline.start()'), content)]
print(f'captureTimeline.start() at: {starts}')

if len(starts) > 1:
    second_start = starts[1]
    # Find the '\n  }\n' before it
    prev_brace = content.rfind('\n  }\n', 0, second_start)
    print(f'Previous brace at: {prev_brace}')
    if prev_brace > 0:
        # Find the '\n  }\n' after second_start
        next_brace = content.find('\n  }\n', second_start)
        print(f'Next brace at: {next_brace}')
        if next_brace > 0:
            # Also need to find the matching closing of the function
            # Find the next function definition
            next_func = content.find('\n  updateKnightDarknessProgress', next_brace)
            print(f'Next function at: {next_func}')
            if next_func > 0:
                # Remove from prev_brace+3 to next_brace+3
                new_content = content[:prev_brace+3] + content[next_brace+3:]
                with open('src/animation/AnimationManager.js', 'w') as f:
                    f.write(new_content)
                print('Fixed!')
            else:
                print('Could not find next function')
        else:
            print('Could not find next brace')
    else:
        print('Could not find previous brace')
else:
    print('Only one captureTimeline.start() found')