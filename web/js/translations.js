/**
 * AI Local Translator - Bilingual Translation Dictionary (VI & EN)
 * Complete coverage for UI, Guides, Cheatsheets, FAQs, and Downloads
 */

const translations = {
  vi: {
    // Navigation
    nav_intro: "Tổng quan",
    nav_features: "Tính năng",
    nav_install: "Cài đặt",
    nav_manual: "Hướng dẫn",
    nav_download: "Tải về",
    nav_faq: "Hỗ trợ & FAQ",

    // Hero Section
    hero_status: 'Máy chủ LAN sẵn sàng: <strong>192.168.1.12:8080</strong>',
    hero_title: 'Dịch thuật AI Cục bộ Siêu tốc & <br><span class="gradient-text">Bảo mật Tuyệt đối</span>',
    hero_subtitle: 'Ứng dụng dịch thuật thông minh tích hợp mô hình ngôn ngữ lớn (Local LLM) qua mạng LAN. Dịch chọn văn bản siêu tốc, chụp màn hình OCR thông minh và hỗ trợ trả lời tin nhắn tức thì.',
    hero_btn_setup: 'Tải Bộ Cài Đặt Setup (Khuyên dùng)',
    hero_btn_portable: 'Tải Bản Portable (.exe)',
    hero_meta_privacy: '100% Dữ liệu nội bộ không ra Internet',
    hero_meta_compatibility: 'Tương thích Windows 10/11 (64-bit)',
    hero_meta_updates: 'Tự động cập nhật qua mạng LAN',
    mockup_title: 'AI Local Translator - Trực quan trực tiếp',
    mockup_status: '● Đã kết nối với LM Studio',
    mockup_orig_badge: 'VĂN BẢN GỐC (Bôi đen & Nhấn F8)',
    mockup_orig_text: '"We need to confirm the software deployment schedule with the Korean client before 5 PM today."',
    mockup_trans_badge: 'BẢN DỊCH AI TỨC THÌ (Tiếng Việt)',
    mockup_trans_text: '"Chúng ta cần xác nhận lịch triển khai phần mềm với khách hàng Hàn Quốc trước 5 giờ chiều hôm nay."',

    // Features Section
    feat_tag: 'Tính năng nổi bật',
    feat_heading: 'Công Cụ Dịch Thuật Đắc Lực Cho Dân Văn Phòng & Kỹ Sư',
    feat_subheading: 'Được thiết kế để tối ưu hóa năng suất làm việc, loại bỏ thao tác copy-paste thủ công giữa các cửa sổ.',
    feat1_title: 'Dịch Chọn Văn Bản Siêu Tốc',
    feat1_desc: 'Bôi đen văn bản ở bất kỳ ứng dụng nào (Word, Excel, trình duyệt, Slack, PDF...) và nhấn phím tắt. Cửa sổ dịch nổi mượt mà sẽ xuất hiện ngay tại vị trí con trỏ chuột.',
    feat1_hotkey: 'Phím tắt mặc định:',
    feat2_title: 'Chụp Màn Hình OCR Thông Minh',
    feat2_desc: 'Khoanh vùng bất kỳ khu vực nào trên màn hình để trích xuất văn bản từ hình ảnh, biểu đồ, video hoặc tài liệu bị khóa copy, sau đó dịch song ngữ trực quan.',
    feat2_hotkey: 'Phím tắt mặc định:',
    feat3_title: 'Quick Chat Reply & Replace',
    feat3_desc: 'Đang gõ tin nhắn tiếng Việt trong Zalo, Skype, Teams? Nhấn phím tắt để dịch sang tiếng Hàn/Anh/Nhật theo 3 sắc thái (Lịch sự, Tiêu chuẩn, Thân mật) và tự động thay thế văn bản.',
    feat3_hotkey: 'Phím tắt mặc định:',
    feat4_title: 'Bảo Mật 100% Tuyệt Đối',
    feat4_desc: 'Hoạt động độc lập thông qua máy chủ LM Studio đặt trong mạng nội bộ công ty. Không có bất kỳ dữ liệu nào bị gửi lên dịch vụ đám mây công cộng bên ngoài.',
    feat4_badge: 'Zero Cloud Leak',
    feat5_title: 'Tự Động Nâng Cấp Qua Mạng LAN',
    feat5_desc: 'Tích hợp cơ chế kiểm tra và tải cập nhật tự động từ máy chủ nội bộ. Quá trình cập nhật được tối ưu với Native Windows Shell API mượt mà và an toàn.',
    feat5_badge: 'Server: 192.168.1.12:8080',
    feat6_title: 'Tùy Biến Toàn Diện & Giọng Điệu',
    feat6_desc: 'Tự do cấu hình Prompt dịch, tinh chỉnh mức độ suy luận (Reasoning Effort), thay đổi phím tắt theo ý thích và quản lý lịch sử dịch thuật dễ dàng.',
    feat6_badge: 'Tùy biến Cài đặt',

    // Installation Guide Section
    install_tag: 'Hướng dẫn triển khai',
    install_heading: 'Cài Đặt & Cấu Hình Kết Nối Từng Bước',
    install_subheading: 'Chỉ mất 2 phút để hoàn tất thiết lập cho bất kỳ máy trạm nào trong mạng nội bộ.',
    tab_client_btn: '1. Cài đặt trên máy người dùng (Client)',
    tab_server_btn: '2. Cấu hình kết nối máy chủ LM Studio',
    tab_system_btn: '3. Yêu cầu hệ thống',

    step_client_1_title: 'Tải về gói cài đặt phù hợp',
    step_client_1_desc: 'Khuyên dùng <strong>Bản Cài Đặt (Setup .exe)</strong> để ứng dụng tự động tạo lối tắt ngoài màn hình Desktop và hỗ trợ tự khởi động cùng Windows khi bật máy.',
    step_client_1_btn_setup: 'Tải Setup Installer (.exe)',
    step_client_1_btn_portable: 'Tải Portable (.exe)',
    step_client_2_title: 'Chạy file cài đặt',
    step_client_2_desc: 'Click đúp vào file <code>AI_Local_Translator_Setup_*.exe</code> vừa tải về. Trình cài đặt NSIS sẽ tự động cài đặt ứng dụng vào thư mục người dùng mà <strong>không cần cấp quyền Quản trị viên (UAC Admin)</strong>.',
    step_client_3_title: 'Kiểm tra biểu tượng ứng dụng ở góc khay hệ thống (System Tray)',
    step_client_3_desc: 'Sau khi mở, bạn sẽ thấy icon của AI Local Translator xuất hiện ở góc phải màn hình bên cạnh đồng hồ Windows. Click chuột phải vào icon để mở menu thao tác hoặc click chuột trái để mở cửa sổ <strong>Cài đặt (Settings)</strong>.',

    step_server_1_title: 'Mở cửa sổ Cài đặt (Settings)',
    step_server_1_desc: 'Click vào icon ứng dụng dưới System Tray hoặc chọn <strong>"⚙️ Open Settings (Cài đặt)"</strong>.',
    step_server_2_title: 'Điền địa chỉ Máy chủ LM Studio',
    step_server_2_desc: 'Trong mục <strong>LM Studio API URL</strong>, hãy nhập đúng địa chỉ IP của máy chủ đang chạy LM Studio trong mạng LAN:',
    copy_text_btn: 'Sao chép',
    step_server_3_title: 'Kiểm tra kết nối và Lưu cấu hình',
    step_server_3_desc: 'Bấm nút <strong>"Test Connection"</strong>. Khi thấy xuất hiện thông báo <em>"Connected successfully! (Model loaded)"</em>, bấm <strong>"Save Settings"</strong> để hoàn tất.',

    sys_req_client_title: 'Máy Trạm Người Dùng (Client App)',
    sys_req_client_os: 'Hệ điều hành: Windows 10 / Windows 11 (64-bit)',
    sys_req_client_ram: 'RAM: Tối thiểu 4GB (Khuyên dùng 8GB+)',
    sys_req_client_disk: 'Dung lượng trống: 250MB',
    sys_req_client_net: 'Mạng: Kết nối chung mạng LAN (WiFi hoặc Dây mạng) với máy chủ',

    sys_req_server_title: 'Máy Chủ Chạy Mô Hình AI (LM Studio Host)',
    sys_req_server_app: 'Phần mềm: LM Studio v0.3.x (bật cờ Local Server)',
    sys_req_server_gpu: 'GPU: Card NVIDIA RTX 3060/4060 (8GB VRAM trở lên) để dịch siêu tốc',
    sys_req_server_model: 'Model khuyến nghị: Qwen2.5-7B-Instruct hoặc Gemma-2-9B',
    sys_req_server_port: 'Mở cổng Firewall: Port 1234 (LM Studio) & Port 8080 (Update Server)',

    // User Manual & Hotkey Cheatsheet
    manual_tag: 'Hướng dẫn sử dụng',
    manual_heading: 'Bảng Tra Cứu Phím Tắt Tiện Dụng',
    manual_subheading: 'Làm chủ toàn bộ tính năng dịch thuật tức thì chỉ với 3 phím bấm quen thuộc.',

    card_f8_title: 'Dịch Chọn Văn Bản Nhanh',
    card_f8_desc: 'Dùng để đọc hiểu email, tài liệu kỹ thuật, trang web tiếng nước ngoài mà không cần chuyển tab.',
    card_f8_step1: '<strong>Bước 1:</strong> Bôi đen đoạn chữ cần dịch trong bất kỳ app nào.',
    card_f8_step2: '<strong>Bước 2:</strong> Nhấn phím <kbd>F8</kbd>.',
    card_f8_step3: '<strong>Bước 3:</strong> Cửa sổ dịch xuất hiện tức thì với bản dịch tiếng Việt mượt mà.',

    card_f9_title: 'Chụp Màn Hình & Dịch OCR',
    card_f9_desc: 'Dùng cho các tài liệu hình ảnh, file scan không cho copy chữ, hoặc các nút bấm trong phần mềm.',
    card_f9_step1: '<strong>Bước 1:</strong> Nhấn phím <kbd>F9</kbd>, toàn màn hình sẽ tối mờ lại.',
    card_f9_step2: '<strong>Bước 2:</strong> Kéo chuột khoanh vùng hình ảnh cần đọc chữ.',
    card_f9_step3: '<strong>Bước 3:</strong> Trí tuệ nhân tạo sẽ trích xuất chữ và dịch trực tiếp.',

    card_f10_title: 'Quick Chat Reply & Replace',
    card_f10_desc: 'Dùng khi bạn cần nhắn tin trả lời đối tác/khách hàng nước ngoài bằng ngoại ngữ một cách chuẩn xác.',
    card_f10_step1: '<strong>Bước 1:</strong> Gõ câu trả lời bằng tiếng Việt vào ô chat Zalo/Teams.',
    card_f10_step2: '<strong>Bước 2:</strong> Nhấn phím <kbd>F10</kbd>.',
    card_f10_step3: '<strong>Bước 3:</strong> Chọn văn phong (Lịch sự, Tiêu chuẩn, Thân mật) rồi nhấn <kbd>Enter</kbd> để câu tiếng Việt tự động được thay thế thành câu ngoại ngữ!',

    // Download Center & Changelog
    download_tag: 'Tải về bản mới nhất',
    download_heading: 'Trung Tâm Tải Về & Nhật Ký Phát Hành',
    download_subheading: 'Bản cập nhật được đóng gói và kiểm thử tương thích kỹ lưỡng cho toàn bộ máy trạm nội bộ.',
    card_setup_badge: 'Khuyên dùng',
    card_setup_title: 'Bộ Cài Đặt Setup (NSIS Installer)',
    card_setup_desc: 'Tự động tạo lối tắt Desktop, đăng ký khởi động cùng Windows và hỗ trợ tự động nâng cấp mượt mà.',
    card_setup_btn: 'Tải File Setup (.exe)',
    card_portable_title: 'Bản Di Động Portable',
    card_portable_desc: 'Không cần cài đặt. Tải về và click chạy trực tiếp từ bất kỳ thư mục nào hoặc USB.',
    card_portable_btn: 'Tải Bản Portable (.exe)',
    meta_version_label: 'Phiên bản:',
    meta_release_label: 'Phát hành:',

    changelog_badge_latest: 'Mới nhất',
    changelog_title_latest: 'Nhật ký cập nhật',
    changelog_body_v109: '• <strong>Cơ chế cập nhật Native Windows Shell:</strong> Loại bỏ hoàn toàn script chạy ngầm, gọi trực tiếp bộ cài qua Windows Explorer, miễn nhiễm 100% với Antivirus và chính sách chặn PowerShell.<br>• <strong>Nút thao tác cập nhật trực tiếp:</strong> Thêm nút "Cài đặt & Khởi động lại ngay" và "Mở thư mục" ngay trên giao diện Cài đặt khi tải xong 100%.<br>• <strong>Cổng thông tin web nội bộ:</strong> Ra mắt website giới thiệu và tải nhanh tại <code>http://192.168.1.12:8080/</code>.<br>• <strong>Tự động đóng tiến trình cũ:</strong> Bộ cài NSIS tự động đóng các phiên bản cũ trước khi cài đè, không bị lỗi kẹt file lock.',

    changelog_title_v108: 'Phiên bản v1.0.8 (Khắc phục mở Settings & Macro đóng tiến trình NSIS)',
    changelog_body_v108: '• Khắc phục triệt để lỗi không mở được cửa sổ Cài đặt từ khay hệ thống (System Tray).<br>• Sửa định tuyến sub-hash <code>#settings?tab=updates</code> để hiển thị chính xác tab Cập nhật.<br>• Tích hợp macro NSIS <code>customCheckAppRunning</code> tự đóng tiến trình AI Local Translator trước khi ghi đè file.',

    changelog_title_v107: 'Phiên bản v1.0.7 (Hỗ trợ đa ngôn ngữ F10 & Chống lỗi đường dẫn mạng UNC)',
    changelog_body_v107: '• Hoàn thiện tính năng tự động thay thế văn bản chat (F10) cho tất cả các ngôn ngữ (Hàn, Nhật, Anh, Trung...).<br>• Sử dụng Win32 API <code>SetForegroundWindow</code> và P/Invoke C# để khôi phục chính xác cửa sổ chat đang hoạt động.<br>• Chống lỗi treo tiến trình khi người dùng mở bộ cài trực tiếp qua đường dẫn mạng LAN UNC (<code>\\\\server\\...</code>).',

    // FAQ & Troubleshooting
    faq_tag: 'Hỗ trợ & Xử lý sự cố',
    faq_heading: 'Các Câu Hỏi Thường Gặp (FAQ)',
    faq_subheading: 'Giải đáp nhanh các vấn đề kỹ thuật thường gặp khi sử dụng phần mềm trong mạng nội bộ.',

    faq_q1: 'Khi nhấn F10 (hoặc F8), cửa sổ hiện lên nhưng không dịch được gì cả?',
    faq_a1: '<strong>Nguyên nhân:</strong> Máy trạm của bạn đang để URL LM Studio mặc định là <code>http://127.0.0.1:1234/v1</code> (trỏ về chính máy bạn, nơi không có mô hình AI đang chạy).<br><br><strong>Cách khắc phục:</strong><br>1. Mở <strong>Cài đặt (Settings)</strong> trên ứng dụng.<br>2. Tại ô <strong>LM Studio API URL</strong>, đổi thành IP của máy chủ LAN: <code style="color: #a5b4fc;">http://192.168.1.12:1234/v1</code><br>3. Nhấn <strong>Test Connection</strong> và sau đó bấm <strong>Save Settings</strong>.',

    faq_q2: 'Dữ liệu văn bản và tin nhắn dịch có bị gửi ra ngoài công ty không?',
    faq_a2: '<strong>Hoàn toàn KHÔNG!</strong> Toàn bộ quá trình suy luận và dịch thuật được thực hiện 100% bởi máy chủ LM Studio đặt trong mạng LAN văn phòng của bạn. Ứng dụng không có kết nối tới OpenAI hay bất kỳ đám mây công cộng nào, đảm bảo bảo mật tuyệt đối cho mọi tài liệu mật, hợp đồng hay thông tin nội bộ.',

    faq_q3: 'Làm sao để thay đổi các phím tắt F8, F9, F10 theo ý muốn?',
    faq_a3: 'Bạn vào <strong>Cài đặt (Settings)</strong> -> cuộn xuống mục <strong>Keyboard Shortcuts (Phím tắt)</strong>. Tại đây bạn có thể click vào từng ô và gõ phím tắt mới (ví dụ: <code>Alt+T</code>, <code>Ctrl+Shift+Z</code>...), sau đó nhấn <strong>Save Settings</strong>. Phím tắt mới sẽ có hiệu lực ngay lập tức.',

    faq_q4: 'Máy khách nâng cấp bản mới bị báo lỗi hoặc không tự chạy bộ cài?',
    faq_a4: 'Nếu máy bạn đang ở phiên bản cũ (v1.0.6 trở về trước) và bị Windows Defender chặn ngầm, bạn chỉ cần mở trình duyệt vào địa chỉ trang web này: <code style="color: #a5b4fc;">http://192.168.1.12:8080/</code> -> Bấm nút <strong>"Tải Bộ Cài Đặt Setup"</strong> và chạy file vừa tải. Kể từ bản v1.0.9, mọi bản cập nhật sau này sẽ diễn ra tự động 100% không còn bị gián đoạn.',

    // Footer
    footer_desc: 'Giải pháp dịch thuật máy tính thông minh, hiệu năng cao, bảo mật dữ liệu tuyệt đối dành cho doanh nghiệp và đội ngũ kỹ thuật.',
    footer_col_nav: 'Điều hướng nhanh',
    footer_col_server: 'Thông tin hạ tầng',
    footer_server_lan: 'Máy chủ LAN:',
    footer_server_update: 'Update Port:',
    footer_server_lm: 'LM Studio Port:',
    footer_server_dev: 'Phát triển bởi XavisTech',
    footer_rights: '© 2026 XavisTech. Bảo lưu mọi quyền. Phần mềm triển khai nội bộ.',
    footer_server_ver: 'Phiên bản máy chủ:',
    toast_copied: 'Đã sao chép vào bộ nhớ tạm: '
  },

  en: {
    // Navigation
    nav_intro: "Overview",
    nav_features: "Features",
    nav_install: "Installation",
    nav_manual: "Manual",
    nav_download: "Download",
    nav_faq: "FAQ & Support",

    // Hero Section
    hero_status: 'LAN Server Ready: <strong>192.168.1.12:8080</strong>',
    hero_title: 'High-Speed Local AI Translation & <br><span class="gradient-text">Absolute Data Privacy</span>',
    hero_subtitle: 'Smart desktop translation powered by local Large Language Models (LLMs) over your corporate LAN. Instant text selection translation, smart OCR screen snip, and quick chat reply & replace.',
    hero_btn_setup: 'Download Setup Installer (Recommended)',
    hero_btn_portable: 'Download Portable (.exe)',
    hero_meta_privacy: '100% Internal Data • Zero Cloud Leak',
    hero_meta_compatibility: 'Compatible with Windows 10/11 (64-bit)',
    hero_meta_updates: 'Automatic LAN Updates Supported',
    mockup_title: 'AI Local Translator - Live Preview',
    mockup_status: '● Connected to LM Studio',
    mockup_orig_badge: 'ORIGINAL TEXT (Highlight & Press F8)',
    mockup_orig_text: '"We need to confirm the software deployment schedule with the Korean client before 5 PM today."',
    mockup_trans_badge: 'INSTANT AI TRANSLATION (Vietnamese)',
    mockup_trans_text: '"Chúng ta cần xác nhận lịch triển khai phần mềm với khách hàng Hàn Quốc trước 5 giờ chiều hôm nay."',

    // Features Section
    feat_tag: 'Key Capabilities',
    feat_heading: 'Empowering Engineers & Office Teams with Instant Translation',
    feat_subheading: 'Designed for peak productivity, eliminating manual window switching and copy-paste friction.',
    feat1_title: 'Instant Text Selection Translation',
    feat1_desc: 'Highlight text in any desktop application (Word, Excel, browser, Slack, PDF...) and press the hotkey. A sleek floating translation popup appears instantly right at your cursor.',
    feat1_hotkey: 'Default Hotkey:',
    feat2_title: 'Smart OCR Screen Snipping',
    feat2_desc: 'Snip any screen region to extract text from images, diagrams, video frames, or locked documents, then view side-by-side visual translations.',
    feat2_hotkey: 'Default Hotkey:',
    feat3_title: 'Quick Chat Reply & Replace',
    feat3_desc: 'Typing in Vietnamese inside Zalo, Teams, or Slack? Press the hotkey to translate to Korean/English/Japanese across 3 tone presets and auto-replace in-place.',
    feat3_hotkey: 'Default Hotkey:',
    feat4_title: '100% Data Confidentiality',
    feat4_desc: 'Operates independently via your company\'s in-house LM Studio server. Zero sensitive data or confidential company IP ever leaves your local network.',
    feat4_badge: 'Zero Cloud Leak',
    feat5_title: 'Automatic LAN Auto-Updater',
    feat5_desc: 'Built-in automated background update checking and downloading from the local server. Powered by Native Windows Shell execution for smooth, antivirus-safe updates.',
    feat5_badge: 'Server: 192.168.1.12:8080',
    feat6_title: 'Full Customization & Tone Control',
    feat6_desc: 'Freely customize system prompts, adjust AI reasoning effort, remap shortcut keys, and review complete translation history.',
    feat6_badge: 'Settings Customization',

    // Installation Guide Section
    install_tag: 'Deployment Guide',
    install_heading: 'Step-by-Step Installation & Setup',
    install_subheading: 'Takes less than 2 minutes to set up on any workstation in your corporate network.',
    tab_client_btn: '1. Client Workstation Installation',
    tab_server_btn: '2. LM Studio Server Connection',
    tab_system_btn: '3. System Requirements',

    step_client_1_title: 'Download the appropriate package',
    step_client_1_desc: 'We recommend the <strong>Setup Installer (.exe)</strong> so the application automatically creates Desktop shortcuts and registers Windows startup.',
    step_client_1_btn_setup: 'Download Setup (.exe)',
    step_client_1_btn_portable: 'Download Portable (.exe)',
    step_client_2_title: 'Run the installer',
    step_client_2_desc: 'Double click the downloaded <code>AI_Local_Translator_Setup_*.exe</code> file. The NSIS installer installs cleanly into user space <strong>without requiring Administrator privileges (UAC Admin)</strong>.',
    step_client_3_title: 'Verify the application icon in the System Tray',
    step_client_3_desc: 'Once launched, you will see the AI Local Translator icon next to the Windows taskbar clock. Right-click the icon for the quick menu or click to open <strong>Settings</strong>.',

    step_server_1_title: 'Open Settings Window',
    step_server_1_desc: 'Click on the application icon in the System Tray or select <strong>"⚙️ Open Settings"</strong>.',
    step_server_2_title: 'Enter LM Studio Server URL',
    step_server_2_desc: 'In the <strong>LM Studio API URL</strong> input box, enter the local LAN IP address of your host machine running LM Studio:',
    copy_text_btn: 'Copy URL',
    step_server_3_title: 'Test Connection and Save',
    step_server_3_desc: 'Click <strong>"Test Connection"</strong>. Once <em>"Connected successfully! (Model loaded)"</em> appears, click <strong>"Save Settings"</strong> to finish.',

    sys_req_client_title: 'Client Workstation Requirements',
    sys_req_client_os: 'Operating System: Windows 10 / Windows 11 (64-bit)',
    sys_req_client_ram: 'RAM: Minimum 4GB (8GB+ recommended)',
    sys_req_client_disk: 'Free Disk Space: 250MB',
    sys_req_client_net: 'Network: Connected to same LAN (Wi-Fi or Ethernet) as server',

    sys_req_server_title: 'LM Studio AI Server Requirements',
    sys_req_server_app: 'Software: LM Studio v0.3.x (Local Server toggle enabled)',
    sys_req_server_gpu: 'GPU: NVIDIA RTX 3060/4060 (8GB+ VRAM) for high-speed inference',
    sys_req_server_model: 'Recommended Models: Qwen2.5-7B-Instruct or Gemma-2-9B',
    sys_req_server_port: 'Firewall Inbound Rules: Port 1234 (LM Studio) & Port 8080 (Update Server)',

    // User Manual & Hotkey Cheatsheet
    manual_tag: 'User Manual',
    manual_heading: 'Handy Hotkey Cheatsheet',
    manual_subheading: 'Master all instant translation features with 3 intuitive keyboard shortcuts.',

    card_f8_title: 'Quick Text Selection Translation',
    card_f8_desc: 'Quickly comprehend foreign emails, technical documents, and websites without switching tabs.',
    card_f8_step1: '<strong>Step 1:</strong> Highlight text in any application.',
    card_f8_step2: '<strong>Step 2:</strong> Press hotkey <kbd>F8</kbd>.',
    card_f8_step3: '<strong>Step 3:</strong> The popup appears instantly with smooth translated text.',

    card_f9_title: 'Screen Snipping & OCR Translation',
    card_f9_desc: 'Ideal for image graphics, non-selectable scanned PDFs, or UI text inside desktop apps.',
    card_f9_step1: '<strong>Step 1:</strong> Press hotkey <kbd>F9</kbd>; your screen dims slightly.',
    card_f9_step2: '<strong>Step 2:</strong> Drag to snip the target area containing text.',
    card_f9_step3: '<strong>Step 3:</strong> AI OCR extracts text and visual translation displays side-by-side.',

    card_f10_title: 'Quick Chat Reply & Replace',
    card_f10_desc: 'Send accurate replies to international clients and colleagues in their native language.',
    card_f10_step1: '<strong>Step 1:</strong> Type your reply in Vietnamese inside Zalo, Teams, or Slack.',
    card_f10_step2: '<strong>Step 2:</strong> Press hotkey <kbd>F10</kbd>.',
    card_f10_step3: '<strong>Step 3:</strong> Pick your tone preset (Polite, Standard, Casual) and press <kbd>Enter</kbd> to automatically replace the message!',

    // Download Center & Changelog
    download_tag: 'Download Latest Release',
    download_heading: 'Download Center & Release Changelog',
    download_subheading: 'Packaged and thoroughly verified for all workstations across your corporate network.',
    card_setup_badge: 'Recommended',
    card_setup_title: 'Setup Installer (NSIS Package)',
    card_setup_desc: 'Automatically creates Desktop shortcuts, registers Windows auto-startup, and supports silent auto-updates.',
    card_setup_btn: 'Download Setup (.exe)',
    card_portable_title: 'Portable Executable',
    card_portable_desc: 'Zero installation required. Download and run directly from any folder or USB drive.',
    card_portable_btn: 'Download Portable (.exe)',
    meta_version_label: 'Version:',
    meta_release_label: 'Released:',

    changelog_badge_latest: 'Latest',
    changelog_title_latest: 'Release Notes',
    changelog_body_v109: '• <strong>Native Windows Shell Auto-Updater:</strong> Completely eliminated background scripts. Spawns installer via Windows Explorer with full user session elevation, eliminating Antivirus and PowerShell execution policy blocks.<br>• <strong>Direct In-App Update Controls:</strong> Added "Install & Restart Now" and "Open Folder" action buttons on the update screen when download completes.<br>• <strong>Corporate LAN Web Portal:</strong> Launched web documentation and download portal at <code>http://192.168.1.12:8080/</code>.<br>• <strong>NSIS Process Cleaner:</strong> Installer automatically terminates old instances before file extraction, preventing locked files.',

    changelog_title_v108: 'Version v1.0.8 (Settings Window Display & NSIS Process Cleaner)',
    changelog_body_v108: '• Fixed issue where clicking Settings from System Tray remained invisible.<br>• Corrected sub-hash routing for <code>#settings?tab=updates</code>.<br>• Integrated NSIS <code>customCheckAppRunning</code> macro to gracefully close running processes.',

    changelog_title_v107: 'Version v1.0.7 (Multi-language F10 Replace & UNC Path Hardening)',
    changelog_body_v107: '• Completed automatic chat text replacement (F10) across all languages (Korean, Japanese, English, Chinese...).<br>• Utilized Win32 API <code>SetForegroundWindow</code> and P/Invoke C# to accurately restore active chat windows.<br>• Protected against process hangs when setup is executed directly over UNC LAN shares (<code>\\\\server\\...</code>).',

    // FAQ & Troubleshooting
    faq_tag: 'Troubleshooting & Support',
    faq_heading: 'Frequently Asked Questions (FAQ)',
    faq_subheading: 'Quick solutions for common operational and network questions in local environments.',

    faq_q1: 'Pressing F10 (or F8) opens the dialog, but nothing is translated?',
    faq_a1: '<strong>Root Cause:</strong> Your workstation is configured with default URL <code>http://127.0.0.1:1234/v1</code> (pointing to localhost where no LM Studio model is running).<br><br><strong>Solution:</strong><br>1. Open <strong>Settings</strong> in the application.<br>2. Under <strong>LM Studio API URL</strong>, enter the LAN host IP: <code style="color: #a5b4fc;">http://192.168.1.12:1234/v1</code><br>3. Click <strong>Test Connection</strong>, then click <strong>Save Settings</strong>.',

    faq_q2: 'Is translation text or message data ever sent outside the company?',
    faq_a2: '<strong>Absolutely NOT!</strong> All inference and translation processing takes place 100% on your internal LM Studio server inside your local network. The application has zero outbound connections to OpenAI or public clouds, ensuring complete confidentiality for sensitive documents, contracts, and internal communications.',

    faq_q3: 'How can I change the F8, F9, F10 hotkeys?',
    faq_a3: 'Open <strong>Settings</strong> -> scroll down to <strong>Keyboard Shortcuts</strong>. Click inside any shortcut box and press your preferred key combination (e.g., <code>Alt+T</code>, <code>Ctrl+Shift+Z</code>), then click <strong>Save Settings</strong>. The new shortcut activates immediately.',

    faq_q4: 'Client update fails or does not launch the installer automatically?',
    faq_a4: 'If a client is stuck on an older version (v1.0.6 or earlier) due to Windows Defender background blocking, simply open a browser to: <code style="color: #a5b4fc;">http://192.168.1.12:8080/</code> -> Click <strong>"Download Setup Installer"</strong> and run the file. From version v1.0.9 onward, all subsequent updates will execute 100% automatically.',

    // Footer
    footer_desc: 'High-performance, secure local desktop translation solution for engineering and enterprise teams.',
    footer_col_nav: 'Quick Navigation',
    footer_col_server: 'Infrastructure',
    footer_server_lan: 'LAN Server Host:',
    footer_server_update: 'Update Port:',
    footer_server_lm: 'LM Studio Port:',
    footer_server_dev: 'Developed by XavisTech',
    footer_rights: '© 2026 XavisTech. All rights reserved. Internal Corporate Deployment.',
    footer_server_ver: 'Host Version:',
    toast_copied: 'Copied to clipboard: '
  }
};
