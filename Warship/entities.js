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
        this.x = canvas.width + 300; // Spawn outside the right edge of the full screen
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
            this.width = 800; // TRULY MASSIVE size, dwarfs the periscope!
            this.height = 130;
            this.speed = 0.08; // Even slower and more menacing
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
        this.fireTimer = Math.random() * 120 + 60; // Initial firing delay
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
        
        // Enemy Firing Logic
        if (this.type !== 'civilian' && this.type !== 'submarine') {
            this.fireTimer--;
            if (this.fireTimer <= 0) {
                this.fireTimer = Math.random() * 150 + (this.type === 'juggernaut' ? 40 : (this.type === 'dreadnought' ? 60 : 100));
                if (typeof enemyProjectiles !== 'undefined' && this.x > viewLeft && this.x < viewRight) {
                    if (this.type === 'juggernaut') {
                        enemyProjectiles.push(new EnemyProjectile(this.x - 250, this.y));
                        enemyProjectiles.push(new EnemyProjectile(this.x + 250, this.y));
                    } else if (this.type === 'dreadnought') {
                        enemyProjectiles.push(new EnemyProjectile(this.x - 50, this.y));
                        enemyProjectiles.push(new EnemyProjectile(this.x + 50, this.y));
                    } else {
                        enemyProjectiles.push(new EnemyProjectile(this.x, this.y));
                    }
                }
            }
        }
    }

    draw() {
        if (this.type === 'submarine') {
            if (typeof drawSubmarine === 'function') {
                drawSubmarine(ctx, this, time, horizonY, typeof submergeRatio !== 'undefined' ? submergeRatio : 0);
            }
        } else {
            if (typeof drawShip === 'function') {
                drawShip(ctx, this, time, horizonY);
            }
        }
    }

    isOffScreen() {
        return this.x + this.width / 2 < 0;
    }
}

class Crate {
    constructor() {
        this.x = canvas.width + 300;
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
        this.x = canvas.width + 300; 
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

class EnemyProjectile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = canvas.width / 2;
        this.targetY = canvas.height / 2 + 300; // Turret
        
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const angle = Math.atan2(dy, dx);
        const speed = 4 + Math.random() * 2;
        
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.distance = Math.hypot(dx, dy);
        this.traveled = 0;
        this.speed = speed;
        this.radius = 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.traveled += this.speed;
        this.radius = 2 + (this.traveled / this.distance) * 8; 
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    hasHit() {
        return this.traveled >= this.distance;
    }
}