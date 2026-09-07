#!/usr/bin/env python3
"""Render M02 Socialización (lipsync + ademán)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from produce_vertical import produce, M02

if __name__ == "__main__":
    produce(M02)
