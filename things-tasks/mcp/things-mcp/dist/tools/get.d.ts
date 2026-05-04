import { GetProjectSchema, GetAreaSchema, GetListSchema, GetListByNameSchema, GetTodoDetailsSchema } from '../types/mcp.js';
import { AbstractToolHandler, ToolDefinition } from '../lib/abstract-tool-handler.js';
import { z } from 'zod';
type GetParams = z.infer<typeof GetListSchema> | z.infer<typeof GetProjectSchema> | z.infer<typeof GetAreaSchema> | z.infer<typeof GetListByNameSchema> | z.infer<typeof GetTodoDetailsSchema>;
declare class GetToolHandler extends AbstractToolHandler<GetParams> {
    protected definitions: ToolDefinition<GetParams>[];
    private scriptMap;
    private listNameToScript;
    execute(toolName: string, params: GetParams): Promise<string>;
    private getResultKey;
}
export declare const getToolHandler: GetToolHandler;
export declare const getTools: {
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
export declare const handleGet: (toolName: string, args: unknown) => Promise<import("../lib/abstract-tool-handler.js").ToolResponse>;
export {};
//# sourceMappingURL=get.d.ts.map