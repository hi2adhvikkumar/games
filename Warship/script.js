const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const radarCountElement = document.getElementById('radar-count');

// Increase canvas size to fill the window so nothing gets cut off!
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
canvas.style.display = 'block';

canvas.width = window.innerWidth || 1200;
canvas.height = window.innerHeight || 800;

// Pre-generate frames of static/noise for the Black & White theme to keep performance high
const noisePatterns = [];
for (let j = 0; j < 4; j++) {
    const nCanvas = document.createElement('canvas');
    nCanvas.width = 128;
    nCanvas.height = 128;
    const nCtx = nCanvas.getContext('2d');
    const imgData = nCtx.createImageData(128, 128);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const val = Math.random() * 255;
        data[i] = val;     // Red
        data[i+1] = val;   // Green
        data[i+2] = val;   // Blue
        data[i+3] = 15 + Math.random() * 30; // Alpha (Opacity)
    }
    nCtx.putImageData(imgData, 0, 0);
    noisePatterns.push(ctx.createPattern(nCanvas, 'repeat'));
}

// Initialize audio and start game on any click or key press anywhere on the window
window.addEventListener('click', () => {
    initAudio();
});
window.addEventListener('keydown', (e) => {
    initAudio();
    let justStarted = false;
    if (!gameStarted) {
        gameStarted = true;
        justStarted = true;
        // Pre-spawn some ships inside the view so the player doesn't have to wait
        for (let i = 0; i < 4; i++) {
            let s = new Ship(Math.random() < 0.3 ? 'battleship' : 'normal');
            s.x = canvas.width / 2 + (Math.random() * 400) - 200;
            ships.push(s);
        }
    }
    // Add keyboard shortcut 'U' to open upgrades
    if (e.key && e.key.toLowerCase() === 'u') {
        isUpgradesOpen = !isUpgradesOpen;
        if (isUpgradesOpen) isMenuOpen = false;
    }
    // Add keyboard shortcut 'N' for Night Vision
    if (e.key && e.key.toLowerCase() === 'n') {
        nightVisionEnabled = !nightVisionEnabled;
        if (nightVisionEnabled) {
            scoreElement.style.color = '#00ff00';
            scoreElement.style.textShadow = '0 0 5px #00ff00';
            radarCountElement.style.color = '#00ff00';
            radarCountElement.style.textShadow = '0 0 5px #00ff00';
        } else {
            scoreElement.style.color = '#00BFFF';
            scoreElement.style.textShadow = '0 0 5px #00BFFF';
            radarCountElement.style.color = '#00BFFF';
            radarCountElement.style.textShadow = '0 0 5px #00BFFF';
        }
    }
    // Add keyboard shortcut 'B' for Black and White theme
    if (e.key && e.key.toLowerCase() === 'b') {
        blackAndWhiteEnabled = !blackAndWhiteEnabled;
        canvas.style.filter = blackAndWhiteEnabled ? 'grayscale(100%)' : 'none';
        const bossBtnHtml = document.getElementById('boss-btn-html');
        if (bossBtnHtml) {
            bossBtnHtml.style.backgroundColor = blackAndWhiteEnabled ? 'rgba(0, 0, 0, 0.9)' : 'rgba(150, 40, 40, 0.9)';
        }
    }
    // Cheat code 'X' to instantly spawn the Boss (Dreadnought)
    if (e.key && e.key.toLowerCase() === 'x') {
        spawnDreadnoughtPending = true;
        dreadnoughtWarningTimer = 180;
    }
    // Cheat code 'Z' to instantly spawn the Massive Juggernaut
    if (e.key && e.key.toLowerCase() === 'z') {
        spawnJuggernautPending = true;
        juggernautWarningTimer = 240;
    }
    // Keyboard shortcuts 'Escape' or 'P' to pause/open menu
    if (e.key && (e.key === 'Escape' || e.key.toLowerCase() === 'p')) {
        if (isUpgradesOpen) {
            isUpgradesOpen = false; // Close upgrades if it's open
        } else {
            isMenuOpen = !isMenuOpen; // Otherwise toggle the pause menu
        }
    }
    // Spacebar to shoot
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // Prevent the page from scrolling down
        if (!justStarted && !isMenuOpen && !isUpgradesOpen) {
            shoot();
        }
    }
});

window.addEventListener('wheel', (e) => {
    if (!gameStarted || isMenuOpen || isUpgradesOpen) return;
    // Scroll up to zoom in, scroll down to zoom out
    if (e.deltaY < 0) zoomLevel += 0.15;
    else if (e.deltaY > 0) zoomLevel -= 0.15;
    if (zoomLevel < 1.0) zoomLevel = 1.0;
    if (zoomLevel > 3.0) zoomLevel = 3.0; // Limit maximum zoom
});

const addBossBtn = () => {
    if (document.getElementById('boss-btn-html')) return;
    if (!document.body) {
        setTimeout(addBossBtn, 50); // Wait until body exists
        return;
    }
    const btn = document.createElement('button');
    btn.id = 'boss-btn-html';
    btn.textContent = 'SPAWN BOSS';
    Object.assign(btn.style, {
        position: 'absolute',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '20px 40px',
        fontSize: '24px',
        fontWeight: 'bold',
        backgroundColor: 'rgba(150, 40, 40, 0.9)',
        color: '#ffffff',
        zIndex: '999999',
        border: '2px solid #ffffff',
        borderRadius: '8px',
        cursor: 'pointer'
    });
    btn.onclick = (e) => {
        e.stopPropagation();
        initAudio();
        if (!gameStarted) gameStarted = true;
        spawnDreadnoughtPending = true;
        dreadnoughtWarningTimer = 180;
    };
    document.body.appendChild(btn);
};
addBossBtn();

let score = 0;
let highScore = parseInt(localStorage.getItem('warshipHighScore')) || 0;
let credits = 0;
let projSpeedBonus = 0;
let ammoBonus = 0;
let radarBonus = 0;
let homingBonus = 0;
scoreElement.textContent = `Sunken Ships: ${score} | Best: ${highScore} | Credits: $${credits}`;
scoreElement.style.display = 'none'; // Hide HTML element to draw on canvas instead
radarCountElement.style.display = 'none'; // Hide HTML element to draw on canvas instead

let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let time = 0;
let weaponType = 'single';
let tripleAmmo = 40;
let homingAmmo = 0;
let isMenuOpen = false;
let isUpgradesOpen = false;
let gameStarted = false;
let nightVisionEnabled = false;
let blackAndWhiteEnabled = false;
let shakeIntensity = 0;
let dreadnoughtActive = false;
let juggernautActive = false;
let nextBossScore = 20; // Trigger the boss naturally every 20 points
let nextJuggernautScore = 100; // Trigger the massive boss every 100 points
let spawnDreadnoughtPending = false; 
let spawnJuggernautPending = false; 
let dreadnoughtWarningTimer = 0;
let juggernautWarningTimer = 0;

const turret = {
    x: canvas.width / 2,
    y: canvas.height / 2 + 300, // At the bottom of the periscope view
    angle: 0
};

let projectiles = [];
let ships = [];
let explosions = [];
let crates = [];
let mines = [];
let clouds = [];
let planes = [];
let bombs = [];
let splashes = [];
let glassCracks = [];
let stormIntensity = 0;
let targetStormIntensity = 0;
let lightningFlash = 0;
let raindrops = [];
let rainMultiplier = 1.0;
let targetRainMultiplier = 1.0;
let zoomLevel = 1.0;

let stickyNoteState = 0;
const stickyMessages = [
    "CHEAT:\nPRESS 'X' TO\nSPAWN BOSS",
    "NOTE:\nWE ARE OUT\nOF COFFEE!!",
    "WASH YOUR\nCOFFEE MUG!!"
];

const interactiveGauges = {
    pressure: { offset: 0, velocity: 0, isDragging: false },
    heading: { offset: 0, velocity: 0, isDragging: false },
    depth: { offset: 0, velocity: 0, isDragging: false },
    rpm: { offset: 0, velocity: 0, isDragging: false }
};
let draggedGauge = null;

for (let i = 0; i < 6; i++) {
    clouds.push({
        x: Math.random() * 800,
        y: Math.random() * 200 + 50,
        speed: Math.random() * 0.2 + 0.05,
        scale: Math.random() * 0.6 + 0.3
    });
}

const horizonY = canvas.height / 2; // Horizon in the middle of view

const viewLeft = canvas.width / 2 - 300;
const viewRight = canvas.width / 2 + 300;
const viewTop = canvas.height / 2 - 300;
const viewBottom = canvas.height / 2 + 300;

function updateTurretAngle() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    // Inverse transform the mouse coordinates back to the world space accounting for zoom
    const worldMouseX = (mouseX - cx) / zoomLevel + cx;
    const worldMouseY = (mouseY - cy) / zoomLevel + cy;
    
    const dx = worldMouseX - turret.x;
    const dy = worldMouseY - turret.y;
    turret.angle = Math.atan2(dy, dx);
}

function shoot() {
    if (weaponType === 'single') {
        projectiles.push(new Projectile(turret.x, turret.y, turret.angle, 12 + projSpeedBonus * 2, horizonY, false));
        playShootSound();
    } else if (weaponType === 'triple' && tripleAmmo > 0) {
        projectiles.push(new Projectile(turret.x, turret.y, turret.angle, 8 + projSpeedBonus * 2, horizonY, false));
        projectiles.push(new Projectile(turret.x, turret.y, turret.angle - 0.15, 8 + projSpeedBonus * 2, horizonY, false));
        projectiles.push(new Projectile(turret.x, turret.y, turret.angle + 0.15, 8 + projSpeedBonus * 2, horizonY, false));
        playShootSound();
        tripleAmmo--;
        if (tripleAmmo <= 0) {
            weaponType = homingAmmo > 0 ? 'homing' : 'single'; // Auto-switch when out of ammo
        }
    } else if (weaponType === 'homing' && homingAmmo > 0) {
        projectiles.push(new Projectile(turret.x, turret.y, turret.angle, 10 + projSpeedBonus * 2, horizonY, true));
        playShootSound();
        homingAmmo--;
        if (homingAmmo <= 0) {
            weaponType = 'single';
        }
    }
}

function spawnShip() {
    if (dreadnoughtActive || juggernautActive) return; // Stop spawning normal ships during the boss phase
    
    if (Math.random() < 0.05) { // Increased spawn rate from 2% to 5% per frame
        const rand = Math.random();
        let type = 'normal';
        if (rand < 0.25) type = 'battleship'; // 25% chance
        else if (rand < 0.35) type = 'aircraftcarrier'; // 10% chance
        else if (rand < 0.55) type = 'ptboat'; // 20% chance
        else if (rand < 0.70) type = 'submarine'; // 15% chance
        ships.push(new Ship(type));
    }
}

function spawnCrate() {
    // Limit to 2 active crates at a time and higher spawn rate
    if (crates.length < 2 && Math.random() < 0.005) { 
        crates.push(new Crate());
    }
}

function spawnMine() {
    if (mines.length < 1 && Math.random() < 0.005) { 
        mines.push(new Mine());
    }
}

function spawnPlane() {
    if (planes.length < 2 && Math.random() < 0.005) { // Occasional air support
        planes.push(new Plane());
    }
}

function checkBossTriggers() {
    if (score >= nextJuggernautScore) {
        nextJuggernautScore += 100;
        if (nextBossScore <= score) nextBossScore = score + 20; // Skip Dreadnought to not overlap
        spawnJuggernautPending = true;
        juggernautWarningTimer = 240;
    } else if (score >= nextBossScore) {
        nextBossScore += 20;
        spawnDreadnoughtPending = true;
        dreadnoughtWarningTimer = 180;
    }
}

function crackGlass(sourceX, sourceY) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const screenX = (sourceX - cx) * zoomLevel + cx;
    const screenY = (sourceY - cy) * zoomLevel + cy;
    
    let crackLines = [];
    let concentricRings = [];
    const numRays = 7 + Math.floor(Math.random() * 6); // Spiderweb rays
    
    for (let r = 0; r < numRays; r++) {
        let angle = (r / numRays) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        let length = 300 + Math.random() * 800; // Length of the crack
        let segments = [];
        let curX = screenX, curY = screenY;
        
        // Make the ray jagged
        for (let j = 0; j < 8; j++) {
            let segLen = length / 8;
            let segAngle = angle + (Math.random() - 0.5) * 0.5;
            curX += Math.cos(segAngle) * segLen;
            curY += Math.sin(segAngle) * segLen;
            segments.push({ x: curX, y: curY });
        }
        crackLines.push(segments);
        
        // Connect this ray to the next one to create concentric spiderweb breaks
        if (Math.random() > 0.3) {
            let nextR = (r + 1) % numRays;
            let ringRadius = 50 + Math.random() * 300;
            let p1x = screenX + Math.cos((r / numRays) * Math.PI * 2) * ringRadius;
            let p1y = screenY + Math.sin((r / numRays) * Math.PI * 2) * ringRadius;
            let p2x = screenX + Math.cos((nextR / numRays) * Math.PI * 2) * ringRadius * (0.8 + Math.random() * 0.4);
            let p2y = screenY + Math.sin((nextR / numRays) * Math.PI * 2) * ringRadius * (0.8 + Math.random() * 0.4);
            concentricRings.push({ x1: p1x, y1: p1y, x2: p2x, y2: p2y });
        }
    }
    glassCracks.push({ x: screenX, y: screenY, lines: crackLines, rings: concentricRings, life: 1.0 });
}

function checkCollisions() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        let hit = false;
        
        // Check collision with ships
        for (let j = ships.length - 1; j >= 0; j--) {
            const ship = ships[j];
            const dx = proj.x - ship.x;
            const dy = proj.y - ship.y;
            if (Math.abs(dx) < proj.radius + ship.width / 2 && Math.abs(dy) < proj.radius + ship.height / 2) {
                if (ship.type === 'submarine' && ship.depth > 5) continue; // Too deep to hit!

                explosions.push(new Explosion(ship.x, ship.y));
                playExplosionSound();
                shakeIntensity = 8; // Trigger screen shake
                projectiles.splice(i, 1);
                
                ship.hp -= 1;
                if (ship.hp <= 0) {
                    ships.splice(j, 1);
                    score += 1;
                    if (ship.type === 'juggernaut') {
                        for (let step = -200; step <= 200; step += 80) {
                            explosions.push(new Explosion(ship.x + step, ship.y + (Math.random() * 40 - 20), true));
                        }
                        playMassiveExplosionSound();
                        crackGlass(ship.x, ship.y);
                        shakeIntensity = 40; // Enormous screen shake!
                        juggernautActive = false;
                        credits += 500; // Massive boss defeated!
                    } else if (ship.type === 'dreadnought') {
                        dreadnoughtActive = false;
                        credits += 150; // Boss defeated!
                    } else if (ship.type === 'aircraftcarrier') {
                        credits += 50; // High reward for carrier!
                    } else if (ship.type === 'submarine') {
                        credits += 40; // High reward for sub!
                    } else {
                        credits += (ship.type === 'battleship' ? 30 : (ship.type === 'ptboat' ? 20 : 10));
                    }
                    
                    checkBossTriggers();
                    
                    if (score > highScore) {
                        highScore = score;
                        localStorage.setItem('warshipHighScore', highScore);
                    }
                    scoreElement.textContent = `Sunken Ships: ${score} | Best: ${highScore} | Credits: $${credits}`;
                }
                hit = true;
                break;
            }
        }
        
        if (hit) continue; // If the projectile already hit a ship, skip checking planes

        // Check collision with planes
        for (let p = planes.length - 1; p >= 0; p--) {
            const plane = planes[p];
            const dx = proj.x - plane.x;
            const dy = proj.y - plane.y;
            if (Math.abs(dx) < proj.radius + plane.width / 2 && Math.abs(dy) < proj.radius + plane.height / 2) {
                explosions.push(new Explosion(plane.x, plane.y));
                playExplosionSound();
                projectiles.splice(i, 1);
                
                plane.hp -= 1;
                if (plane.hp <= 0) {
                    planes.splice(p, 1);
                    score += 2; // Planes give double points!
                    credits += 25;
                    
                    checkBossTriggers();
                    if (score > highScore) {
                        highScore = score;
                        localStorage.setItem('warshipHighScore', highScore);
                    }
                    scoreElement.textContent = `Sunken Ships: ${score} | Best: ${highScore} | Credits: $${credits}`;
                }
                hit = true;
                break;
            }
        }
        
        if (hit) continue; // If the projectile already hit a ship, skip checking crates
        
        // Check collision with bombs
        for (let b = bombs.length - 1; b >= 0; b--) {
            const bomb = bombs[b];
            const dx = proj.x - bomb.x;
            const dy = proj.y - bomb.y;
            if (Math.abs(dx) < proj.radius + bomb.width / 2 && Math.abs(dy) < proj.radius + bomb.height / 2) {
                explosions.push(new Explosion(bomb.x, bomb.y));
                playExplosionSound();
                projectiles.splice(i, 1);
                bombs.splice(b, 1);
                
                credits += 15; // Reward for shooting bombs out of the air!
                scoreElement.textContent = `Sunken Ships: ${score} | Best: ${highScore} | Credits: $${credits}`;
                hit = true;
                break;
            }
        }
        
        if (hit) continue; // Skip checking crates if a bomb was hit

        // Check collision with crates
        for (let k = crates.length - 1; k >= 0; k--) {
            const crate = crates[k];
            const dx = proj.x - crate.x;
            const dy = proj.y - crate.y;
            if (Math.abs(dx) < proj.radius + crate.width / 2 && Math.abs(dy) < proj.radius + crate.height / 2) {
                explosions.push(new Explosion(crate.x, crate.y));
                playExplosionSound();
                projectiles.splice(i, 1);
                crates.splice(k, 1);
                tripleAmmo += (tripleAmmo <= 30) ? (7 + ammoBonus * 3) : 2; // Replenish ammo when destroyed
                if (homingBonus > 0) {
                    homingAmmo += (homingAmmo <= 15) ? (3 + ammoBonus * 1) : 1; // Also replenish homing ammo
                }
                hit = true;
                break;
            }
        }
        
        if (hit) continue; // Skip checking mines if a crate was hit

        // Check collision with mines
        for (let m = mines.length - 1; m >= 0; m--) {
            const mine = mines[m];
            const dx = proj.x - mine.x;
            const dy = proj.y - mine.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < proj.radius + mine.radius) {
                playExplosionSound();
                shakeIntensity = 15; // Massive screen shake for a mine explosion
                projectiles.splice(i, 1);
                
                // Enormous visual explosion burst
                for(let e = 0; e < 5; e++) {
                    explosions.push(new Explosion(mine.x + (Math.random() - 0.5) * 60, mine.y + (Math.random() - 0.5) * 60));
                }
                
                const blastRadius = 2000; // Massive AOE distance to destroy everything in view

                // Destroy ships in AOE
                for (let s = ships.length - 1; s >= 0; s--) {
                    const ship = ships[s];
                    const sdx = ship.x - mine.x;
                    const sdy = ship.y - mine.y;
                    const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
                    if (sdist < blastRadius + ship.width / 2) {
                        explosions.push(new Explosion(ship.x, ship.y));
                        ship.hp -= 5; // Mines do massive damage
                        if (ship.hp <= 0) {
                            ships.splice(s, 1);
                            score += 1;
                            if (ship.type === 'juggernaut') {
                                for (let step = -200; step <= 200; step += 80) {
                                    explosions.push(new Explosion(ship.x + step, ship.y + (Math.random() * 40 - 20), true));
                                }
                                playMassiveExplosionSound();
                                crackGlass(ship.x, ship.y);
                                shakeIntensity = 40;
                                juggernautActive = false;
                                credits += 500;
                            } else if (ship.type === 'dreadnought') {
                                dreadnoughtActive = false;
                                credits += 150;
                            } else if (ship.type === 'aircraftcarrier') {
                                credits += 50;
                            } else if (ship.type === 'submarine') {
                                credits += 40;
                            } else {
                                credits += (ship.type === 'battleship' ? 30 : (ship.type === 'ptboat' ? 20 : 10));
                            }
                            
                            checkBossTriggers();
                        }
                    }
                }
                
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('warshipHighScore', highScore);
                }
                scoreElement.textContent = `Sunken Ships: ${score} | Best: ${highScore} | Credits: $${credits}`;
                
                // Destroy crates in AOE
                for (let c = crates.length - 1; c >= 0; c--) {
                    const crate = crates[c];
                    const cdx = crate.x - mine.x;
                    const cdy = crate.y - mine.y;
                    const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
                    if (cdist < blastRadius + crate.width / 2) {
                        explosions.push(new Explosion(crate.x, crate.y));
                        crates.splice(c, 1);
                        tripleAmmo += (tripleAmmo <= 30) ? (7 + ammoBonus * 3) : 2;
                        if (homingBonus > 0) {
                            homingAmmo += (homingAmmo <= 15) ? (3 + ammoBonus * 1) : 1;
                        }
                    }
                }
                
                // Destroy planes in AOE
                for (let p = planes.length - 1; p >= 0; p--) {
                    const plane = planes[p];
                    const pdx = plane.x - mine.x;
                    const pdy = plane.y - mine.y;
                    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
                    if (pdist < blastRadius + plane.width / 2) {
                        explosions.push(new Explosion(plane.x, plane.y));
                        planes.splice(p, 1);
                        score += 2;
                        credits += 25;
                        checkBossTriggers();
                    }
                }
                
                mines.splice(m, 1);
                hit = true;
                break;
            }
        }
    }
}

function update() {
    updateTurretAngle();
    time += 0.05; // For wave animation
    
    // Friction for interactive gauges (keeps them where dragged, allows button spins to slow down)
    for (let key in interactiveGauges) {
        let g = interactiveGauges[key];
        if (!g.isDragging) {
            g.velocity *= 0.85; // Friction
            g.offset += g.velocity;
        }
    }
    
    if (shakeIntensity > 0) {
        shakeIntensity -= 0.5;
        if (shakeIntensity < 0) shakeIntensity = 0;
    }

    if (dreadnoughtWarningTimer > 0) {
        dreadnoughtWarningTimer--;
    }
    if (juggernautWarningTimer > 0) {
        juggernautWarningTimer--;
    }

    let activeProjectiles = [];
    projectiles.forEach(proj => {
        proj.update();
        if (!proj.isOffScreen()) {
            activeProjectiles.push(proj);
        } else if (proj.y <= proj.targetY && proj.x >= viewLeft && proj.x <= viewRight) {
            let waveY = proj.targetY;
            if (proj.targetY === horizonY) { // Add natural wave bobbing only if it hit the horizon
                const horizonOffset = Math.sin(time * 0.8) * 2.4;
                waveY = horizonY + Math.sin((proj.x * 0.03) + time * 0.8) * 3.2 + Math.cos((proj.x * 0.015) + time * 0.9) * 1.2 + horizonOffset * 0.5;
            }
            splashes.push(new Splash(proj.x, waveY));
            playSplashSound();
        }
    });
    projectiles = activeProjectiles;

    ships.forEach(ship => ship.update());
    ships = ships.filter(ship => !ship.isOffScreen());

    crates.forEach(crate => crate.update());
    crates = crates.filter(crate => !crate.isOffScreen());

    mines.forEach(mine => mine.update());
    mines = mines.filter(mine => !mine.isOffScreen());

    planes.forEach(plane => plane.update());
    planes = planes.filter(plane => {
        if (plane.isOffScreen()) {
            credits = Math.max(0, credits - 10); // Lose 10 credits if a plane escapes!
            scoreElement.textContent = `Sunken Ships: ${score} | Best: ${highScore} | Credits: $${credits}`;
            return false;
        }
        return true;
    });
    
    let activeBombs = [];
    bombs.forEach(bomb => {
        bomb.update();
        if (!bomb.isOffScreen()) {
            activeBombs.push(bomb);
        } else {
            // Bomb successfully hit the water!
            explosions.push(new Explosion(bomb.x, bomb.y, false));
            explosions.push(new Explosion(bomb.x + 20, bomb.y - 10, false));
            playExplosionSound();
            crackGlass(bomb.x, bomb.y); // Shatter the screen!
            shakeIntensity = 25; // Massive screen shake
            credits = Math.max(0, credits - 20); // Big penalty
            scoreElement.textContent = `Sunken Ships: ${score} | Best: ${highScore} | Credits: $${credits}`;
        }
    });
    bombs = activeBombs;

    explosions.forEach(exp => exp.update());
    explosions = explosions.filter(exp => !exp.isDead());

    splashes.forEach(splash => splash.update());
    splashes = splashes.filter(splash => !splash.isDead());

    glassCracks.forEach(crack => crack.life -= 0.002); // Slowly fade out over time
    glassCracks = glassCracks.filter(crack => crack.life > 0);

    clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x < -100) cloud.x = canvas.width + 100;
    });

    // Weather logic
    if (Math.random() < 0.001) { // 0.1% chance every frame to change weather
        targetStormIntensity = targetStormIntensity > 0 ? 0.0 : 1.0;
        targetRainMultiplier = (targetStormIntensity > 0 && Math.random() < 0.3) ? 4.0 : 1.0; // 30% chance for an extreme downpour
    }

    // Random squalls during an active storm
    if (targetStormIntensity > 0 && Math.random() < 0.002) {
        targetRainMultiplier = Math.random() < 0.4 ? 5.0 : 1.0; // Randomly pour extra hard
    }
    
    if (stormIntensity < targetStormIntensity) {
        stormIntensity += 0.002;
        if (stormIntensity > targetStormIntensity) stormIntensity = targetStormIntensity;
    } else if (stormIntensity > targetStormIntensity) {
        stormIntensity -= 0.002;
        if (stormIntensity < targetStormIntensity) stormIntensity = targetStormIntensity;
    }

    if (rainMultiplier < targetRainMultiplier) {
        rainMultiplier += 0.02;
    } else if (rainMultiplier > targetRainMultiplier) {
        rainMultiplier -= 0.02;
    }

    if (stormIntensity > 0.5 && Math.random() < 0.005) {
        lightningFlash = 1.0;
        setTimeout(playThunderSound, Math.random() * 800 + 200); // Light travels faster than sound! Delay the thunder
    }

    if (lightningFlash > 0) {
        lightningFlash -= 0.03;
        if (lightningFlash < 0) lightningFlash = 0;
    }

    if (stormIntensity > 0) {
        const exactRain = stormIntensity * 12 * rainMultiplier;
        const rainCount = Math.floor(exactRain); // Dynamic rain volume
        for (let i = 0; i < rainCount; i++) { raindrops.push(new Raindrop()); }
        if (Math.random() < exactRain % 1) { raindrops.push(new Raindrop()); }
    }

    raindrops.forEach(drop => drop.update());
    raindrops = raindrops.filter(drop => !drop.isOffScreen());

    spawnShip();
    spawnCrate();
    spawnMine();
    spawnPlane();
    checkCollisions();

    if (spawnJuggernautPending) {
        ships = []; // Stop all existing ships to make way for the Juggernaut
        ships.push(new Ship('juggernaut'));
        juggernautActive = true;
        spawnJuggernautPending = false;
    } else if (spawnDreadnoughtPending) {
        ships = []; // Stop all existing ships to make way for the Dreadnought
        ships.push(new Ship('dreadnought'));
        dreadnoughtActive = true;
        spawnDreadnoughtPending = false;
    }

    radarCountElement.textContent = `Ships on Radar: ${ships.length}`;
}

function lerpColor(c1, c2, factor) {
    const hex1 = c1.replace('#', '');
    const hex2 = c2.replace('#', '');
    const r1 = parseInt(hex1.substring(0,2), 16);
    const g1 = parseInt(hex1.substring(2,4), 16);
    const b1 = parseInt(hex1.substring(4,6), 16);
    const r2 = parseInt(hex2.substring(0,2), 16);
    const g2 = parseInt(hex2.substring(2,4), 16);
    const b2 = parseInt(hex2.substring(4,6), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * factor)}, ${Math.round(g1 + (g2 - g1) * factor)}, ${Math.round(b1 + (b2 - b1) * factor)})`;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply Screen Shake
    ctx.save();
    if (shakeIntensity > 0) {
        const dx = (Math.random() - 0.5) * shakeIntensity;
        const dy = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(dx, dy);
    }

    // Clip to the periscope view (circular)
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 300, 0, Math.PI * 2);
    ctx.clip();

    // Apply Zoom to the World View
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Draw sky with gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGradient.addColorStop(0, lerpColor('#2b5a8c', '#1a1a24', stormIntensity));
    skyGradient.addColorStop(1, lerpColor('#87ceeb', '#4a5a6a', stormIntensity));
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, horizonY);

    // Draw drifting clouds
    const cloudTint = Math.floor(255 - 100 * stormIntensity);
    ctx.fillStyle = `rgba(${cloudTint}, ${cloudTint}, ${cloudTint}, 0.8)`;
    clouds.forEach(cloud => {
        ctx.save();
        ctx.translate(cloud.x, cloud.y);
        ctx.scale(cloud.scale, cloud.scale);
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.arc(25, -15, 35, 0, Math.PI * 2);
        ctx.arc(55, 0, 25, 0, Math.PI * 2);
        ctx.arc(25, 10, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Draw sun
    ctx.fillStyle = `rgba(255, 235, 180, ${0.9 * (1 - stormIntensity)})`;
    ctx.beginPath();
    ctx.arc(canvas.width * 0.75, horizonY - 45, 25, 0, Math.PI * 2);
    ctx.fill();

    // Draw horizon with stronger bumps and fill the water beneath it
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    const horizonOffset = Math.sin(time * 0.8) * 2.4;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + horizonOffset);
    for (let x = 10; x <= canvas.width; x += 10) {
        const y = horizonY + Math.sin((x * 0.03) + time * 0.8) * 3.2 + Math.cos((x * 0.015) + time * 0.9) * 1.2 + horizonOffset * 0.5;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    
    // Add depth gradient to the water
    const waterGradient = ctx.createLinearGradient(0, horizonY, 0, canvas.height);
    waterGradient.addColorStop(0, lerpColor('#1c4d7c', '#0e263e', stormIntensity)); 
    waterGradient.addColorStop(1, lerpColor('#001122', '#000408', stormIntensity)); 
    ctx.fillStyle = waterGradient;
    ctx.fill();
    
    // Draw shimmering sun reflection on the water
    ctx.fillStyle = `rgba(255, 235, 180, ${0.25 * (1 - stormIntensity)})`;
    for (let i = 0; i < 20; i++) {
        const width = 100 - i * 4 + Math.sin(time * 5 + i) * 15;
        const refY = horizonY + 2 + i * 8 + Math.sin(time * 2 + i * 0.5) * 2;
        ctx.fillRect(canvas.width * 0.75 - width / 2, refY, width, 3);
    }

    // Add a few large curved darker patches across the ocean (with perspective)
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
    for (let i = 0; i < 5; i++) {
        const depthFactor = i * 20 + (i * i) * 8; // Perspective scaling
        const baseY = horizonY + 30 + depthFactor;
        const startX = 60 + i * 110;
        const endX = startX + 170 + i * 50; // Get wider as they get closer
        const controlX = startX + (endX - startX) / 2;
        const controlY = baseY + Math.sin(time * 0.45 + i) * (12 + i * 3) + 8;
        ctx.lineWidth = 1.5 + i * 0.5;
        ctx.beginPath();
        ctx.moveTo(startX, baseY);
        ctx.quadraticCurveTo(controlX, controlY, endX, baseY);
        ctx.stroke();
    }
    ctx.restore();

    // Draw animated waves (whitecaps) on the water (with perspective)
    ctx.save();
    for (let i = 1; i <= 9; i++) {
        const depthFactor = i * 15 + (i * i) * 3.5;
        const waveBaseY = horizonY + depthFactor;
        
        if (waveBaseY > canvas.height / 2 + 300) break; // Don't draw past periscope view

        ctx.beginPath();
        ctx.lineWidth = 1 + i * 0.4;
        ctx.strokeStyle = `rgba(28, 77, 124, ${0.4 + i * 0.05})`;
        
        // Use dashes to make them look like individual wave crests
        ctx.setLineDash([80 + i * 15, 60 + i * 10]);
        ctx.lineDashOffset = -(time * (10 + i * 2) + i * 25); // Move them left over time
        
        for (let x = 0; x <= canvas.width; x += 20) {
            const waveAmplitude = (2 + i * 0.5);
            const waveY = waveBaseY + Math.sin((x * 0.04) + time * 1.5 + i) * waveAmplitude + Math.cos((x * 0.02) + time * 0.8) * (waveAmplitude * 0.6);
            if (x === 0) {
                ctx.moveTo(x, waveY);
            } else {
                ctx.lineTo(x, waveY);
            }
        }
        ctx.stroke();
    }
    ctx.restore();

    // Draw the horizon outline over the filled water
    ctx.beginPath();
    ctx.moveTo(0, horizonY + horizonOffset);
    for (let x = 10; x <= canvas.width; x += 10) {
        const y = horizonY + Math.sin((x * 0.03) + time * 0.8) * 3.2 + Math.cos((x * 0.015) + time * 0.9) * 1.2 + horizonOffset * 0.5;
        ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw planes (Before clouds so they can fly behind/through them)
    planes.forEach(plane => plane.draw());

    // Draw falling bombs
    bombs.forEach(bomb => bomb.draw());

    // Draw ships
    ships.forEach(ship => ship.draw());

    // Draw crates
    crates.forEach(crate => crate.draw());

    // Draw mines
    mines.forEach(mine => mine.draw());

    // Draw explosions
    explosions.forEach(exp => exp.draw());

    // Draw splashes
    splashes.forEach(splash => splash.draw());

    // Draw rain
    raindrops.forEach(drop => drop.draw());

    // Draw lightning flash (illuminates the entire periscope view)
    if (lightningFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${lightningFlash * 0.8})`;
        ctx.fillRect(-50, -50, canvas.width + 100, canvas.height + 100);
    }

    // Apply Night Vision green tint over the periscope
    if (nightVisionEnabled) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.35)'; // Classic night vision green
        ctx.fillRect(-50, -50, canvas.width + 100, canvas.height + 100);
    }

    ctx.restore(); // Restore from World Zoom

    ctx.restore();

    // Apply Zoom to projectiles
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Draw projectiles (not clipped, so they wrap around the bottom area)
    projectiles.forEach(proj => proj.draw());

    ctx.restore(); // Restore from Zoom to projectiles so it doesn't affect the UI and crosshair!

    // Draw periscope mask (Submarine Cockpit) and HUD overlay
    ctx.save();
    
    // Clip to everything outside the periscope circle to draw the cockpit
    ctx.save();
    ctx.beginPath();
    ctx.rect(-50, -50, canvas.width + 100, canvas.height + 100);
    ctx.arc(canvas.width / 2, canvas.height / 2, 300, 0, Math.PI * 2, true);
    ctx.clip();

    // 1. Metal Panel Background
    const metalGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (nightVisionEnabled) {
        metalGrad.addColorStop(0, '#002200');
        metalGrad.addColorStop(1, '#000a00');
    } else {
        metalGrad.addColorStop(0, '#3a4245');
        metalGrad.addColorStop(1, '#1a1e20');
    }
    ctx.fillStyle = metalGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Rusty Seams
    ctx.strokeStyle = nightVisionEnabled ? '#001100' : '#111';
    ctx.lineWidth = 6;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // --- Uneven Scrap Metal Panels ---
    ctx.beginPath();
    let currentY = -100;
    let rowIndex = 0;
    
    while (currentY < canvas.height + 200) {
        let rowHeight = 90 + Math.abs(Math.sin(rowIndex * 7.4)) * 140; // Height varies between 90 and 230
        
        ctx.moveTo(0, currentY);
        ctx.lineTo(canvas.width, currentY);
        
        let currentX = -100;
        let colIndex = 0;
        while (currentX < canvas.width + 200) {
            let panelWidth = 120 + Math.abs(Math.cos(rowIndex * 3.2 + colIndex * 5.1)) * 280; // Width varies between 120 and 400
            
            ctx.moveTo(currentX, currentY);
            ctx.lineTo(currentX, currentY + rowHeight);
            currentX += panelWidth;
            colIndex++;
        }
        currentY += rowHeight;
        rowIndex++;
    }
    ctx.stroke();

    // 3. Rivets
    const drawRivet = (rx, ry) => {
        ctx.fillStyle = nightVisionEnabled ? '#001100' : '#222';
        ctx.beginPath(); ctx.arc(rx, ry, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = nightVisionEnabled ? '#004400' : '#666';
        ctx.beginPath(); ctx.arc(rx - 1, ry - 1, 2, 0, Math.PI * 2); ctx.fill();
    };

    // Draw rivets along the uneven seams
    currentY = -100;
    rowIndex = 0;
    while (currentY < canvas.height + 200) {
        let rowHeight = 90 + Math.abs(Math.sin(rowIndex * 7.4)) * 140;
        
        let currentX = -100;
        let colIndex = 0;
        while (currentX < canvas.width + 200) {
            let panelWidth = 120 + Math.abs(Math.cos(rowIndex * 3.2 + colIndex * 5.1)) * 280;
            
            for (let dx = 30; dx < panelWidth - 10; dx += 50) {
                drawRivet(currentX + dx, currentY - 15);
                drawRivet(currentX + dx, currentY + 15);
            }
            for (let dy = 30; dy < rowHeight - 10; dy += 50) {
                drawRivet(currentX - 15, currentY + dy);
                drawRivet(currentX + 15, currentY + dy);
            }
            
            currentX += panelWidth;
            colIndex++;
        }
        currentY += rowHeight;
        rowIndex++;
    }

    // --- Non-rotated Framing & Corner Seams ---
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(cx - 250, cy - 250);
    ctx.moveTo(canvas.width, 0); ctx.lineTo(cx + 250, cy - 250);
    ctx.moveTo(0, canvas.height); ctx.lineTo(cx - 250, cy + 250);
    ctx.moveTo(canvas.width, canvas.height); ctx.lineTo(cx + 250, cy + 250);
    // Framing around periscope
    ctx.rect(cx - 340, cy - 340, 680, 680);
    ctx.stroke();

    ctx.strokeStyle = nightVisionEnabled ? '#004400' : '#555'; // Highlight
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Modern Digital Gauges
    const drawGauge = (gx, gy, radius, label, valueAngle, isCompass) => {
        ctx.save();
        ctx.translate(gx, gy);
        
        const isNight = nightVisionEnabled;
        const textColor = isNight ? '#00ff00' : '#222';
        const accentColor = isNight ? '#00ff00' : '#c00'; // Classic red
        
        // Outer brass casing (Restored previous color!)
        const brassGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
        brassGrad.addColorStop(0, isNight ? '#005500' : '#8a6327');
        brassGrad.addColorStop(1, isNight ? '#001100' : '#3d2b10');
        ctx.fillStyle = brassGrad;
        ctx.beginPath(); ctx.arc(0, 0, radius + 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
        
        // Paper face background (Restored previous color!)
        ctx.fillStyle = isNight ? '#002200' : '#f4ebd0';
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
        
        // Inner shadow
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, radius - 2, 0, Math.PI * 2); ctx.stroke();
        
        // Inner tech details
        ctx.strokeStyle = isNight ? '#00aa00' : '#8a6327';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(0, 0, radius - 5, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        
        if (isCompass) {
            // Rotating compass ring
            ctx.save();
            ctx.rotate(-valueAngle);
            ctx.fillStyle = textColor;
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('N', 0, -radius + 18);
            ctx.fillText('S', 0, radius - 18);
            ctx.fillText('E', radius - 18, 0);
            ctx.fillText('W', -radius + 18, 0);
            
            // Compass markings
            ctx.strokeStyle = textColor;
            for(let i=0; i<360; i+=15) {
                ctx.rotate(15 * Math.PI / 180);
                ctx.beginPath(); ctx.moveTo(0, -radius+5); ctx.lineTo(0, -radius+10); ctx.stroke();
            }
            ctx.restore();
            
            // Fixed center marker
            ctx.fillStyle = accentColor;
            ctx.beginPath(); ctx.moveTo(0, -radius + 5); ctx.lineTo(-5, -radius + 15); ctx.lineTo(5, -radius + 15); ctx.fill();
            
            // Label & Center Display
            ctx.fillStyle = isNight ? '#00aa00' : '#8a6327';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(label, 0, radius - 30);
            
            ctx.fillStyle = textColor;
            ctx.font = '20px monospace';
            let degrees = (((valueAngle * 180 / Math.PI) % 360) + 360) % 360;
            ctx.fillText(degrees.toFixed(0).padStart(3, '0') + '°', 0, 5);
        } else {
            // Digital Arc Bar
            ctx.lineWidth = 6;
            ctx.strokeStyle = accentColor;
            ctx.beginPath();
            const endAngle = valueAngle - Math.PI / 2; 
            ctx.arc(0, 0, radius - 15, Math.PI * 0.75, endAngle, false);
            ctx.stroke();

            // Tick marks
            ctx.strokeStyle = textColor;
            ctx.lineWidth = 1.5;
            for (let i = 0; i <= 10; i++) {
                const ang = Math.PI * 0.75 + (i / 10) * (Math.PI * 1.5);
                const tx1 = Math.cos(ang) * (radius - 22);
                const ty1 = Math.sin(ang) * (radius - 22);
                const tx2 = Math.cos(ang) * (radius - 12);
                const ty2 = Math.sin(ang) * (radius - 12);
                ctx.beginPath(); ctx.moveTo(tx1, ty1); ctx.lineTo(tx2, ty2); ctx.stroke();
            }
            
            // Label & Center Display
            ctx.fillStyle = isNight ? '#00aa00' : '#8a6327';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(label, 0, radius - 30);
            
            ctx.fillStyle = textColor;
            ctx.font = '20px monospace';
            let valText = Math.abs(Math.floor((valueAngle * 100))).toString().padStart(3, '0');
            ctx.fillText(valText, 0, 5);
        }
        
        ctx.restore();
    };

    // Calculate base angles for gauges
    const basePressureAngle = (stormIntensity > 0 ? Math.PI / 3 : -Math.PI / 3) + ((Math.sin(time * 15) * 0.05) + (Math.sin(time * 2.3) * 0.1));
    const baseHeadingAngle = turret.angle + Math.PI / 2;
    const baseDepthAngle = -Math.PI / 4 + Math.sin(time * 0.8) * 0.03;
    const baseRpmAngle = Math.PI / 4 + (Math.sin(time * 5) * 0.02) + (Math.sin(time * 0.5) * 0.05);

    const gaugeCenters = {
        pressure: { x: cx - 535, y: cy - 220, base: basePressureAngle },
        heading:  { x: cx + 535, y: cy - 220, base: baseHeadingAngle },
        depth:    { x: cx - 535, y: cy + 220, base: baseDepthAngle },
        rpm:      { x: cx + 535, y: cy + 220, base: baseRpmAngle }
    };

    // Apply Drag offsets
    if (draggedGauge) {
        const center = gaugeCenters[draggedGauge];
        const g = interactiveGauges[draggedGauge];
        const dx = mouseX - center.x;
        const dy = mouseY - center.y;
        const dragAngle = Math.atan2(dy, dx);
        
        let angleDiff = dragAngle - center.base;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        g.offset = angleDiff;
    }

    // Draw Gauges
    drawGauge(gaugeCenters.pressure.x, gaugeCenters.pressure.y, 65, "PRESSURE", gaugeCenters.pressure.base + interactiveGauges.pressure.offset, false);
    drawGauge(gaugeCenters.heading.x, gaugeCenters.heading.y, 65, "HEADING", gaugeCenters.heading.base + interactiveGauges.heading.offset, true);
    drawGauge(gaugeCenters.depth.x, gaugeCenters.depth.y, 65, "DEPTH", gaugeCenters.depth.base + interactiveGauges.depth.offset, false);
    drawGauge(gaugeCenters.rpm.x, gaugeCenters.rpm.y, 65, "RPM", gaugeCenters.rpm.base + interactiveGauges.rpm.offset, false);

    // Draw interactive buttons beneath gauges
    const buttonLabels = { pressure: "VENT", heading: "SYNC", depth: "BALLAST", rpm: "START" };
    for (let key in gaugeCenters) {
        const center = gaugeCenters[key];
        const bx = center.x - 40;
        const by = center.y + 80;
        
        ctx.fillStyle = nightVisionEnabled ? '#003300' : '#8a6327';
        ctx.fillRect(bx, by, 80, 25);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(bx, by, 80, 5);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(bx, by + 20, 80, 5);
        
        ctx.strokeStyle = nightVisionEnabled ? '#00ff00' : '#111';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, 80, 25);
        
        ctx.fillStyle = nightVisionEnabled ? '#00ff00' : '#111';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(buttonLabels[key], center.x, by + 12.5);
    }
    
    // Draw Interactive Sticky Note
    const stickyX = cx + 430;
    const stickyY = cy - 40;
    ctx.save();
    ctx.translate(stickyX, stickyY);
    ctx.rotate(0.1); // Slight casual tilt
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(3, 3, 100, 100);
    
    // Paper
    ctx.fillStyle = nightVisionEnabled ? '#003300' : '#fff466'; // Yellowish post-it
    ctx.fillRect(0, 0, 100, 100);
    
    // Scotch Tape
    ctx.fillStyle = nightVisionEnabled ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)';
    ctx.rotate(-0.15);
    ctx.fillRect(30, -10, 40, 20);
    ctx.rotate(0.15);
    
    // Note Text
    ctx.fillStyle = nightVisionEnabled ? '#00ff00' : '#111';
    ctx.font = 'bold 12px "Comic Sans MS", cursive, sans-serif'; // Handwritten look
    const lines = stickyMessages[stickyNoteState].split('\n');
    for (let i = 0; i < lines.length; i++) { ctx.fillText(lines[i], 50, 35 + i * 18); }
    ctx.restore();

    ctx.restore(); // End cockpit clipping

    // Draw periscope green HUD lines
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.25)';
    ctx.lineWidth = 1.5;
    
    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 300, canvas.height / 2);
    ctx.lineTo(canvas.width / 2 + 300, canvas.height / 2);
    ctx.moveTo(canvas.width / 2, canvas.height / 2 - 300);
    ctx.lineTo(canvas.width / 2, canvas.height / 2 + 300);
    ctx.stroke();

    // Distance rings
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 100, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 200, 0, Math.PI * 2);
    ctx.stroke();

    // Tick marks
    for(let i = -250; i <= 250; i += 50) {
        if (i === 0) continue;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - 8, canvas.height / 2 + i);
        ctx.lineTo(canvas.width / 2 + 8, canvas.height / 2 + i);
        ctx.moveTo(canvas.width / 2 + i, canvas.height / 2 - 8);
        ctx.lineTo(canvas.width / 2 + i, canvas.height / 2 + 8);
        ctx.stroke();
    }
    
    // Thick border edge
    ctx.stroke();
    
    // Thick border edge
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 300, 0, Math.PI * 2);
    ctx.stroke();

    // --- Draw Cracked Glass Overlay ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 300, 0, Math.PI * 2);
    ctx.clip(); // Keep the glass cracks strictly inside the periscope lens

    glassCracks.forEach(crack => {
        ctx.save();
        ctx.globalAlpha = crack.life; // Apply fading opacity
        
        const drawCrackPaths = (offsetX, offsetY) => {
            crack.lines.forEach(segments => {
                ctx.beginPath();
                ctx.moveTo(crack.x + offsetX, crack.y + offsetY);
                segments.forEach(seg => ctx.lineTo(seg.x + offsetX, seg.y + offsetY));
                ctx.stroke();
            });
            crack.rings.forEach(ring => {
                ctx.beginPath();
                ctx.moveTo(ring.x1 + offsetX, ring.y1 + offsetY);
                ctx.lineTo(ring.x2 + offsetX, ring.y2 + offsetY);
                ctx.stroke();
            });
        };
        
        // Inner drop shadow for 3D thickness
        ctx.strokeStyle = nightVisionEnabled ? 'rgba(0, 50, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2.5;
        drawCrackPaths(1, 1);
        
        // White/Light highlight for the broken glass edges
        ctx.strokeStyle = nightVisionEnabled ? 'rgba(150, 255, 150, 0.9)' : 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        drawCrackPaths(0, 0);
        
        // Center shatter impact point
        ctx.fillStyle = nightVisionEnabled ? 'rgba(150, 255, 150, 0.9)' : 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath(); ctx.arc(crack.x, crack.y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });
    ctx.restore();

    ctx.restore();

    // Draw makeshift radar close to the periscope view
    ctx.save();
    const radarCX = canvas.width / 2 + 340;
    const radarCY = canvas.height / 2 + 230;
    const radarRadius = 75 + (radarBonus * 8); // Radar visually grows with upgrade

    // Radar background
    ctx.fillStyle = 'rgba(0, 40, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(radarCX, radarCY, radarRadius, 0, Math.PI * 2);
    ctx.fill();

    // Radar rings and crosshairs
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(radarCX, radarCY, radarRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(radarCX, radarCY, radarRadius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(radarCX - radarRadius, radarCY);
    ctx.lineTo(radarCX + radarRadius, radarCY);
    ctx.moveTo(radarCX, radarCY - radarRadius);
    ctx.lineTo(radarCX, radarCY + radarRadius);
    ctx.stroke();

    // Radar sweeper line and trailing wedge
    const sweepAngle = time * 2;
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.beginPath();
    ctx.moveTo(radarCX, radarCY);
    ctx.arc(radarCX, radarCY, radarRadius, sweepAngle - 0.5, sweepAngle, false);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(radarCX, radarCY);
    ctx.lineTo(radarCX + Math.cos(sweepAngle) * radarRadius, radarCY + Math.sin(sweepAngle) * radarRadius);
    ctx.stroke();

    // Draw radar blips
    const drawBlips = (items, color, type) => {
        const currentSweep = (time * 2) % (Math.PI * 2);
        let drawnCount = 0;
        
        items.forEach(item => {
            const dx = item.x - turret.x;
            const dy = item.y - turret.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const radarRange = 450 + (radarBonus * 120); // Radar detects ships further away!
            const scale = radarRadius / radarRange; // Scale world distance down to radar size
            if (dist * scale < radarRadius - 3) {
                drawnCount++;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(radarCX + dx * scale, radarCY + dy * scale, 3, 0, Math.PI * 2);
                ctx.fill();

                // Sonar ping detection logic
                let targetAngle = Math.atan2(dy, dx);
                if (targetAngle < 0) targetAngle += Math.PI * 2;
                
                let diff = Math.abs(currentSweep - targetAngle);
                if (diff > Math.PI) diff = Math.PI * 2 - diff; // Handle wrap around
                
                if (diff < 0.25 && (!item.lastPingTime || time - item.lastPingTime > 1.5)) {
                    item.lastPingTime = time;
                    playSonarPing(type);
                }
                
                // Visual pulse effect when pinged
                if (item.lastPingTime && time - item.lastPingTime < 0.5) {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    const pulseRadius = 3 + (time - item.lastPingTime) * 30;
                    ctx.beginPath();
                    ctx.arc(radarCX + dx * scale, radarCY + dy * scale, pulseRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        });
        return drawnCount;
    };

    let visibleShipsCount = 0;
    visibleShipsCount += drawBlips(ships.filter(s => s.type !== 'battleship' && s.type !== 'ptboat' && s.type !== 'dreadnought' && s.type !== 'submarine'), '#ff4444', 'ship'); // Red blips for normal ships
    visibleShipsCount += drawBlips(ships.filter(s => s.type === 'ptboat'), '#ff69b4', 'ship'); // Pink blips for PT boats
    visibleShipsCount += drawBlips(ships.filter(s => s.type === 'aircraftcarrier'), '#ffcc00', 'ship'); // Gold/Yellow-Orange blips for carriers
    visibleShipsCount += drawBlips(ships.filter(s => s.type === 'battleship'), '#ff6600', 'ship'); // Vibrant orange blips for battleships
    visibleShipsCount += drawBlips(ships.filter(s => s.type === 'dreadnought'), '#aa00ff', 'ship'); // Neon purple blips for dreadnoughts
    visibleShipsCount += drawBlips(ships.filter(s => s.type === 'juggernaut'), '#ffffff', 'ship'); // Bright white blips for juggernauts
    visibleShipsCount += drawBlips(ships.filter(s => s.type === 'submarine'), '#00ff00', 'submarine'); // Bright green blips so they are easy to see on radar
    drawBlips(crates, '#ffff00', 'crate'); // Yellow blips for ammo crates
    drawBlips(planes, '#00ffff', 'ship'); // Cyan blips for aircraft
    drawBlips(bombs, '#ffa500', 'bomb'); // Orange blips for falling bombs
    drawBlips(mines, '#ff0000', 'mine'); // Bright red blips for mines
    ctx.restore();

    // Draw San Jose (PT) Time in the top-right corner
    ctx.save();
    const sjTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(new Date());

    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(sjTime + ' PT', canvas.width / 2 + 320, canvas.height / 2 - 300);
    ctx.restore();

    // Draw Score and Credits on the left side of the periscope view
    ctx.save();
    ctx.fillStyle = nightVisionEnabled ? '#00ff00' : '#00BFFF';
    ctx.shadowColor = nightVisionEnabled ? '#00ff00' : '#00BFFF';
    ctx.shadowBlur = 5;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    const scoreX = canvas.width / 2 - 330;
    const scoreY = canvas.height / 2;
    
    ctx.fillText(`Sunken Ships: ${score}`, scoreX, scoreY - 30);
    ctx.fillText(`Best: ${highScore}`, scoreX, scoreY);
    ctx.fillText(`Credits: $${credits}`, scoreX, scoreY + 30);
    ctx.fillText(`Ships on Radar: ${visibleShipsCount}`, scoreX, scoreY + 60);
    ctx.restore();

    // Draw Rank Badge in the right-middle
    ctx.save();
    const badgeX = canvas.width / 2 + 360;
    const badgeY = canvas.height / 2 - 20;

    let rank = "SEAMAN";
    let badgeColor = "#cd7f32"; // Bronze
    let pips = 1;

    if (score >= 14) {
        rank = "ADMIRAL";
        badgeColor = "#e5e4e2"; // Silver/Platinum
        pips = 3;
    } else if (score >= 7) {
        rank = "CAPTAIN";
        badgeColor = "#ffd700"; // Gold
        pips = 2;
    }

    if (nightVisionEnabled) {
        badgeColor = '#00ff00'; // Match tactical green HUD
    }

    // Shadow for 3D pop
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Leather gradient background
    const bgGrad = ctx.createLinearGradient(badgeX - 35, badgeY - 35, badgeX + 35, badgeY + 50);
    if (nightVisionEnabled) {
        bgGrad.addColorStop(0, 'rgba(0, 50, 0, 1)'); // Brighter top-left for light source
        bgGrad.addColorStop(1, 'black');
    } else {
        bgGrad.addColorStop(0, 'rgba(65, 65, 65, 1)'); // Brighter grey top-left for light source
        bgGrad.addColorStop(1, 'black');   // Pure black
    }

    ctx.fillStyle = bgGrad;
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    
    // Draw outer shield
    ctx.beginPath();
    ctx.moveTo(badgeX, badgeY - 35);
    ctx.lineTo(badgeX + 35, badgeY - 35);
    ctx.lineTo(badgeX + 35, badgeY + 15);
    ctx.lineTo(badgeX, badgeY + 50);
    ctx.lineTo(badgeX - 35, badgeY + 15);
    ctx.lineTo(badgeX - 35, badgeY - 35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Turn off shadow for inner details
    ctx.shadowColor = 'transparent';

    // Top-Left Highlight (Light source)
    ctx.strokeStyle = nightVisionEnabled ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(badgeX - 33, badgeY + 14);
    ctx.lineTo(badgeX - 33, badgeY - 33);
    ctx.lineTo(badgeX + 33, badgeY - 33);
    ctx.stroke();

    // Bottom-Right Shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.moveTo(badgeX + 33, badgeY - 33);
    ctx.lineTo(badgeX + 33, badgeY + 14);
    ctx.lineTo(badgeX, badgeY + 47);
    ctx.lineTo(badgeX - 33, badgeY + 14);
    ctx.stroke();

    // Draw inner decorative border (Stitching)
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = nightVisionEnabled ? 'rgba(0, 255, 0, 0.5)' : 'rgba(180, 180, 180, 0.7)'; // Thread color
    ctx.setLineDash([4, 3]); // Dashed line for stitching
    ctx.beginPath();
    ctx.moveTo(badgeX, badgeY - 30);
    ctx.lineTo(badgeX + 30, badgeY - 30);
    ctx.lineTo(badgeX + 30, badgeY + 12);
    ctx.lineTo(badgeX, badgeY + 44);
    ctx.lineTo(badgeX - 30, badgeY + 12);
    ctx.lineTo(badgeX - 30, badgeY - 30);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash for stars/text

    // Draw Rank Pips (Stars)
    ctx.fillStyle = badgeColor;
    for(let i = 0; i < pips; i++) {
        const pipX = badgeX + (i - (pips - 1) / 2) * 18;
        const outerRadius = 6;
        const innerRadius = 2.5;
        let rot = Math.PI / 2 * 3;
        let x = pipX;
        let y = badgeY + 10;
        let step = Math.PI / 5;
        
        ctx.beginPath();
        ctx.moveTo(pipX, badgeY + 10 - outerRadius);
        for (let j = 0; j < 5; j++) {
            x = pipX + Math.cos(rot) * outerRadius;
            y = badgeY + 10 + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;
            x = pipX + Math.cos(rot) * innerRadius;
            y = badgeY + 10 + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(pipX, badgeY + 10 - outerRadius);
        ctx.closePath();
        ctx.fill();
    }

    // Draw black banner background around the rank text below the shield
    ctx.fillStyle = nightVisionEnabled ? 'rgba(0, 10, 0, 1)' : 'black';
    ctx.fillRect(badgeX - 40, badgeY + 53, 80, 24);
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX - 40, badgeY + 53, 80, 24);

    // Banner Top-Left Highlight
    ctx.strokeStyle = nightVisionEnabled ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(badgeX - 39, badgeY + 76);
    ctx.lineTo(badgeX - 39, badgeY + 54);
    ctx.lineTo(badgeX + 39, badgeY + 54);
    ctx.stroke();

    // Draw Rank Text
    ctx.fillStyle = nightVisionEnabled ? '#00ff00' : 'white';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("RANK", badgeX, badgeY - 15);
    
    ctx.fillStyle = badgeColor;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(rank, badgeX, badgeY + 65);
    ctx.restore();

    // Apply Black and White Static / Film Grain effect
    if (blackAndWhiteEnabled) {
        ctx.save();
        const patternIdx = Math.floor(Date.now() / 50) % noisePatterns.length; // Rapidly cycle through noise frames
        ctx.fillStyle = noisePatterns[patternIdx];
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add occasional vertical scratches (like old film)
        if (Math.random() < 0.4) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(Math.random() * canvas.width, 0, Math.random() * 3 + 1, canvas.height);
        }
        if (Math.random() < 0.2) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(Math.random() * canvas.width, 0, Math.random() * 2 + 1, canvas.height);
        }
        ctx.restore();
    }

    // Draw Dreadnought Warning over absolutely everything
    if (juggernautWarningTimer > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 0, 255, ${0.5 + Math.abs(Math.sin(time * 5)) * 0.5})`; // Magenta warning
        ctx.font = 'bold 26px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        ctx.fillText('>> CRITICAL WARNING: JUGGERNAUT DETECTED <<', viewLeft + 20, viewTop + 20);
        ctx.restore();
    } else if (dreadnoughtWarningTimer > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 0, 0, ${0.5 + Math.abs(Math.sin(time * 5)) * 0.5})`;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        ctx.fillText('>> WARNING: DREADNOUGHT DETECTED <<', viewLeft + 20, viewTop + 20);
        ctx.restore();
    }

    // Draw menu overlay if open
    if (isMenuOpen) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(-50, -50, canvas.width + 100, canvas.height + 100);
        
        ctx.fillStyle = 'rgba(0, 40, 0, 0.9)';
        ctx.fillRect(canvas.width / 2 - 150, canvas.height / 2 - 150, 300, 300);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width / 2 - 150, canvas.height / 2 - 150, 300, 300);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MENU', canvas.width / 2, canvas.height / 2 - 115);
        
        ctx.font = '18px monospace';
        ctx.fillText('Game Paused', canvas.width / 2, canvas.height / 2 - 85);

        // Draw Night Vision Button
        const nvBtnX = canvas.width / 2 - 100;
        const nvBtnY = canvas.height / 2 - 60;
        const nvBtnW = 200;
        const nvBtnH = 35;
        ctx.fillStyle = nightVisionEnabled ? '#00ff00' : 'rgba(0, 40, 0, 0.8)';
        ctx.fillRect(nvBtnX, nvBtnY, nvBtnW, nvBtnH);
        ctx.strokeStyle = '#00ff00';
        ctx.strokeRect(nvBtnX, nvBtnY, nvBtnW, nvBtnH);
        ctx.fillStyle = nightVisionEnabled ? 'black' : '#00ff00';
        ctx.font = '16px monospace';
        ctx.fillText(`Night Vision: ${nightVisionEnabled ? 'ON' : 'OFF'}`, canvas.width / 2, nvBtnY + nvBtnH / 2);
        
        // Draw Upgrades Button
        const upgMenuBtnY = canvas.height / 2 - 15;
        ctx.fillStyle = 'rgba(0, 40, 0, 0.8)';
        ctx.fillRect(nvBtnX, upgMenuBtnY, nvBtnW, nvBtnH);
        ctx.strokeStyle = '#00ff00';
        ctx.strokeRect(nvBtnX, upgMenuBtnY, nvBtnW, nvBtnH);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = '16px monospace';
        ctx.fillText('Upgrades', canvas.width / 2, upgMenuBtnY + nvBtnH / 2);

        // Draw Black and White Theme Button
        const bwBtnY = canvas.height / 2 + 30;
        ctx.fillStyle = blackAndWhiteEnabled ? '#ffffff' : 'rgba(0, 40, 0, 0.8)';
        ctx.fillRect(nvBtnX, bwBtnY, nvBtnW, nvBtnH);
        ctx.strokeStyle = '#00ff00';
        ctx.strokeRect(nvBtnX, bwBtnY, nvBtnW, nvBtnH);
        ctx.fillStyle = blackAndWhiteEnabled ? 'black' : '#00ff00';
        ctx.font = '16px monospace';
        ctx.fillText(`B&W Theme: ${blackAndWhiteEnabled ? 'ON' : 'OFF'}`, canvas.width / 2, bwBtnY + nvBtnH / 2);

        // Draw Close Menu Button
        const closeMenuBtnY = canvas.height / 2 + 75;
        ctx.fillStyle = 'rgba(0, 40, 0, 0.8)';
        ctx.fillRect(nvBtnX, closeMenuBtnY, nvBtnW, nvBtnH);
        ctx.strokeStyle = '#00ff00';
        ctx.strokeRect(nvBtnX, closeMenuBtnY, nvBtnW, nvBtnH);
        ctx.fillStyle = '#00ff00';
        ctx.font = '16px monospace';
        ctx.fillText('Close Menu', canvas.width / 2, closeMenuBtnY + nvBtnH / 2);
        ctx.restore();
    }

    // Draw Upgrades overlay if open
    if (isUpgradesOpen) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(-50, -50, canvas.width + 100, canvas.height + 100);
        
        ctx.fillStyle = 'rgba(0, 40, 0, 0.9)';
        ctx.fillRect(canvas.width / 2 - 250, canvas.height / 2 - 260, 500, 520);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width / 2 - 250, canvas.height / 2 - 260, 500, 520);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('UPGRADES', canvas.width / 2, canvas.height / 2 - 210);
        
        ctx.font = '20px monospace';
        ctx.fillText(`Credits: $${credits}`, canvas.width / 2, canvas.height / 2 - 170);

        // Upgrade 1
        const u1X = canvas.width / 2 - 230;
        const u1Y = canvas.height / 2 - 120;
        const canBuyU1 = credits >= 50 && projSpeedBonus < 5;
        ctx.fillStyle = canBuyU1 ? 'rgba(0, 100, 0, 0.8)' : 'rgba(40, 40, 40, 0.8)';
        ctx.fillRect(u1X, u1Y, 460, 50);
        ctx.strokeStyle = canBuyU1 ? '#00ff00' : '#888';
        ctx.strokeRect(u1X, u1Y, 460, 50);
        ctx.fillStyle = canBuyU1 ? '#00ff00' : '#888';
        ctx.font = '16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(projSpeedBonus >= 5 ? `Faster Torpedoes (MAX)` : `Faster Torpedoes (+Speed) [$50]`, u1X + 20, u1Y + 25);
        ctx.textAlign = 'right';
        ctx.fillText(projSpeedBonus >= 5 ? `MAX` : `Lvl ${projSpeedBonus}`, u1X + 440, u1Y + 25);

        // Upgrade 2
        const u2X = canvas.width / 2 - 230;
        const u2Y = canvas.height / 2 - 50;
        ctx.fillStyle = credits >= 75 ? 'rgba(0, 100, 0, 0.8)' : 'rgba(40, 40, 40, 0.8)';
        ctx.fillRect(u2X, u2Y, 460, 50);
        ctx.strokeStyle = credits >= 75 ? '#00ff00' : '#888';
        ctx.strokeRect(u2X, u2Y, 460, 50);
        ctx.fillStyle = credits >= 75 ? '#00ff00' : '#888';
        ctx.font = '16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Ammo Scavenger (+Ammo) [$75]`, u2X + 20, u2Y + 25);
        ctx.textAlign = 'right';
        ctx.fillText(`Lvl ${ammoBonus}`, u2X + 440, u2Y + 25);
        
        // Upgrade 3
        const u3X = canvas.width / 2 - 230;
        const u3Y = canvas.height / 2 + 20;
        const canBuyU3 = credits >= 100 && radarBonus < 5;
        ctx.fillStyle = canBuyU3 ? 'rgba(0, 100, 0, 0.8)' : 'rgba(40, 40, 40, 0.8)';
        ctx.fillRect(u3X, u3Y, 460, 50);
        ctx.strokeStyle = canBuyU3 ? '#00ff00' : '#888';
        ctx.strokeRect(u3X, u3Y, 460, 50);
        ctx.fillStyle = canBuyU3 ? '#00ff00' : '#888';
        ctx.font = '16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(radarBonus >= 5 ? `Advanced Radar (MAX)` : `Advanced Radar (+Range) [$100]`, u3X + 20, u3Y + 25);
        ctx.textAlign = 'right';
        ctx.fillText(radarBonus >= 5 ? `MAX` : `Lvl ${radarBonus}`, u3X + 440, u3Y + 25);
        
        // Upgrade 4
        const u4X = canvas.width / 2 - 230;
        const u4Y = canvas.height / 2 + 90;
        const canBuyU4 = credits >= 125 && homingBonus < 5;
        ctx.fillStyle = canBuyU4 ? 'rgba(0, 100, 0, 0.8)' : 'rgba(40, 40, 40, 0.8)';
        ctx.fillRect(u4X, u4Y, 460, 50);
        ctx.strokeStyle = canBuyU4 ? '#00ff00' : '#888';
        ctx.strokeRect(u4X, u4Y, 460, 50);
        ctx.fillStyle = canBuyU4 ? '#00ff00' : '#888';
        ctx.font = '16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(homingBonus >= 5 ? `Homing Torpedoes (MAX)` : `Homing Torpedoes (+Tracking) [$125]`, u4X + 20, u4Y + 25);
        ctx.textAlign = 'right';
        ctx.fillText(homingBonus >= 5 ? `MAX` : `Lvl ${homingBonus}`, u4X + 440, u4Y + 25);
        
        // Draw Close Upgrades Button
        const closeUpgBtnY = canvas.height / 2 + 160;
        ctx.fillStyle = 'rgba(0, 40, 0, 0.8)';
        ctx.fillRect(u2X, closeUpgBtnY, 460, 50);
        ctx.strokeStyle = '#00ff00';
        ctx.strokeRect(u2X, closeUpgBtnY, 460, 50);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('CLOSE UPGRADES', canvas.width / 2, closeUpgBtnY + 25);
        ctx.restore();
    }

    // Draw hamburger menu button close to the view
    ctx.save();
    const menuX = canvas.width / 2 - 450;
    const menuY = canvas.height / 2 + 180;

    ctx.fillStyle = blackAndWhiteEnabled ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 40, 0, 0.8)';
    ctx.fillRect(menuX, menuY, 140, 45);
    ctx.strokeStyle = blackAndWhiteEnabled ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 255, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(menuX, menuY, 140, 45);

    // Draw 3 horizontal lines for the hamburger icon
    ctx.fillStyle = blackAndWhiteEnabled ? '#ffffff' : '#00ff00';
    ctx.fillRect(menuX + 10, menuY + 10, 24, 4);
    ctx.fillRect(menuX + 10, menuY + 21, 24, 4);
    ctx.fillRect(menuX + 10, menuY + 32, 24, 4);

    // Add WARSHIP text
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('WARSHIP', menuX + 45, menuY + 23);
    ctx.restore();

    // Draw Upgrades button safely close to the view
    ctx.save();
    const upgX = canvas.width / 2 - 450;
    const upgY = canvas.height / 2 + 235;

    ctx.fillStyle = blackAndWhiteEnabled ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 40, 0, 0.8)';
    ctx.fillRect(upgX, upgY, 140, 45);
    ctx.strokeStyle = blackAndWhiteEnabled ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 255, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(upgX, upgY, 140, 45);
    ctx.fillStyle = blackAndWhiteEnabled ? '#ffffff' : '#00ff00';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('UPGRADES (U)', upgX + 70, upgY + 23);
    ctx.restore();

    // Draw small targeting crosshair at mouse
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mouseX - 10, mouseY);
    ctx.lineTo(mouseX + 10, mouseY);
    ctx.moveTo(mouseX, mouseY - 10);
    ctx.lineTo(mouseX, mouseY + 10);
    ctx.stroke();

    // Draw Switch Weapon button
    const btnX = canvas.width / 2 - 70;
    const btnY = canvas.height / 2 + 320; // Anchored right under the view
    const btnWidth = 140;
    const btnHeight = 35;
    
    if (nightVisionEnabled) {
        ctx.fillStyle = weaponType === 'single' ? 'rgba(0, 40, 0, 0.8)' : 'rgba(0, 100, 0, 0.8)';
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    } else {
        if (weaponType === 'single') ctx.fillStyle = 'rgba(68, 170, 255, 0.8)';
        else if (weaponType === 'triple') ctx.fillStyle = 'rgba(255, 68, 68, 0.8)';
        else ctx.fillStyle = 'rgba(255, 150, 0, 0.8)'; // Orange for homing
        ctx.strokeStyle = 'white';
    }
    
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    ctx.lineWidth = 1;
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);
    
    ctx.fillStyle = nightVisionEnabled ? '#00ff00' : 'white';
    ctx.font = nightVisionEnabled ? 'bold 16px monospace' : '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let btnText = `Single (∞)`;
    if (weaponType === 'triple') btnText = `Triple (${tripleAmmo})`;
    else if (weaponType === 'homing') btnText = `Homing (${homingAmmo})`;
    ctx.fillText(btnText, btnX + btnWidth / 2, btnY + btnHeight / 2);

    ctx.restore(); // Restore from Screen Shake
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', (e) => {
    initAudio();
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const cxCenter = canvas.width / 2;
    const cyCenter = canvas.height / 2;
    
    const centers = {
        pressure: { x: cxCenter - 535, y: cyCenter - 220 },
        heading:  { x: cxCenter + 535, y: cyCenter - 220 },
        depth:    { x: cxCenter - 535, y: cyCenter + 220 },
        rpm:      { x: cxCenter + 535, y: cyCenter + 220 }
    };
    
    // Check if the user is grabbing a gauge
    for (let key in centers) {
        const dx = clickX - centers[key].x;
        const dy = clickY - centers[key].y;
        if (Math.sqrt(dx * dx + dy * dy) <= 65) {
            draggedGauge = key;
            interactiveGauges[key].isDragging = true;
            interactiveGauges[key].velocity = 0;
            return;
        }
    }
});

window.addEventListener('mouseup', () => {
    if (draggedGauge) {
        interactiveGauges[draggedGauge].isDragging = false;
        draggedGauge = null;
    }
});

canvas.addEventListener('click', (e) => {
    initAudio(); // Initialize audio context on first user interaction

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Check if clicked on a gauge (tap the glass effect)
    const cxCenter = canvas.width / 2;
    const cyCenter = canvas.height / 2;
    const gaugeCenters = {
        pressure: { x: cxCenter - 535, y: cyCenter - 220 },
        heading:  { x: cxCenter + 535, y: cyCenter - 220 },
        depth:    { x: cxCenter - 535, y: cyCenter + 220 },
        rpm:      { x: cxCenter + 535, y: cyCenter + 220 }
    };
    for (let key in gaugeCenters) {
        const dx = cx - gaugeCenters[key].x;
        const dy = cy - gaugeCenters[key].y;
        if (Math.sqrt(dx * dx + dy * dy) <= 65) {
            interactiveGauges[key].velocity = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.5 + 0.5);
            playSonarPing('ship'); // Small metallic "tink" sound
            return;
        }
        
        // Check if gauge button was clicked
        const bx = gaugeCenters[key].x - 40;
        const by = gaugeCenters[key].y + 80;
        if (cx >= bx && cx <= bx + 80 && cy >= by && cy <= by + 25) {
            interactiveGauges[key].velocity = 2.0; // Give the needle a big jump
            playSonarPing('submarine'); // A slightly different mechanical sound
            return;
        }
    }
    
    // Check if Sticky Note was clicked
    const stickyX = cxCenter + 430;
    const stickyY = cyCenter - 40;
    if (cx >= stickyX && cx <= stickyX + 100 && cy >= stickyY && cy <= stickyY + 100) {
        stickyNoteState = (stickyNoteState + 1) % stickyMessages.length;
        playSonarPing('ship'); // Light tap sound
        return;
    }

    if (!gameStarted) {
        const bossBtnW = 280;
        const bossBtnH = 60;
        const bossBtnX = canvas.width / 2 - bossBtnW / 2;
        const bossBtnY = canvas.height / 2 + 10;
        
        if (cx >= bossBtnX && cx <= bossBtnX + bossBtnW && cy >= bossBtnY && cy <= bossBtnY + bossBtnH) {
            spawnDreadnoughtPending = true;
            dreadnoughtWarningTimer = 180;
        } else {
            // Pre-spawn some ships inside the view so the player doesn't have to wait
            for (let i = 0; i < 4; i++) {
                let s = new Ship(Math.random() < 0.3 ? 'battleship' : 'normal');
                s.x = canvas.width / 2 + (Math.random() * 400) - 200;
                ships.push(s);
            }
        }
        gameStarted = true;
        return;
    }

    // Check if the hamburger menu button was clicked to toggle the menu
    const menuX = canvas.width / 2 - 450;
    const menuY = canvas.height / 2 + 180;
    if (cx >= menuX && cx <= menuX + 140 && cy >= menuY && cy <= menuY + 45) {
        isMenuOpen = !isMenuOpen;
        if (isMenuOpen) isUpgradesOpen = false; // Close upgrades if menu opens
        return;
    }

    // Check if the Upgrades button was clicked
    const upgX = canvas.width / 2 - 450;
    const upgY = canvas.height / 2 + 235;
    if (cx >= upgX && cx <= upgX + 140 && cy >= upgY && cy <= upgY + 45) {
        isUpgradesOpen = !isUpgradesOpen;
        if (isUpgradesOpen) isMenuOpen = false; // Close menu if upgrades opens
        return;
    }

    if (isUpgradesOpen) {
        // Check Upgrade 1 click
        const u1X = canvas.width / 2 - 230;
        const u1Y = canvas.height / 2 - 120;
        if (cx >= u1X && cx <= u1X + 460 && cy >= u1Y && cy <= u1Y + 50) {
            if (credits >= 50 && projSpeedBonus < 5) {
                credits -= 50;
                projSpeedBonus++;
                scoreElement.textContent = `Sunken Ships: ${score} | Best: ${highScore} | Credits: $${credits}`;
            }
        }
        
        // Check Upgrade 2 click
        const u2X = canvas.width / 2 - 230;
        const u2Y = canvas.height / 2 - 50;
        if (cx >= u2X && cx <= u2X + 460 && cy >= u2Y && cy <= u2Y + 50) {
            if (credits >= 75) {
                credits -= 75;
                ammoBonus++;
                scoreElement.textContent = `Sunken Ships: ${score} | Best: ${highScore} | Credits: $${credits}`;
            }
        }
        
        // Check Upgrade 3 click
        const u3X = canvas.width / 2 - 230;
        const u3Y = canvas.height / 2 + 20;
        if (cx >= u3X && cx <= u3X + 460 && cy >= u3Y && cy <= u3Y + 50) {
            if (credits >= 100 && radarBonus < 5) {
                credits -= 100;
                radarBonus++;
                scoreElement.textContent = `Sunken Ships: ${score} | Best: ${highScore} | Credits: $${credits}`;
            }
        }
        
        // Check Upgrade 4 click
        const u4X = canvas.width / 2 - 230;
        const u4Y = canvas.height / 2 + 90;
        if (cx >= u4X && cx <= u4X + 460 && cy >= u4Y && cy <= u4Y + 50) {
            if (credits >= 125 && homingBonus < 5) {
                credits -= 125;
                if (homingBonus === 0) {
                    homingAmmo += 10; // Give initial ammo when first unlocked!
                }
                homingBonus++;
                scoreElement.textContent = `Sunken Ships: ${score} | Best: ${highScore} | Credits: $${credits}`;
            }
        }
        
        // Check Close Upgrades click
        const closeUpgBtnY = canvas.height / 2 + 160;
        if (cx >= u2X && cx <= u2X + 460 && cy >= closeUpgBtnY && cy <= closeUpgBtnY + 50) {
            isUpgradesOpen = false;
        }
        return; // Prevent shooting while upgrades menu is open
    }

    if (isMenuOpen) {
        const nvBtnX = canvas.width / 2 - 100;
        const nvBtnW = 200;
        const nvBtnH = 35;
        const nvBtnY = canvas.height / 2 - 60;
        if (cx >= nvBtnX && cx <= nvBtnX + nvBtnW && cy >= nvBtnY && cy <= nvBtnY + nvBtnH) {
            nightVisionEnabled = !nightVisionEnabled;
            if (nightVisionEnabled) {
                scoreElement.style.color = '#00ff00';
                scoreElement.style.textShadow = '0 0 5px #00ff00';
                radarCountElement.style.color = '#00ff00';
                radarCountElement.style.textShadow = '0 0 5px #00ff00';
            } else {
                scoreElement.style.color = '#00BFFF';
                scoreElement.style.textShadow = '0 0 5px #00BFFF';
                radarCountElement.style.color = '#00BFFF';
                radarCountElement.style.textShadow = '0 0 5px #00BFFF';
            }
        }
        
        const upMenuBtnY = canvas.height / 2 - 15;
        if (cx >= nvBtnX && cx <= nvBtnX + nvBtnW && cy >= upMenuBtnY && cy <= upMenuBtnY + nvBtnH) {
            isUpgradesOpen = true;
            isMenuOpen = false;
        }
        
        const bwBtnY = canvas.height / 2 + 30;
        if (cx >= nvBtnX && cx <= nvBtnX + nvBtnW && cy >= bwBtnY && cy <= bwBtnY + nvBtnH) {
            blackAndWhiteEnabled = !blackAndWhiteEnabled;
            canvas.style.filter = blackAndWhiteEnabled ? 'grayscale(100%)' : 'none';
            const bossBtnHtml = document.getElementById('boss-btn-html');
            if (bossBtnHtml) {
                bossBtnHtml.style.backgroundColor = blackAndWhiteEnabled ? 'rgba(0, 0, 0, 0.9)' : 'rgba(150, 40, 40, 0.9)';
            }
        }
        
        // Check Close Menu click
        const closeMenuBtnY = canvas.height / 2 + 75;
        if (cx >= nvBtnX && cx <= nvBtnX + nvBtnW && cy >= closeMenuBtnY && cy <= closeMenuBtnY + nvBtnH) {
            isMenuOpen = false;
        }
        return; // Prevent shooting or switching weapons while menu is open
    }

    const btnX = canvas.width / 2 - 70;
    const btnY = canvas.height / 2 + 320;
    const btnWidth = 140;
    const btnHeight = 35;

    if (cx >= btnX && cx <= btnX + btnWidth && cy >= btnY && cy <= btnY + btnHeight) {
        if (weaponType === 'single') {
            weaponType = tripleAmmo > 0 ? 'triple' : (homingAmmo > 0 ? 'homing' : 'single');
        } else if (weaponType === 'triple') {
            weaponType = homingAmmo > 0 ? 'homing' : 'single';
        } else if (weaponType === 'homing') {
            weaponType = 'single';
        }
    } else {
        shoot();
    }
});

function gameLoop() {
    if (!gameStarted) {
        draw(); // Draw the initial static frame of the game
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 50px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WARSHIP', canvas.width / 2, canvas.height / 2 - 60);
        
        // Draw Spawn Boss Button on the Start Screen
        const bossBtnW = 280;
        const bossBtnH = 60;
        const bossBtnX = canvas.width / 2 - bossBtnW / 2;
        const bossBtnY = canvas.height / 2 + 10;
        
        ctx.fillStyle = blackAndWhiteEnabled ? 'rgba(0, 0, 0, 0.9)' : 'rgba(200, 0, 0, 0.9)';
        ctx.fillRect(bossBtnX, bossBtnY, bossBtnW, bossBtnH);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(bossBtnX, bossBtnY, bossBtnW, bossBtnH);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('START & SPAWN BOSS', canvas.width / 2, bossBtnY + bossBtnH / 2);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = '16px monospace';
        ctx.fillText('(Or click anywhere else to play normally)', canvas.width / 2, canvas.height / 2 + 110);
        ctx.restore();
        requestAnimationFrame(gameLoop);
        return;
    }

    if (!isMenuOpen && !isUpgradesOpen) {
        update();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();