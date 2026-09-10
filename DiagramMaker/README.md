# Wots Diagram Generator

Type a short description of your system, press **Generate**, then edit the result on
the canvas and download it as an image. Supports four diagram types:

- **ERD** – entities and relationships
- **Use Case** – actors and use cases
- **Class Diagram** – UML classes and relationships
- **Activity Diagram** – start / action / decision / end flow

## Run locally

```bash
cd DiagramMaker
npm install
npm run dev
```

Then open the URL it prints (default **http://localhost:5173**).

## How it works

| Layer | File(s) | Job |
| --- | --- | --- |
| Input | `src/components/Sidebar.jsx`, `src/diagrams/*` | Collect text, parse it into nodes + edges |
| Layout | `src/lib/layout.js` | Auto-position everything with dagre |
| Canvas | `src/components/FlowCanvas.jsx`, `src/nodes.jsx` | Draw + edit with React Flow |
| Edit | `src/components/Inspector.jsx` | Change label, colour, arrow, line style, delete |
| Export | `src/lib/exportImage.js` | Save the canvas as PNG or SVG |
| State | `src/components/Editor.jsx`, `src/lib/storage.js` | Hold state, auto-save to localStorage |

## Input syntax

**ERD**
```
Entities:       User | id:int:pk, name:varchar
Relationships:  User -> Order : 1-N : places
```

**Use Case**
```
Actors:      Customer
             Admin > right          (">right" puts an actor in the right column)
Use cases:   Checkout
Connections: Customer -> Checkout
             Checkout -> Make Payment : include
```

**Class Diagram**
```
Classes:        Dog | -breed:string | +bark()
Relationships:  Dog -> Animal : inheritance : label
                (association | aggregation | composition | dependency)
```

**Activity Diagram**
```
Steps:  login | action | Enter credentials
        check | decision | Valid?
Flows:  login -> check
        check -> home : yes
```

## Editing on the canvas

- Click a shape or line to edit it in the right-hand **Inspector**.
- Drag between the dots on a shape to connect two shapes.
- Drag a line's endpoint onto another shape to re-route it.
- Press <kbd>Delete</kbd> to remove the selection.
- Your work auto-saves; **Generate** or **Reset to example** replaces it.

## Known limitations (kept simple on purpose)

- Regenerating from text discards manual canvas edits.
- Aggregation / composition show as `◇` / `◆` label marks (React Flow ships only
  arrow heads); swap in custom SVG markers later if you need true UML notation.
- Sub-item editing (attributes/methods) is line-based text, not a row editor.

---

© 2026 Wots Dev. All rights reserved.
