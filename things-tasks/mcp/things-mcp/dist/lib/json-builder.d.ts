import { AddTodoParams, AddProjectParams, UpdateTodoJSONParams, UpdateProjectJSONParams, AddItemsToProjectParams } from '../types/things.js';
/**
 * Unified JSON builder for Things 3 items
 * Consolidates all creation logic into a single, maintainable pattern
 */
export declare class ThingsJSONBuilder {
    /**
     * Create a to-do item using JSON API
     */
    createTodo(params: AddTodoParams): Promise<string>;
    /**
     * Create a project with optional to-dos and headings using JSON API
     */
    createProject(params: AddProjectParams): Promise<string>;
    /**
     * Update an existing to-do using JSON API
     */
    updateTodo(params: UpdateTodoJSONParams): Promise<string>;
    /**
     * Update an existing project using JSON API
     */
    updateProject(params: UpdateProjectJSONParams): Promise<string>;
    /**
     * Add items to an existing project using JSON API
     * Note: Things JSON API doesn't support adding items via update operation,
     * so we create new to-dos and assign them to the project
     */
    addItemsToProject(params: AddItemsToProjectParams): Promise<string>;
    /**
     * Build complete project structure including to-dos and headings
     */
    private buildProjectStructure;
    /**
     * Build flat array of project items (headings and todos as siblings)
     */
    private buildProjectItems;
    /**
     * Build a full todo with all attributes
     */
    private buildFullTodo;
    /**
     * Build a single to-do item
     */
    private buildTodoItem;
    /**
     * Convert to-do parameters to Things JSON format
     */
    private convertTodoParams;
    /**
     * Convert project parameters to Things JSON format
     */
    private convertProjectParams;
}
export declare const jsonBuilder: ThingsJSONBuilder;
//# sourceMappingURL=json-builder.d.ts.map