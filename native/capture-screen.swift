import Foundation
import AppKit
import ScreenCaptureKit
import CoreGraphics
import Vision
import ImageIO

@main struct CaptureScreen {
    static func main() async {
        do {
            // Test and replay mode: recognise text in an image file instead of capturing a display.
            if CommandLine.arguments.count > 2, CommandLine.arguments[1] == "--file" {
                guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[2]) as CFURL, nil),
                      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw NSError(domain: "file", code: 1) }
                let (lines, words) = recognizeText(in: image)
                let result: [String: Any] = ["width": image.width, "height": image.height, "textBoxes": lines, "words": words]
                finish(try JSONSerialization.data(withJSONObject: result))
            }
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
                let (lines, words) = recognizeText(in: image)
                let result: [String: Any] = [
                    "image": "data:image/jpeg;base64," + jpeg.base64EncodedString(),
                    "width": image.width,
                    "height": image.height,
                    "textBoxes": lines,
                    "words": words,
                ]
                finish(try JSONSerialization.data(withJSONObject: result))
            } else {
                throw NSError(domain: "macOS14Required", code: 1)
            }
        } catch {
            // The first word tells the app which message to show.
            let domain = (error as NSError).domain
            let reason = domain == "permission" ? "permission" : domain == "macOS14Required" ? "macos" : "failed"
            FileHandle.standardError.write(Data("\(reason): \(error)\n".utf8))
            exit(1)
        }
    }
}

/// Write the result and quit at once. On macOS 26 ScreenCaptureKit and Vision leave work behind
/// that keeps an async main alive after it returns, so the app waited for a process that never
/// ended and reported the capture as unavailable.
func finish(_ data: Data) -> Never {
    FileHandle.standardOutput.write(data)
    try? FileHandle.standardOutput.synchronize()
    exit(0)
}

/// On-device text recognition with exact positions, so drawings land on the real words.
/// Boxes are normalized with a top-left origin. Runs locally; nothing leaves the Mac here.
func recognizeText(in image: CGImage) -> ([[String: Any]], [[String: Any]]) {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.006
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    guard (try? handler.perform([request])) != nil, let observations = request.results else {
        return ([], [])
    }
    func box(_ r: CGRect) -> [String: Double] {
        let x = max(0, min(1, Double(r.minX))), w = max(0.0005, min(1 - x, Double(r.width)))
        let top = max(0, min(1, 1 - Double(r.maxY))), h = max(0.0005, min(1 - top, Double(r.height)))
        return ["x": x, "y": top, "width": w, "height": h]
    }
    var lines: [[String: Any]] = [], words: [[String: Any]] = []
    for (index, observation) in observations.prefix(1500).enumerated() {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let text = candidate.string
        lines.append(["text": String(text.prefix(2000)), "box": box(observation.boundingBox)])
        text.enumerateSubstrings(in: text.startIndex..<text.endIndex, options: .byWords) { word, range, _, _ in
            guard let word = word, words.count < 6000,
                  let rect = try? candidate.boundingBox(for: range)?.boundingBox else { return }
            words.append(["text": String(word.prefix(200)), "box": box(rect), "line": index])
        }
    }
    return (lines, words)
}
