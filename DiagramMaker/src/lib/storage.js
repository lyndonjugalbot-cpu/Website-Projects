// Auto-save the working diagram to localStorage so a page refresh keeps it.
const KEY = 'diagrammaker.state.v1';

// Write the current state. Failures (private mode, quota) are ignored on purpose.
export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* persistence is a convenience only */
  }
}

// Read the saved state, or null if there is nothing valid stored.
export function loadState() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
