// Ambient module declarations for remote apps loaded via Module Federation.
// Add an entry here for each plugin remote that is registered in vite.config.ts.
// Use inline import() expressions — never top-level import statements (would
// turn this file into a module and break ambient declare module scope).

declare module 'fusion-index-plugin/TemplatesView' {
  const component: import('vue').DefineComponent
  export default component
}

declare module 'fusion-index-plugin/JobsView' {
  const component: import('vue').DefineComponent
  export default component
}

declare module 'fusion-index-plugin/TemplateDetailView' {
  const component: import('vue').DefineComponent
  export default component
}
