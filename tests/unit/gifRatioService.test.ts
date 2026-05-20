import assert from "node:assert/strict";
import test from "node:test";
import { createGifRatioService } from "../../src/services/gifRatioService";

test("gifRatioService aplica a proporcao progressiva por quantidade aprovada", () => {
  const service = createGifRatioService();
  const cases = [
    { count: 0, databaseRatio: 0.65, giphyRatio: 0.35 },
    { count: 19, databaseRatio: 0.65, giphyRatio: 0.35 },
    { count: 20, databaseRatio: 0.7, giphyRatio: 0.3 },
    { count: 49, databaseRatio: 0.7, giphyRatio: 0.3 },
    { count: 50, databaseRatio: 0.75, giphyRatio: 0.25 },
    { count: 99, databaseRatio: 0.75, giphyRatio: 0.25 },
    { count: 100, databaseRatio: 0.8, giphyRatio: 0.2 },
    { count: 199, databaseRatio: 0.8, giphyRatio: 0.2 },
    { count: 200, databaseRatio: 0.85, giphyRatio: 0.15 }
  ];

  for (const item of cases) {
    const ratio = service.getRatioForApprovedCount(item.count);

    assert.equal(ratio.databaseRatio, item.databaseRatio);
    assert.equal(ratio.giphyRatio, item.giphyRatio);
  }
});
