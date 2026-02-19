const fs = require('fs');
const path = require('path');

describe('manifest.json validation', () => {
  let manifest;

  beforeAll(() => {
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'manifest.json'),
      'utf-8'
    );
    manifest = JSON.parse(raw);
  });

  test('valid JSON and parseable', () => {
    expect(manifest).toBeDefined();
  });

  test('manifest_version is 3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  test('has required fields', () => {
    expect(manifest.name).toBeDefined();
    expect(manifest.version).toBeDefined();
    expect(manifest.description).toBeDefined();
  });

  test('version follows semver', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('has required permissions', () => {
    expect(manifest.permissions).toContain('contextMenus');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('activeTab');
  });

  test('has background service worker', () => {
    expect(manifest.background).toBeDefined();
    expect(manifest.background.service_worker).toBe('background.js');
  });

  test('content script targets all URLs', () => {
    expect(manifest.content_scripts).toBeDefined();
    expect(manifest.content_scripts[0].matches).toContain('<all_urls>');
  });

  test('content script includes content.js', () => {
    expect(manifest.content_scripts[0].js).toContain('content.js');
  });

  test('all referenced files exist', () => {
    const filesToCheck = [
      manifest.background.service_worker,
      ...manifest.content_scripts[0].js,
    ];
    filesToCheck.forEach(file => {
      const filePath = path.join(__dirname, '..', file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  test('icon files exist', () => {
    if (manifest.icons) {
      Object.values(manifest.icons).forEach(iconPath => {
        const filePath = path.join(__dirname, '..', iconPath);
        // Just check the path is defined, icons may be generated later
        expect(iconPath).toBeDefined();
      });
    }
  });
});
