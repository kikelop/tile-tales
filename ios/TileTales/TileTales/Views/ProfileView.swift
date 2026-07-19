import AuthenticationServices
import SwiftUI

/// Profile screen: cloud backup (Sign in with Apple) up top so tiles survive
/// switching phones, then collection stats and local backup. Local-first —
/// everything below works without an account.
struct ProfileView: View {
    @EnvironmentObject var store: TileStore
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var sync: SyncEngine
    @Binding var navigationPath: NavigationPath

    private let bgColor = Brand.bg
    private let fgColor = Brand.fg

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                ScrollView {
                    VStack(spacing: 20) {
                        AccountSectionView()
                        StatsContent()
                        BackupSectionView()
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

    @State private var currentNonce: String?
    @State private var authenticating = false
    @State private var authError: String?
    @State private var showDeleteConfirm = false
    @State private var deleting = false

    private let fgColor = Brand.fg
    private let mutedColor = Brand.muted
    private let danger = Color(red: 179/255, green: 64/255, blue: 42/255)

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Account & sync")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(fgColor)

            if auth.session != nil {
                signedInBody(identity: signedInIdentity)
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
        Text("Sign in to back up your collection. Your tiles follow you to any device — nothing is shared or made public.")
            .font(.system(size: 13))
            .foregroundColor(mutedColor)
            .fixedSize(horizontal: false, vertical: true)

        SignInWithAppleButton(.signIn) { request in
            let nonce = randomNonceString()
            currentNonce = nonce
            request.requestedScopes = [.fullName, .email]
            request.nonce = sha256(nonce)
        } onCompletion: { result in
            handleAppleCompletion(result)
        }
        .signInWithAppleButtonStyle(.black)
        .frame(maxWidth: .infinity)
        .frame(height: 48)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .opacity(authenticating ? 0.5 : 1)
        .disabled(authenticating)

        if let authError {
            Text(authError).font(.system(size: 13)).foregroundColor(danger)
        }
    }

    // MARK: signed in

    /// Friendly label for the signed-in state. Prefers the name Apple gave us on
    /// first sign-in (stored in user metadata); never shows the cryptic private
    /// relay email, which means nothing to the user.
    private var signedInIdentity: String {
        if case let .string(name)? = auth.session?.user.userMetadata["full_name"],
           !name.trimmingCharacters(in: .whitespaces).isEmpty {
            return name
        }
        return "Signed in with Apple"
    }

    @ViewBuilder
    private func signedInBody(identity: String) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(identity)
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

    private func handleAppleCompletion(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8),
                let nonce = currentNonce
            else {
                authError = "Couldn't read the Apple credential — try again"
                return
            }
            authError = nil
            authenticating = true
            Task {
                let error = await auth.signInWithApple(
                    idToken: idToken, nonce: nonce, fullName: credential.fullName
                )
                authenticating = false
                authError = error
            }
        case .failure(let error):
            // User cancellation isn't worth surfacing.
            if (error as? ASAuthorizationError)?.code == .canceled { return }
            authError = "Sign in with Apple failed — try again"
        }
    }

    private func deleteAccount() async {
        deleting = true
        defer { deleting = false }
        _ = await auth.deleteAccount()
    }
}
