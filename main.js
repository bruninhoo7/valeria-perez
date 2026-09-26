// ================== Configuración ==================
// Número de WhatsApp de Valeria en formato internacional, sin "+" ni espacios (ej: "5491123456789").
// Mientras esté vacío, los botones abren WhatsApp para elegir el contacto.
const WA_NUMBER = "";

const waLink = msg => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

// Todos los botones con data-wa="mensaje" abren WhatsApp con ese mensaje
document.querySelectorAll("[data-wa]").forEach(a => { a.href = waLink(a.dataset.wa); });
document.getElementById("year").textContent = new Date().getFullYear();

// ================== Pasarela de servicios (hero) ==================
{
  const box = document.querySelector(".strips");
  const strips = [...box.querySelectorAll(".strip")];
  const STEP_MS = 4200;        // tiempo que queda abierto cada servicio en el modo automático
  const HOVER_DELAY_MS = 80;   // evita saltos al cruzar el mouse rápido por varias tiras
  const TOUCH_PAUSE_MS = 9000; // tras un toque en el celu, espera antes de retomar

  let current = strips.findIndex(s => s.classList.contains("on"));
  let timer = null, hoverTimer = null, resumeTimer = null, paused = false, hovering = false;

  const activate = i => {
    current = i;
    strips.forEach((x, j) => x.classList.toggle("on", j === i));
  };
  const stop = () => { clearInterval(timer); timer = null; };
  const start = () => {
    if (paused || hovering || document.hidden) return;
    stop();
    timer = setInterval(() => activate((current + 1) % strips.length), STEP_MS);
  };

  // Mouse encima: manda el usuario y la animación se acelera (clase is-hover). Al salir, sigue sola.
  box.addEventListener("mouseenter", () => { hovering = true; box.classList.add("is-hover"); stop(); });
  box.addEventListener("mouseleave", () => {
    hovering = false; clearTimeout(hoverTimer);
    // Espera a que termine la transición rápida antes de volver al ritmo lento
    setTimeout(() => { if (!hovering) box.classList.remove("is-hover"); }, 650);
    start();
  });
  strips.forEach((s, i) => {
    s.addEventListener("mouseenter", () => {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => activate(i), HOVER_DELAY_MS);
    });
    s.addEventListener("focus", () => { paused = true; stop(); activate(i); });
    s.addEventListener("blur", () => { paused = false; start(); });
    s.addEventListener("click", () => {
      activate(i); stop(); clearTimeout(resumeTimer);
      paused = true;
      resumeTimer = setTimeout(() => { paused = false; start(); }, TOUCH_PAUSE_MS);
    });
  });
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  start();
}

// ================== Servicios: pestañas + vista previa con imagen ==================
{
  const img = (id, w) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;
  const preview = document.querySelector(".preview");
  const layers = [...preview.querySelectorAll(".pv-img")];
  const pvName = document.getElementById("pv-name");
  const pvDesc = document.getElementById("pv-desc");
  const pvPrice = document.getElementById("pv-price");
  const pvWa = document.getElementById("pv-wa");
  const items = [...document.querySelectorAll(".item")];
  let front = 0, textTimer = null;

  // Miniatura dentro de cada servicio (se usa en celular y tablet)
  items.forEach(it => {
    it.querySelector(".d").insertAdjacentHTML("afterend",
      `<span class="thumb" aria-hidden="true"><span><img src="${img(it.dataset.img, 700)}" alt="" loading="lazy"></span></span>`);
  });

  const select = (it, instant = false) => {
    items.forEach(x => x.setAttribute("aria-pressed", x === it));
    const name = it.querySelector(".t").firstChild.textContent.trim();

    // Imagen: se carga en la capa oculta y recién ahí hace el fundido
    const back = layers[1 - front];
    back.onload = () => {
      back.onload = null;
      back.classList.add("show");
      layers[front].classList.remove("show");
      front = 1 - front;
    };
    back.alt = name;
    back.src = img(it.dataset.img, 900);

    // Texto con un fundido corto
    const setText = () => {
      pvName.textContent = name;
      pvDesc.textContent = it.querySelector(".d").textContent;
      pvPrice.innerHTML = it.querySelector(".price").innerHTML;
      pvWa.href = waLink(`Hola Valeria, quiero un turno para ${name.toLowerCase()}`);
      preview.classList.remove("swap");
    };
    clearTimeout(textTimer);
    if (instant) return setText();
    preview.classList.add("swap");
    textTimer = setTimeout(setText, 300);
  };
  items.forEach(it => it.addEventListener("click", () => select(it)));

  // Pestañas: al cambiar de categoría se elige el primer servicio
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const selectTab = tab => {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    select(document.getElementById(tab.getAttribute("aria-controls")).querySelector(".item"));
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(t));
    t.addEventListener("keydown", e => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      selectTab(next); next.focus();
    });
  });
  select(items[0], true);
}

// ================== Galería de trabajos: pasarela infinita con efecto de profundidad ==================
{
  const rail = document.querySelector(".rail");
  const originals = [...rail.querySelectorAll("figure")];
  const N = originals.length;

  // Pasarela infinita: se duplican las fotos antes y después de las originales.
  // Cuando la pasarela entra en una copia, salta sin que se note a la foto idéntica del grupo del medio.
  const makeClone = f => {
    const c = f.cloneNode(true);
    c.setAttribute("aria-hidden", "true");
    c.querySelectorAll("img").forEach(i => { i.alt = ""; i.loading = "eager"; });
    return c;
  };
  originals.slice().reverse().forEach(f => rail.prepend(makeClone(f)));
  originals.forEach(f => rail.append(makeClone(f)));
  const figs = [...rail.querySelectorAll("figure")]; // copias + originales + copias (3 × N)

  // Cada tarjeta se transforma según su distancia al centro:
  // la del medio queda grande y nítida; las de los costados se achican, giran un poco y se apagan.
  let raf = 0;
  const paint = () => {
    raf = 0;
    const r = rail.getBoundingClientRect();
    const center = r.left + r.width / 2;
    figs.forEach(f => {
      const b = f.getBoundingClientRect();
      const d = Math.max(-2, Math.min(2, (b.left + b.width / 2 - center) / b.width)); // distancia en "tarjetas"
      const a = Math.min(Math.abs(d), 1.5);
      f.style.transform = `perspective(1200px) rotateY(${d * -9}deg) scale(${1 - a * 0.13})`;
      f.style.opacity = 1 - Math.min(Math.abs(d), 1.2) * 0.45;
      f.querySelector("img").style.transform = `translateX(${d * -9}%)`;
    });
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
  rail.addEventListener("scroll", schedule, { passive: true });

  // ---- Movimiento suave entre fotos (misma curva que la pasarela del inicio) ----
  const SLIDE_MS = 1300;       // duración del desplazamiento de una foto a otra
  const STEP_MS = 4200;        // tiempo que queda cada foto en el centro en modo automático
  const TOUCH_PAUSE_MS = 9000; // tras tocar o arrastrar, espera antes de retomar
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // arranca y frena despacio

  const target = i => figs[i].offsetLeft + figs[i].offsetWidth / 2 - rail.clientWidth / 2;
  const setWidth = () => figs[N].offsetLeft - figs[0].offsetLeft;
  const nearest = () => {
    const c = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0, dist = Infinity;
    figs.forEach((f, i) => {
      const d = Math.abs(f.offsetLeft + f.offsetWidth / 2 - c);
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  };

  let current = N; // primera foto original
  // Si quedó en una copia, salta al grupo del medio (mismo lugar visual, sin animación)
  const normalize = () => {
    if (current >= N && current < 2 * N) return;
    const shift = current < N ? N : -N;
    rail.classList.add("animating");
    rail.scrollLeft += shift > 0 ? setWidth() : -setWidth();
    current += shift;
    rail.classList.remove("animating");
    paint();
  };

  let anim = 0;
  const slideTo = (i, ms = SLIDE_MS) => {
    current = Math.max(0, Math.min(figs.length - 1, i));
    cancelAnimationFrame(anim);
    const from = rail.scrollLeft, to = target(current), t0 = performance.now();
    rail.classList.add("animating");
    const frame = now => {
      const p = Math.min(1, (now - t0) / ms);
      rail.scrollLeft = from + (to - from) * ease(p);
      if (p < 1) { anim = requestAnimationFrame(frame); return; }
      rail.classList.remove("animating");
      normalize();
    };
    anim = requestAnimationFrame(frame);
  };
  const stopSlide = () => { cancelAnimationFrame(anim); rail.classList.remove("animating"); };

  // Posición inicial: la primera foto original en el centro
  const place = () => {
    rail.classList.add("animating");
    rail.scrollLeft = target(current);
    rail.classList.remove("animating");
    paint();
  };
  place();
  window.addEventListener("resize", place);
  window.addEventListener("load", place);

  // ---- Avance automático: una foto por vez, sin fin; se pausa con el mouse encima ----
  let timer = null, hovering = false, holdUntil = 0, visible = false, down = false, moved = false;
  const tick = () => {
    if (hovering || down || document.hidden || !visible || performance.now() < holdUntil) return;
    slideTo(current + 1);
  };
  const restart = () => { clearInterval(timer); timer = setInterval(tick, STEP_MS); };
  const hold = () => { holdUntil = performance.now() + TOUCH_PAUSE_MS; restart(); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.4 }).observe(rail);
  rail.addEventListener("mouseenter", () => { hovering = true; });
  rail.addEventListener("mouseleave", () => { hovering = false; restart(); });
  rail.addEventListener("touchstart", () => { stopSlide(); hold(); }, { passive: true });

  // Al terminar un deslizamiento con el dedo o la rueda: actualiza la foto del centro y mantiene el infinito
  let settle = 0;
  rail.addEventListener("scroll", () => {
    if (rail.classList.contains("animating") || down) return;
    clearTimeout(settle);
    settle = setTimeout(() => { current = nearest(); normalize(); }, 160);
  }, { passive: true });
  restart();

  // Flechas y teclado
  const go = dir => { slideTo(current + dir); restart(); };
  document.querySelectorAll(".arrows button").forEach(b => b.addEventListener("click", () => go(Number(b.dataset.dir))));
  rail.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });

  // Arrastrar con el mouse; al soltar se acomoda suave en la foto más cercana
  let startX = 0, startLeft = 0;
  rail.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse") return;
    stopSlide();
    down = true; moved = false; startX = e.clientX; startLeft = rail.scrollLeft;
  });
  window.addEventListener("pointermove", e => {
    if (!down) return;
    if (Math.abs(e.clientX - startX) > 4) { moved = true; rail.classList.add("dragging"); }
    rail.scrollLeft = startLeft - (e.clientX - startX);
  });
  window.addEventListener("pointerup", () => {
    if (!down) return;
    down = false;
    rail.classList.remove("dragging");
    if (moved) slideTo(nearest(), 700);
    setTimeout(() => { moved = false; }, 0);
    restart();
  });

  // Clic en una foto lateral: la trae al centro
  figs.forEach((f, i) => f.addEventListener("click", () => {
    if (moved) return;
    slideTo(i); restart();
  }));
}

// ================== Diagnóstico: arma el mensaje de WhatsApp ==================
{
  const form = document.getElementById("quiz");
  const out = document.getElementById("quiz-result");
  const btn = document.getElementById("quiz-wa");
  const suggestion = {
    "Aclarar o iluminar": "balayage o mechas",
    "Cambiar de color": "tintura completa o baño de luz",
    "Cubrir canas": "tintura o retoque de raíz",
    "Recuperar mi pelo": "hidratación, nutrición o botox capilar",
    "Un corte nuevo": "corte y brushing",
  };
  form.addEventListener("change", () => {
    const d = Object.fromEntries(new FormData(form));
    if (!d.goal || !d.state || !d.length) {
      out.textContent = "Elegí una opción en cada pregunta.";
      return;
    }
    let text = `Te recomiendo <b>${suggestion[d.goal]}</b>.`;
    if (d.state === "con decoloración" && d.goal === "Aclarar o iluminar") {
      text += " Como ya está decolorado, primero reviso el estado del pelo.";
    }
    out.innerHTML = text;
    btn.href = waLink(`Hola Valeria, quiero: ${d.goal.toLowerCase()}. Mi pelo está ${d.state} y es ${d.length}. ¿Qué me recomendás?`);
  });
}

// ================== Nav: borde al hacer scroll + link activo ==================
{
  const top = document.getElementById("top");
  const hero = document.querySelector(".hero");
  const fab = document.querySelector(".fab");
  new IntersectionObserver(([e]) => {
    top.classList.toggle("scrolled", !e.isIntersecting);
    fab.classList.toggle("show", !e.isIntersecting);
  }, { rootMargin: "-120px 0px 0px 0px" }).observe(hero);

  const links = [...document.querySelectorAll(".links a")];
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(l => l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  links.forEach(l => { const s = document.querySelector(l.getAttribute("href")); if (s) io.observe(s); });
}

// ================== Aparición suave al hacer scroll ==================
{
  const els = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      // Escalonado entre elementos que entran juntos
      const siblings = [...e.target.parentElement.children].filter(c => c.classList.contains("reveal"));
      e.target.style.transitionDelay = `${Math.min(siblings.indexOf(e.target), 6) * 70}ms`;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  els.forEach(el => io.observe(el));
}
