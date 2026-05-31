class Projectile {
    constructor(x, y, angle, speed = 10, targetY = horizonY, isHoming = false) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.angle = angle;
        this.width = 20;
        this.height = 5;
        this.radius = this.width / 2; // For collision
        this.trail = [];
        this.targetY = targetY; // Track where it should hit the water
        this.isHoming = isHoming;
    }

    update() {
        this.lockedShip = null; // Reset lock-on state every frame
        if (this.isHoming && ships.length > 0) {
            let nearestShip = null;
            let minDist = Infinity;
            for (const ship of ships) {
                if (ship.type === 'submarine' && ship.depth > 5) continue; // Ignore submerged subs
                const dx = ship.x - this.x;
                const dy = ship.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) {
                    minDist = dist;
                    nearestShip = ship;
                }
            }
            if (nearestShip) {
                this.lockedShip = nearestShip; // Register the lock-on!
                
                const targetAngle = Math.atan2(nearestShip.y - this.y, nearestShip.x - this.x);
                let angleDiff = targetAngle - this.angle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                const turnRate = 0.02 * Math.max(1, homingBonus); // Curving gets sharper with upgrades!
                this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);
                
                const speed = Math.hypot(this.vx, this.vy);
                this.vx = Math.cos(this.angle) * speed;
                this.vy = Math.sin(this.angle) * speed;
            }
        }
        this.x += this.vx;
        this.y += this.vy;
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 10) {
            this.trail.shift();
        }
    }

    draw() {
        // Draw Lock-On Reticle over the hunted ship
        if (this.lockedShip) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
            ctx.lineWidth = 1.5;
            
            // Draw a spinning, tracking crosshair
            ctx.translate(this.lockedShip.x, this.lockedShip.y);
            ctx.rotate(time * 2);
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, Math.PI * 2);
            ctx.moveTo(-35, 0); ctx.lineTo(35, 0);
            ctx.moveTo(0, -35); ctx.lineTo(0, 35);
            ctx.stroke();
            ctx.restore();
        }

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
        return this.x < viewLeft || this.x > viewRight || this.y < viewTop || this.y > viewBottom || this.y <= this.targetY;
    }
}

class Ship {
    constructor(type = 'normal') {
        this.x = canvas.width / 2 + 350; // Spawn just outside the right edge of the periscope view
        this.y = horizonY + Math.random() * (turret.y - horizonY); // Between horizon and turret
        this.type = type;
        if (this.type === 'civilian') {
            this.width = 50;
            this.height = 20;
            this.speed = Math.random() * 1.5 + 0.8; // Cruising speed
            this.hp = 1; // Takes 1 hit
            this.light = true;
        } else if (this.type === 'juggernaut') {
            this.x = canvas.width / 2 + 50; // Spawn directly inside the center of the periscope!
            this.y = horizonY + 30;
            this.width = 480; // MASSIVE size, almost fills the periscope!
            this.height = 75;
            this.speed = 0.12; // Extremely slow and menacing
            this.hp = 15; // Takes 15 hits
            this.maxHp = 15;
        } else if (this.type === 'aircraftcarrier') {
            this.width = 140;
            this.height = 25;
            this.speed = Math.random() * 0.4 + 0.4;
            this.hp = 5; // Takes 5 hits
            this.planeTimer = 0; // Timer for launching planes
        } else if (this.type === 'dreadnought') {
            this.x = canvas.width / 2 + 50; // Spawn directly inside the center of the periscope!
            this.y = horizonY + 30;
            this.width = 180;
            this.height = 40;
            this.speed = 0.4; // Slightly faster so it doesn't feel stalled
            this.hp = 9; // Takes 9 hits
            this.maxHp = 9;
        } else if (this.type === 'battleship') {
            this.width = 70;
            this.height = 25;
            this.speed = Math.random() * 0.8 + 0.4; // Slower speed
            this.hp = 3; // Takes 3 hits
        } else if (this.type === 'ptboat') {
            this.width = 25;
            this.height = 12;
            this.speed = Math.random() * 2.5 + 2.5; // Very fast
            this.hp = 1; // Takes 1 hit
        } else {
            this.width = 40;
            this.height = 20;
            this.speed = Math.random() * 2 + 1;
            this.hp = 1; // Takes 1 hit
        }
        this.light = Math.random() < 0.25; // 25% chance to be lighter
    }

    update() {
        this.x -= this.speed;
        if (this.type === 'aircraftcarrier') {
            this.planeTimer++;
            if (this.planeTimer > 180) { // Launch plane roughly every 3 seconds
                this.planeTimer = 0;
                if (planes.length < 6) { // Carriers can launch more planes into the sky
                    planes.push(new Plane(this.x, this.y - this.height));
                }
            }
        }
    }

    draw() {
        ctx.save();
        if (this.type === 'submarine') {
            const currentSubmerge = typeof submergeRatio !== 'undefined' ? submergeRatio : 0;
            ctx.globalAlpha = 0.25 + (currentSubmerge * 0.75); // Fades into full visibility when submerged!
        }

        // Calculate bobbing offset to exactly match the ocean horizon waves
        const horizonOffset = Math.sin(time * 0.8) * 2.4;
        const bobOffset = Math.sin((this.x * 0.03) + time * 0.8) * 3.2 + Math.cos((this.x * 0.015) + time * 0.9) * 1.2 + horizonOffset * 0.5;
        
        // Draw foamy water wake trailing behind the ship
        const wakeLength = this.type === 'juggernaut' ? 120 : 60;
        const wakeY = this.y + bobOffset + this.height / 2 - 2; // Near the waterline
        const gradient = ctx.createLinearGradient(this.x + this.width / 2 + wakeLength, wakeY, this.x, wakeY);
        gradient.addColorStop(0, 'rgba(90, 155, 212, 0)'); // Transparent at tail
        gradient.addColorStop(1, 'rgba(90, 155, 212, 0.5)'); // Semi-transparent at ship
        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.type === 'juggernaut' ? 35 : 15; // Massive wake thickness
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2 + wakeLength, wakeY);
        ctx.lineTo(this.x, wakeY);
        ctx.stroke();

        const bowX = this.x - this.width / 2;
        const sternX = this.x + this.width / 2;
        const deckY = this.y + bobOffset - this.height / 4;
        const bottomY = this.y + bobOffset + this.height / 2;

        // Draw Hull with slanted bow
        if (this.type === 'civilian') {
            ctx.fillStyle = '#e8ecef'; // White hospital ship hull
        } else {
            ctx.fillStyle = this.light ? '#5a6a7a' : '#3a4a5a';
        }
        ctx.beginPath();
        ctx.moveTo(bowX, deckY); // Tip of bow
        ctx.lineTo(sternX, deckY); // Deck line
        ctx.lineTo(sternX, bottomY - 2); // Back stern
        ctx.lineTo(bowX + this.width * 0.15, bottomY); // Bottom hull
        ctx.quadraticCurveTo(bowX + this.width * 0.05, bottomY, bowX, deckY); // Curved bow upward
        ctx.fill();

        // Waterline (Dark stripe)
        ctx.fillStyle = '#111';
        ctx.fillRect(bowX + this.width * 0.12, bottomY - 3, this.width * 0.88, 3);
        
        // Superstructure and Details
        if (this.type === 'juggernaut') {
            // Main bridge (massive, tiered)
            ctx.fillStyle = this.light ? '#6a7a8a' : '#4a5a6a';
            ctx.fillRect(this.x - this.width * 0.15, deckY - 30, this.width * 0.3, 30);
            ctx.fillRect(this.x - this.width * 0.08, deckY - 50, this.width * 0.16, 20);
            ctx.fillRect(this.x - this.width * 0.03, deckY - 65, this.width * 0.06, 15);

            // Smokestacks (4 of them)
            ctx.fillStyle = '#222';
            if (this.hp > 5) ctx.fillRect(this.x + this.width * 0.05, deckY - 45, 18, 40);
            else ctx.fillRect(this.x + this.width * 0.05, deckY - 20, 18, 15); // Broken
            
            if (this.hp > 10) ctx.fillRect(this.x + this.width * 0.13, deckY - 42, 18, 38);
            else ctx.fillRect(this.x + this.width * 0.13, deckY - 20, 18, 15); // Broken

            ctx.fillRect(this.x + this.width * 0.21, deckY - 38, 18, 33);
            ctx.fillRect(this.x + this.width * 0.29, deckY - 30, 18, 25);

            // 4 Huge Cannons
            ctx.fillStyle = this.light ? '#5a6a7a' : '#3a4a5a';
            ctx.fillRect(this.x - this.width * 0.40, deckY - 18, 30, 18); 
            ctx.fillRect(this.x - this.width * 0.40 - 36, deckY - 14, 36, 8); 
            
            ctx.fillRect(this.x - this.width * 0.28, deckY - 26, 30, 18); 
            ctx.fillRect(this.x - this.width * 0.28 - 36, deckY - 22, 36, 8); 

            ctx.fillRect(this.x + this.width * 0.38, deckY - 18, 30, 18); 
            ctx.fillRect(this.x + this.width * 0.38 + 30, deckY - 14, 36, 8);

            ctx.fillRect(this.x + this.width * 0.25, deckY - 26, 30, 18); 
            ctx.fillRect(this.x + this.width * 0.25 + 30, deckY - 22, 36, 8);

            // Masts
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(this.x, deckY - 65); ctx.lineTo(this.x, deckY - 100);
            ctx.moveTo(this.x - 20, deckY - 80); ctx.lineTo(this.x + 20, deckY - 80);
            ctx.stroke();

            // Draw Boss Health Bar Floating Above
            const hpWidth = 240;
            const hpX = this.x - hpWidth / 2;
            const hpY = deckY - 125;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(hpX, hpY, hpWidth, 12);
            ctx.fillStyle = '#ff00ff'; // Magenta for super boss
            ctx.fillRect(hpX, hpY, hpWidth * (this.hp / this.maxHp), 12);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(hpX, hpY, hpWidth, 12);

            // Draw Damage Effects (Fire and Smoke)
            if (this.hp <= 10) {
                ctx.fillStyle = `rgba(30, 30, 30, 0.8)`;
                ctx.beginPath();
                ctx.arc(this.x + this.width * 0.13 + 8 + Math.sin(time * 2) * 2, deckY - 30, 18, 0, Math.PI * 2);
                ctx.arc(this.x + this.width * 0.13 + 25 + Math.sin(time * 2 + 1) * 5, deckY - 60, 30, 0, Math.PI * 2);
                ctx.arc(this.x + this.width * 0.13 + 45 + Math.sin(time * 2 + 2) * 8, deckY - 90, 45, 0, Math.PI * 2);
                ctx.fill();
            }
            if (this.hp <= 5) {
                ctx.fillStyle = `rgba(255, ${Math.floor(50 + Math.random() * 100)}, 0, 0.9)`;
                ctx.beginPath();
                ctx.moveTo(this.x - 30, deckY);
                ctx.lineTo(this.x - 15, deckY - 40 - Math.random() * 30);
                ctx.lineTo(this.x + 15, deckY - 15);
                ctx.lineTo(this.x + 30, deckY - 50 - Math.random() * 40);
                ctx.lineTo(this.x + 50, deckY);
                ctx.fill();
            }
        } else if (this.type === 'aircraftcarrier') {
            // Support struts under the overhang
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = -this.width * 0.45; i < this.width * 0.45; i += 20) {
                ctx.moveTo(this.x + i, deckY);
                ctx.lineTo(this.x + i + 10, deckY + 8);
            }
            ctx.stroke();

            // Massive flat flight deck (Asphalt/Dark grey)
            ctx.fillStyle = '#33383d';
            ctx.beginPath();
            ctx.moveTo(this.x - this.width * 0.6, deckY - 1); // extended rear
            ctx.lineTo(this.x + this.width * 0.55, deckY - 1); // extended front
            ctx.lineTo(this.x + this.width * 0.5, deckY - 6); 
            ctx.lineTo(this.x - this.width * 0.6, deckY - 6);
            ctx.fill();

            // Angled landing strip section (lighter grey)
            ctx.fillStyle = '#4a4f54';
            ctx.beginPath();
            ctx.moveTo(this.x - this.width * 0.6, deckY - 1);
            ctx.lineTo(this.x + this.width * 0.2, deckY - 1);
            ctx.lineTo(this.x + this.width * 0.1, deckY - 6);
            ctx.lineTo(this.x - this.width * 0.6, deckY - 6);
            ctx.fill();

            // Runway strip (dashed white line)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.moveTo(this.x - this.width * 0.55, deckY - 4);
            ctx.lineTo(this.x + this.width * 0.45, deckY - 4);
            ctx.stroke();
            
            // Catapult lines (solid yellow)
            ctx.strokeStyle = 'rgba(255, 200, 0, 0.7)';
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(this.x + this.width * 0.2, deckY - 2.5);
            ctx.lineTo(this.x + this.width * 0.5, deckY - 2.5);
            ctx.moveTo(this.x + this.width * 0.1, deckY - 5);
            ctx.lineTo(this.x + this.width * 0.4, deckY - 5);
            ctx.stroke();

            // Island (control tower)
            ctx.fillStyle = this.light ? '#6a7a8a' : '#4a5a6a'; // Hull color
            ctx.fillRect(this.x + this.width * 0.15, deckY - 22, 28, 16);
            ctx.fillStyle = '#3a4a5a'; // darker tier
            ctx.fillRect(this.x + this.width * 0.18, deckY - 32, 18, 10);
            
            // Tower windows (black slits)
            ctx.fillStyle = '#111';
            ctx.fillRect(this.x + this.width * 0.15, deckY - 18, 28, 3);
            ctx.fillRect(this.x + this.width * 0.18, deckY - 28, 18, 2);

            // Radar and Antennas
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); 
            ctx.moveTo(this.x + this.width * 0.25, deckY - 32);
            ctx.lineTo(this.x + this.width * 0.25, deckY - 45); // main mast
            ctx.moveTo(this.x + this.width * 0.2, deckY - 40);
            ctx.lineTo(this.x + this.width * 0.3, deckY - 40); // crossbar
            ctx.stroke();
            
            // Animated spinning radar dish
            ctx.beginPath();
            ctx.ellipse(this.x + this.width * 0.25, deckY - 45, 6 * Math.abs(Math.sin(time * 3)), 2, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Parked tiny F-22 planes on the rear deck
            const drawTinyPlane = (px, py) => {
                ctx.fillStyle = '#7a8a9a';
                ctx.beginPath();
                ctx.moveTo(px + 4, py);
                ctx.lineTo(px - 2, py - 2);
                ctx.lineTo(px - 4, py - 2);
                ctx.lineTo(px - 2, py);
                ctx.lineTo(px - 4, py + 1); // tail
                ctx.lineTo(px + 4, py + 1);
                ctx.fill();
            };
            drawTinyPlane(this.x - this.width * 0.45, deckY - 7);
            drawTinyPlane(this.x - this.width * 0.35, deckY - 7);
            drawTinyPlane(this.x - this.width * 0.25, deckY - 7);
            drawTinyPlane(this.x - this.width * 0.40, deckY - 8);
            drawTinyPlane(this.x - this.width * 0.30, deckY - 8);
        } else if (this.type === 'dreadnought') {
            // Main bridge (large, tiered)
            ctx.fillStyle = this.light ? '#6a7a8a' : '#4a5a6a';
            ctx.fillRect(this.x - this.width * 0.15, deckY - 15, this.width * 0.3, 15);
            ctx.fillRect(this.x - this.width * 0.05, deckY - 25, this.width * 0.15, 10);
            ctx.fillRect(this.x, deckY - 35, this.width * 0.08, 10);

            // Smokestacks (3 of them)
            ctx.fillStyle = '#222';
            ctx.fillRect(this.x + this.width * 0.1, deckY - 25, 8, 20);
            
            if (this.hp > 3) {
                ctx.fillRect(this.x + this.width * 0.18, deckY - 22, 8, 18);
            } else {
                ctx.fillRect(this.x + this.width * 0.18, deckY - 10, 8, 6); // Broken middle stack
            }

            if (this.hp > 6) {
                ctx.fillRect(this.x + this.width * 0.26, deckY - 18, 8, 16);
            } else {
                ctx.fillRect(this.x + this.width * 0.26, deckY - 8, 8, 6); // Broken rear stack
            }

            // Huge Forward Cannons
            ctx.fillStyle = this.light ? '#5a6a7a' : '#3a4a5a';
            ctx.fillRect(this.x - this.width * 0.35, deckY - 8, 16, 8); // Turret 1
            ctx.fillRect(this.x - this.width * 0.35 - 18, deckY - 6, 18, 3); // Barrel 1
            ctx.fillRect(this.x - this.width * 0.22, deckY - 12, 16, 8); // Turret 2 (Superfiring)
            ctx.fillRect(this.x - this.width * 0.22 - 18, deckY - 10, 18, 3); // Barrel 2

            // Huge Aft Cannon
            ctx.fillRect(this.x + this.width * 0.3, deckY - 8, 16, 8); // Turret 3
            ctx.fillRect(this.x + this.width * 0.3 + 16, deckY - 6, 18, 3); // Barrel 3

            // Masts
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x + this.width * 0.02, deckY - 35);
            ctx.lineTo(this.x + this.width * 0.02, deckY - 50);
            ctx.moveTo(this.x - this.width * 0.03, deckY - 40);
            ctx.lineTo(this.x + this.width * 0.07, deckY - 40);
            ctx.stroke();

            // Draw Boss Health Bar Floating Above
            const hpWidth = 100;
            const hpX = this.x - hpWidth / 2;
            const hpY = deckY - 65;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(hpX, hpY, hpWidth, 8);
            ctx.fillStyle = '#ff0000'; // Red enemy health
            ctx.fillRect(hpX, hpY, hpWidth * (this.hp / this.maxHp), 8);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(hpX, hpY, hpWidth, 8);

            // Draw Damage Effects (Fire and Smoke)
            if (this.hp <= 6) {
                // Heavy black smoke from broken rear stack
                ctx.fillStyle = `rgba(30, 30, 30, 0.7)`;
                ctx.beginPath();
                ctx.arc(this.x + this.width * 0.26 + 4 + Math.sin(time * 2) * 2, deckY - 15, 8, 0, Math.PI * 2);
                ctx.arc(this.x + this.width * 0.26 + 15 + Math.sin(time * 2 + 1) * 5, deckY - 30, 15, 0, Math.PI * 2);
                ctx.arc(this.x + this.width * 0.26 + 30 + Math.sin(time * 2 + 2) * 8, deckY - 45, 20, 0, Math.PI * 2);
                ctx.fill();
            }
            if (this.hp <= 3) {
                // Heavy black smoke from broken middle stack
                ctx.fillStyle = `rgba(30, 30, 30, 0.8)`;
                ctx.beginPath();
                ctx.arc(this.x + this.width * 0.18 + 4 + Math.sin(time * 3) * 2, deckY - 20, 10, 0, Math.PI * 2);
                ctx.arc(this.x + this.width * 0.18 + 20 + Math.sin(time * 3 + 1) * 5, deckY - 40, 18, 0, Math.PI * 2);
                ctx.arc(this.x + this.width * 0.18 + 40 + Math.sin(time * 3 + 2) * 8, deckY - 60, 25, 0, Math.PI * 2);
                ctx.fill();

                // Raging fire on the deck / bridge
                ctx.fillStyle = `rgba(255, ${Math.floor(50 + Math.random() * 100)}, 0, 0.9)`;
                ctx.beginPath();
                ctx.moveTo(this.x - 15, deckY);
                ctx.lineTo(this.x - 5, deckY - 20 - Math.random() * 15);
                ctx.lineTo(this.x + 5, deckY - 5);
                ctx.lineTo(this.x + 15, deckY - 25 - Math.random() * 20);
                ctx.lineTo(this.x + 25, deckY);
                ctx.fill();

                // Inner brighter fire
                ctx.fillStyle = `rgba(255, 200, 0, 0.9)`;
                ctx.beginPath();
                ctx.moveTo(this.x - 5, deckY);
                ctx.lineTo(this.x, deckY - 10 - Math.random() * 10);
                ctx.lineTo(this.x + 10, deckY - 15 - Math.random() * 15);
                ctx.lineTo(this.x + 15, deckY);
                ctx.fill();
            }
        } else if (this.type === 'battleship') {
            // Main bridge
            ctx.fillStyle = this.light ? '#6a7a8a' : '#4a5a6a';
            ctx.fillRect(this.x - this.width * 0.15, deckY - 12, this.width * 0.3, 12); // Base
            ctx.fillRect(this.x - this.width * 0.05, deckY - 22, this.width * 0.15, 10); // Tower
            
            // Smokestacks
            ctx.fillStyle = '#222';
            ctx.fillRect(this.x + this.width * 0.1, deckY - 18, 6, 14);
            ctx.fillRect(this.x + this.width * 0.18, deckY - 16, 5, 12);
            
            // Forward Cannon
            ctx.fillStyle = this.light ? '#5a6a7a' : '#3a4a5a';
            ctx.fillRect(this.x - this.width * 0.3, deckY - 6, 12, 6); // Turret
            ctx.fillRect(this.x - this.width * 0.3 - 12, deckY - 4, 12, 2); // Barrel facing left
            
            // Aft (Rear) Cannon
            ctx.fillRect(this.x + this.width * 0.25, deckY - 6, 12, 6); // Turret
            ctx.fillRect(this.x + this.width * 0.25 + 12, deckY - 4, 12, 2); // Barrel facing right

            // Mast / Antenna
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x + this.width * 0.02, deckY - 22);
            ctx.lineTo(this.x + this.width * 0.02, deckY - 35);
            ctx.moveTo(this.x - this.width * 0.05, deckY - 28);
            ctx.lineTo(this.x + this.width * 0.09, deckY - 28);
            ctx.stroke();
        } else if (this.type === 'ptboat') {
            // PT Boat (Fast, small)
            ctx.fillStyle = this.light ? '#6a7a8a' : '#4a5a6a';
            ctx.fillRect(this.x - this.width * 0.1, deckY - 6, this.width * 0.25, 6); // Small bridge
            
            // Tiny mast
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.x, deckY - 6);
            ctx.lineTo(this.x - 2, deckY - 14);
            ctx.stroke();
        } else if (this.type === 'civilian') {
            // --- Enhanced Hospital Ship ---
            
            // Green stripe along the hull (Classic Hospital Ship Marking)
            ctx.fillStyle = '#00aa44';
            ctx.fillRect(bowX + this.width * 0.15, deckY + 3, this.width * 0.8, 2);

            // Main Superstructure (Tiered ocean-liner style)
            ctx.fillStyle = '#f8fbfc'; // Brilliant white
            ctx.fillRect(this.x - this.width * 0.25, deckY - 8, this.width * 0.6, 8); // Lower deck
            ctx.fillStyle = '#e8ecef';
            ctx.fillRect(this.x - this.width * 0.15, deckY - 16, this.width * 0.4, 8); // Middle deck
            ctx.fillStyle = '#d0d8dc';
            ctx.fillRect(this.x - this.width * 0.05, deckY - 22, this.width * 0.15, 6); // Bridge
            
            // Bridge Windows
            ctx.fillStyle = '#87ceeb'; // Glass blue
            ctx.fillRect(this.x - this.width * 0.02, deckY - 20, 2, 2);
            ctx.fillRect(this.x + this.width * 0.02, deckY - 20, 2, 2);
            ctx.fillRect(this.x + this.width * 0.06, deckY - 20, 2, 2);

            // Twin angled smokestacks
            const drawStack = (sx, sy) => {
                ctx.fillStyle = '#f4f4f4';
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx + 4, sy - 12); ctx.lineTo(sx - 2, sy - 12); ctx.fill();
                ctx.fillStyle = '#cc0000'; // Red band
                ctx.beginPath(); ctx.moveTo(sx - 1.5, sy - 9); ctx.lineTo(sx + 4.5, sy - 9); ctx.lineTo(sx + 4, sy - 12); ctx.lineTo(sx - 2, sy - 12); ctx.fill();
            };
            drawStack(this.x + this.width * 0.1, deckY - 16);
            drawStack(this.x + this.width * 0.25, deckY - 8);

            // Masts/Antennas
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(this.x + this.width * 0.02, deckY - 22); ctx.lineTo(this.x + this.width * 0.02, deckY - 35); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(this.x - this.width * 0.3, deckY); ctx.lineTo(this.x - this.width * 0.3, deckY - 20); ctx.stroke();

            // Crisp Red Crosses with white backgrounds to pop
            const drawRedCross = (cx, cy, size) => {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#cc0000';
                ctx.fillRect(cx - size * 0.15, cy - size * 0.5, size * 0.3, size);
                ctx.fillRect(cx - size * 0.5, cy - size * 0.15, size, size * 0.3);
            };

            // Forward hull cross
            drawRedCross(this.x - this.width * 0.15, deckY + 8, 6);
            // Aft hull cross
            drawRedCross(this.x + this.width * 0.25, deckY + 8, 6);
            // Superstructure cross
            drawRedCross(this.x + this.width * 0.05, deckY - 4, 5);
            
            // Orange Lifeboats hanging on the sides
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(this.x - this.width * 0.2, deckY - 2, 5, 2.5);
            ctx.fillRect(this.x - this.width * 0.05, deckY - 2, 5, 2.5);
            ctx.fillRect(this.x + this.width * 0.15, deckY - 2, 5, 2.5);
        } else {
            // Normal ship (e.g. Destroyer)
            ctx.fillStyle = this.light ? '#6a7a8a' : '#4a5a6a';
            ctx.fillRect(this.x - this.width * 0.1, deckY - 8, this.width * 0.3, 8); // Bridge
            
            // Smokestack
            ctx.fillStyle = '#222';
            ctx.fillRect(this.x + this.width * 0.05, deckY - 14, 5, 10);
            
            // Forward Cannon
            ctx.fillStyle = this.light ? '#5a6a7a' : '#3a4a5a';
            ctx.fillRect(this.x - this.width * 0.25, deckY - 4, 8, 4); // Turret
            ctx.fillRect(this.x - this.width * 0.25 - 8, deckY - 3, 8, 2); // Barrel
            
            // Mast
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(this.x, deckY - 8);
            ctx.lineTo(this.x, deckY - 18);
            ctx.stroke();
        }
        ctx.restore();
    }

    isOffScreen() {
        return this.x + this.width / 2 < 0;
    }
}

class Crate {
    constructor() {
        this.x = canvas.width / 2 + 350; // Spawn just outside the right edge of the periscope view
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
        // Match the exact ocean wave mathematical frequency
        const horizonOffset = Math.sin(time * 0.8) * 2.4;
        const bobOffset = Math.sin((this.x * 0.03) + time * 0.8) * 3.2 + Math.cos((this.x * 0.015) + time * 0.9) * 1.2 + horizonOffset * 0.5;
        ctx.translate(this.x, this.y + bobOffset);
        
        // Draw floating ripple/shadow under the crate
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, this.height / 2, this.width * 0.8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Base Crate Background (Dark wood)
        ctx.fillStyle = '#4a2f1d'; 
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        // Horizontal wooden planks (Lighter wood)
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(-this.width / 2, -this.height / 2 + 1, this.width, 4);
        ctx.fillRect(-this.width / 2, -this.height / 2 + 6, this.width, 4);
        ctx.fillRect(-this.width / 2, -this.height / 2 + 11, this.width, 4);

        // Dark outline for 3D depth
        ctx.strokeStyle = '#2d1a0c';
        ctx.lineWidth = 1;
        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Metal reinforcing straps (vertical)
        ctx.fillStyle = '#333333';
        ctx.fillRect(-this.width / 2 + 4, -this.height / 2, 3, this.height);
        ctx.fillRect(this.width / 2 - 7, -this.height / 2, 3, this.height);
        
        // Small metal rivets
        ctx.fillStyle = '#888888';
        ctx.fillRect(-this.width / 2 + 5, -this.height / 2 + 2, 1, 1);
        ctx.fillRect(-this.width / 2 + 5, this.height / 2 - 3, 1, 1);
        ctx.fillRect(this.width / 2 - 6, -this.height / 2 + 2, 1, 1);
        ctx.fillRect(this.width / 2 - 6, this.height / 2 - 3, 1, 1);

        // Ammo symbol: 3 small artillery shells in the center
        ctx.fillStyle = '#ffd700'; // Gold/Brass
        ctx.fillRect(-4, -2, 2, 5);
        ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(-3, -4); ctx.lineTo(-2, -2); ctx.fill();
        ctx.fillRect(-1, -2, 2, 5);
        ctx.beginPath(); ctx.moveTo(-1, -2); ctx.lineTo(0, -4); ctx.lineTo(1, -2); ctx.fill();
        ctx.fillRect(2, -2, 2, 5);
        ctx.beginPath(); ctx.moveTo(2, -2); ctx.lineTo(3, -4); ctx.lineTo(4, -2); ctx.fill();
        
        ctx.restore();
    }

    isOffScreen() {
        return this.x + this.width / 2 < 0;
    }
}

class Mine {
    constructor() {
        this.x = canvas.width / 2 + 350; // Spawn just outside the right edge of the periscope view
        this.y = horizonY + Math.random() * (turret.y - horizonY); 
        this.radius = 12;
        this.speed = Math.random() * 1.0 + 0.3; // Drift speed
    }

    update() {
        this.x -= this.speed;
    }

    draw() {
        ctx.save();
        const horizonOffset = Math.sin(time * 0.8) * 2.4;
        const bobOffset = Math.sin((this.x * 0.03) + time * 0.8) * 3.2 + Math.cos((this.x * 0.015) + time * 0.9) * 1.2 + horizonOffset * 0.5;
        ctx.translate(this.x, this.y + bobOffset);
        
        // Shadow/Ripple
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, this.radius, this.radius * 1.2, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hull
        ctx.fillStyle = '#cc0000'; // Bright red
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#660000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Spikes (Contact horns)
        ctx.fillStyle = '#555';
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i + time * 0.5;
            const sx = Math.cos(angle) * this.radius;
            const sy = Math.sin(angle) * this.radius;
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    isOffScreen() {
        return this.x + this.radius < 0;
    }
}

class Explosion {
    constructor(x, y, isMassive = false) {
        this.x = x;
        this.y = y;
        this.isMassive = isMassive;
        this.circleRadius = isMassive ? 20 : 5;
        this.circleLife = 1.0;
        this.particles = [];
        
        const particleCount = isMassive ? 150 : 20; // Spawn way more particles if massive!
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * (isMassive ? 25 : 6),
                vy: (Math.random() - 0.5) * (isMassive ? 25 : 6),
                size: Math.random() * (isMassive ? 10 : 4) + (isMassive ? 4 : 1),
                life: 1.0,
                decay: Math.random() * (isMassive ? 0.015 : 0.05) + (isMassive ? 0.01 : 0.03),
                color: ['#ff0000', '#ff8800', '#ffff00', '#ffffff'][Math.floor(Math.random() * 4)]
            });
        }
        this.life = 1.0;
    }

    update() {
        this.circleRadius += this.isMassive ? 15 : 3; // Grow the flash rapidly
        this.circleLife -= this.isMassive ? 0.02 : 0.1; // Fade the flash slower

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

class Splash {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.circleRadius = 5;
        this.circleLife = 1.0;
        this.particles = [];
        // Spawn a massive geyser of water
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8, // Wider spread
                vy: (Math.random() - 1) * 10 - 2, // Huge upward blast
                size: Math.random() * 6 + 2, // Chunky droplets
                life: 1.0,
                decay: Math.random() * 0.03 + 0.01,
                color: ['rgba(255, 255, 255, 0.9)', 'rgba(180, 220, 255, 0.9)', 'rgba(120, 180, 255, 0.9)'][Math.floor(Math.random() * 3)]
            });
        }
        this.life = 1.0;
    }

    update() {
        this.circleRadius += 4; // Fast expanding water ripple
        this.circleLife -= 0.05; // Fade out

        let maxLife = 0;
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.4; // Strong gravity pulls water down
            p.life -= p.decay;
            if (p.life > maxLife) maxLife = p.life;
        });
        this.life = Math.max(maxLife, this.circleLife);
    }

    draw() {
        ctx.save();
        
        // Draw a white expanding ripple base on the water
        if (this.circleLife > 0) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, this.circleLife)})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.circleRadius * 2, this.circleRadius * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, this.circleLife * 0.3)})`;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.circleRadius * 2, this.circleRadius * 0.5, 0, 0, Math.PI * 2);
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

class Raindrop {
    constructor() {
        this.x = Math.random() * (canvas.width + 1200) - 400; // Wider spread for harder angles
        this.y = viewTop - 50; // Start above periscope view
        this.length = Math.random() * 30 + 15;
        this.speed = Math.random() * 20 + 20 + (rainMultiplier * 5); // Fall faster in heavy squalls
        this.vx = -Math.random() * 5 - 3 - (rainMultiplier * 3); // Harder slant due to strong storm wind
    }
    update() {
        this.y += this.speed;
        this.x += this.vx;
    }
    draw() {
        ctx.strokeStyle = `rgba(200, 220, 255, ${0.3 + stormIntensity * 0.2})`;
        ctx.lineWidth = 1.5 + (rainMultiplier * 0.3); // Thicker drops in heavy rain
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx, this.y - this.length);
        ctx.stroke();
    }
    isOffScreen() {
        return this.y > viewBottom + 50;
    }
}

class Plane {
    constructor(spawnX = null, spawnY = null) {
        if (spawnX !== null && spawnY !== null) {
            this.x = spawnX;
            this.y = spawnY;
            this.facingRight = false;
            this.vx = -(Math.random() * 2.5 + 4); // Always fly left
            this.vy = -3.5; // Climb steeply from the carrier deck
        } else {
            // Spawn high up in the sky, above the horizon
            this.y = viewTop + Math.random() * (horizonY - viewTop - 80); 
            this.vy = 0;
            
            // Always spawn on the right side
            this.x = viewRight + 100;
            this.vx = -(Math.random() * 2.5 + 4); // Fast moving to the left
            this.facingRight = false;
        }
        this.width = 30;
        this.height = 10;
        this.hp = 1;
        
        // Randomize when the plane will drop its bomb during its pass
        this.bombTimer = Math.floor(Math.random() * 60) + 30;
        
        if (typeof playPlaneWhooshSound === 'function') {
            playPlaneWhooshSound();
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.vy < 0) this.vy += 0.03; // Slowly level out
        if (this.vy > 0) this.vy = 0;
        
        this.bombTimer--;
        if (this.bombTimer === 0 && typeof bombs !== 'undefined') {
            bombs.push(new Bomb(this.x, this.y));
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (!this.facingRight) ctx.scale(-1, 1);

        // Tilt the plane slightly if it is climbing
        const pitch = Math.atan2(this.vy, Math.abs(this.vx));
        ctx.rotate(pitch);

        // Jet Exhaust (Flickering Afterburner Flame)
        ctx.fillStyle = `rgba(100, 200, 255, ${0.6 + Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(-18, -1);
        ctx.lineTo(-26 - Math.random() * 8, 0);
        ctx.lineTo(-18, 1);
        ctx.fill();
        
        // Inner hotter flame
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(-18, -0.5);
        ctx.lineTo(-22 - Math.random() * 3, 0);
        ctx.lineTo(-18, 0.5);
        ctx.fill();

        // Far Tail Fin
        ctx.fillStyle = '#33383d';
        ctx.beginPath();
        ctx.moveTo(-10, -2); ctx.lineTo(-16, -11); ctx.lineTo(-20, -11); ctx.lineTo(-16, -2);
        ctx.fill();

        // Far Wing (darker for 3D depth)
        ctx.fillStyle = '#3a3f44';
        ctx.beginPath();
        ctx.moveTo(2, 0); ctx.lineTo(-6, -6); ctx.lineTo(-12, -6); ctx.lineTo(-4, 0);
        ctx.fill();

        // Sleek Stealth Fuselage
        ctx.fillStyle = '#4a4f54';
        ctx.beginPath();
        ctx.moveTo(22, 0);   // Sharp nose tip
        ctx.lineTo(12, -2);  // Upper nose
        ctx.lineTo(6, -3);   // Base of canopy
        ctx.lineTo(-8, -3);  // Spine
        ctx.lineTo(-18, -2); // Top engine exhaust
        ctx.lineTo(-18, 2);  // Bottom engine exhaust
        ctx.lineTo(-12, 3);  // Lower tail
        ctx.lineTo(0, 4);    // Belly
        ctx.lineTo(8, 2);    // Intake bottom
        ctx.lineTo(14, 1);   // Lower nose
        ctx.closePath();
        ctx.fill();
        
        // Angular Air Intake (Dark recess)
        ctx.fillStyle = '#1a1c1e';
        ctx.beginPath();
        ctx.moveTo(6, 1); ctx.lineTo(10, 0); ctx.lineTo(8, 2); ctx.closePath();
        ctx.fill();
        
        // Chiseled Stealth Edge (Body detail)
        ctx.strokeStyle = '#3a3f44';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(6, 1); ctx.lineTo(-18, 0); ctx.stroke();
        
        // F-22 Gold-tinted Canopy (Reduces radar signature!)
        ctx.fillStyle = '#cda434'; 
        ctx.beginPath();
        ctx.moveTo(10, -2); ctx.lineTo(4, -6); ctx.lineTo(-2, -5); ctx.lineTo(1, -2.5);
        ctx.fill();

        // Near Horizontal Stabilizer (Tail wing)
        ctx.fillStyle = '#3a3f44';
        ctx.beginPath();
        ctx.moveTo(-10, 1); ctx.lineTo(-16, 4); ctx.lineTo(-22, 4); ctx.lineTo(-15, 1);
        ctx.fill();

        // Near Tail Fin
        ctx.fillStyle = '#555b61';
        ctx.beginPath();
        ctx.moveTo(-8, -2); ctx.lineTo(-14, -12); ctx.lineTo(-18, -12); ctx.lineTo(-14, -2);
        ctx.fill();

        // Near Wing (brighter)
        ctx.fillStyle = '#5a6066';
        ctx.beginPath();
        ctx.moveTo(2, 1); ctx.lineTo(-6, 9); ctx.lineTo(-14, 9); ctx.lineTo(-4, 1);
        ctx.fill();

        ctx.restore();
    }

    isOffScreen() {
        return (this.facingRight && this.x > viewRight + 150) || (!this.facingRight && this.x < viewLeft - 150);
    }
}

class Bomb {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vy = 1; // Initial fall speed
        this.width = 12;
        this.height = 20;
        this.targetY = horizonY + Math.random() * 200 + 50; // Explodes randomly in the water
    }

    update() {
        this.y += this.vy;
        this.vy += 0.15; // Gravity acceleration
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Speed line / motion blur trail
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2 - 4);
        ctx.lineTo(0, -this.height / 2 - 15 - Math.random() * 10);
        ctx.stroke();

        // Tail fins (back layer)
        ctx.fillStyle = '#2a2d30';
        ctx.beginPath();
        ctx.moveTo(-this.width / 2 + 2, -this.height / 4);
        ctx.lineTo(-this.width / 2 - 5, -this.height / 2 - 6);
        ctx.lineTo(this.width / 2 + 5, -this.height / 2 - 6);
        ctx.lineTo(this.width / 2 - 2, -this.height / 4);
        ctx.fill();

        // 3D Body Gradient
        const grad = ctx.createLinearGradient(-this.width / 2, 0, this.width / 2, 0);
        grad.addColorStop(0, '#2b3035');   // Left dark edge
        grad.addColorStop(0.3, '#7a858e'); // Metallic highlight
        grad.addColorStop(1, '#1a1d20');   // Right shadow

        // Aerodynamic teardrop body
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, this.height / 2 + 2); // Bottom tip
        ctx.quadraticCurveTo(this.width / 2 + 2, 0, this.width / 2 - 2, -this.height / 2); // Right curve
        ctx.lineTo(-this.width / 2 + 2, -this.height / 2); // Flat top
        ctx.quadraticCurveTo(-this.width / 2 - 2, 0, 0, this.height / 2 + 2); // Left curve
        ctx.fill();

        // Classic Yellow Ordnance Stripe
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-this.width / 2 + 1.5, this.height / 4);
        ctx.lineTo(this.width / 2 - 1.5, this.height / 4);
        ctx.stroke();

        // Glowing arming indicator tip
        ctx.fillStyle = '#ff3300';
        ctx.beginPath(); ctx.arc(0, this.height / 2 + 1, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffaa00'; // Inner hot glow
        ctx.beginPath(); ctx.arc(0, this.height / 2 + 1, 1, 0, Math.PI * 2); ctx.fill();

        // Center Fin (Front layer for 3D perspective)
        ctx.fillStyle = '#1a1d20';
        ctx.fillRect(-1.5, -this.height / 2 - 6, 3, 10);

        ctx.restore();
    }

    isOffScreen() {
        return this.y >= this.targetY;
    }
}

class Flare {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -18; // Shoot high up into the sky
        this.life = 1.0;
        this.active = false;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        if (this.vy < 0) {
            this.vy += 0.3; // Gravity slowing it down at the apex
        } else {
            if (!this.active) {
                this.active = true;
                this.vy = 0.5; // Parachute deploys, floats down slowly
            }
            this.life -= 0.003; // Lasts ~300 frames (5-6 seconds)
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (this.active) {
            // Sizzling flare light
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 150 + Math.random() * 20);
            glow.addColorStop(0, `rgba(255, 255, 200, ${this.life})`);
            glow.addColorStop(0.2, `rgba(255, 150, 50, ${this.life * 0.8})`);
            glow.addColorStop(1, 'rgba(255, 50, 0, 0)');
            
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(0, 0, 150 + Math.random() * 20, 0, Math.PI * 2); ctx.fill();

            // Small parachute
            ctx.fillStyle = `rgba(255, 255, 255, ${this.life})`;
            ctx.beginPath(); ctx.arc(0, -25, 12, Math.PI, 0); ctx.fill();
            
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.life})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-12, -25); ctx.lineTo(0, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(12, -25); ctx.lineTo(0, 0); ctx.stroke();

            // Burning core
            ctx.fillStyle = '#ffffff'; ctx.fillRect(-2, 0, 4, 6);
            ctx.fillStyle = '#ff5500'; ctx.fillRect(-2, 6, 4, 4);
        } else {
            // Shooting up tracer
            ctx.fillStyle = '#ffaa00'; ctx.fillRect(-2, -5, 4, 15);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -5, 2, 8);
        }
        ctx.restore();
    }

    isDead() {
        return this.life <= 0 || (this.active && this.y > horizonY);
    }
}