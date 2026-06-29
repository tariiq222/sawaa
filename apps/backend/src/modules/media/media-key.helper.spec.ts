import { extractMediaKey } from './media-key.helper';

describe('extractMediaKey', () => {
  const bucket = 'sawaa-media';

  it('returns a bare object key unchanged', () => {
    const key = 'org-1/8f1c2d3e-4a5b-6789-abcd-ef0123456789.png';
    expect(extractMediaKey(key, bucket)).toBe(key);
  });

  it('strips scheme/host and the bucket segment from a full URL', () => {
    const url = `https://minio.example.com/${bucket}/org-1/abc.png`;
    expect(extractMediaKey(url, bucket)).toBe('org-1/abc.png');
  });

  it('strips the query string from a presigned URL', () => {
    const url =
      `https://minio.example.com/${bucket}/org-1/abc.png` +
      '?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=deadbeef';
    expect(extractMediaKey(url, bucket)).toBe('org-1/abc.png');
  });

  it('handles a full URL whose path does not start with the bucket segment', () => {
    // No bucket prefix in the path — keep the whole path as the key.
    const url = 'https://cdn.example.com/org-1/abc.png?X-Amz-Signature=zzz';
    expect(extractMediaKey(url, bucket)).toBe('org-1/abc.png');
  });

  it('handles a public-endpoint URL with an explicit port', () => {
    const url = `http://localhost:9000/${bucket}/org-1/abc.png`;
    expect(extractMediaKey(url, bucket)).toBe('org-1/abc.png');
  });

  it('returns the input unchanged when it is a malformed non-URL string', () => {
    expect(extractMediaKey('not a url', bucket)).toBe('not a url');
  });
});
