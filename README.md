# CookFit Content Studio

Web quản trị công thức CookFit. Hosting dùng Firebase project `cookfit-admin`; dữ liệu công thức và ảnh vẫn nằm trong project `cookfit-94659` mà app Android đang sử dụng.

## Chức năng

- Đăng nhập Google qua Firebase Authentication.
- Xem, tìm và lọc món đã xuất bản/bản nháp.
- Tạo và chỉnh sửa công thức tiếng Việt + tiếng Anh.
- Upload ảnh, tự crop 16:9 và chuyển thành WebP 1600 x 900.
- Xem trước card món ăn, đánh dấu nổi bật, sắp thứ tự và gán nhóm nội dung.
- Publish/unpublish và tăng `content_meta/recipes.version` sau mỗi thay đổi.

## Chạy local

```bash
pnpm install
pnpm dev
```

## Thiết lập Firebase lần đầu

1. Trong Firebase project `cookfit-94659`, bật **Authentication > Google**.
2. Thêm `cookfit-admin.web.app` và `cookfit-admin.firebaseapp.com` vào Authorized domains nếu Firebase chưa tự thêm.
3. Triển khai rules bằng `pnpm deploy:rules`.
4. Build và triển khai web bằng `pnpm deploy:hosting`.

Phiên bản đầu chưa có role. Rules tạm thời chỉ cho phpép email chủ project `support.mgm.studio@gmail.com` chỉnh sửa nội dung; người dùng app vẫn chỉ đọc được món `isActive == true`.
