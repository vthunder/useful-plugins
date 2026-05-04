export class ToolRegistry {
    handlers = new Map();
    toolToHandler = new Map();
    registerHandler(handlerName, handler) {
        this.handlers.set(handlerName, handler);
        // Map each tool to its handler
        for (const tool of handler.tools) {
            this.toolToHandler.set(tool.name, handlerName);
        }
    }
    registerToolHandler(handler) {
        const handlerName = handler.constructor.name;
        this.registerHandler(handlerName, handler);
    }
    getHandler(toolName) {
        const handlerName = this.toolToHandler.get(toolName);
        if (!handlerName) {
            return undefined;
        }
        return this.handlers.get(handlerName);
    }
    getAllTools() {
        const tools = [];
        for (const handler of this.handlers.values()) {
            tools.push(...handler.tools);
        }
        return tools;
    }
    async executeHandler(toolName, args) {
        const handler = this.getHandler(toolName);
        if (!handler) {
            throw new Error(`No handler found for tool: ${toolName}`);
        }
        return handler.handle(toolName, args);
    }
    getRegisteredHandlers() {
        return Array.from(this.handlers.keys());
    }
    hasHandler(handlerName) {
        return this.handlers.has(handlerName);
    }
    hasTool(toolName) {
        return this.toolToHandler.has(toolName);
    }
    clear() {
        this.handlers.clear();
        this.toolToHandler.clear();
    }
}
// Singleton instance for global use
export const toolRegistry = new ToolRegistry();
//# sourceMappingURL=tool-registry.js.map