const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'node_modules', 'expo-av', 'expo-module.config.json');

if (!fs.existsSync(configPath)) {
  console.warn('[patch-expo-av-android] expo-av config not found, skipping');
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const androidModules = config.android?.modules;

if (!Array.isArray(androidModules)) {
  console.warn('[patch-expo-av-android] android.modules missing, skipping');
  process.exit(0);
}

const nextModules = androidModules.filter(moduleName => moduleName !== 'expo.modules.av.video.VideoViewModule');

if (nextModules.length === androidModules.length) {
  console.log('[patch-expo-av-android] expo-av Android video module already disabled');
  process.exit(0);
}

config.android.modules = nextModules;
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log('[patch-expo-av-android] disabled expo-av Android VideoViewModule');
