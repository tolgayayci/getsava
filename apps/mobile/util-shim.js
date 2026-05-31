// Minimal `util` polyfill for React Native (eventsource uses util.inherits).
// See metro.config.js.
function inherits(ctor, superCtor) {
  if (superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: { value: ctor, enumerable: false, writable: true, configurable: true },
    });
  }
}

const deprecate = (fn) => fn;
const debuglog = () => () => {};

module.exports = { inherits, deprecate, debuglog };
