#!/usr/bin/env python3
"""Render M03 ¿Americano? (café, Ethan, lipsync + parpadeo)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from produce_vertical import produce, M03

if __name__ == "__main__":
    produce(M03)
