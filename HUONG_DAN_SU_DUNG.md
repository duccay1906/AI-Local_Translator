# 📖 HƯỚNG DẪN SỬ DỤNG AI LOCAL TRANSLATOR

> **AI Local Translator** là ứng dụng desktop Windows hiện đại, hỗ trợ dịch thuật văn bản và chụp quét ảnh (OCR) tức thì bằng trí tuệ nhân tạo (AI) thông qua **LM Studio** (chạy cục bộ hoặc máy chủ GPU trong mạng LAN). Hoàn toàn riêng tư, bảo mật 100%, không cần kết nối Internet và không tốn phí API.

---

## 📑 MỤC LỤC
1. [Cài đặt & Khởi động](#1-cài-đặt--khởi-động)
2. [Các tính năng dịch cốt lõi](#2-các-tính-năng-dịch-cốt-lõi)
   - [Dịch văn bản bôi đen (Mặc định: F8)](#21-dịch-văn-bản-bôi-đen-phím-tắt-f8)
   - [Chụp & Dịch chữ từ ảnh màn hình (Mặc định: F9)](#22-chụp--dịch-chữ-từ-ảnh-màn-hình-ocr-phím-tắt-f9)
3. [Sử dụng Hộp thoại Dịch nổi (Floating Popup)](#3-sử-dụng-hộp-thoại-dịch-nổi-floating-popup)
4. [Cấu hình Cài đặt (Settings)](#4-cấu-hình-cài-đặt-settings)
   - [Đổi phím tắt toàn cục](#41-đổi-phím-tắt-toàn-cục)
   - [Cấu hình kết nối LM Studio (Local / LAN)](#42-kết-nối-lm-studio-local--mạng-lan)
   - [Chế độ suy nghĩ AI (Tối ưu tốc độ dịch cho Gemma 4)](#43-chế-độ-ai-thinking--reasoning-mode)
   - [Tùy biến System Prompt & Lịch sử dịch](#44-tùy-biến-system-prompt--lịch-sử-dịch)
5. [Mô hình Máy chủ GPU Mạng LAN (Dùng chung cho nhiều máy)](#5-triển-khai-máy-chủ-gpu-mạng-lan-nhiều-người-dùng)
6. [Xử lý sự cố thường gặp (FAQ)](#6-xử-lý-sự-cố-thường-gặp-faq)
7. [Hướng dẫn Biên dịch & Đóng gói Project (Build & Package)](#7-hướng-dẫn-biên-dịch--đóng-gói-project-build--package)

---

## 1. Cài đặt & Khởi động

### 1.1. Bản Portable (Khuyên dùng - Không cần cài đặt)
- Đường dẫn file: `release/AI Local Translator 1.0.1.exe`.
- Bạn có thể copy file này sang bất kỳ máy tính nào khác và nhấp đúp để chạy ngay lập tức.
- Dữ liệu OCR offline (Tiếng Anh, Hàn, Nhật, Trung, Việt) đã được đóng gói sẵn bên trong file, máy không có mạng vẫn dịch ảnh tốt.

### 1.2. Khởi động cùng Windows (Auto-Start)
- Ứng dụng đã được tích hợp sẵn tính năng tự động chạy ngầm khi mở máy tính:
  - Khi Windows khởi động, ứng dụng sẽ tự chạy và thu nhỏ xuống khay hệ thống (**System Tray** - góc dưới cùng bên phải màn hình).
  - Bạn có thể bấm phím tắt dịch ngay lập tức mà không cần mở thủ công.
  - Bạn có thể bật/tắt tính năng này trong phần **Settings** hoặc menu chuột phải ở khay hệ thống.

---

## 2. Các tính năng dịch cốt lõi

### 2.1. Dịch văn bản bôi đen (Phím tắt: `F8`)
Áp dụng cho mọi phần mềm trên máy tính (Trình duyệt web, file PDF, Word, Excel, Zalo, VS Code,...):
1. Dùng chuột **bôi đen (chọn)** đoạn văn bản cần dịch.
2. Nhấn phím **`F8`** (hoặc phím tắt do bạn tùy chỉnh).
3. Hộp thoại dịch nổi sẽ xuất hiện ngay tại vị trí con trỏ chuột và hiển thị bản dịch theo thời gian thực (streaming từng chữ).

---

### 2.2. Chụp & Dịch chữ từ ảnh màn hình - Visual OCR (Phím tắt: `F9`)
Áp dụng khi gặp các nội dung không bôi đen được bằng chuột (Đoạn chat Messenger, KakaoTalk, Telegram, Zalo, video YouTube, truyện tranh, game, ảnh chụp tài liệu, slide thuyết trình,...):
1. Nhấn phím **`F9`** (hoặc phím tắt do bạn tùy chỉnh).
2. Màn hình sẽ tối mờ lại kèm con trỏ chữ thập `+` (tương tự công cụ `Win + Shift + S`).
3. **Kéo giữ chuột trái** để khoanh vùng hình ảnh chứa chữ cần dịch:
   - Trên thanh công cụ nổi phía trên, bạn có thể chọn nhanh ngôn ngữ nguồn OCR:
     - `Auto Detect`: Tự động nhận diện (Anh / Hàn / Nhật / Trung / Việt).
     - Hoặc chọn cố định từng tiếng: `Korean + English`, `Japanese + English`, `Chinese + English`, `English Only`,...
   - Nếu muốn hủy chụp: Nhấn phím **`Esc`** hoặc **click chuột phải**.
4. Khi bạn **thả chuột trái**, ứng dụng sẽ tự động kích hoạt **Dialog OCR chuyên biệt (Visual OCR Translator)**:
   - **Kích thước thích ứng thông minh (1:1 Native Resolution)**: Cửa sổ OCR Dialog tự động mở rộng theo kích thước thật của ảnh chụp (tối đa tới 90% màn hình), giữ nguyên độ phân giải 100% gốc không bị co rúm hay vỡ nét.
   - **Tách biệt hoàn toàn với dịch Text**: Dịch văn bản bôi đen (F8) vẫn dùng popup nhỏ gọn 420px; còn dịch ảnh (F9) sở hữu không gian riêng rộng rãi, chuyên nghiệp.
   - **Bộ công cụ trực quan**:
     - `1:1 Gốc / Vừa khung`: Chuyển đổi giữa kích thước 100% pixel gốc và tự co vừa màn hình.
     - `[-] / [+]`: Tùy ý phóng to / thu nhỏ tỉ lệ ảnh (50% - 250%).
     - `[A-] / [A+]`: Tùy chỉnh cỡ chữ dịch đè lên ảnh (60% - 150%).
     - `[So sánh (Original)]`: Nhấn giữ hoặc bấm để xem ảnh gốc trước khi dịch.
     - `[Visual / Text]`: Chuyển đổi linh hoạt giữa chế độ xem ảnh đè chữ trực quan và chế độ xem văn bản thuần 2 cột.
     - `[Copy Ảnh]`: Sao chép ảnh đã dịch vào clipboard để dán thẳng vào Zalo, Messenger, Word,...
     - `[Tải ảnh PNG]`: Lưu file ảnh đã dịch về máy tính.
     - `[Ghim (Pin)]`: Ghim cửa sổ trên cùng để không tự đóng khi bấm ra ngoài.
   - **Nút Compare (Original):** Bấm để so sánh đối chiếu giữa ảnh dịch và ảnh gốc ban đầu.
   - **Click vào bong bóng chat bất kỳ:** Tự động copy câu dịch của đoạn chat đó.
   - **Nút Copy Image:** Sao chép thẳng bức ảnh đã dịch vào Clipboard để dán (Ctrl+V) ngay vào tin nhắn hoặc tài liệu.
   - **Chuyển chế độ xem:** Có nút chuyển nhanh giữa tab `Visual` (Xem ảnh dịch đè) và tab `Text` (Xem dạng văn bản thuần).

---

## 3. Sử dụng Hộp thoại Dịch nổi (Floating Popup)

Hộp thoại dịch được thiết kế hiện đại, tinh gọn với nhiều tiện ích hữu dụng:

| Biểu tượng / Thao tác | Chức năng |
| :--- | :--- |
| **Chọn Ngôn ngữ Đích** | Dropdown trên thanh tiêu đề cho phép đổi nhanh sang Tiếng Việt, Tiếng Anh, Tiếng Nhật, Hàn, Trung, Pháp, Đức,... |
| **Ghim cửa sổ (Icon Ghim 📌)** | Bật ghim để cửa sổ luôn nằm trên cùng màn hình khi bạn chuyển qua ghi chú hoặc làm việc ở cửa sổ khác. Khi bỏ ghim, click chuột ra ngoài cửa sổ sẽ tự động đóng lại. |
| **Độ trong suốt (Icon Con mắt 👁️)** | Kéo thanh trượt điều chỉnh độ trong suốt từ 30% đến 100% (kính mờ hiện đại hoặc màu tối đặc chống chói). |
| **Quét ảnh nhanh (Icon ScanText 📷)** | Bấm trực tiếp trên thanh tiêu đề để kích hoạt tính năng chụp dịch ảnh `F9` mà không cần bấm phím. |
| **Sao chép (Icon Copy 📋)** | Sao chép nhanh toàn bộ văn bản vừa dịch vào Clipboard. |
| **Đọc phát âm (Icon Loa 🔊)** | Đọc phát âm văn bản đã dịch bằng giọng nói chuẩn của hệ điều hành (TTS). |
| **Dịch lại (Icon Xoay 🔄)** | Gửi yêu cầu dịch lại nếu cần. |
| **Xem / Sửa văn bản nguồn (Source Text)** | Bấm vào khung `Source Text` để xem lại chữ đã bôi đen hoặc chữ vừa quét OCR. Bạn có thể chỉnh sửa nhẹ chữ nguồn nếu ảnh gốc bị mờ nhận diện thiếu dấu. |
| **Đóng nhanh** | Nhấn phím **`Esc`** trên bàn phím hoặc nhấn nút **`X`**. |

---

## 4. Cấu hình Cài đặt (Settings)

Để mở bảng Cài đặt:
- Click vào biểu tượng **Bánh răng (Settings)** trên thanh tiêu đề của hộp thoại dịch.
- Hoặc click chuột trái (hoặc chuột phải) vào icon ứng dụng dưới **khay hệ thống (System Tray)** → chọn **Open Settings (Cài đặt)**.

### 4.1. Đổi phím tắt toàn cục
Trong tab **General & Model → Global Hotkeys & Languages**:
1. Nhấp chuột vào ô phím tắt hiện tại (ví dụ ô `F8` hoặc `F9`).
2. Ô sẽ đổi sang chế độ ghi phím màu xanh tím (*Press any key combo...*).
3. Bấm phím hoặc tổ hợp phím mới mà bạn muốn gán (Ví dụ: `Alt+T`, `Ctrl+Shift+X`, `F4`, `~`,...).
4. Nhấn nút **Save Settings** ở góc trên bên phải để lưu.

### 4.2. Kết nối LM Studio (Local / Mạng LAN)
- **Chạy trên cùng máy tính:** Nhập `http://localhost:1234`.
- **Chạy qua máy chủ GPU trong mạng LAN:** Nhập địa chỉ IP của máy chủ GPU (Ví dụ: `http://192.168.1.150:1234`).
- Bấm nút **Test Connection** để kiểm tra kết nối và tự động tải danh sách các Model đang có trên máy chủ.

### 4.3. Chế độ AI Thinking / Reasoning Mode
Đối với các dòng model AI đời mới có tính năng tư duy ngầm (như `Google Gemma 4`, `DeepSeek R1`, `Qwen 2.5`):
- **None — Instant Translation (~0.3s) [Khuyên dùng]:** Tắt bỏ suy nghĩ ngầm để trả lời ngay lập tức, tốc độ dịch chỉ mất khoảng 0.2s - 0.5s.
- **Low / Medium / High:** Dành cho các tác vụ cần phân tích lập luận sâu hơn (thời gian phản hồi sẽ lâu hơn từ 5 - 15 giây).

### 4.4. Tùy biến System Prompt & Lịch sử dịch
- **Tab System Prompt:** Bạn có thể tùy biến câu lệnh chỉ thị cho AI. Ví dụ đặt prompt dịch chuẩn văn bản, hoặc dùng nút *Set Dictionary Lookup Prompt* để AI phân tích ngữ pháp, từ loại và ví dụ câu như một từ điển song ngữ.
- **Tab Translation History:** Xem lại toàn bộ lịch sử các câu đã dịch trước đó, hỗ trợ ô tìm kiếm nhanh và nút copy lại kết quả.

---

## 5. Triển khai Máy chủ GPU Mạng LAN (Nhiều người dùng)

Nếu cơ quan hoặc văn phòng của bạn có một máy tính trang bị card đồ họa mạnh (RTX 3060, 4070, 4090, 5090,...), bạn có thể cấu hình máy này làm máy chủ AI dịch thuật dùng chung cho toàn bộ nhân viên:

### Bước 1: Thiết lập trên Máy chủ GPU
1. Cài đặt **LM Studio** và tải model yêu thích (khuyên dùng `google/gemma-4-e4b` hoặc `gemma-3-4b-it-qat`).
2. Copy thư mục `scripts` trong project sang máy chủ.
3. Click chuột phải vào file **`scripts/setup_lan_server.bat`** → chọn **Run as administrator**:
   - File sẽ tự động mở cổng **Firewall TCP 1234**.
   - Khởi động server lắng nghe toàn mạng LAN (`--bind 0.0.0.0 --port 1234 --cors`).
   - Nạp model vào VRAM với cấu hình đa luồng song song (`--parallel 8`).
   - Hiển thị địa chỉ IP của máy chủ lên màn hình (Ví dụ: `http://192.168.1.150:1234`).

### Bước 2: Thiết lập trên các máy trạm (Client)
- Mọi người trong văn phòng chỉ cần mở file **`AI Local Translator 1.0.1.exe`**.
- Vào **Settings** → dán địa chỉ IP máy chủ ở trên vào ô **LM Studio Server Endpoint** → bấm **Save Settings**.
- Tất cả mọi người có thể bấm phím tắt dịch cùng lúc, tốc độ xử lý trên GPU cực nhanh và mượt mà.

---

## 6. Xử lý sự cố thường gặp (FAQ)

### ❓ 1. Ứng dụng báo lỗi "LM Studio Connection Error"?
- **Nguyên nhân:** Server LM Studio chưa được bật, hoặc nhập sai đường dẫn URL.
- **Khắc phục:** 
  1. Mở LM Studio → vào tab **Local Server (↔️)** trên thanh bên trái.
  2. Bấm nút màu xanh **Start Server** (đảm bảo hiển thị cổng `1234`).
  3. Kiểm tra xem đã nạp Model vào RAM/VRAM chưa.

### ❓ 2. Bấm phím tắt F8 hoặc F9 nhưng không thấy phản hồi?
- **Nguyên nhân:** Có phần mềm khác (như Unikey, phần mềm chụp màn hình, game) đang chiếm độc quyền phím đó, hoặc bạn đang mở 2 bản ứng dụng dịch cùng lúc.
- **Khắc phục:**
  - Nhấp chuột phải vào biểu tượng ứng dụng ở góc khay hệ thống (System Tray) → chọn **Open Settings** để đổi sang phím khác (ví dụ phím `~` hoặc `F4`, `Alt+T`).
  - Kiểm tra xem dưới khay hệ thống có bị chạy lặp 2 biểu tượng ứng dụng không, nếu có hãy chuột phải chọn **Exit App** bản cũ.

### ❓ 3. Quét ảnh tiếng Hàn/Nhật/Trung nhưng ra ký tự lạ?
- **Nguyên nhân:** Bạn đang chọn nhầm ngôn ngữ nguồn OCR là *English Only*.
- **Khắc phục:** Khi bấm `F9`, trên thanh công cụ nổi phía trên đỉnh màn hình, hãy chuyển ô chọn ngôn ngữ sang **Auto Detect** hoặc **Korean + English** / **Japanese + English** tương ứng với thứ tiếng trên bức ảnh.

### ❓ 4. Làm sao để tắt ứng dụng hoàn toàn?
- Nhấp chuột phải vào biểu tượng ứng dụng ở góc dưới bên phải màn hình (**System Tray** gần đồng hồ Windows) → chọn **❌ Exit App**.

---

## 7. Hướng dẫn Biên dịch & Đóng gói Project (Build & Package)

Dành cho lập trình viên hoặc khi bạn muốn tùy chỉnh mã nguồn và tự đóng gói ra file `.exe` mới.

### 7.1. Yêu cầu môi trường
- Đã cài đặt **Node.js** (Khuyên dùng bản LTS từ `v18` hoặc `v20` trở lên).
- Trình quản lý gói **npm** (tự động có sẵn khi cài Node.js).

### 7.2. Cài đặt các thư viện phụ thuộc (Chỉ chạy lần đầu)
Mở Terminal (PowerShell hoặc Command Prompt) tại thư mục gốc của project:
```powershell
cd D:\Works\XavisTech\AI_Translate
npm install
```

### 7.3. Các lệnh Build & Chạy

#### A. Chạy chế độ phát triển (Development / Dev Mode)
Dùng khi bạn muốn thử nghiệm, sửa đổi giao diện hoặc logic và xem kết quả cập nhật ngay lập tức (HMR - Hot Module Replacement):
```powershell
npm run dev
```

#### B. Kiểm tra biên dịch mã nguồn (Build TypeCheck & Bundle)
Lệnh này chạy kiểm tra kiểu TypeScript (`tsc`), đóng gói giao diện React qua Vite vào thư mục `dist/` và mã nguồn Electron vào `dist-electron/`:
```powershell
npm run build
```

#### C. Đóng gói ra file `.exe` hoàn chỉnh (Package / Release)
Lệnh này sẽ tự động chạy toàn bộ quy trình biên dịch code và dùng `electron-builder` để đóng gói thành các file thực thi `.exe`:
```powershell
npm run package
```

> ⚠️ **Lưu ý quan trọng trước khi Package:** Nếu bạn đang bật sẵn bản app cũ dưới khay hệ thống, hãy nhấp chuột phải vào biểu tượng dưới **System Tray** → chọn **Exit App** trước khi chạy `npm run package` để tránh bị Windows khóa file `.exe` gây lỗi quyền truy cập.

### 7.4. Kết quả đầu ra sau khi đóng gói (`release/`)
Sau khi lệnh `npm run package` hoàn tất, các file thực thi hoàn chỉnh sẽ nằm trong thư mục:
👉 `D:\Works\XavisTech\AI_Translate\release\`

Gồm 2 phiên bản:
1. **`AI Local Translator 1.0.1.exe` (Bản Portable - Khuyên dùng):**
   - Chỉ gồm 1 file thực thi duy nhất (~96 MB).
   - Copy sang máy tính khác là nhấp đúp chạy ngay, không cần cài đặt bất kỳ công cụ nào.
   - Đã nhúng sẵn toàn bộ dữ liệu nhận diện chữ OCR offline (Tiếng Anh, Hàn, Nhật, Trung, Việt).
2. **`AI Local Translator Setup 1.0.1.exe` (Bản cài đặt NSIS):**
   - Bộ cài đặt chuẩn Windows (tự động tạo Shortcut trên Desktop và Start Menu).

