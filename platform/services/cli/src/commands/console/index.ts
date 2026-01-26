// Primary exports (new names)
export { consoleInitCommand, deleteAdminImages, type ConsoleInitOptions } from './init.js';
export { consoleServiceCommand, deleteAdminImages as deleteConsoleImages, type ConsoleServiceOptions } from './service.js';
export { consoleUserCommand, type ConsoleUserCommandOptions } from './user.js';
export { consoleApiCommand, type ConsoleApiCommandOptions } from './api.js';

// Backward compatibility aliases (deprecated)
export { adminInitCommand, type AdminInitOptions } from './init.js';
export { adminServiceCommand, type AdminServiceOptions } from './service.js';
export { adminUserCommand, type AdminUserCommandOptions } from './user.js';
export { adminApiCommand, type AdminApiCommandOptions } from './api.js';
