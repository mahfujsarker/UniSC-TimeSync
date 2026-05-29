const { spawnSync } = require('child_process');
const path = require('path');

const controllerPath = path.join(__dirname, 'backend', 'controllers', 'timetableController.js');

const result = spawnSync(process.execPath, ['--check', controllerPath], {
  stdio: 'inherit',
});

process.exitCode = result.status ?? 1;
