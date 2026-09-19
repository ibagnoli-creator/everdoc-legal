import Foundation

/// Die drei Aufrufe, aus denen ein Duell besteht. Als Protokoll, damit die
/// Oberfläche gegen `MockAPI` entwickelt werden kann, solange das Backend
/// noch nicht steht.
protocol DuelAPI: Sendable {
    func startMatch(timezone: String) async throws -> StartMatchResponse
    func submitAnswer(matchId: String, position: Int, chosen: Int?) async throws -> AnswerResponse
    func finishMatch(matchId: String) async throws -> MatchSummary
}

/// Ruft die Supabase Edge Functions auf.
struct LiveAPI: DuelAPI {
    let baseURL: URL
    let anonKey: String
    /// Liefert das aktuelle Zugriffstoken. Als Closure, damit der Client
    /// nichts über die Anmeldung wissen muss.
    let accessToken: @Sendable () async -> String?

    private let session: URLSession = .shared
    private let decoder: JSONDecoder = .init()

    func startMatch(timezone: String) async throws -> StartMatchResponse {
        try await post("start-match", body: ["timezone": timezone])
    }

    func submitAnswer(matchId: String, position: Int, chosen: Int?) async throws -> AnswerResponse {
        try await post("submit-answer", body: [
            "matchId": matchId,
            "position": position,
            // Nil steht für Zeitablauf – der Server wertet das als Fehlversuch.
            "chosen": chosen as Any,
        ])
    }

    func finishMatch(matchId: String) async throws -> MatchSummary {
        try await post("finish-match", body: ["matchId": matchId])
    }

    private func post<Response: Decodable>(
        _ path: String,
        body: [String: Any]
    ) async throws -> Response {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        if let token = await accessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONSerialization.data(
            withJSONObject: body.compactMapValues { $0 is NSNull ? nil : $0 }
        )
        // Ein Duell dauert 60 Sekunden; ein hängender Request darf es nicht
        // überleben.
        request.timeoutInterval = 15

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw DuelError.offline
        }

        guard let http = response as? HTTPURLResponse else { throw DuelError.offline }
        guard (200..<300).contains(http.statusCode) else {
            throw Self.error(from: data, status: http.statusCode)
        }

        return try decoder.decode(Response.self, from: data)
    }

    private static func error(from data: Data, status: Int) -> DuelError {
        struct Envelope: Decodable {
            struct Payload: Decodable { let code: String; let message: String }
            let error: Payload
        }

        guard let envelope = try? JSONDecoder().decode(Envelope.self, from: data) else {
            return .server(code: "http_\(status)", message: "Serverfehler (\(status)).")
        }

        return switch envelope.error.code {
        case "no_slots_left": .noSlotsLeft
        case "match_closed", "already_answered": .matchClosed
        case "unauthenticated": .unauthenticated
        default: .server(code: envelope.error.code, message: envelope.error.message)
        }
    }
}
