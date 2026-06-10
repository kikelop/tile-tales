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

    // Live-tunable params (driven by the calibration panel; baked-in values are
    // the current defaults). camX/Y/Z = camera position, fov = field of view,
    // dragSensitivity = radians per drag point, inertiaDecay = flick spin-down.
    var camX: Float = 0
    var camY: Float = 0
    var camZ: Float = 9
    var fov: Float = 37
    var dragSensitivity: Float = 0.012
    var inertiaDecay: Float = 0.95

    func makeCoordinator() -> Coordinator { Coordinator() }

    /// Quaternion-based animation engine ported from the web viewer: a per-frame loop
    /// (drop/scale/flip entry → continuous gentle auto-spin + wobble + float, with
    /// inertia after a flick and a smooth slerp back to rest on reset). Driving it off
    /// quaternions instead of Euler angles gives the natural, gimbal-free tumble.
    final class Coordinator: NSObject {
        weak var tileNode: SCNNode?
        weak var cameraNode: SCNNode?
        private var link: CADisplayLink?

        // Pinch-to-zoom: move the camera along its current view direction.
        var camDir = simd_normalize(SIMD3<Float>(0, 0, 9))
        var camDistance: Float = 9
        // Live-tunable from the calibration panel.
        var dragSensitivity: Float = 0.012
        var inertiaDecay: Float = 0.95

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
                let dx = (Float(loc.x) - prevX) * dragSensitivity
                let dy = (Float(loc.y) - prevY) * dragSensitivity
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

        @objc func handlePinch(_ g: UIPinchGestureRecognizer) {
            guard let cam = cameraNode else { return }
            switch g.state {
            case .changed:
                let d = max(5.0, min(16.0, camDistance / Float(g.scale)))
                cam.simdPosition = camDir * d
                cam.look(at: SCNVector3(0, 0, 0))
            case .ended, .cancelled:
                camDistance = simd_length(cam.simdPosition)
            default:
                break
            }
        }

        @objc private func step(_ link: CADisplayLink) {
            guard let tileNode else { return }
            let dt = link.duration > 0 ? link.duration : 1.0 / 60.0
            time += dt
            let t = time

            // Entry: drop straight down from above (Y+ → center) with a flip on Y —
            // no Z approach, so it reads as a fall, not a zoom toward the camera.
            let dropEase = 1 - pow(1 - min(t / 1.8, 1), 3)
            let entryAmount = Float(1 - dropEase)
            let entryStart = SIMD3<Float>(0, 7, 0)
            let scale = Float(1 - pow(1 - min(t / 0.7, 1), 2))
            let flipP = min(t / 2.2, 1)
            let flipEase = 1 - pow(1 - flipP, 3)
            let flipAngle = flipEase * Double.pi * 2

            // Auto-spin is part of the entry flourish only: brisk after the drop, then
            // decays fully to 0 so the tile settles and stays where the user leaves it.
            let zSpeed = t < 3 ? 0.5 * pow(1 - t / 3, 2) : 0.0

            if slerpProgress < 1 {
                slerpProgress = min(1, slerpProgress + Float(dt) / 0.4)
                let e = 1 - pow(1 - slerpProgress, 3)
                orientation = simd_slerp(slerpFrom, restOrientation, e)
            } else if !isDragging {
                if abs(velX) > 0.0001 || abs(velY) > 0.0001 {
                    orientation = quat(Double(velY), SIMD3<Float>(1, 0, 0))
                        * quat(Double(velX), SIMD3<Float>(0, 1, 0)) * orientation
                    velX *= inertiaDecay
                    velY *= inertiaDecay
                }
                // Only spin while the entry flourish is still winding down (zSpeed > 0).
                // Once settled, no drift and no wobble — the tile holds its pose.
                if zSpeed > 0.0001 {
                    let autoQ = quat(zSpeed * dt, SIMD3<Float>(0, 1, 0))
                    orientation = autoQ * orientation
                }
            }

            let floatY = Float(sin(t * 0.8)) * 0.06

            var finalQ = orientation
            if flipP < 1 {
                // Spin on Y while dropping in — the original entry flourish, landing
                // on the frontal arcball rest pose.
                finalQ = quat(flipAngle, SIMD3<Float>(0, 1, 0)) * orientation
            }
            tileNode.simdOrientation = finalQ
            tileNode.simdPosition = entryStart * entryAmount + SIMD3<Float>(0, floatY, 0)
            tileNode.simdScale = SIMD3<Float>(repeating: max(scale, 0.0001))
        }
    }

    private func applyCamera(_ cameraNode: SCNNode) {
        cameraNode.position = SCNVector3(camX, camY, camZ)
        cameraNode.camera?.fieldOfView = CGFloat(fov)
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
        context.coordinator.cameraNode = cameraNode

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

        let pinch = UIPinchGestureRecognizer(target: context.coordinator,
                                             action: #selector(Coordinator.handlePinch(_:)))
        scnView.addGestureRecognizer(pinch)

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

        // Push live-tunable params to the coordinator + camera.
        context.coordinator.dragSensitivity = dragSensitivity
        context.coordinator.inertiaDecay = inertiaDecay
        if let cam = context.coordinator.cameraNode {
            cam.position = SCNVector3(camX, camY, camZ)
            cam.camera?.fieldOfView = CGFloat(fov)
            cam.look(at: SCNVector3(0, 0, 0))
            context.coordinator.camDir = simd_normalize(SIMD3<Float>(camX, camY, camZ))
            context.coordinator.camDistance = simd_length(SIMD3<Float>(camX, camY, camZ))
        }

        // Smooth slerp back to rest on double-tap / tile switch.
        if context.coordinator.lastResetToken != resetToken {
            context.coordinator.lastResetToken = resetToken
            context.coordinator.reset()
        }

        // Update front (index 0 = photo) + back (index 2 = memory) textures.
        if let body = tileNode.childNode(withName: "tileBody", recursively: true),
           let mats = body.geometry?.materials, mats.count >= 6 {
            mats[0].diffuse.contents = tileImage ?? gradientImage()
            mats[2].diffuse.contents = createMemoryTexture()
        }
    }

    // MARK: - Create Tile Geometry

    private func createTileNode(context: Context) -> SCNNode {
        let containerNode = SCNNode()

        let side: CGFloat = 2.4
        let thickness: CGFloat = 0.16
        // Chamfer rounds ALL edges (the tile's rounded bevel). One textured box instead
        // of overlay planes, which met at sharp 90° edges.
        let cornerRadius: CGFloat = 0.075

        // Thin in Z so the big faces point at the camera (frontal, square-on view).
        // Photo on the front (+Z), memory on the back (-Z).
        let box = SCNBox(width: side, height: side, length: thickness, chamferRadius: cornerRadius)

        func sideMat(_ name: String) -> SCNMaterial {
            let m = SCNMaterial()
            m.diffuse.contents = UIImage(named: name)
            // Tint the edges darker so the thickness reads against the cream background.
            m.multiply.contents = UIColor(white: 0.87, alpha: 1)
            m.lightingModel = .constant
            return m
        }
        let frontMat = SCNMaterial()
        frontMat.diffuse.contents = tileImage ?? gradientImage()
        frontMat.lightingModel = .constant
        let backMat = SCNMaterial()
        backMat.diffuse.contents = createMemoryTexture()
        backMat.lightingModel = .constant

        // SCNBox material order: front(+Z), right(+X), back(-Z), left(-X), top(+Y), bottom(-Y).
        // Photo faces the camera (+Z); memory is the back (-Z). All unlit (.constant).
        box.materials = [frontMat, sideMat("side3"), backMat, sideMat("side4"), sideMat("side1"), sideMat("side2")]

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
            // The back (-Y) face reads upright when the tile is flipped about its X
            // axis to reveal it, so the texture is drawn normally (no mirror).

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
