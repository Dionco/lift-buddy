# All weights are kilograms

The app stores all weights in kilograms with no unit field. `SetLog.weight`, `Prescription` numbers, and any future bodyweight or PR storage are all kg. There is no user-facing unit selector and no per-record unit tag.

The app is built for a single Dutch user; kg is the regional and powerlifting standard. Storing and displaying a unit adds complexity (selector UI, conversion, plate math, formatting rules) for zero current benefit. If the app is ever published more broadly, adding a single user-preference unit setting later is cheap — the painful path is *retrofitting unit-awareness onto already-mixed historical data*, which this rule prevents.

## Consequences

- All input fields, display labels, and calculations assume kg. UI text can label fields "Weight (kg)" if helpful, but storage stays unitless.
- Imports of programs written in lb need explicit conversion at the import boundary; never store lb values.
- A future unit-preference feature is a display-layer concern only — historical data does not need migration.
