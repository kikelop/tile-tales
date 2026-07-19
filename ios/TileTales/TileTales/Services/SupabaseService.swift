import CryptoKit
import Foundation
import Security
import Supabase

// MARK: - Client

/// Project config. The anon key is safe to ship — RLS guards every row.
/// Mirrors app/.env.local on the web side.
enum SupabaseConfig {
    static let url = URL(string: "https://bszzmqkcseyiqqqlzrcu.supabase.co")!
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzenptcWtjc2V5aXFxcWx6cmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTQ5NDEsImV4cCI6MjA5ODgzMDk0MX0.nK1MfhmzsDrXUf_3W3_ZjBLvPyGilCmQlvaJ0b1ERoo"
}

/// Session storage on UserDefaults instead of the default Keychain — the
/// Keychain silently fails on unsigned simulator builds (CODE_SIGNING_ALLOWED=NO),
/// which left auth.session empty and every REST call falling back to the anon
/// role (RLS then rejected pushes).
private struct UserDefaultsAuthStorage: AuthLocalStorage {
    func store(key: String, value: Data) throws {
        UserDefaults.standard.set(value, forKey: key)
    }
    func retrieve(key: String) throws -> Data? {
        UserDefaults.standard.data(forKey: key)
    }
    func remove(key: String) throws {
        UserDefaults.standard.removeObject(forKey: key)
    }
}

let supabase = SupabaseClient(
    supabaseURL: SupabaseConfig.url,
    supabaseKey: SupabaseConfig.anonKey,
    options: SupabaseClientOptions(
        auth: SupabaseClientOptions.AuthOptions(storage: UserDefaultsAuthStorage())
    )
)

// MARK: - Auth

/// Sign in with Apple only (single provider). Cloud sync is opt-in: the app is
/// fully usable without an account; signing in just backs the collection up so
/// it follows the user to a new device or account.
@MainActor
final class AuthService: ObservableObject {
    @Published private(set) var session: Session?

    private var listenTask: Task<Void, Never>?

    func start() {
        guard listenTask == nil else { return }
        session = supabase.auth.currentSession
        listenTask = Task {
            for await (_, session) in supabase.auth.authStateChanges {
                self.session = session
            }
        }
    }

    /// Exchanges an Apple identity token for a Supabase session. `nonce` is the
    /// RAW (unhashed) nonce — Supabase hashes it to match the token's nonce
    /// claim. `fullName` is only non-nil on the FIRST sign-in (Apple provides it
    /// once); we stash it in user metadata for the future community map's public
    /// display name. Returns a user-facing error message, or nil on success.
    func signInWithApple(idToken: String, nonce: String, fullName: PersonNameComponents?) async -> String? {
        do {
            try await supabase.auth.signInWithIdToken(
                credentials: OpenIDConnectCredentials(provider: .apple, idToken: idToken, nonce: nonce)
            )
            if let fullName {
                let name = PersonNameComponentsFormatter()
                    .string(from: fullName)
                    .trimmingCharacters(in: .whitespaces)
                if !name.isEmpty {
                    _ = try? await supabase.auth.update(user: UserAttributes(data: ["full_name": .string(name)]))
                }
            }
            return nil
        } catch {
            return "Couldn't sign in with Apple — try again"
        }
    }

    func signOut() async {
        try? await supabase.auth.signOut()
    }

    /// In-app account deletion (App Store guideline 5.1.1v) via the deployed
    /// delete-account Edge Function. Local tiles are kept.
    func deleteAccount() async -> String? {
        do {
            try await supabase.functions.invoke("delete-account")
            try? await supabase.auth.signOut()
            return nil
        } catch {
            return "Couldn't delete the account — try again"
        }
    }
}

// MARK: - Sign in with Apple nonce helpers

/// Cryptographically-random nonce. The raw value is passed to Supabase; its
/// SHA256 (`sha256(_:)`) is what goes to Apple in the authorization request.
func randomNonceString(length: Int = 32) -> String {
    precondition(length > 0)
    // 64-char set; 256 is a multiple of 64, so `% count` is bias-free.
    let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
    var randomBytes = [UInt8](repeating: 0, count: length)
    let status = SecRandomCopyBytes(kSecRandomDefault, length, &randomBytes)
    guard status == errSecSuccess else {
        fatalError("SecRandomCopyBytes failed: \(status)")
    }
    return String(randomBytes.map { charset[Int($0) % charset.count] })
}

/// SHA256 hex digest — the hashed nonce handed to Apple's authorization request.
func sha256(_ input: String) -> String {
    SHA256.hash(data: Data(input.utf8))
        .map { String(format: "%02x", $0) }
        .joined()
}
