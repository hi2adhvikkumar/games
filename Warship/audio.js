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

function playThunderSound() {
    try {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        
        const now = audioCtx.currentTime;
        const duration = 4.0; // Long rumbling echo
        
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.linearRampToValueAtTime(100, now + 1.0);
        filter.frequency.linearRampToValueAtTime(300, now + 2.0);
        filter.frequency.linearRampToValueAtTime(50, now + duration);
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(8.0, now + 0.1); // Quick strike (extremely loud)
        gainNode.gain.exponentialRampToValueAtTime(3.0, now + 1.0); // Sustain (extremely loud)
        gainNode.gain.linearRampToValueAtTime(4.0, now + 1.5); // Secondary rumble (extremely loud)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // Fade away
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
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

function playMassiveExplosionSound() {
    try {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        
        const now = audioCtx.currentTime;
        const duration = 4.0; // Very long thunderous rumble

        // Deep sub-bass boom
        const oscBoom = audioCtx.createOscillator();
        const gainBoom = audioCtx.createGain();
        oscBoom.type = 'sine';
        oscBoom.frequency.setValueAtTime(100, now);
        oscBoom.frequency.exponentialRampToValueAtTime(10, now + duration);
        
        gainBoom.gain.setValueAtTime(0, now);
        gainBoom.gain.linearRampToValueAtTime(2.5, now + 0.1); // Super loud attack
        gainBoom.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        oscBoom.connect(gainBoom);
        gainBoom.connect(audioCtx.destination);
        
        oscBoom.start(now);
        oscBoom.stop(now + duration);

        // Enormous white noise explosion blast
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) { data[i] = (Math.random() * 2 - 1) * 0.9; }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1500, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(30, now + duration);
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(2.0, now + 0.05);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        
        noise.start(now);
    } catch (e) {
        console.error("Audio error:", e);
    }
}

function playWiperSqueak() {
    try {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        
        const now = audioCtx.currentTime;
        const duration = 0.4;
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        // Low-pitched, heavy rubber squeak (less raspy)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + duration * 0.5);
        osc.frequency.exponentialRampToValueAtTime(150, now + duration);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.6, now + 0.05); // Much louder attack
        gain.gain.linearRampToValueAtTime(0.3, now + duration - 0.05); // Louder sustain
        gain.gain.linearRampToValueAtTime(0, now + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(now);
        osc.stop(now + duration);
    } catch (e) {
        console.error("Audio error:", e);
    }
}