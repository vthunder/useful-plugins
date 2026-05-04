import { ShowSchema } from '../types/mcp.js';
import { AbstractToolHandler, ToolDefinition } from '../lib/abstract-tool-handler.js';
import { z } from 'zod';
type ShowParams = z.infer<typeof ShowSchema>;
declare class ShowToolHandler extends AbstractToolHandler<ShowParams> {
    protected definitions: ToolDefinition<ShowParams>[];
    execute(toolName: string, params: ShowParams): Promise<string>;
}
export declare const showToolHandler: ShowToolHandler;
export declare const showTools: {
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
export declare const handleShow: (toolName: string, args: unknown) => Promise<import("../lib/abstract-tool-handler.js").ToolResponse>;
export {};
//# sourceMappingURL=show.d.ts.map