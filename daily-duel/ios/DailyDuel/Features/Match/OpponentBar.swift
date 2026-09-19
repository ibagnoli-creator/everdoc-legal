import SwiftUI

/// Gegnerkarte mit Punktestand.
///
/// `hasAnswered` ist der eigentliche Spannungsträger: sobald der Gegner in
/// seiner aufgezeichneten Spur geantwortet hat, springt die Anzeige um –
/// noch bevor feststeht, ob er richtig lag. Genau dieser Moment lässt
/// Leute schneller tippen.
struct OpponentBar: View {
    let opponent: OpponentCard
    let hasAnswered: Bool
    let score: Int
    let playerScore: Int

    var body: some View {
        HStack(spacing: 12) {
            scoreColumn(title: "Du", value: playerScore, alignment: .leading)

            VStack(spacing: 4) {
                Text(opponent.name)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)

                if opponent.isPractice {
                    // Übungsgegner werden benannt. Verdeckte Bots sind in
                    // Quiz-Apps ein verlässlicher Weg zu 1-Stern-Bewertungen.
                    Text("Übungsgegner")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(.tertiarySystemFill), in: .capsule)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Elo \(opponent.elo)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Text(hasAnswered ? "hat geantwortet" : "denkt nach …")
                    .font(.caption2)
                    .foregroundStyle(hasAnswered ? Color.orange : .secondary)
                    .contentTransition(.opacity)
            }
            .frame(maxWidth: .infinity)

            scoreColumn(title: opponent.name, value: score, alignment: .trailing)
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 16))
        .animation(.snappy, value: hasAnswered)
    }

    private func scoreColumn(
        title: String,
        value: Int,
        alignment: HorizontalAlignment
    ) -> some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Text("\(value)")
                .font(.title3.monospacedDigit().weight(.bold))
                .contentTransition(.numericText())
        }
        .frame(width: 64, alignment: alignment == .leading ? .leading : .trailing)
    }
}

#Preview {
    OpponentBar(
        opponent: OpponentCard(
            name: "Trainingspartner", elo: 1180,
            league: "silber", country: nil, isPractice: true
        ),
        hasAnswered: true,
        score: 340,
        playerScore: 420
    )
    .padding()
}
