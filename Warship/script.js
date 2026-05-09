const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

let score = 0;
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;

const turret = {
    x: canvas.width / 2,
    y: canvas.height / 2 + 200, // At the bottom of the view
    angle: 0
};

let projectiles = [];
let ships = [];

const horizonY = canvas.height / 2; // Horizon in the middle of view

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
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
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
        return this.x < -50 || this.x > canvas.width + 50 || this.y < -50 || this.y > canvas.height + 50;
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
        ctx.fillStyle = '#333333';
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

    // Draw horizon
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(canvas.width, horizonY);
    ctx.stroke();

    // Draw water
    ctx.fillStyle = '#4682B4'; // Steel blue
    ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

    // Draw ships and projectiles
    ships.forEach(ship => ship.draw());
    projectiles.forEach(proj => proj.draw());

    ctx.restore();

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