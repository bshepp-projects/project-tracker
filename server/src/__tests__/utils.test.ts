import path from 'path';
import { shouldSkipDirectory, isPathWithinScanDirs, isAllowedOrigin } from '../utils';

describe('shouldSkipDirectory', () => {
  it('skips Windows system / temp directories', () => {
    expect(shouldSkipDirectory('$RECYCLE.BIN')).toBe(true);
    expect(shouldSkipDirectory('System Volume Information')).toBe(true);
    expect(shouldSkipDirectory('$Temp123')).toBe(true);
    expect(shouldSkipDirectory('build.tmp')).toBe(true);
  });

  it('skips dot directories except .claude', () => {
    expect(shouldSkipDirectory('.git')).toBe(true);
    expect(shouldSkipDirectory('.vscode')).toBe(true);
    expect(shouldSkipDirectory('.claude')).toBe(false);
  });

  it('does not skip normal project directories', () => {
    expect(shouldSkipDirectory('my-project')).toBe(false);
    expect(shouldSkipDirectory('claude-tracker')).toBe(false);
  });
});

describe('isPathWithinScanDirs', () => {
  const scanDirs = [path.resolve('/scan/root'), path.resolve('/other/area')];

  it('allows a configured scan directory itself', () => {
    expect(isPathWithinScanDirs(path.resolve('/scan/root'), scanDirs)).toBe(true);
  });

  it('allows a path nested inside a scan directory', () => {
    expect(isPathWithinScanDirs(path.resolve('/scan/root/sub/proj'), scanDirs)).toBe(true);
  });

  it('rejects a sibling that merely shares a prefix', () => {
    expect(isPathWithinScanDirs(path.resolve('/scan/rootx'), scanDirs)).toBe(false);
  });

  it('rejects an unrelated absolute path', () => {
    expect(isPathWithinScanDirs(path.resolve('/etc/passwd'), scanDirs)).toBe(false);
  });

  it('rejects traversal that escapes the scan directory', () => {
    expect(isPathWithinScanDirs(path.resolve('/scan/root/../../etc/passwd'), scanDirs)).toBe(false);
  });

  it('rejects everything when no scan directories are configured', () => {
    expect(isPathWithinScanDirs(path.resolve('/scan/root'), [])).toBe(false);
  });
});

describe('isAllowedOrigin', () => {
  it('allows requests with no Origin (curl, same-origin, server-to-server)', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it('allows the null origin (file:// pages — the documented workflow)', () => {
    expect(isAllowedOrigin('null')).toBe(true);
  });

  it('allows localhost / 127.0.0.1 origins on any port', () => {
    expect(isAllowedOrigin('http://localhost:3001')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:5500')).toBe(true);
  });

  it('rejects arbitrary external origins', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
    expect(isAllowedOrigin('http://localhost.evil.com')).toBe(false);
  });
});
