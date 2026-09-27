---
name: PackSmart visual direction
description: Product UI decisions for the packaging preview and navigation experience.
---

PackSmart’s packaging visualization should stay dependency-light and explainable: use an interactive CSS 3D mockup with explicit layer callouts before introducing a heavier 3D runtime.

**Why:** The product’s value is transparent packaging decision support, and the current preview needs to load reliably while making the material structure understandable.

**How to apply:** Preserve pointer rotation, automatic motion, readable layer indicators, and a clear fallback presentation when extending recommendation or material-detail views.