import SwiftUI
import SceneKit
import simd
import CoreText

struct SceneKitTileView: UIViewRepresentable {
    let tileImage: UIImage?
    let memoryText: String
    let dateText: String
    let tileName: String
    /// Bumped by the viewer on double-tap / tile switch to recenter the tile.
    var resetToken: Int = 0

    func makeCoordinator() -> Coordinator { Coordinator() }

    /// Quaternion-based animation engine ported from the web viewer: a per-frame loop
    /// (drop/scale/flip entry → continuous gentle auto-spin + wobble + float, with
    /// inertia after a flick and a smooth slerp back to rest on reset). Driving it off
    /// quaternions instead of Euler angles gives the natural, gimbal-free tumble.
    final class Coordinator: NSObject {
        weak var tileNode: SCNNode?
        private var link: CADisplayLink?

        private var time: Double = 0
        private var orientation = simd_quatf(angle: 0, axis: SIMD3<Float>(0, 1, 0))
        private let restOrientation = simd_quatf(angle: 0, axis: SIMD3<Float>(0, 1, 0))

        private var isDragging = false
        private var velX: Float = 0   // last per-frame drag delta (radians) → inertia
        private var velY: Float = 0
        private var prevX: Float = 0
        private var prevY: Float = 0

        private var slerpFrom = simd_quatf(angle: 0, axis: SIMD3<Float>(0, 1, 0))
        private var slerpProgress: Float = 1

        var lastResetToken = 0

        private func quat(_ angle: Double, _ axis: SIMD3<Float>) -> simd_quatf {
            simd_quatf(angle: Float(angle), axis: axis)
        }

        func start() {
            guard link == nil else { return }
            let l = CADisplayLink(target: self, selector: #selector(step(_:)))
            l.add(to: .main, forMode: .common)
            link = l
        }

        func stop() {
            link?.invalidate()
            link = nil
        }

        deinit { stop() }

        func reset() {
            slerpFrom = orientation
            slerpProgress = 0
            velX = 0; velY = 0
        }

        @objc func handlePan(_ g: UIPanGestureRecognizer) {
            guard let view = g.view else { return }
            let loc = g.translation(in: view)
            switch g.state {
            case .began:
                isDragging = true
                velX = 0; velY = 0
                prevX = 0; prevY = 0
                slerpProgress = 1
            case .changed:
                let dx = (Float(loc.x) - prevX) * 0.01
                let dy = (Float(loc.y) - prevY) * 0.01
                prevX = Float(loc.x); prevY = Float(loc.y)
                velX = dx; velY = dy
                orientation = quat(Double(dy), SIMD3<Float>(1, 0, 0))
                    * quat(Double(dx), SIMD3<Float>(0, 1, 0)) * orientation
            case .ended, .cancelled:
                isDragging = false
            default:
                break
            }
        }

        @objc private func step(_ link: CADisplayLink) {
            guard let tileNode else { return }
            let dt = link.duration > 0 ? link.duration : 1.0 / 60.0
            time += dt
            let t = time

            // Entry: glide in from the top of the screen (up-and-back in this tilted
            // top-down view), scale up, single transient flip — all eased, a touch slow.
            let dropEase = 1 - pow(1 - min(t / 1.8, 1), 3)
            let entryAmount = Float(1 - dropEase)
            let entryStart = SIMD3<Float>(0, 4, -8)
            let scale = Float(1 - pow(1 - min(t / 0.7, 1), 2))
            let flipP = min(t / 2.2, 1)
            let flipEase = 1 - pow(1 - flipP, 3)
            let flipAngle = flipEase * Double.pi * 2

            // Auto-spin starts brisk after the drop and decelerates to a gentle drift.
            let zSpeed = t < 3 ? 0.04 + 0.5 * pow(1 - t / 3, 2) : 0.04

            if slerpProgress < 1 {
                slerpProgress = min(1, slerpProgress + Float(dt) / 0.4)
                let e = 1 - pow(1 - slerpProgress, 3)
                orientation = simd_slerp(slerpFrom, restOrientation, e)
            } else if !isDragging {
                if abs(velX) > 0.0001 || abs(velY) > 0.0001 {
                    orientation = quat(Double(velY), SIMD3<Float>(1, 0, 0))
                        * quat(Double(velX), SIMD3<Float>(0, 1, 0)) * orientation
                    velX *= 0.95
                    velY *= 0.95
                }
                let autoQ = quat(zSpeed * dt, SIMD3<Float>(0, 1, 0))
                let wob1 = quat(sin(t * 0.4) * 0.0008, SIMD3<Float>(1, 0, 0))
                let wob2 = quat(cos(t * 0.3) * 0.0006, SIMD3<Float>(0, 0, 1))
                orientation = wob2 * wob1 * autoQ * orientation
            }

            let floatY = Float(sin(t * 0.8)) * 0.06

            var finalQ = orientation
            if flipP < 1 {
                finalQ = quat(flipAngle, SIMD3<Float>(0, 0, 1)) * orientation
            }
            tileNode.simdOrientation = finalQ
            tileNode.simdPosition = entryStart * entryAmount + SIMD3<Float>(0, floatY, 0)
            tileNode.simdScale = SIMD3<Float>(repeating: max(scale, 0.0001))
        }
    }

    private func applyCamera(_ cameraNode: SCNNode) {
        // Framing dialled in on device: centered, raised for a near-frontal read.
        cameraNode.position = SCNVector3(0, 8.8, 3.3)
        cameraNode.camera?.fieldOfView = 37
        cameraNode.look(at: SCNVector3(0, 0, 0))
    }

    func makeUIView(context: Context) -> SCNView {
        let scnView = SCNView()
        scnView.backgroundColor = UIColor(red: 245/255, green: 242/255, blue: 237/255, alpha: 1)
        scnView.antialiasingMode = .multisampling4X
        scnView.allowsCameraControl = false
        scnView.autoenablesDefaultLighting = false

        let scene = SCNScene()
        scnView.scene = scene

        // Camera (fixed framing; tunable live via the debug panel).
        let cameraNode = SCNNode()
        cameraNode.name = "camera"
        cameraNode.camera = SCNCamera()
        cameraNode.camera?.projectionDirection = .vertical
        applyCamera(cameraNode)
        scnView.pointOfView = cameraNode
        scene.rootNode.addChildNode(cameraNode)

        // Lights — key + fill + bottom fill (so the back face reads when flipped).
        let ambientLight = SCNNode()
        ambientLight.light = SCNLight()
        ambientLight.light?.type = .ambient
        ambientLight.light?.intensity = 600
        ambientLight.light?.color = UIColor.white
        scene.rootNode.addChildNode(ambientLight)

        let directional1 = SCNNode()
        directional1.light = SCNLight()
        directional1.light?.type = .directional
        directional1.light?.intensity = 1200
        directional1.position = SCNVector3(2, 6, 10)
        directional1.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(directional1)

        let directional2 = SCNNode()
        directional2.light = SCNLight()
        directional2.light?.type = .directional
        directional2.light?.intensity = 400
        directional2.position = SCNVector3(-4, 3, 5)
        directional2.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(directional2)

        let directional3 = SCNNode()
        directional3.light = SCNLight()
        directional3.light?.type = .directional
        directional3.light?.intensity = 700
        directional3.position = SCNVector3(0, -6, 8)
        directional3.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(directional3)

        // Tile
        let tileNode = createTileNode(context: context)
        tileNode.name = "tile"
        scene.rootNode.addChildNode(tileNode)
        context.coordinator.tileNode = tileNode
        context.coordinator.start()

        let pan = UIPanGestureRecognizer(target: context.coordinator,
                                         action: #selector(Coordinator.handlePan(_:)))
        scnView.addGestureRecognizer(pan)

        // Shadow plane
        let shadowPlane = SCNPlane(width: 8, height: 8)
        let shadowMat = SCNMaterial()
        shadowMat.diffuse.contents = UIColor.clear
        shadowMat.lightingModel = .shadowOnly
        shadowPlane.materials = [shadowMat]
        let shadowNode = SCNNode(geometry: shadowPlane)
        shadowNode.eulerAngles.x = -.pi / 2
        shadowNode.position = SCNVector3(0, -3, 0)
        scene.rootNode.addChildNode(shadowNode)

        return scnView
    }

    func updateUIView(_ scnView: SCNView, context: Context) {
        guard let tileNode = scnView.scene?.rootNode.childNode(withName: "tile", recursively: false) else { return }

        // Smooth slerp back to rest on double-tap / tile switch.
        if context.coordinator.lastResetToken != resetToken {
            context.coordinator.lastResetToken = resetToken
            context.coordinator.reset()
        }

        // Update top (index 4) + back (index 5) textures on the box.
        if let body = tileNode.childNode(withName: "tileBody", recursively: true),
           let mats = body.geometry?.materials, mats.count >= 6 {
            mats[4].diffuse.contents = tileImage ?? gradientImage()
            mats[5].diffuse.contents = createMemoryTexture()
        }
    }

    // MARK: - Create Tile Geometry

    private func createTileNode(context: Context) -> SCNNode {
        let containerNode = SCNNode()

        let width: CGFloat = 2.4
        let height: CGFloat = 0.16
        // Chamfer rounds ALL edges (the tile's rounded bevel). One textured box instead
        // of overlay planes, which met at sharp 90° edges.
        let cornerRadius: CGFloat = 0.075

        let box = SCNBox(width: width, height: height, length: width, chamferRadius: cornerRadius)

        func sideMat(_ name: String) -> SCNMaterial {
            let m = SCNMaterial()
            m.diffuse.contents = UIImage(named: name)
            // Tint the edges darker so the thickness reads against the cream background.
            m.multiply.contents = UIColor(white: 0.87, alpha: 1)
            m.lightingModel = .constant
            return m
        }
        let topMat = SCNMaterial()
        topMat.diffuse.contents = tileImage ?? gradientImage()
        topMat.lightingModel = .constant
        let backMat = SCNMaterial()
        backMat.diffuse.contents = createMemoryTexture()
        backMat.lightingModel = .constant

        // SCNBox material order: front(+Z), right(+X), back(-Z), left(-X), top(+Y), bottom(-Y).
        // All unlit (.constant) to match the web's meshBasicMaterial.
        box.materials = [sideMat("side1"), sideMat("side3"), sideMat("side2"), sideMat("side4"), topMat, backMat]

        let bodyNode = SCNNode(geometry: box)
        bodyNode.name = "tileBody"
        containerNode.addChildNode(bodyNode)

        return containerNode
    }

    // MARK: - Memory Texture

    /// Register the bundled Caveat font once (the Info.plist is generated, so we can't
    /// declare UIAppFonts — register at runtime instead). Matches the web's handwriting.
    private static let registerCaveat: Void = {
        if let url = Bundle.main.url(forResource: "Caveat", withExtension: "ttf") {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }()

    private func handwritingFont(_ size: CGFloat) -> UIFont {
        _ = Self.registerCaveat
        for name in ["Caveat-Regular", "Caveat", "CaveatRoman-Regular"] {
            if let f = UIFont(name: name, size: size) { return f }
        }
        return UIFont(name: "Snell Roundhand", size: size) ?? .systemFont(ofSize: size, weight: .light)
    }

    private func createMemoryTexture() -> UIImage {
        let size = CGSize(width: 1024, height: 1024)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { ctx in
            // Mirror horizontally so the text reads correctly once the tile is flipped
            // to show the back (the back face shows the texture mirrored).
            ctx.cgContext.translateBy(x: size.width, y: 0)
            ctx.cgContext.scaleBy(x: -1, y: 1)

            // Background — whitish ceramic texture (already light + grainy, matches the
            // sides). Beige fallback if the asset is missing.
            let rect = CGRect(origin: .zero, size: size)
            if let bg = UIImage(named: "square") {
                bg.draw(in: rect)
            } else {
                UIColor(red: 237/255, green: 233/255, blue: 226/255, alpha: 1).setFill()
                ctx.fill(rect)
            }

            if !memoryText.isEmpty {
                let font = handwritingFont(96)
                let paragraphStyle = NSMutableParagraphStyle()
                paragraphStyle.alignment = .center
                paragraphStyle.lineSpacing = 8

                let attrs: [NSAttributedString.Key: Any] = [
                    .font: font,
                    .foregroundColor: UIColor(red: 90/255, green: 82/255, blue: 72/255, alpha: 1),
                    .paragraphStyle: paragraphStyle,
                ]

                let textRect = CGRect(x: 100, y: 350, width: 824, height: 400)
                (memoryText as NSString).draw(in: textRect, withAttributes: attrs)
            }

            if !dateText.isEmpty {
                let dateFont = handwritingFont(46)
                let dateAttrs: [NSAttributedString.Key: Any] = [
                    .font: dateFont,
                    .foregroundColor: UIColor(red: 138/255, green: 130/255, blue: 120/255, alpha: 1),
                ]
                let dateStr = dateText as NSString
                let dateSize = dateStr.size(withAttributes: dateAttrs)
                dateStr.draw(at: CGPoint(x: 920 - dateSize.width, y: 920), withAttributes: dateAttrs)
            }
        }
    }

    private func gradientImage() -> UIImage {
        let size = CGSize(width: 512, height: 512)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let context = ctx.cgContext
            let colors = [
                UIColor(red: 74/255, green: 111/255, blue: 165/255, alpha: 0.6).cgColor,
                UIColor(red: 232/255, green: 220/255, blue: 200/255, alpha: 1).cgColor,
            ]
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors as CFArray, locations: [0, 1]) {
                context.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: size.width, y: size.height), options: [])
            }
        }
    }
}
