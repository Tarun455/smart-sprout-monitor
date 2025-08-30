/**
 * Data validation utilities for safe sensor data handling
 * Prevents JavaScript errors when dealing with null/undefined sensor values
 */

/**
 * Safely formats a number to a fixed decimal places, handling null/undefined values
 * @param value - The number to format (can be null, undefined, or NaN)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string or fallback dash character
 */
export const safeToFixed = (value: number | undefined | null, decimals: number = 1): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '–';
  }
  return value.toFixed(decimals);
};

/**
 * Safely accesses array elements, handling undefined arrays and out-of-bounds access
 * @param array - The array to access (can be undefined)
 * @param index - The index to access
 * @returns The array element or undefined if not accessible
 */
export const safeArrayAccess = <T>(array: T[] | undefined, index: number): T | undefined => {
  return array && array.length > index ? array[index] : undefined;
};

/**
 * Safely calculates average of array values, handling null/undefined elements
 * @param array - Array of numbers (can contain null/undefined values)
 * @param startIndex - Starting index for calculation (default: 0)
 * @param endIndex - Ending index for calculation (optional, uses array length)
 * @returns Average value or 0 if no valid values
 */
export const safeAverage = (
  array: (number | null | undefined)[] | undefined, 
  startIndex: number = 0, 
  endIndex?: number
): number => {
  if (!array || array.length === 0) return 0;
  
  const slice = array.slice(startIndex, endIndex);
  const validValues = slice.filter((val): val is number => 
    val !== null && val !== undefined && !isNaN(val)
  );
  
  if (validValues.length === 0) return 0;
  
  return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
};

/**
 * Safely gets a sensor value with fallback
 * @param array - Sensor data array
 * @param index - Index to access
 * @param fallback - Fallback value (default: 0)
 * @returns Sensor value or fallback
 */
export const safeSensorValue = (
  array: (number | null | undefined)[] | undefined, 
  index: number, 
  fallback: number = 0
): number => {
  const value = safeArrayAccess(array, index);
  return (value !== null && value !== undefined && !isNaN(value)) ? value : fallback;
};