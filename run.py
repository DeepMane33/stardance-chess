import subprocess
import sys
import os
import shutil

def main():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    vite_bin = os.path.join(project_dir, "node_modules", ".bin", "vite")

    if not os.path.exists(vite_bin):
        print("[*] Installing dependencies...")
        subprocess.run(["npm", "install"], cwd=project_dir, check=True)

    # Use npx.cmd on Windows, npx on other platforms
    npx = "npx.cmd" if sys.platform == "win32" else "npx"

    print("[*] Starting Stardance Chess on http://localhost:3000 ...")
    try:
        subprocess.run([npx, "vite", "--host"], cwd=project_dir, check=True)
    except KeyboardInterrupt:
        print("\n[*] Server stopped.")

if __name__ == "__main__":
    main()
