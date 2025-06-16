import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// --- Global Variables ---
let scene, camera, renderer;
let player, playerVelocity, playerOnFloor;
let zombie;
let mixer; // Pour gérer les animations
let zombies = []; // Tableau pour stocker tous les zombies
const playerHeight = 1.8;
const playerSpeed = 8.0;
const playerJumpVelocity = 8.0;
const gravity = 20.0; // Adjusted gravity for a more responsive feel
let difficultyLevel = 1;

let controlsEnabled = false;
let targets = [];
let score = 0;
let isZoomed = false;
const normalFOV = 75;
const zoomedFOV = 30;

const moveForward = { value: false };
const moveBackward = { value: false };
const moveLeft = { value: false };
const moveRight = { value: false };

const gameCanvas = document.getElementById('gameCanvas');
const crosshair = document.getElementById('crosshair');
const startButtonContainer = document.getElementById('startButtonContainer');
const startButton = document.getElementById('startButton');
const instructionsDiv = document.getElementById('instructions');
const scoreDisplay = document.getElementById('scoreDisplay');
const messageBox = document.getElementById('messageBox');

let prevTime = performance.now(); // For delta time calculation

// Variables globales
let shootSound, hitSound;

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue background
    scene.fog = new THREE.Fog(0x550000, 0, 100); // Fog for depth perception

    // Camera (PerspectiveCamera for 3D)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = playerHeight; // Player's eye level

    // Player object (a simple group to hold the camera)
    player = new THREE.Group();
    player.add(camera);
    player.position.set(0, playerHeight, 5); // Initial player position
    scene.add(player);
    
    playerVelocity = new THREE.Vector3();
    playerOnFloor = false;

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // For sharper rendering on high DPI screens
    renderer.shadowMap.enabled = true; // Enable shadows for more realism

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x000000, 2.5); // Soft ambient light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xff0000, 1.5); // Sun-like light
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    // Configure shadow properties for optimization
    directionalLight.shadow.mapSize.width = 2048; 
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    // Améliorer la qualité des ombres
    directionalLight.shadow.bias = -0.0001;
    directionalLight.shadow.normalBias = 0.02;
    scene.add(directionalLight);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        map: groundTexture,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    ground.receiveShadow = true;
    scene.add(ground);

    // Skybox
    const skyTexture = new THREE.TextureLoader().load('./hell_sky.png');
    scene.background = skyTexture;
    

    // Targets
    spawnTargets(10);

    // Particles
    createParticleSystem();
        
    // Sounds
    shootSound = document.getElementById('shootSound');
    hitSound = document.getElementById('hitSound');

    // Event Listeners
    startButton.addEventListener('click', startGame);
    document.addEventListener('pointerlockchange', pointerLockChange, false);
    document.addEventListener('mozpointerlockchange', pointerLockChange, false); // Firefox
    document.addEventListener('webkitpointerlockchange', pointerLockChange, false); // Chrome, Safari, Opera
    document.addEventListener('pointerlockerror', pointerLockError, false);
    document.addEventListener('mozpointerlockerror', pointerLockError, false);
    document.addEventListener('webkitpointerlockerror', pointerLockError, false);

    window.addEventListener('resize', onWindowResize, false);
}

// --- Game Logic ---
// Modifier startGame()
function startGame() {
    startButtonContainer.style.display = 'none';
    crosshair.style.display = 'block';
    instructionsDiv.style.display = 'block';
    scoreDisplay.style.display = 'block';
    
    // Réinitialiser le jeu
    score = 0;
    gameTime = 0;
    gameActive = true;
    targets.forEach(target => scene.remove(target));
    targets = [];
    spawnTargets(10);
    
    // Position initiale du joueur
    player.position.set(0, playerHeight, 5);
    player.rotation.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
    
    gameCanvas.requestPointerLock();
}

function pointerLockChange() {
    if (document.pointerLockElement === gameCanvas ||
        document.mozPointerLockElement === gameCanvas ||
        document.webkitPointerLockElement === gameCanvas) {
        controlsEnabled = true;
        // Hook mouse move and click events
        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('mousedown', onMouseDown, false);
        document.addEventListener('keydown', onKeyDown, false);
        document.addEventListener('keyup', onKeyUp, false);
        showMessage("Contrôles activés. Appuyez sur Échap pour libérer.", 3000);
    } else {
        controlsEnabled = false;
        // Unhook events
        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('mousedown', onMouseDown, false);
        document.removeEventListener('keydown', onKeyDown, false);
        document.removeEventListener('keyup', onKeyUp, false);
        
        // Show start screen again if game was active
        startButtonContainer.style.display = 'flex';
        crosshair.style.display = 'none';
        instructionsDiv.style.display = 'none';
        // scoreDisplay.style.display = 'none'; // Keep score visible or hide
        showMessage("Contrôles désactivés.", 2000);
    }
}

function pointerLockError() {
    console.error('PointerLock Error');
    showMessage("Erreur de verrouillage du pointeur.", 3000);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    if (!controlsEnabled) return;
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
        case 'KeyZ': // For AZERTY keyboards
            moveForward.value = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
        case 'KeyQ': // For AZERTY keyboards
            moveLeft.value = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward.value = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight.value = true;
            break;
        case 'Space':
            if (playerOnFloor) {
                    playerVelocity.y = playerJumpVelocity;
                    playerOnFloor = false; // Player is now in the air
            }
            break;
        case 'Escape':
            document.exitPointerLock = document.exitPointerLock ||
                                        document.mozExitPointerLock ||
                                        document.webkitExitPointerLock;
            document.exitPointerLock();
            break;
    }
}

function onKeyUp(event) {
    if (!controlsEnabled) return;
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
        case 'KeyZ':
            moveForward.value = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
        case 'KeyQ':
            moveLeft.value = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward.value = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight.value = false;
            break;
    }
}

const euler = new THREE.Euler(0, 0, 0, 'YXZ'); // To control camera rotation
const PI_2 = Math.PI / 2;

function onMouseMove(event) {
    if (!controlsEnabled) return;

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    euler.setFromQuaternion(camera.quaternion);
    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;
    euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x)); // Clamp vertical rotation

    camera.quaternion.setFromEuler(euler);
}

function onMouseDown(event) {
    if (!controlsEnabled) return;
    
    if (event.button === 0) { // Clic gauche
        shootSound.currentTime = 0;
        shootSound.play();

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: 0, y: 0 }, camera);

        // Vérifier les collisions avec les zombies
        const zombieModels = zombies.map(z => z.model);
        const intersects = raycaster.intersectObjects(zombieModels, true);
        
        console.log(intersects);
        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            // Trouver le zombie parent (remonter la hiérarchie)
            let zombieModel = intersectedObject;
            while (zombieModel && !zombieModels.includes(zombieModel)) {
                zombieModel = zombieModel.parent;
            }
            const zombieIndex = zombies.findIndex(z => z.model === zombieModel);

            if (zombieIndex !== -1) {
                hitSound.currentTime = 0;
                hitSound.play();

                createExplosion(zombieModel.position);

                // Arrêter l'animation
                if (zombies[zombieIndex].mixer) {
                    zombies[zombieIndex].mixer.stopAllAction();
                }

                // Supprimer le zombie de la scène
                scene.remove(zombieModel);
                zombieModel.traverse((node) => {
                    if (node.isMesh) {
                        if (node.geometry) node.geometry.dispose();
                        if (node.material) {
                            if (Array.isArray(node.material)) {
                                node.material.forEach(mat => mat.dispose());
                            } else {
                                node.material.dispose();
                            }
                        }
                    }
                });

                // Retirer le zombie du tableau
                zombies.splice(zombieIndex, 1);
                
                // Ajouter des points
                score += 10;
                showMessage("Zombie éliminé ! +10 points", 1000);
                updateScoreDisplay();

                // Vérifier s'il reste des zombies
                if (zombies.length === 0) {
                    if (score > highScore) {
                        highScore = score;
                        showMessage("Nouveau record ! Nouveaux zombies dans 3s.", 3000);
                    } else {
                        showMessage("Tous les zombies éliminés ! Nouveaux zombies dans 3s.", 3000);
                    }
                    difficultyLevel += 0.5;
                    
                    setTimeout(() => {
                        spawnTargets(10 + Math.floor(score/50));
                        showMessage(`Niveau ${Math.floor(difficultyLevel)}!`, 2000);
                    }, 3000);
                }
            }
        }
    } else if (event.button === 2) { // Clic droit
        isZoomed = true;
        camera.fov = zoomedFOV;
        camera.updateProjectionMatrix();
    }
}

function onMouseUp(event) {
    if (!controlsEnabled) return;
    
    if (event.button === 2) { // Clic droit
        isZoomed = false;
        camera.fov = normalFOV;
        camera.updateProjectionMatrix();
    }
}

// Ajouter l'écouteur d'événement pour onMouseUp
document.addEventListener('mouseup', onMouseUp, false);

// Ajouter ces variables globales
let gameTime = 0;
let highScore = 0;
let gameActive = false;

const loader = new GLTFLoader();
// Modifier la fonction spawnTargets()
function spawnTargets(count) {
    // console.log(count);
    // Nettoyer les zombies existants
    zombies.forEach(zombie => {
        if (zombie.mixer) zombie.mixer.stopAllAction();
        scene.remove(zombie.model);
    });
    zombies = [];

    loader.load(
        './models/zombie_walk_test.glb',
        function (gltf) {
            
            // Créer les zombies
            for (let i = 0; i < count; i++) {
                // Clone la racine de la scène
                const zombieModel = clone(gltf.scene);

                if(i == 0) {
                    console.log(zombieModel);
                }

                // Applique l'échelle sur tous les Mesh du clone
                zombieModel.traverse((node) => {
                    if (node.isMesh) {
                        console.log("is mesh");
                        node.castShadow = true;
                        node.receiveShadow = true;
                        node.scale.set(0.03, 0.03, 0.03);
                        
                        // Gestion des matériaux
                        if (node.material) {
                            // Si c'est un tableau de matériaux
                            if (Array.isArray(node.material)) {
                                node.material = node.material.map(mat => mat.clone());
                            } else {
                                // Si c'est un seul matériau
                                node.material = node.material.clone();
                            }
                            // S'assurer que le matériau est bien configuré
                            node.material.needsUpdate = true;
                            // Activer les ombres sur le matériau
                            node.material.shadowSide = THREE.FrontSide;
                        }
                    }
                });

                // Position aléatoire autour du joueur
                const angle = Math.random() * Math.PI * 2;
                const radius = 15 + Math.random() * 25;
                zombieModel.position.set(
                    Math.cos(angle) * radius,
                    0,
                    Math.sin(angle) * radius
                );
                zombieModel.lookAt(player.position);

                // Mixer sur le clone de la racine
                const newMixer = new THREE.AnimationMixer(zombieModel);
                if (gltf.animations && gltf.animations.length > 0) {
                    const newAction = newMixer.clipAction(gltf.animations[0]);
                    // Utiliser LoopPingPong pour une transition plus naturelle
                    newAction.loop = THREE.LoopPingPong;
                    // Ajuster la vitesse de l'animation
                    newAction.timeScale = 0.8;
                    // Ajouter un petit délai entre les boucles
                    newAction.clampWhenFinished = true;
                    newAction.enable = true;
                    newAction.play();

                    // Ajouter un petit délai entre les boucles
                    let lastLoopTime = 0;
                    newMixer.addEventListener('loop', (e) => {
                        const currentTime = performance.now();
                        if (currentTime - lastLoopTime < 100) { // 100ms de délai minimum
                            newAction.paused = true;
                            setTimeout(() => {
                                newAction.paused = false;
                            }, 100);
                        }
                        lastLoopTime = currentTime;
                    });
                }

                scene.add(zombieModel);
                zombies.push({
                    model: zombieModel,
                    mixer: newMixer
                });
            }
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% chargé');
        },
        function (error) {
            console.error('Une erreur est survenue lors du chargement du modèle:', error);
        }
    );
}

// Créer un système de particules pour les explosions
let particleSystem;
function createParticleSystem() {
    const particleCount = 500;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        // Explosion plus large
        positions[i * 3] = (Math.random() - 0.5) * 3; // Augmenté
        positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 3;
        
        // Couleurs rouges/roses
        const r = 0.2 + (Math.random() * 0.05); // Entre 0.8 et 1
        const g = 0.0 + (Math.random() * 0.05); // Entre 0 et 0.2
        const b = 0.05 + (Math.random() * 0.05); // Entre 0.4 et 0.7 (rose)
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.25, // Augmenté
        vertexColors: true,
        transparent: true,
        opacity: 0.8
    });
    
    particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);
    particleSystem.visible = false;
}

function createExplosion(position) {
    particleSystem.position.copy(position);
    particleSystem.visible = true;
    
    // Animation des particules
    const positions = particleSystem.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        // Explosion plus large
        positions[i] = (Math.random() - 0.5) * 3;
        positions[i + 1] = (Math.random() - 0.5) * 5;
        positions[i + 2] = (Math.random() - 0.5) * 3;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
    
    setTimeout(() => {
        particleSystem.visible = false;
    }, 500);
}

function updateScoreDisplay() {
    scoreDisplay.innerHTML = `
        Score: ${score}<br>
        Temps: ${Math.floor(gameTime)}s<br>
        Meilleur score: ${highScore}
    `;
}

let messageTimeout;
function showMessage(text, duration = 2000) {
    messageBox.textContent = text;
    messageBox.style.display = 'block';
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        messageBox.style.display = 'none';
    }, duration);
}

function updatePlayer(deltaTime) {
    if (!controlsEnabled) return;

    const speedDelta = playerSpeed * deltaTime;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction); // Get camera's current facing direction

    // Horizontal movement
    const right = new THREE.Vector3();
    right.crossVectors(camera.up, direction).normalize(); // Calculate right vector relative to camera

    if (moveForward.value) {
        player.position.addScaledVector(direction, speedDelta);
    }
    if (moveBackward.value) {
        player.position.addScaledVector(direction, -speedDelta);
    }
    if (moveLeft.value) {
        player.position.addScaledVector(right, speedDelta); // Move along the right vector (negated for left)
    }
    if (moveRight.value) {
        player.position.addScaledVector(right, -speedDelta); // Move along the right vector
    }
    
    // Vertical movement (gravity and jump)
    playerVelocity.y -= gravity * deltaTime;
    player.position.y += playerVelocity.y * deltaTime;

    // Collision with floor
    if (player.position.y < playerHeight) {
        player.position.y = playerHeight;
        playerVelocity.y = 0;
        playerOnFloor = true;
    } else {
        playerOnFloor = false;
    }

    // Keep player within bounds (optional, simple example)
    player.position.x = Math.max(-98, Math.min(98, player.position.x));
    player.position.z = Math.max(-98, Math.min(98, player.position.z));
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const deltaTime = (time - prevTime) / 1000;
    prevTime = time;

    if (gameActive) {
        gameTime += deltaTime;
        updatePlayer(deltaTime);
        
        // console.log(zombies.length);
        // Mise à jour des animations des zombies
        zombies.forEach(zombie => {
            if (zombie.mixer) {
                zombie.mixer.update(deltaTime);
            }
            // Faire face au joueur
            if (zombie.model) {
                zombie.model.lookAt(player.position);
                
                // Calculer la direction vers le joueur
                const direction = new THREE.Vector3();
                direction.subVectors(player.position, zombie.model.position).normalize();
                direction.y = 0;
                
                // Vitesse de déplacement des zombies
                const zombieSpeed = 0.5; // Vitesse en unités par seconde
                
                // Déplacer le zombie vers le joueur
                zombie.model.position.addScaledVector(direction, zombieSpeed * deltaTime);
            }
        });
        
        // Animer les cibles
        targets.forEach(target => {
            target.rotation.x += target.userData.rotationSpeed.x;
            target.rotation.y += target.userData.rotationSpeed.y;
            target.rotation.z += target.userData.rotationSpeed.z;
        });
    }

    renderer.render(scene, camera);
}

// --- Start ---
init();
animate(); // Start the animation loop

// Ensure canvas is focused for initial interaction if pointer lock fails immediately
// This is more of a fallback, primary interaction is through startButton
gameCanvas.focus(); 