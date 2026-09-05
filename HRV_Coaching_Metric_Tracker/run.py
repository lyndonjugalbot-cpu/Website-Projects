#!/usr/bin/env python3
"""Development entry point: ``python run.py`` then open http://127.0.0.1:5000."""

from __future__ import annotations

import os

from hrvcoach import create_app

app = create_app()

if __name__ == "__main__":
    app.run(
        host=os.environ.get("HRV_HOST", "127.0.0.1"),
        port=int(os.environ.get("HRV_PORT", "5000")),
        debug=os.environ.get("HRV_DEBUG", "1") == "1",
    )
