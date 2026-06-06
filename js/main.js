/* =====================================================
   MANU PSICÓLOGA — main.js
   ===================================================== */

AOS.init({
  duration: 700,
  once: true,
  offset: 60,
});

/* ===== NAVBAR scroll ===== */
const header = document.querySelector('.navbar');
const headerHeight = header ? header.offsetHeight : 72;

let scrollTick = false;
window.addEventListener('scroll', () => {
  if (!scrollTick) {
    requestAnimationFrame(() => {
      if (window.scrollY >= headerHeight) {
        header.classList.add('scrolled', 'shadow-sm');
      } else {
        header.classList.remove('scrolled', 'shadow-sm');
      }
      scrollTick = false;
    });
    scrollTick = true;
  }
});

/* ===== MOBILE STICKY BAR — oculta quando hero visível ===== */
const mobileStickyBar = document.getElementById('mobileStickyBar');
if (mobileStickyBar && window.innerWidth < 992) {
  const heroSection = document.getElementById('top');
  const observer = new IntersectionObserver(
    ([entry]) => {
      mobileStickyBar.style.opacity = entry.isIntersecting ? '0' : '1';
      mobileStickyBar.style.pointerEvents = entry.isIntersecting ? 'none' : 'auto';
    },
    { threshold: 0.3 }
  );
  if (heroSection) observer.observe(heroSection);
}

/* ===== QUIZ GAD-7 ===== */
function abrirModal(event) {
  event.preventDefault();
  const form = document.getElementById('quizForm');
  const formData = new FormData(form);
  let score = 0;
  for (const value of formData.values()) {
    score += parseInt(value, 10) || 0;
  }
  document.getElementById('pontuacao_gad7').value = score;

  const modal = new bootstrap.Modal(document.getElementById('modalWhatsapp'));
  modal.show();

  if (window.dataLayer) {
    dataLayer.push({ event: 'quiz_concluido', score });
  }
}

/* ===== MODAL — envio Formspree ===== */
document.getElementById('whatsappForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById('submitBtn');
  const loadingBtn = document.getElementById('loadingBtn');
  const successMessage = document.getElementById('successMessage');

  submitBtn.classList.add('d-none');
  loadingBtn.classList.remove('d-none');

  try {
    const response = await fetch('https://formspree.io/f/xeokbqvq', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    });

    if (response.ok) {
      document.getElementById('modalContent').classList.add('d-none');
      document.getElementById('modalFooter').classList.add('d-none');
      successMessage.classList.remove('d-none');
      form.reset();

      if (window.dataLayer) {
        dataLayer.push({
          event: 'lead_capturado',
          metodo: 'quiz_gad7',
          pontuacao: document.getElementById('pontuacao_gad7').value,
        });
      }

      setTimeout(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalWhatsapp')).hide();
        document.getElementById('top').scrollIntoView({ behavior: 'smooth' });
      }, 3000);
    } else {
      alert('Ocorreu um erro ao enviar. Por favor, tente novamente.');
    }
  } catch {
    alert('Erro de conexão. Por favor, tente novamente.');
  } finally {
    loadingBtn.classList.add('d-none');
    submitBtn.classList.remove('d-none');
  }
});

/* ===== TRACKING — cliques em CTAs ===== */
document.querySelectorAll('a[href*="wa.link"]').forEach((el) => {
  el.addEventListener('click', () => {
    const id = el.id || 'cta-whatsapp';
    if (window.dataLayer) {
      dataLayer.push({ event: 'cta_whatsapp_clicado', cta_id: id });
    }
  });
});

/* ===== SCROLL DEPTH TRACKING ===== */
const depthMarks = { 25: false, 50: false, 75: false, 90: false };
window.addEventListener('scroll', () => {
  const scrollPct = Math.round(
    (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
  );
  for (const mark of Object.keys(depthMarks)) {
    if (!depthMarks[mark] && scrollPct >= parseInt(mark)) {
      depthMarks[mark] = true;
      if (window.dataLayer) {
        dataLayer.push({ event: 'scroll_depth', profundidade: `${mark}%` });
      }
    }
  }
});
