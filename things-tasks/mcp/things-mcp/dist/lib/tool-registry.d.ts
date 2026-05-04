import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AbstractToolHandler, ToolResponse } from './abstract-tool-handler.js';
export interface ToolHandler {
    handle(toolName: string, args: unknown): Promise<ToolResponse>;
    tools: Tool[];
}
export declare class ToolRegistry {
    private handlers;
    private toolToHandler;
    registerHandler(handlerName: string, handler: ToolHandler): void;
    registerToolHandler(handler: AbstractToolHandler): void;
    getHandler(toolName: string): ToolHandler | undefined;
    getAllTools(): Tool[];
    executeHandler(toolName: string, args: unknown): Promise<ToolResponse>;
    getRegisteredHandlers(): string[];
    hasHandler(handlerName: string): boolean;
    hasTool(toolName: string): boolean;
    clear(): void;
}
export declare const toolRegistry: ToolRegistry;
//# sourceMappingURL=tool-registry.d.ts.map