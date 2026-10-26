// Main-process timers keep checking while the renderer is hidden or throttled.
function createUpdatePoller({ check, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer, running, started = false, disposed = false, lastAttempt = -Infinity;
  function schedule(delay) {
    clearTimer(timer);
    if (started && !disposed) { timer = setTimer(() => trigger().catch(() => {}), delay); timer.unref?.(); }
  }
  function trigger({ force = false } = {}) {
    if (disposed) return Promise.resolve();
    if (running) return running;
    if (!force && now() - lastAttempt < 15000) { schedule(15000 - (now() - lastAttempt)); return Promise.resolve(); }
    lastAttempt = now();
    clearTimer(timer);
    running = Promise.resolve().then(check).finally(() => {
      running = null;
      schedule(60000);
    });
    return running;
  }
  return {
    start() { if (!started && !disposed) { started = true; schedule(5000); } },
    trigger,
    dispose() { disposed = true; clearTimer(timer); },
  };
}
module.exports = { createUpdatePoller };
