# BẢNG NGHIỆM THU KIỂM THỬ (T01 - T20)

| ID | Kịch bản kiểm thử | Trạng thái | Chi tiết triển khai & Hàm đối chiếu |
|---|---|---|---|
| T01 | Responsive Desktop & Mobile | PASS | Bố cục CSS Grid tự co giãn thành 1 cột trên màn hình nhỏ tại `assets/css/styles.css` |
| T02 | Đổi chủng loại kỹ thuật | PASS | Hàm `renderDynamicFields()` tải động các trường theo schema từ `config.json` |
| T03 | Sinh tên tự động chuẩn hóa | PASS | `MaterialRules.generateMaterialName()` sinh tên theo chuẩn kỹ thuật |
| T04 | Client gửi name/code giả mạo | PASS | GAS kiểm tra và chặn với mã lỗi `CLIENT_CODE_FORBIDDEN` |
| T05 | Chuẩn hóa số học (020, 20.0, 20) | PASS | `MaterialRules.normalizeNumber()` quy chuẩn số học đồng nhất |
| T06 | Phát hiện trùng hoàn toàn | PASS | Khóa nhận dạng `getCanonicalIdentityKey()` phát hiện trùng và khóa nút Lưu |
| T07 | Phân biệt bu lông cùng kích thước khác cấp bền | PASS | Cột `strength` có cờ `identity: true` nên không bị nhận định trùng nhầm |
| T08 | Phân biệt PTFE và UHMWPE | PASS | Trường `compound` tham gia định danh loại trừ trùng sai |
| T09 | Mã lịch sử thiếu thông số | PASS | Trả về trạng thái `SIMILAR` (gần giống) để đối chiếu, không tự kết luận |
| T10 | Chống bấm nút Lưu 2 lần liên tục | PASS | Disable nút ngay lập tức và sinh 1 `requestId` duy nhất |
| T11 | Gửi lại requestId khi timeout | PASS | GAS đối chiếu cột `T` trong tab `MATERIALS` và trả kết quả cũ (idempotency) |
| T12 | Hai học viên gửi cùng lúc | PASS | `LockService.getScriptLock()` xếp hàng kiểm tra; request sau bị báo trùng |
| T13 | Hai học viên tạo hai vật tư khác nhau | PASS | Dải số tại `NUMBER_RANGES` tăng tuần tự an toàn, không trùng số |
| T14 | Server GAS báo lỗi hoặc timeout | PASS | Bắt `AbortController` 25s và hiển thị thông báo toast thân thiện |
| T15 | Phiên bản schema không khớp | PASS | Kiểm tra `attributeSchemaVersion === 'erp-attribute-v1'`, khóa tạo nếu lệch |
| T16 | Xuất Barcode Code 128 | PASS | `BarcodeRenderer.renderSvg()` tạo mã vạch SVG vector chuẩn Code 128 |
| T17 | Đường dẫn tài nguyên trên GitHub Pages | PASS | Toàn bộ đường dẫn là relative (`./assets/...`) tương thích repo con |
| T18 | Giảng viên tắt chế độ training | PASS | GAS kiểm tra cờ `TRAINING_ENABLED` và chặn ghi |
| T19 | Chặn action lạ theo Deny-by-default | PASS | Switch-case trong `doPost` từ chối mọi action không nằm trong whitelist |
| T20 | Đồng bộ đa client | PASS | API `training.list` cung cấp Master Data nhất quán cho toàn bộ máy trạm |
