import SwiftUI

@main
struct DailyDuelApp: App {
    var body: some Scene {
        WindowGroup {
            MatchView(api: Self.api)
        }
    }

    /// Solange keine Backend-URL konfiguriert ist, läuft die App gegen den
    /// Mock. So lässt sich die Oberfläche vom ersten Tag an bedienen.
    private static var api: DuelAPI {
        guard
            let urlString = Bundle.main.object(forInfoDictionaryKey: "SupabaseFunctionsURL") as? String,
            let url = URL(string: urlString), !urlString.isEmpty,
            let anonKey = Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String,
            !anonKey.isEmpty
        else {
            return MockAPI()
        }

        return LiveAPI(baseURL: url, anonKey: anonKey) {
            // Hier das Zugriffstoken aus der Supabase-Sitzung liefern
            // (Sign in with Apple). Im Prototyp noch nicht angeschlossen.
            nil
        }
    }
}
