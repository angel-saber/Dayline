"""Surface compiler errors as GitHub annotations as well as in raw build logs."""
import sys
from pathlib import Path

lines = Path(sys.argv[1]).read_text(errors="replace").splitlines()
messages = list(dict.fromkeys(line.strip() for line in lines if "error:" in line))
for message in messages[:25]:
    escaped = message.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    print(f"::error title=Xcode build::{escaped}")
