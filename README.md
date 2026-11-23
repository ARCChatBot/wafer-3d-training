# Silicon Wafer Training (3D)

An interactive 3D lesson for high-school students: travel from a whole 300 mm silicon wafer down through one chip, its layers, the copper wiring and a transistor, to the silicon crystal and a single atom.

**Open it:** https://arcchatbot.github.io/wafer-3d-training/

## What it does

- **Sign in** with a name and V-number.
- **Seven stops**, each built to real dimensions:

  | Stop | Shows | Scale |
  |---|---|---|
  | Wafer | The whole wafer | 300 mm |
  | Die | One chip | 18.4 mm |
  | Layers | The chip's layers, exploded | (stretched to show) |
  | Wiring | Copper wiring | about 7 µm |
  | Transistor | A FinFET | about 300 nm |
  | Crystal | The silicon crystal | about 2 nm |
  | Atom | One atom's electron cloud | about 0.5 nm |

  A scale ruler shows how far you have zoomed, and a size comparison names an everyday object of about that size (a dinner plate, a postage stamp, a red blood cell, a virus, a DNA strand, water molecules).
- **Clickable labels:** tap any labelled part of the model for a short explanation.
- **Check your understanding:** one multiple-choice question per stop. The next stop stays locked until it is answered correctly, and a Continue button leads on. Wrong answers can be retried. The score counts answers right on the first try.
- **Completion and certificate:** answering all seven shows a "2D/3D training is complete" card with the name, V-number, score, time and a certificate ID, plus a **Download certificate** button for a printable certificate of completion.
- **Real images:** a panel shows a real microscope image at most stops (see [CREDITS.md](CREDITS.md)).
- **Auto tour:** before sign-in the page tours itself; once a trainee signs in, they drive and stops unlock in order.
- **Look:** a mirror-polished wafer that reflects studio light, real die photography on every die, and the Operation SEMI / MI-CHIPS presentation colours (Trojan Blue `#00358E`, Precision Orange `#FF6700` as a small accent, Deep Academic Slate `#0B0F19`).

### Controls

| Control | What it does |
|---|---|
| Keys `0`–`6` | Jump to a stop |
| `←` / `→` | Step to the previous or next stop |
| Scroll | Dive in or come back out |
| Drag | Orbit the model |
| `Space` | Play or pause |
| `L` | Labels on or off |
| `M` | Microscope image on or off |
| `O` | Orbit on or off |

## Recording completions

On GitHub Pages the lesson and questions work fully, but **results are not saved anywhere**; the completion card is the only record.

Completions are recorded only when the page is opened on claude.ai, where it uses the artifact's shared database. Records are readable only by the owner and editors, through a records view with a CSV download and a certificate download for each trainee.

## Files

- `index.html`: the complete page, self-contained (three.js, fonts and code inlined). It loads its images from `micro/`.
- `micro/`: the real microscope images, credited in [CREDITS.md](CREDITS.md).
- `src/shared/`: the source.

  | File | Contents |
  |---|---|
  | `kin.js` | Real dimensions and the one input, depth, that drives everything |
  | `model.js` | The 3D geometry for every level |
  | `stage.js` | Lighting, shadows and ambient occlusion |
  | `console.js` | The on-screen panels |
  | `film.js` | The tour script |
  | `live.js` | The interactive page |
  | `edu.js` | The lesson text, part notes and questions |
  | `trainee.js` | Sign-in, locked stops, questions, completion, certificate and recording |

- `src/kit/`: helper modules from the Teardown kit, MIT licensed (see `src/kit/LICENSE`).
- `src/wafer-live/` and `src/wafer-film/`: the entry points for the interactive page and the recorded tour.

The page was built with the Teardown kit's bundler (esbuild plus three.js r186). The source imports the kit as `teardown-kit/...`.

## Notes on accuracy

- Dimensions come from published values: a SEMI-standard 300 mm × 0.775 mm wafer, typical copper wiring widths, typical 7 nm-class FinFET dimensions, and silicon's lattice constant of 0.5431 nm.
- The die grid gives 164 complete dies; the textbook estimate is 171, but that estimate ignores the 3 mm edge exclusion.
- The layer stack is stretched so each layer can be seen.
- The atom's electron cloud is a drawn model, not a measurement, and its nucleus is drawn thousands of times too large.
- No freely licensed photograph of a modern transistor was available, so that stop's real image shows memory cells from an older 180 nm chip.

## Licence

The images keep their own licences (see [CREDITS.md](CREDITS.md)), and the kit modules are MIT. No licence has been chosen yet for the rest of the code; until one is added, all rights are reserved.
