const canvas = document.getElementById("networkCanvas");
const ctx = canvas.getContext("2d");

let width;
let height;
let nodes = [];

function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

function crearNodos() {
    nodes = [];

    const total = Math.floor((window.innerWidth * window.innerHeight) / 18000);

    for (let i = 0; i < total; i++) {
        nodes.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            radius: Math.random() * 2 + 1,
            glow: Math.random() > 0.94
        });
    }
}

function dibujar() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];

        a.x += a.vx;
        a.y += a.vy;

        if (a.x < 0 || a.x > width) a.vx *= -1;
        if (a.y < 0 || a.y > height) a.vy *= -1;

        for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];

            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 120) {
                const opacity = 1 - distance / 120;

                ctx.beginPath();
                ctx.strokeStyle = `rgba(25, 135, 84, ${opacity * 0.22})`;
                ctx.lineWidth = 1;
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }

        ctx.beginPath();

        ctx.fillStyle = a.glow
            ? "rgba(25, 135, 84, 0.95)"
            : "rgba(25, 135, 84, 0.55)";

        ctx.shadowBlur = a.glow ? 12 : 0;
        ctx.shadowColor = "rgba(25, 135, 84, 0.8)";

        ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    requestAnimationFrame(dibujar);
}

window.addEventListener("resize", () => {
    resizeCanvas();
    crearNodos();
});

resizeCanvas();
crearNodos();
dibujar();