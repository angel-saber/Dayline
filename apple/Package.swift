// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DaylineCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "DaylineCore", targets: ["DaylineCore"])],
    targets: [
        .target(name: "DaylineCore"),
        .testTarget(name: "DaylineCoreTests", dependencies: ["DaylineCore"])
    ]
)
