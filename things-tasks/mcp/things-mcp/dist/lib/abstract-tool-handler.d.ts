import { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
export type ToolResponse = CallToolResult;
export interface ToolDefinition<TParams = unknown> {
    name: string;
    description: string;
    schema: z.ZodSchema<TParams>;
}
export declare abstract class AbstractToolHandler<TParams = unknown> {
    protected abstract definitions: ToolDefinition<TParams>[];
    abstract execute(toolName: string, params: TParams): Promise<string>;
    get tools(): Tool[];
    handle(toolName: string, args: unknown): Promise<ToolResponse>;
    protected formatResponse(message: string): ToolResponse;
    protected handleError(error: unknown): ToolResponse;
}
//# sourceMappingURL=abstract-tool-handler.d.ts.map