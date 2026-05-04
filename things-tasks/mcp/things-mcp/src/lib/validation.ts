/**
 * Input validation utilities
 */

import { ThingsValidationError } from './errors.js';

// Validate and sanitize AppleScript arguments
export function validateAppleScriptArg(arg: string, fieldName: string): string {
  // Only allow alphanumeric, spaces, hyphens, underscores, @ and dots
  const safePattern = /^[\w\s\-.@]+$/;
  
  if (!arg) {
    throw new ThingsValidationError(`${fieldName} cannot be empty`);
  }
  
  if (arg.length > 255) {
    throw new ThingsValidationError(`${fieldName} is too long (max 255 characters)`);
  }
  
  if (!safePattern.test(arg)) {
    throw new ThingsValidationError(
      `${fieldName} contains invalid characters. Only letters, numbers, spaces, hyphens, dots, and @ are allowed.`,
      fieldName
    );
  }
  
  return arg;
}

// Validate Things ID format
export function validateThingsId(id: string): string {
  // Things IDs are alphanumeric strings of 20-24 characters
  const idPattern = /^[A-Za-z0-9]{20,24}$/;
  
  if (!idPattern.test(id)) {
    throw new ThingsValidationError(
      'Invalid Things ID format. Expected: alphanumeric string like "aBc123dEf456gHi789JkL" (20-24 characters). NOT the project name!',
      'id'
    );
  }
  
  return id;
}

// Sanitize string for URL encoding
export function sanitizeForUrl(value: string): string {
  // Remove any control characters except common whitespace (tab, newline, carriage return)
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
}