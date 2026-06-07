import Foundation
import Supabase

// MARK: - Client

/// Project config. The anon (publishable) key is safe to ship — RLS guards
/// every row. Mirrors app/.env.local on the web side.
enum SupabaseConfig {
    static let url = URL(string: "https://vjwibllynlxxwkspbnav.supabase.co")!
    static let anonKey = "sb_publishable_hLczmb4YOSXlyjli8jskRw_UU835gcd"
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

/// Email + password auth (mirrors web app/src/lib/auth.ts). Signups are
/// auto-confirmed server-side; the only email ever sent is the password reset.
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

    /// Creates the account and signs in (session is immediate).
    /// Returns a user-facing error message, or nil on success.
    func signUp(email: String, password: String) async -> String? {
        do {
            let response = try await supabase.auth.signUp(email: email, password: password)
            if response.session == nil {
                return "That email already has an account — sign in instead"
            }
            return nil
        } catch {
            return Self.friendlyMessage(error)
        }
    }

    func signIn(email: String, password: String) async -> String? {
        do {
            _ = try await supabase.auth.signIn(email: email, password: password)
            return nil
        } catch {
            return Self.friendlyMessage(error)
        }
    }

    func requestPasswordReset(email: String) async -> String? {
        do {
            try await supabase.auth.resetPasswordForEmail(email)
            return nil
        } catch {
            return Self.friendlyMessage(error)
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

    private static func friendlyMessage(_ error: Error) -> String {
        let message = error.localizedDescription
        if message.localizedCaseInsensitiveContains("invalid login credentials") {
            return "Wrong email or password"
        }
        if message.localizedCaseInsensitiveContains("already registered") {
            return "That email already has an account — sign in instead"
        }
        if message.localizedCaseInsensitiveContains("password") {
            return "Password needs at least 8 characters"
        }
        return message
    }
}
