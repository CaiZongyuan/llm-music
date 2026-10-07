"""Check complete Standard MIDI chunks/events and actual note-on content."""

import struct


def note_count(data: bytes) -> int:
    if len(data) < 14 or data[:4] != b"MThd":
        raise ValueError("MIDI header is missing")
    length, kind, tracks, division = struct.unpack(">IHHH", data[4:14])
    if length != 6 or kind > 2 or tracks <= 0 or division == 0 or (kind == 0 and tracks != 1):
        raise ValueError("MIDI header is invalid")
    position, notes = 14, 0
    for _ in range(tracks):
        if position + 8 > len(data) or data[position:position + 4] != b"MTrk":
            raise ValueError("MIDI track chunk is missing")
        size = int.from_bytes(data[position + 4:position + 8], "big")
        position += 8
        track = data[position:position + size]
        if len(track) != size:
            raise ValueError("MIDI track is truncated")
        position += size
        cursor, running, ended = 0, None, False

        def variable() -> int:
            nonlocal cursor
            value = 0
            for _ in range(4):
                if cursor >= len(track):
                    raise ValueError("MIDI variable value is truncated")
                byte = track[cursor]
                cursor += 1
                value = (value << 7) | (byte & 127)
                if not byte & 128:
                    return value
            raise ValueError("MIDI variable value is too long")

        while cursor < len(track):
            variable()
            if cursor >= len(track):
                raise ValueError("MIDI event is truncated")
            status = track[cursor]
            if status & 128:
                cursor += 1
            elif running is not None:
                status = running
            else:
                raise ValueError("MIDI running status is missing")
            if status == 255:
                running = None
                if cursor >= len(track):
                    raise ValueError("MIDI meta event is truncated")
                meta = track[cursor]
                cursor += 1
                meta_size = variable()
                if cursor + meta_size > len(track):
                    raise ValueError("MIDI meta payload is truncated")
                cursor += meta_size
                if meta == 47:
                    if meta_size != 0 or cursor != len(track):
                        raise ValueError("MIDI end-of-track is invalid")
                    ended = True
                    break
            elif status in {240, 247}:
                running = None
                payload_size = variable()
                cursor += payload_size
                if cursor > len(track):
                    raise ValueError("MIDI sysex payload is truncated")
            elif 128 <= status < 240:
                running = status
                count = 1 if status & 240 in {192, 208} else 2
                values = track[cursor:cursor + count]
                if len(values) != count or any(value >= 128 for value in values):
                    raise ValueError("MIDI channel event is truncated")
                cursor += count
                if status & 240 == 144 and values[1] > 0:
                    notes += 1
            else:
                raise ValueError("Unsupported MIDI system event")
        if not ended:
            raise ValueError("MIDI track has no end marker")
    if position != len(data) or notes == 0:
        raise ValueError("MIDI has trailing/missing chunks or no actual notes")
    return notes
