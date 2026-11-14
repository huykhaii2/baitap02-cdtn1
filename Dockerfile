# Smart CRM – Mekong Mobile · L2 (Node.js 22 + Express 4). Dựng: docker compose up -d --build
FROM node:22-alpine
WORKDIR /app

# 1. Tệp khoá trước → chỉ cài lại thư viện khi package-lock.json đổi (tận dụng cache).
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 2. Mã nguồn, migration, dữ liệu mẫu và test (BT3 chạy test TRONG container).
COPY src ./src
COPY scripts ./scripts
COPY db ./db
COPY dataset ./dataset
COPY tests ./tests

# 3. Không chạy bằng root.
USER node
EXPOSE 3000

# Bước khởi tạo tự động, chạy lại nhiều lần không trùng dữ liệu: migrate → seed → chạy máy chủ.
CMD ["sh", "-c", "npm run migrate && npm run seed && npm start"]
