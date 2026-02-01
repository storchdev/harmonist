import sys
from glob import glob

if len(sys.argv) == 1:
    print("Provide at least one glob")
    sys.exit(1)

massive = []
for pth in sys.argv[1:]:
    for fname in glob(pth):
        with open(fname) as f:
            massive.append(f"--- {fname}")
            massive.append(f.read())

print("\n".join(massive) + "\n")
