# wc-sim

Single-file World Cup 2026 R32 match simulator with live ESPN feed.

Live: https://scb3155.github.io/wc-sim/

## Model
Bivariate Poisson on 10x10 score grid.
- Style-shaped possession exponents (possession vs counter)
- Knockout pressure dampener
- Comeback boost (+10% xG to trailing team >=20 min remaining)
- Player anytime goal via SoT * 0.36 conversion

## Live feed
ESPN scoreboard JSON: site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
CORS *, no key required.
