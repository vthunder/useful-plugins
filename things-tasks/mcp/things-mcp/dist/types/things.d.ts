/**
 * Core Things 3 types based on URL Scheme and AppleScript documentation
 */
export interface ThingsTodo {
    id: string;
    name: string;
    area?: string;
    tags: string[];
}
export interface ThingsChecklistItem {
    title: string;
    completed: boolean;
}
export interface ThingsTodoDetails {
    id: string;
    name: string;
    area?: string;
    tags: string[];
    deadline?: string;
    scheduledDate?: string;
    notes?: string;
    status: 'open' | 'completed' | 'canceled';
    creationDate?: string;
    completionDate?: string;
    project?: string;
    checklistItems?: ThingsChecklistItem[];
}
export interface ThingsHeading {
    title: string;
    archived?: boolean;
}
export interface ChecklistItem {
    title: string;
    completed?: boolean;
}
export interface TodoItem {
    type: 'todo';
    title: string;
    notes?: string;
    when?: WhenLiteral | DateString | DateTimeString;
    deadline?: DateString;
    tags?: string[];
    completed?: boolean;
    canceled?: boolean;
    checklist?: ChecklistItem[];
}
export interface HeadingItem {
    type: 'heading';
    title: string;
    archived?: boolean;
}
export type ProjectItem = TodoItem | HeadingItem;
export interface ThingsProject {
    id: string;
    name: string;
    area?: string;
    tags: string[];
}
export interface ThingsArea {
    id: string;
    name: string;
}
export interface ThingsTag {
    id: string;
    name: string;
    parent?: string;
}
export type WhenLiteral = 'today' | 'tomorrow' | 'evening' | 'anytime' | 'someday';
export type DateString = string;
export type DateTimeString = string;
export interface AddTodoParams {
    title: string;
    notes?: string;
    when?: WhenLiteral | DateString | DateTimeString;
    deadline?: DateString;
    tags?: string[];
    checklist_items?: string[];
    list_id?: string;
    list?: string;
    heading?: string;
    completed?: boolean;
    canceled?: boolean;
}
export interface AddProjectParams {
    title: string;
    notes?: string;
    when?: WhenLiteral | DateString | DateTimeString;
    deadline?: DateString;
    tags?: string[];
    area_id?: string;
    area?: string;
    items?: ProjectItem[];
    completed?: boolean;
    canceled?: boolean;
}
export interface ShowParams {
    id?: string;
    query?: string;
    filter?: string[];
}
export interface SearchParams {
    query?: string;
}
export type ThingsList = 'inbox' | 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook' | 'trash';
export interface UpdateTodoJSONParams extends AddTodoParams {
    id: string;
    operation: 'update';
}
export interface UpdateProjectJSONParams extends AddProjectParams {
    id: string;
    operation: 'update';
}
export interface AddItemsToProjectParams {
    id: string;
    items: ProjectItem[];
    operation: 'update';
}
//# sourceMappingURL=things.d.ts.map