// ===============================
//  CARDÁPIO - FILTRO DE TABS
// ===============================

document.addEventListener("DOMContentLoaded", () => {

  const tabs = document.querySelectorAll('.tab');
  const cards = document.querySelectorAll('.card');

  function setActiveTab(tab) {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      setActiveTab(tab);

      const categoria = tab.dataset.cat;

      cards.forEach(card => {
        const mostrar = categoria === "todas" || card.dataset.cat === categoria;
        card.style.display = mostrar ? "flex" : "none";
      });
    });
  });

  // ===============================
  //  ANIMAÇÃO FADE-IN AO ROLAR
  // ===============================

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  // ===============================
  //  EFEITO NO BOTÃO "ADICIONAR"
  // ===============================

  const botoes = document.querySelectorAll('.add-btn');

  botoes.forEach(btn => {
    btn.addEventListener('click', () => {

      btn.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(0.9)' },
        { transform: 'scale(1)' }
      ], { duration: 180 });

      const textoOriginal = btn.textContent;
      btn.textContent = "Adicionado!";

      setTimeout(() => {
        btn.textContent = textoOriginal;
      }, 900);

    });
  });

  // ===============================
  //  ACESSIBILIDADE VIA TECLADO (TABS)
  // ===============================

  tabs.forEach(tab => {
    tab.addEventListener('keydown', e => {
      const index = [...tabs].indexOf(tab);

      if(e.key === "ArrowRight"){
        const next = (index + 1) % tabs.length;
        tabs[next].focus();
        tabs[next].click();
      }

      if(e.key === "ArrowLeft"){
        const prev = (index - 1 + tabs.length) % tabs.length;
        tabs[prev].focus();
        tabs[prev].click();
      }
    });
  });

});