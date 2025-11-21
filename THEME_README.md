# Midnight Glass Theme - Documentation

## Quick Start

The Midnight Glass theme is now active! The application uses a modern dark theme with glass morphism effects.

## Theme Features

### Visual Design
- **Deep Navy Background**: `#0f1724` with gradient overlay
- **Glass Cards**: Translucent cards with subtle borders
- **Cool Blue Accents**: Primary `#2563eb`, Secondary `#06b6d4`
- **Smooth Animations**: 120-220ms micro-transitions
- **Soft Shadows**: Layered shadows for depth

### Accessibility
- **WCAG AA Compliant**: All color contrasts meet requirements
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Support**: ARIA labels throughout
- **Focus Management**: Visible focus indicators

## File Structure

```
public/
├── styles/
│   └── theme.css          # Main theme file with CSS variables
├── js/
│   └── accessibility.js   # Keyboard navigation & focus management
└── advisor-dashboard.html # Main application file
```

## CSS Variables

All theme colors and spacing are defined as CSS variables for easy customization:

```css
:root {
  --bg: #0f1724;
  --card: #0b1220;
  --accent: #2563eb;
  --accent-2: #06b6d4;
  /* ... see theme.css for full list */
}
```

## Customization

### Changing Colors

Edit `public/styles/theme.css` and update the CSS variables:

```css
:root {
  --accent: #your-color;      /* Primary accent */
  --accent-2: #your-color;    /* Secondary accent */
  --bg: #your-color;          /* Background */
}
```

### Adjusting Spacing

Modify spacing scale variables:

```css
:root {
  --space-md: 16px;  /* Default: 12px */
  --space-lg: 24px;  /* Default: 16px */
}
```

## Component Usage

### Buttons
```html
<button class="btn primary">Primary Action</button>
<button class="btn secondary">Secondary Action</button>
```

### Cards
```html
<div class="card">
  <h2>Card Title</h2>
  <p>Card content</p>
</div>
```

### Modals
```html
<div class="modal-backdrop">
  <div class="modal">
    <div class="modal-header">
      <h3 class="modal-title">Modal Title</h3>
      <button class="modal-close">×</button>
    </div>
    <!-- Modal content -->
  </div>
</div>
```

### Search Input
```html
<div class="search-container">
  <input type="search" class="search-input" />
  <div class="search-results" role="listbox">
    <!-- Results -->
  </div>
</div>
```

## Keyboard Shortcuts

- **Tab**: Navigate forward
- **Shift+Tab**: Navigate backward
- **Arrow Keys**: Navigate search results
- **Enter**: Activate/Select
- **Escape**: Close modals/dropdowns

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- CSS: ~15KB (minified)
- JS: ~3KB (accessibility features)
- No external dependencies

## Troubleshooting

### Theme Not Loading
1. Check browser console for errors
2. Verify `styles/theme.css` path is correct
3. Clear browser cache

### Accessibility Issues
1. Ensure `js/accessibility.js` is loaded
2. Check ARIA attributes are present
3. Test with keyboard navigation

### Styling Issues
1. Check CSS variables are defined
2. Verify no inline styles override theme
3. Inspect element to see computed styles

## Migration Notes

If migrating from the old theme:
- Remove old CSS links
- Update component classes
- Test all interactive elements
- Verify accessibility features

## Support

For issues or questions:
- Check `MIGRATION_GUIDE.md` for detailed migration steps
- Review `QA_CHECKLIST.md` for testing procedures
- Inspect browser console for errors

## Future Enhancements

Potential additions:
- [ ] Light/Dark mode toggle
- [ ] Custom color schemes
- [ ] Animation preferences
- [ ] High contrast mode

