/**
 * Thuần hóa số liệu, tạo tên, chữ ký nhận dạng và kiểm tra trùng
 */
const MaterialRules = (() => {
  function normalizeNumber(val) {
    if (val === undefined || val === null || val === '') return null;
    let s = String(val).trim().replace(',', '.');
    let n = parseFloat(s);
    if (isNaN(n) || !isFinite(n) || n < 0) return null;
    return Math.round(n * 1000) / 1000;
  }

  function normalizeText(val) {
    if (val === undefined || val === null) return '';
    return String(val).trim().replace(/\s+/g, ' ');
  }

  function buildDimensions(subtypeId, attrs) {
    switch (subtypeId) {
      case 'STEEL_PLATE':
        return `${attrs.thickness || '?'}x${attrs.width || '?'}x${attrs.length || '?'} mm`;
      case 'STEEL_ROUND':
        return `Ø${attrs.diameter || '?'}x${attrs.length || '?'} mm`;
      case 'STEEL_TUBE':
        return `Ø${attrs.outerDiameter || '?'}x${attrs.wall || '?'}x${attrs.length || '?'} mm`;
      case 'STEEL_SECTION':
        return `${attrs.size || '?'}x${attrs.length || '?'} mm`;
      case 'RUBBER_SHEET':
      case 'RUBBER_PAD':
        return `${attrs.thickness || '?'}x${attrs.width || '?'}x${attrs.length || '?'} mm`;
      case 'RUBBER_RING':
        return `Ø${attrs.outerDiameter || '?'}/Ø${attrs.innerDiameter || '?'}xt${attrs.thickness || '?'} mm`;
      case 'SLIDE_PLATE':
        return `${attrs.thickness || '?'}x${attrs.width || '?'}x${attrs.length || '?'} mm`;
      case 'SLIDE_DISC':
        return `Ø${attrs.diameter || '?'}xt${attrs.thickness || '?'} mm`;
      case 'HEX_BOLT':
      case 'SOCKET_BOLT':
        return `M${attrs.diameter || '?'}x${attrs.length || '?'} mm`;
      default:
        return '';
    }
  }

  function generateMaterialName(subtypeId, attrs) {
    const dim = buildDimensions(subtypeId, attrs);
    switch (subtypeId) {
      case 'STEEL_PLATE':
        return `Thép tấm ${attrs.grade || ''}${attrs.standard ? ' (' + attrs.standard + ')' : ''} · ${dim}`.trim();
      case 'STEEL_ROUND':
        return `Thép tròn đặc ${attrs.grade || ''} · ${dim}`.trim();
      case 'STEEL_TUBE':
        return `Thép ống ${attrs.grade || ''} · ${dim}`.trim();
      case 'STEEL_SECTION':
        return `Thép hình ${attrs.profile || ''} ${attrs.grade || ''} · ${dim}`.trim();
      case 'RUBBER_SHEET':
        return `Cao su tấm ${attrs.compound || ''} · ${attrs.hardness || '?'} Shore A · ${dim}`.trim();
      case 'RUBBER_PAD':
        return `Đệm cao su ${attrs.compound || ''} · ${attrs.hardness || '?'} Shore A · ${dim}`.trim();
      case 'RUBBER_RING':
        return `Vòng cao su ${attrs.compound || ''} · ${attrs.hardness || '?'} Shore A · ${dim}`.trim();
      case 'SLIDE_PLATE':
        return `Tấm trượt ${attrs.compound || ''} · ${dim} · ${attrs.surface || ''}`.trim();
      case 'SLIDE_DISC':
        return `Đĩa trượt tròn ${attrs.compound || ''} · ${dim} · ${attrs.surface || ''}`.trim();
      case 'HEX_BOLT':
        return `Bu lông lục giác ngoài ${attrs.standard || ''} · ${attrs.strength || ''} · ${dim} · ${attrs.finish || ''}`.trim();
      case 'SOCKET_BOLT':
        return `Bu lông lục giác chìm ${attrs.standard || ''} · ${attrs.strength || ''} · ${dim} · ${attrs.finish || ''}`.trim();
      default:
        return 'Vật tư chưa xác định';
    }
  }

  function getCanonicalIdentityKey(categoryId, subtypeId, attrs, schemaFields) {
    const identityMap = {};
    const sortedFields = [...schemaFields].filter(f => f.identity).sort((a, b) => a.id.localeCompare(b.id));

    for (const f of sortedFields) {
      let rawVal = attrs[f.id];
      if (f.kind === 'number') {
        const normN = normalizeNumber(rawVal);
        identityMap[f.id] = normN !== null ? normN : '';
      } else {
        identityMap[f.id] = normalizeText(rawVal).toUpperCase();
      }
    }

    return JSON.stringify({
      c: categoryId,
      s: subtypeId,
      k: identityMap
    });
  }

  function validateGeometry(subtypeId, attrs) {
    const errors = [];
    if (subtypeId === 'STEEL_TUBE') {
      const od = normalizeNumber(attrs.outerDiameter);
      const w = normalizeNumber(attrs.wall);
      if (od && w && (2 * w >= od)) {
        errors.push('Đường kính ngoài phải lớn hơn 2 lần chiều dày thành ống (2 x wall < D).');
      }
    }
    if (subtypeId === 'RUBBER_RING') {
      const od = normalizeNumber(attrs.outerDiameter);
      const id = normalizeNumber(attrs.innerDiameter);
      if (od && id && id >= od) {
        errors.push('Đường kính trong (d) phải nhỏ hơn đường kính ngoài (D).');
      }
    }
    return errors;
  }

  function checkDuplicates(draft, catalog, schemaFields) {
    const { categoryId, subtypeId, attributes } = draft;
    const errors = validateGeometry(subtypeId, attributes);
    if (errors.length > 0) {
      return { status: 'INVALID', message: errors[0], matches: [] };
    }

    const currentKey = getCanonicalIdentityKey(categoryId, subtypeId, attributes, schemaFields);
    const idFields = schemaFields.filter(f => f.identity);

    let exactMatch = null;
    const closeMatches = [];

    for (const item of catalog) {
      if (item.categoryId !== categoryId) continue;

      let itemAttrs = null;
      if (typeof item.attributesJson === 'string' && item.attributesJson.startsWith('{')) {
        try { itemAttrs = JSON.parse(item.attributesJson); } catch (e) {}
      } else if (typeof item.attributesJson === 'object' && item.attributesJson !== null) {
        itemAttrs = item.attributesJson;
      }

      if (itemAttrs) {
        const itemKey = getCanonicalIdentityKey(item.categoryId, item.subtypeId || subtypeId, itemAttrs, schemaFields);
        if (itemKey === currentKey) {
          exactMatch = item;
          break;
        }

        let commonCount = 0;
        let diffReasons = [];
        for (const f of idFields) {
          const val1 = normalizeText(attributes[f.id]).toUpperCase();
          const val2 = normalizeText(itemAttrs[f.id]).toUpperCase();
          if (val1 && val2) {
            if (val1 === val2) commonCount++;
            else diffReasons.push(`${f.label}: ${val1} ≠ ${val2}`);
          }
        }
        if (commonCount >= 2 && diffReasons.length > 0 && diffReasons.length <= 2) {
          closeMatches.push({ item, reason: diffReasons.join('; ') });
        }
      } else {
        const curName = generateMaterialName(subtypeId, attributes).toLowerCase();
        const itemName = (item.name || '').toLowerCase();
        if (curName === itemName && curName.length > 5) {
          exactMatch = item;
          break;
        } else if (item.grade && attributes.grade && String(item.grade).trim().toUpperCase() === String(attributes.grade).trim().toUpperCase()) {
          closeMatches.push({ item, reason: `Cùng mác/vật liệu ${item.grade}, cần đối chiếu thêm bản ghi lịch sử.` });
        }
      }
    }

    if (exactMatch) {
      return {
        status: 'DUPLICATE',
        message: 'Vật tư đã tồn tại trong danh mục Material Master',
        match: exactMatch
      };
    }
    if (closeMatches.length > 0) {
      return {
        status: 'SIMILAR',
        message: 'Phát hiện vật tư gần giống trong hệ thống. Vui lòng kiểm tra đối chiếu.',
        matches: closeMatches.slice(0, 5)
      };
    }

    return {
      status: 'UNIQUE',
      message: 'Không tìm thấy mã trùng. Đủ điều kiện cấp mã mới.',
      matches: []
    };
  }

  return {
    normalizeNumber,
    normalizeText,
    buildDimensions,
    generateMaterialName,
    getCanonicalIdentityKey,
    validateGeometry,
    checkDuplicates
  };
})();
