# Three.js Builder - Claude Code Plugin

A Claude Code plugin for creating Three.js games and 3D web applications.

## Installation

Add this plugin to your Claude Code installation:

```bash
claude mcp add-json-plugin https://github.com/CookSaw/claude-skills
```

Or clone locally and add manually:

```bash
git clone https://github.com/CookSaw/claude-skills.git ~/.claude/plugins/threejs-builder
```

## Skills Included

### threejs-builder

Creates simple Three.js web apps with:
- Scene setup, lighting, geometries, materials
- Animations and responsive rendering
- GLTF model loading and caching
- Camera-relative movement for games
- Game patterns (state machines, object pooling, parallax)
- Post-processing and shaders

**Trigger phrases:**
- "Create a Three.js scene/app/showcase"
- "Build a 3D web game"
- "Make a WebGL application"

## Structure

```
.claude-plugin/
  plugin.json          # Plugin manifest
skills/
  threejs-builder/
    SKILL.md           # Main skill instructions
    references/        # Detailed reference documentation
      gltf-loading-guide.md
      game-patterns.md
      advanced-topics.md
      reference-frame-contract.md
    scripts/           # Helper scripts
      gltf-calibration-helpers.mjs
```

## Author

**CookSaw** - romain.garcia99@gmail.com

## License

MIT
