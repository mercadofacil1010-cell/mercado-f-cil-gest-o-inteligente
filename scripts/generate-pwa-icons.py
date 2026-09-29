"""Gera os ícones PNG do manifesto PWA (B5.5) sem depender de libs externas
(zlib é da stdlib). Reaproveita as cores da marca (src/styles.css: --logo,
--logo-accent, --logo-highlight) em versão simplificada — só retângulos,
sem o traço fino do SVG completo, que não compensa reproduzir em um ícone
pequeno de tela inicial.
"""
import struct
import zlib
import os

NAVY = (19, 28, 46)       # aprox. de --logo oklch(0.235 0.05 250.5)
TEAL = (45, 197, 173)      # aprox. de --logo-accent/--primary oklch(0.692 0.126 184.7)
HIGHLIGHT = (214, 224, 90) # aprox. de --logo-highlight oklch(0.83 0.2 128.9)
WHITE = (255, 255, 255)


def make_png(size: int, maskable: bool) -> bytes:
    pixels = [[NAVY for _ in range(size)] for _ in range(size)]

    # Zona seguro para maskable (~80% central); ícone "any" usa quase tudo.
    margin = int(size * (0.20 if maskable else 0.12))
    inner = size - 2 * margin

    def set_rect(x0, y0, w, h, color):
        for y in range(y0, min(y0 + h, size)):
            for x in range(x0, min(x0 + w, size)):
                if 0 <= x < size and 0 <= y < size:
                    pixels[y][x] = color

    # "M" estilizado: dois traços verticais + um "v" central, em teal sobre navy.
    stroke = max(2, inner // 10)
    set_rect(margin, margin, stroke, inner, TEAL)
    set_rect(margin + inner - stroke, margin, stroke, inner, TEAL)
    mid_w = inner - 2 * stroke
    set_rect(margin + stroke, margin, mid_w, stroke, TEAL)

    # Quadrado de destaque no canto (mesmo espírito do highlight da logo real).
    hl = max(3, inner // 4)
    set_rect(margin + inner - hl, margin + inner - hl, hl, hl, HIGHLIGHT)

    raw = bytearray()
    for y in range(size):
        raw.append(0)  # sem filtro
        for x in range(size):
            r, g, b = pixels[y][x]
            raw += bytes((r, g, b, 255))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
    os.makedirs(out_dir, exist_ok=True)
    specs = [
        ("app-icon-192.png", 192, False),
        ("app-icon-512.png", 512, False),
        ("app-icon-maskable-192.png", 192, True),
        ("app-icon-maskable-512.png", 512, True),
    ]
    for name, size, maskable in specs:
        data = make_png(size, maskable)
        path = os.path.join(out_dir, name)
        with open(path, "wb") as f:
            f.write(data)
        print(f"wrote {path} ({len(data)} bytes)")


if __name__ == "__main__":
    main()
