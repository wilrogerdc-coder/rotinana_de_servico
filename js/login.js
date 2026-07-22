document.addEventListener('DOMContentLoaded', () => {
  if (Auth.isLoggedIn) {
    window.location.href = 'dashboard.html';
    return;
  }

  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = document.getElementById('usuario').value.trim();
    const senha = document.getElementById('senha').value.trim();

    if (!usuario || !senha) {
      errorEl.textContent = 'Preencha todos os campos';
      errorEl.classList.add('visible');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Entrando...';
    errorEl.classList.remove('visible');

    const result = await Auth.login(usuario, senha);

    if (result.success) {
      window.location.href = 'dashboard.html';
    } else {
      errorEl.textContent = result.error;
      errorEl.classList.add('visible');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Entrar';
    }
  });
});
