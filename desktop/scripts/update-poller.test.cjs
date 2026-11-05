const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUpdatePoller } = require('../update/poller.cjs');

function fixture(check) {
  let now = 0, id = 0;
  const timers = new Map();
  const poller = createUpdatePoller({
    check, now: () => now,
    setTimer(fn, delay) { const timer = { id: ++id, unref() {} }; timers.set(timer, { at: now + delay, fn }); return timer; },
    clearTimer(timer) { timers.delete(timer); },
  });
  return {
    poller, timers,
    async advance(ms) {
      now += ms;
      for (const [timer, value] of [...timers]) if (value.at <= now) { timers.delete(timer); await value.fn(); }
    },
  };
}
test('startup then minute polling continue without reload, and start is idempotent', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; });
  f.poller.start(); f.poller.start();
  await f.advance(4999); assert.equal(calls, 0);
  await f.advance(1); assert.equal(calls, 1);
  await f.advance(60000); assert.equal(calls, 2);
  await f.advance(60000); assert.equal(calls, 3);
  f.poller.dispose(); await f.advance(60000); assert.equal(calls, 3);
});
test('focus is throttled; wake/online can force a check; checks coalesce', async () => {
  let calls = 0, release;
  const f = fixture(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  f.poller.start();
  const first = f.poller.trigger();
  await Promise.resolve();
  assert.equal(f.poller.trigger({ force: true }), first);
  release(); await first;
  await f.poller.trigger(); assert.equal(calls, 1);
  // A throttled startup timer must reschedule rather than stop polling.
  const advancing = f.advance(15000);
  await Promise.resolve();
  assert.equal(calls, 2);
  release(); await advancing;
  const forced = f.poller.trigger({ force: true }); await Promise.resolve();
  assert.equal(calls, 3); release(); await forced;
  f.poller.dispose();
});
test('errors retry later and disposing an in-flight check cannot restart timers', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; throw Error('offline'); });
  f.poller.start(); await f.advance(5000); await f.advance(60000);
  assert.equal(calls, 2); f.poller.dispose(); assert.equal(f.timers.size, 0);
  let release;
  const g = fixture(() => new Promise(resolve => { release = resolve; }));
  g.poller.start(); const pending = g.poller.trigger(); await Promise.resolve();
  g.poller.dispose(); release(); await pending; assert.equal(g.timers.size, 0);
});
