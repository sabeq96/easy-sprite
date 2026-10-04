# Easy Sprite

A local-first pixel-art editor and animator: draw Sprites, animate their Frames, arrange them on Spritesheets and export PNGs for a game. Everything lives in the browser.

## Language

### Pages

**Library**:
The page listing every Sprite and Spritesheet, with search, tags and sort.
_Avoid_: Manager, gallery, home

**Editor**:
The page where one Sprite is drawn and animated.
_Avoid_: Sprite editor, pixel editor (when a short name will do)

**Builder**:
The page where one Spritesheet is arranged from Blocks.
_Avoid_: Composer, spritesheet editor

**Page**:
One of the four top-level screens: Library, Editor, Builder, Settings.
_Avoid_: Surface, screen, view

### Sprites

**Sprite**:
A named pixel-art piece of fixed width and height, made of Layers across Frames.
_Avoid_: Document, image, project, drawing

**Canvas**:
A Sprite's drawing area: its width × height in pixels, shared by every Cel. "Resize canvas" changes it.
_Avoid_: Image size, artboard

**Layer**:
One stacked plane of a Sprite, spanning every Frame, with a name, opacity, and visible and locked flags. Ordered bottom to top.
_Avoid_: Level, channel

**Frame**:
One moment of a Sprite's animation, spanning every Layer. Ordered left to right.
_Avoid_: Keyframe, step

**Cel**:
The pixels of one Layer on one Frame: the smallest unit that is drawn on and saved.
_Avoid_: Cell, tile, bitmap

**Active layer** / **Active frame**:
The Layer and Frame whose Cel the next Stroke paints into.

**Composite**:
One Frame's visible Layers flattened bottom to top at their opacity: what the Sprite looks like on that Frame.
_Avoid_: Merged image, flattened image

**Strip**:
All of a Sprite's Frames' Composites side by side, left to right, at 1×.
_Avoid_: Filmstrip, sprite row

**Tile size**:
The square unit a Sprite's or Spritesheet's Grid is drawn at, picked from fixed presets. A Sprite's width and height are whole multiples of it.
_Avoid_: Cell size, grid size

**Grid**:
Guide lines drawn every Tile size over the Canvas or Spritesheet. Never exported.
_Avoid_: Pixel grid, tile grid

**Checkerboard**:
The pattern behind transparent pixels. Never exported.
_Avoid_: Chessboard, transparency grid

### Drawing

**Tool**:
One way of acting on the Canvas with the pointer: Pencil, Eraser, Paint bucket, Fill similar, Color picker, Select & move.
_Avoid_: Brush (a brush is the Pencil's and Eraser's footprint)

**Tool setting**:
A value a Tool declares for the user to change, such as brush size or mirroring.
_Avoid_: Tool option, preference

**Held tool**:
A Tool used only while its key is held down; releasing the key returns to the previous Tool. A quick tap of the same key switches Tools for good instead.
_Avoid_: Temporary tool, quick tool

**Stroke**:
Everything one Tool does between pointer press and release. One Stroke is one undo step.
_Avoid_: Gesture, drag, action

**Selection**:
A rectangle of the Active layer's Cel chosen with Select & move, which Copy, Cut, Delete and moving act on.
_Avoid_: Marquee, region

**Floating selection**:
Selected pixels lifted off the Cel while being moved, stamped back down when dropped.
_Avoid_: Lifted region, floating layer

**Primary color** / **Secondary color**:
The two colors the user paints with, the primary with the left button and the secondary with the right.
_Avoid_: Foreground/background color, color slot

**Palette**:
A named, ordered list of colors to paint from: built in (such as PICO-8) or made by the user. A Sprite remembers its Palette.
_Avoid_: Swatches, color set

### Animation

**Preview**:
The Sprite's Frames played in a loop beside the Canvas.
_Avoid_: Player, playback panel

**Onion skin**:
The previous or next Frame's Composite shown faded behind the Active frame.
_Avoid_: Ghosting, tracing

### Spritesheets

**Spritesheet**:
A named arrangement of Blocks in Rows, exported as one PNG.
_Avoid_: Sheet (in user-facing text), atlas, tileset

**Block**:
One placement of a Sprite on a Spritesheet, drawn as that Sprite's Strip. A Sprite is placed at most once per Spritesheet.
_Avoid_: Tile, cell, slot

**Row**:
A horizontal line of Blocks on a Spritesheet. Blocks sit edge to edge, a Row is as tall as its tallest Block, and an emptied Row closes up.
_Avoid_: Line, strip, lane

**Sprite tray**:
The Builder's searchable list of Sprites not yet placed on the Spritesheet. Sprites are dragged out of it to place them and Blocks are dropped back onto it to remove them.
_Avoid_: Palette, picker, sidebar, dock

### Storage and files

**Library item**:
A Sprite or a Spritesheet, as listed in the Library.
_Avoid_: Asset, file, entry

**Tag**:
A free-text label on a Library item, used to filter and search the Library.
_Avoid_: Category, folder, label

**Autosave**:
Saving changes to the browser on its own, shortly after editing pauses and when the Page is left. No manual save is needed.
_Avoid_: Sync, persist

**Export**:
Turning a Sprite (always its Strip) or a Spritesheet into a downloaded PNG.
_Avoid_: Render, save as

**Import**:
Creating Sprites from PNG files.
_Avoid_: Upload, open

**Split into frames**:
Cutting a Sprite's Canvas into a grid of equal Frames, left to right then top to bottom. Replaces its Frames.
_Avoid_: Slice, chop

**Backup**:
A single file holding every Library item, Palette and setting, for restoring the whole app elsewhere.
_Avoid_: Export, archive, snapshot

### Editor structure

**Module**:
One domain of the Editor (shell, palette, layers, frames, animation, view, toolbox, canvas) that owns its own panel, state, Commands and Hints.
_Avoid_: Plugin, feature, panel

**Command**:
A named action the user can trigger from a button, a menu or a key, such as "Merge layer down".
_Avoid_: Action, handler

**Session command**:
A Command both the Editor and the Builder offer: undo, redo, save, help, back.

**Hint**:
An input listed in Keyboard shortcuts that is not a Command, such as 1–9 for Palette colors or right-drag for the Secondary color.
_Avoid_: Gesture, binding

**Keyboard shortcuts**:
The dialog listing every Command's keys and every Hint, in both the Editor and the Builder.
_Avoid_: Cheat sheet, shortcut help, keymap (the keymap is the bindings, not the dialog)
