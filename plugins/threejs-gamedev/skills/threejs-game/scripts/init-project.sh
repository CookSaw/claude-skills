#!/bin/bash

# ============================================================================
# Three.js Game Project Initializer
# Creates a new Three.js + TypeScript game project with best practices
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
print_msg() {
  echo -e "${2}${1}${NC}"
}

# Print step
print_step() {
  echo -e "\n${BLUE}[STEP]${NC} $1"
}

# Print success
print_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

# Print warning
print_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

# Print error and exit
print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

# Check if command exists
check_command() {
  if ! command -v "$1" &> /dev/null; then
    print_error "$1 is required but not installed."
  fi
}

# ============================================================================
# Main Script
# ============================================================================

# Get project name
PROJECT_NAME="${1:-threejs-game}"

# Validate project name
if [[ ! "$PROJECT_NAME" =~ ^[a-z0-9-]+$ ]]; then
  print_error "Project name must be lowercase alphanumeric with hyphens only"
fi

print_msg "
========================================
  Three.js Game Project Initializer
========================================
" "$BLUE"

print_msg "Creating project: $PROJECT_NAME" "$GREEN"

# Check prerequisites
print_step "Checking prerequisites..."
check_command "node"
check_command "npm"
print_success "Node.js $(node -v) and npm $(npm -v) found"

# Create project directory
print_step "Creating project directory..."
if [ -d "$PROJECT_NAME" ]; then
  print_error "Directory '$PROJECT_NAME' already exists"
fi
mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"
print_success "Created $PROJECT_NAME/"

# Initialize with Vite
print_step "Initializing Vite project..."
npm create vite@latest . -- --template vanilla-ts -y
print_success "Vite project initialized"

# Install dependencies
print_step "Installing dependencies..."
npm install three
npm install -D @types/three stats.js @types/stats.js lil-gui
print_success "Dependencies installed"

# Create directory structure
print_step "Creating directory structure..."
mkdir -p src/game/scenes
mkdir -p src/engine
mkdir -p src/entities
mkdir -p src/utils
mkdir -p public/models
mkdir -p public/textures
mkdir -p public/audio
mkdir -p public/draco
print_success "Directory structure created"

# Download Draco decoder
print_step "Downloading Draco decoder..."
DRACO_VERSION="1.5.6"
DRACO_URL="https://www.gstatic.com/draco/versioned/decoders/${DRACO_VERSION}"
curl -sL "$DRACO_URL/draco_decoder.js" -o public/draco/draco_decoder.js
curl -sL "$DRACO_URL/draco_decoder.wasm" -o public/draco/draco_decoder.wasm
curl -sL "$DRACO_URL/draco_wasm_wrapper.js" -o public/draco/draco_wasm_wrapper.js
print_success "Draco decoder downloaded"

# Create main.ts
print_step "Creating source files..."
cat > src/main.ts << 'EOF'
/**
 * Three.js Game - Entry Point
 */

import * as THREE from 'three';
import Stats from 'stats.js';

// Setup renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Setup scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// Setup camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 5;

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// Add a test cube
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Setup stats
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Game loop
const clock = new THREE.Clock();

function gameLoop(): void {
  stats.begin();

  const delta = clock.getDelta();

  // Update game logic
  cube.rotation.x += 0.5 * delta;
  cube.rotation.y += 0.5 * delta;

  // Render
  renderer.render(scene, camera);

  stats.end();
  requestAnimationFrame(gameLoop);
}

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start game
gameLoop();

console.log('Three.js game started!');
EOF

# Create index.html
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Three.js Game</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 100%; height: 100%; overflow: hidden; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
EOF

# Update tsconfig.json for stricter checks
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
EOF

# Remove default Vite files
rm -f src/counter.ts src/style.css src/typescript.svg public/vite.svg 2>/dev/null || true

print_success "Source files created"

# Create .gitignore
print_step "Creating .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/

# Build output
dist/

# Editor
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Environment
.env
.env.local
EOF
print_success ".gitignore created"

# Final message
print_msg "
========================================
  Project created successfully!
========================================

To get started:

  cd $PROJECT_NAME
  npm run dev

Project structure:

  $PROJECT_NAME/
  ├── public/
  │   ├── draco/        # Draco decoder for compressed models
  │   ├── models/       # 3D models (.glb)
  │   ├── textures/     # Textures (.png, .jpg)
  │   └── audio/        # Audio files
  ├── src/
  │   ├── game/         # Game logic
  │   │   └── scenes/   # Game scenes
  │   ├── engine/       # Engine utilities
  │   ├── entities/     # Game entities
  │   └── utils/        # Utilities
  ├── index.html
  └── main.ts           # Entry point

Happy coding! 🎮
" "$GREEN"
