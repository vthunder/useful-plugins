import { ThingsTodo, ThingsProject, ThingsArea, ThingsTag, ThingsTodoDetails } from '../types/things.js';
/**
 * Robust parsers for AppleScript output with error handling
 */
interface ParseOptions {
    strict?: boolean;
    logger?: (message: string) => void;
}
export declare function parseTodoList(output: string, options?: ParseOptions): ThingsTodo[];
export declare function parseProjectList(output: string, options?: ParseOptions): ThingsProject[];
export declare function parseAreaList(output: string, options?: ParseOptions): ThingsArea[];
export declare function parseTagList(output: string, options?: ParseOptions): ThingsTag[];
export declare function parseTodoDetails(output: string, options?: ParseOptions): ThingsTodoDetails;
export {};
//# sourceMappingURL=parser.d.ts.map