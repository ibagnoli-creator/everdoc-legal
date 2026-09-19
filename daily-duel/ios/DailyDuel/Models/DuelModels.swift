import Foundation

// Antwortformen der Edge Functions. Bewusst getrennt vom UI-Zustand:
// was der Server schickt, wird nicht direkt in Views gereicht.

struct StartMatchResponse: Decodable, Sendable {
    let matchId: String
    let totalQuestions: Int
    let opponent: OpponentCard
    let question: ServedQuestion
}

struct OpponentCard: Decodable, Sendable {
    let name: String
    let elo: Int
    let league: String
    let country: String?
    /// Übungsgegner werden im Duell sichtbar als solche gekennzeichnet.
    let isPractice: Bool
}

struct ServedQuestion: Decodable, Sendable, Identifiable {
    let position: Int
    let id: String
    let text: String
    let options: [String]
    let windowMs: Int
    /// Wann der Gegner auf diese Frage geantwortet hat – treibt den
    /// Gegnerbalken. Ob er richtig lag, verrät der Server erst danach.
    let opponentAnswerMs: Int

    var window: Duration { .milliseconds(windowMs) }
}

struct AnswerResponse: Decodable, Sendable {
    let result: AnswerResult
    let opponent: OpponentAnswer?
    let playerScore: Int
    let opponentScore: Int
    /// Nil bedeutet: das war die letzte Frage.
    let question: ServedQuestion?
}

struct AnswerResult: Decodable, Sendable {
    let correctIndex: Int
    let isCorrect: Bool
    let points: Int
    let elapsedMs: Int
}

struct OpponentAnswer: Decodable, Sendable {
    let isCorrect: Bool
    let points: Int
    let answerMs: Int
}

struct MatchSummary: Decodable, Sendable, Equatable {
    let outcome: Outcome
    let playerScore: Int
    let opponentScore: Int
    let eloBefore: Int
    let eloAfter: Int
    let eloDelta: Int
    let league: String
    let streak: Int
    let wasPractice: Bool
    let rounds: [RoundSummary]

    enum Outcome: String, Decodable, Sendable, Equatable {
        case win, draw, loss

        var headline: String {
            switch self {
            case .win: "Gewonnen"
            case .draw: "Unentschieden"
            case .loss: "Verloren"
            }
        }
    }
}

struct RoundSummary: Decodable, Sendable, Equatable {
    let position: Int
    let points: Int
    let isCorrect: Bool
}

/// Fehlercodes, auf die die Oberfläche unterschiedlich reagiert. Alles
/// andere landet in `.server`.
enum DuelError: Error, Equatable {
    case noSlotsLeft
    case matchClosed
    case unauthenticated
    case offline
    case server(code: String, message: String)

    var userMessage: String {
        switch self {
        case .noSlotsLeft:
            "Für heute ist dein Duell gespielt. Morgen wartet ein neues."
        case .matchClosed:
            "Dieses Duell ist schon abgeschlossen."
        case .unauthenticated:
            "Bitte melde dich neu an."
        case .offline:
            "Keine Verbindung. Versuch es gleich noch einmal."
        case let .server(_, message):
            message
        }
    }
}
