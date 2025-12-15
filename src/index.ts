// --- Core Abstractions ---
export { default as Entity } from './entity.model.js';
export type { IEntity, IUpdateEntity } from './entity.model.js';
export { default as GenericDAO } from './GenericDAO.js';

// --- Types and Utilities ---
export * from './utils/types.js';

// --- Decorators and Errors ---
export * from './utils/type-decorators.js';

// --- Transaction Manager ---
export { runInTransaction } from './TransactionManager.js';