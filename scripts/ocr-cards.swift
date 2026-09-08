import AppKit
import Foundation
import Vision

for path in CommandLine.arguments.dropFirst() {
  guard let image = NSImage(contentsOfFile: path),
        let data = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: data),
        let cgImage = bitmap.cgImage else {
    fputs("Unable to read \(path)\n", stderr)
    continue
  }

  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  let handler = VNImageRequestHandler(cgImage: cgImage)

  do {
    try handler.perform([request])
    let observations = (request.results ?? []).sorted { left, right in
      if abs(left.boundingBox.midY - right.boundingBox.midY) > 0.02 {
        return left.boundingBox.midY > right.boundingBox.midY
      }
      return left.boundingBox.minX < right.boundingBox.minX
    }
    print("=== \(URL(fileURLWithPath: path).lastPathComponent) ===")
    for observation in observations {
      guard let text = observation.topCandidates(1).first?.string else { continue }
      print(text)
    }
  } catch {
    fputs("OCR failed for \(path): \(error)\n", stderr)
  }
}
