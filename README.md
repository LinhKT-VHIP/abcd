# Material Master ERP Training Web App

Dự án Web App quản lý Master Data vật tư công nghiệp cơ khí kết nối Google Apps Script & Google Sheets.

## Cấu trúc thư mục chuẩn
```text
Material_Master_WebApp/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── favicon.svg
├── icon-152.png
├── icon-192.png
├── icon-512.png
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js
│   │   ├── cloud-bridge.js
│   │   ├── material-rules.js
│   │   └── barcode.js
│   ├── data/
│   │   └── config.json
│   ├── images/
│   ├── audio/
│   └── videos/
├── gas/
│   └── Code.gs
├── README.md
└── TEST_REPORT.md
```

## Hướng dẫn cài đặt & Triển khai

### Chế độ A: Triển khai độc lập
1. Tạo 1 file Google Sheets mới trên Google Drive cá nhân.
2. Mở **Tiện ích mở rộng (Extensions) -> Apps Script**.
3. Dán toàn bộ nội dung file `gas/Code.gs` vào trình chỉnh sửa.
4. Chọn hàm `initialSetupSheet` và nhấn **Run** để khởi tạo 3 tab: `MATERIALS`, `NUMBER_RANGES`, `AUDIT_LOG`.
5. Nhấn **Deploy -> New deployment**:
   - Chọn loại: **Web app**.
   - Execute as: **Me**.
   - Who has access: **Anyone**.
6. Sao chép URL Web App (`.../exec`).
7. Mở file `index.html` (qua VS Code Live Server hoặc mở trực tiếp trên trình duyệt), bấm nút **Cấu hình GAS** và dán URL vào để kết nối.

### Chế độ B: Kết nối backend chung của giảng viên
1. Mở Web App trên trình duyệt / GitHub Pages.
2. Bấm nút **Cấu hình GAS** trên thanh tiêu đề, dán URL `/exec` do giảng viên cung cấp.
3. Nhấn **Đồng bộ dữ liệu** để tải danh mục vật tư mới nhất.
