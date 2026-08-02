# Changelog

## 0.1.0 — 2026-07-31

### Final hardening

- Made device disconnect delete local Keychain credentials even when remote revoke fails.
- Required explicit user confirmation for externally opened custom pairing URLs.
- Added paginated delta sync, camera permission handling, and deterministic Speech audio-session cleanup.
- Marked Widget task titles and operational counts as privacy-sensitive.
- Kept silent-push background mode disabled until `content-available` processing exists.


### Native companion

- Added SwiftUI Today, Review, Activity, Capture, and Settings experiences.
- Added one-time QR pairing with capability/version preflight.
- Added Keychain session storage and rotating refresh-token support.
- Added typed mobile API client with one automatic refresh-and-retry path.
- Added process-safe, per-capture App Group offline queue shared by the app, Share Extension, and App Intents.
- Added Share Extension text/URL intake, explicit clipboard paste, and Apple Speech capture.
- Added plan item edit, approve, reject, and execute flows with optimistic revision handling.
- Added APNs registration, notification routing, foreground sync, and background refresh.
- Added Today widget, Siri/Shortcuts App Intents, and Face ID/device-authentication lock.
- Added minimum app-version enforcement and remote cleartext HTTP rejection.
- Added deterministic Xcode project generation, OpenAPI contract checks, privacy manifest, CI, and release scripts.

### Verification

- 30 XCTest cases pass for the cross-platform ActionHubCore package.
- 1 Swift Testing package smoke test passes.
- 42 Swift source files parse with Swift 6.2.1 on Linux.
- The Swift smoke client completes a live end-to-end flow against Server v0.8.0.
- Xcode signing, simulator/device build, APNs live delivery, and TestFlight remain macOS/Apple operational acceptance items.
