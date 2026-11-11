/**
 * MATERIAL MASTER ERP BACKEND - GOOGLE APPS SCRIPT
 * Version: 1.0-training
 * Schema: erp-attribute-v1
 */

const CONFIG = {
  TRAINING_ENABLED: true,
  SCHEMA_VERSION: 'erp-attribute-v1',
  SHEET_MATERIALS: 'MATERIALS',
  SHEET_RANGES: 'NUMBER_RANGES',
  SHEET_AUDIT: 'AUDIT_LOG'
};

function doPost(e) {
  let responseData = { ok: false, error: { code: 'UNKNOWN', message: 'Lỗi không xác định.' } };

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw { code: 'EMPTY_BODY', message: 'Yêu cầu không có nội dung body.' };
    }

    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload || {};

    switch (action) {
      case 'ping':
        responseData = { ok: true, data: { service: 'MaterialMasterERP', version: '1.0-training' } };
        break;

      case 'training.status':
        responseData = {
          ok: true,
          data: {
            enabled: CONFIG.TRAINING_ENABLED,
            mode: 'TRAINING_PUBLIC',
            canCreate: CONFIG.TRAINING_ENABLED,
            attributeSchemaVersion: CONFIG.SCHEMA_VERSION
          }
        };
        break;

      case 'training.list':
        responseData = {
          ok: true,
          data: getMaterialsList()
        };
        break;

      case 'training.create':
        if (!CONFIG.TRAINING_ENABLED) {
          throw { code: 'TRAINING_DISABLED', message: 'Giảng viên đã tắt chế độ đào tạo cấp mã.' };
        }
        responseData = {
          ok: true,
          data: handleCreateMaterial(payload)
        };
        break;

      default:
        throw { code: 'DENY_BY_DEFAULT', message: `Hành động '${action}' bị từ chối hoặc không tồn tại.` };
    }
  } catch (err) {
    responseData = {
      ok: false,
      error: {
        code: err.code || 'SERVER_ERROR',
        message: err.message || String(err)
      }
    };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    service: 'Material Master ERP Training Endpoint',
    status: 'ACTIVE'
  })).setMimeType(ContentService.MimeType.JSON);
}

function getMaterialsList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_MATERIALS);
  if (!sheet) return { materials: [], count: 0 };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { materials: [], count: 0 };

  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1]) continue;

    list.push({
      id: row[0],
      code: String(row[1]),
      name: String(row[2]),
      categoryId: String(row[3]),
      unit: String(row[4]),
      materialType: String(row[5]),
      grade: String(row[6]),
      standard: String(row[7]),
      dimensions: String(row[8]),
      technicalSpecification: String(row[9]),
      notes: String(row[10]),
      status: String(row[11]),
      codeOrigin: String(row[12]),
      origin: String(row[13]),
      createdAt: row[14],
      attributesJson: row[20]
    });
  }

  return { materials: list, count: list.length };
}

function handleCreateMaterial(payload) {
  const actorName = sanitizeCell(payload.actorName || 'Student');
  const requestId = String(payload.requestId || '').trim();
  const material = payload.material;

  if (!requestId) {
    throw { code: 'MISSING_REQUEST_ID', message: 'Yêu cầu thiếu requestId duy nhất.' };
  }
  if (!material || !material.categoryId || !material.subtypeId || !material.attributes) {
    throw { code: 'INVALID_MATERIAL_PAYLOAD', message: 'Dữ liệu thuộc tính vật tư không đầy đủ.' };
  }

  if (payload.code || material.code || payload.name || material.name) {
    throw { code: 'CLIENT_CODE_FORBIDDEN', message: 'Client không được tự gửi code hoặc name lên server.' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    throw { code: 'SERVER_BUSY', message: 'Máy chủ đang xử lý nhiều yêu cầu đồng thời. Vui lòng bấm thử lại.' };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetMat = ss.getSheetByName(CONFIG.SHEET_MATERIALS);
    const sheetRanges = ss.getSheetByName(CONFIG.SHEET_RANGES);
    const sheetAudit = ss.getSheetByName(CONFIG.SHEET_AUDIT);

    const matData = sheetMat.getDataRange().getValues();
    for (let i = 1; i < matData.length; i++) {
      if (matData[i][19] === requestId) {
        return {
          material: {
            code: matData[i][1],
            name: matData[i][2],
            categoryId: matData[i][3],
            status: matData[i][11]
          },
          idempotentReplay: true
        };
      }
    }

    const serverName = serverGenerateName(material.subtypeId, material.attributes);
    const serverDim = serverBuildDimensions(material.subtypeId, material.attributes);
    const serverUnit = serverGetUnit(material.subtypeId);
    const serverKey = serverCanonicalIdentity(material.categoryId, material.subtypeId, material.attributes);

    for (let i = 1; i < matData.length; i++) {
      const rowAttrsJson = matData[i][20];
      if (rowAttrsJson && typeof rowAttrsJson === 'string' && rowAttrsJson.startsWith('{')) {
        try {
          const parsed = JSON.parse(rowAttrsJson);
          const existKey = serverCanonicalIdentity(matData[i][3], parsed.subtypeId || material.subtypeId, parsed);
          if (existKey === serverKey) {
            throw {
              code: 'DUPLICATE_MATERIAL',
              message: `Vật tư đã tồn tại trong danh mục Material Master với mã ${matData[i][1]}.`
            };
          }
        } catch (e) {
          if (e.code === 'DUPLICATE_MATERIAL') throw e;
        }
      }
    }

    const rangeData = sheetRanges.getDataRange().getValues();
    let currentLast = 0;
    let rangeRowIndex = -1;

    for (let r = 1; r < rangeData.length; r++) {
      if (rangeData[r][0] === 'MATERIAL_AUTO') {
        currentLast = parseInt(rangeData[r][3], 10) || 0;
        rangeRowIndex = r + 1;
        break;
      }
    }

    if (rangeRowIndex === -1) {
      throw { code: 'RANGE_NOT_FOUND', message: 'Không tìm thấy cấu hình dải số MATERIAL_AUTO.' };
    }

    const nextNum = currentLast + 1;
    const nextCode = 'A' + String(nextNum).padStart(6, '0');

    const nowIso = new Date().toISOString();
    const newRowId = Utilities.getUuid();
    const attrsToSave = Object.assign({}, material.attributes, { subtypeId: material.subtypeId });

    sheetMat.appendRow([
      newRowId,
      nextCode,
      sanitizeCell(serverName),
      sanitizeCell(material.categoryId),
      sanitizeCell(serverUnit),
      sanitizeCell(material.materialType || 'ROH'),
      sanitizeCell(material.attributes.grade || material.attributes.compound || ''),
      sanitizeCell(material.attributes.standard || ''),
      sanitizeCell(serverDim),
      '',
      sanitizeCell(material.notes || ''),
      'ACTIVE',
      'SYSTEM_GENERATED',
      'TRAINING',
      nowIso,
      nowIso,
      actorName,
      actorName,
      1,
      requestId,
      JSON.stringify(attrsToSave)
    ]);

    sheetRanges.getRange(rangeRowIndex, 4).setValue(nextNum);
    sheetRanges.getRange(rangeRowIndex, 5).setValue('A' + String(nextNum + 1).padStart(6, '0'));
    sheetRanges.getRange(rangeRowIndex, 7).setValue(nowIso);

    sheetAudit.appendRow([
      Utilities.getUuid(),
      nowIso,
      actorName,
      'CREATE',
      nextCode,
      requestId,
      '',
      JSON.stringify({ code: nextCode, name: serverName }),
      'SUCCESS'
    ]);

    return {
      material: {
        id: newRowId,
        code: nextCode,
        name: serverName,
        categoryId: material.categoryId,
        unit: serverUnit,
        materialType: material.materialType || 'ROH',
        dimensions: serverDim,
        status: 'ACTIVE',
        createdAt: nowIso
      },
      idempotentReplay: false
    };

  } finally {
    lock.releaseLock();
  }
}

function sanitizeCell(val) {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  if (s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@')) {
    return "'" + s;
  }
  return s;
}

function serverBuildDimensions(subtypeId, a) {
  function n(v) {
    if (!v) return '?';
    let num = parseFloat(String(v).replace(',', '.'));
    return isNaN(num) ? '?' : String(Math.round(num * 1000) / 1000);
  }
  switch (subtypeId) {
    case 'STEEL_PLATE': return `${n(a.thickness)}x${n(a.width)}x${n(a.length)} mm`;
    case 'STEEL_ROUND': return `Ø${n(a.diameter)}x${n(a.length)} mm`;
    case 'STEEL_TUBE': return `Ø${n(a.outerDiameter)}x${n(a.wall)}x${n(a.length)} mm`;
    case 'STEEL_SECTION': return `${a.size || '?'}x${n(a.length)} mm`;
    case 'RUBBER_SHEET':
    case 'RUBBER_PAD': return `${n(a.thickness)}x${n(a.width)}x${n(a.length)} mm`;
    case 'RUBBER_RING': return `Ø${n(a.outerDiameter)}/Ø${n(a.innerDiameter)}xt${n(a.thickness)} mm`;
    case 'SLIDE_PLATE': return `${n(a.thickness)}x${n(a.width)}x${n(a.length)} mm`;
    case 'SLIDE_DISC': return `Ø${n(a.diameter)}xt${n(a.thickness)} mm`;
    case 'HEX_BOLT':
    case 'SOCKET_BOLT': return `M${n(a.diameter)}x${n(a.length)} mm`;
    default: return '';
  }
}

function serverGenerateName(subtypeId, a) {
  const d = serverBuildDimensions(subtypeId, a);
  switch (subtypeId) {
    case 'STEEL_PLATE': return `Thép tấm ${a.grade || ''}${a.standard ? ' (' + a.standard + ')' : ''} · ${d}`.trim();
    case 'STEEL_ROUND': return `Thép tròn đặc ${a.grade || ''} · ${d}`.trim();
    case 'STEEL_TUBE': return `Thép ống ${a.grade || ''} · ${d}`.trim();
    case 'STEEL_SECTION': return `Thép hình ${a.profile || ''} ${a.grade || ''} · ${d}`.trim();
    case 'RUBBER_SHEET': return `Cao su tấm ${a.compound || ''} · ${a.hardness || '?'} Shore A · ${d}`.trim();
    case 'RUBBER_PAD': return `Đệm cao su ${a.compound || ''} · ${a.hardness || '?'} Shore A · ${d}`.trim();
    case 'RUBBER_RING': return `Vòng cao su ${a.compound || ''} · ${a.hardness || '?'} Shore A · ${d}`.trim();
    case 'SLIDE_PLATE': return `Tấm trượt ${a.compound || ''} · ${d} · ${a.surface || ''}`.trim();
    case 'SLIDE_DISC': return `Đĩa trượt tròn ${a.compound || ''} · ${d} · ${a.surface || ''}`.trim();
    case 'HEX_BOLT': return `Bu lông lục giác ngoài ${a.standard || ''} · ${a.strength || ''} · ${d} · ${a.finish || ''}`.trim();
    case 'SOCKET_BOLT': return `Bu lông lục giác chìm ${a.standard || ''} · ${a.strength || ''} · ${d} · ${a.finish || ''}`.trim();
    default: return 'Vật tư chưa xác định';
  }
}

function serverGetUnit(subtypeId) {
  if (['STEEL_PLATE', 'RUBBER_SHEET', 'SLIDE_PLATE'].indexOf(subtypeId) !== -1) return 'Tấm';
  if (['STEEL_ROUND', 'STEEL_TUBE', 'STEEL_SECTION'].indexOf(subtypeId) !== -1) return 'Thanh';
  return 'Cái';
}

function serverCanonicalIdentity(categoryId, subtypeId, a) {
  const clean = {};
  Object.keys(a).sort().forEach(k => {
    let v = a[k];
    let num = parseFloat(String(v).replace(',', '.'));
    if (!isNaN(num) && isFinite(num) && String(v).trim() !== '') {
      clean[k] = Math.round(num * 1000) / 1000;
    } else {
      clean[k] = String(v || '').trim().toUpperCase();
    }
  });
  return JSON.stringify({ c: categoryId, s: subtypeId, a: clean });
}

function initialSetupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheetMat = ss.getSheetByName(CONFIG.SHEET_MATERIALS);
  if (!sheetMat) sheetMat = ss.insertSheet(CONFIG.SHEET_MATERIALS);
  sheetMat.clear();
  sheetMat.appendRow([
    'id', 'code', 'name', 'categoryId', 'unit', 'materialType',
    'grade', 'standard', 'dimensions', 'technicalSpecification',
    'notes', 'status', 'codeOrigin', 'origin', 'createdAt',
    'updatedAt', 'createdBy', 'updatedBy', 'revision', 'requestId', 'attributesJson'
  ]);

  let sheetRange = ss.getSheetByName(CONFIG.SHEET_RANGES);
  if (!sheetRange) sheetRange = ss.insertSheet(CONFIG.SHEET_RANGES);
  sheetRange.clear();
  sheetRange.appendRow(['series', 'prefix', 'digits', 'lastNumber', 'nextCode', 'enabled', 'updatedAt']);
  sheetRange.appendRow(['MATERIAL_AUTO', 'A', 6, 0, 'A000001', true, new Date().toISOString()]);

  let sheetAudit = ss.getSheetByName(CONFIG.SHEET_AUDIT);
  if (!sheetAudit) sheetAudit = ss.insertSheet(CONFIG.SHEET_AUDIT);
  sheetAudit.clear();
  sheetAudit.appendRow(['eventId', 'at', 'actorId', 'action', 'materialCode', 'requestId', 'beforeJson', 'afterJson', 'result']);
}
