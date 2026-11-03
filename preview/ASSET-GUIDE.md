# Portfolio preview — asset replacement guide

The preview is published from `main` under `/preview/`. The eight project artwork panels are intentionally marked **ASSET PENDIENTE · REEMPLAZAR**. Their current geometric treatments are placeholders, not final project artwork.

## Replaceable project slots

| Slot | Current project | Suggested filename |
|---|---|---|
| `jasypa` | Jasypa · Credisimple | `jasypa-cover.webp` |
| `illustration-selection` | Selección de ilustraciones | `illustration-selection.webp` |
| `personal-illustration` | Ilustración personal | `personal-illustration.webp` |
| `shopping-mariano-15` | Shopping Mariano · 15 años | `shopping-mariano-15.webp` |
| `player` | Player | `player-identity.webp` |
| `todegol` | Todegol | `todegol-campaign.webp` |
| `etidol-dolores` | Etidol · Dolores del hincha | `etidol-dolores-del-hincha.webp` |
| `banco-atlas-dia-del-nino` | Banco Atlas · Día del Niño | `banco-atlas-dia-del-nino.webp` |

## Asset specifications

- Preferred still format: WebP; use AVIF only with a WebP fallback.
- Keep original PSD/AI/Clip Studio/MP4 source files outside the delivery folder; export optimized web assets.
- Prepare a landscape crop around 4:3 or 3:2 for desktop panels. Keep the important subject near the center because mobile panels become portrait-oriented.
- Recommended width: 1400–1800 px. Target still-image weight: 150–400 KB where practical.
- For motion work, use compressed MP4/WebM and a separate poster image. Do not autoplay audio; respect reduced-motion and Lite mode.
- Every informative image needs meaningful Spanish alt text. Decorative imagery should use empty alt text.
- Preserve original artwork and brand colors. Do not use generated substitute art for missing case assets.

## Implementation pattern

Use a semantic `<picture>` for responsive stills, or `<video controls playsinline preload="none" poster="...">` for a motion case. Keep the current project caption outside the media element. Remove the pending label only after the real asset has been added and checked on desktop and mobile.

Suggested structure:

```text
preview/
  assets/
    projects/
      jasypa-cover.webp
      illustration-selection.webp
      personal-illustration.webp
      shopping-mariano-15.webp
      player-identity.webp
      todegol-campaign.webp
      etidol-dolores-del-hincha.webp
      banco-atlas-dia-del-nino.webp
```

## QA checklist

- [ ] Real asset replaces each pending artwork panel.
- [ ] Crop and focal point checked at 1440 px, 768 px and 390 px.
- [ ] Alt text is accurate and not a duplicate of the caption.
- [ ] Images are compressed; video has a poster and controls.
- [ ] No project claims, award status or dates have been invented.
- [ ] Lite mode remains usable without heavy media.