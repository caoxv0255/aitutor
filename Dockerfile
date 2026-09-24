FROM node:22-slim

# 归属标签: 发布门禁的镜像清理据此**限定范围**
# (docker image prune -f --filter label=com.aitutor=1)。本机同机还有别的项目
# (new-fastapi-openmaic / coze / elasticsearch), 无标签的笼统 prune 会误删它们
# 遗留的 dangling 层, 拖慢其下次 build。改 label 后重新构建才带上, 存量旧镜像
# 不带此标签 —— 存量已用 docker history 逐张确认归属后另行一次性回收。
LABEL com.aitutor=1

WORKDIR /app

# 用国内 apt 镜像(VPN 全通道下更稳定)
# g++ 已移除 (2026-08-15 验证): sharp / @napi-rs/canvas 均用 linux-x64-gnu 预编译二进制,
# 无需源码编译; 镜像 1.43GB → 1.08GB. 若未来引入需 node-gyp 的原生依赖, 再加回 g++.
RUN rm -f /etc/apt/sources.list.d/* /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian/ bookworm main contrib' > /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian-security/ bookworm-security main contrib' >> /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian/ bookworm-updates main contrib' >> /etc/apt/sources.list && \
    apt-get update -o Acquire::Retries=10 && \
    apt-get install -y --no-install-recommends -o Acquire::Retries=10 \
        python3 \
        make \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p database && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]