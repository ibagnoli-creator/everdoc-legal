import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bucketForElo,
  buildQuestionSet,
  targetPCorrect,
} from "../supabase/functions/_shared/sets.ts";
import type { PoolQuestion } from "../supabase/functions/_shared/sets.ts";

/** Pool mit gleichmässig verteilten Schwierigkeiten über vier Kategorien. */
function makePool(size: number): PoolQuestion[] {
  return Array.from({ length: size }, (_, i) => ({
    id: `q${i}`,
    categoryId: i % 4,
    pCorrect: 0.2 + (i / size) * 0.7,
  }));
}

describe("bucketForElo", () => {
  it("bildet die Elo-Spanne monoton ab", () => {
    const buckets = [800, 1150, 1300, 1500, 1800].map(bucketForElo);
    assert.deepEqual(buckets, [0, 1, 2, 3, 4]);
  });

  it("fängt Werte ausserhalb der üblichen Spanne ab", () => {
    assert.equal(bucketForElo(-100), 0);
    assert.equal(bucketForElo(99_999), 4);
  });
});

describe("targetPCorrect", () => {
  it("wird mit steigendem Bucket schwerer", () => {
    const targets = [0, 1, 2, 3, 4].map(targetPCorrect);
    for (let i = 1; i < targets.length; i++) {
      assert.ok(targets[i] < targets[i - 1]);
    }
  });
});

describe("buildQuestionSet", () => {
  const pool = makePool(200);

  it("liefert genau fünf verschiedene Fragen", () => {
    const set = buildQuestionSet(pool, 2, 42);
    assert.equal(set.length, 5);
    assert.equal(new Set(set).size, 5);
  });

  it("ist für denselben Seed reproduzierbar", () => {
    assert.deepEqual(buildQuestionSet(pool, 2, 7), buildQuestionSet(pool, 2, 7));
  });

  it("liefert für verschiedene Seeds verschiedene Sets", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seen.add(buildQuestionSet(pool, 2, seed).join(","));
    }
    // Ohne Streuung bekäme jeder Spieler eines Buckets dieselben Fragen.
    assert.ok(seen.size > 10, `nur ${seen.size} verschiedene Sets`);
  });

  it("trifft die Zielschwierigkeit des Buckets", () => {
    const byId = new Map(pool.map((q) => [q.id, q]));
    for (const bucket of [0, 2, 4]) {
      const set = buildQuestionSet(pool, bucket, 99);
      const mean =
        set.reduce((sum, id) => sum + (byId.get(id)!.pCorrect ?? 0.6), 0) / set.length;
      assert.ok(
        Math.abs(mean - targetPCorrect(bucket)) < 0.08,
        `Bucket ${bucket}: Ziel ${targetPCorrect(bucket)}, erreicht ${mean.toFixed(2)}`,
      );
    }
  });

  it("nimmt höchstens zwei Fragen je Kategorie, solange der Pool es hergibt", () => {
    for (let seed = 0; seed < 30; seed++) {
      const set = buildQuestionSet(pool, 2, seed);
      const perCategory = new Map<number, number>();
      for (const id of set) {
        const categoryId = pool.find((q) => q.id === id)!.categoryId;
        perCategory.set(categoryId, (perCategory.get(categoryId) ?? 0) + 1);
      }
      assert.ok(Math.max(...perCategory.values()) <= 2);
    }
  });

  it("behandelt Fragen ohne Statistik als mittelschwer", () => {
    const frisch: PoolQuestion[] = Array.from({ length: 10 }, (_, i) => ({
      id: `neu${i}`,
      categoryId: i % 4,
      pCorrect: null,
    }));
    assert.equal(buildQuestionSet(frisch, 2, 1).length, 5);
  });

  it("weigert sich, aus einem zu kleinen Pool ein Set zu bauen", () => {
    assert.throws(() => buildQuestionSet(makePool(3), 2, 1), /Fragenpool zu klein/);
  });

  it("liefert auch dann ein Set, wenn eine Kategorie den Pool dominiert", () => {
    const einseitig: PoolQuestion[] = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`,
      categoryId: 1,
      pCorrect: 0.6,
    }));
    assert.equal(buildQuestionSet(einseitig, 2, 5).length, 5);
  });
});
