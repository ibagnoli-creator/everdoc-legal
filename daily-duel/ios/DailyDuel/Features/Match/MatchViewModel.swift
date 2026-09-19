import Foundation
import Observation

/// Zustand eines laufenden Duells.
///
/// Der Ablauf ist bewusst eine Zustandsmaschine und kein Sack aus Booleans:
/// Antwort, Auflösung und nächste Frage überlappen sich zeitlich, und genau
/// da entstehen sonst Doppelantworten und verlorene Runden.
@MainActor
@Observable
final class MatchViewModel {
    enum Phase: Equatable {
        case idle
        case loading
        /// Frage läuft, Uhr tickt.
        case asking
        /// Antwort ist raus, Auflösung wird gezeigt.
        case revealing(chosen: Int?, correct: Int)
        case finished(MatchSummary)
        case failed(String)
    }

    private(set) var phase: Phase = .idle
    private(set) var opponent: OpponentCard?
    private(set) var question: ServedQuestion?
    private(set) var totalQuestions = 5
    private(set) var playerScore = 0
    private(set) var opponentScore = 0
    private(set) var lastPoints = 0

    /// Verstrichene Zeit der laufenden Frage, für Countdown und Gegnerbalken.
    private(set) var elapsed: Duration = .zero
    /// Ob der Gegner auf die laufende Frage schon geantwortet hat.
    private(set) var opponentHasAnswered = false

    private let api: DuelAPI
    private var matchId: String?
    private var clock: Task<Void, Never>?

    /// Verhindert, dass ein Tippen kurz vor Ablauf und der Timer beide
    /// antworten.
    private var isSubmitting = false

    init(api: DuelAPI) {
        self.api = api
    }

    deinit {
        clock?.cancel()
    }

    // MARK: - Ablauf

    func start() async {
        guard phase == .idle || isFailed else { return }
        phase = .loading

        do {
            let response = try await api.startMatch(
                timezone: TimeZone.current.identifier
            )
            matchId = response.matchId
            opponent = response.opponent
            totalQuestions = response.totalQuestions
            playerScore = 0
            opponentScore = 0
            present(response.question)
        } catch let error as DuelError {
            phase = .failed(error.userMessage)
        } catch {
            phase = .failed(DuelError.offline.userMessage)
        }
    }

    func choose(_ option: Int) async {
        guard case .asking = phase else { return }
        await submit(option)
    }

    /// Zeitablauf. Wird vom Countdown aufgerufen und zählt als Fehlversuch.
    private func timeOut() async {
        guard case .asking = phase else { return }
        await submit(nil)
    }

    private func submit(_ chosen: Int?) async {
        guard !isSubmitting, let matchId, let question else { return }
        isSubmitting = true
        stopClock()
        defer { isSubmitting = false }

        do {
            let response = try await api.submitAnswer(
                matchId: matchId,
                position: question.position,
                chosen: chosen
            )

            playerScore = response.playerScore
            opponentScore = response.opponentScore
            lastPoints = response.result.points
            phase = .revealing(chosen: chosen, correct: response.result.correctIndex)

            // Auflösung stehen lassen, bevor die nächste Frage kommt: ohne
            // diese Pause weiß niemand, ob er richtig lag.
            try? await Task.sleep(for: .milliseconds(1_400))

            if let next = response.question {
                present(next)
            } else {
                await finish()
            }
        } catch let error as DuelError {
            phase = .failed(error.userMessage)
        } catch {
            phase = .failed(DuelError.offline.userMessage)
        }
    }

    private func finish() async {
        guard let matchId else { return }
        do {
            phase = .finished(try await api.finishMatch(matchId: matchId))
        } catch let error as DuelError {
            phase = .failed(error.userMessage)
        } catch {
            phase = .failed(DuelError.offline.userMessage)
        }
    }

    // MARK: - Uhr

    private func present(_ next: ServedQuestion) {
        question = next
        elapsed = .zero
        opponentHasAnswered = false
        phase = .asking
        startClock(window: next.window, opponentAt: .milliseconds(next.opponentAnswerMs))
    }

    /// Eigene Uhr statt eines Timers auf der Serverzeit: der Server hat mit
    /// `served_at` bereits die verbindliche Messung. Diese hier treibt nur
    /// die Anzeige – und den Zeitablauf, falls niemand tippt.
    private func startClock(window: Duration, opponentAt: Duration) {
        stopClock()
        let tick = Duration.milliseconds(50)

        clock = Task { [weak self] in
            var passed = Duration.zero
            while !Task.isCancelled && passed < window {
                try? await Task.sleep(for: tick)
                passed += tick

                guard let self else { return }
                self.elapsed = passed
                if passed >= opponentAt {
                    self.opponentHasAnswered = true
                }
            }

            guard !Task.isCancelled else { return }
            await self?.timeOut()
        }
    }

    private func stopClock() {
        clock?.cancel()
        clock = nil
    }

    // MARK: - Abgeleitet

    var remaining: Duration {
        guard let window = question?.window else { return .zero }
        return max(.zero, window - elapsed)
    }

    var progress: Double {
        guard let window = question?.window, window > .zero else { return 0 }
        return min(1, elapsed.seconds / window.seconds)
    }

    var questionNumber: Int { (question?.position ?? 0) + 1 }

    private var isFailed: Bool {
        if case .failed = phase { return true }
        return false
    }
}

extension Duration {
    /// Sekunden als Fließkommazahl. `Duration` lässt sich nicht durch
    /// `Duration` teilen, für Fortschrittsbalken braucht es aber ein
    /// Verhältnis.
    var seconds: Double {
        let (whole, attoseconds) = components
        return Double(whole) + Double(attoseconds) / 1e18
    }
}
