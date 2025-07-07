AOS.init({
  duration: 800, // values from 0 to 3000, with step 50ms
});

let scrollpos = window.scrollY;
const header = document.querySelector(".navbar");
const header_height = header.offsetHeight;

const add_class_on_scroll = () => header.classList.add("scrolled", "shadow-sm");
const remove_class_on_scroll = () => header.classList.remove("scrolled", "shadow-sm");

window.addEventListener('scroll', function () {
  scrollpos = window.scrollY;

  if (scrollpos >= header_height) { add_class_on_scroll(); }
  else { remove_class_on_scroll(); }

})

function mostrarMais() {
  const hiddenItems = document.querySelectorAll('.hidden-item');
  hiddenItems.forEach(item => {
    item.style.display = 'block';
  });

  document.getElementById('btnLerMais').style.display = 'none';

  // Disparo para GTM - exemplo
  if (window.dataLayer) {
    dataLayer.push({
      'event': 'ler_mais_clicado',
      'section': 'identificacao-visitantes'
    });
  }
}

let timeout;
window.addEventListener('scroll', function () {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    scrollpos = window.scrollY;
    if (scrollpos >= header_height) add_class_on_scroll();
    else remove_class_on_scroll();
  }, 50);
});

function abrirModal(event) {
  event.preventDefault();
  const form = document.getElementById('quizForm');
  const formData = new FormData(form);

  let score = 0;
  for (let [key, value] of formData.entries()) {
    score += parseInt(value, 10);
  }

  // Preenche o campo hidden com a pontuação
  document.getElementById('pontuacao_gad7').value = score;

  // Abre o modal
  const modal = new bootstrap.Modal(document.getElementById('modalWhatsapp'));
  modal.show();

  // GTM event (opcional)
  if (window.dataLayer) {
    dataLayer.push({
      event: 'quiz_iniciado',
      score: score
    });
  }
}

document.getElementById('whatsappForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = document.getElementById('submitBtn');
  const loadingBtn = document.getElementById('loadingBtn');
  const successMessage = document.getElementById('successMessage');

  // Mostrar estado de carregamento
  submitBtn.classList.add('d-none');
  loadingBtn.classList.remove('d-none');

  const formData = new FormData(form);

  try {
      const response = await fetch('https://formspree.io/f/xeokbqvq', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
    });

    if (response.ok) {
      document.getElementById('modalContent').classList.add('d-none');
      document.getElementById('modalFooter').classList.add('d-none');
      successMessage.classList.remove('d-none');
      form.reset();

      // Após 3 segundos, fecha o modal e rola até o banner
      setTimeout(() => {
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalWhatsapp'));
        modalInstance.hide();

        // Scroll suave até o início da página
        document.getElementById('top').scrollIntoView({ behavior: 'smooth' });
      }, 3000);
    } else {
      alert("Ocorreu um erro ao enviar. Tente novamente mais tarde.");
    }
  } catch (error) {
    alert("Erro de conexão. Tente novamente.");
  } finally {
    loadingBtn.classList.add('d-none');
    submitBtn.classList.remove('d-none');
  }
});

