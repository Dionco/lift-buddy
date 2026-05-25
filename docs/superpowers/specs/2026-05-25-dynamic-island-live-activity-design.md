# Dynamic Island Live Activity — Design Spec

**Date:** 2026-05-25
**Status:** Approved

## Summary

Add a Dynamic Island Live Activity that mirrors the active workout Session — visible the entire time the lifter is in a session. Two phases, swapped by content:
- **Resting** — compact trailing shows an OS-driven countdown.
- **Logging** — compact trailing shows `{exerciseAbbrev} · {setIndex}/{totalSets}`.

The activity is read-only in v1: long-press reveals next-set details; tap opens the app. No in-Island buttons.

To ship this, lift-buddy is wrapped with Capacitor (a thin native shell). The Vite/React app continues unchanged as the WebView content; a small custom Capacitor plugin bridges to a SwiftUI Widget Extension built against ActivityKit.

## Scope

**In scope**
- Capacitor wrap targeting iOS 16.1+ (Dynamic Island requires iPhone 14 Pro+ which all support iOS 17+, but the activity remains usable on Lock Screen for older devices).
- Bundle ID `com.dionco.liftbuddy`; widget extension `com.dionco.liftbuddy.LiveActivity`.
- One Capacitor plugin (`LiveActivityPlugin`) with three verbs: `start`, `update`, `end`, plus `isSupported`.
- One Widget Extension target with `ActivityConfiguration` declaring lock-screen, compact, minimal, expanded.
- Move rest-timer state from `RestTimer.tsx` component-local state into the Zustand store (new `restEndsAt` slice).
- Web build (Vercel) continues to work unchanged — plugin web shim resolves to no-ops.
- Free Apple Developer Program tier ("Personal Team") provisioning; no APNs.

**Out of scope (deferred)**
- In-Island interactivity (Skip rest, +30s buttons) — v2 once we see how often users long-press.
- Logging a set from the Island — v3 if at all.
- App Store distribution — design is App-Store-compatible but submission is a later decision.
- APNs push updates — not applicable (no backend).
- Apple Watch support — separate spec if pursued.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  iOS App (com.dionco.liftbuddy)                                    │
│                                                                    │
│  ┌──────────────────────────────────┐    ┌─────────────────────┐  │
│  │  WKWebView (Capacitor)           │    │  Widget Extension   │  │
│  │  - Vite React bundle (unchanged) │    │  (.LiveActivity)    │  │
│  │  - Zustand store (localStorage)  │    │  - ActivityAttrs    │  │
│  │  - useLiveActivityBridge hook    │    │  - DynamicIsland UI │  │
│  └──────────────┬───────────────────┘    └──────────▲──────────┘  │
│                 │ bridge calls                       │             │
│                 ▼                                    │             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  LiveActivityPlugin.swift  (app target)                    │  │
│  │  - holds single Activity<LiftBuddyActivityAttributes>?     │  │
│  │  - rebinds on cold-launch via Activity.activities          │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Three targets** in `ios/App/App.xcodeproj`:

1. **App target** — Capacitor host. Adds `LiveActivityPlugin.swift`, `LiftBuddyActivityAttributes.swift`, `NSSupportsLiveActivities=YES` in Info.plist, deep-link handler in `AppDelegate.swift`.
2. **LiveActivity widget extension target** — new. SwiftUI views for compact/minimal/expanded/lock-screen.
3. **Shared file membership** — `LiftBuddyActivityAttributes.swift` belongs to both targets.

**Vite build stays the source of truth**: `bun run build` outputs to `dist/`; `bunx cap sync` copies into `ios/App/App/public/`.

**Single Activity invariant**: lift-buddy has at most one `activeSession`, so the plugin holds a single optional `Activity` reference. No collection management.

## Data Model

`LiftBuddyActivityAttributes.swift` — shared between app and widget targets:

```swift
import ActivityKit
import Foundation

struct LiftBuddyActivityAttributes: ActivityAttributes {
  // Static — fixed for the session's lifetime.
  let sessionId: String         // matches Zustand activeSession.id
  let workoutName: String       // e.g. "Day 3 — Heavy Pulls"; "Workout" if ad-hoc
  let startedAt: Date           // matches activeSession.startTime

  struct ContentState: Codable, Hashable {
    enum Phase: String, Codable { case logging, resting }
    let phase: Phase

    let exerciseAbbrev: String  // 1–4 chars; computed on JS side
    let exerciseName: String    // full name for expanded view
    let setIndex: Int           // 1-based
    let totalSets: Int

    // Prescription for the *next* set the lifter will perform
    let prescribedWeight: Double?   // kg
    let prescribedReps: Int?
    let rpeTarget: Double?          // 6.0–10.0

    // Only meaningful when phase == .resting
    let restEndsAt: Date?
  }
}
```

TypeScript twin in `src/lib/liveActivity.ts`:

```ts
export type LiveActivityPhase = 'logging' | 'resting';

export interface LiveActivityContentState {
  phase: LiveActivityPhase;
  exerciseAbbrev: string;
  exerciseName: string;
  setIndex: number;
  totalSets: number;
  prescribedWeight: number | null;
  prescribedReps: number | null;
  rpeTarget: number | null;
  restEndsAt: number | null;  // unix ms; bridge converts to Date
}

export interface LiveActivityAttributes {
  sessionId: string;
  workoutName: string;
  startedAt: number;          // unix ms
}
```

**Size budget**: Apple caps attributes + ContentState at 4 KB. This schema is ~150 bytes. No risk.

**Design rationale**:
- `exerciseAbbrev` and `exerciseName` ship separately — compact view doesn't truncate at render time.
- `restEndsAt` is an absolute `Date`, not a remaining duration → widget uses `Text(timerInterval:)`, no per-second updates needed.
- `phase` is explicit, not derived. Future-proofs against a `paused` phase.
- ContentState is a *snapshot for the current set*, never a mirror of the whole session — keeps payload tiny.

## State Machine

```
Zustand mutation                    →  Plugin call         →  ActivityKit
─────────────────────────────────────────────────────────────────────────────
startSession()                      →  start(attrs, state) →  Activity.request
updateSet({completed: true})        →  update(state)       →  activity.update
  (last set in exercise; phase=resting,
   restEndsAt: now + restTimerDuration)
[lifter starts next exercise]       →  update(state)       →  activity.update
  (phase=logging, new exerciseAbbrev)
[rest timer hits 0 in JS]           →  update(state)       →  activity.update
  (phase=logging, restEndsAt: null)
finishSession() / cancelSession()   →  end(.immediate)     →  activity.end
```

**Single subscriber** in `src/lib/useLiveActivityBridge.ts`:

```ts
useEffect(() => {
  let last: LiveActivityContentState | null = null;
  return useTrainingStore.subscribe((state) => {
    const next = computeActivityState(state);
    if (next === null && last !== null) plugin.end({ dismissalPolicy: 'immediate' });
    else if (next !== null && last === null) plugin.start({ attributes: ..., state: next });
    else if (next !== null && !shallowEqual(next, last)) debounced.update({ state: next });
    last = next;
  });
}, []);
```

`computeActivityState(state)` is a pure function — the **only** place that translates store → activity state. Lift-buddy domain logic stays on the JS side; the plugin is dumb transport.

**Phase derivation**: `phase: 'resting'` iff `state.restEndsAt !== null`, else `'logging'`. The store transitions explicitly via `startRest()` / `endRest()`; `computeActivityState` does not call `Date.now()` (preserves the purity invariant in §Error Handling).

If rest expires while the app is suspended, the store can't know — `restEndsAt` stays non-null and JS-derived `phase` stays `'resting'`. The widget's `TimelineView` (§SwiftUI Layouts) swaps to the logging layout visually at the expiry instant regardless. When the app wakes, a JS interval comparing `Date.now()` to `restEndsAt` calls `endRest()`, which transitions the store and triggers a corrective bridge update — the widget visual is already correct; the store/bridge are now consistent with it.

**Store change required**: `restEndsAt: number | null` added to `useTrainingStore`, plus `startRest(durationSeconds)` and `endRest()` actions. `RestTimer.tsx` becomes a derived view of this field rather than self-managing local state. This is the spec's biggest non-iOS change; one ADR captures it (see Open Decisions).

**Recovery on cold start**:
```swift
// LiveActivityPlugin.load()
if let existing = Activity<LiftBuddyActivityAttributes>.activities.first {
  self.currentActivity = existing
}
```
JS-side: on `useLiveActivityBridge` mount, emit one synthetic event for current store state. Plugin either rebinds (no-op) or repairs via `update`/`start`.

**Hard limits we surrender to**:
- 8h max lifetime (Apple). A powerlifting session is 60–120 min; this is dead code. If exceeded, iOS ends the activity → next `update` fails → next subscriber tick `start`s a fresh one.
- App fully killed: no APNs on free tier → activity goes stale until app reopens. Acceptable.

## Bridge Surface

```ts
// src/lib/liveActivity.ts
import { registerPlugin } from '@capacitor/core';

export interface LiveActivityPlugin {
  start(options: { attributes: LiveActivityAttributes; state: LiveActivityContentState }):
    Promise<{ activityId: string }>;
  update(options: { state: LiveActivityContentState }): Promise<void>;
  end(options: { finalState?: LiveActivityContentState; dismissalPolicy?: 'immediate' | 'default' }):
    Promise<void>;
  isSupported(): Promise<{ supported: boolean; enabled: boolean }>;
}

export const LiveActivity = registerPlugin<LiveActivityPlugin>('LiveActivity', {
  web: () => import('./liveActivity.web').then(m => new m.LiveActivityWeb()),
});
```

**Web shim** (`src/lib/liveActivity.web.ts`) — all methods are no-ops; `isSupported` returns `{supported: false, enabled: false}`. The web build (Vercel) keeps working.

**Swift side** (`ios/App/App/LiveActivityPlugin.swift`):

```swift
import Capacitor
import ActivityKit

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin {
  private var currentActivity: Activity<LiftBuddyActivityAttributes>?

  override public func load() {
    if let existing = Activity<LiftBuddyActivityAttributes>.activities.first {
      currentActivity = existing
    }
  }

  @objc func start(_ call: CAPPluginCall) { /* parse JSON → Activity.request */ }
  @objc func update(_ call: CAPPluginCall) { /* await currentActivity?.update(...) */ }
  @objc func end(_ call: CAPPluginCall)    { /* await currentActivity?.end(...) */ }
  @objc func isSupported(_ call: CAPPluginCall) {
    let info = ActivityAuthorizationInfo()
    call.resolve([
      "supported": ProcessInfo.processInfo.isiOSAppOnMac == false,
      "enabled": info.areActivitiesEnabled
    ])
  }
}
```

Registered via `LiveActivityPlugin.m` (Objective-C macro shim — required even for pure-Swift Capacitor plugins).

**Direction**: one-way only (JS → Swift). No native-initiated events back. The widget's render-time `Date()` handles rest-expiry-without-update; no callback path needed. Cuts a class of bridge bug.

**Throttling**: `update()` calls wrapped in a 250ms trailing debounce on the React side. Multiple store mutations in rapid succession (set added, weight set, reps set, completed flag) coalesce into one ActivityKit update.

**Failure modes handled in the plugin**:
- `ActivityAuthorizationError.unentitled` → `isSupported` returns `enabled: false`; JS stops.
- `currentActivity?.activityState == .dismissed` → drop the reference; next subscriber tick treats it as `start`.
- `start` called with one already alive → end the old (`.immediate`) before requesting the new.

## SwiftUI Layouts

`LiftBuddyLiveActivityWidget.swift` (widget extension):

```swift
struct LiftBuddyLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiftBuddyActivityAttributes.self) { ctx in
      LockScreenView(state: ctx.state, attrs: ctx.attributes)
    } dynamicIsland: { ctx in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading)  { ExpandedLeading(state: ctx.state, attrs: ctx.attributes) }
        DynamicIslandExpandedRegion(.trailing) { ExpandedTrailing(state: ctx.state, attrs: ctx.attributes) }
        DynamicIslandExpandedRegion(.center)   { EmptyView() }
        DynamicIslandExpandedRegion(.bottom)   { ExpandedBottom(state: ctx.state, attrs: ctx.attributes) }
      } compactLeading: {
        Image(systemName: "figure.strengthtraining.traditional")
      } compactTrailing: {
        CompactTrailing(state: ctx.state)
      } minimal: {
        Image(systemName: "figure.strengthtraining.traditional")
      }
      .widgetURL(URL(string: "liftbuddy://session"))
    }
  }
}
```

**Rendering rules**:

| Region | phase: resting | phase: logging |
|---|---|---|
| compactLeading | barbell SF Symbol | same |
| compactTrailing | `Text(timerInterval: now...restEndsAt, countsDown: true)` | `Text("\(abbrev) · \(setIndex)/\(totalSets)")` |
| minimal | barbell SF Symbol | same |
| expanded leading | `🏋 \(workoutName)` | same |
| expanded trailing | "REST" pill | elapsed clock from `startedAt` |
| expanded bottom | Big countdown + "Next: \(name) · \(setIndex)/\(totalSets) · \(weight)kg × \(reps) @ RPE \(rpe)" | "\(name) · Set \(setIndex)/\(totalSets)" + target line |
| lock-screen | Card layout, same content as expanded | same |

**Phase swap at expiry without an update** — wrap phase-dependent regions in `TimelineView`:

```swift
TimelineView(.explicit([state.restEndsAt ?? .distantFuture])) { ctx in
  let isResting = state.phase == .resting
    && (state.restEndsAt.map { ctx.date < $0 } ?? false)
  if isResting { RestingLayout(...) } else { LoggingLayout(...) }
}
```

Widget renders the correct phase even if JS never wakes to push the cleanup update.

**Compact trailing width**: ~50pt at default Dynamic Resolution. Cap `exerciseAbbrev` to 4 characters on the JS side (the narrow middle dot in `"Sq · 3/5"` buys headroom; `"Curl · 3/5"` at 10 chars still fits without clipping on iPhone 14 Pro). Mapping table lives in `src/lib/exerciseAbbrev.ts` (Squat → "Sq", Bench Press → "BP", Deadlift → "DL", Overhead Press → "OHP", Row → "Row", Pull-up → "Pull", Curl → "Curl", Tricep Ext. → "Tri", etc.; ad-hoc / unknown → first 4 letters of `exercise.name`).

**Deep link**: `liftbuddy://session` → app opens to `ActiveWorkout` screen. Handler in `AppDelegate.swift` posts to Capacitor; React side subscribes and sets `screen = 'workout'` in `Index.tsx`.

**Color theme**: widget is always dark (Island is hardware black). Uses `.foregroundStyle(.white)`, accent `.blue` for resting, neutral white for logging. Separate from web app design tokens; the existing light-mode-only constraint in CLAUDE.md does not apply here.

## Error Handling

| Failure | Detected | Behavior |
|---|---|---|
| Running on web | `isSupported() → {supported: false}` | Bridge no-op. Subscriber runs, calls succeed silently. |
| iPhone without Dynamic Island (12, 13, SE) | hardware feature absent | Activity still shows on Lock Screen / Notification Center. No code change. |
| Live Activities disabled in Settings | `areActivitiesEnabled == false` | `start` resolves with `{activityId: 'disabled'}`. Don't prompt. |
| `start` while previous active | `currentActivity != nil` | End old (`.immediate`) before requesting new. |
| `update` on dismissed | `activityState == .dismissed` | Drop stale reference; next subscriber tick → `start`. |
| 8h cap exceeded | iOS sets `activityState = .ended` | Same as dismissed. Realistically unreachable. |
| App killed, relaunched mid-session | `load()` finds existing `Activity` | Rebind. Subscriber emits synthetic event → one corrective `update`. |
| Rest expires while app suspended | No detection needed | `TimelineView` swaps phase via render-time `Date()`. JS pushes cleanup `update` when next active. |
| JSON encoding mismatch | Swift `JSONDecoder` throws | `call.reject("invalid state")`; JS subscriber logs once, continues. |
| First permission prompt | iOS shows on first `Activity.request` | iOS owns the UX. Don't pre-prompt. |

**Deliberately not handled**:
- No retry queue. State is idempotent; next mutation pushes the truth.
- No remote push fallback. Free tier + no backend.
- No "stale" indicator. If JS sends nothing for 10 min, the lifter is presumably still in that set — last known state is correct.

**The one invariant**: `computeActivityState(state)` is pure. No side effects, no `Date.now()`, no `localStorage` reads beyond the input. The widget reads `Date()` itself; the bridge stays deterministic.

## Testing

**Automated (Vitest)**:
- `computeActivityState` snapshot tests: null session, logging mid-set, resting mid-set, last set of last exercise, ad-hoc workout (no prescription), exercise without `loadPercentage` (`prescribedWeight: null`), abbreviation cap.
- `useLiveActivityBridge`: mock the `LiveActivity` plugin; drive store through transitions; assert call sequence.
- 250ms debounce: `vi.useFakeTimers()`, 4 mutations in 10ms, advance 250ms, assert one `update` with last state.
- Web shim: no throws under jsdom.
- Recovery synthesis: mount with `activeSession` already present → exactly one `update` (not `start`).

**Swift XCTest (small)**:
- `LiveActivityPluginTests.swift` — `start` → `currentActivity != nil`, `end` → nil, repeated `start` ends previous. Uses real ActivityKit types; runs in Simulator.

**Manual device checklist** (no automation):
- Each phase reads correctly on iPhone 14 Pro+ physical device.
- Phase swap at `restEndsAt` while app suspended.
- Activity persists across backgrounding 10+ min.
- Cold-launch recovery — no duplicate Activity.
- Lock-screen banner layout.
- Free-tier 7-day provisioning expiry — documented reinstall ritual.
- Web build regression — `bun run dev` and Vercel preview unchanged.

**Xcode Previews** carry layout iteration cost (one per presentation × representative ContentState).

**No E2E.** Playwright doesn't reach the Island.

## Files Changed / Added

| File | Change |
|---|---|
| `package.json` | Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` |
| `capacitor.config.ts` | New — `appId: com.dionco.liftbuddy`, `webDir: dist` |
| `.gitignore` | Add `ios/App/App/public/` (sync artifact) and `ios/DerivedData/` |
| `src/lib/liveActivity.ts` | New — plugin TS interface, types |
| `src/lib/liveActivity.web.ts` | New — web shim (no-ops) |
| `src/lib/computeActivityState.ts` | New — pure store → ContentState selector |
| `src/lib/exerciseAbbrev.ts` | New — name → 1–3 char abbreviation table |
| `src/lib/useLiveActivityBridge.ts` | New — store-subscriber hook with debounced update |
| `src/store/useTrainingStore.ts` | Add `restEndsAt`, `startRest`, `endRest` (+ migration v8) |
| `src/components/RestTimer.tsx` | Read `restEndsAt` from store; remove local interval state |
| `src/components/ActiveWorkout.tsx` | Call `startRest(restTimerDuration)` instead of mounting `RestTimer` with local state |
| `src/pages/Index.tsx` | Subscribe to deep-link event; route to `workout` screen |
| `src/main.tsx` | Mount `useLiveActivityBridge` at root |
| `src/test/computeActivityState.test.ts` | New |
| `src/test/useLiveActivityBridge.test.ts` | New |
| `ios/` | New directory tree from `cap add ios` |
| `ios/App/App/Info.plist` | `NSSupportsLiveActivities=YES`, URL scheme `liftbuddy` |
| `ios/App/App/AppDelegate.swift` | Deep-link handler |
| `ios/App/App/LiveActivityPlugin.swift` | New |
| `ios/App/App/LiveActivityPlugin.m` | New (Obj-C registration shim) |
| `ios/App/App/LiftBuddyActivityAttributes.swift` | New (shared with widget) |
| `ios/App/LiveActivity/LiftBuddyLiveActivityWidget.swift` | New (widget body) |
| `ios/App/LiveActivity/Views/*.swift` | New (compact/minimal/expanded/lock views) |
| `ios/App/LiveActivity/Info.plist` | Widget extension Info.plist |
| `ios/App/LiveActivityTests/LiveActivityPluginTests.swift` | New |
| `docs/adr/NNNN-rest-timer-in-store.md` | New ADR for moving rest timer state into the store |
| `CLAUDE.md` | Add iOS/Capacitor commands; document widget target |
| `CONTEXT.md` | Note Live Activity domain terms (Live Activity, Activity Phase) |

## Open Decisions

- **ADR number** for rest-timer-in-store — assign during plan writing by checking `docs/adr/`.
- **Persisted store version bump** — `useTrainingStore` is currently at version 7. Adding `restEndsAt` is a v8 migration: existing persisted stores default `restEndsAt: null`. Trivial.
- **Exercise abbreviation table** — initial mapping covers Main Lifts + common Variations (Sq, BP, DL, OHP, Row, Pull, Curl, Tri, etc.); the fallback is the first 3 letters of `exercise.name`. The mapping can be tuned without a migration.
- **Deep-link tap behavior when no active session** — if the user taps the Island after `cancelSession` raced with a stale widget, `liftbuddy://session` opens to the app's default tab. The deep-link handler checks `activeSession` and routes accordingly.

## Implementation Order (high-level)

1. Capacitor wrap + verify `bun run build` → `bunx cap sync` → app loads in Simulator showing the existing web UI.
2. Move rest timer into store with migration; refactor `RestTimer.tsx`; tests pass.
3. JS plugin interface + web shim + `computeActivityState` + tests.
4. Swift plugin + Obj-C shim + `LiftBuddyActivityAttributes` + Info.plist entitlement + `isSupported` round-trip works.
5. Widget extension target with placeholder text views — verify Activity renders on Simulator.
6. SwiftUI layouts (compact → expanded → lock-screen → minimal); iterate with Xcode Previews.
7. `useLiveActivityBridge` mounted; deep link; manual device test pass.
8. Documentation: CLAUDE.md update, ADR, CONTEXT.md additions.

The writing-plans skill will turn this into a concrete step-by-step plan with file-level breakdown.
