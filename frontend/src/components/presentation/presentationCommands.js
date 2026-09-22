export const RIBBON_TABS = {
  Home: [
    { id: 'clipboard', label: 'Clipboard', actions: ['undo', 'redo', 'copy', 'paste'] },
    { id: 'slides', label: 'Slides', actions: ['newSlide', 'duplicateSlide', 'deleteSlide'] },
    { id: 'drawing', label: 'Drawing', actions: ['addText', 'addShape', 'addImage'] },
    { id: 'arrange', label: 'Arrange', actions: ['bringFront', 'sendBack', 'alignCenter'] },
    { id: 'editing', label: 'Editing', actions: ['commandPalette'] },
  ],
  Insert: [
    { id: 'slides', label: 'Slides', actions: ['newSlide'] },
    { id: 'text', label: 'Text', actions: ['addText'] },
    { id: 'media', label: 'Media', actions: ['addImage'] },
    { id: 'shapes', label: 'Shapes', actions: ['addShape'] },
  ],
  Design: [{ id: 'themes', label: 'Themes', actions: ['themeLight', 'themeDark'] }, { id: 'background', label: 'Background', actions: ['background'] }],
  Transitions: [{ id: 'transitions', label: 'Transitions', actions: ['transitionFade', 'transitionPush'] }],
  Animations: [{ id: 'animations', label: 'Animations', actions: ['animationFade', 'animationZoom'] }],
  'Slide Show': [{ id: 'show', label: 'Slide Show', actions: ['present'] }],
  Review: [{ id: 'review', label: 'Review', actions: ['commandPalette'] }],
  View: [{ id: 'view', label: 'View', actions: ['zoomOut', 'zoomIn', 'grid', 'darkMode'] }],
}

export const ACTIONS = {
  undo: { label: 'Undo', icon: 'undo', shortcut: 'Ctrl+Z' }, redo: { label: 'Redo', icon: 'redo', shortcut: 'Ctrl+Shift+Z' },
  copy: { label: 'Copy', icon: 'copy', shortcut: 'Ctrl+C' }, paste: { label: 'Paste', icon: 'copy', shortcut: 'Ctrl+V' },
  newSlide: { label: 'New Slide', icon: 'plus' }, duplicateSlide: { label: 'Duplicate Slide', icon: 'copy', shortcut: 'Ctrl+D' }, deleteSlide: { label: 'Delete Slide', icon: 'trash' },
  addText: { label: 'Text Box', icon: 'text' }, addShape: { label: 'Shape', icon: 'shape' }, addImage: { label: 'Image', icon: 'image' }, present: { label: 'Present', icon: 'present', shortcut: 'F5' },
  bringFront: { label: 'Bring Front', icon: 'layers' }, sendBack: { label: 'Send Back', icon: 'layers' }, alignCenter: { label: 'Align Center', icon: 'shape' },
  commandPalette: { label: 'Command Palette', icon: 'search', shortcut: 'Ctrl+K' }, zoomIn: { label: 'Zoom In', icon: 'plus' }, zoomOut: { label: 'Zoom Out', icon: 'shape' }, grid: { label: 'Grid', icon: 'grid' }, darkMode: { label: 'Dark Mode', icon: 'moon' },
  themeLight: { label: 'Light Theme', icon: 'shape' }, themeDark: { label: 'Dark Theme', icon: 'moon' }, background: { label: 'Background', icon: 'shape' }, transitionFade: { label: 'Fade', icon: 'shape' }, transitionPush: { label: 'Push', icon: 'shape' }, animationFade: { label: 'Fade In', icon: 'shape' }, animationZoom: { label: 'Zoom In', icon: 'shape' },
}
