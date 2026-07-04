import SwiftUI

// MARK: - Photo editor (re-crop + light adjustments)

/// Full-screen editor for an existing tile: a "Crop" tab (same gestures as capture)
/// and an "Adjust" tab (brightness/contrast/exposure/saturation/warmth), with a live
/// preview. Non-destructive — returns a PhotoEdit + the rendered 1024² image.
struct PhotoEditView: View {
    let baseImage: UIImage
    let initialEdit: PhotoEdit
    /// false for legacy tiles whose original is gone (re-crop is limited to within
    /// the already-cropped image; shown as a hint).
    let hasOriginalOnDisk: Bool
    /// Batch hint shown at the top during multi-import (e.g. "3 photos left"); nil otherwise.
    var batchLabel: String? = nil
    var doneLabel: String = "Done"
    var cancelLabel: String = "Cancel"
    let onDone: (PhotoEdit, UIImage) -> Void
    let onCancel: () -> Void

    enum Mode: String, CaseIterable { case crop = "Crop", adjust = "Adjust" }
    @State private var mode: Mode = .crop

    @State private var scale: CGFloat
    @State private var baseScale: CGFloat
    @State private var offset: CGSize = .zero
    @State private var baseOffset: CGSize = .zero
    @State private var rotation: Angle
    @State private var baseRotation: Angle

    @State private var brightness: Double
    @State private var contrast: Double
    @State private var saturation: Double
    @State private var exposure: Double
    @State private var warmth: Double

    @State private var side: CGFloat = 320
    @State private var seeded = false
    @State private var previewBase: UIImage?   // downscaled baseImage for smooth gestures
    @State private var croppedBase: UIImage?
    @State private var adjustPreview: UIImage?

    init(baseImage: UIImage, initialEdit: PhotoEdit, hasOriginalOnDisk: Bool,
         batchLabel: String? = nil, doneLabel: String = "Done", cancelLabel: String = "Cancel",
         onDone: @escaping (PhotoEdit, UIImage) -> Void, onCancel: @escaping () -> Void) {
        self.baseImage = baseImage
        self.initialEdit = initialEdit
        self.hasOriginalOnDisk = hasOriginalOnDisk
        self.batchLabel = batchLabel
        self.doneLabel = doneLabel
        self.cancelLabel = cancelLabel
        self.onDone = onDone
        self.onCancel = onCancel
        _scale = State(initialValue: initialEdit.scale)
        _baseScale = State(initialValue: initialEdit.scale)
        _rotation = State(initialValue: .radians(initialEdit.rotationRadians))
        _baseRotation = State(initialValue: .radians(initialEdit.rotationRadians))
        _brightness = State(initialValue: initialEdit.brightness)
        _contrast = State(initialValue: initialEdit.contrast)
        _saturation = State(initialValue: initialEdit.saturation)
        _exposure = State(initialValue: initialEdit.exposure)
        _warmth = State(initialValue: initialEdit.warmth)
        // offset is seeded in onAppear once `side` is known (it's normalized).
    }

    private var cropEdit: PhotoEdit {
        PhotoEdit(scale: scale, offsetX: offset.width / side, offsetY: offset.height / side,
                  rotationRadians: rotation.radians)
    }

    private var currentEdit: PhotoEdit {
        var e = cropEdit
        e.brightness = brightness; e.contrast = contrast
        e.saturation = saturation; e.exposure = exposure; e.warmth = warmth
        return e
    }

    // Real window insets — reliable regardless of how this cover is presented
    // (a fullScreenCover nested in a NavigationStack/TabView doesn't propagate
    // the safe area the way a root-level one does).
    private var safeInsets: UIEdgeInsets {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first?.safeAreaInsets ?? .zero
    }

    var body: some View {
        GeometryReader { geo in
            let computedSide = min(geo.size.width - 32, geo.size.height - 280)

            VStack(spacing: 20) {
                    topBar

                    modeSwitch

                    Spacer()

                    if mode == .crop {
                        cropCanvas(side: computedSide)
                        if !hasOriginalOnDisk {
                            Text("Original not stored — you can reframe within the saved crop")
                                .font(.system(size: 12)).foregroundColor(.white.opacity(0.5))
                                .multilineTextAlignment(.center).padding(.horizontal, 24)
                        }
                        rotateControls
                    } else {
                        adjustCanvas(side: computedSide)
                        adjustSliders
                    }

                    Spacer()
                }
                .padding(.top, safeInsets.top)
                .padding(.bottom, safeInsets.bottom)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.black)
                .onAppear {
                    side = computedSide
                if previewBase == nil { previewBase = PhotoRenderer.downscaled(baseImage) }
                if !seeded {
                    offset = CGSize(width: initialEdit.offsetX * computedSide,
                                    height: initialEdit.offsetY * computedSide)
                    baseOffset = offset
                    seeded = true
                }
            }
        }
        .ignoresSafeArea()
    }

    // MARK: Top bar

    private var topBar: some View {
        HStack {
            Button(cancelLabel) { onCancel() }
                .font(.system(size: 16)).foregroundColor(.white)
            Spacer()
            if let batchLabel {
                Text(batchLabel)
                    .font(.system(size: 13, weight: .semibold)).foregroundColor(.white.opacity(0.7))
            }
            Spacer()
            Button(doneLabel) {
                let edit = currentEdit
                let rendered = PhotoRenderer.render(original: baseImage, edit: edit, side: side)
                onDone(edit, rendered)
            }
            .font(.system(size: 16, weight: .semibold)).foregroundColor(.white)
        }
        .padding(.horizontal, 16).padding(.top, 16)
    }

    // Custom segmented control — the native Picker(.segmented) is unreadable on black.
    private var modeSwitch: some View {
        HStack(spacing: 0) {
            ForEach(Mode.allCases, id: \.self) { m in
                Button {
                    mode = m
                    if m == .adjust { rebuildCroppedBase() } // offset already seeded by now
                } label: {
                    Text(m.rawValue)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(mode == m ? .black : .white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(mode == m ? Color.white : Color.clear)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(4)
        .background(Color.white.opacity(0.15))
        .clipShape(Capsule())
        .padding(.horizontal, 60)
    }

    // MARK: Crop tab

    private func cropCanvas(side: CGFloat) -> some View {
        Image(uiImage: previewBase ?? baseImage)
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: side, height: side)
            .scaleEffect(scale)
            .rotationEffect(rotation)
            .offset(offset)
            .frame(width: side, height: side)
            .clipped()
            .overlay(Rectangle().stroke(Color.white.opacity(0.6), lineWidth: 1))
            .contentShape(Rectangle())
            .gesture(dragGesture.simultaneously(with: magnifyGesture).simultaneously(with: rotateGesture))
    }

    private var rotateControls: some View {
        HStack(spacing: 24) {
            rotateButton(systemName: "rotate.left", delta: -10)
            Text("\(Int(rotation.degrees.truncatingRemainder(dividingBy: 360)))°")
                .font(.system(size: 14, weight: .medium, design: .monospaced))
                .foregroundColor(.white.opacity(0.8)).frame(width: 60)
            rotateButton(systemName: "rotate.right", delta: 10)
        }
    }

    private func rotateButton(systemName: String, delta: Double) -> some View {
        Button {
            withAnimation(.easeOut(duration: 0.15)) {
                rotation = .degrees(rotation.degrees + delta)
                baseRotation = rotation
            }
        } label: {
            Image(systemName: systemName)
                .font(.system(size: 18)).foregroundColor(.white)
                .frame(width: 44, height: 44)
                .background(Color.white.opacity(0.18)).clipShape(Circle())
        }
    }

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { v in offset = CGSize(width: baseOffset.width + v.translation.width,
                                              height: baseOffset.height + v.translation.height) }
            .onEnded { _ in baseOffset = offset }
    }
    private var magnifyGesture: some Gesture {
        MagnificationGesture()
            .onChanged { v in scale = max(0.5, min(4, baseScale * v)) }
            .onEnded { _ in baseScale = scale }
    }
    private var rotateGesture: some Gesture {
        RotationGesture()
            .onChanged { v in rotation = baseRotation + v }
            .onEnded { _ in baseRotation = rotation }
    }

    // MARK: Adjust tab

    private func adjustCanvas(side: CGFloat) -> some View {
        Group {
            if let img = adjustPreview ?? croppedBase {
                Image(uiImage: img).resizable().scaledToFit()
                    .frame(width: side, height: side)
                    .clipped()
            } else {
                Color.white.opacity(0.05).frame(width: side, height: side)
                    .overlay(ProgressView().tint(.white))
            }
        }
    }

    private var adjustSliders: some View {
        VStack(spacing: 12) {
            slider("Brightness", value: $brightness, range: -1...1)
            slider("Contrast", value: $contrast, range: 0...2)
            slider("Exposure", value: $exposure, range: -2...2)
            slider("Saturation", value: $saturation, range: 0...2)
            slider("Warmth", value: $warmth, range: -1...1)

            Button("Reset adjustments") {
                brightness = 0; contrast = 1; saturation = 1; exposure = 0; warmth = 0
                refreshColor()
            }
            .font(.system(size: 13, weight: .medium)).foregroundColor(.white.opacity(0.7))
            .padding(.top, 4)
        }
        .padding(.horizontal, 20)
    }

    private func slider(_ label: String, value: Binding<Double>, range: ClosedRange<Double>) -> some View {
        HStack(spacing: 12) {
            Text(label).font(.system(size: 13)).foregroundColor(.white.opacity(0.85))
                .frame(width: 86, alignment: .leading)
            Slider(value: value, in: range)
                .tint(.white)
                .onChange(of: value.wrappedValue) { _, _ in refreshColor() }
        }
    }

    // MARK: Preview rendering

    private func rebuildCroppedBase() {
        // Preview uses the downscaled copy (fast); Done re-renders from the full-res original.
        croppedBase = PhotoRenderer.crop(previewBase ?? baseImage, edit: cropEdit, side: side)
        refreshColor()
    }

    private func refreshColor() {
        guard let base = croppedBase else { return }
        adjustPreview = currentEdit.isColorIdentity ? base : PhotoRenderer.applyColor(base, edit: currentEdit)
    }
}
