# Tailwind CSS Migration Guide

## Current Setup (CDN)
Currently using Tailwind CDN in `index.html`:
```html
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = { ... }
</script>
```

## Future Migration (Build Process)

When ready to switch from CDN to build process:

### Step 1: Update index.html
Remove CDN scripts:
```html
<!-- Remove these lines: -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = { ... }
</script>
```

### Step 2: Update main.tsx
Add CSS import:
```typescript
import './index.css';
```

### Step 3: Test Build
```bash
npm run build
```

### Step 4: Verify
- Check dist/assets/ for generated CSS file
- Test all pages for styling
- Verify custom mystery colors work

## Benefits of Migration
- ✅ Faster load times (no CDN)
- ✅ Better caching
- ✅ Production-ready CSS
- ✅ No console warnings
- ✅ Tree-shaking (smaller file size)

## Files Ready
- ✅ `postcss.config.cjs` - PostCSS configuration
- ✅ `tailwind.config.cjs` - Tailwind config with mystery colors
- ✅ `src/index.css` - Tailwind directives and custom styles

## When to Migrate
Migrate when:
1. All features are stable
2. You have time to test thoroughly
3. No urgent deployments pending

Do NOT migrate during:
- Active development
- Before important demos
- When fixing critical bugs
