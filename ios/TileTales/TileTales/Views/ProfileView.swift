import SwiftUI

/// Profile screen: account & sync front and center (tiles must survive
/// switching phones), with collection stats as a secondary tab. Mirrors the
/// web app's ProfileView.
struct ProfileView: View {
    @EnvironmentObject var store: TileStore
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var sync: SyncEngine
    @Binding var navigationPath: NavigationPath

    enum Tab: String, CaseIterable, Identifiable {
        case account = "Account"
        case stats = "Stats"
        var id: String { rawValue }
    }

    @State private var tab: Tab = .account

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                Picker("Section", selection: $tab) {
                    ForEach(Tab.allCases) { t in Text(t.rawValue).tag(t) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.bottom, 4)

                ScrollView {
                    VStack(spacing: 20) {
                        if tab == .account {
                            AccountSectionView()
                            BackupSectionView()
                        } else {
                            StatsContent()
                        }
                    }
                    .padding(16)
                }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button { navigationPath.removeLast() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(fgColor)
                    .frame(width: 40, height: 40)
                    .background(Color.black.opacity(0.06))
                    .clipShape(Circle())
            }
            Text("Profile").font(.system(size: 22, weight: .bold)).tracking(-0.3)
            Spacer()
        }
        .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 12)
    }
}

// MARK: - Account section

struct AccountSectionView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var sync: SyncEngine

    enum Mode { case signIn, signUp, forgot }

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var formError: String?
    @State private var resetSent = false
    @State private var showDeleteConfirm = false
    @State private var deleting = false

    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)
    private let accent = Color(red: 52/255, green: 70/255, blue: 188/255) // #3446BC
    private let danger = Color(red: 179/255, green: 64/255, blue: 42/255)

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Account & sync")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(fgColor)

            if let session = auth.session {
                signedInBody(email: session.user.email ?? "")
            } else {
                signedOutBody
            }
        }
        .padding(16)
        .background(Color.black.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .confirmationDialog(
            "Delete your account?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete forever", role: .destructive) { Task { await deleteAccount() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This deletes your account and everything backed up to it. Tiles on this device are kept. This can't be undone.")
        }
    }

    // MARK: signed out

    @ViewBuilder
    private var signedOutBody: some View {
        if mode == .forgot && resetSent {
            Text("If \(email) has an account, a reset link is on its way.")
                .font(.system(size: 13)).foregroundColor(mutedColor)
            Button("← Back to sign in") { switchMode(.signIn) }
                .font(.system(size: 13, weight: .semibold)).foregroundColor(accent)
        } else {
            TextField("you@email.com", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(12)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))

            if mode != .forgot {
                SecureField("Password (8+ characters)", text: $password)
                    .textContentType(mode == .signUp ? .newPassword : .password)
                    .padding(12)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            if let formError {
                Text(formError).font(.system(size: 13)).foregroundColor(danger)
            }

            Button { Task { await submit() } } label: {
                Text(busy ? "…" : primaryLabel)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(accent)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(busy || email.isEmpty)
            .opacity(busy || email.isEmpty ? 0.5 : 1)

            HStack {
                if mode == .signIn {
                    Button("Create account") { switchMode(.signUp) }
                        .font(.system(size: 13, weight: .semibold)).foregroundColor(accent)
                    Spacer()
                    Button("Forgot password?") { switchMode(.forgot) }
                        .font(.system(size: 13)).foregroundColor(mutedColor)
                } else {
                    Button("← Back to sign in") { switchMode(.signIn) }
                        .font(.system(size: 13, weight: .semibold)).foregroundColor(accent)
                }
            }

            if mode == .signUp {
                Text("Your tiles back up automatically and follow you to any device.")
                    .font(.system(size: 12)).foregroundColor(mutedColor)
            }
        }
    }

    private var primaryLabel: String {
        switch mode {
        case .signIn: return "Sign in"
        case .signUp: return "Create account"
        case .forgot: return "Send reset link"
        }
    }

    // MARK: signed in

    @ViewBuilder
    private func signedInBody(email: String) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(email)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(fgColor)
                    .lineLimit(1)
                Text(syncLabel)
                    .font(.system(size: 12))
                    .foregroundColor(isSyncError ? danger : mutedColor)
            }
            Spacer()
            Button {
                sync.requestSync()
            } label: {
                Text(sync.state == .syncing ? "…" : "Sync now")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(fgColor)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.black.opacity(0.15), lineWidth: 1))
            }
            .disabled(sync.state == .syncing)
        }
        .padding(12)
        .background(Color.white.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 12))

        HStack(spacing: 10) {
            Button { Task { await auth.signOut() } } label: {
                Text("Sign out")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(fgColor)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.black.opacity(0.15), lineWidth: 1))
            }
            Button { showDeleteConfirm = true } label: {
                Text(deleting ? "Deleting…" : "Delete account")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(danger)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(danger.opacity(0.35), lineWidth: 1))
            }
            .disabled(deleting)
        }
    }

    private var syncLabel: String {
        switch sync.state {
        case .syncing: return "Syncing…"
        case .error(let message): return "Sync issue: \(message)"
        default:
            if let last = sync.lastSyncAt {
                let mins = Int(Date().timeIntervalSince(last) / 60)
                return mins < 1 ? "Synced just now" : "Synced \(mins) min ago"
            }
            return "Waiting for first sync"
        }
    }

    private var isSyncError: Bool {
        if case .error = sync.state { return true }
        return false
    }

    // MARK: actions

    private func switchMode(_ next: Mode) {
        mode = next
        formError = nil
        resetSent = false
    }

    private func submit() async {
        guard !busy else { return }
        formError = nil
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        guard trimmed.contains("@"), trimmed.contains(".") else {
            formError = "That doesn't look like an email"
            return
        }
        if mode != .forgot && password.count < 8 {
            formError = "Password needs at least 8 characters"
            return
        }
        busy = true
        defer { busy = false }
        switch mode {
        case .signIn:
            formError = await auth.signIn(email: trimmed, password: password)
        case .signUp:
            formError = await auth.signUp(email: trimmed, password: password)
        case .forgot:
            formError = await auth.requestPasswordReset(email: trimmed)
            if formError == nil { resetSent = true }
        }
        if formError == nil { password = "" }
    }

    private func deleteAccount() async {
        deleting = true
        defer { deleting = false }
        _ = await auth.deleteAccount()
    }
}
