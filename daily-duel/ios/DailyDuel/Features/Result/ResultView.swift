import SwiftUI

/// Ergebnisbildschirm.
///
/// Drei Aufgaben, in dieser Reihenfolge: das Ergebnis zeigen, den
/// Elo-Fortschritt sichtbar machen, und einen Grund geben, morgen
/// wiederzukommen. Der Teilen-Knopf ist der einzige organische
/// Wachstumskanal des Spiels – er steht deshalb über dem zweiten Duell.
struct ResultView: View {
    let summary: MatchSummary

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 28) {
            Spacer(minLength: 0)

            VStack(spacing: 8) {
                Text(summary.outcome.headline)
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(tint)

                Text("\(summary.playerScore) : \(summary.opponentScore)")
                    .font(.system(size: 44, weight: .semibold, design: .rounded))
                    .monospacedDigit()
            }

            eloRow

            if summary.streak > 1 {
                Label("\(summary.streak) Tage in Folge", systemImage: "flame.fill")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.orange)
            }

            if summary.wasPractice {
                Text("Übungsduell – zählt für deine Wertung.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)

            ShareLink(item: shareText) {
                Label("Ergebnis teilen", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(.borderedProminent)

            Text("Dein nächstes Duell wartet morgen.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(24)
    }

    private var eloRow: some View {
        HStack(spacing: 16) {
            Text("\(summary.eloBefore)")
                .foregroundStyle(.secondary)

            Image(systemName: summary.eloDelta >= 0 ? "arrow.up.right" : "arrow.down.right")
                .foregroundStyle(.secondary)

            Text("\(summary.eloAfter)")
                .font(.title3.weight(.semibold))

            Text(deltaLabel)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(summary.eloDelta >= 0 ? .green : .red)
        }
        .monospacedDigit()
        .padding(.vertical, 12)
        .padding(.horizontal, 20)
        .background(Color(.secondarySystemGroupedBackground), in: .capsule)
    }

    private var deltaLabel: String {
        summary.eloDelta >= 0 ? "+\(summary.eloDelta)" : "\(summary.eloDelta)"
    }

    private var tint: Color {
        switch summary.outcome {
        case .win: .green
        case .draw: .secondary
        case .loss: .red
        }
    }

    /// Bewusst ohne Fragen oder Antworten: geteilte Lösungen entwerten das
    /// Tagesduell für alle, die es noch vor sich haben.
    private var shareText: String {
        """
        Daily Duel – \(summary.outcome.headline) mit \(summary.playerScore):\(summary.opponentScore)
        Elo \(summary.eloAfter) (\(deltaLabel))
        Schaffst du mehr?
        """
    }
}

#Preview {
    ResultView(summary: MatchSummary(
        outcome: .win,
        playerScore: 742,
        opponentScore: 618,
        eloBefore: 1200,
        eloAfter: 1214,
        eloDelta: 14,
        league: "silber",
        streak: 4,
        wasPractice: true,
        rounds: []
    ))
}
