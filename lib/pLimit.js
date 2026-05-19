/**
 * Minimal concurrency limiter for batching async operations.
 * 
 * Unlike Promise.all (which fires ALL at once and will get you banned by Binance),
 * this executes at most `concurrency` tasks in parallel, queuing the rest.
 * 
 * @param {Array<() => Promise>} fns          Array of zero-argument async functions.
 * @param {number}               concurrency  Max simultaneous executions.
 * @returns {Promise<Array>}     Settled results in original order.
 */
export async function pLimit(fns, concurrency = 5) {
  const results = [];
  const executing = new Set();

  for (const fn of fns) {
    const p = Promise.resolve()
      .then(fn)
      .finally(() => executing.delete(p));

    results.push(p);
    executing.add(p);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}
