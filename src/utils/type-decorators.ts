import 'reflect-metadata';

// Keys for storing metadata
const PROPERTY_TYPE_METADATA_KEY = Symbol('PropertyType');

/**
 * Supported types for automatic conversion on entity instantiation.
 */
export enum EntityPropertyType {
  JSON = 'json',
  DATE = 'date',
}

/**
 * Decorator to specify the type of an entity property for automatic conversion.
 * Must be used on a class property.
 * * @param type The target type (e.g., EntityPropertyType.JSON, EntityPropertyType.DATE)
 */
export function Type(type: EntityPropertyType) {
  return function (target: Object, propertyKey: string | symbol) {
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
export function getPropertyType(target: any, propertyKey: string): EntityPropertyType | undefined {
  return Reflect.getMetadata(PROPERTY_TYPE_METADATA_KEY, target, propertyKey);
}