// Bộ định tuyến theo hash (#/...), phiên đăng nhập và thanh điều hướng theo vai trò.
import { getSession } from './api/client.js';
import { logout } from './api/auth.api.js';
import { ROLE_LABELS, h, toast } from './components/ui.js';
import * as loginPage from './pages/login.js';
import * as ticketListPage from './pages/ticketList.js';
import * as ticketCreatePage from './pages/ticketCreate.js';
import * as ticketDetailPage from './pages/ticketDetail.js';
import * as masterDataPage from './pages/masterData.js';

const ROUTES = [
  { pattern: /^#\/login$/, page: loginPage, public: true },
  { pattern: /^#\/tickets\/new$/, page: ticketCreatePage, roles: ['RECEPTIONIST'] },
  { pattern: /^#\/tickets\/(BH-\d{4}-\d{6})$/i, page: ticketDetailPage, params: ['code'] },
  { pattern: /^#\/tickets$/, page: ticketListPage },
  { pattern: /^#\/data$/, page: masterDataPage, roles: ['RECEPTIONIST', 'COORDINATOR'] },
];

const NAV = {
  RECEPTIONIST: [['#/tickets', 'Danh sách phiếu'], ['#/tickets/new', '+ Tạo phiếu'], ['#/data', 'Khách hàng & thiết bị']],
  COORDINATOR: [['#/tickets', 'Danh sách phiếu'], ['#/data', 'Khách hàng & thiết bị']],
  TECHNICIAN: [['#/tickets', 'Phiếu của tôi']],
};

const root = document.getElementById('app');
let cleanup = null;

export function navigate(hash) {
  if (window.location.hash === hash) render();
  else window.location.hash = hash;
}

function renderChrome(session, path) {
  const bar = document.getElementById('topbar');
  if (!session) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  document.getElementById('userName').textContent = session.staff.fullName;
  document.getElementById('userRole').textContent = ROLE_LABELS[session.staff.role] || session.staff.role;
  document.getElementById('nav').innerHTML = (NAV[session.staff.role] || [])
    .map(([href, label]) => `<a href="${href}" class="nav-link${path === href ? ' active' : ''}">${h(label)}</a>`)
    .join('');
}

async function render() {
  const [path, queryString = ''] = (window.location.hash || '#/tickets').split('?');
  const session = getSession();
  const route = ROUTES.find((r) => r.pattern.test(path));

  if (!route) return navigate(session ? '#/tickets' : '#/login');
  if (!route.public && !session) return navigate('#/login');
  if (route.public && session) return navigate('#/tickets');

  renderChrome(session, path);
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;

  if (route.roles && !route.roles.includes(session.staff.role)) {
    root.innerHTML = `<section class="card"><h1>Không có quyền</h1>
      <p>Vai trò <strong>${h(ROLE_LABELS[session.staff.role])}</strong> không dùng được màn hình này.</p>
      <a class="btn btn-primary" href="#/tickets">Về danh sách phiếu</a></section>`;
    return undefined;
  }

  const match = path.match(route.pattern);
  const params = Object.fromEntries((route.params || []).map((name, i) => [name, match[i + 1].toUpperCase()]));
  const query = Object.fromEntries(new URLSearchParams(queryString));
  root.innerHTML = '';
  cleanup = await route.page.render(root, { session, params, query, navigate });
  root.focus({ preventScroll: true });
  return undefined;
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  logout();
  navigate('#/login');
});

window.addEventListener('auth:expired', () => {
  toast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
  navigate('#/login');
});
window.addEventListener('hashchange', render);
render();
