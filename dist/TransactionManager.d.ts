import { Pool, PoolConnection } from "mysql2/promise";
/**
 * Executes a callback function within a database transaction.
 * All DAO operations performed inside the callback using the provided DAOs
 * will be atomic (either all succeed and commit, or any failure causes a rollback).
 *
 * @param pool The main MySQL connection pool.
 * @param callback The function to execute inside the transaction.
 * @returns The return value of the callback function.
 */
export declare function runInTransaction<T>(pool: Pool, callback: (connection: PoolConnection) => Promise<T>): Promise<T>;
