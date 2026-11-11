/**
 * Điều khiển giao diện chính của ứng dụng Material Master
 */
document.addEventListener('DOMContentLoaded', async () => {
  let appConfig = null;
  let catalogData = [];
  let currentSchemaFields = [];

  const navButtons = document.querySelectorAll('.tab-btn');
  const viewSections = document.querySelectorAll('.view-section');
  const connStatus = document.getElementById('connectionStatus');
  const btnSync = document.getElementById('btnSync');
  const btnSettings = document.getElementById('btnSettings');
  const selectCategory = document.getElementById('selectCategory');
  const selectSubtype = document.getElementById('selectSubtype');
  const selectMaterialType = document.getElementById('selectMaterialType');
  const dynamicFieldsContainer = document.getElementById('dynamicFieldsContainer');
  const previewName = document.getElementById('previewName');
  const previewDimensions = document.getElementById('previewDimensions');
  const previewCode = document.getElementById('previewCode');
  const duplicateStatusBox = document.getElementById('duplicateStatusBox');
  const similarItemsList = document.getElementById('similarItemsList');
  const btnSaveMaterial = document.getElementById('btnSaveMaterial');
  const catalogTableBody = document.getElementById('catalogTableBody');
  const searchInput = document.getElementById('searchInput');
  const filterCategory = document.getElementById('filterCategory');
  const toastContainer = document.getElementById('toastContainer');

  const detailModal = document.getElementById('detailModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCloseModalBtn = document.getElementById('btnCloseModalBtn');
  const btnDownloadSvg = document.getElementById('btnDownloadSvg');
  const btnPrintBarcode = document.getElementById('btnPrintBarcode');
  let currentViewingItem = null;

  function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  try {
    const res = await fetch('assets/data/config.json');
    appConfig = await res.json();
    initFormSelectors();
  } catch (e) {
    showToast('Lỗi nạp config.json: ' + e.message, 'error');
  }

  function initFormSelectors() {
    selectCategory.innerHTML = appConfig.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    selectMaterialType.innerHTML = appConfig.materialTypes.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    selectCategory.addEventListener('change', () => onCategoryChanged());
    selectSubtype.addEventListener('change', () => onSubtypeChanged());
    onCategoryChanged();
  }

  function onCategoryChanged() {
    const catId = selectCategory.value;
    const subtypes = appConfig.formSchemas[catId] || [];
    selectSubtype.innerHTML = subtypes.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
    onSubtypeChanged();
  }

  function onSubtypeChanged() {
    const catId = selectCategory.value;
    const subId = selectSubtype.value;
    const subtypeObj = (appConfig.formSchemas[catId] || []).find(s => s.id === subId);
    if (!subtypeObj) return;

    if (subtypeObj.defaultMaterialType) {
      selectMaterialType.value = subtypeObj.defaultMaterialType;
    }

    currentSchemaFields = subtypeObj.fields || [];
    renderDynamicFields(currentSchemaFields);
    triggerRecalculate();
  }

  function renderDynamicFields(fields) {
    dynamicFieldsContainer.innerHTML = '';
    fields.forEach(f => {
      const group = document.createElement('div');
      group.className = 'form-group';

      const label = document.createElement('label');
      label.innerHTML = `${f.label} ${f.unit ? '(' + f.unit + ')' : ''} ${f.required ? '<span class="req">*</span>' : ''}`;
      group.appendChild(label);

      let inputEl;
      if (f.kind === 'select') {
        inputEl = document.createElement('select');
        inputEl.className = 'form-control field-input';
        inputEl.dataset.fieldId = f.id;
        inputEl.innerHTML = (f.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('');
      } else if (f.kind === 'suggest') {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'form-control field-input';
        inputEl.dataset.fieldId = f.id;
        inputEl.setAttribute('list', 'list_' + f.id);

        const dl = document.createElement('datalist');
        dl.id = 'list_' + f.id;
        dl.innerHTML = (f.options || []).map(opt => `<option value="${opt}"></option>`).join('');
        group.appendChild(dl);
      } else {
        inputEl = document.createElement('input');
        inputEl.type = f.kind === 'number' ? 'number' : 'text';
        if (f.kind === 'number') inputEl.step = 'any';
        inputEl.className = 'form-control field-input';
        inputEl.dataset.fieldId = f.id;
        if (f.hint) inputEl.placeholder = f.hint;
      }

      inputEl.addEventListener('input', debounce(triggerRecalculate, 250));
      group.appendChild(inputEl);
      dynamicFieldsContainer.appendChild(group);
    });
  }

  function getFormDraft() {
    const attributes = {};
    const inputs = dynamicFieldsContainer.querySelectorAll('.field-input');
    inputs.forEach(inp => {
      attributes[inp.dataset.fieldId] = inp.value;
    });

    return {
      categoryId: selectCategory.value,
      subtypeId: selectSubtype.value,
      materialType: selectMaterialType.value,
      attributes: attributes,
      notes: document.getElementById('inputNotes').value.trim()
    };
  }

  function triggerRecalculate() {
    const draft = getFormDraft();
    const name = MaterialRules.generateMaterialName(draft.subtypeId, draft.attributes);
    const dim = MaterialRules.buildDimensions(draft.subtypeId, draft.attributes);

    previewName.value = name;
    previewDimensions.value = dim;

    let missingRequired = false;
    currentSchemaFields.forEach(f => {
      if (f.required && !draft.attributes[f.id]) missingRequired = true;
    });

    if (missingRequired) {
      duplicateStatusBox.className = 'status-box';
      duplicateStatusBox.textContent = 'Vui lòng điền đủ các trường bắt buộc (*)';
      similarItemsList.innerHTML = '';
      btnSaveMaterial.disabled = true;
      return;
    }

    const checkResult = MaterialRules.checkDuplicates(draft, catalogData, currentSchemaFields);

    similarItemsList.innerHTML = '';
    if (checkResult.status === 'DUPLICATE') {
      duplicateStatusBox.className = 'status-box duplicate';
      duplicateStatusBox.innerHTML = `<strong>${checkResult.message}:</strong> Mã <strong>${checkResult.match.code}</strong> - ${checkResult.match.name} <button class="btn btn-secondary" style="padding:2px 8px; font-size:11px; margin-left:8px;" id="btnViewDuplicateMatch">Xem mã</button>`;
      document.getElementById('btnViewDuplicateMatch').onclick = () => showModal(checkResult.match);
      btnSaveMaterial.disabled = true;
    } else if (checkResult.status === 'SIMILAR') {
      duplicateStatusBox.className = 'status-box similar';
      duplicateStatusBox.textContent = checkResult.message;
      let html = '<div style="font-size:12px; margin-top:6px; color:#92400e;"><strong>Các mã tương tự:</strong></div>';
      checkResult.matches.forEach(m => {
        html += `<div style="font-size:12px; padding:4px 0; border-bottom:1px dotted #cbd5e1;">- <strong>${m.item.code}</strong> (${m.item.name}): <em>${m.reason}</em></div>`;
      });
      similarItemsList.innerHTML = html;
      btnSaveMaterial.disabled = false;
    } else if (checkResult.status === 'INVALID') {
      duplicateStatusBox.className = 'status-box duplicate';
      duplicateStatusBox.textContent = checkResult.message;
      btnSaveMaterial.disabled = true;
    } else {
      duplicateStatusBox.className = 'status-box unique';
      duplicateStatusBox.textContent = checkResult.message;
      btnSaveMaterial.disabled = false;
    }
  }

  btnSaveMaterial.addEventListener('click', async () => {
    const actor = document.getElementById('inputActor').value.trim() || 'Học viên';
    const draft = getFormDraft();

    btnSaveMaterial.disabled = true;
    btnSaveMaterial.textContent = 'Đang kiểm tra & cấp mã tại GAS...';

    try {
      const res = await CloudBridge.createMaterial(actor, draft);
      showToast(`Cấp mã thành công: ${res.material.code}`, 'success');
      previewCode.value = res.material.code;
      await syncDataFromGas();
      showModal(res.material);
    } catch (err) {
      showToast(err.message, 'error');
      triggerRecalculate();
    } finally {
      btnSaveMaterial.textContent = 'Lưu & Cấp mã vật tư';
    }
  });

  async function syncDataFromGas() {
    connStatus.textContent = 'Đang đồng bộ...';
    try {
      const statusRes = await CloudBridge.fetchStatus();
      if (!statusRes.enabled) {
        throw new Error('Chế độ đào tạo tại GAS hiện đang đóng.');
      }
      if (statusRes.attributeSchemaVersion !== 'erp-attribute-v1') {
        throw new Error(`Phiên bản Schema không khớp: Server yêu cầu ${statusRes.attributeSchemaVersion}`);
      }

      const listRes = await CloudBridge.fetchList();
      catalogData = listRes.materials || [];

      connStatus.className = 'conn-badge connected';
      connStatus.textContent = 'GAS Online (ERP v1)';
      document.getElementById('kpiTotalCodes').textContent = catalogData.length;
      document.getElementById('kpiLastSync').textContent = new Date().toLocaleTimeString('vi-VN');
      if (catalogData.length > 0) {
        document.getElementById('kpiLatestCode').textContent = catalogData[catalogData.length - 1].code;
      }

      renderCatalogTable();
      triggerRecalculate();
      showToast(`Đã đồng bộ ${catalogData.length} vật tư từ GAS.`, 'success');
    } catch (err) {
      connStatus.className = 'conn-badge disconnected';
      connStatus.textContent = 'Ngoại tuyến / Chưa kết nối';
      showToast(err.message, 'error');
    }
  }

  function renderCatalogTable() {
    const query = searchInput.value.toLowerCase().trim();
    const cat = filterCategory.value;

    const filtered = catalogData.filter(item => {
      const matchCat = !cat || item.categoryId === cat;
      const matchQ = !query ||
        (item.code && item.code.toLowerCase().includes(query)) ||
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.grade && item.grade.toLowerCase().includes(query));
      return matchCat && matchQ;
    });

    if (filtered.length === 0) {
      catalogTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">Không tìm thấy bản ghi phù hợp</td></tr>';
      return;
    }

    catalogTableBody.innerHTML = filtered.map(item => `
      <tr data-code="${item.code}">
        <td><strong>${item.code}</strong></td>
        <td>${item.name}</td>
        <td>${item.categoryId}</td>
        <td>${item.unit || ''}</td>
        <td><span class="badge ${item.materialType === 'ROH' ? 'badge-roh' : 'badge-hibe'}">${item.materialType || 'ROH'}</span></td>
        <td>${item.dimensions || ''}</td>
        <td><span style="font-size:11px; color:#64748b;">${item.codeOrigin || 'SYSTEM'}</span></td>
        <td>${item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : ''}</td>
      </tr>
    `).join('');

    catalogTableBody.querySelectorAll('tr').forEach(row => {
      row.onclick = () => {
        const c = row.dataset.code;
        const item = catalogData.find(x => x.code === c);
        if (item) showModal(item);
      };
    });
  }

  function showModal(item) {
    currentViewingItem = item;
    document.getElementById('modalTitle').textContent = `Mã vật tư: ${item.code}`;
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div id="barcodeSvgContainer"></div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding:6px; color:#64748b; width:130px;">Tên chuẩn hóa:</td><td><strong>${item.name}</strong></td></tr>
        <tr><td style="padding:6px; color:#64748b;">Nhóm danh mục:</td><td>${item.categoryId} (${item.subtypeId || ''})</td></tr>
        <tr><td style="padding:6px; color:#64748b;">Quy cách:</td><td>${item.dimensions || ''}</td></tr>
        <tr><td style="padding:6px; color:#64748b;">Đơn vị tính:</td><td>${item.unit || ''}</td></tr>
        <tr><td style="padding:6px; color:#64748b;">Loại vật tư:</td><td>${item.materialType || ''}</td></tr>
        <tr><td style="padding:6px; color:#64748b;">Ghi chú:</td><td>${item.notes || 'Không có'}</td></tr>
        <tr><td style="padding:6px; color:#64748b;">Nguồn gốc mã:</td><td>${item.codeOrigin || 'SYSTEM_GENERATED'}</td></tr>
        <tr><td style="padding:6px; color:#64748b;">Thời gian cấp:</td><td>${item.createdAt || ''}</td></tr>
      </table>
    `;

    BarcodeRenderer.renderSvg(item.code, 'barcodeSvgContainer');
    detailModal.classList.add('active');
  }

  btnCloseModal.onclick = () => detailModal.classList.remove('active');
  btnCloseModalBtn.onclick = () => detailModal.classList.remove('active');

  btnDownloadSvg.onclick = () => {
    if (!currentViewingItem) return;
    const svgEl = document.querySelector('#barcodeSvgContainer svg');
    if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Barcode_${currentViewingItem.code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  btnPrintBarcode.onclick = () => {
    const svgEl = document.querySelector('#barcodeSvgContainer svg');
    if (!svgEl) return;
    const printWin = window.open('', '', 'width=400,height=300');
    printWin.document.write(`<html><body style="text-align:center;padding:20px;"><h3>${currentViewingItem.name}</h3>${svgEl.outerHTML}</body></html>`);
    printWin.document.close();
    printWin.focus();
    printWin.print();
    printWin.close();
  };

  btnSync.onclick = () => syncDataFromGas();
  btnSettings.onclick = () => {
    const cur = CloudBridge.getGasUrl();
    const next = prompt('Dán URL Google Apps Script Web App (/exec):', cur);
    if (next !== null) {
      CloudBridge.setGasUrl(next);
      syncDataFromGas();
    }
  };

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      viewSections.forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  searchInput.addEventListener('input', debounce(renderCatalogTable, 200));
  filterCategory.addEventListener('change', renderCatalogTable);

  function debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  if (CloudBridge.getGasUrl()) {
    syncDataFromGas();
  }
});
