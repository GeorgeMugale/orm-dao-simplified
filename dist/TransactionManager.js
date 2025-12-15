"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInTransaction = runInTransaction;
/**
 * Executes a callback function within a database transaction.
 * All DAO operations performed inside the callback using the provided DAOs
 * will be atomic (either all succeed and commit, or any failure causes a rollback).
 *
 * @param pool The main MySQL connection pool.
 * @param callback The function to execute inside the transaction.
 * @returns The return value of the callback function.
 */
async function runInTransaction(pool, callback) {
    let connection = null;
    try {
        // Get a connection from the pool
        connection = await pool.getConnection();
        // Start the transaction
        await connection.beginTransaction();
        // Execute the user's logic, passing the transaction connection
        const result = await callback(connection);
        // Commit the transaction if the callback succeeded
        await connection.commit();
        return result;
    }
    catch (error) {
        // Rollback if any error occurred
        if (connection) {
            await connection.rollback();
        }
        // Re-throw the error for the caller to handle
        throw error;
    }
    finally {
        // Release the connection back to the pool
        if (connection) {
            connection.release();
        }
    }
}
