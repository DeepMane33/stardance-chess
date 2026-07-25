with open('src/animation/AnimationManager.js', 'r') as f:
    content = f.read()

# Find both animateCapture function definitions
first = content.find('animateCapture(captureData)')
second = content.find('animateCapture(captureData)', first + 1)

print('First at:', first, 'Second at:', second)

# Find the end of first function - look for pattern
if second > 0:
    # Find the proper end of first function
    pattern = '    })\n  }'
    end_first = content.rfind(pattern, 0, second)
    print('End of first function at:', end_first)
    if end_first > 0:
        # Find the next function after second
        next_func = content.find('\n  updateKnightDarknessProgress', second)
        print('Next function at:', next_func)
        if next_func > 0:
            new_content = content[:end_first + len(pattern)] + content[next_func:]
            with open('src/animation/AnimationManager.js', 'w') as f:
                f.write(new_content)
            print('Fixed!')
        else:
            print('Could not find next function')
    else:
        print('Could not find end of first function')
else:
    print('No second function found')