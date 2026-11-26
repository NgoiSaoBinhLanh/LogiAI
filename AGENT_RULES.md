# AGENT RULES - BỘ QUY TẮC BẮT BUỘC CHO AI AGENT

File này là "bộ luật bắt buộc" để mọi AI Agent tuân thủ trong suốt vòng đời dự án:

## 1. Nguyên tắc tiết kiệm tài nguyên & Quản lý ngữ cảnh (Token Hygiene)
- Chỉ đọc các file liên quan trực tiếp đến task hiện tại; cấm quét toàn bộ repo hoặc đọc `node_modules`, `.next`, `dist`, file lock (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`).
- Không in lại toàn bộ file dài khi chỉ sửa vài dòng; luôn sử dụng diff/patch chỉnh sửa cục bộ.
- Không giải thích dài dòng hay tóm tắt lại những gì đã hiển nhiên trong code.

## 2. Quy trình làm việc bắt buộc (Plan -> Code -> Verify)
- Với mọi tác vụ có ảnh hưởng từ 3 file trở lên hoặc thay đổi kiến trúc/DB: BẮT BUỘC lập kế hoạch ngắn gọn (liệt kê file sẽ tạo/sửa) và đợi xác nhận trước khi code.
- Chia nhỏ công việc theo từng module độc lập; hoàn thành và kiểm thử xong module nào mới chuyển sang module tiếp theo.

## 3. Chống sai sót & Ảo giác (Anti-Hallucination)
- Tuyệt đối tuân thủ tài liệu trong thư mục `docs/` làm Nguồn Sự Thật Duy Nhất (Single Source of Truth). Nếu tài liệu thiếu hoặc mâu thuẫn, phải dừng lại hỏi thay vì tự đoán.
- Không tự ý cài thêm thư viện ngoài danh sách tech stack đã thống nhất khi chưa được duyệt.
- Không sử dụng kiểu `any` trong TypeScript; không bỏ qua lỗi bằng `@ts-ignore` hay `eslint-disable`.
- Không xóa hoặc sửa logic cũ không liên quan đến yêu cầu hiện tại.

## 4. Tiêu chuẩn kiểm chứng trước khi báo hoàn thành (Definition of Done)
- Phải chạy kiểm tra biên dịch (`tsc --noEmit` / `build`) và lint trên phần vừa sửa không còn lỗi.
- API mới phải có validate dữ liệu đầu vào (Zod/Joi) và xử lý lỗi chuẩn hóa (HTTP status code rõ ràng).
- Bảo mật: Không hardcode secret/key/token; luôn kiểm tra phân quyền (RBAC) ở cả BE và FE.
