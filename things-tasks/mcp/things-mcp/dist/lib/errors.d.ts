/**
 * Custom error classes for better error handling
 */
export declare class ThingsError extends Error {
    code: string;
    details?: unknown | undefined;
    constructor(message: string, code: string, details?: unknown | undefined);
    toJSON(): Record<string, unknown>;
}
export declare class ThingsNotFoundError extends ThingsError {
    constructor(itemType: string, id: string);
}
export declare class ThingsAuthError extends ThingsError {
    constructor(message?: string);
}
export declare class ThingsValidationError extends ThingsError {
    constructor(message: string, field?: string);
}
export declare class ThingsTimeoutError extends ThingsError {
    constructor(operation: string, timeout: number);
}
export declare class ThingsScriptError extends ThingsError {
    constructor(scriptName: string, error: string);
    private static parseErrorMessage;
}
//# sourceMappingURL=errors.d.ts.map