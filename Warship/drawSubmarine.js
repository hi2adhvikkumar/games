function drawSubmarine(ctx, ship, time, horizonY, submergeRatio) {
    ctx.save();
    const currentSubmerge = typeof submergeRatio !== 'undefined' ? submergeRatio : 0;
    ctx.globalAlpha = 0.25 + (currentSubmerge * 0.75); // Fades into full visibility when submerged!

    // Calculate bobbing offset to exactly match the ocean horizon waves
    const horizonOffset = Math.sin(time * 0.8) * 2.4;
    const bobOffset = Math.sin((ship.x * 0.03) + time * 0.8) * 3.2 + Math.cos((ship.x * 0.015) + time * 0.9) * 1.2 + horizonOffset * 0.5;
    
    // Draw foamy water wake trailing behind the ship
    const wakeLength = 50;
    const wakeY = ship.y + bobOffset + ship.height / 2 - 2; // Near the waterline
    const gradient = ctx.createLinearGradient(ship.x + ship.width / 2 + wakeLength, wakeY, ship.x, wakeY);
    gradient.addColorStop(0, 'rgba(90, 155, 212, 0)'); // Transparent at tail
    gradient.addColorStop(1, 'rgba(90, 155, 212, 0.5)'); // Semi-transparent at ship
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(ship.x + ship.width / 2 + wakeLength, wakeY);
    ctx.lineTo(ship.x, wakeY);
    ctx.stroke();

    const deckY = ship.y + bobOffset - ship.height / 4;
    const bottomY = ship.y + bobOffset + ship.height / 2;

    // Submarine Hull (Sleek dark grey cigar shape)
    ctx.fillStyle = ship.light ? '#4a5a6a' : '#2a3a4a';
    ctx.beginPath();
    ctx.ellipse(ship.x, deckY + 4, ship.width / 2, ship.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Waterline (Dark stripe)
    ctx.fillStyle = '#111';
    ctx.fillRect(ship.x - ship.width * 0.38, bottomY - 3, ship.width * 0.76, 3);
    
    // Conning Tower (Sail)
    ctx.fillStyle = ship.light ? '#3a4a5a' : '#1a2a3a';
    ctx.fillRect(ship.x - ship.width * 0.1, deckY - 8, ship.width * 0.2, 10);
    
    // Periscope
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ship.x, deckY - 8);
    ctx.lineTo(ship.x, deckY - 18);
    ctx.lineTo(ship.x - 4, deckY - 18);
    ctx.stroke();

    ctx.restore();
}