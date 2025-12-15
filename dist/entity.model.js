"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const type_decorators_js_1 = require("./utils/type-decorators.js"); // Assuming it's in a separate file
const types_js_1 = require("./utils/types.js");
class Entity {
    /**
     * Initializes a new Entity instance.
     * 1. **Assigns Attributes:** Calls {@link Entity#init} to set property values and perform type conversions.
     * 2. **Validates State:** Calls {@link Entity#validate} to run integrity checks.
     * * @param attributes The raw data used to initialize the entity, typically from a database record.
     * @throws {EntityValidationError} If the validation hook returns a string error message (i.e., the entity is invalid).
     * @see Entity#init
     * @see Entity#validate
     */
    constructor(attributes = {}) {
        this.init(attributes);
        // Call validate and store the result (which is either 'true' or a string error message)
        const validationResult = this.validate();
        // Check if validation failed (i.e., if it returned a string)
        if (validationResult !== true) {
            // Pass the specific error message to the EntityValidationError constructor
            throw new types_js_1.EntityValidationError(validationResult);
        }
    }
    /**
     * **(Override Hook)** Provides a protected hook for inherited classes to implement entity-specific
     * validation logic immediately after initialization.
     * * * By default, this method does nothing and returns `true`.
     * * @protected
     * @returns {true | string} Returns `true` if the entity state is valid. If invalid,
     * it should return a **string containing the specific error message**.
     */
    validate() {
        return true;
    }
    /**
     * Constructs an Entity instance and assigns all its attributes,
     * performing automatic **deserialization** (string from DB to object/Date).
     * @param attributes: IEntity The raw attributes, typically from a database query result.
     */
    init(attributes) {
        for (const prop in attributes) {
            if (Object.prototype.hasOwnProperty.call(attributes, prop)) {
                const value = attributes[prop];
                const propertyType = (0, type_decorators_js_1.getPropertyType)(this, prop);
                let finalValue = value;
                // 1. Handle JSON property type
                if (propertyType === type_decorators_js_1.EntityPropertyType.JSON &&
                    typeof value === "string") {
                    try {
                        const parsed = JSON.parse(value);
                        if (typeof parsed === "object" && parsed !== null) {
                            finalValue = parsed;
                        }
                    }
                    catch (e) {
                        // Not valid JSON - assign as normal
                    }
                }
                // 2. Handle DATE property type
                else if (propertyType === type_decorators_js_1.EntityPropertyType.DATE &&
                    typeof value === "string") {
                    try {
                        const date = new Date(value);
                        if (!isNaN(date.getTime())) {
                            finalValue = date;
                        }
                    }
                    catch (e) {
                        // Not a valid date string - assign as normal
                    }
                }
                // Default assignment for non-strings, failed parsing, or non-decorated properties
                this[prop] = finalValue;
            }
        }
    }
    filterToEntity(obj, keys) {
        const result = {};
        keys.forEach((key) => {
            if (obj[key] !== undefined) {
                result[key] = obj[key];
            }
        });
        return result;
    }
    /**
     * A helper for updating attributes of this instance
     * @param attributes the attributes being updated
     */
    set(attributes) {
        for (const prop in attributes) {
            if (Object.prototype.hasOwnProperty.call(attributes, prop)) {
                this[prop] = attributes[prop];
            }
        }
    }
    /**
     * Makes this current instance into a DB compatible representation of a record.
     * This handles **serialization** (object/Date from Entity to string/DB format).
     * * - Properties with @Type(JSON) are explicitly JSON.stringified.
     * - Properties with @Type(DATE) or standard Date objects are formatted to 'YYYY-MM-DD HH:MM:SS'.
     * - All other non-primitive objects are still implicitly JSON.stringified (fallback).
     * * @returns A DB-ready plain object representation of the entity.
     */
    toDBRecord() {
        // Create a shallow copy of the object
        const record = { ...this };
        for (const key in record) {
            if (Object.prototype.hasOwnProperty.call(record, key)) {
                let value = record[key];
                const propertyType = (0, type_decorators_js_1.getPropertyType)(this, key);
                if (value === undefined) {
                    record[key] = null; // Undefined becomes NULL
                    continue;
                }
                // Check for specific decorator types first
                if (propertyType === type_decorators_js_1.EntityPropertyType.JSON) {
                    if (typeof value === "object" && value !== null) {
                        record[key] = JSON.stringify(value); // Explicitly stringify the object
                    }
                    continue;
                }
                if (propertyType === type_decorators_js_1.EntityPropertyType.DATE || value instanceof Date) {
                    // Convert Date objects or decorated strings/objects to DB date string
                    let dateObject = value instanceof Date ? value : new Date(value);
                    if (!isNaN(dateObject.getTime())) {
                        // Format: 'YYYY-MM-DD HH:MM:SS'
                        record[key] = dateObject
                            .toISOString()
                            .slice(0, 19)
                            .replace("T", " ");
                    }
                    continue;
                }
                // Fallback: Handle non-decorated objects (original logic)
                if (typeof value === "object" &&
                    value !== null &&
                    !(value instanceof Buffer)) {
                    // Convert non-primitive, non-null, non-Date/Buffer objects to JSON
                    // This covers objects that were not explicitly decorated as JSON
                    record[key] = JSON.stringify(value);
                }
                // Else: primitive types and Buffer are left as-is
            }
        }
        delete record._joins;
        return record;
    }
    static isISOString(str) {
        const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
        return isoRegex.test(str);
    }
}
exports.default = Entity;
