const { open, sample, stateWith, wait } = require('../lib/harness');

// a pretend Screen Wake Lock that records what the app asks for
const fakeWakeLock = (fail = false) => w => {
  w.wakeLog = [];
  w.navigator.wakeLock = {
    request: async type => {
      if (fail) throw new Error('not allowed');
      const listeners = [];
      const lock = {
        type, released: false,
        addEventListener: (ev, fn) => { if (ev === 'release') listeners.push(fn); },
        release: async () => { if (!lock.released) { lock.released = true; w.wakeLog.push('release'); listeners.forEach(f => f()); } },
      };
      w.wakeLog.push('request:' + type);
      w.lastLock = lock;
      return lock;
    },
  };
};
// the browser hides or shows the page (switching apps, locking the phone)
const setVisible = (a, visible) => {
  Object.defineProperty(a.document, 'visibilityState', { configurable: true, get: () => visible ? 'visible' : 'hidden' });
  if (!visible && a.window.lastLock) a.window.lastLock.release();   // the browser drops the lock itself when hidden
  a.document.dispatchEvent(new a.window.Event('visibilitychange'));
};

exports.run = async t => {
  // off by default: the option is in the menu, switched off, and nothing is requested
  let a = await open({ state: stateWith([sample()]), before: fakeWakeLock() });
  a.ev("go('bill')");
  t.eq('nothing asked for on start', a.window.wakeLog, []);
  a.act('menu');
  t.check('option is in the menu', !!a.$('[data-act="keep-awake"]'));
  t.eq('shown as off', a.$('[data-act="keep-awake"]').getAttribute('aria-checked'), 'false');

  // switching it on
  a.act('keep-awake');
  await wait(10);
  t.eq('setting saved', a.saved().keepAwake, true);
  t.eq('screen lock requested', a.window.wakeLog, ['request:screen']);
  t.eq('menu closes', a.ev('ui.menu'), false);
  t.eq('message', a.text('#toast'), 'Screen will stay on');
  a.act('menu');
  t.eq('shown as on', a.$('[data-act="keep-awake"]').getAttribute('aria-checked'), 'true');
  t.check('switch drawn on', a.$('[data-act="keep-awake"] .sw').classList.contains('on'));
  a.act('menu-close');

  // backgrounded: the lock goes; back on screen: it comes back
  setVisible(a, false);
  await wait(10);
  t.eq('released when the app is hidden', a.window.wakeLog, ['request:screen', 'release']);
  t.eq('not re-requested while hidden', a.window.wakeLog.filter(x => x.startsWith('request')).length, 1);
  setVisible(a, true);
  await wait(10);
  t.eq('requested again when back on screen', a.window.wakeLog, ['request:screen', 'release', 'request:screen']);

  // switching it off
  a.act('menu'); a.act('keep-awake');
  await wait(10);
  t.eq('setting saved off', a.saved().keepAwake, false);
  t.eq('lock released', a.window.wakeLog.slice(-1), ['release']);
  t.eq('message off', a.text('#toast'), 'Screen can sleep again');
  setVisible(a, false); setVisible(a, true);
  await wait(10);
  t.eq('off: nothing requested when back on screen', a.window.wakeLog.filter(x => x.startsWith('request')).length, 2);
  t.eq('no errors', a.errors, []);
  a.close();

  // remembered: opening the app with it on asks for the lock straight away
  a = await open({ state: Object.assign(stateWith([sample()]), { keepAwake: true }), before: fakeWakeLock() });
  await wait(10);
  t.eq('on at start-up when saved on', a.window.wakeLog, ['request:screen']);
  a.close();

  // the phone refuses (e.g. battery saver)
  a = await open({ state: stateWith([sample()]), before: fakeWakeLock(true) });
  a.ev("go('bill')");
  a.act('menu'); a.act('keep-awake');
  await wait(10);
  t.eq('says it could not', a.text('#toast'), "Couldn't keep the screen on");
  t.eq('no errors when refused', a.errors, []);
  a.close();

  // browsers without wake lock: the option is not shown
  a = await open({ state: stateWith([sample()]), before: w => { delete w.navigator.wakeLock; } });
  a.ev("go('bill')");
  a.act('menu');
  t.check('hidden where not supported', !a.$('[data-act="keep-awake"]'));
  a.close();
};
