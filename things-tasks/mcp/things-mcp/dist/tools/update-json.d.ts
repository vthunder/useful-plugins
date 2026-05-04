import { AbstractToolHandler, ToolDefinition } from '../lib/abstract-tool-handler.js';
type UpdateJSONParams = any;
/**
 * Unified handler for updating Things 3 items using JSON API
 * Supports updating todos, projects, and adding items to projects
 */
declare class UpdateJSONToolHandler extends AbstractToolHandler<UpdateJSONParams> {
    protected definitions: ToolDefinition<UpdateJSONParams>[];
    execute(toolName: string, params: UpdateJSONParams): Promise<string>;
}
export declare const updateJSONToolHandler: UpdateJSONToolHandler;
export declare const updateJSONTools: {
    [x: string]: unknown;
    name: string;
    inputSchema: {
        [x: string]: unknown;
        type: "object";
        properties?: {
            [x: string]: unknown;
        } | undefined;
        required?: string[] | undefined;
    };
    description?: string | undefined;
    outputSchema?: {
        [x: string]: unknown;
        type: "object";
        properties?: {
            [x: string]: unknown;
        } | undefined;
        required?: string[] | undefined;
    } | undefined;
    annotations?: {
        [x: string]: unknown;
        title?: string | undefined;
        readOnlyHint?: boolean | undefined;
        destructiveHint?: boolean | undefined;
        idempotentHint?: boolean | undefined;
        openWorldHint?: boolean | undefined;
    } | undefined;
}[];
export declare const handleUpdateJSON: (toolName: string, args: unknown) => Promise<import("../lib/abstract-tool-handler.js").ToolResponse>;
export {};
//# sourceMappingURL=update-json.d.ts.map