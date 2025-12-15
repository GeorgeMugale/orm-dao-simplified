"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityPropertyType = void 0;
exports.Type = Type;
exports.getPropertyType = getPropertyType;
require("reflect-metadata");
// Keys for storing metadata
const PROPERTY_TYPE_METADATA_KEY = Symbol('PropertyType');
/**
 * Supported types for automatic conversion on entity instantiation.
 */
var EntityPropertyType;
(function (EntityPropertyType) {
    EntityPropertyType["JSON"] = "json";
    EntityPropertyType["DATE"] = "date";
})(EntityPropertyType || (exports.EntityPropertyType = EntityPropertyType = {}));
/**
 * Decorator to specify the type of an entity property for automatic conversion.
 * Must be used on a class property.
 * * @param type The target type (e.g., EntityPropertyType.JSON, EntityPropertyType.DATE)
 */
function Type(type) {
    return function (target, propertyKey) {
        // Store the desired type as metadata on the property
        Reflect.defineMetadata(PROPERTY_TYPE_METADATA_KEY, type, target, propertyKey);
    };
}
/**
 * Retrieves the specified EntityPropertyType for a given property.
 * @param target The class instance.
 * @param propertyKey The name of the property.
 * @returns The EntityPropertyType or undefined.
 */
function getPropertyType(target, propertyKey) {
    return Reflect.getMetadata(PROPERTY_TYPE_METADATA_KEY, target, propertyKey);
}
