# Kiến trúc

React 19 + TypeScript + Vite, TanStack Query; CSS gọn kiểu phần mềm quản trị Việt Nam, Lucide icons. Backend TypeScript Fastify + Zod + node-postgres; PostgreSQL 18. Không phụ thuộc Supabase/cloud để chạy local, giảm bước cấu hình và chi phí. Database là nguồn sự thật duy nhất.

Browser → /api (same origin production, Vite proxy development) → auth/validation → transaction service → PostgreSQL. Backend phục vụ dist khi build; mặc định chỉ bind 127.0.0.1. Mở ra LAN/Internet cần cấu hình HTTPS, cookie secure và APP_ORIGIN chính xác.

Thư mục: src/ UI ANTIGRAVITY; public/ PWA; server/ backend TERRA; shared/ contract; scripts/ công cụ local SOL; tests/e2e/ QA ANTIGRAVITY; docs/ thiết kế SOL. Không hai worker sửa cùng file. package.json và lock do SOL quản lý; worker đề xuất dependency qua Orca ask.

Ghi sổ dùng BEGIN/COMMIT/ROLLBACK, khóa row theo thứ tự ổn định và transaction-level advisory lock cho idempotency. Mọi tính tiền kiểm tra số nguyên an toàn, tính phân bổ bằng BigInt khi cần. API không có endpoint sửa trực tiếp tồn hoặc xóa ledger.

PWA chỉ cache shell tĩnh; không cache /api, không ghi offline. Manifest + icon 192/512 + service worker, mạng hiển thị rõ. In phiếu bằng trang print và Save as PDF của trình duyệt. Xuất XLSX bằng SheetJS với dữ liệu API có xác thực.

Kiểm chứng: Vitest unit + integration PostgreSQL thật, test race/idempotency/rollback, Playwright E2E trên database test, screenshot PC/tablet/mobile, kiểm console/network. Mỗi module review diff trước merge. Không deploy production trong phạm vi phiên này.

Nguồn kỹ thuật đã tra cứu: https://www.postgresql.org/docs/current/transaction-iso.html ; https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/ ; https://vite.dev/guide/ .
