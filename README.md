# CookSaw's Claude Skills

Marketplace de skills et plugins personnalisés pour Claude Code.

## Installation

### 1. Ajouter le marketplace

```bash
/plugin marketplace add CookSaw/claude-skills
```

### 2. Installer un plugin

```bash
/plugin install threejs-builder@cooksaws-skills
```

## Plugins Disponibles

| Plugin | Description |
|--------|-------------|
| `threejs-builder` | Skill pour créer des jeux et applications Three.js avec GLTF, animations, game patterns |

## Structure

```
claude-skills/
├── .claude-plugin/
│   └── marketplace.json      # Définition du marketplace
├── plugins/
│   └── threejs-builder/      # Plugin Three.js Builder
│       ├── .claude-plugin/
│       │   └── plugin.json
│       └── skills/
│           └── threejs-builder/
│               ├── SKILL.md
│               ├── references/
│               └── scripts/
└── README.md
```

## Ajouter un nouveau plugin

1. Créer un dossier dans `plugins/nom-du-plugin/`
2. Ajouter `.claude-plugin/plugin.json` avec les métadonnées
3. Ajouter les skills dans `skills/`
4. Référencer dans `.claude-plugin/marketplace.json`

## Auteur

**CookSaw** - romain.garcia99@gmail.com

## Licence

MIT
