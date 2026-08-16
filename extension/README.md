# Hướng dẫn Cài đặt & Sử dụng Tiện ích mở rộng trên Chrome & Firefox

Tiện ích mở rộng **LinkedIn Job Hunter Extractor** hỗ trợ đầy đủ cả hai chuẩn trình duyệt phổ biến nhất: **Google Chrome (và các trình duyệt nền Chromium như Edge, Brave, Cốc Cốc)** và **Mozilla Firefox**.

---

## 1. Hướng dẫn Cài đặt trên Mozilla Firefox

### Bước 1: Mở trang Quản lý Gỡ lỗi Tiện ích (Debugging)
- Mở trình duyệt Firefox, nhập đường dẫn sau vào thanh địa chỉ và nhấn Enter:
  `about:debugging#/runtime/this-firefox`
- Hoặc vào `about:debugging` -> Nhấp vào mục **This Firefox** (Firefox này) ở menu bên trái.

### Bước 2: Nạp Tiện ích Tạm thời (Load Temporary Add-on)
- Nhấn vào nút **Load Temporary Add-on...** (Tải tiện ích bổ sung tạm thời...).
- Điều hướng đến thư mục dự án và chọn tệp:
  `c:\1. FPT\Project\JOb\extension\manifest.json`

### Bước 3: Ghim Tiện ích lên Thanh Công cụ
- Biểu tượng của tiện ích sẽ xuất hiện trong danh sách Tiện ích mở rộng (biểu tượng mảnh ghép ghép trên thanh công cụ Firefox).
- Nhấp chuột phải vào biểu tượng và chọn **Pin to Toolbar** (Ghim vào thanh công cụ) để sử dụng thuận tiện.

---

## 2. Hướng dẫn Cài đặt trên Google Chrome / Microsoft Edge / Cốc Cốc

### Bước 1: Mở trang Tiện ích
- Trên Google Chrome / Cốc Cốc: Truy cập `chrome://extensions/`
- Trên Microsoft Edge: Truy cập `edge://extensions/`

### Bước 2: Bật Chế độ Nhà phát triển (Developer Mode)
- Bật công tắc **Developer mode** ở góc trên bên phải màn hình.

### Bước 3: Nạp Thư mục Tiện ích
- Nhấn nút **Load unpacked** (Tải tiện ích đã giải nén).
- Chọn thư mục:
  `c:\1. FPT\Project\JOb\extension`

---

## 3. Quy trình Sử dụng Thực tế

1. **Khởi động máy chủ Next.js**:
   - Đảm bảo dự án đang chạy (`npm run dev` tại `http://localhost:3000`).

2. **Duyệt việc làm trên LinkedIn**:
   - Mở bất kỳ trang tin tuyển dụng nào trên `https://www.linkedin.com/jobs/*`.

3. **Đồng bộ Dữ liệu**:
   - Bấm vào biểu tượng tiện ích trên thanh công cụ trình duyệt.
   - Nhấn **Đồng bộ công việc này vào Dashboard**.
   - Dữ liệu thực tế và Logo công ty sẽ được gửi trực tiếp về hệ thống và tính điểm tương thích CV ngay lập tức.
