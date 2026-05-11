const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

let score = 0;
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let time = 0;
let weaponType = 'single';
let tripleAmmo = 40;

const turret = {
    x: canvas.width / 2,
    y: canvas.height / 2 + 200, // At the bottom of the view
    angle: 0
};

let projectiles = [];
let ships = [];
let explosions = [];
let crates = [];

const horizonY = canvas.height / 2; // Horizon in the middle of view

const viewLeft = canvas.width / 2 - 200;
const viewRight = canvas.width / 2 + 200;
const viewTop = canvas.height / 2 - 200;
const viewBottom = canvas.height / 2 + 200;

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
    // Limit to 1 active crate at a time and lower spawn rate to spread them out
    if (crates.length < 1 && Math.random() < 0.0015) { 
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

    // Clip to the barrel view (larger center rectangle)
    ctx.save();
    ctx.beginPath();
    ctx.rect(canvas.width / 2 - 200, canvas.height / 2 - 200, 400, 400);
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

    // Add a few large curved darker patches across the ocean
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
        const baseY = horizonY + 80 + i * 32;
        const startX = 60 + i * 110;
        const endX = startX + 170;
        const controlX = startX + 90;
        const controlY = baseY + Math.sin(time * 0.45 + i) * 12 + 8;
        ctx.beginPath();
        ctx.moveTo(startX, baseY);
        ctx.quadraticCurveTo(controlX, controlY, endX, baseY);
        ctx.stroke();
    }
    ctx.restore();

    // Draw animated waves (whitecaps) on the water
    ctx.save();
    ctx.strokeStyle = 'rgba(28, 77, 124, 0.6)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 7; i++) {
        const waveBaseY = horizonY + i * 28;
        ctx.beginPath();
        
        // Use dashes to make them look like individual wave crests
        ctx.setLineDash([80 + i * 5, 60 + i * 5]);
        ctx.lineDashOffset = -(time * 15 + i * 25); // Move them left over time
        
        for (let x = 0; x <= canvas.width; x += 20) {
            const waveY = waveBaseY + Math.sin((x * 0.04) + time * 1.5 + i) * 3 + Math.cos((x * 0.02) + time * 0.8) * 2;
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

    ctx.restore();

    // Draw projectiles (not clipped, so they wrap around the bottom area)
    projectiles.forEach(proj => proj.draw());

    // Draw crosshair
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
    const btnY = canvas.height / 2 + 260;
    const btnWidth = 140;
    const btnHeight = 35;
    
    ctx.fillStyle = weaponType === 'triple' ? 'rgba(255, 68, 68, 0.8)' : 'rgba(68, 170, 255, 0.8)';
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);
    
    ctx.fillStyle = 'white';
    ctx.font = '16px sans-serif';
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
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const btnX = canvas.width / 2 - 70;
    const btnY = canvas.height / 2 + 260;
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
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();