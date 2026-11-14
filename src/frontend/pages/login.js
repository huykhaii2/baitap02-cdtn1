// Đăng nhập – A1. Chuyển tới màn hình phù hợp vai trò sau khi đăng nhập.
import { login } from '../api/auth.api.js';
import { setBusy, showAlert } from '../components/ui.js';

export function render(root, { navigate }) {
  root.innerHTML = `
    <section class="login-wrap">
      <div class="login-hero">
        <span class="brand-mark brand-mark-lg" aria-hidden="true">MM</span>
        <h1>Mekong Mobile</h1>
        <p>Tiếp nhận và phân loại yêu cầu bảo hành – từ quầy tiếp nhận tới kỹ thuật viên.</p>
      </div>
      <form class="card login-card" id="loginForm" novalidate>
        <h2>Đăng nhập</h2>
        <div class="alert-slot" id="loginAlert"></div>
        <label class="field">
          <span>Tên đăng nhập</span>
          <input name="username" id="username" autocomplete="username" required autofocus>
        </label>
        <label class="field">
          <span>Mật khẩu</span>
          <input name="password" id="password" type="password" autocomplete="current-password" required>
        </label>
        <button class="btn btn-primary btn-block" type="submit" id="loginBtn">Đăng nhập</button>
        <details class="demo-accounts">
          <summary>Tài khoản mẫu (máy phát triển)</summary>
          <table>
            <tr><td><code>tn1</code></td><td>Nhân viên tiếp nhận</td></tr>
            <tr><td><code>dp1</code></td><td>Điều phối viên</td></tr>
            <tr><td><code>kt1</code>, <code>kt2</code></td><td>Kỹ thuật viên</td></tr>
            <tr><td><code>kt3</code></td><td>Kỹ thuật viên đã khoá</td></tr>
          </table>
          <p>Mật khẩu chung: <code>Matkhau@123</code></p>
        </details>
      </form>
    </section>`;

  const form = root.querySelector('#loginForm');
  const alertSlot = root.querySelector('#loginAlert');
  const button = root.querySelector('#loginBtn');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) {
      showAlert(alertSlot, 'Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }
    setBusy(button, true, 'Đang đăng nhập…');
    try {
      const staff = await login(username, password);
      navigate(staff.role === 'RECEPTIONIST' ? '#/tickets/new' : '#/tickets');
    } catch (err) {
      showAlert(alertSlot, err.message);
      setBusy(button, false);
    }
  });
}
