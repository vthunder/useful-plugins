import { AddTodoSchema, AddProjectSchema } from '../types/mcp.js';
import { AbstractToolHandler, ToolDefinition } from '../lib/abstract-tool-handler.js';
import { z } from 'zod';
type AddParams = z.infer<typeof AddTodoSchema> | z.infer<typeof AddProjectSchema>;
/**
 * Unified handler for creating Things 3 items using JSON API
 * Supports to-dos, projects, headings, and hierarchical structures
 */
declare class AddToolHandler extends AbstractToolHandler<AddParams> {
    protected definitions: ToolDefinition<AddParams>[];
    execute(toolName: string, params: AddParams): Promise<string>;
}
export declare const addToolHandler: AddToolHandler;
export declare const addTools: {
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
export declare const handleAdd: (toolName: string, args: unknown) => Promise<import("../lib/abstract-tool-handler.js").ToolResponse>;
export {};
//# sourceMappingURL=add.d.ts.map