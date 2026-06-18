function drawShip(ctx, ship, time, horizonY) {
    ctx.save();

    // Calculate bobbing offset to exactly match the ocean horizon waves
    const horizonOffset = Math.sin(time * 0.8) * 2.4;
    const bobOffset = Math.sin((ship.x * 0.03) + time * 0.8) * 3.2 + Math.cos((ship.x * 0.015) + time * 0.9) * 1.2 + horizonOffset * 0.5;
    
    // Draw foamy water wake trailing behind the ship
    const wakeLength = ship.type === 'juggernaut' ? 200 : 60;
    const wakeY = ship.y + bobOffset + ship.height / 2 - 2; // Near the waterline
    const gradient = ctx.createLinearGradient(ship.x + ship.width / 2 + wakeLength, wakeY, ship.x, wakeY);
    gradient.addColorStop(0, 'rgba(90, 155, 212, 0)'); // Transparent at tail
    gradient.addColorStop(1, 'rgba(90, 155, 212, 0.5)'); // Semi-transparent at ship
    ctx.strokeStyle = gradient;
    ctx.lineWidth = ship.type === 'juggernaut' ? 50 : 15; // Massive wake thickness
    ctx.beginPath();
    ctx.moveTo(ship.x + ship.width / 2 + wakeLength, wakeY);
    ctx.lineTo(ship.x, wakeY);
    ctx.stroke();

    const bowX = ship.x - ship.width / 2;
    const sternX = ship.x + ship.width / 2;
    const deckY = ship.y + bobOffset - ship.height / 4;
    const bottomY = ship.y + bobOffset + ship.height / 2;

    // Draw Hull with slanted bow
    if (ship.type === 'civilian') {
        ctx.fillStyle = '#e8ecef'; // White hospital ship hull
    } else {
        ctx.fillStyle = ship.light ? '#5a6a7a' : '#3a4a5a';
    }
    ctx.beginPath();
    ctx.moveTo(bowX, deckY); // Tip of bow
    ctx.lineTo(sternX, deckY); // Deck line
    ctx.lineTo(sternX, bottomY - 2); // Back stern
    ctx.lineTo(bowX + ship.width * 0.15, bottomY); // Bottom hull
    ctx.quadraticCurveTo(bowX + ship.width * 0.05, bottomY, bowX, deckY); // Curved bow upward
    ctx.fill();

    // Waterline (Dark stripe)
    ctx.fillStyle = '#111';
    ctx.fillRect(bowX + ship.width * 0.12, bottomY - 3, ship.width * 0.88, 3);
    
    // Superstructure and Details
    if (ship.type === 'juggernaut') {
        // Main bridge (massive, tiered)
        ctx.fillStyle = ship.light ? '#6a7a8a' : '#4a5a6a';
        ctx.fillRect(ship.x - ship.width * 0.15, deckY - 50, ship.width * 0.3, 50);
        ctx.fillRect(ship.x - ship.width * 0.08, deckY - 80, ship.width * 0.16, 30);
        ctx.fillRect(ship.x - ship.width * 0.03, deckY - 105, ship.width * 0.06, 25);

        // Smokestacks (4 of them)
        ctx.fillStyle = '#222';
        if (ship.hp > 5) ctx.fillRect(ship.x + ship.width * 0.05, deckY - 75, 25, 60);
        else ctx.fillRect(ship.x + ship.width * 0.05, deckY - 30, 25, 25); // Broken
        
        if (ship.hp > 10) ctx.fillRect(ship.x + ship.width * 0.13, deckY - 70, 25, 58);
        else ctx.fillRect(ship.x + ship.width * 0.13, deckY - 30, 25, 25); // Broken

        ctx.fillRect(ship.x + ship.width * 0.21, deckY - 65, 25, 53);
        ctx.fillRect(ship.x + ship.width * 0.29, deckY - 50, 25, 40);

        // 4 Huge Cannons
        ctx.fillStyle = ship.light ? '#5a6a7a' : '#3a4a5a';
        ctx.fillRect(ship.x - ship.width * 0.40, deckY - 30, 50, 30); 
        ctx.fillRect(ship.x - ship.width * 0.40 - 60, deckY - 24, 60, 14); 
        
        ctx.fillRect(ship.x - ship.width * 0.28, deckY - 45, 50, 30); 
        ctx.fillRect(ship.x - ship.width * 0.28 - 60, deckY - 39, 60, 14); 

        ctx.fillRect(ship.x + ship.width * 0.38, deckY - 30, 50, 30); 
        ctx.fillRect(ship.x + ship.width * 0.38 + 50, deckY - 24, 60, 14);

        ctx.fillRect(ship.x + ship.width * 0.25, deckY - 45, 50, 30); 
        ctx.fillRect(ship.x + ship.width * 0.25 + 50, deckY - 39, 60, 14);

        // Masts
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(ship.x, deckY - 105); ctx.lineTo(ship.x, deckY - 160);
        ctx.moveTo(ship.x - 30, deckY - 130); ctx.lineTo(ship.x + 30, deckY - 130);
        ctx.stroke();

        // Draw Boss Health Bar Floating Above
        const hpWidth = 400;
        const hpX = ship.x - hpWidth / 2;
        const hpY = deckY - 200;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(hpX, hpY, hpWidth, 12);
        ctx.fillStyle = '#ff00ff'; // Magenta for super boss
        ctx.fillRect(hpX, hpY, hpWidth * (ship.hp / ship.maxHp), 12);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(hpX, hpY, hpWidth, 12);

        // Draw Damage Effects (Fire and Smoke)
        if (ship.hp <= 10) {
            ctx.fillStyle = `rgba(30, 30, 30, 0.8)`;
            ctx.beginPath();
            ctx.arc(ship.x + ship.width * 0.13 + 8 + Math.sin(time * 2) * 2, deckY - 50, 25, 0, Math.PI * 2);
            ctx.arc(ship.x + ship.width * 0.13 + 25 + Math.sin(time * 2 + 1) * 5, deckY - 90, 45, 0, Math.PI * 2);
            ctx.arc(ship.x + ship.width * 0.13 + 45 + Math.sin(time * 2 + 2) * 8, deckY - 130, 65, 0, Math.PI * 2);
            ctx.fill();
        }
        if (ship.hp <= 5) {
            ctx.fillStyle = `rgba(255, ${Math.floor(50 + Math.random() * 100)}, 0, 0.9)`;
            ctx.beginPath();
            ctx.moveTo(ship.x - 50, deckY);
            ctx.lineTo(ship.x - 20, deckY - 60 - Math.random() * 40);
            ctx.lineTo(ship.x + 20, deckY - 20);
            ctx.lineTo(ship.x + 50, deckY - 80 - Math.random() * 60);
            ctx.lineTo(ship.x + 80, deckY);
            ctx.fill();
        }
    } else if (ship.type === 'aircraftcarrier') {
        // Support struts under the overhang
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = -ship.width * 0.45; i < ship.width * 0.45; i += 20) {
            ctx.moveTo(ship.x + i, deckY);
            ctx.lineTo(ship.x + i + 10, deckY + 8);
        }
        ctx.stroke();

        // Massive flat flight deck (Asphalt/Dark grey)
        ctx.fillStyle = '#33383d';
        ctx.beginPath();
        ctx.moveTo(ship.x - ship.width * 0.6, deckY - 1); // extended rear
        ctx.lineTo(ship.x + ship.width * 0.55, deckY - 1); // extended front
        ctx.lineTo(ship.x + ship.width * 0.5, deckY - 6); 
        ctx.lineTo(ship.x - ship.width * 0.6, deckY - 6);
        ctx.fill();

        // Angled landing strip section (lighter grey)
        ctx.fillStyle = '#4a4f54';
        ctx.beginPath();
        ctx.moveTo(ship.x - ship.width * 0.6, deckY - 1);
        ctx.lineTo(ship.x + ship.width * 0.2, deckY - 1);
        ctx.lineTo(ship.x + ship.width * 0.1, deckY - 6);
        ctx.lineTo(ship.x - ship.width * 0.6, deckY - 6);
        ctx.fill();

        // Runway strip (dashed white line)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(ship.x - ship.width * 0.55, deckY - 4);
        ctx.lineTo(ship.x + ship.width * 0.45, deckY - 4);
        ctx.stroke();
        
        // Catapult lines (solid yellow)
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.7)';
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(ship.x + ship.width * 0.2, deckY - 2.5);
        ctx.lineTo(ship.x + ship.width * 0.5, deckY - 2.5);
        ctx.moveTo(ship.x + ship.width * 0.1, deckY - 5);
        ctx.lineTo(ship.x + ship.width * 0.4, deckY - 5);
        ctx.stroke();

        // Island (control tower)
        ctx.fillStyle = ship.light ? '#6a7a8a' : '#4a5a6a'; // Hull color
        ctx.fillRect(ship.x + ship.width * 0.15, deckY - 22, 28, 16);
        ctx.fillStyle = '#3a4a5a'; // darker tier
        ctx.fillRect(ship.x + ship.width * 0.18, deckY - 32, 18, 10);
        
        // Tower windows (black slits)
        ctx.fillStyle = '#111';
        ctx.fillRect(ship.x + ship.width * 0.15, deckY - 18, 28, 3);
        ctx.fillRect(ship.x + ship.width * 0.18, deckY - 28, 18, 2);

        // Radar and Antennas
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); 
        ctx.moveTo(ship.x + ship.width * 0.25, deckY - 32);
        ctx.lineTo(ship.x + ship.width * 0.25, deckY - 45); // main mast
        ctx.moveTo(ship.x + ship.width * 0.2, deckY - 40);
        ctx.lineTo(ship.x + ship.width * 0.3, deckY - 40); // crossbar
        ctx.stroke();
        
        // Animated spinning radar dish
        ctx.beginPath();
        ctx.ellipse(ship.x + ship.width * 0.25, deckY - 45, 6 * Math.abs(Math.sin(time * 3)), 2, 0, 0, Math.PI * 2);
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
        drawTinyPlane(ship.x - ship.width * 0.45, deckY - 7);
        drawTinyPlane(ship.x - ship.width * 0.35, deckY - 7);
        drawTinyPlane(ship.x - ship.width * 0.25, deckY - 7);
        drawTinyPlane(ship.x - ship.width * 0.40, deckY - 8);
        drawTinyPlane(ship.x - ship.width * 0.30, deckY - 8);
    } else if (ship.type === 'dreadnought') {
        // Main bridge (large, tiered)
        ctx.fillStyle = ship.light ? '#6a7a8a' : '#4a5a6a';
        ctx.fillRect(ship.x - ship.width * 0.15, deckY - 15, ship.width * 0.3, 15);
        ctx.fillRect(ship.x - ship.width * 0.05, deckY - 25, ship.width * 0.15, 10);
        ctx.fillRect(ship.x, deckY - 35, ship.width * 0.08, 10);

        // Smokestacks (3 of them)
        ctx.fillStyle = '#222';
        ctx.fillRect(ship.x + ship.width * 0.1, deckY - 25, 8, 20);
        
        if (ship.hp > 3) {
            ctx.fillRect(ship.x + ship.width * 0.18, deckY - 22, 8, 18);
        } else {
            ctx.fillRect(ship.x + ship.width * 0.18, deckY - 10, 8, 6); // Broken middle stack
        }

        if (ship.hp > 6) {
            ctx.fillRect(ship.x + ship.width * 0.26, deckY - 18, 8, 16);
        } else {
            ctx.fillRect(ship.x + ship.width * 0.26, deckY - 8, 8, 6); // Broken rear stack
        }

        // Huge Forward Cannons
        ctx.fillStyle = ship.light ? '#5a6a7a' : '#3a4a5a';
        ctx.fillRect(ship.x - ship.width * 0.35, deckY - 8, 16, 8); // Turret 1
        ctx.fillRect(ship.x - ship.width * 0.35 - 18, deckY - 6, 18, 3); // Barrel 1
        ctx.fillRect(ship.x - ship.width * 0.22, deckY - 12, 16, 8); // Turret 2 (Superfiring)
        ctx.fillRect(ship.x - ship.width * 0.22 - 18, deckY - 10, 18, 3); // Barrel 2

        // Huge Aft Cannon
        ctx.fillRect(ship.x + ship.width * 0.3, deckY - 8, 16, 8); // Turret 3
        ctx.fillRect(ship.x + ship.width * 0.3 + 16, deckY - 6, 18, 3); // Barrel 3

        // Masts
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ship.x + ship.width * 0.02, deckY - 35);
        ctx.lineTo(ship.x + ship.width * 0.02, deckY - 50);
        ctx.moveTo(ship.x - ship.width * 0.03, deckY - 40);
        ctx.lineTo(ship.x + ship.width * 0.07, deckY - 40);
        ctx.stroke();

        // Draw Boss Health Bar Floating Above
        const hpWidth = 100;
        const hpX = ship.x - hpWidth / 2;
        const hpY = deckY - 65;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(hpX, hpY, hpWidth, 8);
        ctx.fillStyle = '#ff0000'; // Red enemy health
        ctx.fillRect(hpX, hpY, hpWidth * (ship.hp / ship.maxHp), 8);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(hpX, hpY, hpWidth, 8);

        // Draw Damage Effects (Fire and Smoke)
        if (ship.hp <= 6) {
            // Heavy black smoke from broken rear stack
            ctx.fillStyle = `rgba(30, 30, 30, 0.7)`;
            ctx.beginPath();
            ctx.arc(ship.x + ship.width * 0.26 + 4 + Math.sin(time * 2) * 2, deckY - 15, 8, 0, Math.PI * 2);
            ctx.arc(ship.x + ship.width * 0.26 + 15 + Math.sin(time * 2 + 1) * 5, deckY - 30, 15, 0, Math.PI * 2);
            ctx.arc(ship.x + ship.width * 0.26 + 30 + Math.sin(time * 2 + 2) * 8, deckY - 45, 20, 0, Math.PI * 2);
            ctx.fill();
        }
        if (ship.hp <= 3) {
            // Heavy black smoke from broken middle stack
            ctx.fillStyle = `rgba(30, 30, 30, 0.8)`;
            ctx.beginPath();
            ctx.arc(ship.x + ship.width * 0.18 + 4 + Math.sin(time * 3) * 2, deckY - 20, 10, 0, Math.PI * 2);
            ctx.arc(ship.x + ship.width * 0.18 + 20 + Math.sin(time * 3 + 1) * 5, deckY - 40, 18, 0, Math.PI * 2);
            ctx.arc(ship.x + ship.width * 0.18 + 40 + Math.sin(time * 3 + 2) * 8, deckY - 60, 25, 0, Math.PI * 2);
            ctx.fill();

            // Raging fire on the deck / bridge
            ctx.fillStyle = `rgba(255, ${Math.floor(50 + Math.random() * 100)}, 0, 0.9)`;
            ctx.beginPath();
            ctx.moveTo(ship.x - 15, deckY);
            ctx.lineTo(ship.x - 5, deckY - 20 - Math.random() * 15);
            ctx.lineTo(ship.x + 5, deckY - 5);
            ctx.lineTo(ship.x + 15, deckY - 25 - Math.random() * 20);
            ctx.lineTo(ship.x + 25, deckY);
            ctx.fill();

            // Inner brighter fire
            ctx.fillStyle = `rgba(255, 200, 0, 0.9)`;
            ctx.beginPath();
            ctx.moveTo(ship.x - 5, deckY);
            ctx.lineTo(ship.x, deckY - 10 - Math.random() * 10);
            ctx.lineTo(ship.x + 10, deckY - 15 - Math.random() * 15);
            ctx.lineTo(ship.x + 15, deckY);
            ctx.fill();
        }
    } else if (ship.type === 'battleship') {
        // Main bridge
        ctx.fillStyle = ship.light ? '#6a7a8a' : '#4a5a6a';
        ctx.fillRect(ship.x - ship.width * 0.15, deckY - 12, ship.width * 0.3, 12); // Base
        ctx.fillRect(ship.x - ship.width * 0.05, deckY - 22, ship.width * 0.15, 10); // Tower
        
        // Smokestacks
        ctx.fillStyle = '#222';
        ctx.fillRect(ship.x + ship.width * 0.05, deckY - 14, 5, 10);
        ctx.fillRect(ship.x + ship.width * 0.18, deckY - 16, 5, 12);
        
        // Forward Cannon
        ctx.fillStyle = ship.light ? '#5a6a7a' : '#3a4a5a';
        ctx.fillRect(ship.x - ship.width * 0.25, deckY - 4, 8, 4); // Turret
        ctx.fillRect(ship.x - ship.width * 0.25 - 8, deckY - 3, 8, 2); // Barrel facing left
        
        // Aft (Rear) Cannon
        ctx.fillRect(ship.x + ship.width * 0.25, deckY - 6, 12, 6); // Turret
        ctx.fillRect(ship.x + ship.width * 0.25 + 12, deckY - 4, 12, 2); // Barrel facing right

        // Mast / Antenna
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ship.x + ship.width * 0.02, deckY - 22);
        ctx.lineTo(ship.x + ship.width * 0.02, deckY - 35);
        ctx.moveTo(ship.x - ship.width * 0.05, deckY - 28);
        ctx.lineTo(ship.x + ship.width * 0.09, deckY - 28);
        ctx.stroke();
    } else if (ship.type === 'ptboat') {
        // PT Boat (Fast, small)
        ctx.fillStyle = ship.light ? '#6a7a8a' : '#4a5a6a';
        ctx.fillRect(ship.x - ship.width * 0.1, deckY - 6, ship.width * 0.25, 6); // Small bridge
        
        // Tiny mast
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ship.x, deckY - 6);
        ctx.lineTo(ship.x - 2, deckY - 14);
        ctx.stroke();
    } else if (ship.type === 'civilian') {
        // --- Enhanced Hospital Ship ---
        
        // Green stripe along the hull (Classic Hospital Ship Marking)
        ctx.fillStyle = '#00aa44';
        ctx.fillRect(bowX + ship.width * 0.15, deckY + 3, ship.width * 0.8, 2);

        // Main Superstructure (Tiered ocean-liner style)
        ctx.fillStyle = '#f8fbfc'; // Brilliant white
        ctx.fillRect(ship.x - ship.width * 0.25, deckY - 8, ship.width * 0.6, 8); // Lower deck
        ctx.fillStyle = '#e8ecef';
        ctx.fillRect(ship.x - ship.width * 0.15, deckY - 16, ship.width * 0.4, 8); // Middle deck
        ctx.fillStyle = '#d0d8dc';
        ctx.fillRect(ship.x - ship.width * 0.05, deckY - 22, ship.width * 0.15, 6); // Bridge
        
        // Bridge Windows
        ctx.fillStyle = '#87ceeb'; // Glass blue
        ctx.fillRect(ship.x - ship.width * 0.02, deckY - 20, 2, 2);
        ctx.fillRect(ship.x + ship.width * 0.02, deckY - 20, 2, 2);
        ctx.fillRect(ship.x + ship.width * 0.06, deckY - 20, 2, 2);

        // Twin angled smokestacks
        const drawStack = (sx, sy) => {
            ctx.fillStyle = '#f4f4f4';
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx + 4, sy - 12); ctx.lineTo(sx - 2, sy - 12); ctx.fill();
            ctx.fillStyle = '#cc0000'; // Red band
            ctx.beginPath(); ctx.moveTo(sx - 1.5, sy - 9); ctx.lineTo(sx + 4.5, sy - 9); ctx.lineTo(sx + 4, sy - 12); ctx.lineTo(sx - 2, sy - 12); ctx.fill();
        };
        drawStack(ship.x + ship.width * 0.1, deckY - 16);
        drawStack(ship.x + ship.width * 0.25, deckY - 8);

        // Masts/Antennas
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ship.x + ship.width * 0.02, deckY - 22); ctx.lineTo(ship.x + ship.width * 0.02, deckY - 35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ship.x - ship.width * 0.3, deckY); ctx.lineTo(ship.x - ship.width * 0.3, deckY - 20); ctx.stroke();

        // Crisp Red Crosses with white backgrounds to pop
        const drawRedCross = (cx, cy, size) => {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#cc0000';
            ctx.fillRect(cx - size * 0.15, cy - size * 0.5, size * 0.3, size);
            ctx.fillRect(cx - size * 0.5, cy - size * 0.15, size, size * 0.3);
        };

        // Forward hull cross
        drawRedCross(ship.x - ship.width * 0.15, deckY + 8, 6);
        // Aft hull cross
        drawRedCross(ship.x + ship.width * 0.25, deckY + 8, 6);
        // Superstructure cross
        drawRedCross(ship.x + ship.width * 0.05, deckY - 4, 5);
        
        // Orange Lifeboats hanging on the sides
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(ship.x - ship.width * 0.2, deckY - 2, 5, 2.5);
        ctx.fillRect(ship.x - ship.width * 0.05, deckY - 2, 5, 2.5);
        ctx.fillRect(ship.x + ship.width * 0.15, deckY - 2, 5, 2.5);
    } else {
        // Normal ship (e.g. Destroyer)
        ctx.fillStyle = ship.light ? '#6a7a8a' : '#4a5a6a';
        ctx.fillRect(ship.x - ship.width * 0.1, deckY - 8, ship.width * 0.3, 8); // Bridge
        
        // Smokestack
        ctx.fillStyle = '#222';
        ctx.fillRect(ship.x + ship.width * 0.05, deckY - 14, 5, 10);
        
        // Forward Cannon
        ctx.fillStyle = ship.light ? '#5a6a7a' : '#3a4a5a';
        ctx.fillRect(ship.x - ship.width * 0.25, deckY - 4, 8, 4); // Turret
        ctx.fillRect(ship.x - ship.width * 0.25 - 8, deckY - 3, 8, 2); // Barrel
        
        // Mast
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ship.x, deckY - 8);
        ctx.lineTo(ship.x, deckY - 18);
        ctx.stroke();
    }
    ctx.restore();
}