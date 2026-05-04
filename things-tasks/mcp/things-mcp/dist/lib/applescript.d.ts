export interface ExecuteOptions {
    timeout?: number;
    maxResults?: number;
}
/**
 * Execute AppleScript file with arguments (SECURE VERSION)
 * This is the only method we use - no string interpolation
 */
export declare function executeAppleScriptFile(scriptName: string, args?: string[], options?: ExecuteOptions): Promise<string>;
/**
 * Test if Things 3 is installed and accessible
 */
export declare function testThingsAvailable(): Promise<boolean>;
//# sourceMappingURL=applescript.d.ts.map