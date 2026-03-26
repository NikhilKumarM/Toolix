# Toolix — 25 Developer Utilities

A complete offline developer toolkit built with Electron for Windows.

## Tools Included (25 total)

### Data Format Tools
1. **JSON Formatter / Validator** — Format, minify, sort keys, validate
2. **XML Formatter / Validator** — Format, minify, parse errors
3. **YAML ↔ JSON Converter** — Bidirectional conversion
4. **CSV ↔ JSON Converter** — Bidirectional conversion with header detection
5. **Base64 Encoder / Decoder** — Encode/decode text to Base64
6. **HTML Formatter / Minifier** — Pretty-print or minify HTML

### Security & Auth Tools
7. **JWT Decoder / Inspector** — Decode header/payload/signature, expiry check
8. **Hash Generator** — MD5, SHA-1, SHA-256, SHA-384, SHA-512
9. **Password Generator & Strength Checker** — Configurable generation + entropy analysis
10. **UUID / GUID Generator** — v1, v4, Nil UUIDs with formatting options
11. **RSA Key Pair Generator** — 1024/2048/4096-bit, PKCS#8 PEM output

### Text & String Tools
12. **Regex Tester & Debugger** — Match highlighting, group capture, live testing
13. **Diff Checker** — Line-by-line comparison with additions/deletions highlighted
14. **Lorem Ipsum Generator** — Words, sentences, or paragraphs
15. **Case Converter** — 12 formats: camelCase, snake_case, PascalCase, kebab-case, etc.
16. **URL Encoder / Decoder** — Encode/decode URL components
17. **Markdown Previewer** — Live preview with full MD support

### Network & API Tools
18. **URL Parser & Builder** — Parse all URL components + query parameters
19. **HTTP Status Code Reference** — All codes with descriptions, searchable
20. **CORS Header Analyzer** — Analyze headers with security recommendations
21. **IP / CIDR Calculator** — Subnet math, host ranges, IP info
22. **Cron Expression Parser** — Human-readable explanation + next run times

### Developer Utilities
23. **Color Picker & Converter** — HEX, RGB, HSL, CMYK + palette generator
24. **Epoch / Timestamp Converter** — Bidirectional with live clock
25. **Number Base Converter** — Decimal, Binary, Hex, Octal, Custom base
26. **QR Code Generator** — Configurable size, error correction, download PNG
27. **Image → Base64 Converter** — Drag-and-drop with CSS url() copy

---

## Prerequisites

- **Node.js** v18+ → https://nodejs.org

---

## Setup

```bash
# 1. Install everything (Electron + QR library, auto-copied to libs/)
npm install

# 2. Run in dev mode
npm start
```

---

## Build Windows Executable

```bash
# Full installer (.exe) + portable
npm run build

# Portable only (no install needed)
npm run build:portable
```

Output in `dist/`:
- `Toolix Setup 2.0.0.exe` — NSIS installer
- `Toolix 2.0.0.exe` — Portable

---

## Project Structure

```
toolix/
├── main.js          # Electron main process
├── index.html       # App layout + all 25 tool panels
├── styles.css       # Dark theme
├── app.js           # All tool logic
├── libs/
│   └── qrcode.min.js   # QR library (copy from npm)
├── assets/
│   └── icon.ico     # App icon (optional)
└── package.json
```

---

## Notes

- All processing is **100% local** — no data leaves your machine
- No internet connection required (after initial npm install)
- JWT: signatures are decoded but **not cryptographically verified**
- RSA: uses native Web Crypto API for secure key generation
