import 'reflect-metadata';
/**
 * Supported types for automatic conversion on entity instantiation.
 */
export declare enum EntityPropertyType {
    JSON = "json",
    DATE = "date"
}
/**
 * Decorator to specify the type of an entity property for automatic conversion.
 * Must be used on a class property.
 * * @param type The target type (e.g., EntityPropertyType.JSON, EntityPropertyType.DATE)
 */
export declare function Type(type: EntityPropertyType): (target: Object, propertyKey: string | symbol) => void;
/**
 * Retrieves the specified EntityPropertyType for a given property.
 * @param target The class instance.
 * @param propertyKey The name of the property.
 * @returns The EntityPropertyType or undefined.
 */
export declare function getPropertyType(target: any, propertyKey: string): EntityPropertyType | undefined;
