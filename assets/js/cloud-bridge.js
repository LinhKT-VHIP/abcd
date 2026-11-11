/**
 * Cầu nối API giao tiếp backend Google Apps Script theo đúng hợp đồng mục 11
 */
const CloudBridge = (() => {
  let gasUrl = '';

  function setGasUrl(url) {
    gasUrl = (url || '').trim();
    if (gasUrl) localStorage.setItem('erp_gas_url', gasUrl);
  }

  function getGasUrl() {
    if (!gasUrl) gasUrl = localStorage.getItem('erp_gas_url') || '';
    return gasUrl;
  }

  function generateUUID() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  }

  async function postAction(action, payload = {}, timeoutMs = 25000) {
    const url = getGasUrl();
    if (!url) {
      throw new Error('Chưa cấu hình URL Google Apps Script Web App (/exec). Vui lòng cấu hình URL để kết nối.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ action, payload }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Lỗi kết nối HTTP: ${response.status} ${response.statusText}`);
      }

      const resJson = await response.json();
      if (!resJson.ok) {
        const errMsg = resJson.error ? resJson.error.message : 'Server GAS từ chối yêu cầu.';
        const errCode = resJson.error ? resJson.error.code : 'UNKNOWN';
        const err = new Error(errMsg);
        err.code = errCode;
        throw err;
      }

      return resJson.data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Hết thời gian chờ phản hồi từ GAS (Timeout 25s). Vui lòng thử lại.');
      }
      throw err;
    }
  }

  async function fetchStatus() {
    return await postAction('training.status', {});
  }

  async function fetchList() {
    return await postAction('training.list', {});
  }

  async function createMaterial(actorName, materialDraft) {
    const requestId = generateUUID();
    return await postAction('training.create', {
      actorName: actorName || 'Học viên',
      requestId: requestId,
      material: materialDraft
    });
  }

  return {
    setGasUrl,
    getGasUrl,
    fetchStatus,
    fetchList,
    createMaterial
  };
})();
