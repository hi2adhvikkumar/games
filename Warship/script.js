const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

let audioCtx;
function initAudio() {
    try {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (e) {
        console.error("Audio init error:", e);
    }
}

// Initialize audio on any click or key press anywhere on the window
window.addEventListener('click', initAudio, { once: true });
window.addEventListener('keydown', initAudio, { once: true });

function playSonarPing(type = 'ship') {
    try {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') return;
        
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        // Create a sharp "click" sound using a rapid frequency sweep and fast decay
        oscillator.type = 'sine';
        const startFreq = type === 'ship' ? 2000 : 3000;
        oscillator.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.03);
        
        const now = audioCtx.currentTime;
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(1.0, now + 0.002); // Instant attack
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.03); // Very fast decay
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.04);
    } catch (e) {
        console.error("Audio error:", e);
    }
}

let score = 0;
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let time = 0;
let weaponType = 'single';
let tripleAmmo = 40;
let isMenuOpen = false;
let gameStarted = false;
let nightVisionEnabled = false;

const turret = {
    x: canvas.width / 2,
    y: canvas.height / 2 + 300, // At the bottom of the periscope view
    angle: 0
};

let projectiles = [];
let ships = [];
let explosions = [];
let crates = [];

const horizonY = canvas.height / 2; // Horizon in the middle of view

const viewLeft = canvas.width / 2 - 300;
const viewRight = canvas.width / 2 + 300;
const viewTop = canvas.height / 2 - 300;
const viewBottom = canvas.height / 2 + 300;

class Projectile {
    constructor(x, y, angle, speed = 10) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.angle = angle;
        this.width = 20;
        this.height = 5;
        this.radius = this.width / 2; // For collision
        this.trail = [];
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 10) {
            this.trail.shift();
        }
    }

    draw() {
        // Draw trail as a fading line
        if (this.trail.length > 1) {
            const gradient = ctx.createLinearGradient(this.trail[0].x, this.trail[0].y, this.x, this.y);
            gradient.addColorStop(0, 'rgba(90, 155, 212, 0)'); // Transparent at start
            gradient.addColorStop(1, 'rgba(90, 155, 212, 0.5)'); // Semi-transparent at end
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            ctx.lineTo(this.x, this.y);
            ctx.stroke();
        }

        // Draw projectile
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isOffScreen() {
        return this.x < viewLeft || this.x > viewRight || this.y < viewTop || this.y > viewBottom || this.y <= horizonY;
    }
}

class Ship {
    constructor() {
        this.x = canvas.width;
        this.y = horizonY + Math.random() * (turret.y - horizonY); // Between horizon and turret
        this.width = 40;
        this.height = 20;
        this.speed = Math.random() * 2 + 1;
        this.light = Math.random() < 0.25; // 25% chance to be lighter
    }

    update() {
        this.x -= this.speed;
    }

    draw() {
        ctx.fillStyle = '#1a1a1a'; // Almost black
        // Hull
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        // Superstructure
        ctx.fillRect(this.x - this.width / 4, this.y - this.height / 2 - 10, this.width / 2, 8);
        // Mast or radar
        ctx.fillStyle = 'black';
        ctx.fillRect(this.x - 1, this.y - this.height / 2 - 15, 2, 15);
    }

    isOffScreen() {
        return this.x + this.width / 2 < 0;
    }
}

class Crate {
    constructor() {
        this.x = canvas.width;
        this.y = horizonY + Math.random() * (turret.y - horizonY); // Same spawn area as ships
        this.width = 24;
        this.height = 16;
        this.speed = Math.random() * 1.5 + 0.5;
    }

    update() {
        this.x -= this.speed;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw wooden crate box
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        // Draw green plus symbol for ammo
        ctx.fillStyle = '#32cd32';
        ctx.fillRect(-this.width / 4, -this.height / 8, this.width / 2, this.height / 4);
        ctx.fillRect(-this.width / 8, -this.height / 4, this.width / 4, this.height / 2);
        
        ctx.restore();
    }

    isOffScreen() {
        return this.x + this.width / 2 < 0;
    }
}

class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.circleRadius = 5;
        this.circleLife = 1.0;
        this.particles = [];
        // Spawn 20 small particles for the explosion burst
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                size: Math.random() * 4 + 1,
                life: 1.0,
                decay: Math.random() * 0.05 + 0.03,
                color: ['#ff0000', '#ff8800', '#ffff00', '#ffffff'][Math.floor(Math.random() * 4)]
            });
        }
        this.life = 1.0;
    }

    update() {
        this.circleRadius += 3; // Grow the flash
        this.circleLife -= 0.1; // Fade the flash quickly

        let maxLife = 0;
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life > maxLife) maxLife = p.life;
        });
        this.life = Math.max(maxLife, this.circleLife);
    }

    draw() {
        ctx.save();
        
        // Draw the white circle flash
        if (this.circleLife > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, this.circleLife)})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.circleRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        this.particles.forEach(p => {
            if (p.life > 0) {
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

function updateTurretAngle() {
    const dx = mouseX - turret.x;
    const dy = mouseY - turret.y;
    turret.angle = Math.atan2(dy, dx);
}

function shoot() {
    if (weaponType === 'single') {
        projectiles.push(new Projectile(turret.x, turret.y, turret.angle, 12)); // Slower speed
    } else if (weaponType === 'triple' && tripleAmmo > 0) {
        projectiles.push(new Projectile(turret.x, turret.y, turret.angle, 8));
        projectiles.push(new Projectile(turret.x, turret.y, turret.angle - 0.15, 8));
        projectiles.push(new Projectile(turret.x, turret.y, turret.angle + 0.15, 8));
        tripleAmmo--;
        if (tripleAmmo <= 0) {
            weaponType = 'single'; // Auto-switch to single when out of ammo
        }
    }
}

function spawnShip() {
    if (Math.random() < 0.02) {
        ships.push(new Ship());
    }
}

function spawnCrate() {
    // Limit to 2 active crates at a time and higher spawn rate
    if (crates.length < 2 && Math.random() < 0.005) { 
        crates.push(new Crate());
    }
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
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < proj.radius + ship.width / 2) {
                explosions.push(new Explosion(ship.x, ship.y));
                projectiles.splice(i, 1);
                ships.splice(j, 1);
                score += 10;
                scoreElement.textContent = `Score: ${score}`;
                hit = true;
                break;
            }
        }
        
        if (hit) continue; // If the projectile already hit a ship, skip checking crates

        // Check collision with crates
        for (let k = crates.length - 1; k >= 0; k--) {
            const crate = crates[k];
            const dx = proj.x - crate.x;
            const dy = proj.y - crate.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < proj.radius + crate.width / 2) {
                explosions.push(new Explosion(crate.x, crate.y));
                projectiles.splice(i, 1);
                crates.splice(k, 1);
                tripleAmmo += (tripleAmmo <= 30) ? 7 : 2; // Replenish ammo when destroyed
                break;
            }
        }
    }
}

function update() {
    updateTurretAngle();
    time += 0.05; // For wave animation

    projectiles.forEach(proj => proj.update());
    projectiles = projectiles.filter(proj => !proj.isOffScreen());

    ships.forEach(ship => ship.update());
    ships = ships.filter(ship => !ship.isOffScreen());

    crates.forEach(crate => crate.update());
    crates = crates.filter(crate => !crate.isOffScreen());

    explosions.forEach(exp => exp.update());
    explosions = explosions.filter(exp => !exp.isDead());

    spawnShip();
    spawnCrate();
    checkCollisions();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Clip to the periscope view (circular)
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 300, 0, Math.PI * 2);
    ctx.clip();

    // Draw sky with gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGradient.addColorStop(0, '#2b5a8c');
    skyGradient.addColorStop(1, '#87CEEB');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, horizonY);

    // Draw sun
    ctx.fillStyle = 'rgba(255, 235, 180, 0.9)';
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
    waterGradient.addColorStop(0, '#1c4d7c'); // Lighter near horizon
    waterGradient.addColorStop(1, '#001122'); // Darker at the bottom
    ctx.fillStyle = waterGradient;
    ctx.fill();

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

    // Draw ships
    ships.forEach(ship => ship.draw());

    // Draw crates
    crates.forEach(crate => crate.draw());

    // Draw explosions
    explosions.forEach(exp => exp.draw());

    // Apply Night Vision green tint over the periscope
    if (nightVisionEnabled) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.35)'; // Classic night vision green
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.restore();

    // Draw projectiles (not clipped, so they wrap around the bottom area)
    projectiles.forEach(proj => proj.draw());

    // Draw periscope mask and HUD overlay
    ctx.save();
    // Black out everything outside the periscope circle
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.arc(canvas.width / 2, canvas.height / 2, 300, 0, Math.PI * 2, true);
    ctx.fill();

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
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 300, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Draw makeshift radar in the bottom-right corner
    ctx.save();
    const radarCX = canvas.width - 100;
    const radarCY = canvas.height - 120;
    const radarRadius = 75;

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
        
        items.forEach(item => {
            const dx = item.x - turret.x;
            const dy = item.y - turret.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const scale = radarRadius / 450; // Scale world distance down to radar size
            if (dist * scale < radarRadius - 3) {
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
    };

    drawBlips(ships, '#ff4444', 'ship'); // Red blips for enemy ships
    drawBlips(crates, '#ffff00', 'crate'); // Yellow blips for ammo crates
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sjTime + ' PT', canvas.width - 100, 40);
    ctx.restore();

    // Draw menu overlay if open
    if (isMenuOpen) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'rgba(0, 40, 0, 0.9)';
        ctx.fillRect(canvas.width / 2 - 150, canvas.height / 2 - 100, 300, 200);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width / 2 - 150, canvas.height / 2 - 100, 300, 200);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MENU', canvas.width / 2, canvas.height / 2 - 50);
        
        ctx.font = '18px monospace';
        ctx.fillText('Game Paused', canvas.width / 2, canvas.height / 2 - 20);

        // Draw Night Vision Button
        const nvBtnX = canvas.width / 2 - 100;
        const nvBtnY = canvas.height / 2 + 5;
        const nvBtnW = 200;
        const nvBtnH = 35;
        ctx.fillStyle = nightVisionEnabled ? '#00ff00' : 'rgba(0, 40, 0, 0.8)';
        ctx.fillRect(nvBtnX, nvBtnY, nvBtnW, nvBtnH);
        ctx.strokeStyle = '#00ff00';
        ctx.strokeRect(nvBtnX, nvBtnY, nvBtnW, nvBtnH);
        ctx.fillStyle = nightVisionEnabled ? 'black' : '#00ff00';
        ctx.font = '16px monospace';
        ctx.fillText(`Night Vision: ${nightVisionEnabled ? 'ON' : 'OFF'}`, canvas.width / 2, nvBtnY + nvBtnH / 2);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = '14px monospace';
        ctx.fillText('Click menu icon to resume', canvas.width / 2, canvas.height / 2 + 70);
        ctx.restore();
    }

    // Draw hamburger menu button in the bottom-left corner
    ctx.save();
    ctx.fillStyle = 'rgba(0, 40, 0, 0.8)';
    ctx.fillRect(20, canvas.height - 70, 160, 45);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, canvas.height - 70, 160, 45);

    // Draw 3 horizontal lines for the hamburger icon
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(30, canvas.height - 60, 24, 4);
    ctx.fillRect(30, canvas.height - 49, 24, 4);
    ctx.fillRect(30, canvas.height - 38, 24, 4);

    // Add WARSHIP text
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('WARSHIP', 65, canvas.height - 47);
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
    const btnY = canvas.height - 45; // Anchored to the very bottom edge of the canvas
    const btnWidth = 140;
    const btnHeight = 35;
    
    if (nightVisionEnabled) {
        ctx.fillStyle = weaponType === 'triple' ? 'rgba(0, 100, 0, 0.8)' : 'rgba(0, 40, 0, 0.8)';
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    } else {
        ctx.fillStyle = weaponType === 'triple' ? 'rgba(255, 68, 68, 0.8)' : 'rgba(68, 170, 255, 0.8)';
        ctx.strokeStyle = 'white';
    }
    
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    ctx.lineWidth = 1;
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);
    
    ctx.fillStyle = nightVisionEnabled ? '#00ff00' : 'white';
    ctx.font = nightVisionEnabled ? 'bold 16px monospace' : '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const btnText = weaponType === 'triple' ? `Triple (${tripleAmmo})` : `Single (∞)`;
    ctx.fillText(btnText, btnX + btnWidth / 2, btnY + btnHeight / 2);
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('click', (e) => {
    initAudio(); // Initialize audio context on first user interaction
    if (!gameStarted) {
        gameStarted = true;
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Check if the hamburger menu button was clicked to toggle the menu
    if (cx >= 20 && cx <= 20 + 160 && cy >= canvas.height - 70 && cy <= canvas.height - 70 + 45) {
        isMenuOpen = !isMenuOpen;
        return;
    }

    if (isMenuOpen) {
        const nvBtnX = canvas.width / 2 - 100;
        const nvBtnY = canvas.height / 2 + 5;
        const nvBtnW = 200;
        const nvBtnH = 35;
        if (cx >= nvBtnX && cx <= nvBtnX + nvBtnW && cy >= nvBtnY && cy <= nvBtnY + nvBtnH) {
            nightVisionEnabled = !nightVisionEnabled;
        }
        return; // Prevent shooting or switching weapons while menu is open
    }

    const btnX = canvas.width / 2 - 70;
    const btnY = canvas.height - 45;
    const btnWidth = 140;
    const btnHeight = 35;

    if (cx >= btnX && cx <= btnX + btnWidth && cy >= btnY && cy <= btnY + btnHeight) {
        if (weaponType === 'triple' || tripleAmmo > 0) {
            weaponType = weaponType === 'single' ? 'triple' : 'single';
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
        ctx.font = 'bold 40px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WARSHIP', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '20px monospace';
        ctx.fillText('CLICK ANYWHERE TO START', canvas.width / 2, canvas.height / 2 + 20);
        ctx.restore();
        requestAnimationFrame(gameLoop);
        return;
    }

    if (!isMenuOpen) {
        update();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();