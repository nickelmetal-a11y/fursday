// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom doesn't implement Element.scrollIntoView (used by ChatScreen.js and
// anywhere else that auto-scrolls a list) — without this every such
// component throws on mount in tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Never let a test hit the real network (e.g. geolocationService's
// fetch('https://ipapi.co/json/')) — it has no real timeout and hangs
// the whole suite. Individual tests can override with their own mock.
// NOTE: only touch global.fetch here — a blanket jest.restoreAllMocks()/
// resetAllMocks() in afterEach also wipes out any jest.mock(...) factory
// a test file set up with .mockResolvedValue(...) at module scope, making
// it return undefined from the second test onward in that file.
const realFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
  );
});

afterEach(() => {
  global.fetch = realFetch;
});

// Scenario tests drive several screens per test; under a full parallel run the
// default 5s is too tight on this (cloud-synced) machine.
jest.setTimeout(20000);
