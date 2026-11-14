import Foundation
import AppKit
import ScreenCaptureKit
import CoreGraphics

@main struct CaptureScreen {
    static func main() async {
        do {
            guard let argument = CommandLine.arguments.dropFirst().first, let id = UInt32(argument) else {
                throw NSError(domain: "capture", code: 1)
            }
            guard CGPreflightScreenCaptureAccess() || CGRequestScreenCaptureAccess() else {
                throw NSError(domain: "permission", code: 1)
            }
            if #available(macOS 14.0, *) {
                let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
                guard let display = content.displays.first(where: { $0.displayID == id }) else {
                    throw NSError(domain: "display", code: 1)
                }
                let ownApps = content.applications.filter { $0.processID == getppid() }
                let filter = SCContentFilter(display: display, excludingApplications: ownApps, exceptingWindows: [])
                let config = SCStreamConfiguration()
                let scale = min(1.0, 1600.0 / Double(max(display.width, display.height)))
                config.width = Int(Double(display.width) * scale)
                config.height = Int(Double(display.height) * scale)
                config.showsCursor = false
                let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
                let bitmap = NSBitmapImageRep(cgImage: image)
                guard let jpeg = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.85]) else {
                    throw NSError(domain: "image", code: 1)
                }
                let result: [String: Any] = ["image": "data:image/jpeg;base64," + jpeg.base64EncodedString(), "width": image.width, "height": image.height]
                FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: result))
            } else {
                throw NSError(domain: "macOS14Required", code: 1)
            }
        } catch {
            FileHandle.standardError.write(Data("Screen capture unavailable. Enable Screen Recording for Yoteach in System Settings, then restart. macOS 14 or later is required.\n".utf8))
            exit(1)
        }
    }
}
