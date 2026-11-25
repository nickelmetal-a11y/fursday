let mockNative = false;
let mockGetPhoto;

jest.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mockNative } }));
jest.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: (...args) => mockGetPhoto(...args) },
  CameraResultType: { Uri: 'uri' },
  CameraSource: { Prompt: 'PROMPT', Camera: 'CAMERA' },
}));

const { choosePhoto } = require('./photoPicker');

beforeEach(() => {
  mockNative = false;
  mockGetPhoto = () => Promise.resolve({ webPath: 'capacitor://localhost/_capacitor_file_/x.jpeg', format: 'jpeg' });
  global.fetch = () => Promise.resolve({ blob: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })) });
  window.alert = jest.fn();
});

test('on the web it opens the hidden file input', async () => {
  const click = jest.fn();
  const onChange = jest.fn();
  await choosePhoto({ current: { click } }, onChange);
  expect(click).toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});

test('on native it uses the camera plugin and passes a File to the same handler', async () => {
  mockNative = true;
  let sourceUsed;
  mockGetPhoto = (opts) => { sourceUsed = opts.source; return Promise.resolve({ webPath: 'x', format: 'jpeg' }); };
  const click = jest.fn();
  const onChange = jest.fn();
  await choosePhoto({ current: { click } }, onChange);
  expect(click).not.toHaveBeenCalled();
  expect(sourceUsed).toBe('PROMPT');
  const file = onChange.mock.calls[0][0].target.files[0];
  expect(file).toBeInstanceOf(File);
  expect(file.type).toBe('image/jpeg');
});

test('cameraOnly opens the camera directly', async () => {
  mockNative = true;
  let sourceUsed;
  mockGetPhoto = (opts) => { sourceUsed = opts.source; return Promise.resolve({ webPath: 'x' }); };
  await choosePhoto({ current: null }, jest.fn(), { cameraOnly: true });
  expect(sourceUsed).toBe('CAMERA');
});

test('cancelling is silent; a permission failure tells the user', async () => {
  mockNative = true;
  mockGetPhoto = () => Promise.reject(new Error('User cancelled photos app'));
  await choosePhoto({ current: null }, jest.fn());
  expect(window.alert).not.toHaveBeenCalled();

  mockGetPhoto = () => Promise.reject(new Error('User denied access to camera'));
  await choosePhoto({ current: null }, jest.fn());
  expect(window.alert).toHaveBeenCalled();
});
