import Foundation

/// Spielbares Duell ohne Backend. Gedacht für Previews, für die Arbeit an
/// der Oberfläche und für UI-Tests – nicht als zweite Implementierung der
/// Spielregeln. Die Punkteformel ist hier absichtlich dieselbe wie im
/// Server, damit die Anzeige im Prototyp stimmt.
actor MockAPI: DuelAPI {
    private var position = 0
    private var playerScore = 0
    private var opponentScore = 0

    private let questions: [MockQuestion] = MockQuestion.sample
    private let opponentTimings = [4_200, 6_800, 3_500, 9_100, 5_400]
    private let opponentCorrect = [true, false, true, true, false]

    func startMatch(timezone: String) async throws -> StartMatchResponse {
        position = 0
        playerScore = 0
        opponentScore = 0

        return StartMatchResponse(
            matchId: "mock-match",
            totalQuestions: questions.count,
            opponent: OpponentCard(
                name: "Trainingspartner",
                elo: 1180,
                league: "silber",
                country: nil,
                isPractice: true
            ),
            question: served(at: 0)
        )
    }

    func submitAnswer(matchId: String, position index: Int, chosen: Int?) async throws -> AnswerResponse {
        let question = questions[index]
        let elapsed = Int.random(in: 1_500...9_000)
        let isCorrect = chosen == question.correctIndex
        let points = isCorrect ? 100 + Int(100 * (12_000 - elapsed) / 12_000) : 0
        playerScore += points

        let opponentPoints = opponentCorrect[index]
            ? 100 + Int(100 * (12_000 - opponentTimings[index]) / 12_000)
            : 0
        opponentScore += opponentPoints

        position = index + 1

        return AnswerResponse(
            result: AnswerResult(
                correctIndex: question.correctIndex,
                isCorrect: isCorrect,
                points: points,
                elapsedMs: elapsed
            ),
            opponent: OpponentAnswer(
                isCorrect: opponentCorrect[index],
                points: opponentPoints,
                answerMs: opponentTimings[index]
            ),
            playerScore: playerScore,
            opponentScore: opponentScore,
            question: position < questions.count ? served(at: position) : nil
        )
    }

    func finishMatch(matchId: String) async throws -> MatchSummary {
        let outcome: MatchSummary.Outcome =
            playerScore > opponentScore ? .win
            : playerScore < opponentScore ? .loss
            : .draw
        let delta = outcome == .win ? 14 : outcome == .loss ? -12 : 1

        return MatchSummary(
            outcome: outcome,
            playerScore: playerScore,
            opponentScore: opponentScore,
            eloBefore: 1200,
            eloAfter: 1200 + delta,
            eloDelta: delta,
            league: "silber",
            streak: 3,
            wasPractice: true,
            rounds: (0..<questions.count).map {
                RoundSummary(position: $0, points: 0, isCorrect: opponentCorrect[$0])
            }
        )
    }

    private func served(at index: Int) -> ServedQuestion {
        let question = questions[index]
        return ServedQuestion(
            position: index,
            id: question.id,
            text: question.text,
            options: question.options,
            windowMs: 12_000,
            opponentAnswerMs: opponentTimings[index]
        )
    }
}

struct MockQuestion {
    let id: String
    let text: String
    let options: [String]
    let correctIndex: Int

    static let sample: [MockQuestion] = [
        .init(id: "m1", text: "Wie heißt die Hauptstadt Australiens?",
              options: ["Sydney", "Melbourne", "Canberra", "Perth"], correctIndex: 2),
        .init(id: "m2", text: "Welches chemische Symbol steht für Gold?",
              options: ["Ag", "Au", "Go", "Gd"], correctIndex: 1),
        .init(id: "m3", text: "In welchem Jahr fiel die Berliner Mauer?",
              options: ["1987", "1989", "1990", "1991"], correctIndex: 1),
        .init(id: "m4", text: "Wer malte die Mona Lisa?",
              options: ["Michelangelo", "Raffael", "Leonardo da Vinci", "Botticelli"], correctIndex: 2),
        .init(id: "m5", text: "Welcher Planet ist der Sonne am nächsten?",
              options: ["Venus", "Merkur", "Mars", "Erde"], correctIndex: 1),
    ]
}
