export const SETTINGS_SCHEMA = [
  { key: 'url', label: 'Web-App-URL (Apps Script)', type: 'text', default: '', max: 300,
    pattern: /^https:\/\/\S+$/, patternMessage: 'Die URL muss mit https:// beginnen.' },
  { key: 'token', label: 'Zugriffs-Token', type: 'text', secret: true, default: '', max: 200 },
];

export const isConfigured = (settings) => !!settings.url && !!settings.token;
