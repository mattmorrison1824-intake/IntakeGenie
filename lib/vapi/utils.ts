/**
 * Utility functions for Vapi API interactions
 */

/**
 * Remove undefined and null values from an object
 * This is critical for Vapi PATCH requests which validate all fields
 * @param obj Object to clean
 * @returns Object with only defined, non-null values
 */
export function cleanVapiPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      // Recursively clean nested objects
      if (typeof value === 'object' && !Array.isArray(value) && value.constructor === Object) {
        const cleanedNested = cleanVapiPayload(value);
        if (Object.keys(cleanedNested).length > 0) {
          cleaned[key as keyof T] = cleanedNested as T[keyof T];
        }
      } else {
        cleaned[key as keyof T] = value;
      }
    }
  }
  
  return cleaned;
}

