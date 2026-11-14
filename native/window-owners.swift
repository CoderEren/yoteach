import Foundation
import CoreGraphics
// Metadata only. Never request window images, pixels, titles, or application content.
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
let owners = windows.compactMap { window -> [String: Any]? in
    guard let id = window[kCGWindowNumber as String] as? Int,
          let owner = window[kCGWindowOwnerName as String] as? String else { return nil }
    return ["id": id, "owner": owner]
}
let data = try JSONSerialization.data(withJSONObject: owners)
FileHandle.standardOutput.write(data)
