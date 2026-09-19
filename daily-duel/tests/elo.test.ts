import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  eloDelta,
  expectedScore,
  kFactor,
  leagueFor,
  outcomeOf,
} from "../supabase/functions/_shared/elo.ts";

describe("expectedScore", () => {
  it("ist bei gleicher Wertung ausgeglichen", () => {
    assert.equal(expectedScore(1200, 1200), 0.5);
  });

  it("gibt 400 Punkten Vorsprung rund 91 Prozent", () => {
    assert.ok(Math.abs(expectedScore(1600, 1200) - 0.909) < 0.001);
  });

  it("ist symmetrisch", () => {
    assert.ok(
      Math.abs(expectedScore(1450, 1300) + expectedScore(1300, 1450) - 1) < 1e-12,
    );
  });
});

describe("kFactor", () => {
  it("bewegt neue Spieler schneller", () => {
    assert.equal(kFactor(0), 40);
    assert.equal(kFactor(19), 40);
    assert.equal(kFactor(20), 20);
  });
});

describe("outcomeOf", () => {
  it("wertet die höhere Punktzahl als Sieg", () => {
    assert.equal(outcomeOf(720, 540), "win");
    assert.equal(outcomeOf(540, 720), "loss");
    assert.equal(outcomeOf(600, 600), "draw");
  });
});

describe("eloDelta", () => {
  it("belohnt einen Sieg gegen einen stärkeren Gegner stärker", () => {
    const gegenStaerkeren = eloDelta({
      playerElo: 1200, opponentElo: 1600, matchesPlayed: 50, outcome: "win",
    });
    const gegenSchwaecheren = eloDelta({
      playerElo: 1200, opponentElo: 900, matchesPlayed: 50, outcome: "win",
    });
    assert.ok(gegenStaerkeren > gegenSchwaecheren);
    assert.equal(gegenStaerkeren, 18);
    assert.equal(gegenSchwaecheren, 3);
  });

  it("bestraft eine Niederlage gegen einen schwächeren Gegner stärker", () => {
    const delta = eloDelta({
      playerElo: 1600, opponentElo: 1200, matchesPlayed: 50, outcome: "loss",
    });
    assert.equal(delta, -18);
  });

  it("ist bei gleichstarken Gegnern ein Nullsummenspiel", () => {
    const sieger = eloDelta({
      playerElo: 1300, opponentElo: 1300, matchesPlayed: 50, outcome: "win",
    });
    const verlierer = eloDelta({
      playerElo: 1300, opponentElo: 1300, matchesPlayed: 50, outcome: "loss",
    });
    assert.equal(sieger + verlierer, 0);
  });

  it("lässt ein Remis zwischen Gleichstarken die Wertung unverändert", () => {
    assert.equal(
      eloDelta({ playerElo: 1200, opponentElo: 1200, matchesPlayed: 3, outcome: "draw" }),
      0,
    );
  });
});

describe("leagueFor", () => {
  it("ordnet die Startwertung Silber zu", () => {
    assert.equal(leagueFor(1200), "silber");
  });

  it("deckt die Ränder ab", () => {
    assert.equal(leagueFor(0), "bronze");
    assert.equal(leagueFor(1100), "silber");
    assert.equal(leagueFor(1700), "diamant");
    assert.equal(leagueFor(9999), "diamant");
  });
});
