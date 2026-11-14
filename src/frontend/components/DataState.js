// Ba trạng thái của mọi vùng dữ liệu: đang tải · rỗng · lỗi (kèm nút Thử lại).
import { h } from './ui.js';

export function showLoading(el, text = 'Đang tải dữ liệu…') {
  el.innerHTML = `<div class="state state-loading" data-state="loading"><span class="spinner" aria-hidden="true"></span><p>${h(text)}</p></div>`;
}

export function showEmpty(el, { title = 'Chưa có dữ liệu', hint = '', actionHtml = '' } = {}) {
  el.innerHTML = `<div class="state state-empty" data-state="empty">
      <div class="state-icon" aria-hidden="true">∅</div>
      <p class="state-title">${h(title)}</p>
      ${hint ? `<p class="state-hint">${h(hint)}</p>` : ''}
      ${actionHtml}
    </div>`;
}

export function showError(el, err, onRetry) {
  const code = err && err.code ? ` <code>${h(err.code)}</code>` : '';
  el.innerHTML = `<div class="state state-error" data-state="error" role="alert">
      <div class="state-icon" aria-hidden="true">!</div>
      <p class="state-title">Không tải được dữ liệu${code}</p>
      <p class="state-hint">${h((err && err.message) || 'Đã có lỗi xảy ra.')}</p>
      ${onRetry ? '<button type="button" class="btn btn-secondary btn-retry">Thử lại</button>' : ''}
    </div>`;
  if (onRetry) el.querySelector('.btn-retry').addEventListener('click', onRetry);
}

// load(): Promise dữ liệu · isEmpty(data) → bool · render(data) vẽ nội dung.
export async function loadInto(el, { load, isEmpty = () => false, empty = {}, render, loadingText }) {
  showLoading(el, loadingText);
  try {
    const data = await load();
    if (isEmpty(data)) showEmpty(el, typeof empty === 'function' ? empty(data) : empty);
    else render(data);
    return data;
  } catch (err) {
    if (err && err.status === 401) return null; // phiên hết hạn – app.js tự chuyển về đăng nhập
    showError(el, err, () => loadInto(el, { load, isEmpty, empty, render, loadingText }));
    return null;
  }
}
