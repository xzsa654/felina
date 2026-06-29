## Felina UI Guidelines Review

Scope: Jesse token assistant UI on `TokensPage`, including the collapsed mascot button, expanded panel, drop target, context preview, action controls, loading/error/result states, and draggable token context affordances.

- Guideline hit: `TokensPage` keeps the existing `PageHeader` / `PageBody` scaffold and renders Jesse inside the `/tokens` page only. No route, navigation item, landing page, or app-wide assistant surface was introduced.
- Guideline hit: the expanded assistant uses a compact tool-panel shape with bounded width, stable button heights, truncation for long titles/sources, and a scroll-bound result area, so dynamic context/result text does not resize the dashboard or occlude the token page content.
- Guideline hit: the control surface uses familiar UI affordances: provider select for provider choice, icon buttons for collapse/clear/action states, disabled states while no context is available, loading spinner during mutation, and inline error/result feedback.
- Guideline hit: draggable token contexts are attached to existing analytics blocks and rows without changing their card/table dimensions or introducing a new table/hard-grid presentation.
- Prohibited pattern check: no nested cards, standalone page-wide warning/info bar, marketing hero, new global overlay, or decorative gradient/orb background was added.
- Deviation accepted: Jesse uses a fixed pink chunky mascot style instead of inheriting only neutral app colors. Rationale: the product requirement makes Jesse/pinkman a Felina mascot; pink is limited to the mascot identity and active drop highlight, while the expanded panel remains on existing neutral `bg-*`, `border-*`, and text tokens.
- Deviation accepted: the assistant is fixed to the bottom-right of `TokensPage`. Rationale: Jesse is an assistant surface rather than dashboard content; keeping it fixed lets users feed multiple token contexts without losing page position, and the implementation stays scoped to `/tokens` rather than becoming a global overlay.
