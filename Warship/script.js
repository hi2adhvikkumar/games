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

let audioCtx;
let ambientStarted = false;

function initAudio() {
    try {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (!ambientStarted) {
            startAmbientAudio();
        }
    } catch (e) {
        console.error("Audio init error:", e);
    }
}

function startAmbientAudio() {
    if (!audioCtx) return;
    try {
        ambientStarted = true;
        const now = audioCtx.currentTime;

        // --- Submarine Engine Hum ---
        const humOsc = audioCtx.createOscillator();
        humOsc.type = 'triangle'; 
        humOsc.frequency.setValueAtTime(65, now); // Raised pitch so it's audible on laptop/monitor speakers
        const humGain = audioCtx.createGain();
        humGain.gain.setValueAtTime(0.30, now); // Increased volume
        humOsc.connect(humGain);
        humGain.connect(audioCtx.destination);
        humOsc.start(now);

        // --- Ocean Waves / Wind ---
        const bufferSize = audioCtx.sampleRate * 2; 
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        // Filter and sweep to simulate rolling waves
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now); // Let more high-frequencies through for a "crisper" wave sound
        
        const lfoFreq = audioCtx.createOscillator();
        lfoFreq.type = 'sine';
        lfoFreq.frequency.setValueAtTime(0.2, now); // One wave every 5 seconds
        const lfoFreqGain = audioCtx.createGain();
        lfoFreqGain.gain.setValueAtTime(800, now); // Wider filter sweep
        
        const waveGain = audioCtx.createGain();
        waveGain.gain.setValueAtTime(0.50, now); // Overall wave volume increased
        
        const lfoVol = audioCtx.createOscillator();
        lfoVol.type = 'sine';
        lfoVol.frequency.setValueAtTime(0.2, now); 
        const lfoVolGain = audioCtx.createGain();
        lfoVolGain.gain.setValueAtTime(0.25, now); // Deeper volume swell as waves roll in
        
        // Connect the nodes
        lfoFreq.connect(lfoFreqGain);
        lfoFreqGain.connect(filter.frequency);
        lfoVol.connect(lfoVolGain);
        lfoVolGain.connect(waveGain.gain);
        
        noiseSource.connect(filter);
        filter.connect(waveGain);
        waveGain.connect(audioCtx.destination);

        noiseSource.start(now);
        lfoFreq.start(now);
        lfoVol.start(now);

    } catch (e) {
        console.error("Ambient audio error:", e);
    }
}

// Initialize audio and start game on any click or key press anywhere on the window
window.addEventListener('click', () => {
    initAudio();
});
window.addEventListener('keydown', (e) => {
    initAudio();
    if (!gameStarted) {
        gameStarted = true;
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
    // Cheat code 'B' to instantly spawn the Boss (Dreadnought)
    if (e.key && e.key.toLowerCase() === 'b') {
        spawnDreadnoughtPending = true;
        dreadnoughtWarningTimer = 180;
    }
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

function playExplosionSound() {
    try {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        
        const now = audioCtx.currentTime;
        const duration = 0.15; // Longer duration for a crisp click

        // Layer 1: High-frequency snap (The plastic click)
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(2000, now); // Softer, lower frequency
        noiseFilter.frequency.exponentialRampToValueAtTime(100, now + duration);
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(0.6, now + 0.002); // Softer attack
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        noise.start(now);

        // Layer 2: Fast pitch drop (The mechanical switch sound)
        const osc = audioCtx.createOscillator();
        osc.type = 'sine'; // Smoother, softer body
        osc.frequency.setValueAtTime(2000, now); // Start lower
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.03); // Lightning fast drop
        
        const oscGain = audioCtx.createGain();
        oscGain.gain.setValueAtTime(0, now);
        oscGain.gain.linearRampToValueAtTime(0.6, now + 0.002); // Softer attack
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        osc.connect(oscGain);
        oscGain.connect(audioCtx.destination);
        
        osc.start(now);
        osc.stop(now + duration);
    } catch (e) {
        console.error("Audio error:", e);
    }
}

function playShootSound() {
    try {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        
        const now = audioCtx.currentTime;
        const duration = 1.8;

        // Layer 1: Deep sub-bass boom (Punchier)
        const oscBoom = audioCtx.createOscillator();
        const gainBoom = audioCtx.createGain();
        
        oscBoom.type = 'sine';
        oscBoom.frequency.setValueAtTime(200, now); // Higher initial pitch for sharp kick
        oscBoom.frequency.exponentialRampToValueAtTime(30, now + 0.15); // Faster drop
        oscBoom.frequency.linearRampToValueAtTime(20, now + 1.0);
        
        gainBoom.gain.setValueAtTime(0, now);
        gainBoom.gain.linearRampToValueAtTime(0.5, now + 0.01);
        gainBoom.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        oscBoom.connect(gainBoom);
        gainBoom.connect(audioCtx.destination);
        
        oscBoom.start(now);
        oscBoom.stop(now + duration);

        // Layer 2: Gritty metallic crack (initial blast)
        const oscCrack = audioCtx.createOscillator();
        const gainCrack = audioCtx.createGain();
        oscCrack.type = 'square';
        oscCrack.frequency.setValueAtTime(350, now); // Brighter crack
        oscCrack.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        
        gainCrack.gain.setValueAtTime(0, now);
        gainCrack.gain.linearRampToValueAtTime(0.4, now + 0.01);
        gainCrack.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        const filterCrack = audioCtx.createBiquadFilter();
        filterCrack.type = 'lowpass';
        filterCrack.frequency.setValueAtTime(4000, now);
        filterCrack.frequency.linearRampToValueAtTime(400, now + 0.2);
        
        oscCrack.connect(filterCrack);
        filterCrack.connect(gainCrack);
        gainCrack.connect(audioCtx.destination);
        oscCrack.start(now);
        oscCrack.stop(now + 0.3);

        // Layer 3: Explosive white noise blast
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.8;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(3000, now); // Starts much brighter
        noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.8);
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.01);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);

        // Layer 4: Distant Ocean Echo (Thunderous rumble after the shot)
        const echoFilter = audioCtx.createBiquadFilter();
        echoFilter.type = 'lowpass';
        echoFilter.frequency.setValueAtTime(400, now + 0.3);
        echoFilter.frequency.linearRampToValueAtTime(50, now + duration);
        
        const echoGain = audioCtx.createGain();
        echoGain.gain.setValueAtTime(0, now);
        echoGain.gain.linearRampToValueAtTime(0, now + 0.25); // Wait for initial blast to clear
        echoGain.gain.linearRampToValueAtTime(0.15, now + 0.4); // Swell back up
        echoGain.gain.exponentialRampToValueAtTime(0.01, now + duration); // Fade out slowly
        
        noise.connect(echoFilter);
        echoFilter.connect(echoGain);
        echoGain.connect(audioCtx.destination);
        
        noise.start(now);

    } catch (e) {
        console.error("Audio error:", e);
    }
}

function playSplashSound() {
    try {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        const now = audioCtx.currentTime;
        const duration = 0.4;
        
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(800, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, now + duration);

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        noise.start(now);
    } catch (e) {
        console.error("Audio error:", e);
    }
}

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
let nextBossScore = 20; // Trigger the boss naturally every 20 points
let spawnDreadnoughtPending = false; 
let dreadnoughtWarningTimer = 0;

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
let splashes = [];

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
        if (this.type === 'dreadnought') {
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
    }

    draw() {
        ctx.save();
        if (this.type === 'submarine') {
            ctx.globalAlpha = 0.25; // Active camouflage to make them hard to see in the view
        }

        // Calculate bobbing offset to exactly match the ocean horizon waves
        const horizonOffset = Math.sin(time * 0.8) * 2.4;
        const bobOffset = Math.sin((this.x * 0.03) + time * 0.8) * 3.2 + Math.cos((this.x * 0.015) + time * 0.9) * 1.2 + horizonOffset * 0.5;
        
        // Draw foamy water wake trailing behind the ship
        const wakeLength = 60;
        const wakeY = this.y + bobOffset + this.height / 2 - 2; // Near the waterline
        const gradient = ctx.createLinearGradient(this.x + this.width / 2 + wakeLength, wakeY, this.x, wakeY);
        gradient.addColorStop(0, 'rgba(90, 155, 212, 0)'); // Transparent at tail
        gradient.addColorStop(1, 'rgba(90, 155, 212, 0.5)'); // Semi-transparent at ship
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 15; // Wake thickness
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2 + wakeLength, wakeY);
        ctx.lineTo(this.x, wakeY);
        ctx.stroke();

        const bowX = this.x - this.width / 2;
        const sternX = this.x + this.width / 2;
        const deckY = this.y + bobOffset - this.height / 4;
        const bottomY = this.y + bobOffset + this.height / 2;

        // Draw Hull with slanted bow
        ctx.fillStyle = this.light ? '#5a6a7a' : '#3a4a5a';
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
        if (this.type === 'dreadnought') {
            // Main bridge (large, tiered)
            ctx.fillStyle = this.light ? '#6a7a8a' : '#4a5a6a';
            ctx.fillRect(this.x - this.width * 0.15, deckY - 15, this.width * 0.3, 15);
            ctx.fillRect(this.x - this.width * 0.05, deckY - 25, this.width * 0.15, 10);
            ctx.fillRect(this.x, deckY - 35, this.width * 0.08, 10);

            // Smokestacks (3 of them)
            ctx.fillStyle = '#222';
            ctx.fillRect(this.x + this.width * 0.1, deckY - 25, 8, 20);
            ctx.fillRect(this.x + this.width * 0.18, deckY - 22, 8, 18);
            ctx.fillRect(this.x + this.width * 0.26, deckY - 18, 8, 16);

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

function updateTurretAngle() {
    const dx = mouseX - turret.x;
    const dy = mouseY - turret.y;
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
    if (dreadnoughtActive) return; // Stop spawning normal ships during the boss phase
    
    if (Math.random() < 0.05) { // Increased spawn rate from 2% to 5% per frame
        const rand = Math.random();
        let type = 'normal';
        if (rand < 0.35) type = 'battleship'; // 35% chance
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
                if (ship.type === 'submarine' && ship.depth > 5) continue; // Too deep to hit!

                explosions.push(new Explosion(ship.x, ship.y));
                playExplosionSound();
                shakeIntensity = 8; // Trigger screen shake
                projectiles.splice(i, 1);
                
                ship.hp -= 1;
                if (ship.hp <= 0) {
                    ships.splice(j, 1);
                    score += 1;
                    if (ship.type === 'dreadnought') {
                        dreadnoughtActive = false;
                        credits += 150; // Boss defeated!
                    } else if (ship.type === 'submarine') {
                        credits += 40; // High reward for sub!
                    } else {
                        credits += (ship.type === 'battleship' ? 30 : (ship.type === 'ptboat' ? 20 : 10));
                    }
                    
                    if (score >= nextBossScore) {
                        nextBossScore += 20;
                        spawnDreadnoughtPending = true;
                        dreadnoughtWarningTimer = 180; // Show warning for 3 seconds
                    }
                    
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

        // Check collision with crates
        for (let k = crates.length - 1; k >= 0; k--) {
            const crate = crates[k];
            const dx = proj.x - crate.x;
            const dy = proj.y - crate.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < proj.radius + crate.width / 2) {
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
                            if (ship.type === 'dreadnought') {
                                dreadnoughtActive = false;
                                credits += 150;
                            } else if (ship.type === 'submarine') {
                                credits += 40;
                            } else {
                                credits += (ship.type === 'battleship' ? 30 : (ship.type === 'ptboat' ? 20 : 10));
                            }
                            
                            if (score >= nextBossScore) {
                                nextBossScore += 20;
                                spawnDreadnoughtPending = true;
                                dreadnoughtWarningTimer = 180;
                            }
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
    
    if (shakeIntensity > 0) {
        shakeIntensity -= 0.5;
        if (shakeIntensity < 0) shakeIntensity = 0;
    }

    if (dreadnoughtWarningTimer > 0) {
        dreadnoughtWarningTimer--;
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

    explosions.forEach(exp => exp.update());
    explosions = explosions.filter(exp => !exp.isDead());

    splashes.forEach(splash => splash.update());
    splashes = splashes.filter(splash => !splash.isDead());

    clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x < -100) cloud.x = canvas.width + 100;
    });

    spawnShip();
    spawnCrate();
    spawnMine();
    checkCollisions();

    if (spawnDreadnoughtPending) {
        ships = []; // Stop all existing ships to make way for the Dreadnought
        ships.push(new Ship('dreadnought'));
        dreadnoughtActive = true;
        spawnDreadnoughtPending = false;
    }

    radarCountElement.textContent = `Ships on Radar: ${ships.length}`;
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

    // Draw sky with gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGradient.addColorStop(0, '#2b5a8c');
    skyGradient.addColorStop(1, '#87CEEB');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, horizonY);

    // Draw drifting clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
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
    
    // Draw shimmering sun reflection on the water
    ctx.fillStyle = 'rgba(255, 235, 180, 0.25)';
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

    // Apply Night Vision green tint over the periscope
    if (nightVisionEnabled) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.35)'; // Classic night vision green
        ctx.fillRect(-50, -50, canvas.width + 100, canvas.height + 100);
    }

    ctx.restore();

    // Draw projectiles (not clipped, so they wrap around the bottom area)
    projectiles.forEach(proj => proj.draw());

    // Draw periscope mask and HUD overlay
    ctx.save();
    // Black out everything outside the periscope circle
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.rect(-50, -50, canvas.width + 100, canvas.height + 100);
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

    // Draw makeshift radar close to the periscope view
    ctx.save();
    const radarCX = canvas.width / 2 + 360;
    const radarCY = canvas.height / 2 + 220;
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
    visibleShipsCount += drawBlips(ships.filter(s => s.type === 'battleship'), '#ff6600', 'ship'); // Vibrant orange blips for battleships
    visibleShipsCount += drawBlips(ships.filter(s => s.type === 'dreadnought'), '#aa00ff', 'ship'); // Neon purple blips for dreadnoughts
    visibleShipsCount += drawBlips(ships.filter(s => s.type === 'submarine'), '#00ff00', 'submarine'); // Bright green blips so they are easy to see on radar
    drawBlips(crates, '#ffff00', 'crate'); // Yellow blips for ammo crates
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
    if (dreadnoughtWarningTimer > 0) {
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
    const menuX = canvas.width / 2 - 490;
    const menuY = canvas.height / 2 + 180;

    ctx.fillStyle = blackAndWhiteEnabled ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 40, 0, 0.8)';
    ctx.fillRect(menuX, menuY, 160, 45);
    ctx.strokeStyle = blackAndWhiteEnabled ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 255, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(menuX, menuY, 160, 45);

    // Draw 3 horizontal lines for the hamburger icon
    ctx.fillStyle = blackAndWhiteEnabled ? '#ffffff' : '#00ff00';
    ctx.fillRect(menuX + 10, menuY + 10, 24, 4);
    ctx.fillRect(menuX + 10, menuY + 21, 24, 4);
    ctx.fillRect(menuX + 10, menuY + 32, 24, 4);

    // Add WARSHIP text
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('WARSHIP', menuX + 45, menuY + 23);
    ctx.restore();

    // Draw Upgrades button safely close to the view
    ctx.save();
    const upgX = canvas.width / 2 - 490;
    const upgY = canvas.height / 2 + 235;

    ctx.fillStyle = blackAndWhiteEnabled ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 40, 0, 0.8)';
    ctx.fillRect(upgX, upgY, 160, 45);
    ctx.strokeStyle = blackAndWhiteEnabled ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 255, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(upgX, upgY, 160, 45);
    ctx.fillStyle = blackAndWhiteEnabled ? '#ffffff' : '#00ff00';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('UPGRADES (U)', upgX + 80, upgY + 23);
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

canvas.addEventListener('click', (e) => {
    initAudio(); // Initialize audio context on first user interaction

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

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
    const menuX = canvas.width / 2 - 490;
    const menuY = canvas.height / 2 + 180;
    if (cx >= menuX && cx <= menuX + 160 && cy >= menuY && cy <= menuY + 45) {
        isMenuOpen = !isMenuOpen;
        if (isMenuOpen) isUpgradesOpen = false; // Close upgrades if menu opens
        return;
    }

    // Check if the Upgrades button was clicked
    const upgX = canvas.width / 2 - 490;
    const upgY = canvas.height / 2 + 235;
    if (cx >= upgX && cx <= upgX + 160 && cy >= upgY && cy <= upgY + 45) {
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