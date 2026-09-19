import SwiftUI

struct MatchView: View {
    @State private var model: MatchViewModel

    init(api: DuelAPI) {
        _model = State(initialValue: MatchViewModel(api: api))
    }

    var body: some View {
        ZStack {
            Color(.systemGroupedBackground).ignoresSafeArea()

            switch model.phase {
            case .idle, .loading:
                ProgressView("Gegner wird gesucht …")

            case .asking, .revealing:
                duel

            case let .finished(summary):
                ResultView(summary: summary)
                    .transition(.move(edge: .bottom).combined(with: .opacity))

            case let .failed(message):
                MessageView(message: message) {
                    Task { await model.start() }
                }
            }
        }
        .animation(.snappy, value: model.phase)
        .task { await model.start() }
    }

    private var duel: some View {
        VStack(spacing: 24) {
            header

            if let opponent = model.opponent {
                OpponentBar(
                    opponent: opponent,
                    hasAnswered: model.opponentHasAnswered,
                    score: model.opponentScore,
                    playerScore: model.playerScore
                )
            }

            Text(model.question?.text ?? "")
                .font(.title2.weight(.semibold))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.horizontal)
                // Feste Höhe: sonst springen die Antwortknöpfe je nach
                // Fragenlänge, und man tippt daneben.
                .frame(minHeight: 120, alignment: .center)

            answers

            Spacer(minLength: 0)
        }
        .padding()
    }

    private var header: some View {
        HStack {
            Text("Frage \(model.questionNumber) von \(model.totalQuestions)")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Spacer()

            CountdownRing(
                progress: model.progress,
                remaining: model.remaining
            )
            .frame(width: 44, height: 44)
        }
    }

    private var answers: some View {
        VStack(spacing: 12) {
            ForEach(Array((model.question?.options ?? []).enumerated()), id: \.offset) { index, option in
                Button {
                    Task { await model.choose(index) }
                } label: {
                    Text(option)
                        .font(.body.weight(.medium))
                        .frame(maxWidth: .infinity, minHeight: 56)
                }
                .buttonStyle(.plain)
                .background(background(for: index), in: .rect(cornerRadius: 14))
                .foregroundStyle(foreground(for: index))
                .disabled(isRevealing)
            }
        }
    }

    private var isRevealing: Bool {
        if case .revealing = model.phase { return true }
        return false
    }

    /// Während der Auflösung: richtig grün, die eigene falsche Wahl rot,
    /// alles andere bleibt neutral. Nur diese zwei Farben – mehr Signal
    /// macht die Auflösung unlesbar.
    private func background(for index: Int) -> Color {
        guard case let .revealing(chosen, correct) = model.phase else {
            return Color(.secondarySystemGroupedBackground)
        }
        if index == correct { return .green }
        if index == chosen { return .red }
        return Color(.secondarySystemGroupedBackground)
    }

    private func foreground(for index: Int) -> Color {
        guard case let .revealing(chosen, correct) = model.phase else { return .primary }
        return index == correct || index == chosen ? .white : .secondary
    }
}

/// Countdown als Ring. Läuft gegen den Uhrzeigersinn leer – bekannter aus
/// Quizshows als eine Zahl, die herunterzählt.
struct CountdownRing: View {
    let progress: Double
    let remaining: Duration

    private var isUrgent: Bool { remaining <= .seconds(3) }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color(.systemFill), lineWidth: 4)

            Circle()
                .trim(from: 0, to: 1 - progress)
                .stroke(
                    isUrgent ? Color.red : Color.accentColor,
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))

            Text("\(Int(remaining.seconds.rounded(.up)))")
                .font(.caption.monospacedDigit().weight(.semibold))
                .foregroundStyle(isUrgent ? .red : .primary)
        }
        .animation(.linear(duration: 0.05), value: progress)
    }
}

struct MessageView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Nochmal versuchen", action: retry)
                .buttonStyle(.borderedProminent)
        }
        .padding(32)
    }
}

#Preview {
    MatchView(api: MockAPI())
}
