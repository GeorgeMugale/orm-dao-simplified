"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityValidationError = void 0;
/**
 * Custom Error class thrown when an Entity fails its validation checks
 * (implemented in the Entity#validate hook).
 */
class EntityValidationError extends Error {
    constructor(msg) {
        super(msg ?? "The entity's state failed the validation checks");
        this.name = "EntityValidationError"; // Best practice for custom errors
    }
}
exports.EntityValidationError = EntityValidationError;
