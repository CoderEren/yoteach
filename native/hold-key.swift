import Foundation
import CoreGraphics

// Observe only the configured key's state. No text, key log, event suppression or injection.
let binding = CommandLine.arguments.dropFirst().first ?? "control"
let codes: [String: CGKeyCode] = ["control": 59, "right-control": 62, "right-option": 61, "f8": 100]
func output(_ event: String) {
    print(event)
    fflush(stdout)
}
if !CGPreflightListenEventAccess() {
    output("permission")
    _ = CGRequestListenEventAccess()
}
var previous = false
var permitted = CGPreflightListenEventAccess()
let timer = Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { _ in
    let allowed = CGPreflightListenEventAccess()
    if allowed != permitted {
        permitted = allowed
        output(allowed ? "ready" : "permission")
    }
    guard allowed else { return }
    let down = binding == "fn"
        ? CGEventSource.flagsState(.combinedSessionState).contains(.maskSecondaryFn)
        : CGEventSource.keyState(.combinedSessionState, key: codes[binding] ?? 62)
    if down != previous {
        previous = down
        output(down ? "down" : "up")
    }
}
output(permitted ? "ready" : "permission")
RunLoop.main.run()
