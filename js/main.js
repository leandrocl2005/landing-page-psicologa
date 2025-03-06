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

  console.log(scrollpos);
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
