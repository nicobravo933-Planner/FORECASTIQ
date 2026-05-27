"use client"

/**
 * LandingPage — renders the static landing HTML as a proper Next.js
 * Client Component.
 *
 * Why: redirect("/landing.html") from a Server Component is unreliable
 * on Vercel — App Router doesn't guarantee .html public files are served
 * before the JS bundle evaluates the redirect. This component embeds the
 * landing directly in the RSC tree, which is always reliable.
 *
 * The particle canvas, scroll-reveal IntersectionObserver, and nav
 * scroll-tint all require the browser, so they run in useEffect.
 */

import { useEffect } from "react"

export default function LandingPage() {
  useEffect(() => {
    // Force landing background — overrides MUI CssBaseline from RootLayout
    const prev = document.body.style.background
    document.body.style.background = "#050b18"
    document.body.style.color = "#f1f5f9"
    document.body.style.overflowX = "hidden"

    // ── Particle canvas ──────────────────────────────────────────────────
    const canvas = document.getElementById("particles") as HTMLCanvasElement | null
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let W = 0, H = 0, raf = 0
    interface Particle { x: number; y: number; r: number; vx: number; vy: number; alpha: number }
    let particles: Particle[] = []

    function resize() {
      W = canvas!.width  = window.innerWidth
      H = canvas!.height = window.innerHeight
      init()
    }

    function init() {
      particles = []
      const count = Math.floor((W * H) / 13000)
      for (let i = 0; i < count; i++) {
        particles.push({
          x:     Math.random() * W,
          y:     Math.random() * H,
          r:     Math.random() * 1.4 + 0.5,
          vx:    (Math.random() - 0.5) * 0.15,
          vy:    -(Math.random() * 0.10 + 0.03),
          alpha: Math.random() * 0.35 + 0.08,
        })
      }
    }

    function frame() {
      ctx!.clearRect(0, 0, W, H)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < 115) {
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.strokeStyle = `rgba(56,189,248,${0.055 * (1 - d / 115)})`
            ctx!.lineWidth = 0.6
            ctx!.stroke()
          }
        }
      }
      for (const p of particles) {
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(56,189,248,${p.alpha})`
        ctx!.fill()
        p.x += p.vx; p.y += p.vy
        if (p.y < -6) p.y = H + 6
        if (p.x < -6) p.x = W + 6
        if (p.x > W + 6) p.x = -6
      }
      raf = requestAnimationFrame(frame)
    }

    resize(); frame()
    window.addEventListener("resize", resize)

    // ── Scroll reveal ────────────────────────────────────────────────────
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add("visible"), i * 85)
          obs.unobserve(entry.target)
        }
      })
    }, { threshold: 0.1 })
    document.querySelectorAll(".reveal").forEach(el => obs.observe(el))

    // ── Nav scroll tint ──────────────────────────────────────────────────
    const onScroll = () => {
      const nav = document.getElementById("navbar") as HTMLElement | null
      if (!nav) return
      if (window.scrollY > 24) {
        nav.style.background = "rgba(5,11,24,0.92)"
        nav.style.borderBottomColor = "rgba(255,255,255,0.10)"
      } else {
        nav.style.background = "rgba(5,11,24,0.75)"
        nav.style.borderBottomColor = "rgba(255,255,255,0.06)"
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      // Restore body styles when navigating away from landing
      document.body.style.background = prev
      document.body.style.color = ""
      document.body.style.overflowX = ""
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
      window.removeEventListener("scroll", onScroll)
      obs.disconnect()
    }
  }, [])

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg:#050b18;--bg2:#0a1428;--surface:rgba(255,255,255,0.035);
          --border:rgba(255,255,255,0.08);--border2:rgba(255,255,255,0.14);
          --accent:#38bdf8;--purple:#8b5cf6;--green:#10b981;--amber:#f59e0b;
          --text:#f1f5f9;--muted:#94a3b8;--dim:#475569;
          --sans:'Space Grotesk',sans-serif;--mono:'JetBrains Mono',monospace;
        }
        html { scroll-behavior:smooth; }
        body { background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.6;overflow-x:hidden; }
        #particles{position:fixed;inset:0;pointer-events:none;z-index:0;}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 6%;height:62px;background:rgba(5,11,24,0.75);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);border-bottom:1px solid rgba(255,255,255,0.06);transition:border-color 0.3s;}
        .nav-logo img{height:34px;display:block;}
        .nav-links{display:flex;align-items:center;gap:28px;}
        .nav-links a.nav-link{color:var(--muted);text-decoration:none;font-size:14px;font-weight:500;transition:color 0.2s;}
        .nav-links a.nav-link:hover{color:var(--text);}
        .btn-primary{display:inline-flex;align-items:center;gap:6px;background:var(--accent);color:#020d1e;font-family:var(--sans);font-weight:700;font-size:13.5px;padding:9px 20px;border-radius:8px;border:none;cursor:pointer;text-decoration:none;transition:opacity 0.18s,transform 0.18s,box-shadow 0.18s;white-space:nowrap;}
        .btn-primary:hover{opacity:0.88;transform:translateY(-1px);box-shadow:0 8px 24px rgba(56,189,248,0.35);}
        .btn-ghost{display:inline-flex;align-items:center;gap:7px;background:transparent;color:var(--text);font-family:var(--sans);font-weight:600;font-size:13.5px;padding:9px 18px;border-radius:8px;border:1px solid var(--border2);cursor:pointer;text-decoration:none;transition:background 0.18s,border-color 0.18s;}
        .btn-ghost:hover{background:rgba(255,255,255,0.06);border-color:rgba(56,189,248,0.4);}
        section{position:relative;z-index:1;}
        .hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:100px 6% 72px;}
        .hero-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:100px;border:1px solid rgba(56,189,248,0.28);background:rgba(56,189,248,0.07);font-size:12px;font-weight:600;color:var(--accent);letter-spacing:0.05em;margin-bottom:30px;text-transform:uppercase;}
        @keyframes pulseDot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.4;transform:scale(0.8);}}
        .pulse-dot{width:6px;height:6px;border-radius:50%;animation:pulseDot 2s ease-in-out infinite;}
        .hero-title{font-size:clamp(34px,5.5vw,68px);font-weight:800;letter-spacing:-0.035em;line-height:1.07;max-width:860px;margin:0 auto 22px;}
        .grad{background:linear-gradient(100deg,var(--accent) 0%,var(--purple) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .hero-sub{font-size:clamp(15px,1.8vw,18px);color:var(--muted);max-width:540px;margin:0 auto 38px;font-weight:400;line-height:1.7;}
        .hero-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:60px;}
        .chart-card{width:100%;max-width:880px;background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:20px;overflow:hidden;box-shadow:0 2px 0 rgba(255,255,255,0.04) inset,0 32px 90px rgba(0,0,0,0.6),0 0 0 1px rgba(56,189,248,0.06);}
        .chart-topbar{display:flex;align-items:center;gap:7px;padding:13px 20px;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02);}
        .traffic-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
        .chart-filename{flex:1;text-align:center;font-size:11.5px;font-family:var(--mono);color:var(--dim);letter-spacing:0.03em;}
        .chip{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-family:var(--mono);font-weight:600;padding:3px 10px;border-radius:6px;flex-shrink:0;}
        .chip-green{background:rgba(16,185,129,0.1);color:var(--green);border:1px solid rgba(16,185,129,0.2);}
        .chip-purple{background:rgba(139,92,246,0.1);color:var(--purple);border:1px solid rgba(139,92,246,0.2);}
        .chart-body{padding:24px 20px 14px;}
        .line-actual{stroke-dasharray:1200;stroke-dashoffset:1200;animation:drawLine 2s cubic-bezier(0.6,0,0.3,1) 0.5s forwards;}
        .line-forecast{stroke-dasharray:900;stroke-dashoffset:900;animation:drawLine 1.3s cubic-bezier(0.6,0,0.3,1) 2.1s forwards;}
        .ci-band{opacity:0;animation:fadeIn 0.7s ease 2.8s forwards;}
        .chart-dots{opacity:0;animation:fadeIn 0.5s ease 2.2s forwards;}
        .chart-labels{opacity:0;animation:fadeIn 0.6s ease 3.0s forwards;}
        @keyframes drawLine{to{stroke-dashoffset:0;}}
        @keyframes fadeIn{to{opacity:1;}}
        .proof-bar{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;padding:20px 6%;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:rgba(255,255,255,0.01);gap:0;}
        .proof-item{display:flex;align-items:center;gap:8px;padding:0 30px;border-right:1px solid var(--border);font-size:12.5px;font-family:var(--mono);color:var(--dim);font-weight:500;white-space:nowrap;}
        .proof-item:last-child{border-right:none;}
        .proof-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
        .reveal{opacity:0;transform:translateY(30px);transition:opacity 0.7s ease,transform 0.7s ease;}
        .reveal.visible{opacity:1;transform:translateY(0);}
        .features-section{position:relative;z-index:1;padding:110px 6% 100px;max-width:1140px;margin:0 auto;}
        .section-eyebrow{font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);margin-bottom:14px;}
        .section-title{font-size:clamp(26px,3.8vw,44px);font-weight:800;letter-spacing:-0.03em;line-height:1.12;margin-bottom:52px;}
        .features-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;}
        .feature-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:30px 28px 26px;transition:border-color 0.25s,box-shadow 0.25s,background 0.25s;cursor:default;}
        .feature-card:hover{border-color:rgba(56,189,248,0.18);box-shadow:0 12px 40px rgba(0,0,0,0.35),0 0 0 1px rgba(56,189,248,0.06) inset;background:rgba(255,255,255,0.05);}
        .feature-icon-wrap{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;font-size:22px;}
        .feature-name{font-size:17px;font-weight:700;letter-spacing:-0.015em;margin-bottom:10px;line-height:1.3;}
        .feature-desc{font-size:14px;color:var(--muted);line-height:1.7;margin-bottom:18px;}
        .tag{display:inline-flex;align-items:center;font-size:11px;font-family:var(--mono);font-weight:600;padding:3px 9px;border-radius:6px;letter-spacing:0.02em;}
        .how-section{position:relative;z-index:1;padding:0 6% 110px;max-width:1140px;margin:0 auto;}
        .steps-row{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;position:relative;}
        .step-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:28px 24px;}
        .step-num{font-size:11px;font-family:var(--mono);font-weight:600;color:var(--dim);letter-spacing:0.1em;margin-bottom:14px;}
        .step-icon{font-size:28px;margin-bottom:14px;display:block;}
        .step-name{font-size:16px;font-weight:700;letter-spacing:-0.01em;margin-bottom:8px;}
        .step-desc{font-size:13.5px;color:var(--muted);line-height:1.65;}
        .footer-wrap{position:relative;z-index:1;border-top:1px solid var(--border);}
        footer{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;padding:36px 6%;max-width:1300px;margin:0 auto;}
        footer img{height:30px;opacity:0.75;display:block;}
        .footer-meta{font-size:12.5px;font-family:var(--mono);color:var(--dim);}
        .footer-links{display:flex;align-items:center;gap:22px;}
        .footer-links a{font-size:13px;color:var(--dim);text-decoration:none;transition:color 0.2s;}
        .footer-links a:hover{color:var(--muted);}
        .glow-top{position:absolute;top:-180px;left:50%;transform:translateX(-50%);width:700px;height:500px;background:radial-gradient(ellipse at center,rgba(56,189,248,0.07) 0%,transparent 70%);pointer-events:none;z-index:0;}
        .glow-purple{position:absolute;top:40%;right:-100px;width:500px;height:500px;background:radial-gradient(ellipse at center,rgba(139,92,246,0.06) 0%,transparent 70%);pointer-events:none;z-index:0;}
      `}</style>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      <canvas id="particles" />

      <nav id="navbar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="nav-logo"><img src="logo_rectangular.png" alt="ForecastIQ" /></div>
        <div className="nav-links">
          <a href="#features" className="nav-link">Features</a>
          <a href="#como-funciona" className="nav-link">Cómo funciona</a>
          <a href="https://github.com/nicobravo933-Planner/FORECASTIQ" target="_blank" rel="noreferrer" className="nav-link">GitHub</a>
          <a href="/login" className="btn-primary">
            Abrir app
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
      </nav>

      <section className="hero">
        <div className="glow-top" />
        <div className="hero-badge">
          <span className="pulse-dot" style={{ background: "var(--green)" }} />
          Proyecto en producción · EC2 + Vercel
        </div>
        <h1 className="hero-title">
          Forecasting de series temporales<br />
          con <span className="grad">selección automática de modelos</span>
        </h1>
        <p className="hero-sub">
          Subís tu CSV. Evaluamos MA, Holt-Winters, SARIMA y LightGBM.
          Obtenés WAPE, FVA e intervalos de confianza al 90% — con eventos del calendario como features exógenas.
        </p>
        <div className="hero-cta">
          <a href="/login" className="btn-primary">
            Abrir la app
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <a href="https://github.com/nicobravo933-Planner/FORECASTIQ" target="_blank" rel="noreferrer" className="btn-ghost">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            Ver código fuente
          </a>
        </div>

        <div className="chart-card">
          <div className="chart-topbar">
            <div className="traffic-dot" style={{ background: "#ff5f57" }} />
            <div className="traffic-dot" style={{ background: "#febc2e" }} />
            <div className="traffic-dot" style={{ background: "#28c840" }} />
            <span className="chart-filename">ventas_electronica_mensual.csv · LightGBM</span>
            <span className="chip chip-green">↘ WAPE 18.4%</span>
            <span className="chip chip-purple" style={{ marginLeft: 4 }}>IC 90%</span>
          </div>
          <div className="chart-body">
            <svg viewBox="0 0 840 195" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block", overflow: "visible" }}>
              <line x1="44" y1="18"  x2="820" y2="18"  stroke="rgba(255,255,255,0.045)" strokeWidth="1"/>
              <line x1="44" y1="55"  x2="820" y2="55"  stroke="rgba(255,255,255,0.045)" strokeWidth="1"/>
              <line x1="44" y1="95"  x2="820" y2="95"  stroke="rgba(255,255,255,0.045)" strokeWidth="1"/>
              <line x1="44" y1="135" x2="820" y2="135" stroke="rgba(255,255,255,0.045)" strokeWidth="1"/>
              <text x="36" y="22"  fill="rgba(148,163,184,0.5)" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono,monospace">210</text>
              <text x="36" y="58"  fill="rgba(148,163,184,0.5)" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono,monospace">180</text>
              <text x="36" y="98"  fill="rgba(148,163,184,0.5)" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono,monospace">155</text>
              <text x="36" y="138" fill="rgba(148,163,184,0.5)" fontSize="8.5" textAnchor="end" fontFamily="JetBrains Mono,monospace">130</text>
              <rect x="545" y="12" width="280" height="165" fill="rgba(139,92,246,0.035)" rx="4"/>
              <path className="ci-band" d="M545,112 L635,96 L720,78 L800,58 L820,50 L820,30 L800,38 L720,52 L635,68 L545,84 Z" fill="rgba(139,92,246,0.13)"/>
              <path className="line-actual" d="M50,152 C85,145 125,160 170,142 C210,128 240,138 285,124 C325,113 360,130 410,118 C452,108 490,100 525,108 C535,111 540,111 545,112" fill="none" stroke="#38bdf8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path className="line-forecast" d="M545,112 L635,82 L720,65 L800,48 L820,40" fill="none" stroke="#8b5cf6" strokeWidth="2.4" strokeDasharray="8,5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="545" y1="12" x2="545" y2="178" stroke="rgba(148,163,184,0.2)" strokeWidth="1" strokeDasharray="4,4"/>
              <g className="chart-dots">
                <circle cx="50"  cy="152" r="3.5" fill="#38bdf8"/>
                <circle cx="170" cy="142" r="3.5" fill="#38bdf8"/>
                <circle cx="285" cy="124" r="3.5" fill="#38bdf8"/>
                <circle cx="410" cy="118" r="3.5" fill="#38bdf8"/>
                <circle cx="525" cy="108" r="3.5" fill="#38bdf8"/>
                <circle cx="545" cy="112" r="5"   fill="#8b5cf6" stroke="#050b18" strokeWidth="2.5"/>
                <circle cx="635" cy="82"  r="3.5" fill="#8b5cf6" opacity="0.75"/>
                <circle cx="720" cy="65"  r="3.5" fill="#8b5cf6" opacity="0.75"/>
                <circle cx="800" cy="48"  r="3.5" fill="#8b5cf6" opacity="0.75"/>
              </g>
              <g className="chart-labels">
                <text x="50"  y="191" fill="rgba(148,163,184,0.5)" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono,monospace">Ene</text>
                <text x="170" y="191" fill="rgba(148,163,184,0.5)" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono,monospace">Feb</text>
                <text x="285" y="191" fill="rgba(148,163,184,0.5)" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono,monospace">Mar</text>
                <text x="410" y="191" fill="rgba(148,163,184,0.5)" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono,monospace">Abr</text>
                <text x="525" y="191" fill="rgba(148,163,184,0.5)" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono,monospace">May</text>
                <text x="635" y="191" fill="rgba(148,163,184,0.75)" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontWeight="600">Jun</text>
                <text x="720" y="191" fill="rgba(148,163,184,0.75)" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontWeight="600">Jul</text>
                <text x="800" y="191" fill="rgba(148,163,184,0.75)" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontWeight="600">Ago</text>
                <text x="290" y="30" fill="rgba(56,189,248,0.45)"  fontSize="9" fontFamily="JetBrains Mono,monospace" fontWeight="600" letterSpacing="0.06em">HISTÓRICO</text>
                <text x="560" y="30" fill="rgba(139,92,246,0.7)"   fontSize="9" fontFamily="JetBrains Mono,monospace" fontWeight="600" letterSpacing="0.06em">FORECAST →</text>
                <rect x="650" y="50"  width="118" height="26" rx="6" fill="rgba(16,185,129,0.10)" stroke="rgba(16,185,129,0.22)" strokeWidth="1"/>
                <text x="709" y="67" fill="#10b981" fontSize="10" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontWeight="600">WAPE · 18.4%</text>
                <rect x="650" y="82"  width="118" height="26" rx="6" fill="rgba(56,189,248,0.07)" stroke="rgba(56,189,248,0.18)" strokeWidth="1"/>
                <text x="709" y="99" fill="#38bdf8" fontSize="10" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontWeight="600">FVA · +4.2pp</text>
                <line x1="56"  y1="180" x2="76"  y2="180" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"/>
                <text x="80"  y="183" fill="rgba(148,163,184,0.6)" fontSize="8.5" fontFamily="JetBrains Mono,monospace">Real</text>
                <line x1="116" y1="180" x2="136" y2="180" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="5,3" strokeLinecap="round"/>
                <text x="140" y="183" fill="rgba(148,163,184,0.6)" fontSize="8.5" fontFamily="JetBrains Mono,monospace">Forecast</text>
                <rect x="183" y="174" width="12" height="8" rx="2" fill="rgba(139,92,246,0.2)"/>
                <text x="200" y="183" fill="rgba(148,163,184,0.6)" fontSize="8.5" fontFamily="JetBrains Mono,monospace">IC 90%</text>
              </g>
            </svg>
          </div>
        </div>
      </section>

      <div className="proof-bar reveal">
        <div className="proof-item"><div className="proof-dot" style={{ background: "#3b82f6" }} />Python · FastAPI</div>
        <div className="proof-item"><div className="proof-dot" style={{ background: "#10b981" }} />LightGBM · statsmodels</div>
        <div className="proof-item"><div className="proof-dot" style={{ background: "#f1f5f9" }} />Next.js 14 · TypeScript</div>
        <div className="proof-item"><div className="proof-dot" style={{ background: "#8b5cf6" }} />PostgreSQL · RLS by user</div>
        <div className="proof-item"><div className="proof-dot" style={{ background: "#38bdf8" }} />EC2 · Vercel</div>
      </div>

      <section id="features" style={{ position: "relative", zIndex: 1 }}>
        <div className="glow-purple" />
        <div className="features-section">
          <div className="section-eyebrow reveal">Capabilities</div>
          <h2 className="section-title reveal">Qué hace ForecastIQ</h2>
          <div className="features-grid">
            <div className="feature-card reveal">
              <div className="feature-icon-wrap" style={{ background: "rgba(56,189,248,0.1)" }}>🎯</div>
              <div className="feature-name">Selección automática de modelo</div>
              <p className="feature-desc">Un score de calidad evalúa el dataset (0–100). Score &lt; 40 → solo Moving Average. Score ≥ 75 → LightGBM disponible, incluyendo features de calendario como variables exógenas.</p>
              <span className="tag" style={{ background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.15)" }}>MA · Holt-Winters · SARIMA · LightGBM</span>
            </div>
            <div className="feature-card reveal">
              <div className="feature-icon-wrap" style={{ background: "rgba(245,158,11,0.1)" }}>📅</div>
              <div className="feature-name">Eventos como features exógenas</div>
              <p className="feature-desc">Feriados nacionales y eventos comerciales argentinos se inyectan como variables exógenas en LightGBM. El modelo aprende el impacto real de cada evento en tus ventas.</p>
              <span className="tag" style={{ background: "rgba(245,158,11,0.08)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.15)" }}>feature engineering · calendario AR · exógenas</span>
            </div>
            <div className="feature-card reveal">
              <div className="feature-icon-wrap" style={{ background: "rgba(139,92,246,0.1)" }}>💬</div>
              <div className="feature-name">Chat IA sobre tus datos</div>
              <p className="feature-desc">El LLM recibe el contexto del último forecast como system prompt. Preguntás en lenguaje natural y responde sobre tu serie temporal específica.</p>
              <span className="tag" style={{ background: "rgba(139,92,246,0.08)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.15)" }}>Claude · context injection · RAG lite</span>
            </div>
            <div className="feature-card reveal">
              <div className="feature-icon-wrap" style={{ background: "rgba(16,185,129,0.1)" }}>📊</div>
              <div className="feature-name">Métricas de evaluación correctas</div>
              <p className="feature-desc">WAPE y Forecast Value Added respecto al benchmark naïve. Intervalos de confianza al 90% por bootstrap o distribución del error histórico.</p>
              <span className="tag" style={{ background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.15)" }}>WAPE · FVA · IC 90% · naïve benchmark</span>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" style={{ position: "relative", zIndex: 1 }}>
        <div className="how-section">
          <div className="section-eyebrow reveal">Pipeline</div>
          <h2 className="section-title reveal">Cómo funciona</h2>
          <div className="steps-row">
            <div className="step-card reveal">
              <div className="step-num">PASO 01</div>
              <span className="step-icon">📁</span>
              <div className="step-name">Subís tu CSV</div>
              <p className="step-desc">Cargás tu serie temporal. El sistema detecta automáticamente las columnas de fecha y valor, evalúa la calidad y genera estadísticas descriptivas.</p>
            </div>
            <div className="step-card reveal">
              <div className="step-num">PASO 02</div>
              <span className="step-icon">⚙️</span>
              <div className="step-name">ETL + selección de modelo</div>
              <p className="step-desc">Winsorización, imputación y detección de periodicidad. El score de calidad determina qué modelos ML están disponibles para tu dataset.</p>
            </div>
            <div className="step-card reveal">
              <div className="step-num">PASO 03</div>
              <span className="step-icon">📈</span>
              <div className="step-name">Forecast + métricas</div>
              <p className="step-desc">Obtenés el forecast con WAPE, FVA e IC al 90%. El resultado queda guardado en tu historial para comparar runs futuros.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="footer-wrap reveal">
        <footer>
        {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="logo_rectangular.png" alt="ForecastIQ" />
          <div className="footer-links">
            <a href="https://github.com/nicobravo933-Planner/FORECASTIQ" target="_blank" rel="noreferrer">GitHub</a>
            <a href="#features">Features</a>
            <a href="#como-funciona">Pipeline</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span className="footer-meta">Nicolás Bravo · 2026</span>
            <a href="/login" className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }}>
              Entrar a la app →
            </a>
          </div>
        </footer>
      </div>
    </>
  )
}
