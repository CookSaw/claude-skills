# Claude Skills

Skills et plugins personnalisés pour Claude Code.

## Installation

Ajoute ce marketplace à Claude Code :

```bash
/plugin marketplace add CookSaw/claude-skills
```

Puis installe les plugins souhaités :

```bash
/plugin install threejs-gamedev@cooksaws-skills
```

## Plugins Disponibles

| Plugin | Description |
|--------|-------------|
| `threejs-gamedev` | Skill pour le développement de jeux Three.js avec TypeScript |

## Structure

```
claude-skills/
├── marketplace.json          # Définition du marketplace
├── plugins/
│   └── threejs-gamedev/      # Plugin Three.js Game Dev
│       ├── .claude-plugin/
│       │   └── plugin.json
│       └── skills/
│           └── threejs-game/
│               ├── SKILL.md
│               ├── references/
│               └── examples/
└── README.md
```

## Ajouter un nouveau plugin

1. Créer un dossier dans `plugins/`
2. Ajouter la structure `.claude-plugin/plugin.json` et `skills/`
3. Référencer dans `marketplace.json`

## Licence

MIT
