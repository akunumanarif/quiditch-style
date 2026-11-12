"""Rebuild local CC0 dependencies and the original Blender rider."""
import os,shutil,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
subprocess.run([sys.executable,str(root/'assets-source/fetch_materials.py')],cwd=root,check=True)
blender=os.getenv('BLENDER_BIN') or shutil.which('blender') or '/Applications/Blender.app/Contents/MacOS/Blender'
if not Path(blender).exists():raise SystemExit('Install Blender or set BLENDER_BIN to its executable.')
subprocess.run([blender,'--background','--python',str(root/'assets-source/build_pilot.py')],cwd=root,check=True)
