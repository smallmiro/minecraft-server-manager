/**
 * Infrastructure Layer
 * Adapters for external systems (shell, repositories, docs)
 */

export * from './adapters/index.js';
export * from './config/index.js';
export { resolveHostIps, resolveHostIpsAsync, type HostIpProbes, type AsyncHostIpProbes } from './hostIps.js';
