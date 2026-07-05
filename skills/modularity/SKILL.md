# MODULARITY — File Naming, Structure, Size Limits

## PURPOSE

Enforces consistent file naming, organization, and size
limits across all projects.

## RULES

### File Naming

- Use consistent naming: `feature-name.component.tsx`, `feature-name.service.ts`
- Use kebab-case for files
- Use PascalCase for components
- Use camelCase for functions/variables

### Organization

Group by feature, not by type:

  ✓ /features/auth/ — auth UI + logic + tests
  ✗ /components/ mixed with /services/ mixed with /tests/

### Size Limits

- Maximum file size: 250 lines (split if larger)
- Maximum function size: 50 lines (split if larger)
- Maximum component size: 250 lines

### Structure

Each folder has its own README.md explaining purpose.

### Naming Conventions

- Components: `ComponentName.tsx`
- Services: `feature-name.service.ts`
- Hooks: `useFeatureName.ts`
- Types: `feature-name.types.ts`
- Constants: `feature-name.constants.ts`
- Utils: `feature-name.utils.ts`
- Tests: `feature-name.test.ts`

## WORKFLOW

When creating files:
1. Check if feature folder exists
2. Create feature folder if not
3. Create files following naming convention
4. Add README.md to folder
5. Keep files under 250 lines

## RULES

- ALWAYS group by feature
- ALWAYS keep files under 250 lines
- ALWAYS keep functions under 50 lines
- ALWAYS add README to folders
- NEVER mix types in folders
- NEVER exceed size limits