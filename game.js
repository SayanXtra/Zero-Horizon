// Get the canvas element from the HTML
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ASSET PRELOADER ---
let assets = {
    images: {},
    total: 0,
    loaded: 0,
    error: false
};

function assetLoaded() {
    assets.loaded++;
    if (assets.loaded === assets.total) {
        gameState = 'titleScreen';
    }
}

function assetFailed(assetName) {
    console.error(`Failed to load asset: ${assetName}`);
    assets.error = true;
    assetLoaded();
}

function loadImage(key, src) {
    assets.total++;
    assets.images[key] = new Image();
    assets.images[key].src = src;
    assets.images[key].onload = assetLoaded;
    assets.images[key].onerror = () => assetFailed(src);
}

// --- DEFINE AND PRELOAD ALL ASSETS ---
for (let i = 1; i <= 4; i++) { loadImage(`char${i}`, `assets/char${i}.png`); }
loadImage('land1', 'assets/obstacles/Land_1.png');
loadImage('land2', 'assets/obstacles/Land_2.png');
loadImage('air1', 'assets/obstacles/Air_1.png');
loadImage('air2', 'assets/obstacles/Air_2.png');
const backgroundAssetList = [
    { name: 'Downtown', key: 'bgDowntown', src: 'assets/backgrounds/downtown.png' },
    { name: 'Gotham', key: 'bgGotham', src: 'assets/backgrounds/gotham.png' },
    { name: 'New Delhi', key: 'bgNewDelhi', src: 'assets/backgrounds/newdelhi.png' },
    { name: 'New York', key: 'bgNewYork', src: 'assets/backgrounds/newyork.png' },
    { name: 'Tokyo', key: 'bgTokyo', src: 'assets/backgrounds/tokyo.png' }
];
backgroundAssetList.forEach(bg => loadImage(bg.key, bg.src));

const jumpSound = new Audio('assets/sounds/jump.mp3');
const gameOverSound = new Audio('assets/sounds/gameOver.mp3');
const backgroundMusic = new Audio('assets/sounds/music.mp3');
backgroundMusic.loop = true;
const selectSound = new Audio('assets/sounds/select.mp3');
const menuMusic = new Audio('assets/sounds/menuMusic.mp3');
menuMusic.loop = true;
// --- END PRELOADER ---

const characterNames = ["Echo Prith", "Sayan X", "Sonic Sonai", "Super OM"];
const characterFireColors = ['#FFFFFF', '#00ffff', 'pink', 'yellow'];
let selectedCharIndex = 0;
let selectedBgIndex = 0;

let obstacles, gameSpeed, score, frameCount, nextSpawnThreshold;
let highScore = 0;
const savedHighScore = localStorage.getItem('zeroHorizonHighScore');
if (savedHighScore) { highScore = parseInt(savedHighScore, 10); }

let musicMuted = false;
let sfxMuted = false;
let gameState = 'loading';
let bgX = 0;
const INITIAL_GAME_SPEED = 5;
let particles = [];
let screenShakeDuration = 0;
let screenShakeIntensity = 0;
let powerUps = [];
let isShielded = false;
let shieldTimer = 0;
let player = { x: 370, y: 250, width: 60, height: 80, velocityY: 0, isJumping: false };
let animationFrame = 0;
const roadYPosition = canvas.height - 30;
let roadSegments = [];
const segmentWidth = 60; const segmentGap = 15;
const numSegments = Math.ceil(canvas.width / (segmentWidth + segmentGap)) + 1;
for (let i = 0; i < numSegments; i++) { roadSegments.push({ x: i * (segmentWidth + segmentGap), y: roadYPosition, width: segmentWidth, height: 30 }); }

const titleMenuButtons = [ { text: 'START', x: canvas.width / 2, y: canvas.height / 2 + 40, width: 140, height: 30 }, { text: 'OPTIONS', x: canvas.width / 2, y: canvas.height / 2 + 90, width: 180, height: 30 }, { text: 'QUIT', x: canvas.width / 2, y: canvas.height / 2 + 140, width: 120, height: 30 }];
const optionsMenuButtons = [ { text: 'Music', type: 'toggle', y: 250, width: 250, height: 30 }, { text: 'SFX', type: 'toggle', y: 300, width: 220, height: 30 }, { text: 'Back', type: 'action', y: canvas.height - 100, width: 120, height: 30 }];
const gameOverButtons = [ { text: 'RETRY', x: canvas.width / 2, y: canvas.height / 2 + 120, width: 140, height: 30 }, { text: 'MAIN MENU', x: canvas.width / 2, y: canvas.height / 2 + 170, width: 220, height: 30 }];
const pauseMenuButtons = [ { text: 'RESUME', x: canvas.width / 2, y: canvas.height / 2 + 60, width: 160, height: 30 }, { text: 'MAIN MENU', x: canvas.width / 2, y: canvas.height / 2 + 110, width: 220, height: 30 }];
const charSelectButtons = [ { text: '<', x: canvas.width / 2 - 150, y: canvas.height / 2 - 20, width: 60, height: 60 }, { text: '>', x: canvas.width / 2 + 150, y: canvas.height / 2 - 20, width: 60, height: 60 }];

function createExplosion(x, y, color) { const particleCount = 40; for (let i = 0; i < particleCount; i++) { particles.push({ x: x, y: y, size: Math.random() * 3 + 2, color: color, life: 30, velX: (Math.random() - 0.5) * 8, velY: (Math.random() - 0.5) * 8 }); } }
function showMenu() { gameState = 'menu'; backgroundMusic.pause(); backgroundMusic.currentTime = 0; if (!musicMuted) menuMusic.play(); }

function initializeGame() {
    menuMusic.pause(); menuMusic.currentTime = 0;
    player.x = 50; player.y = roadYPosition - player.height; player.velocityY = 0; player.isJumping = false;
    obstacles = []; particles = []; powerUps = []; isShielded = false; shieldTimer = 0;
    gameSpeed = INITIAL_GAME_SPEED; score = 0; frameCount = 0; nextSpawnThreshold = 150;
    gameState = 'playing';
    if (!musicMuted) backgroundMusic.play();
}
const gravity = 0.8; const jumpStrength = -22;

function spawnPowerUp() { powerUps.push({ x: canvas.width, y: roadYPosition - 40, width: 30, height: 30, type: 'shield' }); }
function spawnObstacle() {
    if (gameState !== 'playing') return;
    const spawnFlying = score > 1500 && Math.random() < 0.3;
    if (spawnFlying) { const image = Math.random() < 0.5 ? assets.images.air1 : assets.images.air2; obstacles.push({ x: canvas.width, y: roadYPosition - 110, width: 90, height: 60, image: image }); } 
    else { const image = Math.random() < 0.5 ? assets.images.land1 : assets.images.land2; obstacles.push({ x: canvas.width, y: roadYPosition - 60, width: 100, height: 60, image: image }); }
}

function playSelectSound() { if (!sfxMuted) { selectSound.currentTime = 0; selectSound.play(); } }

function processInput(inputX, inputY) {
    if (gameState === 'titleScreen') { for (const button of titleMenuButtons) { if (inputX > button.x - button.width / 2 && inputX < button.x + button.width / 2 && inputY > button.y - button.height / 2 && inputY < button.y + button.height / 2) { playSelectSound(); if (button.text === 'START') gameState = 'backgroundSelect'; else if (button.text === 'OPTIONS') gameState = 'optionsScreen'; else if (button.text === 'QUIT') gameState = 'quitScreen'; } } } 
    else if (gameState === 'backgroundSelect') { playSelectSound(); showMenu(); } 
    else if (gameState === 'optionsScreen') { for (const button of optionsMenuButtons) { const buttonX = canvas.width / 2; if (inputX > buttonX - button.width / 2 && inputX < buttonX + button.width / 2 && inputY > button.y - button.height / 2 && inputY < button.y + button.height / 2) { playSelectSound(); if (button.text === 'Music') { musicMuted = !musicMuted; if (musicMuted) { menuMusic.pause(); backgroundMusic.pause(); } else if (gameState === 'optionsScreen') menuMusic.play(); } else if (button.text === 'SFX') { sfxMuted = !sfxMuted; } else if (button.text === 'Back') { gameState = 'titleScreen'; } } } } 
    else if (gameState === 'paused') { for (const button of pauseMenuButtons) { if (inputX > button.x - button.width / 2 && inputX < button.x + button.width / 2 && inputY > button.y - button.height / 2 && inputY < button.y + button.height / 2) { playSelectSound(); if (button.text === 'RESUME') { gameState = 'playing'; if (!musicMuted) backgroundMusic.play(); } else if (button.text === 'MAIN MENU') { backgroundMusic.pause(); backgroundMusic.currentTime = 0; gameState = 'titleScreen'; } } } } 
    else if (gameState === 'gameOver') { for (const button of gameOverButtons) { if (inputX > button.x - button.width / 2 && inputX < button.x + button.width / 2 && inputY > button.y - button.height / 2 && inputY < button.y + button.height / 2) { playSelectSound(); if (button.text === 'RETRY') showMenu(); else if (button.text === 'MAIN MENU') { menuMusic.pause(); menuMusic.currentTime = 0; gameState = 'titleScreen'; } } } } 
    else if (gameState === 'menu') { let arrowClicked = false; for (const button of charSelectButtons) { if (inputX > button.x - button.width / 2 && inputX < button.x + button.width / 2 && inputY > button.y - button.height / 2 && inputY < button.y + button.height / 2) { arrowClicked = true; playSelectSound(); if (button.text === '>') selectedCharIndex = (selectedCharIndex + 1) % 4; else selectedCharIndex = (selectedCharIndex - 1 + 4) % 4; } } if (!arrowClicked) initializeGame(); } 
    else if (gameState === 'playing' && !player.isJumping) { player.isJumping = true; player.velocityY = jumpStrength; if (!sfxMuted) jumpSound.play(); }
}

function handleMouseInput(event) {
    const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
    const mouseX = (event.clientX - rect.left) * scaleX; const mouseY = (event.clientY - rect.top) * scaleY;
    processInput(mouseX, mouseY);
}
function handleTouchInput(event) {
    event.preventDefault(); const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
    const touchX = (event.touches[0].clientX - rect.left) * scaleX; const touchY = (event.touches[0].clientY - rect.top) * scaleY;
    processInput(touchX, touchY);
}

function handleKeyboardInput(event) {
    if (event.code === 'Escape') { if (gameState === 'playing') { gameState = 'paused'; backgroundMusic.pause(); } else if (gameState === 'paused') { gameState = 'playing'; if (!musicMuted) backgroundMusic.play(); } else if (['optionsScreen', 'menu', 'backgroundSelect'].includes(gameState)) { gameState = 'titleScreen'; menuMusic.pause(); menuMusic.currentTime = 0; } }
    if (gameState === 'backgroundSelect') { if (event.code === 'ArrowRight') { selectedBgIndex = (selectedBgIndex + 1) % backgroundAssetList.length; playSelectSound(); } else if (event.code === 'ArrowLeft') { selectedBgIndex = (selectedBgIndex - 1 + backgroundAssetList.length) % backgroundAssetList.length; playSelectSound(); } } 
    else if (gameState === 'menu') { if (event.code === 'ArrowRight') { selectedCharIndex = (selectedCharIndex + 1) % 4; playSelectSound(); } else if (event.code === 'ArrowLeft') { selectedCharIndex = (selectedCharIndex - 1 + 4) % 4; playSelectSound(); } }
    if (event.code === 'Space') { if (gameState === 'playing' && !player.isJumping) { player.isJumping = true; player.velocityY = jumpStrength; if (!sfxMuted) jumpSound.play(); } else if (gameState === 'backgroundSelect') { playSelectSound(); showMenu(); } else if (gameState === 'menu') { initializeGame(); } }
}

document.addEventListener('keydown', handleKeyboardInput);
canvas.addEventListener('click', handleMouseInput);
canvas.addEventListener('touchstart', handleTouchInput);

function drawMenuOverlay(ctx) { ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }

function gameLoop() {
    if (gameState !== 'paused') animationFrame++;
    if (gameState === 'playing') {
        score++; frameCount++; gameSpeed += 0.001; bgX -= gameSpeed / 4; if (bgX <= -canvas.width) bgX = 0;
        for(const segment of roadSegments) { segment.x -= gameSpeed; if (segment.x + segment.width < 0) segment.x += numSegments * (segmentWidth + segmentGap); }
        for (let i = 0; i < Math.floor(gameSpeed / 4); i++) { particles.push({ x: player.x + 10, y: player.y + player.height - 20 + (Math.random() * 10 - 5), size: Math.random() * 2 + 1, color: characterFireColors[selectedCharIndex], life: 20, velX: -gameSpeed, velY: 0 }); }
        if (isShielded) { shieldTimer--; if (shieldTimer <= 0) isShielded = false; }
        if (frameCount > nextSpawnThreshold) { spawnObstacle(); nextSpawnThreshold += Math.floor(Math.random() * (150) + 100) / (gameSpeed / INITIAL_GAME_SPEED); }
        if (frameCount > 0 && frameCount % 600 === 0) spawnPowerUp();
        player.velocityY += gravity; player.y += player.velocityY;
        if (player.y + player.height > roadYPosition) { player.y = roadYPosition - player.height; player.velocityY = 0; player.isJumping = false; }
        for (const obs of obstacles) {
            obs.x -= gameSpeed;
            if (checkCollision(player, obs) && !isShielded) {
                createExplosion(player.x + player.width / 2, player.y + player.height / 2, characterFireColors[selectedCharIndex]);
                screenShakeDuration = 15; screenShakeIntensity = 10;
                backgroundMusic.pause(); backgroundMusic.currentTime = 0; 
                if (!sfxMuted) gameOverSound.play();
                gameState = 'gameOver';
                if (score > highScore) { highScore = score; localStorage.setItem('zeroHorizonHighScore', highScore); }
            }
        }
        obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
        for (let i = powerUps.length - 1; i >= 0; i--) { const p = powerUps[i]; p.x -= gameSpeed; if (checkCollision(player, p)) { isShielded = true; shieldTimer = 300; powerUps.splice(i, 1); } }
        powerUps = powerUps.filter(p => p.x + p.width > 0);
    }
    ctx.save();
    if (screenShakeDuration > 0) { const dx = (Math.random() - 0.5) * screenShakeIntensity; const dy = (Math.random() - 0.5) * screenShakeIntensity; ctx.translate(dx, dy); screenShakeDuration--; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'loading') {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF'; ctx.textAlign = 'center'; ctx.font = '24px "Press Start 2P"';
        ctx.fillText(`Loading... ${assets.loaded}/${assets.total}`, canvas.width / 2, canvas.height / 2);
        if(assets.error) { ctx.fillStyle = '#F00'; ctx.fillText(`Error loading assets. Check console (F12).`, canvas.width / 2, canvas.height / 2 + 40); }
    } else {
        const currentBgImage = assets.images[backgroundAssetList[selectedBgIndex].key];
        if (gameState === 'playing' || gameState === 'paused') { ctx.drawImage(currentBgImage, bgX, 0, canvas.width, canvas.height); ctx.drawImage(currentBgImage, bgX + canvas.width, 0, canvas.width, canvas.height); } 
        else { ctx.drawImage(currentBgImage, 0, 0, canvas.width, canvas.height); }
        const bobbingOffset = (gameState !== 'paused') ? Math.sin(animationFrame * 0.05) * 5 : 0;
        const pulse = Math.sin(animationFrame * 0.05) * 5 + 10;
        if (gameState !== 'playing' && gameState !== 'paused' && gameState !== 'gameOver') {
            ctx.fillStyle = '#0d506a'; for (const segment of roadSegments) { ctx.fillRect(segment.x, segment.y, segment.width, segment.height); }
            ctx.fillStyle = '#00ffff'; for (const segment of roadSegments) { ctx.fillRect(segment.x, segment.y, segment.width, 5); }
        }
        if (gameState === 'titleScreen') {
            drawMenuOverlay(ctx); ctx.textAlign = 'center'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = pulse; ctx.fillStyle = '#FFFFFF';
            ctx.font = '60px "Press Start 2P"'; ctx.fillText('Zero Horizon', canvas.width / 2, canvas.height / 2 - 50);
            ctx.font = '24px "Press Start 2P"'; for (const button of titleMenuButtons) { ctx.fillText(button.text, button.x, button.y); }
            ctx.shadowBlur = 0;
        } else if (gameState === 'backgroundSelect') {
            drawMenuOverlay(ctx); ctx.textAlign = 'center'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 8; ctx.fillStyle = '#FFFFFF';
            ctx.font = '36px "Press Start 2P"'; ctx.fillText('SELECT BACKGROUND', canvas.width / 2, 100);
            const currentBgName = backgroundAssetList[selectedBgIndex].name.toUpperCase();
            ctx.font = '48px "Press Start 2P"'; ctx.fillText(`< ${currentBgName} >`, canvas.width / 2, canvas.height / 2);
            ctx.font = '16px "Press Start 2P"'; ctx.fillText('Use Arrow Keys to Select', canvas.width / 2, canvas.height - 100); ctx.fillText('Press Space or Click to Continue', canvas.width / 2, canvas.height - 60);
            ctx.shadowBlur = 0;
        } else if (gameState === 'optionsScreen') {
            drawMenuOverlay(ctx); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
            ctx.font = '48px "Press Start 2P"'; ctx.fillText('Options', canvas.width / 2, 150);
            ctx.font = '24px "Press Start 2P"'; for (const button of optionsMenuButtons) { let buttonText = button.text; if (button.type === 'toggle') { const status = (button.text === 'Music' ? musicMuted : sfxMuted) ? 'OFF' : 'ON'; buttonText = `${button.text}: <${status}>`; } ctx.fillText(buttonText, canvas.width / 2, button.y); }
        } else if (gameState === 'quitScreen') {
            drawMenuOverlay(ctx); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
            ctx.font = '32px "Press Start 2P"'; ctx.fillText('Thanks for Playing!', canvas.width / 2, canvas.height / 2);
        } else if (gameState === 'menu') {
            drawMenuOverlay(ctx);
            const selectedImage = assets.images['char' + (selectedCharIndex + 1)];
            if (selectedImage.complete) {
                ctx.shadowColor = characterFireColors[selectedCharIndex]; ctx.shadowBlur = pulse;
                const charWidth = 180; const charHeight = 240; const charX = canvas.width / 2 - charWidth / 2; const charY = canvas.height / 2 - charHeight / 2 - 50;
                ctx.drawImage(selectedImage, charX, charY + bobbingOffset, charWidth, charHeight);
                ctx.shadowBlur = 0;
            }
            ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
            ctx.font = '24px "Press Start 2P"'; ctx.fillText('CHOOSE CHARACTER', canvas.width / 2, 80);
            const currentName = characterNames[selectedCharIndex];
            ctx.font = '32px "Press Start 2P"'; ctx.fillText(currentName, canvas.width / 2, canvas.height / 2 + 100);
            ctx.font = '40px "Press Start 2P"'; for (const button of charSelectButtons) { ctx.fillText(button.text, button.x, button.y); }
            ctx.font = '16px "Press Start 2P"'; ctx.fillText('Click or Press Space to Start', canvas.width / 2, canvas.height - 60);
        } else if (gameState === 'playing' || gameState === 'paused' || gameState === 'gameOver') {
            ctx.fillStyle = '#0d506a'; for(const segment of roadSegments) { ctx.fillRect(segment.x, segment.y, segment.width, segment.height); }
            ctx.fillStyle = '#00ffff'; for(const segment of roadSegments) { ctx.fillRect(segment.x, segment.y, segment.width, 5); }
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]; if (gameState !== 'paused') { p.life--; p.x += p.velX; p.y += p.velY; p.velY += 0.1; }
                if (p.life <= 0) { particles.splice(i, 1); } 
                else { ctx.globalAlpha = p.life / 30; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
            }
            ctx.shadowBlur = 0; ctx.globalAlpha = 1.0;
            for (const obs of obstacles) { if (obs.image && obs.image.naturalWidth > 0) { ctx.drawImage(obs.image, obs.x, obs.y, obs.width, obs.height); } }
            for (const p of powerUps) { ctx.fillStyle = 'white'; ctx.shadowColor = 'white'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(p.x + p.width / 2, p.y + p.height / 2, p.width / 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
            if (gameState === 'playing' || gameState === 'paused') {
                if (isShielded) { ctx.fillStyle = characterFireColors[selectedCharIndex]; ctx.globalAlpha = 0.2 + (Math.sin(animationFrame * 0.1) * 0.1); ctx.beginPath(); ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2 + 10, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; }
                const playerImage = assets.images['char' + (selectedCharIndex + 1)];
                ctx.drawImage(playerImage, player.x, player.y + bobbingOffset, player.width, player.height);
                ctx.fillStyle = '#FFFFFF'; ctx.font = '20px "Press Start 2P"';
                ctx.textAlign = 'left'; ctx.fillText(`Score: ${Math.floor(score / 10)}`, 10, 30);
                ctx.textAlign = 'right'; ctx.fillText(`High: ${Math.floor(highScore / 10)}`, canvas.width - 10, 30);
            }
            if (gameState === 'paused') {
                drawMenuOverlay(ctx); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.shadowColor = '#000000'; ctx.shadowBlur = 5;
                ctx.font = '50px "Press Start 2P"'; ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
                ctx.font = '24px "Press Start 2P"'; for (const button of pauseMenuButtons) { ctx.fillText(button.text, button.x, button.y); }
                ctx.shadowBlur = 0;
            }
            if (gameState === 'gameOver') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#FFFFFF'; ctx.font = '50px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);
                ctx.font = '20px "Press Start 2P"'; ctx.fillText(`Score: ${Math.floor(score / 10)}`, canvas.width / 2, canvas.height / 2 + 20);
                ctx.fillText(`High Score: ${Math.floor(highScore / 10)}`, canvas.width / 2, canvas.height / 2 + 60);
                ctx.font = '24px "Press Start 2P"'; for (const button of gameOverButtons) { ctx.fillText(button.text, button.x, button.y); }
            }
        }
    }
    
    ctx.restore();
    requestAnimationFrame(gameLoop);
}

function checkCollision(rect1, rect2) {
    return (rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y);
}

// Start the game by running the game loop, which will first show the loading screen
gameLoop();