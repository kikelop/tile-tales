import SwiftUI
import SceneKit

struct SceneKitTileView: UIViewRepresentable {
    let tileImage: UIImage?
    let memoryText: String
    let dateText: String
    let tileName: String
    /// Bumped by the viewer on double-tap / tile switch to recenter the camera.
    var resetToken: Int = 0

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator {
        var lastResetToken = 0
    }

    func makeUIView(context: Context) -> SCNView {
        let scnView = SCNView()
        scnView.backgroundColor = UIColor(red: 245/255, green: 242/255, blue: 237/255, alpha: 1)
        scnView.antialiasingMode = .multisampling4X
        scnView.allowsCameraControl = true
        scnView.autoenablesDefaultLighting = false

        let scene = SCNScene()
        scnView.scene = scene

        // Camera — elevated 3/4 view so the patterned top face (which points +Y) is
        // seen from above-front, centered and at a comfortable size. A near-level
        // camera saw the tile edge-on at rest.
        let cameraNode = SCNNode()
        cameraNode.name = "camera"
        cameraNode.camera = SCNCamera()
        cameraNode.camera?.fieldOfView = 35
        cameraNode.camera?.projectionDirection = .vertical
        cameraNode.position = SCNVector3(0, 5.5, 6.5)
        cameraNode.look(at: SCNVector3(0, 0.9, 0))
        scnView.pointOfView = cameraNode
        scene.rootNode.addChildNode(cameraNode)

        // Lights
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

        // Tile
        let tileNode = createTileNode(context: context)
        tileNode.name = "tile"
        scene.rootNode.addChildNode(tileNode)

        // Entry animation
        tileNode.scale = SCNVector3(0, 0, 0)
        tileNode.position = SCNVector3(0, 5, 0)

        SCNTransaction.begin()
        SCNTransaction.animationDuration = 1.5
        SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeOut)
        tileNode.scale = SCNVector3(1, 1, 1)
        tileNode.position = SCNVector3(0, 0, 0)
        SCNTransaction.commit()

        // Y flip entry
        let flipAction = SCNAction.rotateBy(x: 0, y: .pi * 2, z: 0, duration: 1.8)
        flipAction.timingMode = .easeOut
        tileNode.runAction(flipAction)

        // Continuous subtle Z rotation
        let zSpin = SCNAction.rotateBy(x: 0, y: 0, z: 0.08, duration: 1)
        tileNode.runAction(.repeatForever(zSpin))

        // Float animation
        let floatUp = SCNAction.moveBy(x: 0, y: 0.06, z: 0, duration: 2)
        floatUp.timingMode = .easeInEaseOut
        let floatDown = SCNAction.moveBy(x: 0, y: -0.06, z: 0, duration: 2)
        floatDown.timingMode = .easeInEaseOut
        let floatSeq = SCNAction.sequence([floatUp, floatDown])
        tileNode.runAction(.repeatForever(floatSeq))

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

        // Recenter on double-tap / tile switch.
        if context.coordinator.lastResetToken != resetToken {
            context.coordinator.lastResetToken = resetToken
            if let cameraNode = scnView.scene?.rootNode.childNode(withName: "camera", recursively: false) {
                SCNTransaction.begin()
                SCNTransaction.animationDuration = 0.45
                SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeOut)
                scnView.pointOfView = cameraNode
                tileNode.eulerAngles = SCNVector3Zero
                SCNTransaction.commit()
            }
        }

        // Update top face texture
        if let topFace = tileNode.childNode(withName: "topFace", recursively: false) {
            if let image = tileImage {
                topFace.geometry?.firstMaterial?.diffuse.contents = image
            } else {
                topFace.geometry?.firstMaterial?.diffuse.contents = gradientImage()
            }
        }

        // Update back face texture
        if let backFace = tileNode.childNode(withName: "backFace", recursively: false) {
            backFace.geometry?.firstMaterial?.diffuse.contents = createMemoryTexture()
        }
    }

    // MARK: - Create Tile Geometry

    private func createTileNode(context: Context) -> SCNNode {
        let containerNode = SCNNode()

        let width: CGFloat = 2.4
        let height: CGFloat = 0.16
        let cornerRadius: CGFloat = 0.06

        // Body — rounded box
        let body = SCNBox(width: width, height: height, length: width, chamferRadius: cornerRadius)
        let bodyMat = SCNMaterial()
        bodyMat.diffuse.contents = UIColor(red: 226/255, green: 221/255, blue: 214/255, alpha: 1)
        bodyMat.roughness.contents = 0.8
        body.materials = [bodyMat]
        let bodyNode = SCNNode(geometry: body)
        containerNode.addChildNode(bodyNode)

        // Top face
        let topPlane = SCNPlane(width: width - 0.06, height: width - 0.06)
        let topMat = SCNMaterial()
        if let image = tileImage {
            topMat.diffuse.contents = image
        } else {
            topMat.diffuse.contents = gradientImage()
        }
        topMat.isDoubleSided = false
        topPlane.materials = [topMat]
        let topNode = SCNNode(geometry: topPlane)
        topNode.name = "topFace"
        topNode.eulerAngles.x = -.pi / 2
        topNode.position = SCNVector3(0, height / 2 + 0.001, 0)
        containerNode.addChildNode(topNode)

        // Back face
        let backPlane = SCNPlane(width: width - 0.06, height: width - 0.06)
        let backMat = SCNMaterial()
        backMat.diffuse.contents = createMemoryTexture()
        backMat.isDoubleSided = false
        backPlane.materials = [backMat]
        let backNode = SCNNode(geometry: backPlane)
        backNode.name = "backFace"
        backNode.eulerAngles.x = .pi / 2
        backNode.position = SCNVector3(0, -height / 2 - 0.001, 0)
        containerNode.addChildNode(backNode)

        return containerNode
    }

    // MARK: - Memory Texture

    private func createMemoryTexture() -> UIImage {
        let size = CGSize(width: 1024, height: 1024)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { ctx in
            // Background — ceramic beige
            UIColor(red: 212/255, green: 205/255, blue: 194/255, alpha: 1).setFill()
            ctx.fill(CGRect(origin: .zero, size: size))

            if !memoryText.isEmpty {
                let font = UIFont(name: "Snell Roundhand", size: 64)
                    ?? UIFont.systemFont(ofSize: 64, weight: .light)
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
                let dateFont = UIFont(name: "Snell Roundhand", size: 34)
                    ?? UIFont.systemFont(ofSize: 34, weight: .light)
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
