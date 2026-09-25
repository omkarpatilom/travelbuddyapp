import {
  resolveUpload,
  toAbsoluteApiUrl,
  verificationService,
  DocumentValidationError,
  MAX_DOCUMENT_BYTES,
} from '@/services/verification.service';
import { api } from '@/utils/api';

jest.mock('@/utils/api', () => ({
  API_BASE_URL: 'https://gateway.example/api/v1',
  api: { get: jest.fn(), post: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('resolveUpload', () => {
  it('keeps a supported file name and derives the content type from the extension', () => {
    expect(resolveUpload('license', { uri: 'file:///x/scan.PDF', name: 'scan.PDF', mimeType: 'application/octet-stream' }))
      .toEqual({ uri: 'file:///x/scan.PDF', name: 'scan.pdf', type: 'application/pdf' });
  });

  it('infers the extension from the MIME type when the name has none', () => {
    expect(resolveUpload('aadhar', { uri: 'content://media/123', name: 'IMG_0042', mimeType: 'image/png' }))
      .toEqual({ uri: 'content://media/123', name: 'IMG_0042.png', type: 'image/png' });
  });

  it('falls back to the URI extension and the document type as name', () => {
    expect(resolveUpload('vehicle-rc', { uri: 'file:///cache/abc.jpeg' }))
      .toEqual({ uri: 'file:///cache/abc.jpeg', name: 'vehicle-rc.jpeg', type: 'image/jpeg' });
  });

  it.each([
    ['contract.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['photo.heic', 'image/heic'],
    ['anim.gif', 'image/gif'],
  ])('rejects unsupported format %s', (name, mimeType) => {
    expect(() => resolveUpload('license', { uri: `file:///${name}`, name, mimeType })).toThrow(DocumentValidationError);
  });

  it('rejects files over the server limit', () => {
    expect(() => resolveUpload('license', { uri: 'file:///a.pdf', name: 'a.pdf', size: MAX_DOCUMENT_BYTES + 1 }))
      .toThrow(/limit is 10 MB/);
  });
});

describe('toAbsoluteApiUrl', () => {
  it('joins the gateway origin with an absolute API path', () => {
    expect(toAbsoluteApiUrl('/api/v1/Verification/documents/1/content?exp=1&sig=a', 'http://10.0.0.5:5000/api/v1'))
      .toBe('http://10.0.0.5:5000/api/v1/Verification/documents/1/content?exp=1&sig=a');
  });
});

describe('verificationService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uploads a validated multipart file to the typed endpoint', async () => {
    mockedApi.post.mockResolvedValue({ documentId: 'd1', status: 'Pending', version: 2 });

    await verificationService.upload('vehicle-rc', { uri: 'file:///rc.png', name: 'rc.png', mimeType: 'image/png' });

    const [endpoint, body] = mockedApi.post.mock.calls[0];
    expect(endpoint).toBe('/Verification/vehicle-rc');
    expect(body).toBeInstanceOf(FormData);
  });

  it('does not call the API for an invalid file', async () => {
    await expect(verificationService.upload('license', { uri: 'file:///a.docx', name: 'a.docx' }))
      .rejects.toBeInstanceOf(DocumentValidationError);
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('turns a signed path into an absolute viewable URL', async () => {
    mockedApi.get.mockResolvedValue({ path: '/api/v1/Verification/documents/d1/content?exp=9&sig=s', expiresAt: '' });

    await expect(verificationService.getViewUrl('d1'))
      .resolves.toBe('https://gateway.example/api/v1/Verification/documents/d1/content?exp=9&sig=s');
    expect(mockedApi.get).toHaveBeenCalledWith('/Verification/documents/d1/signed-url');
  });
});
