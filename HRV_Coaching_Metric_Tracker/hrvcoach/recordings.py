"""Call-recording uploads.

Two jobs live here: deciding whether an uploaded file is a call recording we
will accept, and serving one back in a way ``<audio>`` can actually scrub.

**Accepting.** The browser's ``Content-Type`` is whatever the client felt like
sending, so it is a hint, not evidence. The extension and a magic-number sniff
are checked as well, and the stored content type comes from our own table -
never from the request - so a file cannot be served back as ``text/html`` and
run as a page on the app's own origin.

**Serving.** Chrome will not let a listener drag the scrubber unless the server
answers a ``Range`` request with ``206``, so a single-range reader is
implemented here. Recordings are small enough (see ``MAX_RECORDING_BYTES``) to
slice in memory.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# extension -> the content type we will serve it back as.
ALLOWED_EXTENSIONS = {
    "mp3": "audio/mpeg",
    "m4a": "audio/mp4",
    "mp4": "audio/mp4",
    "aac": "audio/aac",
    "wav": "audio/wav",
    "ogg": "audio/ogg",
    "oga": "audio/ogg",
    "opus": "audio/ogg",
    "webm": "audio/webm",
    "flac": "audio/flac",
    "amr": "audio/amr",
}

# (offset, signature) pairs that confirm a container we accept. An MP3 with an
# ID3 tag starts "ID3"; a bare frame starts 0xFF 0xEx/0xFx.
_MAGIC = [
    (0, b"ID3"),
    (0, b"RIFF"),      # wav
    (0, b"OggS"),      # ogg / opus
    (0, b"fLaC"),
    (0, b"\x1a\x45\xdf\xa3"),  # matroska / webm
    (4, b"ftyp"),      # mp4 / m4a / 3gp
    (0, b"#!AMR"),
]

RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


class RejectedUpload(ValueError):
    """The upload is not something we will store, with a reason to show."""


@dataclass(frozen=True)
class Upload:
    filename: str
    content_type: str
    data: bytes

    @property
    def size(self) -> int:
        return len(self.data)


def _extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _looks_like_audio(data: bytes) -> bool:
    for offset, signature in _MAGIC:
        if data[offset : offset + len(signature)] == signature:
            return True
    # A bare MPEG audio frame: 11 sync bits, then a non-reserved version/layer.
    return len(data) > 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0


def safe_name(filename: str) -> str:
    """A display name with no path, control characters, or quoting surprises."""
    base = filename.replace("\\", "/").rsplit("/", 1)[-1]
    cleaned = re.sub(r'[\x00-\x1f"\\]', "", base).strip() or "recording"
    return cleaned[:120]


def accept(file_storage, max_bytes: int) -> Upload:
    """Validate an uploaded ``FileStorage`` and read it into memory."""
    name = safe_name(getattr(file_storage, "filename", "") or "")
    extension = _extension(name)
    if extension not in ALLOWED_EXTENSIONS:
        raise RejectedUpload(
            "Upload an audio file - "
            + ", ".join(sorted("." + e for e in ALLOWED_EXTENSIONS))
            + "."
        )

    data = file_storage.read(max_bytes + 1)
    if not data:
        raise RejectedUpload("That file is empty.")
    if len(data) > max_bytes:
        raise RejectedUpload(f"Recordings are capped at {max_bytes // (1024 * 1024)} MB.")
    if not _looks_like_audio(data):
        raise RejectedUpload(
            "That does not look like an audio recording - the file contents do not "
            "match its extension."
        )

    return Upload(filename=name, content_type=ALLOWED_EXTENSIONS[extension], data=data)


def parse_range(header: str | None, size: int) -> tuple[int, int] | None:
    """``(start, end)`` inclusive for a single satisfiable range, else ``None``.

    Anything we do not understand - multi-range, a unit that is not bytes, an
    unsatisfiable window - returns ``None`` so the caller sends the whole file,
    which is always a valid answer to a Range request.
    """
    if not header or size <= 0:
        return None
    match = RANGE_RE.match(header.strip())
    if not match:
        return None
    first, last = match.group(1), match.group(2)
    if first == "":
        if last == "":
            return None
        length = min(int(last), size)
        if length <= 0:
            return None
        return size - length, size - 1
    start = int(first)
    end = int(last) if last else size - 1
    end = min(end, size - 1)
    if start > end or start >= size:
        return None
    return start, end
