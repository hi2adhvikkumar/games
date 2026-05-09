const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

let score = 0;
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let time = 0;

const turret = {
    x: canvas.width / 2,
    y: canvas.height / 2 + 200, // At the bottom of the view
    angle: 0
};

let projectiles = [];
let ships = [];

const horizonY = canvas.height / 2; // Horizon in the middle of view

const viewLeft = canvas.width / 2 - 200;
const viewRight = canvas.width / 2 + 200;
const viewTop = canvas.height / 2 - 200;
const viewBottom = canvas.height / 2 + 200;

class Projectile {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * 10;
        this.vy = Math.sin(angle) * 10;
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

function updateTurretAngle() {
    const dx = mouseX - turret.x;
    const dy = mouseY - turret.y;
    turret.angle = Math.atan2(dy, dx);
}

function shoot() {
    projectiles.push(new Projectile(turret.x, turret.y, turret.angle));
}

function spawnShip() {
    if (Math.random() < 0.02) {
        ships.push(new Ship());
    }
}

function checkCollisions() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        for (let j = ships.length - 1; j >= 0; j--) {
            const ship = ships[j];
            const dx = proj.x - ship.x;
            const dy = proj.y - ship.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < proj.radius + ship.width / 2) {
                projectiles.splice(i, 1);
                ships.splice(j, 1);
                score += 10;
                scoreElement.textContent = `Score: ${score}`;
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

    spawnShip();
    checkCollisions();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Clip to the barrel view (larger center rectangle)
    ctx.save();
    ctx.beginPath();
    ctx.rect(canvas.width / 2 - 200, canvas.height / 2 - 200, 400, 400);
    ctx.clip();

    // Draw sky
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, horizonY);

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
    ctx.fillStyle = '#003060';
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
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('click', shoot);

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();